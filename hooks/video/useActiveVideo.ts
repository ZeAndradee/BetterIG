import { useEffect, useState } from 'react';

function visibleArea(el: HTMLElement): number {
  const r = el.getBoundingClientRect();
  let top = r.top;
  let left = r.left;
  let bottom = r.bottom;
  let right = r.right;

  top = Math.max(top, 0);
  left = Math.max(left, 0);
  bottom = Math.min(bottom, window.innerHeight);
  right = Math.min(right, window.innerWidth);

  let n: HTMLElement | null = el.parentElement;
  while (n && n !== document.body) {
    const cs = getComputedStyle(n);
    const clips =
      cs.overflowX !== "visible" || cs.overflowY !== "visible";
    if (clips) {
      const cr = n.getBoundingClientRect();
      top = Math.max(top, cr.top);
      left = Math.max(left, cr.left);
      bottom = Math.min(bottom, cr.bottom);
      right = Math.min(right, cr.right);
    }
    n = n.parentElement;
  }

  return Math.max(0, bottom - top) * Math.max(0, right - left);
}

function isRendered(el: HTMLElement): boolean {
  const anyEl = el as HTMLElement & {
    checkVisibility?: (opts?: {
      checkOpacity?: boolean;
      checkVisibilityCSS?: boolean;
    }) => boolean;
  };
  if (typeof anyEl.checkVisibility === 'function') {
    return anyEl.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
  }
  const cs = getComputedStyle(el);
  return cs.visibility !== 'hidden' && cs.display !== 'none' && parseFloat(cs.opacity) > 0;
}

const MIN_AREA = 40000;

export function useActiveVideo(): HTMLVideoElement | null {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);

  useEffect(() => {
    let current: HTMLVideoElement | null = null;

    const pick = () => {
      const allVids = Array.from(document.querySelectorAll('video'));
      if (allVids.length === 0) {
        current = null;
        setVideo(null);
        return;
      }

      const dialogs = Array.from(
        document.querySelectorAll<HTMLElement>('[role="dialog"]'),
      ).filter(isRendered);
      const dialog = dialogs.length ? dialogs[dialogs.length - 1] : null;
      const vids = dialog
        ? allVids.filter((v) => dialog.contains(v))
        : allVids;
      if (vids.length === 0) {
        current = null;
        setVideo(null);
        return;
      }

      const playing = vids.find(
        (v) =>
          isRendered(v) &&
          !v.paused &&
          !v.ended &&
          v.readyState > 2 &&
          visibleArea(v) >= MIN_AREA,
      );
      if (playing) {
        if (playing !== current) {
          current = playing;
          setVideo(playing);
        }
        return;
      }

      if (
        current &&
        current.isConnected &&
        isRendered(current) &&
        visibleArea(current) >= MIN_AREA &&
        (!dialog || dialog.contains(current))
      ) {
        return;
      }

      let best: HTMLVideoElement | null = null;
      let bestScore = 0;
      for (const v of vids) {
        if (!isRendered(v)) continue;
        const area = visibleArea(v);
        if (area < MIN_AREA) continue;
        if (area > bestScore) {
          bestScore = area;
          best = v;
        }
      }
      if (best !== current) {
        current = best;
        setVideo(best);
      }
    };

    pick();

    const observer = new MutationObserver(pick);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener('play', pick, true);
    document.addEventListener('pause', pick, true);
    window.addEventListener('scroll', pick, true);
    const interval = window.setInterval(pick, 800);

    return () => {
      observer.disconnect();
      document.removeEventListener('play', pick, true);
      document.removeEventListener('pause', pick, true);
      window.removeEventListener('scroll', pick, true);
      window.clearInterval(interval);
    };
  }, []);

  return video;
}
