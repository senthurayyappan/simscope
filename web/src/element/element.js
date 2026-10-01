// The <simscope-player> custom element (vanilla DOM, shadow root): the lean
// player for decks and exported pages. It wraps one core `Player` and adds a
// small control bar.
//
// Attributes: src (URL of a .simscope pack, or "#id" of an inline
// <script type="text/plain" id="..."> holding base64 pack bytes), run,
// autoplay, loop, speed, view (iso|front|side|top), background (CSS colour or
// "transparent"), collision, nocontrols, and the v3 additions env (which env
// to show and follow), follow (off|position|pose|heading), ground
// (checker|grid|none), theme (light|dark), sync (elements with the same name
// share one clock, for compare), color (a CSS colour: the compare slot, which
// colours this player's highlight markers). Events: ready, timeupdate ({t,
// duration}), ended, error.
//
// A pack in `src="#id"` form never touches the network, so it works from
// file:// pages. Loading starts when the element first becomes visible, so a
// deck with many players decodes only what is on screen (call load() to force
// it). At most MAX_LIVE players keep a run loaded: one that scrolled away is
// unloaded when a ninth needs room, and its last frame stays on its canvas.

import { VIEWS } from "../core/camera.js";
import { clockFor } from "../core/clock.js";
import * as fmt from "../core/format.js";
import { Player } from "../core/player.js";
import { PackSource } from "../core/source.js";
import { layoutMarks } from "./marks.js";

const SPEEDS = [0.25, 0.5, 1, 2, 4];
const FOLLOWS = ["off", "position", "pose", "heading"];
const GROUNDS = ["checker", "grid", "none"];
const MAX_LIVE = 8;

const STYLE = `
:host { display: block; position: relative; aspect-ratio: 16 / 9; min-height: 96px;
  overflow: hidden; background: #f5f5f5; color: #0a0a0a; font: 12px/1.2 system-ui, sans-serif;
  --simscope-accent: #3b6ea5; --ss-bar: rgba(255, 255, 255, 0.86); --ss-line: rgba(0, 0, 0, 0.16);
  --ss-mark: #d1495b; --ss-hl: #2c7a7b; }
:host([theme="dark"]) { background: #121212; color: #fafafa; --simscope-accent: #6ea8e0;
  --ss-bar: rgba(18, 18, 18, 0.86); --ss-line: rgba(255, 255, 255, 0.22); --ss-hl: #5fc2c4; }
:host([hidden]) { display: none; }
canvas, img.poster { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
canvas { touch-action: none; }
img.poster { object-fit: contain; }
.msg { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  padding: 12px; text-align: center; color: #b3261e; pointer-events: none; }
.msg[hidden] { display: none; }
.bar { position: absolute; left: 0; right: 0; bottom: 0; display: flex; align-items: center; gap: 8px;
  padding: 4px 8px; background: var(--ss-bar); backdrop-filter: blur(6px); }
:host([nocontrols]) .bar { display: none; }
button, select { font: inherit; color: inherit; background: transparent; border: 1px solid var(--ss-line);
  border-radius: 6px; padding: 2px 6px; cursor: pointer; }
button.play { width: 28px; height: 24px; padding: 0; display: grid; place-items: center; }
button.on { background: var(--simscope-accent); color: #fff; border-color: transparent; }
button[hidden], select[hidden] { display: none; }
.track { position: relative; flex: 1; min-width: 40px; height: 26px; }
.marks { position: absolute; left: 0; right: 0; top: 1px; height: 8px; }
.marks i { position: absolute; top: 0; height: 6px; min-width: 3px; background: var(--ss-mark); border-radius: 1px;
  opacity: 0.85; cursor: pointer; }
.marks b { position: absolute; top: 0; width: 2px; height: 8px; margin-left: -1px; border-radius: 1px;
  background: var(--ss-hl); cursor: pointer; }
.marks b::before { content: ""; position: absolute; inset: 0 -4px; }
.marks u { position: absolute; top: 2px; height: 4px; min-width: 3px; border-radius: 2px; background: var(--ss-hl);
  opacity: 0.55; text-decoration: none; cursor: pointer; }
input.scrub { position: absolute; left: 0; right: 0; bottom: 0; width: 100%; height: 16px; margin: 0;
  accent-color: var(--simscope-accent); }
.time { font-variant-numeric: tabular-nums; white-space: nowrap; }
`;

const ICON_PLAY = '<svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 1l9 5-9 5z" fill="currentColor"/></svg>';
const ICON_PAUSE = '<svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 1h3v10H2zM7 1h3v10H7z" fill="currentColor"/></svg>';

/** Decode base64 bytes: Uint8Array.fromBase64 when available, else atob. */
export function decodeBase64(text) {
  if (typeof Uint8Array.fromBase64 === "function") return Uint8Array.fromBase64(text);
  const bin = atob(text);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Inline packs (`src="#id"`) are decoded once per page: every element that
// names the same <script> shares one parsed pack (entries are read-only views).
const INLINE_PACKS = new WeakMap();

// Elements that hold a loaded run, least recently shown first.
const LIVE = [];

const seconds = (t) => `${t.toFixed(2)}s`;

export class SimscopePlayerElement extends HTMLElement {
  static get observedAttributes() {
    return ["src", "run", "loop", "speed", "view", "background", "collision", "env", "follow", "ground", "theme", "sync", "color"];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${STYLE}</style>
      <canvas part="canvas"></canvas>
      <div class="msg" hidden></div>
      <div class="bar" part="controls">
        <button class="play" aria-label="Play" disabled>${ICON_PLAY}</button>
        <div class="track"><div class="marks"></div>
          <input class="scrub" type="range" min="0" max="1000" value="0" step="1" aria-label="Seek" disabled></div>
        <span class="time">0.00s / 0.00s</span>
        <select class="speed" aria-label="Speed">${SPEEDS.map((s) => `<option value="${s}"${s === 1 ? " selected" : ""}>${s}x</option>`).join("")}</select>
        <button class="col" hidden aria-pressed="false">collision</button>
      </div>`;
    const $ = (sel) => root.querySelector(sel);
    this._ui = {
      canvas: $("canvas"),
      msg: $(".msg"),
      play: $(".play"),
      scrub: $(".scrub"),
      marks: $(".marks"),
      time: $(".time"),
      speed: $(".speed"),
      col: $(".col"),
    };
    this._player = null;
    this._clock = null;
    this._loading = null;
    this._loaded = false;
    this._visible = false;
    this._scrubbing = false;
    this._autoplayDone = false;
    this._failed = false;
    this._poster = null;
    this._info = null;

    const ui = this._ui;
    ui.play.addEventListener("click", () => (this._clock && this._clock.playing ? this.pause() : this.play()));
    ui.scrub.addEventListener("pointerdown", () => (this._scrubbing = true));
    ui.scrub.addEventListener("input", () => this.seek((ui.scrub.value / 1000) * this._clock.duration));
    const endScrub = () => (this._scrubbing = false);
    ui.scrub.addEventListener("pointerup", endScrub);
    ui.scrub.addEventListener("pointercancel", endScrub);
    ui.speed.addEventListener("change", () => this.setSpeed(Number(ui.speed.value)));
    ui.col.addEventListener("click", () => this.toggleAttribute("collision"));
    this._onTime = () => this._time();
    this._onState = () => this._syncPlay();
    this._onEnded = () => this._emit("ended");
  }

  // ---- lifecycle ----

  connectedCallback() {
    this._ensurePlayer();
    this._resize = new ResizeObserver(() => this._measure());
    this._resize.observe(this);
    this._seen = new IntersectionObserver(
      (entries) => {
        const on = entries[entries.length - 1].isIntersecting;
        this._setVisible(on);
      },
      { rootMargin: "64px" },
    );
    this._seen.observe(this);
    this._measure();
  }

  disconnectedCallback() {
    this._resize.disconnect();
    this._seen.disconnect();
    this._visible = false;
    this._dropLive();
    if (this._player) {
      this._unbindClock();
      this._player.destroy();
      this._player = null;
      this._clock = null;
      this._loaded = false;
      this._loading = null;
    }
  }

  attributeChangedCallback(name, old, value) {
    const p = this._player;
    if (name === "src" || name === "run") {
      if (this.isConnected && (this._loaded || this._loading) && old !== value) {
        this.unload();
        if (this._visible) this.load().catch(() => {});
      }
    } else if (!p) {
      // applied when the player is created
    } else if (name === "loop") this._clock.loop = this.hasAttribute("loop");
    else if (name === "speed") this.setSpeed(Number(value));
    else if (name === "view") this.setView(value);
    else if (name === "background") p.setBackground(this._background());
    else if (name === "collision") this._applyRoles();
    else if (name === "env") this._applyEnv();
    else if (name === "follow") this._applyFollow();
    else if (name === "ground") p.setGround(this._ground());
    else if (name === "theme") p.setTheme(this._theme(), this._background());
    else if (name === "sync") this._rebindClock();
    else if (name === "color") p.setColor(this._color());
  }

  _background() {
    const b = this.getAttribute("background");
    return b === null || b === "" ? undefined : b;
  }

  _theme() {
    return this.getAttribute("theme") === "dark" ? "dark" : "light";
  }

  _ground() {
    const g = this.getAttribute("ground");
    return GROUNDS.includes(g) ? g : "checker";
  }

  _color() {
    return this.getAttribute("color") || undefined;
  }

  _followMode() {
    const f = this.getAttribute("follow");
    if (f === null) return undefined; // the player's default: position for one env, else off
    if (f === "" || f === "true") return "position";
    return FOLLOWS.includes(f) ? f : "off";
  }

  _env() {
    const n = Number(this.getAttribute("env"));
    return Number.isInteger(n) && n >= 0 ? n : 0;
  }

  _ensurePlayer() {
    if (this._player) return;
    const view = this.getAttribute("view");
    this._clock = this.hasAttribute("sync") ? clockFor(this.getAttribute("sync")) : null;
    let p;
    try {
      p = new Player(this._ui.canvas, {
        clock: this._clock || undefined,
        theme: this._theme(),
        ground: this._ground(),
        view: VIEWS.includes(view) ? view : "iso",
        background: this._background(),
        follow: this._followMode(),
        color: this._color(),
      });
    } catch (err) {
      this._fail(new Error(`simscope: WebGL is not available (${err.message})`));
      return;
    }
    this._player = p;
    this._clock = p.clock;
    this._clock.loop = this.hasAttribute("loop") || this._clock.loop;
    const speed = Number(this.getAttribute("speed"));
    if (speed > 0) this._clock.speed = speed;
    this._bindClock();
    p.addEventListener("error", (e) => this._fail(new Error(e.detail.message)));
    p.addEventListener("live", () => this._buildUi(this._info));
    p.addEventListener("color", () => this._paintColor());
    this._paintColor();
    this._syncSpeedUi(this._clock.speed);
    this._measure();
  }

  _bindClock() {
    this._clock.addEventListener("time", this._onTime);
    this._clock.addEventListener("state", this._onState);
    this._clock.addEventListener("ended", this._onEnded);
  }

  _unbindClock() {
    if (!this._clock) return;
    this._clock.removeEventListener("time", this._onTime);
    this._clock.removeEventListener("state", this._onState);
    this._clock.removeEventListener("ended", this._onEnded);
  }

  /** Move to another clock (the `sync` attribute changed). */
  _rebindClock() {
    if (!this._player) return;
    // A player's clock is fixed at construction; rebuild the player.
    const wasLoaded = this._loaded || !!this._loading;
    this.unload();
    this._unbindClock();
    this._player.destroy();
    this._player = null;
    this._ensurePlayer();
    if (wasLoaded && this._visible) this.load().catch(() => {});
  }

  _measure() {
    if (!this._player) return;
    const r = this.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) this._player.resize(r.width, r.height, Math.min(window.devicePixelRatio || 1, 2));
    this._placeMarks();
  }

  _setVisible(on) {
    this._visible = on;
    if (!this._player) return;
    if (on) {
      this._touchLive();
      if (!this._loaded && !this._loading && !this._failed && this.getAttribute("src")) this.load().catch(() => {});
      else if (this._loaded) this._maybeAutoplay();
    }
  }

  // ---- live players ----

  _touchLive() {
    const at = LIVE.indexOf(this);
    if (at >= 0) LIVE.splice(at, 1);
    LIVE.push(this);
  }

  _dropLive() {
    const at = LIVE.indexOf(this);
    if (at >= 0) LIVE.splice(at, 1);
  }

  /** Keep at most MAX_LIVE runs loaded: unload the oldest one that is off screen. */
  static _evict() {
    while (LIVE.length > MAX_LIVE) {
      const at = LIVE.findIndex((el) => !el._visible);
      if (at < 0) return;
      const [el] = LIVE.splice(at, 1);
      el.unload(true);
    }
  }

  // ---- loading ----

  /** Load the pack named by `src`. Resolves once the run is ready to play. */
  load() {
    if (this._loading) return this._loading;
    this._ensurePlayer();
    if (!this._player) return this._loadPosterOnly();
    this._failed = false;
    const job = this._load().catch((err) => {
      this._failed = true;
      this._fail(err);
      throw err;
    });
    this._loading = job;
    const clear = () => {
      if (this._loading === job) this._loading = null;
    };
    job.then(clear, clear);
    return job;
  }

  /** Without WebGL: show the pack's poster frame if it has one, then report the failure. */
  async _loadPosterOnly() {
    const src = this.getAttribute("src");
    const fail = new Error("simscope: WebGL is not available");
    if (src) {
      try {
        const source = await this._openSource(src);
        const run = this.getAttribute("run") || (await source.runs())[0];
        this._showPoster(source, run);
      } catch {
        // No pack, no poster: the WebGL message stands.
      }
    }
    return Promise.reject(fail);
  }

  async _load() {
    const src = this.getAttribute("src");
    if (!src) throw new Error("simscope: <simscope-player> has no src attribute");
    this._ui.msg.hidden = true;
    const source = await this._openSource(src);
    this._touchLive();
    SimscopePlayerElement._evict();
    const env = this._env();
    const info = await this._player.load(source, this.getAttribute("run") || undefined, { envs: env ? [env] : undefined });
    this._loaded = true;
    this._info = info;
    this._source = source;
    this._showPoster(source, info.run);
    this._buildUi(info);
    this._applyRoles();
    this._applyFollow();
    this._clock.loop = this.hasAttribute("loop") || this._clock.loop;
    this._emit("ready", { duration: info.duration, frames: info.frames, dt: info.dt, run: info.run, events: info.events });
    this._loadHighlights(info.run);
    this._maybeAutoplay();
    return info;
  }

  /** Resolve `src` to a pack source; inline packs are shared between elements. */
  async _openSource(src) {
    if (!src.startsWith("#")) return PackSource.open(await this._fetchBytes(src));
    const id = src.slice(1);
    const node = this.getRootNode().getElementById?.(id) ?? document.getElementById(id);
    if (!node) throw new Error(`simscope: no element with id "${id}" for src="${src}"`);
    let job = INLINE_PACKS.get(node);
    if (!job) {
      job = PackSource.open(decodeBase64(node.textContent.trim()));
      INLINE_PACKS.set(node, job);
      job.catch(() => INLINE_PACKS.delete(node));
    }
    return job;
  }

  async _fetchBytes(src) {
    let res;
    try {
      res = await fetch(src);
    } catch (err) {
      throw new Error(`simscope: could not fetch ${src} (${err.message}); file:// pages must use src="#id"`);
    }
    if (!res.ok) throw new Error(`simscope: fetching ${src} failed with HTTP ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  }

  /** Highlight markers from derived/<run>/highlights.json, when the pack carries it. */
  async _loadHighlights(run) {
    try {
      const doc = await this._player.highlights();
      if (!doc || this._info?.run !== run) return;
      const env = this._player.follow().env;
      this._highlights = (doc.highlights || []).filter((h) => h.env === env).sort((a, b) => a.t - b.t);
      this._placeMarks();
    } catch {
      // Markers are a nicety; a bad file must not break playback.
    }
  }

  /** Without WebGL, fall back to the pack's poster frame if it carries one. */
  _showPoster(source, run) {
    if (this._player || this._poster || !run) return;
    source
      .get(`runs/${run}/poster.png`)
      .then((bytes) => {
        if (this._poster) return;
        this._poster = document.createElement("img");
        this._poster.className = "poster";
        this._poster.alt = "";
        this._poster.src = URL.createObjectURL(new Blob([bytes], { type: "image/png" }));
        this.shadowRoot.insertBefore(this._poster, this._ui.msg);
      })
      .catch(() => {});
  }

  unload(keepFrame = false) {
    this._loading = null;
    this._loaded = false;
    this._failed = false;
    this._autoplayDone = false;
    this._info = null;
    this._highlights = [];
    this._dropLive();
    if (this._player) {
      this._player.unload({ keepFrame });
    }
    if (this._poster) {
      URL.revokeObjectURL(this._poster.src);
      this._poster.remove();
      this._poster = null;
    }
    const ui = this._ui;
    ui.marks.textContent = "";
    ui.scrub.disabled = ui.play.disabled = true;
    ui.scrub.value = 0;
    ui.col.hidden = true;
    ui.time.textContent = `${seconds(0)} / ${seconds(0)}`;
    this._syncPlay();
  }

  _fail(err) {
    this._ui.msg.textContent = err.message;
    this._ui.msg.hidden = false;
    this._emit("error", { message: err.message });
  }

  _emit(type, detail = {}) {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }

  // ---- UI ----

  _buildUi(info) {
    if (!info) return;
    const ui = this._ui;
    ui.play.disabled = ui.scrub.disabled = false;
    ui.col.hidden = !info.hasCollision;
    this._events = info.events || [];
    this._placeMarks();
    this._time();
    this._syncPlay();
  }

  /** The player's slot colour, if it has one, colours the highlight markers. */
  _paintColor() {
    const color = this._player ? this._player.color : null;
    if (color) this._ui.marks.style.setProperty("--ss-hl", color);
    else this._ui.marks.style.removeProperty("--ss-hl");
  }

  /**
   * Annotation events and jump spans as bars, highlight moments as ticks, in
   * percent of the duration (see marks.js for the layout).
   */
  _placeMarks() {
    const ui = this._ui;
    ui.marks.textContent = "";
    const d = this._clock ? this._clock.duration : 0;
    if (!(d > 0) || !this._info) return;
    for (const ev of this._events || []) {
      const m = document.createElement("i");
      m.style.left = `${Math.min(100, (ev.t0 / d) * 100)}%`;
      m.style.width = `${Math.max(0, ((ev.t1 - ev.t0) / d) * 100)}%`;
      m.title = ev.label;
      m.addEventListener("click", () => this.seek(ev.t0));
      ui.marks.appendChild(m);
    }
    const width = ui.marks.getBoundingClientRect().width || 300;
    const { spans, ticks } = layoutMarks(this._highlights || [], d, width);
    for (const sp of spans) {
      const node = document.createElement("u");
      node.style.left = `${sp.left}%`;
      node.style.width = `${sp.width}%`;
      node.title = sp.title;
      node.addEventListener("click", () => this.seek(sp.t));
      ui.marks.appendChild(node);
    }
    for (const tk of ticks) {
      const node = document.createElement("b");
      node.style.left = `${tk.left}%`;
      node.title = tk.title;
      node.addEventListener("click", () => this.seek(tk.t));
      ui.marks.appendChild(node);
    }
  }

  _time() {
    const ui = this._ui;
    const c = this._clock;
    if (!c) return;
    const t = c.time, duration = c.duration;
    ui.time.textContent = `${seconds(t)} / ${seconds(duration)}`;
    if (!this._scrubbing) ui.scrub.value = duration > 0 ? Math.round((t / duration) * 1000) : 0;
    this._emit("timeupdate", { t, duration });
  }

  _syncPlay() {
    const playing = !!this._clock && this._clock.playing;
    this._ui.play.innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
    this._ui.play.setAttribute("aria-label", playing ? "Pause" : "Play");
  }

  _syncSpeedUi(x) {
    const sel = this._ui.speed;
    if (![...sel.options].some((o) => Number(o.value) === x)) {
      const opt = new Option(`${x}x`, String(x));
      const at = [...sel.options].findIndex((o) => Number(o.value) > x);
      sel.add(opt, at < 0 ? null : sel.options[at]);
    }
    sel.value = String(x);
  }

  _applyRoles() {
    if (!this._player) return;
    const on = this.hasAttribute("collision");
    this._player.setCollision(on);
    this._ui.col.classList.toggle("on", on);
    this._ui.col.setAttribute("aria-pressed", String(on));
  }

  _applyEnv() {
    if (!this._player || !this._loaded) return;
    this._player.selectEnv(this._env());
    if (this._info) this._loadHighlights(this._info.run);
  }

  _applyFollow() {
    if (!this._player) return;
    const mode = this._followMode();
    if (mode !== undefined) this._player.setFollow({ mode });
  }

  _maybeAutoplay() {
    if (this._autoplayDone || !this.hasAttribute("autoplay") || !this._visible || !this._loaded) return;
    this._autoplayDone = true;
    this.play();
  }

  // ---- public API ----

  /** Play from the current time (from the start if the run had ended). */
  play() {
    if (this._clock) this._clock.play();
  }

  pause() {
    if (this._clock) this._clock.pause();
  }

  /** Jump to time `t` in seconds. */
  seek(t) {
    if (this._clock) this._clock.seek(t);
  }

  setSpeed(x) {
    if (!this._clock) return;
    this._clock.speed = x;
    this._syncSpeedUi(this._clock.speed);
  }

  /** Switch camera view: iso, front, side or top. */
  setView(name) {
    if (this._player && VIEWS.includes(name)) this._player.setView(name);
  }

  /** The core player, for callers that need more than the element API (camera state, series). */
  get player() {
    return this._player;
  }

  /** The clock this element plays on (shared when `sync` is set). */
  get clock() {
    return this._clock;
  }

  /** Resolves with a PNG Blob of the current frame. */
  async snapshot() {
    if (!this._player) throw new Error("simscope: nothing to snapshot (not loaded or no WebGL)");
    return this._player.snapshot();
  }

  get currentTime() {
    return this._clock ? this._clock.time : 0;
  }

  get duration() {
    return this._clock ? this._clock.duration : 0;
  }

  get playing() {
    return !!this._clock && this._clock.playing;
  }
}

export function register(name = "simscope-player") {
  if (!customElements.get(name)) customElements.define(name, SimscopePlayerElement);
}

// Kept for callers that parse packs themselves.
export { fmt };
