import { ChevronDown, Gauge, Maximize, Keyboard } from "lucide-react";
import { Toggle } from "@/components/Toggle/Toggle";
import styles from "./ConfigMenu.module.css";

export const SPEEDS = [0.5, 1, 1.5, 2] as const;
export type Speed = (typeof SPEEDS)[number];

interface Props {
  expandUp: boolean;
  autoscroll: boolean;
  speed: number;
  showFullscreen: boolean;
  onToggleAutoscroll: () => void;
  onCycleSpeed: () => void;
  onFullscreen: () => void;
  onShowShortcuts: () => void;
}

export function ConfigMenu({
  expandUp,
  autoscroll,
  speed,
  showFullscreen,
  onToggleAutoscroll,
  onCycleSpeed,
  onFullscreen,
  onShowShortcuts,
}: Props) {
  return (
    <div
      className={`${styles.panel} ${expandUp ? styles.expandUp : styles.expandDown}`}
    >
      <button className={styles.row} onClick={onToggleAutoscroll}>
        <span className={styles.icon}>
          <ChevronDown size={20} strokeWidth={2.5} />
        </span>
        <span className={styles.label}>Autoscroll</span>
        <Toggle on={autoscroll} />
      </button>

      <button className={styles.row} onClick={onCycleSpeed}>
        <span className={styles.icon}>
          <Gauge size={20} strokeWidth={2} />
        </span>
        <span className={styles.label}>Speed</span>
        <span className={styles.value}>{speed}x</span>
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
