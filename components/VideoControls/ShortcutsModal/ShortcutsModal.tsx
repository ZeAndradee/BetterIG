import { useEffect } from "react";
import { X } from "lucide-react";
import styles from "./ShortcutsModal.module.css";

interface Shortcut {
  label: string;
  keys: string[];
}

const SHORTCUTS: Shortcut[] = [
  { label: "Play / Pause", keys: ["Space"] },
  { label: "2x speed (hold)", keys: ["Space"] },
  { label: "Like", keys: ["L"] },
  { label: "Mute / Unmute", keys: ["M"] },
  { label: "Fullscreen", keys: ["F"] },
  { label: "Seek forward 5s", keys: ["→"] },
  { label: "Seek back 5s", keys: ["←"] },
];

interface Props {
  onClose: () => void;
}

export function ShortcutsModal({ onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-label="Keyboard shortcuts"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <span className={styles.title}>Keyboard shortcuts</span>
          <button className={styles.close} onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className={styles.list}>
          {SHORTCUTS.map((s) => (
            <div key={s.label} className={styles.row}>
              <span className={styles.label}>{s.label}</span>
              <span className={styles.keys}>
                {s.keys.map((k) => (
                  <kbd key={k} className={styles.key}>
                    {k}
                  </kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
