import { useState, useEffect, useCallback, memo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Navigation from './components/Navigation';
import Background from './components/Background';
import ExportModal from './components/ExportModal';

// Slides will be imported here by the main agent
// Example: import Slide01 from './slides/01-hero';
// const SLIDES = [Slide01, Slide02, ...];

// Placeholder - will be replaced during generation
const SLIDES = [];
const NAV_ITEMS = [];

// Optimized slide transition variants (GPU-accelerated, no blur)
const slideVariants = {
  enter: (direction) => ({
    x: direction > 0 ? 60 : -60,
    opacity: 0
  }),
  center: {
    x: 0,
    opacity: 1
  },
  exit: (direction) => ({
    x: direction < 0 ? 60 : -60,
    opacity: 0
  })
};

// Fast, smooth transition
const slideTransition = {
  duration: 0.25,
  ease: 'easeOut'
};

// Presentation name for export (will be replaced during generation)
const PRESENTATION_NAME = 'Presentation';

// Memoized empty state component to prevent re-renders
// eslint-disable-next-line react-refresh/only-export-components
const EmptyState = memo(function EmptyState() {
  return (
    <div className="h-screen w-screen bg-bg-base flex items-center justify-center relative overflow-hidden">
      <Background variant="glow" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center z-10"
      >
        <p className="text-xl mb-2 text-text-primary">No slides yet</p>
        <p className="text-sm text-text-muted">Slides will be generated here</p>
      </motion.div>
    </div>
  );
});

export default function App() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(0);
  const [showExportModal, setShowExportModal] = useState(false);

  // Navigate to specific slide - stable callback using functional setState
  const goToSlide = useCallback((index) => {
    setCurrentSlide(prev => {
      setDirection(index > prev ? 1 : -1);
      return index;
    });
  }, []);

  // Next slide - stable callback using functional setState
  const nextSlide = useCallback(() => {
    setCurrentSlide(prev => {
      if (prev < SLIDES.length - 1) {
        setDirection(1);
        return prev + 1;
      }
      return prev;
    });
  }, []);

  // Previous slide - stable callback using functional setState
  const prevSlide = useCallback(() => {
    setCurrentSlide(prev => {
      if (prev > 0) {
        setDirection(-1);
        return prev - 1;
      }
      return prev;
    });
  }, []);

  // Keyboard navigation - stable effect with stable callbacks
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Skip if typing in input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case ' ':
          e.preventDefault();
          nextSlide();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          prevSlide();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextSlide, prevSlide]);

  // Empty state - use memoized component
  if (SLIDES.length === 0) {
    return <EmptyState />;
  }

  const CurrentSlideComponent = SLIDES[currentSlide];

  return (
    <div className="h-screen w-screen bg-bg-base overflow-hidden relative">
      {/* Decorative Background */}
      <Background variant="glow" animate={true} />

      {/* Slide Content */}
      <main className="relative h-full w-full z-10">
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={currentSlide}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={slideTransition}
            className="absolute inset-0 h-full w-full"
          >
            <CurrentSlideComponent />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Navigation */}
      <Navigation
        currentSlide={currentSlide}
        totalSlides={SLIDES.length}
        navItems={NAV_ITEMS}
        onPrev={prevSlide}
        onNext={nextSlide}
        onGoTo={goToSlide}
        onExport={() => setShowExportModal(true)}
      />

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        totalSlides={SLIDES.length}
        currentSlide={currentSlide}
        goToSlide={goToSlide}
        presentationName={PRESENTATION_NAME}
      />
    </div>
  );
}
