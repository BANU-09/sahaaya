import { z } from 'zod';
import type { User, Prisma } from '@prisma/client';
import { db } from '../db';
import { authorize, audit, rateLimit } from '../auth';
import { ApiError } from '../errors';
import { saveFile, loadFile } from '../integrations/storage';
import { extractPrescription } from '../integrations/google';
import { SAMPLE_EXTRACTION, samplePdf } from './demo';
import { queueCareUpdate } from './outbox';
export async function uploadDocument(user: User, patientId: string, request: Request) {
  await authorize(user, patientId, 'records.upload');
  await rateLimit(`upload:${user.id}`, 10);
  if (Number(request.headers.get('content-length') || 0) > 4 * 1024 * 1024)
    throw new ApiError(413, 'tooLarge');
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) throw new ApiError(400, 'invalidInput');
  if (file.size > 3 * 1024 * 1024) throw new ApiError(413, 'tooLarge');
  const metadata = z
    .object({
      title: z.string().trim().min(1).max(150),
      category: z.enum([
        'prescription',
        'report',
        'scan',
        'discharge',
        'consultation',
        'insurance',
        'other',
      ]),
      notes: z.string().max(1000).optional(),
    })
    .parse({
      title: form.get('title') || file.name,
      category: form.get('category') || 'other',
      notes: form.get('notes') || undefined,
    });
  const bytes = Buffer.from(await file.arrayBuffer());
  const storageKey = await saveFile(bytes, file.type);
  const document = await db.document.create({
    data: {
      ...metadata,
      patientId,
      mimeType: file.type,
      size: file.size,
      storageKey,
      uploadedBy: user.id,
    },
  });
  await audit(patientId, user, 'documentUploaded', document.id);
  await queueCareUpdate(db, patientId, 'documentUploaded', `document:${document.id}`);
  return {
    id: document.id,
    title: document.title,
    category: document.category,
    mimeType: document.mimeType,
    size: document.size,
    createdAt: document.createdAt,
  };
}
export async function listDocuments(user: User, patientId: string, url: URL) {
  await authorize(user, patientId, 'records.view');
  const page = Math.max(1, Math.min(10000, Number(url.searchParams.get('page')) || 1));
  const query = (url.searchParams.get('q') || '').slice(0, 100);
  const category = url.searchParams.get('category');
  const where = {
    patientId,
    ...(query ? { title: { contains: query, mode: 'insensitive' as const } } : {}),
    ...(category ? { category } : {}),
  };
  const [items, total] = await Promise.all([
    db.document.findMany({
      where,
      select: {
        id: true,
        title: true,
        category: true,
        mimeType: true,
        size: true,
        createdAt: true,
        notes: true,
        version: true,
        scanStatus: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * 12,
      take: 12,
    }),
    db.document.count({ where }),
  ]);
  return { items, total, page };
}
export async function downloadDocument(user: User, patientId: string, id: string) {
  await authorize(user, patientId, 'records.view');
  const doc = await db.document.findFirst({ where: { id, patientId } });
  if (!doc) throw new ApiError(404, 'notFound');
  const bytes = await loadFile(doc.storageKey);
  await audit(patientId, user, 'records', id);
  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': doc.mimeType,
      'Content-Disposition': `attachment; filename="sahaaya-document.${doc.mimeType === 'application/pdf' ? 'pdf' : doc.mimeType === 'image/png' ? 'png' : 'jpg'}"`,
      'Cache-Control': 'private, no-store',
      'Content-Security-Policy': "sandbox; default-src 'none'",
    },
  });
}
export async function scanDocument(user: User, patientId: string, body: unknown) {
  await authorize(user, patientId, 'records.upload');
  await authorize(user, patientId, 'records.view');
  await rateLimit(`scan:${user.id}`, 5);
  const data = z
    .object({
      documentId: z.string().optional(),
      sample: z.boolean().default(false),
      consent: z.boolean().default(false),
    })
    .parse(body);
  if (data.sample) {
    if (!user.demo || process.env.DEMO_MODE !== 'true') throw new ApiError(403, 'forbidden');
    const bytes = samplePdf();
    const storageKey = await saveFile(bytes, 'application/pdf');
    const document = await db.document.create({
      data: {
        patientId,
        title: 'Fictional prescription sample',
        category: 'prescription',
        mimeType: 'application/pdf',
        size: bytes.length,
        storageKey,
        uploadedBy: user.id,
      },
    });
    const prescription = await db.prescription.create({
      data: {
        patientId,
        documentId: document.id,
        source: 'DEMO_SAMPLE',
        extracted: SAMPLE_EXTRACTION,
      },
    });
    return {
      id: prescription.id,
      documentId: document.id,
      extracted: SAMPLE_EXTRACTION,
      confidence: null,
      source: 'DEMO_SAMPLE',
    };
  }
  if (!data.consent) throw new ApiError(403, 'patientConsentRequired');
  if (process.env.GEMINI_PRIVATE_DATA_ALLOWED !== 'true')
    throw new ApiError(503, 'privateAIUnavailable');
  const document = await db.document.findFirst({ where: { id: data.documentId, patientId } });
  if (!document) throw new ApiError(404, 'notFound');
  if (!document.mimeType.startsWith('image/')) throw new ApiError(415, 'unsupportedFile');
  const result = await extractPrescription(await loadFile(document.storageKey));
  const prescription = await db.prescription.upsert({
    where: { documentId: document.id },
    create: {
      patientId,
      documentId: document.id,
      source: 'GOOGLE_VISION_GEMINI',
      extracted: result.extracted,
    },
    update: {},
  });
  return {
    id: prescription.id,
    documentId: document.id,
    extracted: prescription.extracted,
    confidence: result.confidence,
    source: prescription.source,
  };
}
export async function createSummary(user: User, patientId: string, body: unknown) {
  const data = z.object({ questions: z.string().max(3000).default('') }).parse(body);
  await authorize(user, patientId, 'records.view');
  await authorize(user, patientId, 'medications.view');
  await authorize(user, patientId, 'journal.view');
  const [medications, doses, journal, documents, appointments] = await Promise.all([
    db.medication.findMany({
      where: { patientId, status: 'ACTIVE' },
      select: { name: true, strength: true, dosage: true, instructions: true },
      take: 100,
    }),
    db.scheduledDose.findMany({
      where: {
        patientId,
        scheduledAt: { gte: new Date(Date.now() - 7 * 86400_000), lte: new Date() },
      },
      select: {
        id: true,
        scheduledAt: true,
        status: true,
        confirmedAt: true,
        medication: { select: { name: true } },
      },
      take: 500,
    }),
    db.journalEntry.findMany({
      where: { patientId },
      select: { mood: true, note: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    db.document.findMany({
      where: { patientId },
      select: { id: true, title: true, category: true, createdAt: true },
      take: 50,
    }),
    db.appointment.findMany({
      where: { patientId, notes: { not: null } },
      select: { doctor: true, startsAt: true, notes: true },
      take: 20,
    }),
  ]);
  const content = JSON.parse(
    JSON.stringify({
      medications,
      doses,
      journal,
      documents,
      appointments,
      generatedAt: new Date(),
    }),
  ) as Prisma.InputJsonValue;
  const summary = await db.visitSummary.create({
    data: { patientId, content, questions: data.questions },
  });
  await audit(patientId, user, 'summaryCreated', summary.id);
  return summary;
}
