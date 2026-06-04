import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, CSSProperties } from "react";
import { Volume2, VolumeX, Settings, Play, Pause, FastForward, Rewind } from "lucide-react";
import { useActiveVideo } from "@/hooks/video/useActiveVideo";
import { useVideoState } from "@/hooks/video/useVideoState";
import { useVideoRect } from "@/hooks/video/useVideoRect";
import { usePointerInRect } from "@/hooks/video/usePointerInRect";
import { useVolumeSync, saveVolume } from "@/hooks/video/useVolumeSync";
import { useHideNativeVolume } from "@/hooks/video/useHideNativeVolume";
import { useStorySegments } from "@/hooks/video/useStorySegments";
import { useVideoShortcuts } from "@/hooks/video/useVideoShortcuts";
import { bumpStat } from "@/utils/store";
import { ConfigMenu, SPEEDS } from "./ConfigMenu/ConfigMenu";
import { ShortcutsModal } from "./ShortcutsModal/ShortcutsModal";
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

interface Props {
  videoEnabled: boolean;
  storiesEnabled: boolean;
}

export function VideoControls({ videoEnabled, storiesEnabled }: Props) {
  const video = useActiveVideo();
  const state = useVideoState(video);
  const rect = useVideoRect(video);
  const hoverVideo = usePointerInRect(rect);
  const [hoverBar, setHoverBar] = useState(false);
  const [hoverVolume, setHoverVolume] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [visible, setVisible] = useState(false);
  const [scrubValue, setScrubValue] = useState<number | null>(null);
  const [autoscroll, setAutoscroll] = useState<boolean>(loadAutoscroll);
  const [speed, setSpeed] = useState<number>(loadSpeed);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(
    () => typeof document !== "undefined" && !!document.fullscreenElement,
  );
  const [mouseActive, setMouseActive] = useState(true);
  const [indicator, setIndicator] = useState<"hold" | "forward" | "rewind" | null>(null);
  const indicatorTimer = useRef<number | undefined>(undefined);
  const seekTimer = useRef<number | undefined>(undefined);
  const pendingSeek = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const configGroupRef = useRef<HTMLDivElement | null>(null);

  useVolumeSync();
  useHideNativeVolume();
  const storySegments = useStorySegments(storiesEnabled);

  const pathIsReels = window.location.pathname.startsWith("/reels");
  const pathIsStory = window.location.pathname.startsWith("/stories");
  const flashIndicator = (kind: "forward" | "rewind") => {
    setIndicator(kind);
    window.clearTimeout(indicatorTimer.current);
    indicatorTimer.current = window.setTimeout(() => setIndicator(null), 700);
  };
  useVideoShortcuts({
    video,
    enabled: (pathIsReels && videoEnabled) || (pathIsStory && storiesEnabled),
    isReels: pathIsReels,
    isStory: pathIsStory,
    speed,
    onHoldStart: () => {
      window.clearTimeout(indicatorTimer.current);
      setIndicator("hold");
    },
    onHoldEnd: () => {
      window.clearTimeout(indicatorTimer.current);
      setIndicator(null);
    },
    onSeek: flashIndicator,
  });

  useEffect(() => () => window.clearTimeout(indicatorTimer.current), []);

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

  // Counter: reels watched, counted once the user sees ≥60% of the reel. Reset
  // the latch when the active video changes so the next reel can count.
  const reelCounted = useRef(false);
  useEffect(() => {
    reelCounted.current = false;
  }, [video]);
  useEffect(() => {
    if (!videoEnabled || reelCounted.current) return;
    if (!pathIsReels || state.duration <= 0) return;
    if (state.currentTime / state.duration >= 0.6) {
      reelCounted.current = true;
      bumpStat("reelsWatched");
    }
  }, [videoEnabled, pathIsReels, state.currentTime, state.duration]);

  // Counter: total time viewed in reels (real seconds while a reel plays).
  // Accrue seconds in memory and flush to storage every 15s (and on
  // pause/nav/unmount) instead of writing once per second.
  useEffect(() => {
    if (!videoEnabled || !state.playing || !pathIsReels) return;
    let pending = 0;
    const flush = () => {
      if (pending > 0) {
        bumpStat("reelsTime", pending);
        pending = 0;
      }
    };
    const id = window.setInterval(() => {
      pending += 1;
      if (pending >= 15) flush();
    }, 1000);
    window.addEventListener("pagehide", flush);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [videoEnabled, state.playing, pathIsReels]);

  // Counter: stories viewed (each time the active segment advances forward).
  const prevStoryIndex = useRef<number | null>(null);
  useEffect(() => {
    if (!storiesEnabled || !storySegments) {
      prevStoryIndex.current = null;
      return;
    }
    const idx = storySegments.activeIndex;
    const prev = prevStoryIndex.current;
    if (prev == null) {
      prevStoryIndex.current = idx;
      bumpStat("storiesViewed");
      return;
    }
    if (idx > prev) {
      bumpStat("storiesViewed", idx - prev);
      prevStoryIndex.current = idx;
    } else if (idx < prev) {
      prevStoryIndex.current = idx;
    }
  }, [storiesEnabled, storySegments?.activeIndex]);

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

  if (isStory && !storiesEnabled)
    return <div ref={rootRef} style={{ display: "none" }} />;
  if (!isStory && !videoEnabled)
    return <div ref={rootRef} style={{ display: "none" }} />;

  // A story is "usable" (seekable) once it has a video with layout + metadata.
  const storyUsableVideo =
    isStory && !!video && !!rect && rect.width > 0 && state.duration > 0;

  // A story with segments always renders the same bar subtree, whether or not
  // its video is seekable yet (image stories, or a video story still loading
  // metadata). Keeping one persistent subtree — instead of swapping between an
  // "image bar" return and a "video bar" return — is what lets the per-segment
  // nodes keep their identity across a story advance, so the stretch/unstretch
  // of the active slot animates instead of cutting.
  const storyHasBar = isStory && !!storySegments && storySegments.count > 0;

  // Wait for video to have layout AND metadata. Otherwise rect can be near
  // (0,0) and duration 0 while the video is still fetching → controls flash
  // at viewport origin with broken scrubber. Stories with a bar skip this and
  // render via the unified story return below (anchored to IG's native row).
  if (!storyHasBar && (!video || !rect || rect.width <= 0 || state.duration <= 0)) {
    return <div ref={rootRef} style={{ display: "none" }} />;
  }

  // Every user interaction with the player counts toward the active surface's
  // interaction tally: stories → storyActions, reels/feed video → videoActions.
  const bumpInteraction = () => {
    if (isStory) {
      if (storiesEnabled) bumpStat("storyActions");
    } else if (videoEnabled) {
      bumpStat("videoActions");
    }
  };

  const togglePlay = () => {
    if (!video) return;
    if (video.paused || video.ended) video.play();
    else video.pause();
    bumpInteraction();
  };

  const toggleMute = () => {
    if (!video) return;
    const next = !video.muted;
    saveVolume(video.volume, next);
    video.muted = next;
    bumpInteraction();
  };

  const flushSeek = () => {
    window.clearTimeout(seekTimer.current);
    seekTimer.current = undefined;
    const p = pendingSeek.current;
    if (video && p != null && state.duration > 0) {
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
    if (!video) return;
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
    if (!video) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
      return;
    }
    // On reels, fullscreen the whole page so it's the same reels UI (top
    // controls, action buttons, comments, autoscroll) just filling the screen.
    // Elsewhere, fullscreen the video's parent so our overlay sits on the video.
    const fallback = (video.parentElement as HTMLElement | null) ?? video;
    const target = isReels ? document.documentElement : fallback;
    target.requestFullscreen?.();
    bumpInteraction();
  };

  const cycleSpeed = () => {
    const idx = SPEEDS.indexOf(speed as (typeof SPEEDS)[number]);
    const next = SPEEDS[(idx + 1) % SPEEDS.length];
    setSpeed(next);
    saveSpeed(next);
    if (video) video.playbackRate = next;
    bumpInteraction();
  };

  const toggleAutoscroll = () => {
    const next = !autoscroll;
    setAutoscroll(next);
    saveAutoscroll(next);
    bumpInteraction();
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
              onShowShortcuts={() => {
                setConfigOpen(false);
                setShortcutsOpen(true);
              }}
            />
          )}
        </div>
      )}
    </div>
  );

  const timestamp = !indicator && (dragging || hoverBar) && (
    <div className={styles.timeDisplay}>
      {formatTime(displayTime)} / {formatTime(state.duration)}
    </div>
  );

  const indicatorEl = indicator && (
    <div className={styles.speedIndicator}>
      {indicator === "rewind" ? (
        <Rewind size={16} fill="currentColor" />
      ) : (
        <FastForward size={16} fill="currentColor" />
      )}
      <span>{indicator === "hold" ? "2x" : "5s"}</span>
    </div>
  );

  const topInfo = (
    <>
      {indicatorEl}
      {timestamp}
    </>
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
        bumpInteraction();
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
            // Active slot keeps the same class whether it hosts the seekable
            // scrubber (video ready) or just mirrors IG's fill (image story /
            // still loading), so the node — and its width transition — survive
            // the swap between those two states on every story advance.
            return (
              <div key={i} className={styles.storySegActive}>
                {storyUsableVideo ? (
                  scrubber
                ) : (
                  <div className={styles.storySeg}>
                    <div
                      className={styles.storySegFill}
                      style={{ width: `${storySegments.activeProgress}%` }}
                    />
                  </div>
                )}
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
    left: `${rect?.right ?? 0}px`,
    top: `${rect?.bottom ?? 0}px`,
    ["--progress" as never]: `${volumeLevel * 100}%`,
  };

  const volumeControl = (
    <div
      className={`${styles.volumeFloat} ${isStory ? styles.story : ""} ${
        visible ? "" : styles.hidden
      }`}
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
    left: `${rect?.left ?? 0}px`,
    top: `${rect?.top ?? 0}px`,
    width: `${rect?.width ?? 0}px`,
  };

  const bottomPosition: CSSProperties = {
    left: `${rect?.left ?? 0}px`,
    top: `${rect?.bottom ?? 0}px`,
    width: `${rect?.width ?? 0}px`,
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
          {storyUsableVideo && topInfo}
          {storyBar}
        </div>
        {storyUsableVideo && volumeControl}
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
          {topInfo}
          {scrubber}
        </div>
        {volumeControl}
        {shortcutsOpen && (
          <ShortcutsModal onClose={() => setShortcutsOpen(false)} />
        )}
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
        {topInfo}
        {renderControls(true)}
        {scrubber}
      </div>
      {volumeControl}
    </div>
  );
}
