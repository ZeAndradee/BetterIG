// Tracks the video element's size and position on screen.
import { useEffect, useState } from 'react';

// The video must be (essentially) fully visible inside its clipping ancestors
// before we render controls. While a carousel slide animates from one frame to
// the next it gets clipped sideways by the overflow:hidden track; anything
// below ~1 means it's still mid-slide, so the bar only renders once the slide
// has fully settled — no residual slide-along, no reopening flicker. The small
// epsilon absorbs sub-pixel rounding from getBoundingClientRect at rest.
const MIN_VISIBLE_RATIO = 0.999;

// Horizontal visible fraction of `el` after clipping against every
// overflow-clipping ancestor. Returns 1 when fully in place, drops toward 0 as
// the element slides out of its clipping track.
function horizontalVisibleRatio(el: HTMLElement, r: DOMRect): number {
  if (r.width <= 0) return 0;
  let left = r.left;
  let right = r.right;
  let n: HTMLElement | null = el.parentElement;
  while (n && n !== document.body) {
    const cs = getComputedStyle(n);
    if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
      const cr = n.getBoundingClientRect();
      left = Math.max(left, cr.left);
      right = Math.min(right, cr.right);
    }
    n = n.parentElement;
  }
  return Math.max(0, right - left) / r.width;
}

export function useVideoRect(video: HTMLVideoElement | null): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    // Reset immediately on video swap so stale rect from previous video
    // doesn't briefly render controls at the wrong position.
    setRect(null);

    if (!video) return;

    let raf = 0;
    let prev = '';

    const tick = () => {
      const r = video.getBoundingClientRect();
      // Skip zero-size rects: video hasn't laid out yet (fetching/metadata
      // not ready). Otherwise controls would anchor at (0,0).
      // Also skip while the slide is mid-transition (clipped sideways by the
      // carousel track), so the overlay doesn't ride along with the animation.
      if (
        r.width > 0 &&
        r.height > 0 &&
        horizontalVisibleRatio(video, r) >= MIN_VISIBLE_RATIO
      ) {
        const key = `${r.left},${r.top},${r.width},${r.height}`;
        if (key !== prev) {
          prev = key;
          setRect(r);
        }
      } else if (prev !== '') {
        prev = '';
        setRect(null);
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [video]);

  return rect;
}
