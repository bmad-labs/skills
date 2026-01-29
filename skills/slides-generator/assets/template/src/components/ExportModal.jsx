import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, FileText, Globe, Loader2, Check, AlertCircle, Image, Code } from 'lucide-react';

export default function ExportModal({
  isOpen,
  onClose,
  totalSlides,
  currentSlide,
  goToSlide,
  presentationName = 'Presentation'
}) {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState(null);
  const [completed, setCompleted] = useState(null);
  const [exportMode, setExportMode] = useState(null); // 'all' or 'current'

  // Dynamically load libraries
  const loadLibraries = async () => {
    const [html2canvasModule, jsPDFModule] = await Promise.all([
      import('html2canvas'),
      import('jspdf')
    ]);
    return {
      html2canvas: html2canvasModule.default,
      jsPDF: jsPDFModule.jsPDF
    };
  };

  // Wait for slide to be fully rendered
  const waitForSlideRender = (isFirstSlide = false) => {
    return new Promise(resolve => {
      // First slide needs more time for initial load
      const waitTime = isFirstSlide ? 2500 : 2000;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTimeout(resolve, waitTime);
        });
      });
    });
  };

  // Capture a single slide using a cleaner approach
  const captureSlide = async (html2canvas, slideIndex, isFirstCapture = false) => {
    // Navigate to slide
    goToSlide(slideIndex);

    // Wait for slide transition and render
    await waitForSlideRender(isFirstCapture);

    // Store elements we'll modify so we can restore them
    const modifications = [];

    // 1. Hide all fixed positioned elements (navigation, modals, etc.)
    document.querySelectorAll('*').forEach(el => {
      const style = window.getComputedStyle(el);
      if (style.position === 'fixed') {
        modifications.push({
          element: el,
          property: 'display',
          originalValue: el.style.display
        });
        el.style.setProperty('display', 'none', 'important');
      }
    });

    // 2. Adjust slide-page padding to remove nav-safe-area
    const rootStyles = getComputedStyle(document.documentElement);
    const slidePadding = rootStyles.getPropertyValue('--slide-padding').trim() || '3rem';

    document.querySelectorAll('.slide-page').forEach(page => {
      modifications.push({
        element: page,
        property: 'paddingBottom',
        originalValue: page.style.paddingBottom
      });
      page.style.setProperty('padding-bottom', slidePadding, 'important');
    });

    // Wait for reflow after modifications and force multiple reflows
    await new Promise(resolve => setTimeout(resolve, 50));
    document.body.offsetHeight; // Force reflow
    await new Promise(resolve => requestAnimationFrame(resolve));
    await new Promise(resolve => requestAnimationFrame(resolve));
    await new Promise(resolve => setTimeout(resolve, 200));

    // Capture the modified DOM using foreignObjectRendering for better accuracy
    const canvas = await html2canvas(document.body, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#0f172a',
      logging: false,
      x: 0,
      y: 0,
      width: window.innerWidth,
      height: window.innerHeight,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      foreignObjectRendering: true, // Use native browser rendering
    });

    // Restore all modifications
    modifications.forEach(({ element, property, originalValue }) => {
      if (originalValue) {
        element.style[property] = originalValue;
      } else {
        element.style.removeProperty(property.replace(/([A-Z])/g, '-$1').toLowerCase());
      }
    });

    return canvas;
  };

  // Export to PDF
  const exportToPDF = async (mode) => {
    setExporting(true);
    setExportMode(mode);
    setError(null);
    setCompleted(null);
    setProgress(0);
    setStatus('Preparing export...');

    try {
      const { html2canvas, jsPDF } = await loadLibraries();

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      const pdf = new jsPDF({
        orientation: viewportWidth > viewportHeight ? 'landscape' : 'portrait',
        unit: 'px',
        format: [viewportWidth, viewportHeight],
        hotfixes: ['px_scaling']
      });

      const startSlide = mode === 'current' ? currentSlide : 0;
      const endSlide = mode === 'current' ? currentSlide + 1 : totalSlides;
      const slideCount = endSlide - startSlide;

      for (let i = startSlide; i < endSlide; i++) {
        const slideNum = i - startSlide + 1;
        setStatus(`Capturing slide ${slideNum} of ${slideCount}...`);
        setProgress((slideNum / slideCount) * 90);

        const canvas = await captureSlide(html2canvas, i, i === startSlide);
        const imgData = canvas.toDataURL('image/jpeg', 0.92);

        if (i > startSlide) {
          pdf.addPage([viewportWidth, viewportHeight], viewportWidth > viewportHeight ? 'landscape' : 'portrait');
        }

        pdf.addImage(imgData, 'JPEG', 0, 0, viewportWidth, viewportHeight, undefined, 'FAST');
      }

      setStatus('Generating PDF...');
      setProgress(95);

      const fileName = mode === 'current'
        ? `${presentationName} - Slide ${currentSlide + 1}.pdf`
        : `${presentationName}.pdf`;
      pdf.save(fileName);

      setProgress(100);
      setCompleted('pdf');
      setStatus('PDF exported successfully!');
    } catch (err) {
      console.error('Export error:', err);
      setError(err.message || 'Failed to export PDF');
    } finally {
      setExporting(false);
      setTimeout(() => goToSlide(mode === 'current' ? currentSlide : 0), 100);
    }
  };

  // Export to HTML
  const exportToHTML = async (mode) => {
    setExporting(true);
    setExportMode(mode);
    setError(null);
    setCompleted(null);
    setProgress(0);
    setStatus('Preparing export...');

    try {
      const { html2canvas } = await loadLibraries();

      const slideImages = [];
      const startSlide = mode === 'current' ? currentSlide : 0;
      const endSlide = mode === 'current' ? currentSlide + 1 : totalSlides;
      const slideCount = endSlide - startSlide;

      for (let i = startSlide; i < endSlide; i++) {
        const slideNum = i - startSlide + 1;
        setStatus(`Capturing slide ${slideNum} of ${slideCount}...`);
        setProgress((slideNum / slideCount) * 90);

        const canvas = await captureSlide(html2canvas, i, i === startSlide);
        slideImages.push(canvas.toDataURL('image/jpeg', 0.9));
      }

      setStatus('Generating HTML...');
      setProgress(95);

      const htmlContent = generateStandaloneHTML(presentationName, slideImages);

      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const fileName = mode === 'current'
        ? `${presentationName} - Slide ${currentSlide + 1}.html`
        : `${presentationName}.html`;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setProgress(100);
      setCompleted('html');
      setStatus('HTML exported successfully!');
    } catch (err) {
      console.error('Export error:', err);
      setError(err.message || 'Failed to export HTML');
    } finally {
      setExporting(false);
      setTimeout(() => goToSlide(mode === 'current' ? currentSlide : 0), 100);
    }
  };

  // Export current slide as PNG
  const exportToPNG = async () => {
    setExporting(true);
    setExportMode('current');
    setError(null);
    setCompleted(null);
    setProgress(0);
    setStatus('Capturing slide...');

    try {
      const { html2canvas } = await loadLibraries();
      setProgress(30);

      const canvas = await captureSlide(html2canvas, currentSlide, true);
      setProgress(80);

      setStatus('Generating image...');
      const imgData = canvas.toDataURL('image/png');

      const a = document.createElement('a');
      a.href = imgData;
      a.download = `${presentationName} - Slide ${currentSlide + 1}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setProgress(100);
      setCompleted('png');
      setStatus('Image exported successfully!');
    } catch (err) {
      console.error('Export error:', err);
      setError(err.message || 'Failed to export image');
    } finally {
      setExporting(false);
    }
  };

  // Download the full HTML source file
  const downloadHTMLSource = async () => {
    setExporting(true);
    setExportMode('source');
    setError(null);
    setCompleted(null);
    setProgress(0);
    setStatus('Fetching HTML source...');

    try {
      setProgress(30);

      // Fetch the current page's HTML source
      const response = await fetch(window.location.href);
      const htmlSource = await response.text();

      setStatus('Preparing download...');
      setProgress(70);

      // Download the HTML source
      const blob = new Blob([htmlSource], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${presentationName}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setProgress(100);
      setCompleted('source');
      setStatus('HTML downloaded!');
    } catch (err) {
      console.error('Download error:', err);
      setError(err.message || 'Failed to download HTML');
    } finally {
      setExporting(false);
    }
  };

  // Generate standalone HTML (screenshot-based)
  const generateStandaloneHTML = (title, base64Images) => {
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
    .presentation { position: relative; width: 100%; height: 100%; }
    .slide {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.3s ease;
    }
    .slide.active { opacity: 1; visibility: visible; }
    .slide img { max-width: 100%; max-height: 100%; object-fit: contain; }
    .navigation {
      position: fixed;
      bottom: 24px;
      left: 24px;
      display: flex;
      align-items: center;
      gap: 12px;
      background: rgba(15, 23, 42, 0.9);
      backdrop-filter: blur(12px);
      padding: 10px 16px;
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      z-index: 100;
    }
    .nav-btn {
      width: 36px;
      height: 36px;
      border: none;
      background: rgba(255, 255, 255, 0.1);
      color: white;
      border-radius: 10px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }
    .nav-btn:hover:not(:disabled) { background: rgba(255, 255, 255, 0.2); }
    .nav-btn:disabled { opacity: 0.3; cursor: not-allowed; }
    .slide-counter {
      font-size: 13px;
      color: rgba(255, 255, 255, 0.7);
      min-width: 50px;
      text-align: center;
    }
    .progress-container {
      width: 80px;
      height: 4px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 2px;
      overflow: hidden;
    }
    .progress-bar {
      height: 100%;
      background: #3b82f6;
      transition: width 0.3s ease;
    }
    @media print {
      .navigation { display: none !important; }
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
  <div class="presentation" id="presentation">
    ${base64Images.map((imgData, i) => `
    <div class="slide${i === 0 ? ' active' : ''}" data-slide="${i}">
      <img src="${imgData}" alt="Slide ${i + 1}">
    </div>`).join('')}
  </div>
  ${base64Images.length > 1 ? `
  <div class="navigation">
    <button class="nav-btn" id="prev" aria-label="Previous slide">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M15 18l-6-6 6-6"/>
      </svg>
    </button>
    <div class="progress-container">
      <div class="progress-bar" id="progress"></div>
    </div>
    <span class="slide-counter"><span id="current">1</span> / ${base64Images.length}</span>
    <button class="nav-btn" id="next" aria-label="Next slide">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 18l6-6-6-6"/>
      </svg>
    </button>
  </div>
  ` : ''}
  <script>
    const slides = document.querySelectorAll('.slide');
    const total = slides.length;
    let current = 0;
    function goTo(index) {
      if (index < 0 || index >= total) return;
      slides[current].classList.remove('active');
      current = index;
      slides[current].classList.add('active');
      const currentEl = document.getElementById('current');
      const progressEl = document.getElementById('progress');
      if (currentEl) currentEl.textContent = current + 1;
      if (progressEl) progressEl.style.width = ((current + 1) / total * 100) + '%';
      const prevBtn = document.getElementById('prev');
      const nextBtn = document.getElementById('next');
      if (prevBtn) prevBtn.disabled = current === 0;
      if (nextBtn) nextBtn.disabled = current === total - 1;
    }
    const prevBtn = document.getElementById('prev');
    const nextBtn = document.getElementById('next');
    if (prevBtn) prevBtn.addEventListener('click', () => goTo(current - 1));
    if (nextBtn) nextBtn.addEventListener('click', () => goTo(current + 1));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); goTo(current + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(current - 1); }
      else if (e.key === 'Home') { e.preventDefault(); goTo(0); }
      else if (e.key === 'End') { e.preventDefault(); goTo(total - 1); }
    });
    goTo(0);
  </script>
</body>
</html>`;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={!exporting ? onClose : undefined}
            className="fixed inset-0 bg-black/40 z-[100]"
          />

          {/* Modal - Bottom Right */}
          <motion.div
            initial={{ opacity: 0, y: 20, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: 20, x: 20 }}
            className="fixed bottom-6 right-6 z-[100] w-80"
          >
            <div className="bg-bg-card/95 backdrop-blur-xl border border-border-subtle rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-3 border-b border-border-subtle">
                <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                  <Download size={16} />
                  Export
                </h2>
                {!exporting && (
                  <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg hover:bg-bg-elevated/50 transition-colors"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* Content */}
              <div className="p-3">
                {/* Export Options */}
                {!exporting && !completed && (
                  <div className="space-y-2">
                    {/* Current Slide Section */}
                    <div className="mb-3">
                      <p className="text-xs text-text-muted mb-2 uppercase tracking-wide">Current Slide ({currentSlide + 1})</p>
                      <div className="flex gap-2">
                        <button
                          onClick={exportToPNG}
                          className="flex-1 flex items-center justify-center gap-2 p-2.5 rounded-lg bg-bg-elevated/50 hover:bg-bg-elevated border border-border-subtle hover:border-green-500/50 transition-all text-sm"
                        >
                          <Image size={16} className="text-green-400" />
                          <span>PNG</span>
                        </button>
                        <button
                          onClick={() => exportToPDF('current')}
                          className="flex-1 flex items-center justify-center gap-2 p-2.5 rounded-lg bg-bg-elevated/50 hover:bg-bg-elevated border border-border-subtle hover:border-red-500/50 transition-all text-sm"
                        >
                          <FileText size={16} className="text-red-400" />
                          <span>PDF</span>
                        </button>
                      </div>
                    </div>

                    {/* All Slides Section */}
                    <div>
                      <p className="text-xs text-text-muted mb-2 uppercase tracking-wide">All Slides ({totalSlides})</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => exportToPDF('all')}
                          className="flex-1 flex items-center justify-center gap-2 p-2.5 rounded-lg bg-bg-elevated/50 hover:bg-bg-elevated border border-border-subtle hover:border-red-500/50 transition-all text-sm"
                        >
                          <FileText size={16} className="text-red-400" />
                          <span>PDF</span>
                        </button>
                        <button
                          onClick={() => exportToHTML('all')}
                          className="flex-1 flex items-center justify-center gap-2 p-2.5 rounded-lg bg-bg-elevated/50 hover:bg-bg-elevated border border-border-subtle hover:border-blue-500/50 transition-all text-sm"
                          title="Screenshot-based HTML (static images)"
                        >
                          <Globe size={16} className="text-blue-400" />
                          <span>Images</span>
                        </button>
                      </div>
                    </div>

                    {/* Download HTML Source */}
                    <div className="pt-2 border-t border-border-subtle">
                      <button
                        onClick={downloadHTMLSource}
                        className="w-full flex items-center justify-center gap-2 p-2.5 rounded-lg bg-gradient-to-r from-purple-500/20 to-blue-500/20 hover:from-purple-500/30 hover:to-blue-500/30 border border-purple-500/30 hover:border-purple-500/50 transition-all text-sm"
                        title="Download the full HTML file with all assets embedded"
                      >
                        <Code size={16} className="text-purple-400" />
                        <span>Download HTML</span>
                      </button>
                      <p className="text-xs text-text-muted mt-1.5 text-center">
                        Single file with animations &amp; fonts
                      </p>
                    </div>
                  </div>
                )}

                {/* Progress */}
                {exporting && (
                  <div className="py-4">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                      <div className="text-center">
                        <p className="text-text-primary text-sm font-medium">{status}</p>
                        <p className="text-xs text-text-muted mt-1">
                          {Math.round(progress)}%
                        </p>
                      </div>
                      <div className="w-full h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary-500 transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Success */}
                {completed && (
                  <div className="py-4">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                        <Check className="w-6 h-6 text-green-400" />
                      </div>
                      <p className="text-text-primary text-sm font-medium">{status}</p>
                      <button
                        onClick={() => {
                          setCompleted(null);
                          setStatus('');
                          setExportMode(null);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium transition-colors"
                      >
                        Export More
                      </button>
                    </div>
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div className="mt-3 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-red-400">{error}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
