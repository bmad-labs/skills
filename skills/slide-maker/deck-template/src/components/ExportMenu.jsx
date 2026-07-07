import { memo, useState, useRef, useEffect } from 'react';
import { Download, ChevronDown, FileText, FileType2, Presentation, Check, Globe } from 'lucide-react';

/*
  Export dropdown. The deck is a generated React app — exporting (HTML / PDF / PPTX)
  runs a Node script the user can't trigger from the browser. So instead of a fake
  "download", picking a format copies a ready-to-paste PROMPT to the clipboard and
  shows a toast telling the user to paste it to the AI (Claude), which runs the
  matching export script. Tagged data-navigation so it never lands in an export.

  Each prompt names the exact script + format from references/deck-template.md so
  the agent runs the right command with no guessing.
*/
const FORMATS = [
  {
    key: 'pptx-editable', label: 'PowerPoint (editable)', icon: Presentation,
    desc: 'Native, editable shapes & text — best fidelity',
    prompt: 'Export this deck to an EDITABLE PowerPoint: run `node scripts/export-pptx-jsx.mjs` in the deck-template dir (measured → native PPTX textboxes + shapes + charts), then validate with `node scripts/validate-pptx.mjs` and fix any issues. Output: export/deck.pptx.',
  },
  {
    key: 'pptx-image', label: 'PowerPoint (image)', icon: Presentation,
    desc: 'Pixel-perfect screenshots, not editable',
    prompt: 'Export this deck to a pixel-perfect PowerPoint: run `node scripts/export-deck.mjs --format pptx-image` in the deck-template dir (each slide a full-bleed screenshot). Output: export/deck.pptx.',
  },
  {
    key: 'pdf', label: 'PDF', icon: FileType2,
    desc: 'One page per slide, 1280×720',
    prompt: 'Export this deck to PDF: run `node scripts/export-deck.mjs --format pdf` in the deck-template dir (one page per slide, 1280×720). Output: export/deck.pdf.',
  },
  {
    key: 'html', label: 'Standalone HTML', icon: Globe,
    desc: 'One self-contained interactive file',
    prompt: 'Export this deck to a standalone HTML file: run `node scripts/export-deck.mjs --format html` in the deck-template dir (one self-contained file, fonts/CSS/JS inlined, nav works offline). Output: export/deck.html.',
  },
];

function ExportMenu({ onToast }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(null);
  const ref = useRef(null);

  // close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const pick = async (fmt) => {
    try {
      await navigator.clipboard.writeText(fmt.prompt);
    } catch {
      // clipboard API can fail without a user gesture / on http — fall back to a textarea
      const ta = document.createElement('textarea');
      ta.value = fmt.prompt; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch { /* give up silently */ }
      document.body.removeChild(ta);
    }
    setCopied(fmt.key);
    setTimeout(() => setCopied(null), 1500);
    setOpen(false);
    onToast?.(`Export prompt for “${fmt.label}” copied — paste it into Claude to run the export.`);
  };

  return (
    <div ref={ref} className="relative" data-navigation>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 h-8 rounded-pill border border-border-default
                   text-text-secondary hover:text-primary-500 hover:border-primary-300 text-small font-medium transition-colors"
        aria-haspopup="menu" aria-expanded={open}
        title="Export the deck"
      >
        <Download size={14} />
        Export
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-10 z-50 w-72 p-1.5 rounded-lg bg-bg-card
                     border border-border-subtle shadow-lg"
        >
          {FORMATS.map((f) => {
            const Icon = f.icon;
            const isCopied = copied === f.key;
            return (
              <button
                key={f.key} role="menuitem"
                onClick={() => pick(f)}
                className="flex items-start gap-2.5 w-full px-2.5 py-2 rounded-md text-left hover:bg-bg-subtle transition-colors"
              >
                <span className="mt-0.5 text-primary-500 shrink-0">
                  {isCopied ? <Check size={16} /> : <Icon size={16} />}
                </span>
                <span className="min-w-0">
                  <span className="block text-small font-medium text-text-primary">{f.label}</span>
                  <span className="block text-[11px] text-text-muted leading-snug">{f.desc}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default memo(ExportMenu);
