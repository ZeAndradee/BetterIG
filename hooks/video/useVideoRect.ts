// Tracks the video element's size and position on screen.
import { useEffect, useState } from 'react';

export function useVideoRect(video: HTMLVideoElement | null): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!video) {
      setRect(null);
      return;
    }

    let raf = 0;
    let prev = '';

    const tick = () => {
      const r = video.getBoundingClientRect();
      const key = `${r.left},${r.top},${r.width},${r.height}`;
      if (key !== prev) {
        prev = key;
        setRect(r);
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [video]);

  return rect;
}
