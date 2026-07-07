/*
  Present-mode slide transitions. Each entry is a framer-motion variant set + timing,
  keyed by id. `direction` (d): +1 = forward (next), -1 = backward (prev). All keep the
  slides OVERLAPPING (the deck uses AnimatePresence mode="sync"), so the incoming slide
  is always painted over the outgoing one — no dark gap shows through the ink backdrop.

  This catalog is mirrored in design-system/transitions.csv (same ids/names) so the
  agent can pick a transition the way it picks a layout. Keep the two in sync.

  Calm by default (wow-guide §4: no bounce, ≤0.45s). `none` is an instant cut.
*/
export const TRANSITIONS = {
  none: {
    name: 'None (cut)',
    transition: { duration: 0 },
    variants: { enter: { opacity: 1 }, center: { opacity: 1, zIndex: 1 }, exit: { opacity: 1, zIndex: 0 } },
  },
  fade: {
    name: 'Fade',
    transition: { duration: 0.3, ease: 'easeInOut' },
    variants: { enter: { opacity: 0 }, center: { opacity: 1, zIndex: 1 }, exit: { opacity: 0, zIndex: 0 } },
  },
  slide: {
    name: 'Slide',
    transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] },
    variants: {
      enter: (d) => ({ x: d > 0 ? '100%' : '-100%', opacity: 1, zIndex: 1 }),
      center: { x: 0, opacity: 1, zIndex: 1 },
      exit: (d) => ({ x: d > 0 ? '-100%' : '100%', opacity: 1, zIndex: 0 }),
    },
  },
  'push-up': {
    name: 'Push up',
    transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] },
    variants: {
      enter: (d) => ({ y: d > 0 ? '100%' : '-100%', opacity: 1, zIndex: 1 }),
      center: { y: 0, opacity: 1, zIndex: 1 },
      exit: (d) => ({ y: d > 0 ? '-100%' : '100%', opacity: 1, zIndex: 0 }),
    },
  },
  'slide-fade': {
    name: 'Slide + fade',
    transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] },
    variants: {
      enter: (d) => ({ x: d > 0 ? 60 : -60, opacity: 0, zIndex: 1 }),
      center: { x: 0, opacity: 1, zIndex: 1 },
      exit: (d) => ({ x: d > 0 ? -60 : 60, opacity: 0, zIndex: 0 }),
    },
  },
  zoom: {
    name: 'Zoom',
    transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] },
    variants: {
      enter: { scale: 1.06, opacity: 0, zIndex: 1 },
      center: { scale: 1, opacity: 1, zIndex: 1 },
      exit: { scale: 0.96, opacity: 0, zIndex: 0 },
    },
  },
  'zoom-out': {
    name: 'Zoom out',
    transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] },
    variants: {
      enter: { scale: 0.92, opacity: 0, zIndex: 1 },
      center: { scale: 1, opacity: 1, zIndex: 1 },
      exit: { scale: 1.08, opacity: 0, zIndex: 0 },
    },
  },
  reveal: {
    name: 'Reveal (wipe)',
    transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] },
    // the incoming slide wipes in from the right via clip-path; the old stays put under it
    variants: {
      enter: (d) => ({ clipPath: d > 0 ? 'inset(0 0 0 100%)' : 'inset(0 100% 0 0)', opacity: 1, zIndex: 2 }),
      center: { clipPath: 'inset(0 0 0 0%)', opacity: 1, zIndex: 2 },
      exit: { clipPath: 'inset(0 0 0 0%)', opacity: 1, zIndex: 0 },
    },
  },
};

export const DEFAULT_TRANSITION = 'fade';

// ordered list for the picker (keeps a sensible UI order)
export const TRANSITION_ORDER = ['none', 'fade', 'slide', 'push-up', 'slide-fade', 'zoom', 'zoom-out', 'reveal'];
