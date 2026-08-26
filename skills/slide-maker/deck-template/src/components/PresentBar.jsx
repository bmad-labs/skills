import { memo } from 'react';
import { ChevronLeft, ChevronRight, MousePointer2, Pencil, Highlighter, Eraser, Minimize2 } from 'lucide-react';

/*
  Presentation-mode toolbar, pinned to the bottom-LEFT corner. Hidden until the
  cursor enters the bottom-left hot-zone (handled in App), so it stays out of the
  audience's way. Carries the present tools (laser / pen / clear), slide nav, and
  Exit. Tagged data-navigation so it never lands in an export.
*/
function PresentBar({
  current, total, onPrev, onNext,
  tool, onSetTool, onClearInk, onExit, visible,
}) {
  // inline shortcut chip, shown right next to the icon inside each button so the
  // keys read as a tidy row across the bar (more scannable than corner badges)
  const Kbd = ({ k, on }) => (
    <kbd
      className={`grid place-items-center h-[15px] min-w-[15px] px-[4px] rounded-[4px]
                  text-[9px] font-bold leading-none pointer-events-none ${
                    on ? 'bg-white/25 text-white' : 'bg-white/12 text-white/70'
                  }`}
      aria-hidden="true"
    >
      {k}
    </kbd>
  );

  const toolBtn = (t, Icon, label, keyHint) => {
    const on = tool === t;
    return (
      <button
        onClick={() => onSetTool(on ? null : t)}
        className={`flex items-center gap-1 h-8 pl-2 pr-1.5 rounded-pill transition-colors ${
          on ? 'bg-primary-500 text-white' : 'text-white/70 hover:text-white'
        }`}
        aria-label={label}
        aria-pressed={on}
        title={label}
      >
        <Icon size={16} />
        <Kbd k={keyHint} on={on} />
      </button>
    );
  };

  return (
    // Background via inline style, NOT `bg-ink-900/85`: Tailwind's slash-opacity
    // modifier can only split a color it can parse into channels. A token that is a
    // bare `var(--ink-900)` cannot be split, so that class emits NO CSS rule at all —
    // the bar rendered fully transparent, i.e. white icons on a white slide. See
    // references/deck-template.md "Slash-opacity silently drops token colors".
    <div
      data-navigation
      style={{ background: 'color-mix(in srgb, var(--ink-900) 88%, transparent)' }}
      className={`fixed bottom-5 left-5 z-50 flex items-center gap-1.5
                  rounded-pill backdrop-blur px-3 py-2 shadow-lg
                  transition-all duration-300 ${
                    visible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 pointer-events-none'
                  }`}
    >
      <button
        onClick={onPrev} disabled={current === 0}
        className="grid place-items-center w-8 h-8 rounded-pill text-white/80 hover:text-white disabled:opacity-25 transition-colors"
        aria-label="Previous slide"
      >
        <ChevronLeft size={18} />
      </button>
      <span className="text-small text-white/80 tabular-nums px-1 min-w-[3ch] text-center">
        {current + 1}/{total}
      </span>
      <button
        onClick={onNext} disabled={current === total - 1}
        className="grid place-items-center w-8 h-8 rounded-pill text-white/80 hover:text-white disabled:opacity-25 transition-colors"
        aria-label="Next slide"
      >
        <ChevronRight size={18} />
      </button>

      <span className="w-px h-5 bg-white/20 mx-1" aria-hidden="true" />

      {toolBtn('laser', MousePointer2, 'Laser pointer (L)', 'L')}
      {toolBtn('pen', Pencil, 'Pen — draw on the slide (P)', 'P')}
      {toolBtn('highlight', Highlighter, 'Highlighter (H)', 'H')}
      <button
        onClick={onClearInk}
        className="flex items-center gap-1 h-8 pl-2 pr-1.5 rounded-pill text-white/70 hover:text-status-danger transition-colors"
        aria-label="Clear drawings"
        title="Clear drawings (C)"
      >
        <Eraser size={16} />
        <Kbd k="C" />
      </button>

      <span className="w-px h-5 bg-white/20 mx-1" aria-hidden="true" />

      <button
        onClick={onExit}
        className="flex items-center gap-1 h-8 pl-2 pr-1.5 rounded-pill text-white/70 hover:text-white transition-colors"
        aria-label="Exit presentation (Esc)"
        title="Exit presentation (Esc)"
      >
        <Minimize2 size={16} />
        <Kbd k="Esc" />
      </button>
    </div>
  );
}

export default memo(PresentBar);
