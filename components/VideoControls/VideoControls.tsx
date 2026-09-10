import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, CSSProperties } from "react";
import { Settings, Play, Pause, FastForward, Rewind } from "lucide-react";
import { useActiveVideo } from "@/hooks/video/useActiveVideo";
import { useVideoState } from "@/hooks/video/useVideoState";
import { useVideoRect } from "@/hooks/video/useVideoRect";
import { usePointerInRect } from "@/hooks/video/usePointerInRect";
import { useStorySegments } from "@/hooks/video/useStorySegments";
import { useVideoShortcuts } from "@/hooks/video/useVideoShortcuts";
import { usePersistentPause } from "@/hooks/video/usePersistentPause";
import { useVideoQuality } from "@/hooks/video/useVideoQuality";
import { bumpStat } from "@/utils/store";
import { loadInterFont } from "@/utils/font";
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

  const storySegments = useStorySegments(storiesEnabled);

  const pathIsReels = window.location.pathname.startsWith("/reels");
  const pathIsStory = window.location.pathname.startsWith("/stories");
  const pathIsFeed = window.location.pathname === "/";
  const pathIsExplore = window.location.pathname.startsWith("/explore");
  const showConfig = !pathIsStory && !pathIsFeed && !pathIsExplore;
  const quality = useVideoQuality(video, videoEnabled && !pathIsStory);
  const rememberPaused = usePersistentPause(
    video,
    videoEnabled && !pathIsReels && !pathIsStory,
  );
  const flashIndicator = (kind: "forward" | "rewind") => {
    setIndicator(kind);
    window.clearTimeout(indicatorTimer.current);
    indicatorTimer.current = window.setTimeout(() => setIndicator(null), 700);
  };
  useVideoShortcuts({
    video,
    enabled: pathIsStory ? storiesEnabled : videoEnabled,
    isReels: pathIsReels,
    isStory: pathIsStory,
    speed: showConfig ? speed : 1,
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

  useEffect(() => {
    setVisible(false);
    setHoverBar(false);
    setConfigOpen(false);
    setDragging(false);
  }, [video]);

  useEffect(loadInterFont, []);
  useEffect(ensureFullscreenStyle, []);

  useEffect(() => {
    if (!video || !showConfig) return;
    video.playbackRate = speed;
  }, [video, speed, showConfig]);

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

  useEffect(() => {
    if (!video || !isFullscreen) return;
    const prev = video.controls;
    video.controls = false;
    return () => {
      video.controls = prev;
    };
  }, [video, isFullscreen]);

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
    ? mouseActive || hoverBar || configOpen || dragging
    : hoverVideo || hoverBar || configOpen || dragging;
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

  const storyUsableVideo = isStory && !!video && state.duration > 0;

  const storyHasBar = isStory && !!storySegments && storySegments.count > 0;

  if (!storyHasBar && (!video || !rect || rect.width <= 0 || state.duration <= 0)) {
    return <div ref={rootRef} style={{ display: "none" }} />;
  }

  const bumpInteraction = () => {
    if (isStory) {
      if (storiesEnabled) bumpStat("storyActions");
    } else if (videoEnabled) {
      bumpStat("videoActions");
    }
  };

  const togglePlay = () => {
    if (!video) return;
    const willPlay = video.paused || video.ended;
    if (willPlay) video.play();
    else video.pause();
    rememberPaused(!willPlay);
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

  const progress =
    state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;
  const displayProgress = scrubValue ?? progress;
  const displayTime =
    scrubValue != null
      ? (scrubValue / 100) * state.duration
      : state.currentTime;

  const toggleFullscreen = () => {
    if (!video) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
      return;
    }
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

  const selectQuality = (label: string) => {
    quality.setQuality(label);
    bumpInteraction();
  };

  const renderControls = (expandUp: boolean) => (
    <div
      className={`${styles.controlsRow} ${visible ? "" : styles.hidden}`}
      onMouseEnter={() => setHoverBar(true)}
      onMouseLeave={() => setHoverBar(false)}
    >
      {showConfig && (
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
              showFullscreen
              showAutoscroll={isReels}
              quality={quality.state}
              qualityPref={quality.pref}
              onToggleAutoscroll={toggleAutoscroll}
              onCycleSpeed={cycleSpeed}
              onFullscreen={toggleFullscreen}
              onSelectQuality={selectQuality}
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

  const storyBar =
    storySegments && storySegments.count > 0 ? (
      <div className={styles.storySegments}>
        {Array.from({ length: storySegments.count }).map((_, i) => {
          if (i === storySegments.activeIndex) {
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

  const centerPosition: CSSProperties = {
    left: `${(rect?.left ?? 0) + (rect?.width ?? 0) / 2}px`,
    top: `${(rect?.top ?? 0) + (rect?.height ?? 0) / 2}px`,
  };

  const storyPosition: CSSProperties = storySegments
    ? {
        left: `${storySegments.left}px`,
        top: `${storySegments.top}px`,
        width: `${storySegments.width}px`,
      }
    : topPosition;

  if (isStory) {
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
        {shortcutsOpen && (
          <ShortcutsModal onClose={() => setShortcutsOpen(false)} />
        )}
      </div>
    );
  }

  return (
    <div ref={rootRef}>
      <button
        className={`${styles.centerPlay} ${
          visible || !state.playing ? "" : styles.hidden
        }`}
        style={centerPosition}
        onClick={togglePlay}
        aria-label="Play/Pause"
      >
        {state.playing ? (
          <Pause size={30} fill="#273034" strokeWidth={0} />
        ) : (
          <Play size={30} fill="#273034" strokeWidth={0} />
        )}
      </button>
      {showConfig && (
        <div
          className={`${styles.topBar} ${visible ? "" : styles.hidden}`}
          style={topPosition}
        >
          {renderControls(false)}
        </div>
      )}
      <div
        className={styles.bottomBar}
        style={bottomPosition}
        onMouseEnter={() => setHoverBar(true)}
        onMouseLeave={() => setHoverBar(false)}
      >
        {topInfo}
        {scrubber}
      </div>
      {shortcutsOpen && <ShortcutsModal onClose={() => setShortcutsOpen(false)} />}
    </div>
  );
}
