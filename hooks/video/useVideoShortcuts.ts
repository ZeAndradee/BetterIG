import { useEffect, useRef } from "react";
import { bumpStat } from "@/utils/store";

const HOLD_MS = 200;
const HOLD_SPEED = 2;
const SEEK_STEP = 5;

export type SeekDir = "forward" | "rewind";

interface Options {
  video: HTMLVideoElement | null;
  enabled: boolean;
  isReels: boolean;
  isStory: boolean;
  speed: number;
  onHoldStart?: () => void;
  onHoldEnd?: () => void;
  onSeek?: (dir: SeekDir) => void;
}

function isTyping(): boolean {
  const a = document.activeElement as HTMLElement | null;
  if (!a) return false;
  const tag = a.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || a.isContentEditable;
}

function clickLike(): boolean {
  const LIKE_LABELS = ["like", "curtir"];
  const svgs = Array.from(document.querySelectorAll<SVGElement>("svg[aria-label]"));
  for (const svg of svgs) {
    const label = (svg.getAttribute("aria-label") || "").toLowerCase();
    if (!LIKE_LABELS.includes(label)) continue;
    const r = svg.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const btn = svg.closest('[role="button"], button') as HTMLElement | null;
    (btn ?? (svg.parentElement as HTMLElement | null))?.click();
    return true;
  }
  return false;
}

export function useVideoShortcuts({
  video,
  enabled,
  isReels,
  isStory,
  speed,
  onHoldStart,
  onHoldEnd,
  onSeek,
}: Options) {
  const cbRef = useRef({ onHoldStart, onHoldEnd, onSeek });
  cbRef.current = { onHoldStart, onHoldEnd, onSeek };

  useEffect(() => {
    if (!video || !enabled) return;

    let spaceDown = false;
    let holding = false;
    let holdTimer: number | undefined;

    const bumpInteraction = () =>
      bumpStat(isStory ? "storyActions" : "videoActions");

    const restoreSpeed = () => {
      video.playbackRate = isReels ? speed : 1;
    };

    const toggleMute = () => {
      video.muted = !video.muted;
      bumpInteraction();
    };

    const seekBy = (delta: number) => {
      const d = video.duration;
      const max = Number.isFinite(d) && d > 0 ? d : Infinity;
      video.currentTime = Math.max(0, Math.min(max, video.currentTime + delta));
      cbRef.current.onSeek?.(delta > 0 ? "forward" : "rewind");
      bumpInteraction();
    };

    const toggleFullscreen = () => {
      if (document.fullscreenElement) {
        document.exitFullscreen();
        return;
      }
      const fallback = (video.parentElement as HTMLElement | null) ?? video;
      const target = isReels ? document.documentElement : fallback;
      target.requestFullscreen?.();
      bumpInteraction();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping() || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.code === "Space") {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (spaceDown) return;
        spaceDown = true;
        holdTimer = window.setTimeout(() => {
          holding = true;
          video.playbackRate = HOLD_SPEED;
          cbRef.current.onHoldStart?.();
        }, HOLD_MS);
        return;
      }

      switch (e.key.toLowerCase()) {
        case "l":
          if (isStory) {
            e.preventDefault();
            if (clickLike()) bumpInteraction();
          }
          return;
        case "m":
          e.preventDefault();
          toggleMute();
          return;
        case "f":
          e.preventDefault();
          toggleFullscreen();
          return;
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        seekBy(SEEK_STEP);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        seekBy(-SEEK_STEP);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space" || isTyping()) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!spaceDown) return;
      spaceDown = false;
      window.clearTimeout(holdTimer);
      if (holding) {
        holding = false;
        restoreSpeed();
        cbRef.current.onHoldEnd?.();
      } else {
        if (video.paused || video.ended) video.play();
        else video.pause();
        bumpInteraction();
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.clearTimeout(holdTimer);
      if (holding) {
        restoreSpeed();
        cbRef.current.onHoldEnd?.();
      }
    };
  }, [video, enabled, isReels, isStory, speed]);
}
