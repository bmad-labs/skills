import { useState } from 'react';
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

  const progress = ((currentSlide + 1) / totalSlides) * 100;

  return (
    <>
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

          {/* Progress Indicator - Horizontal */}
          <div className="flex items-center gap-3 px-2">
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
          </div>

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
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <kbd className="px-2 py-1 rounded bg-bg-elevated text-text-secondary text-xs">←</kbd>
                  <kbd className="px-2 py-1 rounded bg-bg-elevated text-text-secondary text-xs">→</kbd>
                  <span className="text-text-muted">Navigate</span>
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
