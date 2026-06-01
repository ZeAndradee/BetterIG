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
  // Skip big wrapper buttons: IG makes the whole reel/video area a
  // [role="button"] that contains the audio icon deep inside. Matching it
  // would hide the entire profile/bio overlay. The real mute toggle never
  // wraps the video or other buttons.
  if (btn.querySelector('video')) return false;
  if (btn.querySelectorAll('button, [role="button"]').length > 0) return false;

  const label = btn.getAttribute('aria-label') ?? '';

  // Only inspect the button's own icon — a single direct svg, not anything
  // nested through other content.
  const svgs = btn.querySelectorAll('svg');
  const svg = svgs.length === 1 ? svgs[0] : null;
  const titleText = svg?.querySelector('title')?.textContent ?? '';

  if (LABEL_RE.test(label)) return true;
  if (svg && LABEL_RE.test(titleText)) return true;

  const d = svg?.querySelector('path')?.getAttribute('d') ?? '';
  if (d && ICON_PATH_PREFIXES.some((p) => d.startsWith(p))) return true;

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
        // Mark the button itself, not its parent. IG nests the mute toggle in
        // a wide overlay div that also holds the profile/bio + tap-to-pause
        // layer; hiding the parent would kill all three.
        if (btn.hasAttribute(MARK_ATTR)) return;
        if (isNativeVolumeButton(btn)) btn.setAttribute(MARK_ATTR, '');
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
