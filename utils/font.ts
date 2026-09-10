let fontLoaded = false;

export function loadInterFont() {
  if (fontLoaded || typeof document === "undefined") return;
  fontLoaded = true;
  try {
    const url = browser.runtime.getURL("/fonts/InterVariable.woff2");
    const face = new FontFace(
      "Inter Variable",
      `url(${url}) format("woff2-variations")`,
      { weight: "100 900", style: "normal", display: "swap" },
    );
    face.load().then((f) => document.fonts.add(f)).catch(() => {});
  } catch {}
}
