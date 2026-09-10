import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  Play,
  Volume2,
  Settings,
  Maximize,
  ChevronLeft,
  X,
} from "lucide-react";
import { loadInterFont } from "@/utils/font";
import styles from "./WelcomeModal.module.css";

interface Step {
  title: string;
  desc: string;
  visual: ReactNode;
}

function PlayerVisual() {
  return (
    <div className={styles.player}>
      <div className={styles.playerRow}>
        <span className={styles.playerBtn}>
          <Play size={14} strokeWidth={2.5} fill="currentColor" />
        </span>
        <span className={styles.playerTime}>00:12 / 00:48</span>
        <span className={styles.playerSpacer} />
        <span className={styles.playerBtn}>
          <Volume2 size={15} strokeWidth={2} />
        </span>
        <span className={styles.playerBtn}>
          <Settings size={15} strokeWidth={2} />
        </span>
        <span className={styles.playerBtn}>
          <Maximize size={15} strokeWidth={2} />
        </span>
      </div>
      <div className={styles.playerTrack}>
        <div className={styles.playerFill} />
        <div className={styles.playerKnob} />
      </div>
    </div>
  );
}

const KEYS: Array<[string, string]> = [
  ["Space", "Play / Pause"],
  ["Hold Space", "2x speed"],
  ["←  →", "Seek 5s"],
  ["M", "Mute"],
  ["F", "Fullscreen"],
  ["L", "Like"],
];

function KeysVisual() {
  return (
    <div className={styles.keys}>
      {KEYS.map(([key, label]) => (
        <div key={key} className={styles.keyItem}>
          <kbd className={styles.key}>{key}</kbd>
          <span className={styles.keyLabel}>{label}</span>
        </div>
      ))}
    </div>
  );
}

function StoriesVisual() {
  return (
    <div className={styles.story}>
      <div className={styles.storySegments}>
        <span className={styles.storySeg} style={{ ["--fill" as string]: "100%" }} />
        <span className={styles.storySeg} style={{ ["--fill" as string]: "100%" }} />
        <span className={styles.storySeg} style={{ ["--fill" as string]: "55%" }}>
          <span className={styles.storyKnob} />
        </span>
        <span className={styles.storySeg} style={{ ["--fill" as string]: "0%" }} />
        <span className={styles.storySeg} style={{ ["--fill" as string]: "0%" }} />
      </div>
      <div className={styles.storyMeta}>
        <span className={styles.storyAvatar} />
        <span className={styles.storyName} />
        <span className={styles.storyTime}>00:07</span>
      </div>
    </div>
  );
}

function StatsVisual() {
  return (
    <div className={styles.stats}>
      <div className={styles.statsHero}>
        <span className={styles.statsValue}>1h 24m</span>
        <span className={styles.statsLabel}>watched in reels this week</span>
      </div>
      <div className={styles.statsPills}>
        <span className={`${styles.statsPill} ${styles.statsPillActive}`}>Week</span>
        <span className={styles.statsPill}>Total</span>
      </div>
      <div className={styles.statsRow}>
        <span className={styles.statsMetric}>
          <b>112</b> reels watched
        </span>
        <span className={styles.statsMetric}>
          <b>38</b> stories viewed
        </span>
        <span className={styles.statsMetric}>
          <b>64</b> interactions
        </span>
      </div>
    </div>
  );
}

const STEPS: Step[] = [
  {
    title: "A real video player",
    desc: "A full control bar on every reel and feed video: exact timestamps, a seekable progress bar, playback speed, quality and fullscreen.",
    visual: <PlayerVisual />,
  },
  {
    title: "Everything one key away",
    desc: "Pause, seek, mute, like and go fullscreen without touching the mouse. Hold Space to watch at 2x. The full list lives inside the player's settings.",
    visual: <KeysVisual />,
  },
  {
    title: "Stories you can scrub",
    desc: "A progress bar with one segment per story. Drag to any moment, go back without starting over, and see how long each one lasts.",
    visual: <StoriesVisual />,
  },
  {
    title: "Know where your time goes",
    desc: "The toolbar popup tracks your time on reels, this week and all time, plus reels watched, stories viewed and interactions. Nothing leaves your device.",
    visual: <StatsVisual />,
  },
];

const TOTAL = STEPS.length + 2;

interface Props {
  onClose: () => void;
}

export function WelcomeModal({ onClose }: Props) {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const last = step === TOTAL - 1;

  useEffect(loadInterFont, []);

  const go = (next: number) => {
    if (next < 0 || next >= TOTAL) return;
    setDir(next > step ? 1 : -1);
    setStep(next);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        e.stopPropagation();
        if (last) onClose();
        else go(step + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        e.stopPropagation();
        go(step - 1);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose, step, last]);

  const logo = browser.runtime.getURL("/icon/128.png");
  const current = STEPS[step - 1];

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="igw-welcome-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button className={styles.close} onClick={onClose} aria-label="Close">
          <X size={16} strokeWidth={2.25} />
        </button>

        <div
          key={step}
          className={`${styles.body} ${dir === 1 ? styles.fromRight : styles.fromLeft}`}
        >
          {step === 0 ? (
            <div className={styles.intro}>
              <img
                className={styles.logo}
                src={logo}
                alt=""
                width={64}
                height={64}
              />
              <h1 id="igw-welcome-title" className={styles.title}>
                BetterIG
              </h1>
              <p className={styles.desc}>
                Instagram on your browser, the way it was meant to be. Here is
                a quick look at what changed.
              </p>
            </div>
          ) : last ? (
            <div className={styles.intro}>
              <span className={styles.emoji} aria-hidden="true">
                🎉
              </span>
              <h1 id="igw-welcome-title" className={styles.title}>
                Thanks for installing BetterIG
              </h1>
              <p className={styles.desc}>
                You are all set. Open the toolbar popup any time for your stats
                and to turn features on or off.
              </p>
            </div>
          ) : (
            <>
              <div className={styles.visual}>{current.visual}</div>
              <h1 id="igw-welcome-title" className={styles.title}>
                {current.title}
              </h1>
              <p className={styles.desc}>{current.desc}</p>
            </>
          )}
        </div>

        <div className={styles.footer}>
          <div className={styles.dots} aria-hidden="true">
            {Array.from({ length: TOTAL }, (_, i) => (
              <span
                key={i}
                className={`${styles.dot} ${i === step ? styles.dotActive : ""}`}
              />
            ))}
          </div>
          <div className={styles.actions}>
            {step > 0 && (
              <button
                className={styles.back}
                onClick={() => go(step - 1)}
                aria-label="Back"
              >
                <ChevronLeft size={18} strokeWidth={2.25} />
              </button>
            )}
            <button
              className={styles.next}
              onClick={() => (last ? onClose() : go(step + 1))}
            >
              {step === 0 ? "Take the tour" : last ? "Get started" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
