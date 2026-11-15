import { mkdir, readdir, copyFile } from 'node:fs/promises';
await mkdir('public/ocr/core', { recursive: true });
await copyFile('node_modules/tesseract.js/dist/worker.min.js', 'public/ocr/worker.min.js');
for (const file of await readdir('node_modules/tesseract.js-core'))
  if (/\.wasm(?:\.js)?$/.test(file))
    await copyFile(`node_modules/tesseract.js-core/${file}`, `public/ocr/core/${file}`);
await copyFile('node_modules/pdfjs-dist/build/pdf.worker.min.mjs', 'public/ocr/pdf.worker.min.mjs');
console.log('Prepared local OCR and PDF workers.');
