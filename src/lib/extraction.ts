import { z } from 'zod';
export const recordExtractionSchema = z.object({
  kind: z.enum(['prescription', 'report', 'discharge', 'appointment', 'packaging']),
  text: z.string().min(1).max(30000),
  confidence: z.number().min(0).max(1).nullable(),
  pages: z.number().int().min(1).max(5),
  totalPages: z.number().int().min(1).max(100000),
  barcodes: z.array(z.string().max(500)).max(10),
  fields: z
    .array(
      z.object({
        label: z.string().min(1).max(160),
        value: z.string().max(2000),
        sourcePage: z.number().int().min(1).max(5),
        uncertain: z.boolean(),
      }),
    )
    .max(80),
});
export type RecordExtraction = z.infer<typeof recordExtractionSchema>;
// Transcription only: no medication, dose, diagnosis, or unit inference.
export function transcriptFields(text: string): RecordExtraction['fields'] {
  let sourcePage = 1;
  return text
    .split(/\r?\n/)
    .flatMap((line) => {
      const page = line.match(/^\[Page (\d+)\]$/);
      if (page) {
        sourcePage = Math.min(5, Math.max(1, Number(page[1])));
        return [];
      }
      if (!line.trim()) return [];
      const colon = line.indexOf(':');
      return [
        {
          label: colon > 0 && colon < 100 ? line.slice(0, colon).trim() : `Line`,
          value: (colon > 0 && colon < 100 ? line.slice(colon + 1) : line).trim().slice(0, 2000),
          sourcePage,
          uncertain: true,
        },
      ];
    })
    .slice(0, 80);
}
