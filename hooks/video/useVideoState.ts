import { useEffect, useRef, useState } from 'react';

export interface VideoState {
  playing: boolean;
  currentTime: number;
  duration: number;
}

const INITIAL: VideoState = {
  playing: false,
  currentTime: 0,
  duration: 0,
};

const EVENTS = [
  'play',
  'pause',
  'loadedmetadata',
  'durationchange',
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
    });

    const commit = (next: VideoState) => {
      const prev = stateRef.current;
      if (
        prev.playing === next.playing &&
        prev.currentTime === next.currentTime &&
        prev.duration === next.duration
      ) {
        return;
      }
      stateRef.current = next;
      setState(next);
    };

    const sync = () => commit(read());

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
