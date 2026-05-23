// Hides Instagram's native audio/volume toggle on videos.
import { useEffect } from 'react';

const MARK_ATTR = 'data-igw-native-volume';
const STYLE_ID = 'igw-hide-native-volume';

// aria-label of the audio toggle across Instagram locales.
const LABEL_RE = /\b(audio|áudio|sound|son|sonido|ton|geluid|som|ses|звук|音)\b/i;

// Stable `d` prefixes of IG's audio icons (muted + unmuted).
const ICON_PATH_PREFIXES = [
  'M1.5 13.3c',
  'M16.636',
];

function isNativeVolumeButton(btn: HTMLElement): boolean {
  const label = btn.getAttribute('aria-label') ?? '';
  const svg = btn.querySelector('svg');
  const titleText = svg?.querySelector('title')?.textContent ?? '';

  if (LABEL_RE.test(label) || LABEL_RE.test(titleText)) return true;

  const d = svg?.querySelector('path')?.getAttribute('d') ?? '';
  if (d && ICON_PATH_PREFIXES.some((p) => d.startsWith(p))) return true;

  // Fallback: IG-icon-set svg (48x48 viewBox) inside a video container.
  if (
    svg?.getAttribute('viewBox') === '0 0 48 48' &&
    btn.closest('div')?.querySelector('video')
  ) {
    return true;
  }

  return false;
}

export function useHideNativeVolume(): void {
  useEffect(() => {
    let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = `[${MARK_ATTR}] { display: none !important; }`;
      document.head.appendChild(style);
    }

    const scan = () => {
      const candidates = document.querySelectorAll<HTMLElement>(
        'button, [role="button"]',
      );
      candidates.forEach((btn) => {
        const target = btn.parentElement ?? btn;
        if (target.hasAttribute(MARK_ATTR)) return;
        if (isNativeVolumeButton(btn)) target.setAttribute(MARK_ATTR, '');
      });
    };

    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.documentElement, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      style?.remove();
      document
        .querySelectorAll(`[${MARK_ATTR}]`)
        .forEach((el) => el.removeAttribute(MARK_ATTR));
    };
  }, []);
}
