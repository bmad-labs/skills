import { memo } from 'react';

/*
  Speaker-notes panel (Normal mode). Shows the current slide's notes — read-only,
  sourced from the SLIDES registry in App.jsx (each entry may carry a `notes`
  string). It's a presenter aid, not slide content, so notes live in the registry,
  not inside the slide component. Tagged data-navigation so it never exports.
*/
function NotesPanel({ notes, label }) {
  return (
    <section
      data-navigation
      style={{ left: 'var(--deck-rail-w)', height: 'var(--deck-notes-h)' }}
      className="fixed bottom-0 right-0 z-30 flex flex-col
                 bg-bg-card border-t border-border-subtle"
    >
      <header className="flex items-center gap-2 px-5 h-9 shrink-0 border-b border-border-subtle">
        <span className="text-eyebrow tracking-eyebrow uppercase font-bold text-text-muted">
          Speaker notes
        </span>
        <span className="text-[11px] text-text-muted truncate">· {label}</span>
      </header>
      <div className="flex-1 overflow-y-auto px-5 py-3">
        {notes ? (
          <p className="text-body text-text-secondary whitespace-pre-wrap leading-relaxed">{notes}</p>
        ) : (
          <p className="text-small text-text-muted italic">
            No notes for this slide. Add a <code className="font-mono">notes</code> string to its entry in
            <code className="font-mono"> SLIDES</code> (App.jsx).
          </p>
        )}
      </div>
    </section>
  );
}

export default memo(NotesPanel);
