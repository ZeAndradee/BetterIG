// Reads Instagram's native story progress bar so we can mirror it as our own
// segmented, seekable bar — and hides the native one (it desyncs the moment the
// user seeks, since IG drives it on its own timer, not on video.currentTime).
//
// Native structure (hashed classes, so we detect by shape, not by class):
//   <row flex>
//     <seg>            completed  — no inner child
//     <seg><fill/></seg>  active  — exactly one segment holds an inner fill div
//     <seg>            upcoming   — no inner child
//   </row>
// So activeIndex = first child that contains an element child; everything
// before it is complete, everything after is empty.
import { useEffect, useState } from 'react';

const MARK_ATTR = 'data-igw-native-storybar';
const STYLE_ID = 'igw-hide-native-storybar';

export interface StorySegments {
  count: number;
  activeIndex: number;
  // Fill % (0..100) of the active segment, read from IG's own animation.
  // Used to drive our bar on image stories, which have no <video> to track.
  activeProgress: number;
  // Position of the native row, so we can anchor our overlay exactly over it
  // even when there's no video element to measure.
  left: number;
  top: number;
  width: number;
}

// Validates a candidate row: a wide, thin flex row near the top of the story
// whose children are short horizontal bars. Used to confirm an anchor hit.
function looksLikeProgressRow(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  if (r.top > 200) return false;
  if (r.width < 80) return false;

  const cs = getComputedStyle(el);
  if (cs.display !== 'flex' || cs.flexDirection.startsWith('column')) return false;

  const kids = Array.from(el.children) as HTMLElement[];
  if (kids.length === 0) return false;

  // Most children should be short horizontal bars (allow the odd outlier).
  const thin = kids.filter((k) => {
    const kr = k.getBoundingClientRect();
    return kr.height > 0 && kr.height <= 8 && kr.width >= 3;
  });
  return thin.length >= Math.ceil(kids.length * 0.7);
}

// The story header row (avatar + username + timestamp + audio/menu buttons).
// We match the bar's horizontal extent to it. Detected by semantics so it
// survives IG's class churn: the nearest ancestor of the <time> stamp that
// holds both a profile avatar link and an action button is that row.
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
  // Reuse the cached/marked row while it's still in the DOM. It's only dropped
  // when IG detaches it (e.g. switching story user), triggering a re-scan.
  const marked = document.querySelector<HTMLElement>(`[${MARK_ATTR}]`);
  if (marked && marked.isConnected) return marked;

  // Anchor on the active segment's inner fill: IG animates it via an inline
  // `transform: translateX(...)`. That div is unique to the story bar, so its
  // grandparent (fill → segment → row) is the segment row.
  const fills = document.querySelectorAll<HTMLElement>('div[style*="translateX"]');
  for (const fill of Array.from(fills)) {
    const fr = fill.getBoundingClientRect();
    if (fr.top > 200 || fr.height > 8) continue;
    const row = fill.parentElement?.parentElement ?? null;
    if (row && looksLikeProgressRow(row)) return row;
  }

  // Fallback: geometric scan, preferring the row with the most segments.
  let best: HTMLElement | null = null;
  for (const el of Array.from(document.querySelectorAll<HTMLElement>('div'))) {
    if (!looksLikeProgressRow(el)) continue;
    if (!best || el.children.length > best.children.length) best = el;
  }
  return best;
}

function read(row: HTMLElement, header: HTMLElement | null): StorySegments {
  const kids = Array.from(row.children) as HTMLElement[];
  let activeIndex = kids.findIndex((k) => k.childElementCount > 0);
  // No inner fill found (e.g. between transitions): assume the last segment.
  if (activeIndex < 0) activeIndex = kids.length - 1;

  // IG fills the active segment by translating an inner div from -100%
  // (empty) to 0% (full). Convert to a 0..100 percentage.
  let activeProgress = 0;
  const fill = kids[activeIndex]?.firstElementChild as HTMLElement | null;
  const m = fill ? /translateX\(([-\d.]+)%\)/.exec(fill.style.transform) : null;
  if (m) activeProgress = Math.min(100, Math.max(0, 100 + parseFloat(m[1])));

  const r = row.getBoundingClientRect();
  // Match the header row: horizontal extent AND vertical anchor. We anchor to
  // header.top and lift the bar above it in CSS, so there's a real gap between
  // the bar and the username row (the native segment row can't give us that).
  let left = r.left;
  let width = r.width;
  let top = r.top;
  if (header) {
    const hr = header.getBoundingClientRect();
    if (hr.width > 0) {
      left = hr.left;
      width = hr.width;
      top = hr.top;
    }
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
      // visibility (not display:none) so the row keeps its geometry — we
      // anchor our overlay to it and read its position for image stories.
      style.textContent = `[${MARK_ATTR}] { visibility: hidden !important; }`;
      document.head.appendChild(style);
    }

    let raf = 0;
    let prevKey = '';
    let headerEl: HTMLElement | null = null;

    const tick = () => {
      raf = requestAnimationFrame(tick);

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
      if (!row.hasAttribute(MARK_ATTR)) row.setAttribute(MARK_ATTR, '');

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
