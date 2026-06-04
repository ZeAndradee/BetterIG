// Reports the video's live playback state (play, time, volume, etc).
import { useEffect, useRef, useState } from 'react';

export interface VideoState {
  playing: boolean;
  currentTime: number;
  duration: number;
  muted: boolean;
  volume: number;
}

const INITIAL: VideoState = {
  playing: false,
  currentTime: 0,
  duration: 0,
  muted: false,
  volume: 1,
};

// `timeupdate` fires only ~4Hz; use rAF for smooth currentTime while playing.
const EVENTS = [
  'play',
  'pause',
  'loadedmetadata',
  'durationchange',
  'volumechange',
  'seeked',
  'seeking',
  'ended',
  'emptied',
];

export function useVideoState(video: HTMLVideoElement | null): VideoState {
  const [state, setState] = useState<VideoState>(INITIAL);
  const stateRef = useRef<VideoState>(INITIAL);

  useEffect(() => {
    if (!video) {
      stateRef.current = INITIAL;
      setState(INITIAL);
      return;
    }

    let raf = 0;

    const read = (): VideoState => ({
      playing: !video.paused && !video.ended,
      currentTime: video.currentTime,
      duration: Number.isFinite(video.duration) ? video.duration : 0,
      muted: video.muted,
      volume: video.volume,
    });

    const commit = (next: VideoState) => {
      const prev = stateRef.current;
      if (
        prev.playing === next.playing &&
        prev.currentTime === next.currentTime &&
        prev.duration === next.duration &&
        prev.muted === next.muted &&
        prev.volume === next.volume
      ) {
        return;
      }
      stateRef.current = next;
      setState(next);
    };

    const sync = () => commit(read());

    // rAF drives smooth time, but committing every frame re-renders the whole
    // overlay ~60Hz. Throttle the time-only path to ~10Hz; events stay instant.
    let lastCommit = 0;
    const tick = (now: number) => {
      if (now - lastCommit >= 100) {
        lastCommit = now;
        commit(read());
      }
      raf = requestAnimationFrame(tick);
    };

    sync();
    raf = requestAnimationFrame(tick);
    EVENTS.forEach((e) => video.addEventListener(e, sync));
    return () => {
      cancelAnimationFrame(raf);
      EVENTS.forEach((e) => video.removeEventListener(e, sync));
    };
  }, [video]);

  return state;
}
