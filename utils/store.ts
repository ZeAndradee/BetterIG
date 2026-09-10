import { useSyncExternalStore } from "react";

export interface Flags {
  video: boolean;
  stories: boolean;
}

export interface Stats {
  reelsTime: number;
  reelsWatched: number;
  videoActions: number;
  storiesViewed: number;
  storyActions: number;
}

const FLAGS_KEY = "iw_flags";
const STATS_KEY = "iw_stats";
const WEEK_STATS_KEY = "iw_week_stats";
const WEEK_KEY = "iw_week";
const WELCOME_KEY = "iw_welcome_seen";

function startOfWeek(now = Date.now()): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d.getTime();
}

const FLAGS_DEFAULT: Flags = { video: true, stories: true };
const STATS_DEFAULT: Stats = {
  reelsTime: 0,
  reelsWatched: 0,
  videoActions: 0,
  storiesViewed: 0,
  storyActions: 0,
};

type Shape = {
  [FLAGS_KEY]: Flags;
  [STATS_KEY]: Stats;
  [WEEK_STATS_KEY]: Stats;
};

const DEFAULTS: Shape = {
  [FLAGS_KEY]: FLAGS_DEFAULT,
  [STATS_KEY]: STATS_DEFAULT,
  [WEEK_STATS_KEY]: STATS_DEFAULT,
};

const cache: Shape = {
  [FLAGS_KEY]: { ...FLAGS_DEFAULT },
  [STATS_KEY]: { ...STATS_DEFAULT },
  [WEEK_STATS_KEY]: { ...STATS_DEFAULT },
};

let weekStart = startOfWeek();
let welcomePending = false;

const listeners = new Set<() => void>();
let hydrated = false;

function emit() {
  for (const l of listeners) l();
}

async function hydrate() {
  try {
    const stored = await browser.storage.local.get([
      FLAGS_KEY,
      STATS_KEY,
      WEEK_STATS_KEY,
      WEEK_KEY,
      WELCOME_KEY,
    ]);
    welcomePending = stored[WELCOME_KEY] !== true;
    cache[FLAGS_KEY] = { ...FLAGS_DEFAULT, ...(stored[FLAGS_KEY] as Flags) };
    cache[STATS_KEY] = { ...STATS_DEFAULT, ...(stored[STATS_KEY] as Stats) };
    cache[WEEK_STATS_KEY] = {
      ...STATS_DEFAULT,
      ...(stored[WEEK_STATS_KEY] as Stats),
    };
    const storedWeek = stored[WEEK_KEY] as number | undefined;
    const current = startOfWeek();
    if (storedWeek !== current) {
      cache[WEEK_STATS_KEY] = { ...STATS_DEFAULT };
      weekStart = current;
      await browser.storage.local.set({
        [WEEK_STATS_KEY]: cache[WEEK_STATS_KEY],
        [WEEK_KEY]: current,
      });
    } else {
      weekStart = storedWeek;
    }
  } catch {}
  hydrated = true;
  emit();
}

async function ensureWeek() {
  const current = startOfWeek();
  if (current === weekStart) return;
  weekStart = current;
  cache[WEEK_STATS_KEY] = { ...STATS_DEFAULT };
  await browser.storage.local.set({
    [WEEK_STATS_KEY]: cache[WEEK_STATS_KEY],
    [WEEK_KEY]: current,
  });
  emit();
}

if (typeof browser !== "undefined" && browser.storage) {
  hydrate();
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    let touched = false;
    for (const key of [FLAGS_KEY, STATS_KEY, WEEK_STATS_KEY] as const) {
      const change = changes[key];
      if (change) {
        cache[key] = Object.assign({}, DEFAULTS[key], change.newValue) as never;
        touched = true;
      }
    }
    if (changes[WELCOME_KEY]) {
      welcomePending = changes[WELCOME_KEY].newValue !== true;
      touched = true;
    }
    if (touched) emit();
  });
}

export function isHydrated() {
  return hydrated;
}

export function getFlags(): Flags {
  return cache[FLAGS_KEY];
}
export function getStats(): Stats {
  return cache[STATS_KEY];
}
export function getWeekStats(): Stats {
  return cache[WEEK_STATS_KEY];
}
export function getWelcomePending(): boolean {
  return welcomePending;
}

export async function dismissWelcome() {
  welcomePending = false;
  emit();
  await browser.storage.local.set({ [WELCOME_KEY]: true });
}

export async function setFlags(patch: Partial<Flags>) {
  cache[FLAGS_KEY] = { ...cache[FLAGS_KEY], ...patch };
  emit();
  await browser.storage.local.set({ [FLAGS_KEY]: cache[FLAGS_KEY] });
}

export async function bumpStat(key: keyof Stats, by = 1) {
  await ensureWeek();
  cache[STATS_KEY] = { ...cache[STATS_KEY], [key]: cache[STATS_KEY][key] + by };
  cache[WEEK_STATS_KEY] = {
    ...cache[WEEK_STATS_KEY],
    [key]: cache[WEEK_STATS_KEY][key] + by,
  };
  emit();
  await browser.storage.local.set({
    [STATS_KEY]: cache[STATS_KEY],
    [WEEK_STATS_KEY]: cache[WEEK_STATS_KEY],
  });
}

export async function resetStats() {
  cache[STATS_KEY] = { ...STATS_DEFAULT };
  cache[WEEK_STATS_KEY] = { ...STATS_DEFAULT };
  emit();
  await browser.storage.local.set({
    [STATS_KEY]: cache[STATS_KEY],
    [WEEK_STATS_KEY]: cache[WEEK_STATS_KEY],
  });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useFlags(): Flags {
  return useSyncExternalStore(subscribe, getFlags, getFlags);
}
export function useStats(): Stats {
  return useSyncExternalStore(subscribe, getStats, getStats);
}
export function useWeekStats(): Stats {
  return useSyncExternalStore(subscribe, getWeekStats, getWeekStats);
}
export function useWelcomePending(): boolean {
  return useSyncExternalStore(
    subscribe,
    getWelcomePending,
    getWelcomePending,
  );
}
