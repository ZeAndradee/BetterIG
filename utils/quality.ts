export const QUALITY_QUERY = "igw-quality-query";
export const QUALITY_SET = "igw-quality-set";
export const QUALITY_STATE = "igw-quality-state";

export const AUTO_QUALITY = "auto";

export interface QualityOption {
  label: string;
  height: number;
  bandwidth: number;
}

export type QualityStatus = "idle" | "loading" | "active" | "error";

export interface QualityState {
  options: QualityOption[];
  current: string | null;
  playing: string | null;
  status: QualityStatus;
}

export interface QualitySetPayload {
  label: string;
  auto?: boolean;
}

export const EMPTY_QUALITY_STATE: QualityState = {
  options: [],
  current: null,
  playing: null,
  status: "idle",
};

export function labelHeight(label: string): number {
  const n = parseInt(label, 10);
  return Number.isFinite(n) ? n : 0;
}

export const QUALITY_STEPS = [144, 240, 360, 480, 720, 1080, 1440, 2160, 4320];

function stepFor(height: number): number {
  let step = QUALITY_STEPS[0];
  for (const s of QUALITY_STEPS) if (height >= s) step = s;
  return step;
}

export function limitQualityOptions(options: QualityOption[]): QualityOption[] {
  const best = new Map<number, QualityOption>();
  for (const opt of options) {
    const step = stepFor(opt.height);
    const cur = best.get(step);
    if (
      !cur ||
      opt.height > cur.height ||
      (opt.height === cur.height && opt.bandwidth > cur.bandwidth)
    ) {
      best.set(step, opt);
    }
  }
  return Array.from(best.values()).sort(
    (a, b) => b.height - a.height || b.bandwidth - a.bandwidth,
  );
}
