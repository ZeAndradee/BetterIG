// Keeps every video at the user's saved volume/mute setting.
import { useEffect } from 'react';

const VOLUME_KEY = 'igw:volume';
const MUTED_KEY = 'igw:muted';

export function loadVolume(): number {
  const v = parseFloat(localStorage.getItem(VOLUME_KEY) ?? '');
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
}

export function loadMuted(): boolean {
  return localStorage.getItem(MUTED_KEY) === 'true';
}

export function saveVolume(volume: number, muted: boolean): void {
  localStorage.setItem(VOLUME_KEY, String(volume));
  localStorage.setItem(MUTED_KEY, String(muted));
}

export function useVolumeSync(): void {
  useEffect(() => {
    const apply = (video: HTMLVideoElement) => {
      const vol = loadVolume();
      const mut = loadMuted();
      if (video.volume !== vol) video.volume = vol;
      if (video.muted !== mut) video.muted = mut;
    };

    const applyAll = () => {
      document.querySelectorAll('video').forEach(apply);
    };

    const onPlay = (e: Event) => {
      const v = e.target;
      if (!(v instanceof HTMLVideoElement)) return;
      apply(v);
      setTimeout(() => apply(v), 50);
      setTimeout(() => apply(v), 200);
    };

    const onMeta = (e: Event) => {
      if (e.target instanceof HTMLVideoElement) apply(e.target);
    };

    applyAll();
    document.addEventListener('play', onPlay, true);
    document.addEventListener('loadedmetadata', onMeta, true);

    const observer = new MutationObserver(applyAll);
    observer.observe(document.documentElement, { childList: true, subtree: true });

    return () => {
      document.removeEventListener('play', onPlay, true);
      document.removeEventListener('loadedmetadata', onMeta, true);
      observer.disconnect();
    };
  }, []);
}
