import sharp from 'sharp';
await sharp(
  Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="white"/><g font-family="Arial" font-size="44" fill="black"><text x="80" y="120">SAHAAYA TEST RECORD</text><text x="80" y="220">Fictional patient</text><text x="80" y="320">Glucose: 105 mg/dL</text><text x="80" y="420">Date: 15 Nov 2026</text><text x="80" y="560">For software testing only</text></g></svg>',
  ),
)
  .png()
  .toFile('.data/ocr-fixture.png');
