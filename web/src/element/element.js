// The <simscope-player> custom element (vanilla DOM, shadow root): the lean
// player for decks and exported pages. It wraps one core `Player` and adds a
// control bar under the viewport: icon buttons, a thin scrubber, one readout,
// loop and speed (ui.js, shared with the compare master).
//
// Attributes: src (URL of a .simscope pack, or "#id" of an inline
// <script type="text/plain" id="..."> holding base64 pack bytes), run,
// autoplay, loop, speed, view (iso|front|side|top), background (CSS colour or
// "transparent"), collision, contacts (draw contact forces), nocontrols (or
// controls="none": no bar), env
// (which env to show and follow), follow (off|position|pose|heading), ground
// (checker|grid|none), theme (light|dark; absent: follow the system), sync
// (elements with the same name share one clock, for compare). Events: ready,
// timeupdate ({t, duration}), ended, error. The scrub bar draws no highlight
// marks; the highlights document stays readable through `player.highlights()`.
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
import { barHTML, barParts, bindBar, BAR_CSS, FONT, icon, TOKENS } from "./ui.js";

const FOLLOWS = ["off", "position", "pose", "heading"];
const GROUNDS = ["checker", "grid", "none"];
const MAX_LIVE = 8;

// A player that is a direct child of <body> is the whole page (a single-run
// export): it fills the window. In a slide or any other flow it keeps its 16:9.
const FILL = ":host { aspect-ratio: auto; height: 100vh; height: 100dvh; min-height: 0; }";

// Bare figures in <body> (the independent-players export): no default margins, a quiet caption.
const FIGURES_ID = "ss-figures-style";
const FIGURES = `body > figure:has(> simscope-player) { margin: 0; }
body > figure:has(> simscope-player) > figcaption { padding: 6px 12px; font: 12px/16px ${FONT}; color: #737373; }`;

const STYLE = `
:host { ${TOKENS.light} display: flex; flex-direction: column; position: relative; aspect-ratio: 16 / 9; min-height: 96px;
  overflow: hidden; background: var(--ss-viewport); color: var(--ss-fg); font: 12px/16px ${FONT}; }
:host([theme="dark"]) { ${TOKENS.dark} }
@media (prefers-color-scheme: dark) { :host(:not([theme="light"])) { ${TOKENS.dark} } }
:host([hidden]) { display: none; }
.stage { position: relative; flex: 1; min-height: 0; }
canvas, img.poster { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
canvas { touch-action: none; }
img.poster { object-fit: contain; }
.msg { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  padding: 12px; text-align: center; color: #b3261e; pointer-events: none; }
.msg[hidden] { display: none; }
:host([nocontrols]) .ss-bar, :host([controls="none"]) .ss-bar, :host([sync]) .ss-bar { display: none; }
${BAR_CSS}
`;

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

export class SimscopePlayerElement extends HTMLElement {
  static get observedAttributes() {
    return ["src", "run", "loop", "speed", "view", "background", "collision", "contacts", "env", "follow", "ground", "theme", "sync"];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${STYLE}</style>
      <div class="stage"><canvas part="canvas"></canvas><div class="msg" hidden></div></div>
      <div class="ss-bar" part="controls">${barHTML(`<button type="button" class="ss-btn ss-col" aria-label="Collision geometry" title="Collision geometry" aria-pressed="false" hidden>${icon("box")}</button>`)}</div>`;
    const $ = (sel) => root.querySelector(sel);
    const parts = barParts($(".ss-bar"));
    this._ui = { stage: $(".stage"), canvas: $("canvas"), msg: $(".msg"), bar: $(".ss-bar"), col: $(".ss-col"), contacts: parts.contacts };
    this._view = null; // the camera preset in use; null once the user orbits
    this._bar = bindBar(parts, {
      stepDt: () => (this._info ? this._info.dt : 0.02),
      onLoop: (on) => this.toggleAttribute("loop", on),
      outside: document,
      camera: {
        view: () => this._view,
        setView: (name) => this.setView(name),
        frame: () => this._player && this._player.frame("focus"),
        follow: () => (this._player ? this._player.follow().mode : "off"),
        setFollow: (mode) => {
          // The player first: the attribute alone does nothing when it already holds this mode.
          if (this._player) this._player.setFollow({ mode });
          this.setAttribute("follow", mode);
        },
      },
      contacts: { on: () => this.hasAttribute("contacts"), set: (on) => this.toggleAttribute("contacts", on) },
    });
    this._player = null;
    this._clock = null;
    this._loading = null;
    this._loaded = false;
    this._visible = false;
    this._autoplayDone = false;
    this._failed = false;
    this._poster = null;
    this._info = null;

    this._ui.col.addEventListener("click", () => this.toggleAttribute("collision"));
    this._onTime = () => this._time();
    this._onEnded = () => this._emit("ended");
  }

  // ---- lifecycle ----

  connectedCallback() {
    if (this.parentElement === document.body) {
      this._fill ??= Object.assign(document.createElement("style"), { textContent: FILL });
      this.shadowRoot.appendChild(this._fill);
    } else if (this._fill) this._fill.remove();
    const fig = this.parentElement;
    if (fig && fig.tagName === "FIGURE" && fig.parentElement === document.body && !document.getElementById(FIGURES_ID)) {
      document.head.appendChild(Object.assign(document.createElement("style"), { id: FIGURES_ID, textContent: FIGURES }));
    }
    this._ensurePlayer();
    this._resize = new ResizeObserver(() => this._measure());
    this._resize.observe(this._ui.stage);
    // No `theme` attribute: follow the system, live.
    this._mq = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;
    this._onScheme = () => this._player && !this.hasAttribute("theme") && this._player.setTheme(this._theme(), this._background());
    if (this._mq) this._mq.addEventListener("change", this._onScheme);
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
    if (this._mq) this._mq.removeEventListener("change", this._onScheme);
    this._visible = false;
    this._dropLive();
    if (this._player) {
      this._unbindClock();
      this._bar.setClock(null);
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
    else if (name === "contacts") this._applyRoles();
    else if (name === "background") p.setBackground(this._background());
    else if (name === "collision") this._applyRoles();
    else if (name === "env") this._applyEnv();
    else if (name === "follow") {
      this._applyFollow();
      this._bar.paint();
    }
    else if (name === "ground") p.setGround(this._ground());
    else if (name === "theme") p.setTheme(this._theme(), this._background());
    else if (name === "sync") this._rebindClock();
  }

  _background() {
    const b = this.getAttribute("background");
    return b === null || b === "" ? undefined : b;
  }

  _theme() {
    const t = this.getAttribute("theme");
    if (t === "dark" || t === "light") return t;
    return typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  _ground() {
    const g = this.getAttribute("ground");
    return GROUNDS.includes(g) ? g : "checker";
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
      });
    } catch (err) {
      this._fail(new Error(`simscope: WebGL is not available (${err.message})`));
      return;
    }
    this._player = p;
    this._view = VIEWS.includes(view) ? view : "iso";
    this._clock = p.clock;
    this._clock.loop = this.hasAttribute("loop") || this._clock.loop;
    const speed = Number(this.getAttribute("speed"));
    if (speed > 0) this._clock.speed = speed;
    this._bindClock();
    p.addEventListener("error", (e) => this._fail(new Error(e.detail.message)));
    p.addEventListener("live", () => this._buildUi(this._info));
    // An orbit leaves the preset behind (the menu then shows none); a follow can change by itself.
    p.addEventListener("camera", () => {
      if (this._view !== null) {
        this._view = null;
        this._bar.paint();
      }
    });
    p.addEventListener("follow", () => this._bar.paint());
    this._bar.setClock(this._clock);
    this._measure();
  }

  _bindClock() {
    this._clock.addEventListener("time", this._onTime);
    this._clock.addEventListener("ended", this._onEnded);
  }

  _unbindClock() {
    if (!this._clock) return;
    this._clock.removeEventListener("time", this._onTime);
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
    const r = this._ui.stage.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) this._player.resize(r.width, r.height, Math.min(window.devicePixelRatio || 1, 2));
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
        this._ui.stage.insertBefore(this._poster, this._ui.msg);
      })
      .catch(() => {});
  }

  unload(keepFrame = false) {
    this._loading = null;
    this._loaded = false;
    this._failed = false;
    this._autoplayDone = false;
    this._info = null;
    this._dropLive();
    if (this._player) {
      this._player.unload({ keepFrame });
    }
    if (this._poster) {
      URL.revokeObjectURL(this._poster.src);
      this._poster.remove();
      this._poster = null;
    }
    this._ui.col.hidden = true;
    this._ui.contacts.hidden = true;
    this._bar.paint();
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
    this._ui.col.hidden = !info.hasCollision;
    this._ui.contacts.hidden = !info.hasContacts;
    this._time();
    this._bar.paint();
  }

  _time() {
    const c = this._clock;
    if (!c) return;
    this._emit("timeupdate", { t: c.time, duration: c.duration });
  }

  _applyRoles() {
    if (!this._player) return;
    const on = this.hasAttribute("collision");
    this._player.setCollision(on);
    this._ui.col.setAttribute("aria-pressed", String(on));
    this._player.setContacts(this.hasAttribute("contacts"));
    this._bar.paint();
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

  /**
   * Autoplay once the run's extent is known: the player frames the whole
   * motion, not frame 0, but never while the clock runs, so a run that started
   * playing at once would stay in its frame-0 view.
   */
  async _maybeAutoplay() {
    if (this._autoplayDone || !this.hasAttribute("autoplay") || !this._visible || !this._loaded) return;
    this._autoplayDone = true;
    const player = this._player;
    try {
      await (player && player._extentJob);
    } catch {
      // framing is a nicety
    }
    if (this._player === player && this._loaded) this.play();
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
    if (this._clock) this._clock.speed = x;
  }

  /** Switch camera view: iso, front, side or top. */
  setView(name) {
    if (!this._player || !VIEWS.includes(name)) return;
    this._player.setView(name);
    this._view = name;
    this._bar.paint();
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
