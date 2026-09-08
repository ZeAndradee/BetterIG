import { useEffect, useState } from 'react';

const MIN_VISIBLE_RATIO = 0.999;

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
    setRect(null);

    if (!video) return;

    let raf = 0;
    let prev = '';

    const tick = () => {
      const r = video.getBoundingClientRect();
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
