import { memo } from 'react';
import { Play, Grid2x2, StickyNote, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import ExportMenu from './ExportMenu';
import TransitionMenu from './TransitionMenu';

/*
  Normal-mode top bar (Google-Slides-style header). Holds the deck name, the
  view toggles (grid overview, speaker notes), zoom controls for the main canvas,
  and the Present button. Tagged data-navigation so it never lands in an export.

  zoom is a number (1 = fit-to-stage). The fit baseline is computed in App; this
  bar just multiplies it. 'fit' resets to 1.
*/
function TopBar({
  deckName, current, total,
  gridOpen, onToggleGrid,
  notesOpen, onToggleNotes,
  zoom, onZoom, onFit,
  transition, onSetTransition,
  onPresent, onToast,
}) {
  const iconBtn = (onClick, Icon, label, active = false) => (
    <button
      onClick={onClick}
      className={`grid place-items-center w-8 h-8 rounded-md transition-colors ${
        active ? 'bg-primary-500 text-text-on-accent' : 'text-text-secondary hover:bg-bg-subtle'
      }`}
      aria-label={label} aria-pressed={active} title={label}
    >
      <Icon size={16} />
    </button>
  );

  return (
    <header
      data-navigation
      style={{ height: 'var(--deck-topbar-h)' }}
      className="fixed top-0 left-0 right-0 z-50 flex items-center gap-2 px-3
                 bg-bg-card border-b border-border-subtle"
    >
      <span className="font-display font-bold text-text-primary text-small truncate max-w-[40%]">
        {deckName}
      </span>
      <span className="text-[11px] text-text-muted tabular-nums">{current + 1} / {total}</span>

      <div className="flex-1" />

      {/* view toggles */}
      {iconBtn(onToggleGrid, Grid2x2, 'Grid overview', gridOpen)}
      {iconBtn(onToggleNotes, StickyNote, 'Speaker notes', notesOpen)}

      <span className="w-px h-5 bg-border-subtle mx-1" aria-hidden="true" />

      {/* zoom — "Fit" is the default (zoom === 1); other levels show as a % of fit */}
      {iconBtn(() => onZoom(zoom - 0.25), ZoomOut, 'Zoom out')}
      <button
        onClick={onFit}
        className="px-2 h-8 rounded-md text-[11px] tabular-nums text-text-secondary hover:bg-bg-subtle transition-colors min-w-[4ch]"
        title="Reset to fit"
      >
        {zoom === 1 ? 'Fit' : `${Math.round(zoom * 100)}%`}
      </button>
      {iconBtn(() => onZoom(zoom + 0.25), ZoomIn, 'Zoom in')}
      {iconBtn(onFit, Maximize, 'Fit to screen')}

      <span className="w-px h-5 bg-border-subtle mx-1" aria-hidden="true" />

      <TransitionMenu value={transition} onChange={onSetTransition} />
      <ExportMenu onToast={onToast} />

      <button
        onClick={onPresent}
        className="flex items-center gap-1.5 px-3 h-8 rounded-pill bg-primary-500 text-text-on-accent
                   text-small font-bold hover:bg-primary-600 transition-colors"
        title="Present (F5)"
      >
        <Play size={14} />
        Present
      </button>
    </header>
  );
}

export default memo(TopBar);
