// Finds the video the user is currently watching on the page.
import { useEffect, useState } from 'react';

function visibleArea(el: HTMLElement): number {
  const r = el.getBoundingClientRect();
  const visH = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
  const visW = Math.min(r.right, window.innerWidth) - Math.max(r.left, 0);
  return Math.max(0, visH) * Math.max(0, visW);
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
      const vids = Array.from(document.querySelectorAll('video'));
      if (vids.length === 0) {
        current = null;
        setVideo(null);
        return;
      }

      // Sticky: if current is still rendered and meaningfully visible, keep
      // it regardless of play state. Pausing should not steal focus to a
      // sibling carousel slide.
      if (
        current &&
        current.isConnected &&
        isRendered(current) &&
        visibleArea(current) >= MIN_AREA
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
