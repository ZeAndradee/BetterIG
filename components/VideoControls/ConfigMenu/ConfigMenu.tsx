import { useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Maximize,
  Keyboard,
  SlidersHorizontal,
  Check,
} from "lucide-react";
import { Toggle } from "@/components/Toggle/Toggle";
import { AUTO_QUALITY } from "@/utils/quality";
import type { QualityOption, QualityState } from "@/utils/quality";
import styles from "./ConfigMenu.module.css";

export const SPEEDS = [0.5, 1, 1.5, 2] as const;
export type Speed = (typeof SPEEDS)[number];

interface Props {
  expandUp: boolean;
  autoscroll: boolean;
  speed: number;
  showFullscreen: boolean;
  showAutoscroll: boolean;
  quality: QualityState;
  qualityPref: string;
  onToggleAutoscroll: () => void;
  onCycleSpeed: () => void;
  onFullscreen: () => void;
  onShowShortcuts: () => void;
  onSelectQuality: (label: string) => void;
}

function qualityValue(state: QualityState, pref: string): string {
  if (pref === AUTO_QUALITY) {
    return state.playing ? `Auto (${state.playing})` : "Auto";
  }
  if (state.status === "loading") return `${pref}…`;
  if (state.current && state.current !== pref) return `${pref} (${state.current})`;
  return pref;
}

export function ConfigMenu({
  expandUp,
  autoscroll,
  speed,
  showFullscreen,
  showAutoscroll,
  quality,
  qualityPref,
  onToggleAutoscroll,
  onCycleSpeed,
  onFullscreen,
  onShowShortcuts,
  onSelectQuality,
}: Props) {
  const [qualityOpen, setQualityOpen] = useState(false);
  const hasQuality = quality.options.length > 0;

  if (qualityOpen) {
    const items: Array<QualityOption | null> = [null, ...quality.options];
    const active = quality.current ?? quality.playing;
    return (
      <div
        className={`${styles.panel} ${expandUp ? styles.expandUp : styles.expandDown}`}
      >
        <button className={styles.row} onClick={() => setQualityOpen(false)}>
          <span className={styles.icon}>
            <ChevronLeft size={20} strokeWidth={2} />
          </span>
          <span className={styles.label}>Quality</span>
        </button>
        <div className={styles.divider} />
        {items.map((opt) => {
          const label = opt ? opt.label : AUTO_QUALITY;
          const selected = qualityPref === label;
          return (
            <button
              key={label}
              className={`${styles.row} ${selected ? styles.selected : ""}`}
              onClick={() => {
                onSelectQuality(label);
                setQualityOpen(false);
              }}
            >
              <span className={styles.icon}>
                {selected && <Check size={18} strokeWidth={2.5} />}
              </span>
              <span className={styles.label}>{opt ? opt.label : "Auto"}</span>
              {!opt && selected && active && (
                <span className={styles.value}>{active}</span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={`${styles.panel} ${expandUp ? styles.expandUp : styles.expandDown}`}
    >
      {showAutoscroll && (
        <button className={styles.row} onClick={onToggleAutoscroll}>
          <span className={styles.icon}>
            <ChevronDown size={20} strokeWidth={2.5} />
          </span>
          <span className={styles.label}>Autoscroll</span>
          <Toggle on={autoscroll} />
        </button>
      )}

      <button className={styles.row} onClick={onCycleSpeed}>
        <span className={styles.icon}>
          <Gauge size={20} strokeWidth={2} />
        </span>
        <span className={styles.label}>Speed</span>
        <span className={styles.value}>{speed}x</span>
      </button>

      <button
        className={styles.row}
        onClick={() => hasQuality && setQualityOpen(true)}
        disabled={!hasQuality}
      >
        <span className={styles.icon}>
          <SlidersHorizontal size={20} strokeWidth={2} />
        </span>
        <span className={styles.label}>Quality</span>
        <span className={styles.value}>
          {hasQuality ? qualityValue(quality, qualityPref) : "—"}
        </span>
        {hasQuality && (
          <span className={styles.chevron}>
            <ChevronRight size={16} strokeWidth={2} />
          </span>
        )}
      </button>

      {showFullscreen && (
        <button className={styles.row} onClick={onFullscreen}>
          <span className={styles.icon}>
            <Maximize size={20} strokeWidth={2} />
          </span>
          <span className={styles.label}>Fullscreen</span>
        </button>
      )}

      <button className={styles.row} onClick={onShowShortcuts}>
        <span className={styles.icon}>
          <Keyboard size={20} strokeWidth={2} />
        </span>
        <span className={styles.label}>Shortcuts</span>
      </button>
    </div>
  );
}
