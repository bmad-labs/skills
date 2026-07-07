import { memo, useState, useRef, useEffect } from 'react';
import { Sparkles, ChevronDown, Check } from 'lucide-react';
import { TRANSITIONS, TRANSITION_ORDER } from './transitions';

/*
  Deck-wide present-mode transition picker (TopBar dropdown). Sets which transition
  every slide change uses in Presentation mode. The options come from the same
  transitions.js catalog that design-system/transitions.csv mirrors. Tagged
  data-navigation so it never lands in an export.
*/
function TransitionMenu({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const current = TRANSITIONS[value] || TRANSITIONS.fade;

  return (
    <div ref={ref} className="relative" data-navigation>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 h-8 rounded-md text-text-secondary hover:bg-bg-subtle text-small transition-colors"
        aria-haspopup="menu" aria-expanded={open}
        title="Slide transition (Presentation mode)"
      >
        <Sparkles size={14} />
        <span className="hidden sm:inline">{current.name}</span>
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-10 z-50 w-56 p-1.5 rounded-lg bg-bg-card border border-border-subtle shadow-lg">
          <p className="px-2.5 py-1.5 text-[11px] text-text-muted">Transition · Presentation mode</p>
          {TRANSITION_ORDER.map((key) => {
            const t = TRANSITIONS[key];
            const on = key === value;
            return (
              <button
                key={key} role="menuitemradio" aria-checked={on}
                onClick={() => { onChange(key); setOpen(false); }}
                className={`flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md text-left text-small transition-colors ${
                  on ? 'bg-bg-subtle text-primary-500 font-medium' : 'text-text-primary hover:bg-bg-subtle'
                }`}
              >
                <span className="w-4 shrink-0">{on && <Check size={14} />}</span>
                {t.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default memo(TransitionMenu);
