import type { User } from '@prisma/client';
import { z } from 'zod';
import { recordExtractionSchema } from '@/lib/extraction';
import { authorize, audit, rateLimit } from '../auth';
import { db } from '../db';
import { ApiError } from '../errors';
export async function recordExtraction(
  user: User,
  patientId: string,
  documentId: string,
  method: string,
  body: unknown,
) {
  await authorize(user, patientId, 'records.view');
  await authorize(user, patientId, 'records.upload');
  await rateLimit(`extraction:${user.id}`, 15);
  if (!(await db.document.findFirst({ where: { id: documentId, patientId } })))
    throw new ApiError(404, 'notFound');
  if (method === 'POST') {
    const payload = recordExtractionSchema.parse(body);
    const extraction = await db.documentExtraction.create({
      data: {
        documentId,
        kind: payload.kind,
        payload,
        confidence: payload.confidence,
        source: 'BROWSER_TESSERACT_USER_REVIEW',
      },
    });
    await audit(patientId, user, 'extractionDrafted', extraction.id);
    return extraction;
  }
  if (method === 'PATCH') {
    const data = z
      .object({
        id: z.string(),
        version: z.number().int().min(0),
        verified: z.literal(true),
        payload: recordExtractionSchema,
      })
      .parse(body);
    // Uncertain rows may remain in a draft, but cannot be described as verified.
    if (data.payload.fields.some((f) => f.uncertain)) throw new ApiError(400, 'reviewEveryField');
    const changed = await db.documentExtraction.updateMany({
      where: { id: data.id, documentId, version: data.version, status: 'DRAFT' },
      data: {
        payload: data.payload,
        kind: data.payload.kind,
        status: 'VERIFIED',
        verifiedAt: new Date(),
        verifiedBy: user.id,
        version: { increment: 1 },
      },
    });
    if (!changed.count) throw new ApiError(409, 'conflict');
    await audit(patientId, user, 'extractionVerified', data.id);
    return { message: 'saved' };
  }
  throw new ApiError(404, 'notFound');
}
