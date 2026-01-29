import { PDFDocument } from 'pdf-lib';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function mergePDFs() {
  console.log('Merging PDFs...');

  const mergedPdf = await PDFDocument.create();
  const slideCount = 8;

  // Add all slides to the merged PDF
  for (let i = 1; i <= slideCount; i++) {
    const filename = `slide-${i}.pdf`;
    const pdfPath = join(__dirname, 'exports', filename);

    console.log(`Adding slide ${i}...`);
    const pdfBytes = await readFile(pdfPath);
    const pdf = await PDFDocument.load(pdfBytes);
    const [copiedPage] = await mergedPdf.copyPages(pdf, [0]);
    mergedPdf.addPage(copiedPage);
  }

  // Save the merged PDF
  const mergedPath = join(__dirname, 'exports', 'MTV-AIDLC-Demo-Complete.pdf');
  const mergedBytes = await mergedPdf.save();
  await writeFile(mergedPath, mergedBytes);

  console.log('\n✅ PDF merge complete!');
  console.log(`📄 Complete presentation: ${mergedPath}`);
  console.log(`📊 Total slides: ${slideCount}`);

  // Calculate file size
  const stats = await import('fs').then(fs => fs.promises.stat(mergedPath));
  const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`📦 File size: ${sizeInMB} MB\n`);
}

mergePDFs().catch(console.error);
