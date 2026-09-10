import {
  QUALITY_QUERY,
  QUALITY_SET,
  QUALITY_STATE,
  AUTO_QUALITY,
  labelHeight,
  limitQualityOptions,
} from "@/utils/quality";
import type {
  QualityOption,
  QualityState,
  QualityStatus,
  QualitySetPayload,
} from "@/utils/quality";

interface Rep {
  id: string;
  mime: string;
  codecs: string;
  label: string;
  height: number;
  bandwidth: number;
  url: string;
  path: string;
  initRange: [number, number];
  indexRange: [number, number];
}

interface Manifest {
  key: string;
  code: string | null;
  duration: number;
  video: Rep[];
  audio: Rep[];
}

interface Segment {
  start: number;
  end: number;
  byteStart: number;
  byteEnd: number;
}

const BUFFER_AHEAD = 30;
const BUFFER_BEHIND = 30;
const TICK_MS = 300;
const TAKEOVER_LIMIT = 3;
const TAKEOVER_WINDOW = 20000;
const SILENCED_VIDEO_EVENTS = ["emptied", "abort", "error", "loadstart"];
const AUTO_APPLY_DELAY = 80;

const manifestsByPath = new Map<string, Manifest>();
const manifestsByCode = new Map<string, Manifest>();
const manifestsByKey = new Map<string, Manifest>();

const msToBlob = new WeakMap<MediaSource, string>();
const msByBlob = new Map<string, WeakRef<MediaSource>>();
const blobToManifest = new Map<string, Manifest>();
const blobToPlayingRep = new Map<string, Rep>();
const sbToMs = new WeakMap<SourceBuffer, MediaSource>();
const bufferUrl = new WeakMap<ArrayBufferLike, string>();
const retiredMs = new WeakSet<MediaSource>();

const players = new WeakMap<HTMLVideoElement, Player>();
const takeoverLog = new WeakMap<HTMLVideoElement, number[]>();
const desired = new WeakMap<HTMLVideoElement, string>();
const knownVideos = new Set<HTMLVideoElement>();

function parseDuration(s: string | null): number {
  if (!s) return 0;
  const m = /PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?/.exec(s);
  if (!m) return 0;
  return (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + +(m[3] || 0);
}

function parseRange(s: string | null): [number, number] | null {
  if (!s) return null;
  const parts = s.split("-");
  if (parts.length !== 2) return null;
  const a = parseInt(parts[0], 10);
  const b = parseInt(parts[1], 10);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return [a, b];
}

function pathOf(url: string): string {
  try {
    const u = new URL(url, location.href);
    return u.host + u.pathname;
  } catch {
    return url;
  }
}

function parseManifest(xml: string, code: string | null, key: string): Manifest | null {
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(xml, "text/xml");
  } catch {
    return null;
  }
  const mpd = doc.documentElement;
  if (!mpd || mpd.tagName !== "MPD") return null;
  const duration = parseDuration(mpd.getAttribute("mediaPresentationDuration"));
  const video: Rep[] = [];
  const audio: Rep[] = [];
  const sets = Array.from(doc.getElementsByTagName("AdaptationSet"));
  for (const set of sets) {
    const reps = Array.from(set.getElementsByTagName("Representation"));
    for (const r of reps) {
      const base = r.getElementsByTagName("BaseURL")[0];
      const sb = r.getElementsByTagName("SegmentBase")[0];
      if (!base || !sb) continue;
      const url = (base.textContent || "").trim();
      const indexRange = parseRange(sb.getAttribute("indexRange"));
      if (!url || !indexRange) continue;
      const init = sb.getElementsByTagName("Initialization")[0];
      const initRange = parseRange(init ? init.getAttribute("range") : null) ?? [
        0,
        indexRange[0] - 1,
      ];
      const mime = r.getAttribute("mimeType") || set.getAttribute("mimeType") || "";
      const codecs = r.getAttribute("codecs") || set.getAttribute("codecs") || "";
      const label = r.getAttribute("FBQualityLabel") || "";
      const rep: Rep = {
        id: r.getAttribute("id") || url,
        mime,
        codecs,
        label,
        height: labelHeight(label),
        bandwidth: parseInt(r.getAttribute("bandwidth") || "0", 10) || 0,
        url,
        path: pathOf(url),
        initRange,
        indexRange,
      };
      const isAudio =
        mime.startsWith("audio/") || set.getAttribute("contentType") === "audio";
      (isAudio ? audio : video).push(rep);
    }
  }
  if (video.length === 0) return null;
  video.sort((a, b) => a.height - b.height || a.bandwidth - b.bandwidth);
  audio.sort((a, b) => b.bandwidth - a.bandwidth);
  return { key, code, duration, video, audio };
}

function registerManifest(m: Manifest) {
  manifestsByKey.set(m.key, m);
  if (m.code) manifestsByCode.set(m.code, m);
  for (const r of m.video) manifestsByPath.set(r.path, m);
  for (const r of m.audio) manifestsByPath.set(r.path, m);
}

function walkForManifests(node: unknown, depth = 0) {
  if (!node || typeof node !== "object" || depth > 60) return;
  if (Array.isArray(node)) {
    for (const item of node) walkForManifests(item, depth + 1);
    return;
  }
  const obj = node as Record<string, unknown>;
  const xml = obj.video_dash_manifest;
  if (typeof xml === "string" && xml.length > 0) {
    const code = typeof obj.code === "string" ? obj.code : null;
    const pk =
      typeof obj.pk === "string" || typeof obj.pk === "number"
        ? String(obj.pk)
        : typeof obj.id === "string"
          ? obj.id
          : null;
    const key = pk ?? code ?? xml.slice(0, 200);
    if (!manifestsByKey.has(key)) {
      const m = parseManifest(xml, code, key);
      if (m) registerManifest(m);
    }
  }
  for (const k in obj) {
    if (k === "video_dash_manifest") continue;
    const v = obj[k];
    if (v && typeof v === "object") walkForManifests(v, depth + 1);
  }
}

function ingestText(text: string) {
  if (!text || text.indexOf("video_dash_manifest") === -1) return;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return;
  }
  walkForManifests(parsed);
  relinkAll();
}

const processedScripts = new WeakSet<Element>();
function scanScripts() {
  const scripts = document.querySelectorAll('script[type="application/json"]');
  for (const s of Array.from(scripts)) {
    if (processedScripts.has(s)) continue;
    const text = s.textContent || "";
    if (text.indexOf("video_dash_manifest") === -1) {
      if (document.readyState !== "loading") processedScripts.add(s);
      continue;
    }
    try {
      const parsed = JSON.parse(text);
      processedScripts.add(s);
      walkForManifests(parsed);
    } catch {}
  }
  relinkAll();
}

function isApiUrl(url: string): boolean {
  return /\/graphql|\/api\/v1\//.test(url);
}

function isMediaUrl(url: string): boolean {
  return /fbcdn\.net\/.*\.mp4/.test(url) || /\/o1\/v\//.test(url);
}

function installNetworkHooks() {
  const origFetch = window.fetch;
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
    let url = "";
    try {
      url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
    } catch {}
    const p = origFetch.call(this, input as RequestInfo, init);
    if (url && isApiUrl(url)) {
      p.then((res) => {
        try {
          res
            .clone()
            .text()
            .then(ingestText)
            .catch(() => {});
        } catch {}
      }).catch(() => {});
    } else if (url && isMediaUrl(url)) {
      return p.then((res) => tagResponse(res, url));
    }
    return p;
  };

  const origOpen = XMLHttpRequest.prototype.open as (...a: unknown[]) => void;
  XMLHttpRequest.prototype.open = function (
    this: XMLHttpRequest,
    method: string,
    url: string | URL,
    ...rest: unknown[]
  ) {
    const u = String(url);
    if (isApiUrl(u)) {
      this.addEventListener("load", () => {
        try {
          if (this.responseType === "" || this.responseType === "text") {
            ingestText(this.responseText);
          } else if (this.responseType === "json" && this.response) {
            walkForManifests(this.response);
            relinkAll();
          }
        } catch {}
      });
    } else if (isMediaUrl(u)) {
      this.addEventListener("load", () => {
        const r = this.response;
        if (r instanceof ArrayBuffer) bufferUrl.set(r, u);
      });
    }
    return origOpen.apply(this, [method, url, ...rest]);
  } as typeof XMLHttpRequest.prototype.open;
}

function tagResponse(res: Response, url: string): Response {
  try {
    const origAB = res.arrayBuffer.bind(res);
    res.arrayBuffer = () =>
      origAB().then((ab) => {
        bufferUrl.set(ab, url);
        return ab;
      });
    const bodyDesc = Object.getOwnPropertyDescriptor(Response.prototype, "body");
    if (bodyDesc && bodyDesc.get) {
      const getBody = bodyDesc.get;
      Object.defineProperty(res, "body", {
        configurable: true,
        get() {
          const body = getBody.call(this) as ReadableStream<Uint8Array> | null;
          if (!body) return body;
          const origGetReader = body.getReader.bind(body) as (
            o?: unknown,
          ) => ReadableStreamDefaultReader<Uint8Array>;
          body.getReader = ((opts?: { mode?: string }) => {
            const reader = origGetReader(opts);
            if (opts && opts.mode) return reader;
            const origRead = reader.read.bind(reader);
            reader.read = () =>
              origRead().then((r) => {
                if (r.value && r.value.buffer) bufferUrl.set(r.value.buffer, url);
                return r;
              });
            return reader;
          }) as typeof body.getReader;
          return body;
        },
      });
    }
  } catch {}
  return res;
}

let nativeSrcSetter: ((this: HTMLMediaElement, v: string) => void) | null = null;
function nativeSetSrc(video: HTMLVideoElement, value: string) {
  if (nativeSrcSetter) nativeSrcSetter.call(video, value);
  else video.setAttribute("src", value);
}

function findMsByBlob(blob: string): MediaSource | null {
  const ref = msByBlob.get(blob);
  return ref ? (ref.deref() ?? null) : null;
}

function installMediaHooks() {
  const origCreate = URL.createObjectURL;
  URL.createObjectURL = function (this: typeof URL, obj: Blob | MediaSource) {
    const url = origCreate.call(this, obj);
    if (typeof MediaSource !== "undefined" && obj instanceof MediaSource) {
      msToBlob.set(obj, url);
      msByBlob.set(url, new WeakRef(obj));
      if (msByBlob.size > 200) {
        const first = msByBlob.keys().next().value;
        if (first) msByBlob.delete(first);
      }
    }
    return url;
  } as typeof URL.createObjectURL;

  const origAdd = MediaSource.prototype.addSourceBuffer;
  MediaSource.prototype.addSourceBuffer = function (type: string) {
    const sb = origAdd.call(this, type);
    sbToMs.set(sb, this);
    return sb;
  };

  const origAppend = SourceBuffer.prototype.appendBuffer;
  SourceBuffer.prototype.appendBuffer = function (data: BufferSource) {
    const ms = sbToMs.get(this);
    if (ms && retiredMs.has(ms)) return;
    if (ms) {
      const buf =
        data instanceof ArrayBuffer ? data : (data as ArrayBufferView).buffer;
      const url = bufferUrl.get(buf);
      if (url) noteSegment(ms, url);
    }
    return origAppend.call(this, data);
  };

  const origRemove = SourceBuffer.prototype.remove;
  SourceBuffer.prototype.remove = function (start: number, end: number) {
    const ms = sbToMs.get(this);
    if (ms && retiredMs.has(ms)) return;
    return origRemove.call(this, start, end);
  };

  const origAbort = SourceBuffer.prototype.abort;
  SourceBuffer.prototype.abort = function () {
    const ms = sbToMs.get(this);
    if (ms && retiredMs.has(ms)) return;
    return origAbort.call(this);
  };

  const bufferedDesc = Object.getOwnPropertyDescriptor(SourceBuffer.prototype, "buffered");
  if (bufferedDesc && bufferedDesc.get) {
    const get = bufferedDesc.get;
    Object.defineProperty(SourceBuffer.prototype, "buffered", {
      configurable: true,
      get() {
        try {
          return get.call(this);
        } catch (e) {
          const ms = sbToMs.get(this);
          if (ms && retiredMs.has(ms)) return EMPTY_RANGES;
          throw e;
        }
      },
    });
  }

  const origEOS = MediaSource.prototype.endOfStream;
  MediaSource.prototype.endOfStream = function (err?: EndOfStreamError) {
    if (retiredMs.has(this)) return;
    return origEOS.call(this, err);
  };

  const durDesc = Object.getOwnPropertyDescriptor(MediaSource.prototype, "duration");
  if (durDesc && durDesc.set && durDesc.get) {
    const set = durDesc.set;
    const get = durDesc.get;
    Object.defineProperty(MediaSource.prototype, "duration", {
      configurable: true,
      get() {
        return get.call(this);
      },
      set(v: number) {
        if (retiredMs.has(this)) return;
        set.call(this, v);
      },
    });
  }

  const srcDesc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "src");
  if (srcDesc && srcDesc.set && srcDesc.get) {
    const set = srcDesc.set;
    const get = srcDesc.get;
    nativeSrcSetter = set as (this: HTMLMediaElement, v: string) => void;
    Object.defineProperty(HTMLMediaElement.prototype, "src", {
      configurable: true,
      get() {
        return get.call(this);
      },
      set(v: string) {
        onExternalSrcChange(this as HTMLMediaElement);
        set.call(this, v);
      },
    });
  }

  const origSetAttr = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (name: string, value: string) {
    if (name === "src" && this instanceof HTMLMediaElement) {
      onExternalSrcChange(this);
    }
    return origSetAttr.call(this, name, value);
  };

  const origRemoveAttr = Element.prototype.removeAttribute;
  Element.prototype.removeAttribute = function (name: string) {
    if (name === "src" && this instanceof HTMLMediaElement) {
      onExternalSrcChange(this);
    }
    return origRemoveAttr.call(this, name);
  };

  const origLoad = HTMLMediaElement.prototype.load;
  HTMLMediaElement.prototype.load = function () {
    onExternalSrcChange(this);
    return origLoad.call(this);
  };
}

type Listener = EventListenerOrEventListenerObject;
const wrappedListeners = new WeakMap<object, EventListener>();
const SILENCED_MS_EVENTS = new Set(["sourceclose", "sourceended"]);

function installMediaSourceEventGuards() {
  const origAdd = EventTarget.prototype.addEventListener;
  const origRemove = EventTarget.prototype.removeEventListener;
  MediaSource.prototype.addEventListener = function (
    type: string,
    listener: Listener | null,
    options?: boolean | AddEventListenerOptions,
  ) {
    if (!listener || !SILENCED_MS_EVENTS.has(type)) {
      return origAdd.call(this, type, listener, options);
    }
    const ms = this;
    let wrapped = wrappedListeners.get(listener);
    if (!wrapped) {
      wrapped = function (this: unknown, ev: Event) {
        if (retiredMs.has(ms)) return;
        if (typeof listener === "function") return listener.call(this, ev);
        return listener.handleEvent(ev);
      };
      wrappedListeners.set(listener, wrapped);
    }
    return origAdd.call(this, type, wrapped, options);
  };
  MediaSource.prototype.removeEventListener = function (
    type: string,
    listener: Listener | null,
    options?: boolean | EventListenerOptions,
  ) {
    const wrapped = listener ? wrappedListeners.get(listener) : undefined;
    return origRemove.call(this, type, wrapped ?? listener, options);
  };
  for (const name of SILENCED_MS_EVENTS) {
    const prop = `on${name}`;
    const desc = Object.getOwnPropertyDescriptor(MediaSource.prototype, prop);
    if (!desc || !desc.set || !desc.get) continue;
    const set = desc.set;
    const get = desc.get;
    Object.defineProperty(MediaSource.prototype, prop, {
      configurable: true,
      get() {
        return get.call(this);
      },
      set(fn: ((ev: Event) => void) | null) {
        if (typeof fn !== "function") {
          set.call(this, fn);
          return;
        }
        const ms = this as MediaSource;
        set.call(this, function (this: unknown, ev: Event) {
          if (retiredMs.has(ms)) return;
          return fn.call(this, ev);
        });
      },
    });
  }
}

const EMPTY_RANGES = {
  length: 0,
  start() {
    throw new DOMException("Index out of range", "IndexSizeError");
  },
  end() {
    throw new DOMException("Index out of range", "IndexSizeError");
  },
} as unknown as TimeRanges;

function onExternalSrcChange(el: HTMLMediaElement) {
  if (!(el instanceof HTMLVideoElement)) return;
  const player = players.get(el);
  if (player) player.destroy("replaced");
  queueMicrotask(() => emitState(el));
}

function noteSegment(ms: MediaSource, url: string) {
  const blob = msToBlob.get(ms);
  if (!blob) return;
  const path = pathOf(url);
  const m = manifestsByPath.get(path);
  if (!m) return;
  const rep = m.video.find((r) => r.path === path);
  if (rep) blobToPlayingRep.set(blob, rep);
  if (blobToManifest.get(blob) === m) return;
  blobToManifest.set(blob, m);
  for (const v of knownVideos) {
    if (v.src === blob) {
      emitState(v);
      maybeAutoApply(v);
    }
  }
}

function relinkAll() {
  for (const v of knownVideos) {
    if (!v.isConnected) {
      knownVideos.delete(v);
      continue;
    }
    if (!blobToManifest.has(v.src) && findManifest(v)) {
      emitState(v);
      maybeAutoApply(v);
    }
  }
}

function codeFromPath(path: string): string | null {
  const m = /\/(?:reels?|p|tv)\/([A-Za-z0-9_-]+)/.exec(path);
  return m ? m[1] : null;
}

const CODE_ANCHORS =
  'a[href*="/reel/"], a[href*="/reels/"], a[href*="/p/"], a[href*="/tv/"]';
const SCOPE_DEPTH = 14;

function codesNear(video: HTMLVideoElement): string[] {
  const codes: string[] = [];
  const seen = new Set<string>();
  const push = (href: string | null | undefined) => {
    const c = href ? codeFromPath(href) : null;
    if (c && !seen.has(c)) {
      seen.add(c);
      codes.push(c);
    }
  };
  let n: HTMLElement | null = video.parentElement;
  let depth = 0;
  while (n && n !== document.body && depth < SCOPE_DEPTH) {
    if (n instanceof HTMLAnchorElement) push(n.getAttribute("href"));
    for (const a of Array.from(n.querySelectorAll<HTMLAnchorElement>(CODE_ANCHORS))) {
      push(a.getAttribute("href"));
    }
    if (codes.length) break;
    if (n.tagName === "ARTICLE" || n.getAttribute("role") === "dialog") break;
    n = n.parentElement;
    depth++;
  }
  push(location.pathname);
  return codes;
}

function findManifest(video: HTMLVideoElement): Manifest | null {
  const src = video.src;
  const linked = blobToManifest.get(src);
  if (linked) return linked;
  if (src && !src.startsWith("blob:")) {
    const m = manifestsByPath.get(pathOf(src));
    if (m) return m;
  }
  for (const c of codesNear(video)) {
    const m = manifestsByCode.get(c);
    if (m) return m;
  }
  return null;
}

function optionsOf(m: Manifest): QualityOption[] {
  const seen = new Set<string>();
  const out: QualityOption[] = [];
  for (const r of m.video) {
    if (!r.label || seen.has(r.label)) continue;
    if (!MediaSource.isTypeSupported(`${r.mime}; codecs="${r.codecs}"`)) continue;
    seen.add(r.label);
    out.push({ label: r.label, height: r.height, bandwidth: r.bandwidth });
  }
  return limitQualityOptions(out);
}

function pickRep(m: Manifest, label: string): Rep | null {
  const supported = m.video.filter((r) =>
    MediaSource.isTypeSupported(`${r.mime}; codecs="${r.codecs}"`),
  );
  if (supported.length === 0) return null;
  const exact = supported.filter((r) => r.label === label);
  if (exact.length) return exact[exact.length - 1];
  const target = labelHeight(label);
  const below = supported.filter((r) => r.height <= target);
  if (below.length) return below[below.length - 1];
  return supported[0];
}

function stateOf(video: HTMLVideoElement): QualityState {
  const player = players.get(video);
  const m = player?.manifest ?? findManifest(video);
  const playing = blobToPlayingRep.get(video.src)?.label ?? null;
  if (!m) return { options: [], current: null, playing, status: "idle" };
  return {
    options: optionsOf(m),
    current: player ? player.videoRep.label : null,
    playing: player ? player.videoRep.label : playing,
    status: player ? player.status : "idle",
  };
}

function emitState(video: HTMLVideoElement) {
  const state = stateOf(video);
  video.dispatchEvent(
    new CustomEvent(QUALITY_STATE, { detail: JSON.stringify(state) }),
  );
}

function canTakeover(video: HTMLVideoElement): boolean {
  const now = Date.now();
  const log = (takeoverLog.get(video) || []).filter((t) => now - t < TAKEOVER_WINDOW);
  takeoverLog.set(video, log);
  return log.length < TAKEOVER_LIMIT;
}

function applyQuality(video: HTMLVideoElement, label: string) {
  const existing = players.get(video);
  if (label === AUTO_QUALITY) {
    desired.delete(video);
    emitState(video);
    return;
  }
  desired.set(video, label);
  takeover(video, label, existing);
}

function takeover(video: HTMLVideoElement, label: string, existing: Player | undefined) {
  const m = existing?.manifest ?? findManifest(video);
  if (!m) {
    emitState(video);
    return;
  }
  const rep = pickRep(m, label);
  if (!rep) {
    emitState(video);
    return;
  }
  if (existing && existing.videoRep === rep) {
    emitState(video);
    return;
  }
  if (!existing && !canTakeover(video)) {
    emitState(video);
    return;
  }
  if (existing) existing.destroy("switch");
  takeoverLog.set(video, [...(takeoverLog.get(video) || []), Date.now()]);
  const player = new Player(video, m, rep, m.audio[0] ?? null);
  players.set(video, player);
  player.start();
}

const autoPending = new WeakSet<HTMLVideoElement>();
function maybeAutoApply(video: HTMLVideoElement) {
  if (!desired.has(video) || players.has(video) || autoPending.has(video)) return;
  autoPending.add(video);
  const run = () => {
    window.setTimeout(() => {
      autoPending.delete(video);
      const label = desired.get(video);
      if (!label || players.has(video) || !video.isConnected) return;
      if (video.paused) {
        maybeAutoApply(video);
        return;
      }
      takeover(video, label, undefined);
    }, AUTO_APPLY_DELAY);
  };
  if (!video.paused) {
    run();
    return;
  }
  video.addEventListener("playing", run, { once: true });
}

function readSidx(buf: ArrayBuffer, sidxOffset: number): Segment[] {
  const dv = new DataView(buf);
  let pos = 0;
  while (pos + 8 <= dv.byteLength) {
    let size = dv.getUint32(pos);
    const type = String.fromCharCode(
      dv.getUint8(pos + 4),
      dv.getUint8(pos + 5),
      dv.getUint8(pos + 6),
      dv.getUint8(pos + 7),
    );
    let header = 8;
    if (size === 1) {
      size = Number(dv.getBigUint64(pos + 8));
      header = 16;
    } else if (size === 0) {
      size = dv.byteLength - pos;
    }
    if (type === "sidx") {
      const version = dv.getUint8(pos + header);
      let p = pos + header + 4;
      p += 4;
      const timescale = dv.getUint32(p);
      p += 4;
      let earliest: number;
      let firstOffset: number;
      if (version === 0) {
        earliest = dv.getUint32(p);
        firstOffset = dv.getUint32(p + 4);
        p += 8;
      } else {
        earliest = Number(dv.getBigUint64(p));
        firstOffset = Number(dv.getBigUint64(p + 8));
        p += 16;
      }
      p += 2;
      const count = dv.getUint16(p);
      p += 2;
      const segments: Segment[] = [];
      let time = earliest;
      let byte = sidxOffset + size + firstOffset;
      for (let i = 0; i < count; i++) {
        const refSize = dv.getUint32(p) & 0x7fffffff;
        const dur = dv.getUint32(p + 4);
        p += 12;
        segments.push({
          start: time / timescale,
          end: (time + dur) / timescale,
          byteStart: byte,
          byteEnd: byte + refSize - 1,
        });
        time += dur;
        byte += refSize;
      }
      return segments;
    }
    if (size <= 0) break;
    pos += size;
  }
  return [];
}

function rangeUrl(rep: Rep, start: number, end: number): string {
  const sep = rep.url.includes("?") ? "&" : "?";
  return `${rep.url}${sep}bytestart=${start}&byteend=${end}`;
}

class Track {
  sb: SourceBuffer | null = null;
  segments: Segment[] = [];
  init: ArrayBuffer | null = null;
  loading: AbortController | null = null;
  ready = false;
  done = false;
  failed = false;

  constructor(
    public rep: Rep,
    public kind: "video" | "audio",
  ) {}
}

class Player {
  status: QualityStatus = "loading";
  private ms: MediaSource | null = null;
  private blob = "";
  private tracks: Track[] = [];
  private timer: number | undefined;
  private destroyed = false;
  private resumeTime = 0;
  private resumePlaying = false;
  private resumeRate = 1;
  private metaReady = false;
  private listeners: Array<[EventTarget, string, EventListener, boolean]> = [];

  constructor(
    public video: HTMLVideoElement,
    public manifest: Manifest,
    public videoRep: Rep,
    public audioRep: Rep | null,
  ) {}

  private on(
    target: EventTarget,
    type: string,
    fn: EventListener,
    capture = false,
  ) {
    target.addEventListener(type, fn, capture);
    this.listeners.push([target, type, fn, capture]);
  }

  private silence(type: string) {
    this.on(
      this.video,
      type,
      (e) => {
        if (!this.destroyed) e.stopImmediatePropagation();
      },
      true,
    );
  }

  start() {
    const v = this.video;
    this.resumeTime = Number.isFinite(v.currentTime) ? v.currentTime : 0;
    this.resumePlaying = !v.paused && !v.ended;
    this.resumeRate = v.playbackRate || 1;

    const oldBlob = v.src;
    const oldMs = oldBlob ? findMsByBlob(oldBlob) : null;
    if (oldMs) retiredMs.add(oldMs);

    const ms = new MediaSource();
    this.ms = ms;
    this.blob = URL.createObjectURL(ms);
    this.tracks = [new Track(this.videoRep, "video")];
    if (this.audioRep) this.tracks.push(new Track(this.audioRep, "audio"));

    for (const type of SILENCED_VIDEO_EVENTS) this.silence(type);
    this.on(ms, "sourceopen", () => this.onSourceOpen());
    this.on(v, "seeking", () => this.onSeeking());
    this.on(v, "timeupdate", () => this.tick());
    this.on(v, "loadedmetadata", () => this.onMetadata());
    this.on(v, "error", () => this.fail());

    nativeSetSrc(v, this.blob);
    emitState(v);
    this.timer = window.setInterval(() => this.tick(), TICK_MS);
  }

  private async onSourceOpen() {
    const ms = this.ms;
    if (!ms || this.destroyed) return;
    try {
      if (this.manifest.duration > 0) ms.duration = this.manifest.duration;
    } catch {}
    for (const t of this.tracks) {
      try {
        const sb = ms.addSourceBuffer(`${t.rep.mime}; codecs="${t.rep.codecs}"`);
        t.sb = sb;
        this.on(sb, "updateend", () => this.tick());
        this.on(sb, "error", () => this.fail());
      } catch {
        this.fail();
        return;
      }
    }
    await Promise.all(this.tracks.map((t) => this.loadIndex(t)));
  }

  private async loadIndex(t: Track) {
    const end = Math.max(t.rep.indexRange[1], t.rep.initRange[1]);
    const ctrl = new AbortController();
    t.loading = ctrl;
    try {
      const res = await fetch(rangeUrl(t.rep, 0, end), {
        signal: ctrl.signal,
        credentials: "omit",
      });
      if (!res.ok) throw new Error(String(res.status));
      const buf = await res.arrayBuffer();
      if (this.destroyed) return;
      const [is, ie] = t.rep.initRange;
      t.init = buf.slice(is, ie + 1);
      const [xs, xe] = t.rep.indexRange;
      t.segments = readSidx(buf.slice(xs, xe + 1), xs);
      if (t.segments.length === 0) throw new Error("no sidx");
      t.loading = null;
      this.append(t, t.init);
      t.ready = true;
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      t.loading = null;
      this.fail();
    }
  }

  private onMetadata() {
    if (this.destroyed || this.metaReady) return;
    this.metaReady = true;
    const v = this.video;
    if (this.resumeTime > 0.2) {
      try {
        v.currentTime = this.resumeTime;
      } catch {}
    }
    v.playbackRate = this.resumeRate;
    if (this.resumePlaying) {
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    }
    this.status = "active";
    emitState(v);
    this.tick();
  }

  private onSeeking() {
    for (const t of this.tracks) {
      if (t.loading) {
        t.loading.abort();
        t.loading = null;
      }
      if (t.sb && t.sb.updating) {
        try {
          t.sb.abort();
        } catch {}
      }
      t.done = false;
    }
    this.tick();
  }

  private append(t: Track, data: ArrayBuffer): boolean {
    if (!t.sb || this.destroyed) return false;
    try {
      t.sb.appendBuffer(data);
      return true;
    } catch (e) {
      if ((e as DOMException).name === "QuotaExceededError") {
        this.evict(t, true);
        return false;
      }
      this.fail();
      return false;
    }
  }

  private evict(t: Track, aggressive = false) {
    const sb = t.sb;
    if (!sb || sb.updating) return;
    const ct = this.video.currentTime;
    const behind = aggressive ? 5 : BUFFER_BEHIND;
    try {
      const b = sb.buffered;
      if (b.length > 0 && b.start(0) < ct - behind - 5) {
        sb.remove(0, ct - behind);
      }
    } catch {}
  }

  private bufferedEnd(t: Track, ct: number): number {
    const sb = t.sb;
    if (!sb) return ct;
    try {
      const b = sb.buffered;
      for (let i = 0; i < b.length; i++) {
        if (b.start(i) <= ct + 0.25 && b.end(i) >= ct - 0.1) return b.end(i);
      }
    } catch {}
    return ct;
  }

  private tick() {
    if (this.destroyed || !this.ms || this.ms.readyState === "closed") return;
    if (!this.metaReady) return;
    const ct = this.video.currentTime;
    let allDone = true;
    for (const t of this.tracks) {
      if (!t.ready || t.failed) {
        allDone = false;
        continue;
      }
      if (t.loading || !t.sb || t.sb.updating) {
        allDone = false;
        continue;
      }
      const end = this.bufferedEnd(t, ct);
      const last = t.segments[t.segments.length - 1];
      if (end >= last.end - 0.15) {
        t.done = true;
        continue;
      }
      allDone = false;
      if (end - ct >= BUFFER_AHEAD) {
        this.evict(t);
        continue;
      }
      const target = Math.max(end, ct) + 0.05;
      const seg = t.segments.find((s) => s.end > target);
      if (!seg) {
        t.done = true;
        continue;
      }
      this.fetchSegment(t, seg);
    }
    if (allDone && this.tracks.every((t) => t.done)) {
      if (this.ms.readyState === "open") {
        try {
          this.ms.endOfStream();
        } catch {}
      }
    }
  }

  private async fetchSegment(t: Track, seg: Segment) {
    const ctrl = new AbortController();
    t.loading = ctrl;
    try {
      const res = await fetch(rangeUrl(t.rep, seg.byteStart, seg.byteEnd), {
        signal: ctrl.signal,
        credentials: "omit",
      });
      if (!res.ok) throw new Error(String(res.status));
      const buf = await res.arrayBuffer();
      if (this.destroyed || t.loading !== ctrl) return;
      t.loading = null;
      this.append(t, buf);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      t.loading = null;
      t.failed = true;
      this.fail();
    }
  }

  private fail() {
    if (this.destroyed) return;
    this.status = "error";
    emitState(this.video);
    this.destroy("error");
  }

  destroy(reason: string) {
    if (this.destroyed) return;
    this.destroyed = true;
    window.clearInterval(this.timer);
    for (const t of this.tracks) {
      if (t.loading) t.loading.abort();
    }
    for (const [target, type, fn, capture] of this.listeners) {
      target.removeEventListener(type, fn, capture);
    }
    this.listeners = [];
    if (players.get(this.video) === this) players.delete(this.video);
    if (this.blob) {
      try {
        URL.revokeObjectURL(this.blob);
      } catch {}
    }
    if (reason === "error") this.status = "error";
    if (reason !== "replaced") emitState(this.video);
  }
}

function installUiBridge() {
  document.addEventListener(
    QUALITY_QUERY,
    (e) => {
      const v = e.target;
      if (!(v instanceof HTMLVideoElement)) return;
      knownVideos.add(v);
      emitState(v);
      maybeAutoApply(v);
    },
    true,
  );
  document.addEventListener(
    QUALITY_SET,
    (e) => {
      const v = e.target;
      if (!(v instanceof HTMLVideoElement)) return;
      knownVideos.add(v);
      let payload: QualitySetPayload | null = null;
      try {
        payload = JSON.parse(String((e as CustomEvent).detail));
      } catch {}
      if (!payload || typeof payload.label !== "string") return;
      if (payload.auto) {
        if (payload.label === AUTO_QUALITY) desired.delete(v);
        else desired.set(v, payload.label);
        emitState(v);
        maybeAutoApply(v);
        return;
      }
      applyQuality(v, payload.label);
    },
    true,
  );
}

function installScriptObserver() {
  const schedule = (() => {
    let queued = false;
    return () => {
      if (queued) return;
      queued = true;
      setTimeout(() => {
        queued = false;
        scanScripts();
      }, 0);
    };
  })();
  const obs = new MutationObserver((records) => {
    for (const r of records) {
      for (const n of Array.from(r.addedNodes)) {
        if (n.nodeName === "SCRIPT") {
          schedule();
          return;
        }
      }
    }
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("DOMContentLoaded", scanScripts);
  window.addEventListener("load", scanScripts);
  schedule();
}

export default defineContentScript({
  matches: ["https://*.instagram.com/*"],
  world: "MAIN",
  runAt: "document_start",
  main() {
    if (typeof MediaSource === "undefined") return;
    installNetworkHooks();
    installMediaHooks();
    installMediaSourceEventGuards();
    installUiBridge();
    installScriptObserver();
  },
});
