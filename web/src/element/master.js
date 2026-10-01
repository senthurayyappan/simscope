// The shared control of a compare page (export layout="compare"): one play
// button, scrubber, time readout and speed menu for every <simscope-player
// sync="NAME"> on the page. This is the old inline master script of
// export.py, rebuilt on the shared Clock: there is no leader and no drift
// correction, because every player reads the same clock.
//
// Markup it drives (ids are the ones export.py writes): #ss-play, #ss-scrub
// (range 0..1000), #ss-time, #ss-speed, #ss-marks, inside the box `box`,
// which carries data-autoplay="1" and data-loop="1" flags and starts hidden.
//
// The marks strip has one row per player, in page order, drawn in the
// player's `color` attribute (its compare slot): the run's highlights as the
// element draws them on its own scrub bar (marks.js: jump spans as thin bars,
// moments as ticks) and its annotation events as a thin underline. A dot in
// the same colour goes in front of the name in the player's <figure>
// <figcaption>, if it has one. The `color` attributes are all the page needs
// to provide: the rows and the dots are made here, with inline styles, so the
// page's CSS needs nothing new.

import { clockFor } from "../core/clock.js";
import { layoutMarks } from "./marks.js";

const fmt = (t) => `${t.toFixed(2)}s`;

/** Used for a player that has no `color` attribute. */
const NEUTRAL = "#2c7a7b";
/** Height of one run's row in the strip, px. */
const ROW = 7;

function node(tag, style, title) {
  const el = document.createElement(tag);
  Object.assign(el.style, style);
  if (title) el.title = title;
  return el;
}

/** A dot in `color` in front of the name in a player's <figcaption>, once. */
function addDot(player, color) {
  const caption = player.closest("figure")?.querySelector("figcaption");
  if (!caption || caption.querySelector("[data-ss-dot]")) return null;
  const dot = node("span", { display: "inline-block", width: "8px", height: "8px", marginRight: "6px", borderRadius: "50%", background: color });
  dot.setAttribute("data-ss-dot", "");
  caption.prepend(dot);
  return dot;
}

/**
 * Wire `box` to the clock named `sync` and to the players that use it.
 *
 * @param {HTMLElement} box  the master control element.
 * @param {string} [sync]  clock name; default "compare".
 * @returns {{clock: import("../core/clock.js").Clock, dispose(): void}}
 */
export function attachMaster(box, sync = "compare") {
  const $ = (id) => box.querySelector(`#${id}`) || document.getElementById(id);
  const play = $("ss-play"), scrub = $("ss-scrub"), time = $("ss-time"), speed = $("ss-speed"), marks = $("ss-marks");
  const clock = clockFor(sync);
  const els = [...document.querySelectorAll(`simscope-player[sync="${sync}"]`)];
  clock.loop = box.dataset.loop === "1";

  // One entry per player: its colour, annotation events and highlights.
  const runs = els.map((el) => {
    const color = el.getAttribute("color") || "";
    return { el, color: color || NEUTRAL, events: [], highlights: [], dot: color ? addDot(el, color) : null };
  });

  const paint = () => {
    time.textContent = `${fmt(clock.time)} / ${fmt(clock.duration)}`;
    if (document.activeElement !== scrub) scrub.value = clock.duration > 0 ? Math.round((clock.time / clock.duration) * 1000) : 0;
  };
  const label = () => {
    play.textContent = clock.playing ? "Pause" : "Play";
    play.setAttribute("aria-label", clock.playing ? "Pause" : "Play");
  };
  const onState = () => label();
  clock.addEventListener("time", paint);
  clock.addEventListener("state", onState);
  const onPlay = () => clock.toggle();
  const onScrub = () => clock.seek((scrub.value / 1000) * clock.duration);
  const onSpeed = () => (clock.speed = Number(speed.value));
  play.addEventListener("click", onPlay);
  scrub.addEventListener("input", onScrub);
  speed.addEventListener("change", onSpeed);

  // The strip: a row per run, the track tall enough for them above the scrubber.
  let shown = false;
  const render = () => {
    marks.textContent = "";
    const d = clock.duration;
    if (!shown || !(d > 0)) return;
    const rows = runs.length;
    marks.style.height = `${rows * ROW}px`;
    if (marks.parentElement) marks.parentElement.style.height = `${rows * ROW + 24}px`;
    const width = marks.getBoundingClientRect().width || 300;
    runs.forEach((run, i) => {
      const row = node("div", { position: "absolute", left: "0", right: "0", top: `${i * ROW}px`, height: `${ROW}px` });
      for (const ev of run.events) {
        const m = node("i", { left: `${Math.min(100, (ev.t0 / d) * 100)}%`, width: `${Math.max(0, ((ev.t1 - ev.t0) / d) * 100)}%`, top: `${ROW - 2}px`, height: "2px" }, ev.label);
        m.addEventListener("click", () => clock.seek(ev.t0));
        row.appendChild(m);
      }
      const { spans, ticks } = layoutMarks(run.highlights, d, width);
      for (const sp of spans) {
        const m = node("u", { position: "absolute", left: `${sp.left}%`, width: `${sp.width}%`, top: "2px", height: "3px", minWidth: "3px", borderRadius: "2px", background: run.color, opacity: "0.55", textDecoration: "none", cursor: "pointer" }, sp.title);
        m.addEventListener("click", () => clock.seek(sp.t));
        row.appendChild(m);
      }
      for (const tk of ticks) {
        const m = node("b", { position: "absolute", left: `${tk.left}%`, top: "0", width: "2px", height: `${ROW - 2}px`, marginLeft: "-1px", borderRadius: "1px", background: run.color, cursor: "pointer" }, tk.title);
        m.addEventListener("click", () => clock.seek(tk.t));
        row.appendChild(m);
      }
      marks.appendChild(row);
    });
  };
  const resize = typeof ResizeObserver === "function" ? new ResizeObserver(() => render()) : null;
  if (resize) resize.observe(marks);

  // Wait until every player has settled (ready or failed), then show the control.
  const settled = new Set();
  const settle = (run) => {
    settled.add(run);
    if (settled.size < runs.length) return;
    const d = clock.duration;
    if (d > 0) {
      shown = true;
      render();
      play.disabled = scrub.disabled = false;
      paint();
      if (box.dataset.autoplay === "1") clock.play();
    }
    box.hidden = false;
  };
  for (const run of runs) {
    run.el.addEventListener("ready", async (e) => {
      run.events = e.detail.events || [];
      try {
        // The highlights of the env the player follows, as its own scrub bar draws them.
        const doc = await run.el.player.highlights();
        const env = run.el.player.follow().env;
        run.highlights = ((doc && doc.highlights) || []).filter((h) => h.env === env).sort((a, b) => a.t - b.t);
      } catch {
        // Markers are a nicety; a bad file must not break playback.
      }
      settle(run);
      if (shown) render();
    });
    run.el.addEventListener("error", () => settle(run));
  }
  label();

  return {
    clock,
    dispose() {
      clock.removeEventListener("time", paint);
      clock.removeEventListener("state", onState);
      play.removeEventListener("click", onPlay);
      scrub.removeEventListener("input", onScrub);
      speed.removeEventListener("change", onSpeed);
      if (resize) resize.disconnect();
      for (const run of runs) if (run.dot) run.dot.remove();
    },
  };
}
