import { useState } from "react";
import { Play, Clapperboard, Clock, RotateCcw } from "lucide-react";
import {
  useFlags,
  useStats,
  useWeekStats,
  setFlags,
  resetStats,
} from "@/utils/store";
import { Toggle } from "@/components/Toggle/Toggle";
import type { Stats } from "@/utils/store";
import styles from "./App.module.css";

const logo = "/icon/48.png";

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString("en-US");
}

function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

interface Metric {
  key: keyof Stats;
  label: string;
}

interface FeatureDef {
  key: keyof ReturnType<typeof useFlags>;
  icon: React.ReactNode;
  label: string;
  desc: string;
  metrics: [Metric, Metric];
}

const FEATURES: FeatureDef[] = [
  {
    key: "video",
    icon: <Play size={18} strokeWidth={2.4} />,
    label: "Video Player",
    desc: "Controls on reels & feed videos",
    metrics: [
      { key: "reelsWatched", label: "reels watched" },
      { key: "videoActions", label: "interactions" },
    ],
  },
  {
    key: "stories",
    icon: <Clapperboard size={18} strokeWidth={2.2} />,
    label: "Stories Controls",
    desc: "Seekable bar & volume on stories",
    metrics: [
      { key: "storiesViewed", label: "stories viewed" },
      { key: "storyActions", label: "interactions" },
    ],
  },
];

type View = "week" | "total";

export function App() {
  const flags = useFlags();
  const totalStats = useStats();
  const weekStats = useWeekStats();
  const [view, setView] = useState<View>("week");
  const stats = view === "week" ? weekStats : totalStats;

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <img
            className={styles.logo}
            src={logo}
            alt=""
            width={20}
            height={20}
          />
          <span className={styles.wordmark}>BetterIG</span>
        </div>
        <span className={styles.tag}>
          Instagram, the way it was meant to be
        </span>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroText}>
          <span className={styles.heroValue}>
            {formatDuration(stats.reelsTime)}
          </span>
          <span className={styles.heroLabel}>
            {view === "week" ? "watched in reels this week" : "watched in reels"}
          </span>
        </div>

        <div className={styles.viewToggle} role="tablist">
          <button
            className={`${styles.viewBtn} ${view === "week" ? styles.viewBtnActive : ""}`}
            onClick={() => setView("week")}
            role="tab"
            aria-selected={view === "week"}
          >
            Week
          </button>
          <button
            className={`${styles.viewBtn} ${view === "total" ? styles.viewBtnActive : ""}`}
            onClick={() => setView("total")}
            role="tab"
            aria-selected={view === "total"}
          >
            Total
          </button>
        </div>
      </section>

      <section className={styles.panel}>
        {FEATURES.map((f) => {
          const on = flags[f.key];
          return (
            <div key={f.key} className={styles.card}>
              <button
                className={styles.row}
                onClick={() => setFlags({ [f.key]: !on })}
                aria-pressed={on}
              >
                <span
                  className={`${styles.rowIcon} ${on ? styles.rowIconOn : ""}`}
                >
                  {f.icon}
                </span>
                <span className={styles.rowText}>
                  <span className={styles.rowLabel}>{f.label}</span>
                  <span className={styles.rowDesc}>{f.desc}</span>
                </span>
                <Toggle on={on} />
              </button>

              <div className={styles.metrics}>
                {f.metrics.map((m) => (
                  <span key={m.key} className={styles.metric}>
                    <span className={styles.metricValue}>
                      {formatCount(stats[m.key])}
                    </span>{" "}
                    <span className={styles.metricLabel}>{m.label}</span>
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      <button
        className={styles.reset}
        onClick={() => resetStats()}
        aria-label="Reset counters"
      >
        <RotateCcw size={13} />
        Reset counters
      </button>
    </div>
  );
}
