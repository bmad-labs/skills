#!/usr/bin/env node
/**
 * Slides Export Utility
 * Exports presentation slides to PDF and/or HTML formats
 *
 * Usage:
 *   node export-slides.js --format pdf --slides 8
 *   node export-slides.js --format html --slides 8
 *   node export-slides.js --format all --slides 8
 *
 * Options:
 *   --format   Export format: pdf, html, or all (default: pdf)
 *   --slides   Number of slides to export (required)
 *   --url      Dev server URL (default: http://localhost:5173)
 *   --output   Output directory (default: ./exports)
 *   --name     Project name for output files (default: Presentation)
 *   --scale    Device scale factor for PDF (default: 2)
 */

import puppeteer from 'puppeteer';
import { PDFDocument } from 'pdf-lib';
import { join } from 'path';
import { mkdir, writeFile, readFile } from 'fs/promises';

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    format: 'pdf',
    slides: null,
    url: 'http://localhost:5173',
    output: './exports',
    name: 'Presentation',
    scale: 2
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--format':
      case '-f':
        config.format = args[++i];
        break;
      case '--slides':
      case '-s':
        config.slides = parseInt(args[++i], 10);
        break;
      case '--url':
      case '-u':
        config.url = args[++i];
        break;
      case '--output':
      case '-o':
        config.output = args[++i];
        break;
      case '--name':
      case '-n':
        config.name = args[++i];
        break;
      case '--scale':
        config.scale = parseInt(args[++i], 10);
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
    }
  }

  return config;
}

function printHelp() {
  console.log(`
Slides Export Utility
=====================

Usage: node export-slides.js [options]

Options:
  --format, -f   Export format: pdf, html, or all (default: pdf)
  --slides, -s   Number of slides to export (required)
  --url, -u      Dev server URL (default: http://localhost:5173)
  --output, -o   Output directory (default: ./exports)
  --name, -n     Project name for output files (default: Presentation)
  --scale        Device scale factor for PDF quality (default: 2, range: 1-3)
  --help, -h     Show this help message

Examples:
  node export-slides.js --format pdf --slides 8 --name "My Presentation"
  node export-slides.js --format html --slides 8 --output ./dist
  node export-slides.js --format all --slides 8 --name "Demo" --scale 3
`);
}

async function exportToPDF(browser, config) {
  console.log('\n📄 Exporting to PDF...\n');

  const page = await browser.newPage();

  await page.setViewport({
    width: 1920,
    height: 1080,
    deviceScaleFactor: config.scale
  });

  console.log('Loading application...');
  await page.goto(config.url, { waitUntil: 'networkidle0' });
  await new Promise(resolve => setTimeout(resolve, 2000));

  const pdfDir = join(config.output, 'pdf');
  await mkdir(pdfDir, { recursive: true });

  // Export individual slides
  for (let i = 0; i < config.slides; i++) {
    console.log(`  Processing slide ${i + 1}/${config.slides}...`);

    if (i > 0) {
      await page.keyboard.press('ArrowRight');
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // Hide navigation elements
    await page.evaluate(() => {
      const navElements = document.querySelectorAll('.fixed.bottom-6, .z-50, [data-navigation]');
      navElements.forEach(el => {
        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('visibility', 'hidden', 'important');
      });
    });

    await new Promise(resolve => setTimeout(resolve, 300));

    const slidePath = join(pdfDir, `slide-${String(i + 1).padStart(2, '0')}.pdf`);
    await page.pdf({
      path: slidePath,
      width: '1920px',
      height: '1080px',
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });

    console.log(`  ✅ Slide ${i + 1} exported`);
  }

  await page.close();

  // Merge PDFs
  console.log('\n  Merging slides...');
  const mergedPdf = await PDFDocument.create();

  for (let i = 1; i <= config.slides; i++) {
    const pdfPath = join(pdfDir, `slide-${String(i).padStart(2, '0')}.pdf`);
    const pdfBytes = await readFile(pdfPath);
    const pdf = await PDFDocument.load(pdfBytes);
    const [copiedPage] = await mergedPdf.copyPages(pdf, [0]);
    mergedPdf.addPage(copiedPage);
  }

  const mergedPath = join(config.output, `${config.name}.pdf`);
  const mergedBytes = await mergedPdf.save();
  await writeFile(mergedPath, mergedBytes);

  const sizeInMB = (mergedBytes.length / (1024 * 1024)).toFixed(2);
  console.log(`\n✅ PDF export complete!`);
  console.log(`   📄 File: ${mergedPath}`);
  console.log(`   📊 Slides: ${config.slides}`);
  console.log(`   📦 Size: ${sizeInMB} MB\n`);

  return mergedPath;
}

async function exportToHTML(browser, config) {
  console.log('\n🌐 Exporting to HTML...\n');

  const page = await browser.newPage();

  await page.setViewport({
    width: 1920,
    height: 1080,
    deviceScaleFactor: config.scale
  });

  console.log('Loading application...');
  await page.goto(config.url, { waitUntil: 'networkidle0' });
  await new Promise(resolve => setTimeout(resolve, 2000));

  const htmlDir = join(config.output, 'html');
  const slidesDir = join(htmlDir, 'slides');
  const assetsDir = join(htmlDir, 'assets');

  await mkdir(slidesDir, { recursive: true });
  await mkdir(assetsDir, { recursive: true });

  // Capture screenshots for each slide
  const slideImages = [];

  for (let i = 0; i < config.slides; i++) {
    console.log(`  Processing slide ${i + 1}/${config.slides}...`);

    if (i > 0) {
      await page.keyboard.press('ArrowRight');
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // Hide navigation elements
    await page.evaluate(() => {
      const navElements = document.querySelectorAll('.fixed.bottom-6, .z-50, [data-navigation]');
      navElements.forEach(el => {
        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('visibility', 'hidden', 'important');
      });
    });

    await new Promise(resolve => setTimeout(resolve, 300));

    const imageName = `slide-${String(i + 1).padStart(2, '0')}.png`;
    const imagePath = join(slidesDir, imageName);

    await page.screenshot({
      path: imagePath,
      type: 'png',
      fullPage: false
    });

    slideImages.push(imageName);
    console.log(`  ✅ Slide ${i + 1} captured`);
  }

  await page.close();

  // Generate HTML presentation
  const htmlContent = generateHTMLPresentation(config.name, slideImages, config.slides);
  const htmlPath = join(htmlDir, 'index.html');
  await writeFile(htmlPath, htmlContent);

  // Generate standalone single-file HTML (base64 embedded images)
  console.log('\n  Creating standalone HTML...');
  const standaloneContent = await generateStandaloneHTML(config.name, slidesDir, slideImages);
  const standalonePath = join(config.output, `${config.name}.html`);
  await writeFile(standalonePath, standaloneContent);

  console.log(`\n✅ HTML export complete!`);
  console.log(`   📁 Folder: ${htmlDir}/`);
  console.log(`   📄 Standalone: ${standalonePath}`);
  console.log(`   📊 Slides: ${config.slides}\n`);

  return { htmlDir, standalonePath };
}

function generateHTMLPresentation(title, slideImages, slideCount) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a;
      color: white;
      overflow: hidden;
      height: 100vh;
    }

    .presentation {
      position: relative;
      width: 100%;
      height: 100%;
    }

    .slide {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.4s ease, visibility 0.4s ease;
    }

    .slide.active {
      opacity: 1;
      visibility: visible;
    }

    .slide img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }

    .navigation {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 16px;
      background: rgba(15, 23, 42, 0.9);
      backdrop-filter: blur(12px);
      padding: 12px 24px;
      border-radius: 50px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      z-index: 100;
    }

    .nav-btn {
      width: 40px;
      height: 40px;
      border: none;
      background: rgba(255, 255, 255, 0.1);
      color: white;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }

    .nav-btn:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.2);
    }

    .nav-btn:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }

    .slide-counter {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.7);
      min-width: 60px;
      text-align: center;
    }

    .progress-bar {
      position: fixed;
      top: 0;
      left: 0;
      height: 3px;
      background: linear-gradient(90deg, #3b82f6, #8b5cf6);
      transition: width 0.3s ease;
      z-index: 100;
    }

    .keyboard-hint {
      position: fixed;
      bottom: 90px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 12px;
      color: rgba(255, 255, 255, 0.4);
    }

    kbd {
      background: rgba(255, 255, 255, 0.1);
      padding: 2px 6px;
      border-radius: 4px;
      margin: 0 2px;
    }
  </style>
</head>
<body>
  <div class="progress-bar" id="progress"></div>

  <div class="presentation" id="presentation">
    ${slideImages.map((img, i) => `
    <div class="slide${i === 0 ? ' active' : ''}" data-slide="${i}">
      <img src="slides/${img}" alt="Slide ${i + 1}">
    </div>`).join('')}
  </div>

  <div class="navigation">
    <button class="nav-btn" id="prev" aria-label="Previous slide">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M15 18l-6-6 6-6"/>
      </svg>
    </button>
    <span class="slide-counter"><span id="current">1</span> / ${slideCount}</span>
    <button class="nav-btn" id="next" aria-label="Next slide">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 18l6-6-6-6"/>
      </svg>
    </button>
  </div>

  <div class="keyboard-hint">
    <kbd>←</kbd> <kbd>→</kbd> or <kbd>Space</kbd> to navigate
  </div>

  <script>
    const slides = document.querySelectorAll('.slide');
    const total = slides.length;
    let current = 0;

    function goTo(index) {
      if (index < 0 || index >= total) return;
      slides[current].classList.remove('active');
      current = index;
      slides[current].classList.add('active');
      document.getElementById('current').textContent = current + 1;
      document.getElementById('progress').style.width = ((current + 1) / total * 100) + '%';
      document.getElementById('prev').disabled = current === 0;
      document.getElementById('next').disabled = current === total - 1;
    }

    document.getElementById('prev').addEventListener('click', () => goTo(current - 1));
    document.getElementById('next').addEventListener('click', () => goTo(current + 1));

    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        goTo(current + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goTo(current - 1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        goTo(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        goTo(total - 1);
      }
    });

    goTo(0);
  </script>
</body>
</html>`;
}

async function generateStandaloneHTML(title, slidesDir, slideImages) {
  // Read and base64 encode all images
  const base64Images = await Promise.all(
    slideImages.map(async (img) => {
      const imagePath = join(slidesDir, img);
      const imageBuffer = await readFile(imagePath);
      return `data:image/png;base64,${imageBuffer.toString('base64')}`;
    })
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a;
      color: white;
      overflow: hidden;
      height: 100vh;
    }

    .presentation {
      position: relative;
      width: 100%;
      height: 100%;
    }

    .slide {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.4s ease, visibility 0.4s ease;
    }

    .slide.active {
      opacity: 1;
      visibility: visible;
    }

    .slide img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }

    .navigation {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 16px;
      background: rgba(15, 23, 42, 0.9);
      backdrop-filter: blur(12px);
      padding: 12px 24px;
      border-radius: 50px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      z-index: 100;
    }

    .nav-btn {
      width: 40px;
      height: 40px;
      border: none;
      background: rgba(255, 255, 255, 0.1);
      color: white;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }

    .nav-btn:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.2);
    }

    .nav-btn:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }

    .slide-counter {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.7);
      min-width: 60px;
      text-align: center;
    }

    .progress-bar {
      position: fixed;
      top: 0;
      left: 0;
      height: 3px;
      background: linear-gradient(90deg, #3b82f6, #8b5cf6);
      transition: width 0.3s ease;
      z-index: 100;
    }

    .keyboard-hint {
      position: fixed;
      bottom: 90px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 12px;
      color: rgba(255, 255, 255, 0.4);
    }

    kbd {
      background: rgba(255, 255, 255, 0.1);
      padding: 2px 6px;
      border-radius: 4px;
      margin: 0 2px;
    }

    @media print {
      .navigation, .keyboard-hint, .progress-bar { display: none !important; }
      body { background: white; }
      .slide {
        position: relative !important;
        opacity: 1 !important;
        visibility: visible !important;
        page-break-after: always;
        height: 100vh;
      }
    }
  </style>
</head>
<body>
  <div class="progress-bar" id="progress"></div>

  <div class="presentation" id="presentation">
    ${base64Images.map((imgData, i) => `
    <div class="slide${i === 0 ? ' active' : ''}" data-slide="${i}">
      <img src="${imgData}" alt="Slide ${i + 1}">
    </div>`).join('')}
  </div>

  <div class="navigation">
    <button class="nav-btn" id="prev" aria-label="Previous slide">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M15 18l-6-6 6-6"/>
      </svg>
    </button>
    <span class="slide-counter"><span id="current">1</span> / ${base64Images.length}</span>
    <button class="nav-btn" id="next" aria-label="Next slide">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 18l6-6-6-6"/>
      </svg>
    </button>
  </div>

  <div class="keyboard-hint">
    <kbd>←</kbd> <kbd>→</kbd> or <kbd>Space</kbd> to navigate
  </div>

  <script>
    const slides = document.querySelectorAll('.slide');
    const total = slides.length;
    let current = 0;

    function goTo(index) {
      if (index < 0 || index >= total) return;
      slides[current].classList.remove('active');
      current = index;
      slides[current].classList.add('active');
      document.getElementById('current').textContent = current + 1;
      document.getElementById('progress').style.width = ((current + 1) / total * 100) + '%';
      document.getElementById('prev').disabled = current === 0;
      document.getElementById('next').disabled = current === total - 1;
    }

    document.getElementById('prev').addEventListener('click', () => goTo(current - 1));
    document.getElementById('next').addEventListener('click', () => goTo(current + 1));

    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        goTo(current + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goTo(current - 1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        goTo(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        goTo(total - 1);
      }
    });

    goTo(0);
  </script>
</body>
</html>`;
}

async function main() {
  const config = parseArgs();

  if (!config.slides) {
    console.error('Error: --slides is required');
    console.error('Usage: node export-slides.js --slides <number> [--format pdf|html|all]');
    process.exit(1);
  }

  if (!['pdf', 'html', 'all'].includes(config.format)) {
    console.error('Error: --format must be pdf, html, or all');
    process.exit(1);
  }

  console.log(`
╔════════════════════════════════════════╗
║       Slides Export Utility            ║
╚════════════════════════════════════════╝

📊 Slides: ${config.slides}
📁 Output: ${config.output}
📝 Name: ${config.name}
🎯 Format: ${config.format.toUpperCase()}
🔗 URL: ${config.url}
`);

  await mkdir(config.output, { recursive: true });

  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    if (config.format === 'pdf' || config.format === 'all') {
      await exportToPDF(browser, config);
    }

    if (config.format === 'html' || config.format === 'all') {
      await exportToHTML(browser, config);
    }

    console.log('═'.repeat(44));
    console.log('✨ Export complete!');
    console.log('═'.repeat(44) + '\n');
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
