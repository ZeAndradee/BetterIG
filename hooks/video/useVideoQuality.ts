import { useCallback, useEffect, useRef, useState } from "react";
import {
  AUTO_QUALITY,
  EMPTY_QUALITY_STATE,
  QUALITY_QUERY,
  QUALITY_SET,
  QUALITY_STATE,
} from "@/utils/quality";
import type { QualityState } from "@/utils/quality";

const QUALITY_KEY = "iw_quality";

export function loadQualityPref(): string {
  try {
    return localStorage.getItem(QUALITY_KEY) || AUTO_QUALITY;
  } catch {
    return AUTO_QUALITY;
  }
}

function saveQualityPref(v: string) {
  try {
    localStorage.setItem(QUALITY_KEY, v);
  } catch {}
}

function send(video: HTMLVideoElement, type: string, detail?: unknown) {
  video.dispatchEvent(
    new CustomEvent(type, {
      detail: detail === undefined ? undefined : JSON.stringify(detail),
    }),
  );
}

export interface VideoQuality {
  state: QualityState;
  pref: string;
  setQuality: (label: string) => void;
}

export function useVideoQuality(
  video: HTMLVideoElement | null,
  enabled: boolean,
): VideoQuality {
  const [state, setState] = useState<QualityState>(EMPTY_QUALITY_STATE);
  const [pref, setPref] = useState<string>(loadQualityPref);
  const prefRef = useRef(pref);
  prefRef.current = pref;
  const appliedSrc = useRef<string>("");

  useEffect(() => {
    if (!video || !enabled) {
      setState(EMPTY_QUALITY_STATE);
      return;
    }
    appliedSrc.current = "";

    const onState = (e: Event) => {
      let next: QualityState | null = null;
      try {
        next = JSON.parse(String((e as CustomEvent).detail));
      } catch {}
      if (!next) return;
      setState(next);
      const p = prefRef.current;
      if (
        p !== AUTO_QUALITY &&
        next.options.length > 0 &&
        next.status === "idle" &&
        appliedSrc.current !== video.src
      ) {
        appliedSrc.current = video.src;
        send(video, QUALITY_SET, { label: p, auto: true });
      }
    };
    const query = () => send(video, QUALITY_QUERY);

    video.addEventListener(QUALITY_STATE, onState);
    video.addEventListener("loadstart", query);
    video.addEventListener("emptied", query);
    query();
    const retry = window.setInterval(() => {
      if (video.isConnected) query();
    }, 1500);

    return () => {
      video.removeEventListener(QUALITY_STATE, onState);
      video.removeEventListener("loadstart", query);
      video.removeEventListener("emptied", query);
      window.clearInterval(retry);
    };
  }, [video, enabled]);

  const setQuality = useCallback(
    (label: string) => {
      setPref(label);
      saveQualityPref(label);
      if (!video) return;
      appliedSrc.current = video.src;
      send(video, QUALITY_SET, { label });
    },
    [video],
  );

  return { state, pref, setQuality };
}
