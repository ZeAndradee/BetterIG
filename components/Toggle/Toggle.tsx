import styles from "./Toggle.module.css";

interface Props {
  on: boolean;
}

export function Toggle({ on }: Props) {
  return (
    <span
      className={`${styles.track} ${on ? styles.on : ""}`}
      role="switch"
      aria-checked={on}
    >
      <span className={styles.knob} />
    </span>
  );
}
