import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function exportToPDF() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Set viewport to 1920x1080 (Full HD presentation size)
  await page.setViewport({
    width: 1920,
    height: 1080,
    deviceScaleFactor: 2 // Retina for better quality
  });

  const baseUrl = 'http://localhost:5173';
  const slideCount = 8;

  console.log(`Exporting ${slideCount} slides to PDF...`);

  // Navigate to the app first
  console.log('Loading application...');
  await page.goto(baseUrl, { waitUntil: 'networkidle0' });
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Export all slides by pressing arrow keys
  for (let i = 0; i < slideCount; i++) {
    console.log(`Processing slide ${i + 1}/${slideCount}...`);

    // If not the first slide, navigate by pressing Right Arrow
    if (i > 0) {
      await page.keyboard.press('ArrowRight');

      // Wait for slide transition to complete
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Hide navigation bar for clean export
    await page.evaluate(() => {
      // Hide all fixed elements at the bottom (navigation)
      const navElements = document.querySelectorAll('.fixed.bottom-6, .z-50');
      navElements.forEach(el => {
        el.style.display = 'none';
      });
    });

    await new Promise(resolve => setTimeout(resolve, 500));

    // Export slide
    const slidePath = join(__dirname, 'exports', `slide-${i + 1}.pdf`);
    await page.pdf({
      path: slidePath,
      width: '1920px',
      height: '1080px',
      printBackground: true,
      preferCSSPageSize: false,
      margin: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
      }
    });
    console.log(`✅ Slide ${i + 1} exported`);
  }

  await browser.close();

  console.log('\n✅ PDF export complete!');
  console.log(`📁 Location: ${join(__dirname, 'exports')}/`);
  console.log(`📄 Files: slide-1.pdf through slide-${slideCount}.pdf`);
  console.log('\nRun "node merge-pdfs.js" to create the complete presentation.\n');
}

exportToPDF().catch(console.error);
