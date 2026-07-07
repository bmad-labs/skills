import { useCallback, useEffect, useRef, useState } from 'react';

/*
  Fullscreen with an in-browser fallback. enter() asks the browser for REAL OS
  fullscreen (Fullscreen API); if that's unavailable or rejected (iframes, blocked
  permission), it returns false and the caller still flips to Presentation mode —
  CSS just fills the browser tab instead, so Present always works.

  `active` tracks the live fullscreenchange so the UI stays in sync when the user
  hits Esc / F11 directly. `wasFullscreen` records whether enter() actually got OS
  fullscreen this round — so a caller can tell a real Esc-out from the fallback case
  (where we were never fullscreen and shouldn't treat a change event as an exit).
*/
export default function useFullscreen() {
  const [active, setActive] = useState(false);
  const wasFullscreen = useRef(false);

  useEffect(() => {
    const onChange = () => setActive(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const enter = useCallback(async () => {
    const el = document.documentElement;
    if (el.requestFullscreen) {
      try { await el.requestFullscreen(); wasFullscreen.current = true; return true; }
      catch { /* fall through to in-browser fill */ }
    }
    wasFullscreen.current = false;
    return false;
  }, []);

  const exit = useCallback(async () => {
    if (document.fullscreenElement && document.exitFullscreen) {
      try { await document.exitFullscreen(); } catch { /* ignore */ }
    }
    wasFullscreen.current = false;
  }, []);

  return { active, enter, exit, wasFullscreen };
}
