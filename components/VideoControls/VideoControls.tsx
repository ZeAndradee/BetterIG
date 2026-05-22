import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, CSSProperties } from "react";
import { Volume2, VolumeX, MoreHorizontal, Play, Pause } from "lucide-react";
import {
  useActiveVideo,
  useVideoState,
  useVideoRect,
  usePointerInRect,
  useVolumeSync,
  saveVolume,
} from "@/hooks/video";
import styles from "./VideoControls.module.css";

const HIDE_DELAY = 600;
const SEEK_DEBOUNCE = 140;

function formatTime(seconds: number): string {
  const total = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function VideoControls() {
  const video = useActiveVideo();
  const state = useVideoState(video);
  const rect = useVideoRect(video);
  const hoverVideo = usePointerInRect(rect);
  const [hoverBar, setHoverBar] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [visible, setVisible] = useState(false);
  const [scrubValue, setScrubValue] = useState<number | null>(null);
  const seekTimer = useRef<number>();
  const pendingSeek = useRef<number | null>(null);

  useVolumeSync();

  const wantShow = hoverVideo || hoverBar || configOpen || dragging;
  useEffect(() => {
    if (wantShow) {
      setVisible(true);
      return;
    }
    const t = window.setTimeout(() => setVisible(false), HIDE_DELAY);
    return () => window.clearTimeout(t);
  }, [wantShow]);

  useEffect(() => () => window.clearTimeout(seekTimer.current), []);

  useEffect(() => {
    if (scrubValue == null || dragging || state.duration <= 0) return;
    const target = (scrubValue / 100) * state.duration;
    if (Math.abs(state.currentTime - target) < 0.5) setScrubValue(null);
  }, [scrubValue, dragging, state.currentTime, state.duration]);

  if (!video || !rect) return null;

  const isReels = window.location.pathname.startsWith("/reels");

  const togglePlay = () => {
    if (video.paused || video.ended) video.play();
    else video.pause();
  };

  const toggleMute = () => {
    const next = !video.muted;
    saveVolume(video.volume, next);
    video.muted = next;
  };

  const flushSeek = () => {
    window.clearTimeout(seekTimer.current);
    seekTimer.current = undefined;
    const p = pendingSeek.current;
    if (p != null && state.duration > 0) {
      video.currentTime = (p / 100) * state.duration;
    }
    pendingSeek.current = null;
  };

  const seek = (e: ChangeEvent<HTMLInputElement>) => {
    const percent = Number(e.target.value);
    pendingSeek.current = percent;
    setScrubValue(percent);
    window.clearTimeout(seekTimer.current);
    seekTimer.current = window.setTimeout(flushSeek, SEEK_DEBOUNCE);
  };

  const changeVolume = (e: ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    saveVolume(value, value === 0);
    video.volume = value;
    video.muted = value === 0;
  };

  const progress =
    state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;
  const displayProgress = scrubValue ?? progress;
  const displayTime =
    scrubValue != null
      ? (scrubValue / 100) * state.duration
      : state.currentTime;
  const volumeLevel = state.muted ? 0 : state.volume;

  const controls = (
    <div
      className={`${styles.controlsRow} ${isReels ? "" : styles.bottomControls} ${
        visible ? "" : styles.hidden
      }`}
      onMouseEnter={() => setHoverBar(true)}
      onMouseLeave={() => setHoverBar(false)}
    >
      <div className={styles.group}>
        <button
          className={styles.btn}
          onClick={togglePlay}
          aria-label="Play/Pause"
        >
          {state.playing ? <Pause size={22} /> : <Play size={22} />}
        </button>
        <div className={styles.volumeGroup}>
          <button
            className={styles.btn}
            onClick={toggleMute}
            aria-label="Mute/Unmute"
          >
            {volumeLevel === 0 ? <VolumeX size={22} /> : <Volume2 size={22} />}
          </button>
          <input
            className={styles.volumeSlider}
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volumeLevel}
            onChange={changeVolume}
            style={{ "--progress": `${volumeLevel * 100}%` } as CSSProperties}
          />
        </div>
      </div>

      <div className={styles.configGroup}>
        <button
          className={styles.btn}
          onClick={() => setConfigOpen((open) => !open)}
          aria-label="Settings"
        >
          <MoreHorizontal size={22} />
        </button>
        {configOpen && <div className={styles.configPanel}>Settings</div>}
      </div>
    </div>
  );

  const timestamp = dragging && (
    <div className={styles.timeDisplay}>
      {formatTime(displayTime)} / {formatTime(state.duration)}
    </div>
  );

  const scrubber = (
    <input
      className={styles.scrubber}
      type="range"
      min={0}
      max={100}
      step={0.1}
      value={displayProgress}
      onChange={seek}
      onPointerDown={() => setDragging(true)}
      onPointerUp={() => {
        setDragging(false);
        flushSeek();
      }}
      onPointerCancel={() => {
        setDragging(false);
        flushSeek();
      }}
      style={{ "--progress": `${displayProgress}%` } as CSSProperties}
    />
  );

  const topPosition: CSSProperties = {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
  };

  const bottomPosition: CSSProperties = {
    left: `${rect.left}px`,
    top: `${rect.bottom}px`,
    width: `${rect.width}px`,
    transform: "translateY(-100%)",
  };

  if (isReels) {
    return (
      <>
        <div
          className={`${styles.topBar} ${visible ? styles.gradient : ""}`}
          style={topPosition}
        >
          {controls}
        </div>
        <div className={styles.reelsBottom} style={bottomPosition}>
          {timestamp}
          {scrubber}
        </div>
      </>
    );
  }

  return (
    <div
      className={`${styles.bottomBar} ${visible ? styles.gradient : ""}`}
      style={bottomPosition}
    >
      {timestamp}
      {controls}
      {scrubber}
    </div>
  );
}
