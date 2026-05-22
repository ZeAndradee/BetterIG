// Finds the video the user is currently watching on the page.
import { useEffect, useState } from 'react';

function visibleArea(el: HTMLElement): number {
  const r = el.getBoundingClientRect();
  const visH = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
  const visW = Math.min(r.right, window.innerWidth) - Math.max(r.left, 0);
  return Math.max(0, visH) * Math.max(0, visW);
}

export function useActiveVideo(): HTMLVideoElement | null {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);

  useEffect(() => {
    const pick = () => {
      const vids = Array.from(document.querySelectorAll('video'));
      if (vids.length === 0) {
        setVideo(null);
        return;
      }

      let best: HTMLVideoElement | null = null;
      let bestScore = 0;
      for (const v of vids) {
        const area = visibleArea(v);
        if (area <= 0) continue;
        const playing = !v.paused && !v.ended && v.readyState > 2;
        const score = area * (playing ? 4 : 1);
        if (score > bestScore) {
          bestScore = score;
          best = v;
        }
      }
      setVideo((prev) => (prev === best ? prev : best));
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
