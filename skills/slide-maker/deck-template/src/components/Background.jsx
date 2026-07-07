// MTI atmospheric background — green-blob depth in the LIGHT idiom (wow-guide §3),
// NOT dark glow orbs. Sits inside the slide canvas, behind content. Decorative, so
// it carries no data-viz-id (not a feedback target).
export default function Background() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      <div className="absolute rounded-full bg-primary-50"
           style={{ width: 560, height: 560, right: -120, bottom: -140 }} />
      <div className="absolute rounded-full bg-primary-100"
           style={{ width: 320, height: 320, left: -100, top: -120, opacity: 0.4 }} />
    </div>
  );
}
