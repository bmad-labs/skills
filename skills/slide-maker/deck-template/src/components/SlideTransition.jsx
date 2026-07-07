import { motion, useSpring, useTransform } from 'framer-motion';
import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

// ── Animation in this deck ───────────────────────────────────────────────────
// Two libraries, both available; pick by the job (see wow-guide.md §4):
//   • framer-motion (helpers below) — simple declarative bits: stagger reveal,
//     count-up, the accent-rule draw, and the slide enter/exit transition (App.jsx).
//   • GSAP (useSlideGsap / useGSAP below) — timeline-based or sequenced animation
//     (chained reveals, draw-on paths, coordinated multi-element choreography).
// Keep MTI's calm idiom either way: ease 'power2.out', short durations, no bounce.
//
// Re-exported so a slide can `import { gsap, useGSAP } from '@/components/SlideTransition'`.
export { gsap, useGSAP };

// useSlideGsap — run a GSAP timeline scoped to a slide, with automatic cleanup on
// unmount (slides mount/unmount via AnimatePresence, so cleanup matters or tweens
// leak and replay wrong on revisit). useGSAP wraps gsap.context + revert for us.
//
//   function MySlide() {
//     const ref = useSlideGsap((tl, scope) => {
//       tl.from('[data-viz-id="s2.title"]', { y: 16, opacity: 0, duration: 0.5 })
//         .from('.card', { y: 12, opacity: 0, stagger: 0.08 }, '-=0.2');
//     });
//     return <div ref={ref} className="slide-page" data-viz-id="s2"> … </div>;
//   }
//
// `build(tl, scope)` receives a fresh timeline (calm MTI defaults) + the scope el.
export function useSlideGsap(build, deps = []) {
  const ref = useRef(null);
  useGSAP(() => {
    if (!ref.current || typeof build !== 'function') return;
    const tl = gsap.timeline({ defaults: { ease: 'power2.out', duration: 0.5 } });
    build(tl, ref.current);
  }, { scope: ref, dependencies: deps });
  return ref;
}

// Calm motion helpers (wow-guide §4). Stagger reveal + count-up, no bounce.

export const staggerContainer = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };
export const staggerItem = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

export function StaggerContainer({ children, className }) {
  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className={className}>
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className, ...rest }) {
  return (
    <motion.div variants={staggerItem} className={className} {...rest}>
      {children}
    </motion.div>
  );
}

// Count-up number. bounce:0 keeps it corporate-calm. Extra props (e.g.
// data-viz-id) forward to the wrapper span so edit mode + the PPTX walk see it.
//
// EXPORT CAVEAT: the animated inner <motion.span> can be mis-measured by the editable
// PPTX walk — a hero number exported tiny/misplaced (the measure-contract reads the
// inline animation wrapper, not the styled outer box). If a number is a HERO that must
// survive the editable PPTX faithfully, render it as STATIC styled text
// (`<p className="text-[112px] font-display font-black …">67</p>`) instead of CountUp.
// CountUp is fine for non-critical/secondary counters and for HTML/PDF/image exports.
export function CountUp({ to, suffix = '', className, ...rest }) {
  const s = useSpring(0, { duration: 800, bounce: 0 });
  const shown = useTransform(s, (v) => Math.round(v));
  useEffect(() => { s.set(to); }, [s, to]);
  return (
    <span className={className} {...rest}>
      <motion.span>{shown}</motion.span>{suffix}
    </span>
  );
}

// Accent-rule draw-in (scaleX from the left). Extra props forward to the element.
export function AccentRule({ className, ...rest }) {
  return (
    <motion.div
      className={`mti-rule ${className || ''}`}
      initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      style={{ transformOrigin: 'left' }}
      {...rest}
    />
  );
}
