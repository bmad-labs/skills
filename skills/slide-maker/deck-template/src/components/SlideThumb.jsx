import { memo } from 'react';
import Background from './Background';

/*
  A live mini render of a slide for the Normal-mode rail (Google-Slides-style).
  The slide is authored at a fixed 1280×720 canvas; here we render the REAL
  component and scale the whole canvas down to `width` px. Because it's the same
  component the stage shows, the thumbnail is always accurate and reflects edits
  instantly — no screenshot/build step.

  `inert` + pointer-events:none keep the mini slide non-interactive (it's a
  preview, not a target): clicks go to the rail button wrapping it, and edit-mode
  / present tools never see these nodes. data-thumb marks it so export + edit-mode
  ignore the rail entirely.
*/
const CANVAS_W = 1280;
const CANVAS_H = 720;

function SlideThumb({ Slide, width = 180 }) {
  const scale = width / CANVAS_W;
  return (
    <div
      data-thumb
      aria-hidden="true"
      className="relative overflow-hidden rounded-sm bg-white"
      style={{ width, height: CANVAS_H * scale }}
    >
      <div
        className="absolute top-0 left-0 origin-top-left pointer-events-none select-none"
        style={{ width: CANVAS_W, height: CANVAS_H, transform: `scale(${scale})` }}
        // inert isn't in React's prop list on older runtimes; set via attribute string
        inert=""
      >
        <Background />
        <Slide />
      </div>
    </div>
  );
}

export default memo(SlideThumb);
