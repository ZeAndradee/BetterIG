import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, CSSProperties } from "react";
import { Volume2, VolumeX, Settings, Play, Pause, Minimize } from "lucide-react";
import { useActiveVideo } from "@/hooks/video/useActiveVideo";
import { useVideoState } from "@/hooks/video/useVideoState";
import { useVideoRect } from "@/hooks/video/useVideoRect";
import { usePointerInRect } from "@/hooks/video/usePointerInRect";
import { useVolumeSync, saveVolume } from "@/hooks/video/useVolumeSync";
import { useHideNativeVolume } from "@/hooks/video/useHideNativeVolume";
import { useStorySegments } from "@/hooks/video/useStorySegments";
import { ConfigMenu, SPEEDS } from "./ConfigMenu/ConfigMenu";
import styles from "./VideoControls.module.css";

const HIDE_DELAY = 600;
const FS_IDLE_HIDE = 2500;
const SEEK_DEBOUNCE = 140;
const AUTOSCROLL_KEY = "iw_autoscroll";
const SPEED_KEY = "iw_speed";

const FS_STYLE_ID = "igw-fullscreen-style";
function ensureFullscreenStyle() {
  if (typeof document === "undefined") return;
  if (document.getElementById(FS_STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = FS_STYLE_ID;
  s.textContent = `
    :fullscreen { background: #000 !important; }
  `;
  document.head.appendChild(s);
}

function findScroller(el: HTMLElement | null): HTMLElement | null {
  let n: HTMLElement | null = el;
  while (n && n !== document.body) {
    const s = getComputedStyle(n);
    const oy = s.overflowY;
    if ((oy === "auto" || oy === "scroll") && n.scrollHeight > n.clientHeight) {
      return n;
    }
    n = n.parentElement;
  }
  return null;
}

let fontLoaded = false;
function loadInterFont() {
  if (fontLoaded || typeof document === "undefined") return;
  fontLoaded = true;
  try {
    const url = browser.runtime.getURL("/fonts/InterVariable.woff2");
    const face = new FontFace(
      "Inter Variable",
      `url(${url}) format("woff2-variations")`,
      { weight: "100 900", style: "normal", display: "swap" },
    );
    face.load().then((f) => document.fonts.add(f)).catch(() => {});
  } catch {}
}

function loadAutoscroll(): boolean {
  try {
    return localStorage.getItem(AUTOSCROLL_KEY) === "1";
  } catch {
    return false;
  }
}
function saveAutoscroll(v: boolean) {
  try {
    localStorage.setItem(AUTOSCROLL_KEY, v ? "1" : "0");
  } catch {}
}
function loadSpeed(): number {
  try {
    const n = Number(localStorage.getItem(SPEED_KEY));
    return SPEEDS.includes(n as (typeof SPEEDS)[number]) ? n : 1;
  } catch {
    return 1;
  }
}
function saveSpeed(v: number) {
  try {
    localStorage.setItem(SPEED_KEY, String(v));
  } catch {}
}

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
  const [hoverVolume, setHoverVolume] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [visible, setVisible] = useState(false);
  const [scrubValue, setScrubValue] = useState<number | null>(null);
  const [autoscroll, setAutoscroll] = useState<boolean>(loadAutoscroll);
  const [speed, setSpeed] = useState<number>(loadSpeed);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(
    () => typeof document !== "undefined" && !!document.fullscreenElement,
  );
  const [mouseActive, setMouseActive] = useState(true);
  const seekTimer = useRef<number | undefined>(undefined);
  const pendingSeek = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const configGroupRef = useRef<HTMLDivElement | null>(null);

  useVolumeSync();
  useHideNativeVolume();
  const storySegments = useStorySegments();

  // On active-video change (e.g. swiping a carousel), collapse the overlay back
  // to its resting state. The pause button + gradient shouldn't carry over to
  // the next video — they re-show only when the user hovers it again.
  useEffect(() => {
    setVisible(false);
    setHoverBar(false);
    setHoverVolume(false);
    setConfigOpen(false);
    setDragging(false);
  }, [video]);

  useEffect(loadInterFont, []);
  useEffect(ensureFullscreenStyle, []);

  useEffect(() => {
    if (!video) return;
    if (!window.location.pathname.startsWith("/reels")) return;
    video.playbackRate = speed;
  }, [video, speed]);

  useEffect(() => {
    if (!autoscroll) return;
    const onEnded = (e: Event) => {
      if (!window.location.pathname.startsWith("/reels")) return;
      const t = e.target as HTMLVideoElement | null;
      if (!t || t.tagName !== "VIDEO") return;
      const scroller = findScroller(t);
      const target: HTMLElement | Window = scroller ?? window;
      const height = target === window
        ? window.innerHeight
        : (target as HTMLElement).clientHeight;
      target.scrollBy({ top: height, left: 0, behavior: "smooth" });
    };
    document.addEventListener("ended", onEnded, true);
    return () => document.removeEventListener("ended", onEnded, true);
  }, [autoscroll]);

  // Close config dropdown on outside click (composedPath handles shadow DOM).
  useEffect(() => {
    if (!configOpen) return;
    const onDown = (e: MouseEvent) => {
      const node = configGroupRef.current;
      if (node && e.composedPath().includes(node)) return;
      setConfigOpen(false);
    };
    document.addEventListener("mousedown", onDown, true);
    return () => document.removeEventListener("mousedown", onDown, true);
  }, [configOpen]);

  // Track fullscreen + relocate shadow host inside the fullscreen element so
  // our overlay actually renders on top of the fullscreened video.
  useEffect(() => {
    const onFsChange = () => {
      const fsEl = document.fullscreenElement as HTMLElement | null;
      setIsFullscreen(!!fsEl);

      const node = rootRef.current;
      if (!node) return;
      const root = node.getRootNode();
      const host = root instanceof ShadowRoot ? (root.host as HTMLElement) : null;
      if (!host) return;

      if (fsEl && !fsEl.contains(host)) {
        fsEl.appendChild(host);
      } else if (!fsEl && host.parentElement !== document.body) {
        document.body.appendChild(host);
      }
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Suppress any native video controls while fullscreen (some IG paths flip
  // `controls` on; force off so only our UI shows).
  useEffect(() => {
    if (!video || !isFullscreen) return;
    const prev = video.controls;
    video.controls = false;
    return () => {
      video.controls = prev;
    };
  }, [video, isFullscreen]);

  // YouTube-style idle-hide: show on mousemove, hide after timeout.
  useEffect(() => {
    if (!isFullscreen) {
      setMouseActive(true);
      return;
    }
    let t: number | undefined;
    const bump = () => {
      setMouseActive(true);
      window.clearTimeout(t);
      t = window.setTimeout(() => setMouseActive(false), FS_IDLE_HIDE);
    };
    bump();
    window.addEventListener("mousemove", bump);
    window.addEventListener("keydown", bump);
    return () => {
      window.removeEventListener("mousemove", bump);
      window.removeEventListener("keydown", bump);
      window.clearTimeout(t);
    };
  }, [isFullscreen]);

  const wantShow = isFullscreen
    ? mouseActive || hoverBar || hoverVolume || configOpen || dragging
    : hoverVideo || hoverBar || hoverVolume || configOpen || dragging;
  useEffect(() => {
    if (wantShow) {
      setVisible(true);
      return;
    }
    const delay = isFullscreen ? 0 : HIDE_DELAY;
    const t = window.setTimeout(() => setVisible(false), delay);
    return () => window.clearTimeout(t);
  }, [wantShow, isFullscreen]);

  useEffect(() => () => window.clearTimeout(seekTimer.current), []);

  useEffect(() => {
    if (scrubValue == null || dragging || state.duration <= 0) return;
    const target = (scrubValue / 100) * state.duration;
    if (Math.abs(state.currentTime - target) < 0.5) setScrubValue(null);
  }, [scrubValue, dragging, state.currentTime, state.duration]);

  const isReels = window.location.pathname.startsWith("/reels");
  const isStory = window.location.pathname.startsWith("/stories");

  // A story is "usable" (seekable) once it has a video with layout + metadata.
  const storyUsableVideo =
    isStory && !!video && !!rect && rect.width > 0 && state.duration > 0;

  // Stories without a seekable video (image stories, or a video story while its
  // metadata loads): show the segment bar anyway, anchored to IG's native row,
  // active slot mirroring IG's own fill. Keeps the bar in a fixed spot and
  // stops the header from jumping when the native bar is hidden.
  if (isStory && storySegments && storySegments.count > 0 && !storyUsableVideo) {
    const seg = storySegments;
    return (
      <div ref={rootRef}>
        <div
          className={styles.storyTop}
          style={{ left: seg.left, top: seg.top, width: seg.width }}
        >
          <div className={styles.storySegments}>
            {Array.from({ length: seg.count }).map((_, i) => {
              const width =
                i < seg.activeIndex
                  ? "100%"
                  : i === seg.activeIndex
                    ? `${seg.activeProgress}%`
                    : "0%";
              return (
                <div key={i} className={styles.storySeg}>
                  <div className={styles.storySegFill} style={{ width }} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Wait for video to have layout AND metadata. Otherwise rect can be near
  // (0,0) and duration 0 while the video is still fetching → controls flash
  // at viewport origin with broken scrubber.
  if (!video || !rect || rect.width <= 0 || state.duration <= 0) {
    return <div ref={rootRef} style={{ display: "none" }} />;
  }

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

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
      return;
    }
    // On reels, fullscreen the scroll container so autoscroll can swap the
    // visible reel inside the same fullscreen surface. Elsewhere, fullscreen
    // the video's parent (so our overlay sits on top of the video).
    const fallback = (video.parentElement as HTMLElement | null) ?? video;
    const target = isReels ? (findScroller(video) ?? fallback) : fallback;
    target.requestFullscreen?.();
  };

  const cycleSpeed = () => {
    const idx = SPEEDS.indexOf(speed as (typeof SPEEDS)[number]);
    const next = SPEEDS[(idx + 1) % SPEEDS.length];
    setSpeed(next);
    saveSpeed(next);
    video.playbackRate = next;
  };

  const toggleAutoscroll = () => {
    const next = !autoscroll;
    setAutoscroll(next);
    saveAutoscroll(next);
  };

  const renderControls = (expandUp: boolean) => (
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
      </div>

      {isReels && (
        <div className={styles.configGroup} ref={configGroupRef}>
          <button
            className={styles.btn}
            onClick={() => setConfigOpen((open) => !open)}
            aria-label="Settings"
          >
            <Settings size={22} />
          </button>
          {configOpen && (
            <ConfigMenu
              expandUp={expandUp}
              autoscroll={autoscroll}
              speed={speed}
              showFullscreen={isReels}
              onToggleAutoscroll={toggleAutoscroll}
              onCycleSpeed={cycleSpeed}
              onFullscreen={toggleFullscreen}
            />
          )}
        </div>
      )}
    </div>
  );

  const timestamp = (dragging || hoverBar) && (
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

  // Stories: mirror IG's native segment bar (one slot per story item). The
  // active slot is our seekable scrubber; earlier slots are full, later empty.
  const storyBar =
    storySegments && storySegments.count > 0 ? (
      <div className={styles.storySegments}>
        {Array.from({ length: storySegments.count }).map((_, i) => {
          if (i === storySegments.activeIndex) {
            return (
              <div key={i} className={styles.storySegActive}>
                {scrubber}
              </div>
            );
          }
          const full = i < storySegments.activeIndex;
          return (
            <div key={i} className={styles.storySeg}>
              <div
                className={styles.storySegFill}
                style={{ width: full ? "100%" : "0%" }}
              />
            </div>
          );
        })}
      </div>
    ) : (
      scrubber
    );

  const volumePosition: CSSProperties = {
    left: `${rect.right}px`,
    top: `${rect.bottom}px`,
    ["--progress" as never]: `${volumeLevel * 100}%`,
  };

  const volumeControl = (
    <div
      className={`${styles.volumeFloat} ${visible ? "" : styles.hidden}`}
      style={volumePosition}
      onMouseEnter={() => setHoverVolume(true)}
      onMouseLeave={() => setHoverVolume(false)}
    >
      <div className={styles.volumePill}>
        <div className={styles.volumeSliderWrap}>
          <input
            className={styles.volumeSlider}
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volumeLevel}
            onChange={changeVolume}
          />
        </div>
        <button
          className={`${styles.btn} ${styles.volumeBtn}`}
          onClick={toggleMute}
          aria-label="Mute/Unmute"
        >
          {volumeLevel === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>
      </div>
    </div>
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
  };

  // Anchor the story bar to IG's native row so it sits in the exact same place
  // for both image and video stories (the video rect can differ from the row).
  const storyPosition: CSSProperties = storySegments
    ? {
        left: `${storySegments.left}px`,
        top: `${storySegments.top}px`,
        width: `${storySegments.width}px`,
      }
    : topPosition;

  if (isFullscreen) {
    const fsControls = (
      <div
        className={`${styles.fsControlsRow} ${visible ? "" : styles.hidden}`}
        onMouseEnter={() => setHoverBar(true)}
        onMouseLeave={() => setHoverBar(false)}
      >
        <div className={styles.fsLeft}>
          <button
            className={styles.btn}
            onClick={togglePlay}
            aria-label="Play/Pause"
          >
            {state.playing ? <Pause size={24} /> : <Play size={24} />}
          </button>

          <div
            className={styles.fsVolumeGroup}
            onMouseEnter={() => setHoverVolume(true)}
            onMouseLeave={() => setHoverVolume(false)}
          >
            <button
              className={styles.btn}
              onClick={toggleMute}
              aria-label="Mute/Unmute"
            >
              {volumeLevel === 0 ? <VolumeX size={22} /> : <Volume2 size={22} />}
            </button>
            <input
              className={styles.fsVolumeSlider}
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volumeLevel}
              onChange={changeVolume}
              style={{ ["--progress" as never]: `${volumeLevel * 100}%` }}
              aria-label="Volume"
            />
          </div>

          <div className={styles.fsTime}>
            {formatTime(displayTime)} / {formatTime(state.duration)}
          </div>
        </div>

        <div className={styles.fsRight}>
          <div className={styles.configGroup} ref={configGroupRef}>
            <button
              className={styles.btn}
              onClick={() => setConfigOpen((open) => !open)}
              aria-label="Settings"
            >
              <Settings size={22} />
            </button>
            {configOpen && (
              <ConfigMenu
                expandUp={true}
                autoscroll={autoscroll}
                speed={speed}
                showFullscreen={false}
                onToggleAutoscroll={toggleAutoscroll}
                onCycleSpeed={cycleSpeed}
                onFullscreen={toggleFullscreen}
              />
            )}
          </div>
          <button
            className={styles.btn}
            onClick={toggleFullscreen}
            aria-label="Exit fullscreen"
          >
            <Minimize size={22} />
          </button>
        </div>
      </div>
    );

    return (
      <div
        ref={rootRef}
        className={`${styles.fsBottomBar} ${visible ? styles.gradient : ""} ${
          visible ? "" : styles.fsCursorHidden
        }`}
      >
        {fsControls}
        {scrubber}
      </div>
    );
  }

  if (isStory) {
    // Our scrubber replaces IG's native (desynced) segment bar, so it sits at
    // the top of the story where that bar lived. Volume reuses the float pill.
    return (
      <div ref={rootRef}>
        <div
          className={styles.storyTop}
          style={storyPosition}
          onMouseEnter={() => setHoverBar(true)}
          onMouseLeave={() => setHoverBar(false)}
        >
          {timestamp}
          {storyBar}
        </div>
        {volumeControl}
      </div>
    );
  }

  if (isReels) {
    return (
      <div ref={rootRef}>
        <div
          className={`${styles.topBar} ${visible ? "" : styles.hidden}`}
          style={topPosition}
        >
          {renderControls(false)}
        </div>
        <div
          className={styles.reelsBottom}
          style={bottomPosition}
          onMouseEnter={() => setHoverBar(true)}
          onMouseLeave={() => setHoverBar(false)}
        >
          {timestamp}
          {scrubber}
        </div>
        {volumeControl}
      </div>
    );
  }

  return (
    <div ref={rootRef}>
      <div
        className={`${styles.bottomBar} ${visible ? styles.gradient : ""}`}
        style={bottomPosition}
        onMouseEnter={() => setHoverBar(true)}
        onMouseLeave={() => setHoverBar(false)}
      >
        {timestamp}
        {renderControls(true)}
        {scrubber}
      </div>
      {volumeControl}
    </div>
  );
}
