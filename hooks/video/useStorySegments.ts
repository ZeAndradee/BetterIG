import { useEffect, useState } from 'react';

const MARK_ATTR = 'data-igw-native-storybar';
const STYLE_ID = 'igw-hide-native-storybar';

export interface StorySegments {
  count: number;
  activeIndex: number;
  activeProgress: number;
  left: number;
  top: number;
  width: number;
}

function looksLikeProgressRow(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  if (r.top > 200) return false;
  if (r.width < 80) return false;

  const cs = getComputedStyle(el);
  if (cs.display !== 'flex' || cs.flexDirection.startsWith('column')) return false;

  const kids = Array.from(el.children) as HTMLElement[];
  if (kids.length === 0) return false;

  const thin = kids.filter((k) => {
    const kr = k.getBoundingClientRect();
    return kr.height > 0 && kr.height <= 8 && kr.width >= 3;
  });
  return thin.length >= Math.ceil(kids.length * 0.7);
}

function findHeader(): HTMLElement | null {
  for (const time of Array.from(document.querySelectorAll<HTMLElement>('time'))) {
    const tr = time.getBoundingClientRect();
    if (tr.top > 220 || tr.width <= 0) continue;
    let n: HTMLElement | null = time.parentElement;
    while (n && n !== document.body) {
      const r = n.getBoundingClientRect();
      if (r.top > 220) break;
      const hasAvatar = !!n.querySelector('a[href^="/"] img');
      const hasButton = !!n.querySelector('[role="button"]');
      if (hasAvatar && hasButton && r.width >= 80 && r.height <= 120) return n;
      n = n.parentElement;
    }
  }
  return null;
}

function findRow(): HTMLElement | null {
  const fills = document.querySelectorAll<HTMLElement>('div[style*="translateX"]');
  for (const fill of Array.from(fills)) {
    const fr = fill.getBoundingClientRect();
    if (fr.top > 200 || fr.height > 8) continue;
    const row = fill.parentElement?.parentElement ?? null;
    if (row && looksLikeProgressRow(row)) return row;
  }

  const marked = document.querySelector<HTMLElement>(`[${MARK_ATTR}]`);
  if (marked && marked.isConnected && looksLikeProgressRow(marked)) return marked;

  let best: HTMLElement | null = null;
  let bestScore = -1;
  for (const el of Array.from(document.querySelectorAll<HTMLElement>('div'))) {
    if (!looksLikeProgressRow(el)) continue;
    const score = el.getBoundingClientRect().width * 1000 + el.children.length;
    if (score > bestScore) {
      best = el;
      bestScore = score;
    }
  }
  return best;
}

function read(row: HTMLElement, header: HTMLElement | null): StorySegments {
  const kids = Array.from(row.children) as HTMLElement[];
  let activeIndex = kids.findIndex((k) => k.childElementCount > 0);
  if (activeIndex < 0) activeIndex = kids.length - 1;

  let activeProgress = 0;
  const fill = kids[activeIndex]?.firstElementChild as HTMLElement | null;
  const m = fill ? /translateX\(([-\d.]+)%\)/.exec(fill.style.transform) : null;
  if (m) activeProgress = Math.min(100, Math.max(0, 100 + parseFloat(m[1])));

  const r = row.getBoundingClientRect();
  const left = r.left;
  const width = r.width;
  let top = r.top;
  if (header) {
    const hr = header.getBoundingClientRect();
    if (hr.height > 0) top = hr.top;
  }

  return {
    count: kids.length,
    activeIndex,
    activeProgress,
    left,
    top,
    width,
  };
}

export function useStorySegments(enabled = true): StorySegments | null {
  const [segments, setSegments] = useState<StorySegments | null>(null);

  useEffect(() => {
    if (!enabled) {
      setSegments(null);
      return;
    }

    let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = `[${MARK_ATTR}] { visibility: hidden !important; }`;
      document.head.appendChild(style);
    }

    let raf = 0;
    let prevKey = '';
    let headerEl: HTMLElement | null = null;

    const tick = () => {
      raf = requestAnimationFrame(tick);

      if (style && !style.isConnected) document.head.appendChild(style);

      if (!window.location.pathname.startsWith('/stories')) {
        if (prevKey !== '') {
          prevKey = '';
          setSegments(null);
        }
        return;
      }

      const row = findRow();
      if (!row) {
        if (prevKey !== '') {
          prevKey = '';
          setSegments(null);
        }
        return;
      }
      if (!row.hasAttribute(MARK_ATTR)) {
        document
          .querySelectorAll(`[${MARK_ATTR}]`)
          .forEach((el) => el.removeAttribute(MARK_ATTR));
        row.setAttribute(MARK_ATTR, '');
      }

      if (!headerEl || !headerEl.isConnected) headerEl = findHeader();
      const next = read(row, headerEl);
      const key = `${next.count}:${next.activeIndex}:${Math.round(
        next.activeProgress,
      )}:${Math.round(next.left)}:${Math.round(next.top)}:${Math.round(
        next.width,
      )}`;
      if (key !== prevKey) {
        prevKey = key;
        setSegments(next);
      }
    };

    tick();

    return () => {
      cancelAnimationFrame(raf);
      style?.remove();
      document
        .querySelectorAll(`[${MARK_ATTR}]`)
        .forEach((el) => el.removeAttribute(MARK_ATTR));
    };
  }, [enabled]);

  return segments;
}
