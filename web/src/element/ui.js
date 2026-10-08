// The control bar, shared by the single <simscope-player> and the compare
// master (master.js): the same markup, styles, icons and behaviour, in the
// visual language of the app: neutral colours,
// hairlines, 28 px controls with 6 px radius, icon buttons, a thin scrubber
// and one readout in tabular figures. System font (the lean build carries no
// font). Light and dark follow `prefers-color-scheme`.
//
// The bar works on a plain node tree it is given (`barParts`) and talks to a
// `Clock`, so the behaviour is tested in Node with stand-in nodes.

import { oklchHex } from "../core/theme.js";

// ---- icons: lucide (ISC), 24 x 24, stroke 2 ----

const ICONS = {
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  pause: '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
  back: '<polygon points="19 20 9 12 19 4 19 20"/><line x1="5" x2="5" y1="19" y2="5"/>',
  forward: '<polygon points="5 4 15 12 5 20 5 4"/><line x1="19" x2="19" y1="5" y2="19"/>',
  repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  box: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  video: '<path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
  contact: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="1"/>',
};

/** Markup of a 16 px lucide icon (stroke follows the text colour). */
export function icon(name) {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
}

// ---- tokens: shadcn neutral, as the app's (C1, C5) ----

const L = oklchHex;
const light = { viewport: L(0.97), bg: L(1), fg: L(0.145), muted: L(0.97), mutedFg: L(0.556), border: L(0.922), ring: L(0.708) };
const dark = { viewport: L(0.18), bg: L(0.205), fg: L(0.985), muted: L(0.269), mutedFg: L(0.708), border: "rgb(255 255 255 / 10%)", ring: L(0.556) };
const vars = (t) => `--ss-viewport:${t.viewport};--ss-bg:${t.bg};--ss-fg:${t.fg};--ss-muted:${t.muted};--ss-muted-fg:${t.mutedFg};--ss-border:${t.border};--ss-ring:${t.ring};`;

/** Token declarations for a light and a dark scope; callers wrap them in their own selectors. */
export const TOKENS = { light: vars(light), dark: vars(dark) };

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** The bar's styles. The tokens above must be in scope. */
export const BAR_CSS = `
.ss-bar { container-type: inline-size; display: flex; align-items: center; gap: 4px; box-sizing: border-box; height: 44px; padding: 0 8px;
  background: var(--ss-bg); color: var(--ss-fg); border-top: 1px solid var(--ss-border); font: 12px/16px ${FONT}; user-select: none; }
.ss-bar[hidden], .ss-bar [hidden] { display: none; }
.ss-btn { display: inline-flex; align-items: center; justify-content: center; flex: none; box-sizing: border-box; height: 28px; min-width: 28px; padding: 0 6px;
  margin: 0; border: 0; border-radius: 6px; background: transparent; color: var(--ss-fg); font: inherit; cursor: pointer; }
.ss-btn:hover { background: var(--ss-muted); }
.ss-btn[aria-pressed="true"], .ss-btn[aria-expanded="true"] { background: var(--ss-muted); }
.ss-btn:disabled { opacity: 0.4; cursor: default; background: transparent; }
.ss-btn:focus-visible, .ss-scrub:focus-visible { outline: 2px solid var(--ss-ring); outline-offset: -1px; }
.ss-btn.ss-text { font-variant-numeric: tabular-nums; font-weight: 500; }
.ss-scrub { --p: 0%; flex: 1; min-width: 40px; height: 28px; margin: 0 4px; padding: 0; background: transparent; cursor: pointer;
  -webkit-appearance: none; appearance: none; }
.ss-scrub:disabled { cursor: default; opacity: 0.4; }
.ss-scrub::-webkit-slider-runnable-track { height: 3px; border-radius: 2px;
  background: linear-gradient(to right, var(--ss-fg) var(--p), color-mix(in srgb, var(--ss-fg) 14%, transparent) var(--p)); }
.ss-scrub::-moz-range-track { height: 3px; border-radius: 2px; background: color-mix(in srgb, var(--ss-fg) 14%, transparent); }
.ss-scrub::-moz-range-progress { height: 3px; border-radius: 2px; background: var(--ss-fg); }
.ss-scrub::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; margin-top: -4.5px; border: 0; border-radius: 50%;
  background: var(--ss-fg); opacity: 0; transition: opacity 0.12s; }
.ss-scrub::-moz-range-thumb { width: 12px; height: 12px; border: 0; border-radius: 50%; background: var(--ss-fg); opacity: 0; transition: opacity 0.12s; }
.ss-scrub:hover::-webkit-slider-thumb, .ss-scrub:active::-webkit-slider-thumb, .ss-scrub:focus-visible::-webkit-slider-thumb { opacity: 1; }
.ss-scrub:hover::-moz-range-thumb, .ss-scrub:active::-moz-range-thumb, .ss-scrub:focus-visible::-moz-range-thumb { opacity: 1; }
.ss-time { flex: none; min-width: 7.5em; text-align: right; color: var(--ss-muted-fg); font-variant-numeric: tabular-nums; white-space: nowrap; }
.ss-wrap { position: relative; flex: none; }
.ss-menu { position: absolute; right: 0; bottom: calc(100% + 8px); z-index: 5; box-sizing: border-box; min-width: 88px; padding: 4px;
  background: var(--ss-bg); border: 1px solid var(--ss-border); border-radius: 8px; box-shadow: 0 4px 12px rgb(0 0 0 / 12%); }
.ss-item { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; box-sizing: border-box; height: 28px; padding: 0 8px;
  border: 0; border-radius: 4px; background: transparent; color: var(--ss-fg); font: inherit; font-variant-numeric: tabular-nums; cursor: pointer; text-align: left; }
.ss-item:hover { background: var(--ss-muted); }
.ss-item svg { visibility: hidden; }
.ss-item[aria-checked="true"] svg { visibility: visible; }
.ss-group { padding: 4px 8px 2px; color: var(--ss-muted-fg); }
.ss-row { display: flex; gap: 2px; }
.ss-item.ss-opt { flex: none; width: auto; justify-content: center; padding: 0 8px; }
.ss-opt[aria-checked="true"] { background: var(--ss-muted); font-weight: 500; }
.ss-sep { height: 1px; margin: 4px -4px; background: var(--ss-border); }
@container (max-width: 440px) { .ss-step { display: none; } }
@container (max-width: 320px) { .ss-time { min-width: 0; } .ss-loop { display: none; } }
`;

export const SPEEDS = [0.25, 0.5, 1, 2, 4];

const VIEW_LABELS = [["iso", "Iso"], ["front", "Front"], ["side", "Side"], ["top", "Top"]];
const FOLLOW_LABELS = [["off", "Off"], ["position", "Position"], ["pose", "Pose"], ["heading", "Heading"]];

/** `3.25 / 7.98 s` */
export function readout(t, total) {
  return `${t.toFixed(2)} / ${total.toFixed(2)} s`;
}

export const speedLabel = (x) => `${x}×`;

/** The camera menu: the view presets, a frame action and the follow modes, in two rows of options. */
function cameraHTML() {
  const opts = (attr, list) =>
    `<div class="ss-row">${list.map(([id, text]) => `<button type="button" class="ss-item ss-opt ss-cam-item" role="menuitemradio" aria-checked="false" data-${attr}="${id}">${text}</button>`).join("")}</div>`;
  return `<div class="ss-wrap ss-camwrap"><button type="button" class="ss-btn ss-cam" aria-label="Camera" title="Camera" aria-haspopup="menu" aria-expanded="false">${icon("video")}</button>`
    + `<div class="ss-menu ss-cam-menu" role="menu" hidden><div class="ss-group">View</div>${opts("view", VIEW_LABELS)}`
    + '<button type="button" class="ss-item ss-cam-item" role="menuitem" data-frame="1">Frame</button><div class="ss-sep" role="separator"></div>'
    + `<div class="ss-group">Follow</div>${opts("follow", FOLLOW_LABELS)}</div></div>`;
}

/**
 * The bar's markup. `extra` adds buttons to the right (the element's
 * collision toggle). Every control is an icon button with an `aria-label`
 * and a tooltip; the only text is the readout, the speed and the camera menu.
 * The camera menu and the contacts toggle come last: they are about the
 * view, not the clock.
 */
export function barHTML(extra = "") {
  const btn = (cls, label, inner, attrs = "") => `<button type="button" class="ss-btn ${cls}" aria-label="${label}" title="${label}"${attrs}>${inner}</button>`;
  return [
    btn("ss-play", "Play", icon("play"), " disabled"),
    btn("ss-step ss-back", "Previous frame", icon("back"), " disabled"),
    btn("ss-step ss-fwd", "Next frame", icon("forward"), " disabled"),
    '<input class="ss-scrub" type="range" min="0" max="1000" value="0" step="1" aria-label="Seek" disabled>',
    '<span class="ss-time">0.00 / 0.00 s</span>',
    btn("ss-loop", "Loop", icon("repeat"), ' aria-pressed="false"'),
    `<div class="ss-wrap">${btn("ss-text ss-speed", "Speed", speedLabel(1), ' aria-haspopup="menu" aria-expanded="false"')}<div class="ss-menu" role="menu" hidden>${SPEEDS.map((s) => `<button type="button" class="ss-item ss-speed-item" role="menuitemradio" aria-checked="false" data-speed="${s}">${speedLabel(s)}${icon("check")}</button>`).join("")}</div></div>`,
    cameraHTML(),
    btn("ss-contacts", "Contact forces", icon("contact"), ' aria-pressed="false" hidden'),
    extra,
  ].join("");
}

/**
 * Find the bar's parts under `root` (a node with `querySelector`).
 *
 * @returns {object} play, back, fwd, scrub, time, loop, speed, menu, items,
 *   and the camera's wrap, button, menu and options (cam*), and contacts.
 */
export function barParts(root) {
  const q = (s) => root.querySelector(s);
  return {
    root,
    play: q(".ss-play"),
    back: q(".ss-back"),
    fwd: q(".ss-fwd"),
    scrub: q(".ss-scrub"),
    time: q(".ss-time"),
    loop: q(".ss-loop"),
    speed: q(".ss-speed"),
    menu: q(".ss-menu"),
    items: [...root.querySelectorAll(".ss-speed-item")],
    camWrap: q(".ss-camwrap"),
    cam: q(".ss-cam"),
    camMenu: q(".ss-cam-menu"),
    camItems: [...root.querySelectorAll(".ss-cam-item")],
    contacts: q(".ss-contacts"),
  };
}

/**
 * Wire a bar to a clock.
 *
 * @param {object} parts  from `barParts`.
 * @param {object} [opts]
 *   `stepDt`: seconds per frame for the step buttons (default 0.02). `onLoop`:
 *   called instead of setting `clock.loop` (the element reflects its `loop`
 *   attribute). `outside`: where to listen for a click away from a menu.
 *   `camera`: `{view(): string|null, setView(name), frame(), follow(): string,
 *   setFollow(mode)}`; without it the camera menu is hidden (`view()` is null
 *   after the user orbits: no preset is current). `contacts`: `{on(): boolean,
 *   set(on)}` for the contacts toggle, which the caller shows once the run has
 *   contact data (`parts.contacts.hidden`).
 * @returns {{setClock(clock): void, paint(): void, dispose(): void}}
 */
export function bindBar(parts, opts = {}) {
  const { play, back, fwd, scrub, time, loop, speed, menu, items, cam, camMenu, camItems, contacts } = parts;
  const { camera, contacts: contactsOpt } = opts;
  const stepDt = opts.stepDt || (() => 0.02);
  let clock = null;
  let dragging = false;

  const paint = () => {
    const d = clock ? clock.duration : 0;
    const t = clock ? Math.min(clock.time, d) : 0;
    const on = d > 0;
    for (const b of [play, back, fwd, scrub]) b.disabled = !on;
    time.textContent = readout(t, d);
    if (!dragging) scrub.value = on ? Math.round((t / d) * 1000) : 0;
    scrub.style.setProperty("--p", `${on ? (t / d) * 100 : 0}%`);
  };
  const paintState = () => {
    const playing = !!clock && clock.playing;
    play.innerHTML = icon(playing ? "pause" : "play");
    play.setAttribute("aria-label", playing ? "Pause" : "Play");
    play.title = playing ? "Pause" : "Play";
    const on = !!clock && clock.loop;
    loop.setAttribute("aria-pressed", String(on));
    const x = clock ? clock.speed : 1;
    speed.textContent = speedLabel(x);
    for (const it of items) it.setAttribute("aria-checked", String(Number(it.getAttribute("data-speed")) === x));
    if (camera) {
      const view = camera.view();
      const follow = camera.follow();
      for (const it of camItems) {
        const v = it.getAttribute("data-view");
        const f = it.getAttribute("data-follow");
        if (v !== null) it.setAttribute("aria-checked", String(v === view));
        else if (f !== null) it.setAttribute("aria-checked", String(f === follow));
      }
    }
    if (contactsOpt) contacts.setAttribute("aria-pressed", String(contactsOpt.on()));
    paint();
  };
  // The speed and camera menus: opening one closes the other.
  const menus = [{ button: speed, panel: menu }, { button: cam, panel: camMenu }];
  const closeMenus = (except) => {
    for (const m of menus) {
      if (m === except) continue;
      m.panel.hidden = true;
      m.button.setAttribute("aria-expanded", "false");
    }
  };
  const toggleMenu = (m) => {
    const open = m.panel.hidden;
    closeMenus(m);
    m.panel.hidden = !open;
    m.button.setAttribute("aria-expanded", String(open));
  };
  if (!camera) parts.camWrap.hidden = true;

  const on = (node, type, fn) => {
    node.addEventListener(type, fn);
    return () => node.removeEventListener(type, fn);
  };
  const offs = [
    on(play, "click", () => clock && clock.toggle()),
    on(back, "click", () => {
      if (!clock) return;
      clock.pause();
      clock.step(-1, stepDt());
    }),
    on(fwd, "click", () => {
      if (!clock) return;
      clock.pause();
      clock.step(1, stepDt());
    }),
    on(scrub, "input", () => clock && clock.seek((Number(scrub.value) / 1000) * clock.duration)),
    on(scrub, "pointerdown", () => (dragging = true)),
    on(scrub, "pointerup", () => ((dragging = false), paint())),
    on(scrub, "pointercancel", () => ((dragging = false), paint())),
    on(loop, "click", () => {
      if (!clock) return;
      if (opts.onLoop) opts.onLoop(!clock.loop);
      else clock.loop = !clock.loop;
      paintState();
    }),
    on(speed, "click", () => toggleMenu(menus[0])),
    on(cam, "click", () => toggleMenu(menus[1])),
    on(contacts, "click", () => {
      if (!contactsOpt) return;
      contactsOpt.set(!contactsOpt.on());
      paintState();
    }),
    ...items.map((it) =>
      on(it, "click", () => {
        if (clock) clock.speed = Number(it.getAttribute("data-speed"));
        closeMenus();
        paintState();
      }),
    ),
    // A view or a follow mode keeps the menu open, so both can be set in one visit; Frame closes it.
    ...camItems.map((it) =>
      on(it, "click", () => {
        if (!camera) return;
        const v = it.getAttribute("data-view");
        const f = it.getAttribute("data-follow");
        if (v !== null) camera.setView(v);
        else if (f !== null) camera.setFollow(f);
        else {
          camera.frame();
          closeMenus();
        }
        paintState();
      }),
    ),
  ];
  const outside = opts.outside;
  if (outside) {
    offs.push(
      on(outside, "pointerdown", (e) => {
        const path = e.composedPath ? e.composedPath() : [];
        for (const m of menus) {
          if (!m.panel.hidden && !path.includes(m.panel) && !path.includes(m.button)) closeMenus();
        }
      }),
      on(outside, "keydown", (e) => e.key === "Escape" && closeMenus()),
    );
  }

  let unbind = null;
  return {
    setClock(c) {
      if (unbind) unbind();
      clock = c;
      if (c) {
        c.addEventListener("time", paint);
        c.addEventListener("state", paintState);
        unbind = () => {
          c.removeEventListener("time", paint);
          c.removeEventListener("state", paintState);
        };
      } else unbind = null;
      paintState();
    },
    paint: paintState,
    dispose() {
      if (unbind) unbind();
      offs.forEach((off) => off());
    },
  };
}
