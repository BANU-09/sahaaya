import type { User } from '@prisma/client';
import { z } from 'zod';
import { db } from '../db';
import { authorize, audit } from '../auth';
import { ApiError, readJson } from '../errors';
import { token, digest } from '../crypto';
import { rateLimit } from '../auth';
import { checkedFetch } from '../integrations/google';
export async function patientProfile(user: User, patientId: string, request: Request) {
  const method = request.method;
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
  throw new ApiError(404, 'notFound');
}
export async function emergencySharing(user: User, patientId: string, request: Request) {
  const method = request.method;
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
  throw new ApiError(404, 'notFound');
}
export async function nearbyHospitals(user: User, patientId: string, request: Request) {
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
