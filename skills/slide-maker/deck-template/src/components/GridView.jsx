import { memo } from 'react';
import SlideThumb from './SlideThumb';

/*
  Grid / overview view (Google-Slides-style) — all slides as live thumbnails in a
  responsive grid. Click one to jump to it and return to single-slide view. Fills
  the area right of the rail, scrolls. Tagged data-navigation so it's deck chrome,
  never exported.
*/
function GridView({ slides, navItems, current, onPick }) {
  return (
    <div
      data-navigation
      style={{ top: 'var(--deck-topbar-h)', left: 'var(--deck-rail-w)' }}
      className="fixed right-0 bottom-0 z-30 overflow-y-auto bg-bg-elevated"
    >
      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5 p-6">
        {slides.map((Slide, i) => {
          const isActive = i === current;
          const label = navItems[i]?.label || `Slide ${i + 1}`;
          return (
            <button
              key={i}
              onClick={() => onPick(i)}
              className="group flex flex-col gap-1.5 text-left"
              title={label}
            >
              <span
                className={`block rounded-md overflow-hidden transition-shadow ${
                  isActive
                    ? 'ring-2 ring-primary-500 shadow-md'
                    : 'ring-1 ring-border-subtle group-hover:ring-primary-300 group-hover:shadow-sm'
                }`}
              >
                <SlideThumb Slide={Slide} width={240} />
              </span>
              <span className="flex items-baseline gap-1.5 px-0.5">
                <span className={`text-[11px] tabular-nums ${isActive ? 'text-primary-500 font-bold' : 'text-text-muted'}`}>
                  {i + 1}
                </span>
                <span className="text-[12px] text-text-secondary truncate">{label}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default memo(GridView);
