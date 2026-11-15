import { z } from 'zod';
import { db } from './db';
import { authenticate, authorize, audit, publicUser, rateLimit, checkOrigin } from './auth';
import { ApiError, readJson, errorResponse } from './errors';
import { authAction } from './services/accounts';
import { securityAction } from './services/security';
import { privacyAction } from './services/privacy';
import { handovers, documentHistory } from './services/continuity';
import { googleStart, googleCallback } from './services/oauth';
import { dashboard } from './services/dashboard';
import {
  createMedication,
  editMedication,
  recordPrnDose,
  approveMedication,
  confirmDose,
} from './services/medications';
import { inviteMember, acceptInvitation } from './services/circle';
import { createAppointment, updateAppointment, syncCalendar } from './services/appointments';
import {
  uploadDocument,
  listDocuments,
  downloadDocument,
  scanDocument,
  createSummary,
} from './services/records';
import { companion } from './services/companion';
import { runScheduler } from './services/worker';
import { seedDemo } from './services/demo';
import { queueCareUpdate } from './services/outbox';
import { integrationStatus, checkedFetch } from './integrations/google';
import { webPushSubscription } from './integrations/web-push';
import { emailWebhook } from './services/delivery';
import { careAnalytics } from './services/analytics';
import { recordExtraction } from './services/extractions';
import { companionDraft } from './services/companion-drafts';
import { doctorProfile, doctorReview } from './services/doctors';
import { journalSchema, taskSchema, languages, timezone } from '@/lib/validation';
import { PERMISSIONS } from '@/lib/permissions';
import { token, digest, hashSecret, verifySecret } from './crypto';

export async function dispatch(request: Request, path: string[]): Promise<unknown> {
  const method = request.method,
    url = new URL(request.url);
  if (path.join('/') === 'webhooks/resend' && method === 'POST') return emailWebhook(request);
  checkOrigin(request);
  if (path[0] === 'health' && method === 'GET') {
    await db.$queryRaw`SELECT 1`;
    const worker = await db.workerHeartbeat.findUnique({ where: { id: 'scheduler' } });
    return {
      status: 'ok',
      database: 'connected',
      worker: worker
        ? {
            lastRunAt: worker.lastRunAt,
            healthy:
              !worker.lastError &&
              Date.now() - worker.lastRunAt.getTime() <
                Math.max(120000, Number(process.env.WORKER_HEALTH_TIMEOUT_MS || 120000)),
          }
        : null,
    };
  }
  if (path[0] === 'config' && method === 'GET')
    return {
      demo: process.env.DEMO_MODE === 'true',
      integrations: integrationStatus(),
      emergencyNumber: process.env.EMERGENCY_NUMBER || null,
    };
  if (path[0] === 'auth') {
    if (path[1] === 'google' && method === 'GET')
      return path[2] === 'callback' ? googleCallback(request) : googleStart(request);
    if (method === 'POST') return authAction(path[1], request);
  }
  if (path[0] === 'passport' && method === 'GET') {
    await rateLimit('passport-public', 100);
    const share = await db.emergencyShare.findUnique({
      where: { tokenHash: digest(path[1] || '') },
      include: {
        patient: {
          include: {
            medications: {
              where: { status: 'ACTIVE' },
              select: { name: true, strength: true, dosage: true },
            },
          },
        },
      },
    });
    if (!share || share.revokedAt || share.expiresAt < new Date())
      throw new ApiError(404, 'notFound');
    return {
      name: share.patient.name,
      bloodGroup: share.patient.bloodGroup,
      allergies: share.patient.allergies,
      conditions: share.patient.conditions,
      emergencyName: share.patient.emergencyName,
      emergencyPhone: share.patient.emergencyPhone,
      medications: share.patient.medications,
      expiresAt: share.expiresAt,
    };
  }
  const { user, session } = await authenticate();
  await rateLimit(`api:${user.id}`, 180);
  if (path[0] === 'doctor-profile') {
    if (method === 'GET') return doctorProfile(user);
    if (method === 'POST') return doctorProfile(user, await readJson(request));
  }
  if (path[0] === 'operator' && path[1] === 'doctors') {
    if (method === 'GET') return doctorReview(user);
    if (method === 'PATCH') return doctorReview(user, path[2], await readJson(request));
  }
  if (path[0] === 'security' && method === 'POST')
    return securityAction(user, path[1], await readJson(request), session.id);
  if (path[0] === 'privacy' && method === 'POST')
    return privacyAction(user, path[1], await readJson(request));
  if (path[0] === 'onboarding' && method === 'POST') {
    z.object({ consent: z.literal(true) }).parse(await readJson(request));
    if (user.demo) throw new ApiError(403, 'forbidden');
    return db.$transaction(async (tx) => {
      if (await tx.patient.findUnique({ where: { ownerId: user.id } }))
        throw new ApiError(409, 'conflict');
      const patient = await tx.patient.create({
        data: {
          ownerId: user.id,
          name: user.name,
          timezone: user.timezone,
          allergies: [],
          conditions: [],
          circle: {
            create: {
              members: {
                create: {
                  userId: user.id,
                  role: 'PATIENT',
                  relationship: 'Self',
                  consentedAt: new Date(),
                  permissions: { create: PERMISSIONS.map((key) => ({ key })) },
                },
              },
            },
          },
        },
      });
      await audit(patient.id, user, 'profileUpdated', patient.id, tx);
      return { id: patient.id };
    });
  }
  if (path[0] === 'me' && method === 'GET') {
    const memberships = await db.membership.findMany({
      where: { userId: user.id, revokedAt: null, circle: { patient: { demo: user.demo } } },
      select: { role: true, circle: { select: { patient: { select: { id: true, name: true } } } } },
    });
    const doctorVerified =
      user.demo ||
      !memberships.some((m) => m.role === 'DOCTOR') ||
      Boolean(
        await db.doctor.findFirst({
          where: { userId: user.id, verifiedAt: { not: null } },
          select: { id: true },
        }),
      );
    return {
      user: publicUser(user),
      patients: memberships
        .filter((m) => m.role !== 'DOCTOR' || doctorVerified)
        .map((m) => ({ ...m.circle.patient, role: m.role })),
    };
  }
  if (path[0] === 'settings') {
    if (method === 'GET')
      return {
        user: publicUser(user),
        preferences: await db.notificationPreference.findUnique({ where: { userId: user.id } }),
        sessions: await db.session.findMany({
          where: { userId: user.id, expiresAt: { gt: new Date() } },
          select: { id: true, device: true, createdAt: true },
          take: 20,
        }),
        currentSession: session.id,
        integrations: integrationStatus(),
        reminderCheckMinutes: Number(process.env.REMINDER_CHECK_MINUTES || 1),
        googleConnected: Boolean(
          await db.googleAccount.findFirst({
            where: { userId: user.id, encryptedRefreshToken: { not: null } },
          }),
        ),
      };
    if (method === 'PATCH') {
      const data = z
        .object({
          language: z.enum(languages).optional(),
          easyMode: z.boolean().optional(),
          timezone: timezone.optional(),
          pin: z
            .string()
            .regex(/^\d{6}$/)
            .optional(),
          currentPassword: z.string().max(128).optional(),
          email: z.boolean().optional(),
          push: z.boolean().optional(),
          quietStart: z.number().int().min(0).max(23).optional(),
          quietEnd: z.number().int().min(0).max(23).optional(),
        })
        .parse(await readJson(request));
      if (data.pin && !(await verifySecret(data.currentPassword || '', user.passwordHash)))
        throw new ApiError(403, 'invalidCredentials');
      const { language, easyMode, timezone: zone, pin, ...prefs } = data;
      delete prefs.currentPassword;
      await db.user.update({
        where: { id: user.id },
        data: {
          language,
          easyMode,
          timezone: zone,
          ...(pin ? { pinHash: await hashSecret(pin) } : {}),
        },
      });
      await db.notificationPreference.upsert({
        where: { userId: user.id },
        create: { userId: user.id, ...prefs },
        update: prefs,
      });
      return { message: 'saved' };
    }
  }
  if (path[0] === 'sessions' && method === 'DELETE') {
    await db.session.deleteMany({ where: { id: path[1], userId: user.id } });
    return { message: 'saved' };
  }
  if (path[0] === 'invitations' && method === 'POST')
    return acceptInvitation(
      user,
      z.object({ token: z.string().min(30).max(100) }).parse(await readJson(request)).token,
    );
  if (path[0] === 'notifications') {
    if (method === 'GET')
      return db.notification.findMany({
        where: {
          userId: user.id,
          channel: 'IN_APP',
          OR: [
            { patientId: null },
            {
              patientId: {
                in: (
                  await db.membership.findMany({
                    where: { userId: user.id, revokedAt: null },
                    select: { circle: { select: { patientId: true } } },
                  })
                ).map((m) => m.circle.patientId),
              },
            },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    if (method === 'PATCH') {
      await db.notification.updateMany({
        where: { id: path[1], userId: user.id },
        data: { readAt: new Date() },
      });
      return { message: 'saved' };
    }
  }
  if (path[0] === 'push') {
    if (path[1] === 'receipt' && method === 'POST') {
      const { notificationId } = z
        .object({ notificationId: z.string().max(100) })
        .parse(await readJson(request));
      await db.notification.updateMany({
        where: {
          id: notificationId,
          userId: user.id,
          channel: 'PUSH',
          status: { in: ['PROCESSING', 'ACCEPTED', 'RETRY'] },
        },
        data: { status: 'DELIVERED', deliveredAt: new Date(), errorCode: null },
      });
      return { message: 'saved' };
    }
    if (method === 'GET')
      return {
        apiKey: process.env.FIREBASE_WEB_API_KEY,
        projectId: process.env.FIREBASE_PROJECT_ID,
        appId: process.env.FIREBASE_APP_ID,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        vapidKey: process.env.FIREBASE_VAPID_KEY,
        webPushPublicKey: process.env.VAPID_PUBLIC_KEY,
      };
    if (method === 'POST') {
      const payload = z
        .union([
          z.object({ subscription: webPushSubscription }),
          z.object({
            token: z
              .string()
              .min(20)
              .max(4096)
              .refine((v) => !v.startsWith('webpush:')),
          }),
        ])
        .parse(await readJson(request));
      const value =
        'subscription' in payload
          ? `webpush:${JSON.stringify(payload.subscription)}`
          : payload.token;
      await db.pushSubscription.upsert({
        where: { token: value },
        create: { userId: user.id, token: value },
        update: { userId: user.id },
      });
      return { message: 'saved' };
    }
    if (method === 'DELETE') {
      await db.pushSubscription.deleteMany({ where: { userId: user.id } });
      return { message: 'saved' };
    }
  }
  if (path[0] === 'demo' && method === 'POST') {
    if (!user.demo || process.env.DEMO_MODE !== 'true') throw new ApiError(403, 'forbidden');
    if (path[1] === 'reset') {
      if (user.id !== 'demo-patient') throw new ApiError(403, 'forbidden');
      await seedDemo(true);
      return { message: 'saved' };
    }
    if (path[1] === 'simulate') {
      const medication = await db.medication.findFirst({
        where: { patientId: 'demo-lakshmi', status: 'ACTIVE' },
      });
      if (!medication) throw new ApiError(404, 'notFound');
      const dose = await db.scheduledDose.create({
        data: {
          medicationId: medication.id,
          patientId: 'demo-lakshmi',
          scheduledAt: new Date(Date.now() - 45 * 60000),
        },
      });
      await audit('demo-lakshmi', user, 'demoSimulated', dose.id);
      await runScheduler();
      return dose;
    }
  }
  if (path[0] !== 'patients' || !path[1]) throw new ApiError(404, 'notFound');
  const patientId = path[1],
    resource = path[2],
    id = path[3],
    action = path[4];
  if (resource === 'dashboard' && method === 'GET') return dashboard(user, patientId);
  if (resource === 'analytics' && method === 'GET') return careAnalytics(user, patientId, url);
  if (resource === 'medications') {
    if (method === 'PATCH' && id)
      return editMedication(user, patientId, id, await readJson(request));
    if (method === 'POST' && action === 'prn')
      return recordPrnDose(user, patientId, id, await readJson(request));
    if (method === 'POST' && !id) return createMedication(user, patientId, await readJson(request));
    if (method === 'POST' && action === 'approve') {
      const body = z.object({ verified: z.literal(true) }).parse(await readJson(request));
      if (body.verified) return approveMedication(user, patientId, id);
    }
    if (method === 'POST' && action === 'refill') {
      await authorize(user, patientId, 'medications.edit');
      const data = z
        .object({ quantity: z.number().positive().max(100000) })
        .parse(await readJson(request));
      if (!(await db.medication.findFirst({ where: { id, patientId } })))
        throw new ApiError(404, 'notFound');
      const item = await db.refill.create({
        data: { medicationId: id, quantity: data.quantity, actorId: user.id },
      });
      await audit(patientId, user, 'refillRecorded', id);
      return item;
    }
    if (method === 'DELETE') {
      return db.$transaction(async (tx) => {
        await authorize(user, patientId, 'prescriptions.approve', tx);
        const changed = await tx.medication.updateMany({
          where: { id, patientId },
          data: { status: 'ARCHIVED' },
        });
        if (!changed.count) throw new ApiError(404, 'notFound');
        await tx.scheduledDose.updateMany({
          where: {
            medicationId: id,
            scheduledAt: { gt: new Date() },
            status: { in: ['PENDING', 'SNOOZED'] },
          },
          data: { status: 'CANCELLED' },
        });
        await audit(patientId, user, 'medicationArchived', id, tx);
        return { message: 'saved' };
      });
    }
  }
  if (resource === 'doses' && method === 'POST')
    return confirmDose(user, patientId, id, await readJson(request));
  if (resource === 'appointments') {
    if (method === 'POST' && !id)
      return createAppointment(user, patientId, await readJson(request));
    if (method === 'PATCH') return updateAppointment(user, patientId, id, await readJson(request));
    if (method === 'POST' && action === 'calendar') return syncCalendar(user, patientId, id);
  }
  if (resource === 'invitations' && method === 'POST')
    return inviteMember(user, patientId, await readJson(request));
  if (resource === 'members' && ['DELETE', 'PATCH'].includes(method)) {
    const caller = await authorize(user, patientId, 'family.manage');
    if (caller.role !== 'PATIENT') throw new ApiError(403, 'patientConsentRequired');
    const target = await db.membership.findFirst({
      where: { id, circleId: caller.circleId, role: { not: 'PATIENT' } },
    });
    if (!target) throw new ApiError(404, 'notFound');
    if (method === 'DELETE') {
      await db.membership.update({ where: { id }, data: { revokedAt: new Date() } });
      await audit(patientId, user, 'accessRevoked', id);
    } else {
      const { permissions } = z
        .object({ permissions: z.array(z.enum(PERMISSIONS)).min(1) })
        .parse(await readJson(request));
      await db.$transaction([
        db.permission.deleteMany({ where: { membershipId: id } }),
        db.permission.createMany({
          data: permissions.map((key) => ({ membershipId: id, key })),
          skipDuplicates: true,
        }),
      ]);
      await audit(patientId, user, 'permissions', id);
    }
    return { message: 'saved' };
  }
  if (resource === 'journal' && method === 'POST') {
    await authorize(user, patientId, 'journal.write');
    const data = journalSchema.parse(await readJson(request));
    const item = await db.journalEntry.create({ data: { ...data, patientId, actorId: user.id } });
    await audit(patientId, user, 'journalCreated', item.id);
    return item;
  }
  if (resource === 'vitals' && method === 'POST') {
    await authorize(user, patientId, 'journal.write');
    const data = z
      .object({
        kind: z.enum(['BLOOD_PRESSURE', 'PULSE', 'WEIGHT', 'GLUCOSE']),
        value: z.number().positive().max(1000),
        secondaryValue: z.number().positive().max(300).optional(),
      })
      .parse(await readJson(request));
    const units = { BLOOD_PRESSURE: 'mmHg', PULSE: 'bpm', WEIGHT: 'kg', GLUCOSE: 'mg/dL' };
    const item = await db.vital.create({
      data: { ...data, unit: units[data.kind], patientId, actorId: user.id },
    });
    await audit(patientId, user, 'vitalCreated', item.id);
    return item;
  }
  if (resource === 'tasks') {
    await authorize(user, patientId, 'tasks.manage');
    if (method === 'POST') {
      const data = taskSchema.parse(await readJson(request));
      if (
        data.assignedTo &&
        !(await db.membership.findFirst({
          where: { userId: data.assignedTo, circle: { patientId }, revokedAt: null },
        }))
      )
        throw new ApiError(403, 'forbidden');
      const task = await db.careTask.create({
        data: { ...data, patientId, dueAt: new Date(data.dueAt), createdBy: user.id },
      });
      await audit(patientId, user, 'taskCreated', task.id);
      await queueCareUpdate(
        db,
        patientId,
        'taskAssigned',
        `task:${task.id}`,
        false,
        task.assignedTo || undefined,
      );
      return task;
    }
    if (method === 'PATCH') {
      const data = z
        .object({
          status: z.enum(['OPEN', 'COMPLETED']),
          note: z.string().max(2000).optional(),
          assignedTo: z.string().optional(),
        })
        .parse(await readJson(request));
      if (
        data.assignedTo &&
        !(await db.membership.findFirst({
          where: { userId: data.assignedTo, circle: { patientId }, revokedAt: null },
        }))
      )
        throw new ApiError(403, 'forbidden');
      await db.careTask.updateMany({
        where: { id, patientId },
        data: {
          ...data,
          completedBy: data.status === 'COMPLETED' ? user.id : null,
          completedAt: data.status === 'COMPLETED' ? new Date() : null,
        },
      });
      await audit(patientId, user, 'taskCompleted', id);
      return { message: 'saved' };
    }
  }
  if (resource === 'alerts' && method === 'PATCH') {
    await authorize(user, patientId, 'tasks.manage');
    const data = z
      .object({ action: z.enum(['ACKNOWLEDGE', 'RESOLVE']), followup: z.string().min(3).max(2000) })
      .parse(await readJson(request));
    const changed = await db.careAlert.updateMany({
      where: { id, patientId, resolvedAt: null },
      data: {
        followup: data.followup,
        ...(data.action === 'ACKNOWLEDGE'
          ? { acknowledgedBy: user.id, acknowledgedAt: new Date() }
          : { resolvedAt: new Date() }),
      },
    });
    if (!changed.count) throw new ApiError(409, 'conflict');
    await audit(
      patientId,
      user,
      data.action === 'ACKNOWLEDGE' ? 'alertAcknowledged' : 'alertResolved',
      id,
    );
    return { message: 'saved' };
  }
  if (resource === 'documents') {
    if (id && action === 'extractions' && ['POST', 'PATCH'].includes(method))
      return recordExtraction(user, patientId, id, method, await readJson(request));
    if (id && action === 'history' && method === 'GET') return documentHistory(user, patientId, id);
    if (id && method === 'PATCH')
      return documentHistory(user, patientId, id, await readJson(request));
    if (method === 'GET')
      return id ? downloadDocument(user, patientId, id) : listDocuments(user, patientId, url);
    if (method === 'POST') return uploadDocument(user, patientId, request);
  }
  if (resource === 'handovers')
    return handovers(
      user,
      patientId,
      method,
      id,
      method === 'GET' ? undefined : await readJson(request),
    );
  if (resource === 'scan' && method === 'POST')
    return scanDocument(user, patientId, await readJson(request));
  if (resource === 'companion' && method === 'POST')
    return companion(user, patientId, await readJson(request));
  if (resource === 'companion-drafts' && method === 'POST')
    return companionDraft(user, patientId, id, await readJson(request));
  if (resource === 'summaries') {
    if (method === 'POST') return createSummary(user, patientId, await readJson(request));
    if (method === 'PATCH') {
      const member = await authorize(user, patientId, 'profile.view');
      if (member.role !== 'PATIENT') throw new ApiError(403, 'patientConsentRequired');
      z.object({ approved: z.literal(true) }).parse(await readJson(request));
      await db.visitSummary.updateMany({
        where: { id, patientId },
        data: { approvedBy: user.id, approvedAt: new Date() },
      });
      await audit(patientId, user, 'summaryApproved', id);
      return { message: 'saved' };
    }
    if (method === 'GET') {
      const member = await authorize(user, patientId, 'records.view');
      const summary = await db.visitSummary.findFirst({
        where: {
          id,
          patientId,
          ...(member.role !== 'PATIENT' ? { approvedAt: { not: null } } : {}),
        },
      });
      if (!summary) throw new ApiError(404, 'notFound');
      return summary;
    }
  }
  if (resource === 'audit' && method === 'GET') {
    await authorize(user, patientId, 'audit.view');
    const page = Math.max(1, Math.min(10000, Number(url.searchParams.get('page')) || 1));
    return db.auditLog.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      take: 25,
      skip: (page - 1) * 25,
    });
  }
  if (resource === 'profile') {
    const member = await authorize(user, patientId, 'emergency.view');
    if (method === 'GET') {
      const p = member.circle.patient;
      return {
        name: p.name,
        bloodGroup: p.bloodGroup,
        allergies: p.allergies,
        conditions: p.conditions,
        emergencyName: p.emergencyName,
        emergencyPhone: p.emergencyPhone,
        hospital: p.hospital,
        primaryDoctor: p.primaryDoctor,
        followupMinutes: p.followupMinutes,
        escalateMinutes: p.escalateMinutes,
      };
    }
    if (method === 'PATCH') {
      if (member.role !== 'PATIENT') throw new ApiError(403, 'patientConsentRequired');
      const data = z
        .object({
          bloodGroup: z.string().max(10).optional(),
          allergies: z.array(z.string().max(200)).max(30).optional(),
          conditions: z.array(z.string().max(200)).max(30).optional(),
          emergencyName: z.string().max(100).optional(),
          emergencyPhone: z
            .string()
            .regex(/^\+?[0-9]{8,15}$/)
            .optional(),
          hospital: z.string().max(200).optional(),
          primaryDoctor: z.string().max(200).optional(),
          followupMinutes: z.number().int().min(5).max(120).optional(),
          escalateMinutes: z.number().int().min(10).max(240).optional(),
        })
        .parse(await readJson(request));
      if (
        (data.followupMinutes || member.circle.patient.followupMinutes) >=
        (data.escalateMinutes || member.circle.patient.escalateMinutes)
      )
        throw new ApiError(400, 'invalidInput');
      await db.patient.update({ where: { id: patientId }, data });
      await audit(patientId, user, 'profileUpdated', patientId);
      return { message: 'saved' };
    }
  }
  if (resource === 'emergency-share') {
    const member = await authorize(user, patientId, 'emergency.view');
    if (member.role !== 'PATIENT') throw new ApiError(403, 'patientConsentRequired');
    if (method === 'POST') {
      const value = token();
      const share = await db.emergencyShare.create({
        data: { patientId, tokenHash: digest(value), expiresAt: new Date(Date.now() + 3600_000) },
      });
      await audit(patientId, user, 'emergency', share.id);
      return {
        id: share.id,
        url: `${process.env.APP_URL}/passport?token=${value}`,
        expiresAt: share.expiresAt,
      };
    }
    if (method === 'DELETE') {
      await db.emergencyShare.updateMany({ where: { patientId }, data: { revokedAt: new Date() } });
      return { message: 'saved' };
    }
  }
  if (resource === 'nearby' && method === 'POST') {
    await authorize(user, patientId, 'profile.view');
    if (!process.env.GOOGLE_MAPS_API_KEY) throw new ApiError(503, 'notConfigured');
    const data = z
      .object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) })
      .parse(await readJson(request));
    await rateLimit(`maps:${user.id}`, 5);
    const result = await checkedFetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': process.env.GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.googleMapsUri',
      },
      body: JSON.stringify({
        includedTypes: ['hospital'],
        maxResultCount: 5,
        locationRestriction: { circle: { center: data, radius: 5000 } },
      }),
    });
    return result.json();
  }
  throw new ApiError(404, 'notFound');
}
export async function handle(request: Request, path: string[]) {
  try {
    const result = await dispatch(request, path);
    const response = result instanceof Response ? result : Response.json(result);
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  } catch (error) {
    const response = errorResponse(error);
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  }
}
