// Reports the video's live playback state (play, time, volume, etc).
import { useEffect, useState } from 'react';

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

const EVENTS = [
  'play',
  'pause',
  'timeupdate',
  'loadedmetadata',
  'durationchange',
  'volumechange',
  'seeked',
  'ended',
];

export function useVideoState(video: HTMLVideoElement | null): VideoState {
  const [state, setState] = useState<VideoState>(INITIAL);

  useEffect(() => {
    if (!video) {
      setState(INITIAL);
      return;
    }

    const sync = () => {
      setState({
        playing: !video.paused && !video.ended,
        currentTime: video.currentTime,
        duration: Number.isFinite(video.duration) ? video.duration : 0,
        muted: video.muted,
        volume: video.volume,
      });
    };

    sync();
    EVENTS.forEach((e) => video.addEventListener(e, sync));
    return () => EVENTS.forEach((e) => video.removeEventListener(e, sync));
  }, [video]);

  return state;
}
