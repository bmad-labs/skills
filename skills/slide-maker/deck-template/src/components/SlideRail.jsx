import { memo, useEffect, useRef } from 'react';
import { Pencil } from 'lucide-react';
import SlideThumb from './SlideThumb';

/*
  Normal-mode left rail (Google-Slides-style): a vertical list of live slide
  thumbnails. Click one to jump; the active slide is highlighted with the brand
  green. The edit-mode toggle lives in the rail header — Normal mode is where a
  human selects elements and leaves comments for Claude.

  Tagged data-navigation so export-deck.mjs and @media print hide it; it is deck
  CHROME, never part of a slide.
*/
function SlideRail({ slides, navItems, current, onGoTo, editOn, onToggleEdit }) {
  const activeRef = useRef(null);

  // keep the active thumbnail in view as you arrow through the deck
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [current]);

  return (
    <aside
      data-navigation
      style={{ width: 'var(--deck-rail-w)' }}
      className="fixed top-0 left-0 z-40 h-full flex flex-col
                 bg-bg-elevated border-r border-border-subtle"
    >
      <header className="flex items-center justify-between px-4 h-12 shrink-0 border-b border-border-subtle">
        <span className="text-eyebrow tracking-eyebrow uppercase font-bold text-text-muted">
          Slides
        </span>
        <button
          onClick={onToggleEdit}
          className={`flex items-center gap-1.5 px-2.5 h-7 rounded-pill text-small font-medium transition-colors ${
            editOn
              ? 'bg-primary-500 text-text-on-accent'
              : 'text-text-secondary hover:text-primary-500 border border-border-subtle'
          }`}
          aria-pressed={editOn}
          title="Edit mode — select elements and leave comments (E)"
        >
          <Pencil size={13} />
          Edit
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {slides.map((Slide, i) => {
          const isActive = i === current;
          const label = navItems[i]?.label || `Slide ${i + 1}`;
          return (
            <button
              key={i}
              ref={isActive ? activeRef : null}
              onClick={() => onGoTo(i)}
              className="group flex items-start gap-2 w-full text-left"
              aria-current={isActive ? 'true' : undefined}
              title={label}
            >
              <span
                className={`pt-1 w-4 shrink-0 text-[11px] tabular-nums text-right ${
                  isActive ? 'text-primary-500 font-bold' : 'text-text-muted'
                }`}
              >
                {i + 1}
              </span>
              <span
                className={`block rounded-sm overflow-hidden transition-shadow ${
                  isActive
                    ? 'ring-2 ring-primary-500 shadow-sm'
                    : 'ring-1 ring-border-subtle group-hover:ring-primary-300'
                }`}
              >
                <SlideThumb Slide={Slide} width={180} />
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

export default memo(SlideRail);
