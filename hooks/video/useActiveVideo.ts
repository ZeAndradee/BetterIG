// Finds the video the user is currently watching on the page.
import { useEffect, useState } from 'react';

// Visible area of `el` after clipping against the window AND every
// overflow-clipping ancestor. Instagram carousels keep the off-screen slides
// rendered (translated sideways, not display:none) inside an overflow:hidden
// track, so their rect can still overlap the window viewport. Clipping against
// the track collapses those hidden slides to ~0 area.
function visibleArea(el: HTMLElement): number {
  const r = el.getBoundingClientRect();
  let top = r.top;
  let left = r.left;
  let bottom = r.bottom;
  let right = r.right;

  // Clip against window viewport.
  top = Math.max(top, 0);
  left = Math.max(left, 0);
  bottom = Math.min(bottom, window.innerHeight);
  right = Math.min(right, window.innerWidth);

  // Clip against clipping ancestors (overflow hidden/clip/auto/scroll).
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

// Reject hidden carousel siblings (display:none, visibility:hidden, 0-opacity
// ancestor, etc). `checkVisibility` covers all of these.
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

// Minimum visible area (px²) to even consider a video. Filters out the
// adjacent carousel slide peeking by a few pixels.
const MIN_AREA = 40000; // ~200x200

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

      // Post overlay opens as a [role="dialog"] over the feed. Constrain
      // candidates to the topmost dialog so the bar tracks the modal video,
      // not the feed video still rendered behind it.
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

      // Sticky: keep current if still rendered, meaningfully visible, and
      // (when a dialog is open) inside that dialog. Otherwise re-pick.
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
        const playing = !v.paused && !v.ended && v.readyState > 2;
        const score = area * (playing ? 4 : 1);
        if (score > bestScore) {
          bestScore = score;
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
