import { memo, useEffect } from 'react';
import { Check, X } from 'lucide-react';

/*
  Transient confirmation toast (bottom-center). `message` shows it; it auto-dismisses
  after a few seconds or on click. Tagged data-navigation so it never lands in an
  export. Used for the export-prompt-copied guidance.
*/
function Toast({ message, onClose }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [message, onClose]);

  if (!message) return null;
  return (
    <div
      data-navigation
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3
                 max-w-[520px] px-4 py-3 rounded-lg bg-ink-900 text-white shadow-lg"
      role="status"
    >
      <Check size={16} className="text-primary-300 shrink-0" />
      <span className="text-small leading-snug">{message}</span>
      <button
        onClick={onClose}
        className="ml-1 grid place-items-center w-6 h-6 rounded-pill text-white/60 hover:text-white transition-colors shrink-0"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export default memo(Toast);
