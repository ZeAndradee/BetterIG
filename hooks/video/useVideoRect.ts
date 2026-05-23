// Tracks the video element's size and position on screen.
import { useEffect, useState } from 'react';

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
      if (r.width > 0 && r.height > 0) {
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
