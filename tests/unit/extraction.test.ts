import { describe, it, expect } from 'vitest';
import { transcriptFields, recordExtractionSchema } from '@/lib/extraction';
describe('local OCR review boundary', () => {
  it('preserves decimal points and units without interpreting a prescription', () => {
    const rows = transcriptFields('[Page 1]\nMedicine: ??? 0.5 mg\n[Page 2]\nTake as directed');
    expect(rows).toEqual([
      { label: 'Medicine', value: '??? 0.5 mg', sourcePage: 1, uncertain: true },
      { label: 'Line', value: 'Take as directed', sourcePage: 2, uncertain: true },
    ]);
  });
  it('bounds text extraction and marks all initial fields uncertain', () => {
    const rows = transcriptFields(Array(1000).fill('unknown').join('\n'));
    expect(rows).toHaveLength(80);
    expect(rows.every((r) => r.uncertain)).toBe(true);
  });
  it('rejects invalid confidence and page provenance', () => {
    expect(
      recordExtractionSchema.safeParse({
        kind: 'report',
        text: 'fixture',
        confidence: 97,
        pages: 6,
        totalPages: 6,
        fields: [],
        barcodes: [],
      }).success,
    ).toBe(false);
  });
});
