import { useCallback, useEffect, useRef } from "react";

const KEY = "iw_feed_paused";

function load(): boolean {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function save(paused: boolean): void {
  try {
    sessionStorage.setItem(KEY, paused ? "1" : "0");
  } catch {}
}

export function usePersistentPause(
  video: HTMLVideoElement | null,
  enabled: boolean,
): (paused: boolean) => void {
  const prefRef = useRef<boolean>(load());

  useEffect(() => {
    if (!enabled || !video || !prefRef.current) return;

    let done = false;
    const enforce = () => {
      if (done) return;
      done = true;
      video.removeEventListener("play", enforce);
      if (prefRef.current && !video.paused) video.pause();
    };

    if (!video.paused) enforce();
    else video.addEventListener("play", enforce);

    return () => video.removeEventListener("play", enforce);
  }, [video, enabled]);

  return useCallback((paused: boolean) => {
    prefRef.current = paused;
    save(paused);
  }, []);
}
