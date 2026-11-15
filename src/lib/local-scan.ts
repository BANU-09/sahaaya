'use client';
export type LocalScan = {
  text: string;
  confidence: number | null;
  barcodes: string[];
  pages: number;
  totalPages: number;
  warnings: string[];
};
const languages: Record<string, string> = {
  en: 'eng',
  te: 'eng+tel',
  ta: 'eng+tam',
  hi: 'eng+hin',
  kn: 'eng+kan',
  ml: 'eng+mal',
};
export async function scanLocally(
  file: File,
  language: string,
  progress: (value: number) => void,
): Promise<LocalScan> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker(languages[language] || 'eng', 1, {
    workerPath: '/ocr/worker.min.js',
    corePath: '/ocr/core',
    langPath: 'https://tessdata.projectnaptha.com/4.0.0',
    logger: (m) => {
      if (m.status === 'recognizing text') progress(Math.round(m.progress * 100));
    },
  });
  const result: LocalScan = {
    text: '',
    confidence: null,
    barcodes: [],
    pages: 1,
    totalPages: 1,
    warnings: [],
  };
  let pdf: import('pdfjs-dist').PDFDocumentProxy | undefined;
  let loadingTask: import('pdfjs-dist').PDFDocumentLoadingTask | undefined;
  const confidences: number[] = [];
  async function recognize(canvas: HTMLCanvasElement, page: number) {
    if (Math.min(canvas.width, canvas.height) < 500) result.warnings.push('lowResolution');
    const thumb = document.createElement('canvas');
    thumb.width = thumb.height = 64;
    const context = thumb.getContext('2d', { willReadFrequently: true })!;
    context.drawImage(canvas, 0, 0, 64, 64);
    const pixels = context.getImageData(0, 0, 64, 64).data;
    const gray = Array.from(
      { length: 4096 },
      (_, i) => (pixels[4 * i] + pixels[4 * i + 1] + pixels[4 * i + 2]) / 3,
    );
    const mean = gray.reduce((a, b) => a + b, 0) / gray.length;
    const variance = gray.reduce((a, b) => a + (b - mean) ** 2, 0) / gray.length;
    if (variance < 150 || mean < 35) result.warnings.push('poorContrast');
    const { data } = await worker.recognize(canvas);
    result.text += `\n[Page ${page}]\n${data.text}`;
    confidences.push(data.confidence / 100);
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const barcode = new BrowserMultiFormatReader().decodeFromCanvas(canvas).getText();
      if (barcode) result.barcodes.push(barcode);
    } catch {
      /* No readable barcode is a valid result. */
    }
    canvas.width = canvas.height = 0;
  }
  try {
    if (file.type === 'application/pdf') {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = '/ocr/pdf.worker.min.mjs';
      loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
      pdf = await loadingTask.promise;
      result.totalPages = pdf.numPages;
      result.pages = Math.min(5, pdf.numPages);
      if (pdf.numPages > 5) result.warnings.push('firstFivePages');
      for (let i = 1; i <= result.pages; i++) {
        const page = await pdf.getPage(i),
          natural = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({
          scale: Math.min(2, 2000 / Math.max(natural.width, natural.height)),
        });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise;
        await recognize(canvas, i);
        page.cleanup();
      }
    } else {
      const bitmap = await createImageBitmap(file),
        scale = Math.min(1, 3000 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      await recognize(canvas, 1);
    }
    result.confidence = confidences.length ? Math.min(...confidences) : null;
    result.warnings = [...new Set(result.warnings)];
    if (result.confidence !== null && result.confidence < 0.75)
      result.warnings.push('unclearImage');
    result.text = result.text.trim().slice(0, 30000);
    return result;
  } finally {
    await worker.terminate();
    await loadingTask?.destroy();
  }
}
