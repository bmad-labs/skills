import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, ChevronLeft, ChevronRight, Keyboard, Download } from 'lucide-react';

export default function Navigation({
  currentSlide,
  totalSlides,
  navItems,
  onPrev,
  onNext,
  onGoTo,
  onExport
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [showQuickNav, setShowQuickNav] = useState(false);
  const quickNavRef = useRef(null);

  const progress = ((currentSlide + 1) / totalSlides) * 100;

  // Number key navigation (1-9 for slides 1-9, 0 for slide 10)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Skip if typing in input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const key = e.key;
      if (key >= '1' && key <= '9') {
        const slideIndex = parseInt(key) - 1;
        if (slideIndex < totalSlides) {
          onGoTo(slideIndex);
        }
      } else if (key === '0' && totalSlides >= 10) {
        onGoTo(9); // Jump to slide 10
      } else if (key === 'g' || key === 'G') {
        // 'g' opens quick nav for "go to"
        e.preventDefault();
        setShowQuickNav(true);
      } else if (key === 'Escape') {
        setShowQuickNav(false);
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [totalSlides, onGoTo]);

  // Close quick nav when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (quickNavRef.current && !quickNavRef.current.contains(e.target)) {
        setShowQuickNav(false);
      }
    };
    if (showQuickNav) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showQuickNav]);

  return (
    <>
      {/* Slide Dots - Quick Jump (visible when <= 12 slides) */}
      {totalSlides <= 12 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-bg-card/60 backdrop-blur-xl border border-border-subtle shadow-lg">
            {Array.from({ length: totalSlides }, (_, i) => (
              <button
                key={i}
                onClick={() => onGoTo(i)}
                className="group relative"
                title={navItems[i]?.label || `Slide ${i + 1}`}
              >
                <div
                  className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${
                    currentSlide === i
                      ? 'bg-primary-500 scale-125'
                      : 'bg-text-muted/40 hover:bg-text-muted/70 hover:scale-110'
                  }`}
                />
                {/* Tooltip on hover */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <div className="px-2 py-1 rounded bg-bg-card/95 border border-border-subtle text-xs whitespace-nowrap">
                    {navItems[i]?.label || `Slide ${i + 1}`}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Left Side Horizontal Navigation Bar */}
      <div className="fixed left-6 bottom-6 z-50">
        <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-bg-card/60 backdrop-blur-xl border border-border-subtle shadow-2xl shadow-black/20">
          {/* Menu Toggle */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-2.5 rounded-xl hover:bg-bg-elevated/50 transition-colors"
          >
            {isOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          {/* Divider */}
          <div className="w-px h-6 bg-border-subtle" />

          {/* Prev Button */}
          <button
            onClick={onPrev}
            disabled={currentSlide === 0}
            className="p-2.5 rounded-xl hover:bg-bg-elevated/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={18} />
          </button>

          {/* Clickable Progress Indicator - Opens Quick Nav */}
          <button
            onClick={() => setShowQuickNav(!showQuickNav)}
            className="flex items-center gap-3 px-2 py-1 rounded-lg hover:bg-bg-elevated/30 transition-colors"
            title="Click to jump to slide (or press G)"
          >
            {/* Horizontal Progress Bar */}
            <div className="relative w-20 h-1 bg-border-subtle rounded-full overflow-hidden">
              <div
                className="absolute left-0 h-full bg-primary-500 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Slide Counter */}
            <span className="text-xs font-medium tabular-nums whitespace-nowrap">
              <span className="text-text-primary">{currentSlide + 1}</span>
              <span className="text-text-muted"> / </span>
              <span className="text-text-secondary">{totalSlides}</span>
            </span>
          </button>

          {/* Next Button */}
          <button
            onClick={onNext}
            disabled={currentSlide === totalSlides - 1}
            className="p-2.5 rounded-xl hover:bg-bg-elevated/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={18} />
          </button>

          {/* Divider */}
          <div className="w-px h-6 bg-border-subtle" />

          {/* Keyboard Hints Toggle */}
          <button
            onClick={() => setShowHints(!showHints)}
            className={`p-2.5 rounded-xl transition-colors ${
              showHints ? 'bg-primary-500/20 text-primary-400' : 'hover:bg-bg-elevated/50'
            }`}
          >
            <Keyboard size={18} />
          </button>

          {/* Export Button */}
          {onExport && (
            <button
              onClick={onExport}
              className="p-2.5 rounded-xl hover:bg-bg-elevated/50 transition-colors"
              title="Export presentation"
            >
              <Download size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Quick Navigation Popup - Grid of slide numbers */}
      <AnimatePresence>
        {showQuickNav && (
          <motion.div
            ref={quickNavRef}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed left-6 bottom-20 z-50"
          >
            <div className="p-3 rounded-2xl bg-bg-card/95 backdrop-blur-xl border border-border-subtle shadow-2xl min-w-[200px]">
              <div className="flex items-center justify-between mb-3 px-1">
                <p className="text-xs font-medium text-text-muted uppercase tracking-wider">Jump to slide</p>
                <span className="text-xs text-text-muted">Press 1-9</span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {Array.from({ length: totalSlides }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      onGoTo(i);
                      setShowQuickNav(false);
                    }}
                    className={`relative w-9 h-9 rounded-lg flex items-center justify-center text-sm font-medium transition-all ${
                      currentSlide === i
                        ? 'bg-primary-500 text-white'
                        : 'bg-bg-elevated/50 hover:bg-bg-elevated text-text-secondary hover:text-text-primary'
                    }`}
                    title={navItems[i]?.label || `Slide ${i + 1}`}
                  >
                    {i + 1}
                    {/* Keyboard hint for 1-9 */}
                    {i < 9 && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 rounded text-[8px] bg-bg-card border border-border-subtle flex items-center justify-center text-text-muted">
                        {i + 1}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Keyboard Hints Tooltip */}
      <AnimatePresence>
        {showHints && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.15 }}
            className="fixed left-6 bottom-20 z-50"
          >
            <div className="px-4 py-3 rounded-xl bg-bg-card/90 backdrop-blur-xl border border-border-subtle shadow-xl">
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <kbd className="px-2 py-1 rounded bg-bg-elevated text-text-secondary text-xs">←</kbd>
                  <kbd className="px-2 py-1 rounded bg-bg-elevated text-text-secondary text-xs">→</kbd>
                  <span className="text-text-muted">Navigate</span>
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="px-2 py-1 rounded bg-bg-elevated text-text-secondary text-xs">1</kbd>
                  <span className="text-text-muted">-</span>
                  <kbd className="px-2 py-1 rounded bg-bg-elevated text-text-secondary text-xs">9</kbd>
                  <span className="text-text-muted">Jump</span>
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="px-2 py-1 rounded bg-bg-elevated text-text-secondary text-xs">G</kbd>
                  <span className="text-text-muted">Go to</span>
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="px-2 py-1 rounded bg-bg-elevated text-text-secondary text-xs">Space</kbd>
                  <span className="text-text-muted">Next</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slide Menu Overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            />

            {/* Menu Panel */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.2 }}
              className="fixed left-6 bottom-20 z-50 w-72 max-h-[70vh] overflow-y-auto"
            >
              <div className="p-2 rounded-2xl bg-bg-card/95 backdrop-blur-xl border border-border-subtle shadow-2xl">
                <div className="px-3 py-2 mb-1">
                  <p className="text-xs font-medium text-text-muted uppercase tracking-wider">Slides</p>
                </div>
                {navItems.map((item, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      onGoTo(item.slideIndex);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-xl mb-1 transition-colors ${
                      currentSlide === item.slideIndex
                        ? 'bg-primary-500/20 text-primary-400'
                        : 'hover:bg-bg-elevated/50 text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-medium ${
                        currentSlide === item.slideIndex
                          ? 'bg-primary-500/30 text-primary-400'
                          : 'bg-bg-elevated'
                      }`}>
                        {item.slideIndex + 1}
                      </span>
                      <span className="text-sm font-medium truncate">{item.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
