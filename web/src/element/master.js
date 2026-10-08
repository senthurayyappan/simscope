// The compare page (export layout="compare"): every <simscope-player
// sync="NAME"> in the box fills the page in the chosen arrangement, with one
// title per pane and ONE shared control bar at the bottom, in the visual
// language of the app (ui.js). It looks like the app's compare view, minus
// the app: no letters, no colour dots, no highlight rows.
//
// Markup (contracts §10.2): `<div id="ss-master" data-arrange="side|stack|grid">`
// holding one `<figure>` per run, each with a `<figcaption>` (the title) and
// a `<simscope-player sync="NAME">`. The page needs no CSS beyond
// `html, body { margin: 0; height: 100% }`: the layout, the styles and the
// bar are made here.
//
// All panes read one Clock, so there is no leader and no drift correction; a
// run shorter than the longest holds its last frame, and the bar's duration
// is the longest. Cameras are linked with ground alignment and pan sync
// (linkCameras): the comparison is only honest if z = 0 and the zoom agree.
// Panes of an arrangement all have the same pixel size, which that needs.

import { clockFor } from "../core/clock.js";
import { linkCameras } from "../core/compare.js";
import { arrangementOf, gridShape } from "./layout.js";
import { BAR_CSS, barHTML, barParts, bindBar, FONT, setAvailable, TOKENS } from "./ui.js";

const STYLE_ID = "ss-master-style";

const CSS = `
#ss-master { ${TOKENS.light} position: fixed; inset: 0; z-index: 1; display: flex; flex-direction: column; background: var(--ss-bg); color: var(--ss-fg); font: 12px/16px ${FONT}; }
@media (prefers-color-scheme: dark) { #ss-master { ${TOKENS.dark} } }
#ss-master[data-theme="light"] { ${TOKENS.light} }
#ss-master[data-theme="dark"] { ${TOKENS.dark} }
#ss-master[hidden] { display: none; }
#ss-master .ss-stage { flex: 1; min-height: 0; display: grid; gap: 1px; background: var(--ss-border); }
#ss-master figure { position: relative; margin: 0; min-width: 0; min-height: 0; overflow: hidden; background: var(--ss-viewport); }
#ss-master .ss-empty { background: var(--ss-bg); }
#ss-master figure > simscope-player { position: absolute; inset: 0; width: 100%; height: 100%; min-height: 0; aspect-ratio: auto; border: 0; border-radius: 0; }
#ss-master figcaption { position: absolute; left: 8px; top: 8px; z-index: 2; box-sizing: border-box; max-width: calc(100% - 16px); height: 24px; padding: 0 8px;
  display: flex; align-items: center; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; background: var(--ss-bg); color: var(--ss-fg);
  border: 1px solid var(--ss-border); border-radius: 6px; font-weight: 500; pointer-events: none; }
${BAR_CSS}
`;

/**
 * Lay out the page and wire the shared bar.
 *
 * @param {HTMLElement} box  the master element (`#ss-master`).
 * @param {string} [sync]  clock name; default "compare".
 * @returns {{clock: import("../core/clock.js").Clock, arrange: string, dispose(): void}}
 */
export function attachMaster(box, sync = "compare") {
  const doc = box.ownerDocument || document;
  const els = [...doc.querySelectorAll(`simscope-player[sync="${sync}"]`)];
  const clock = clockFor(sync);
  clock.loop = box.getAttribute("data-loop") === "1";

  if (!doc.getElementById(STYLE_ID)) {
    const style = doc.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    doc.head.appendChild(style);
  }

  // One figure per player, in page order; a title from the figcaption.
  const figures = els.map((el) => {
    let fig = el.closest("figure");
    if (!fig) {
      fig = doc.createElement("figure");
      fig.appendChild(el);
    }
    el.setAttribute("nocontrols", ""); // the shared bar drives playback
    return fig;
  });
  const arrange = arrangementOf(box.getAttribute("data-arrange"), figures.length);
  const { cols, rows } = gridShape(figures.length, arrange);

  const stage = doc.createElement("div");
  stage.className = "ss-stage";
  stage.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
  stage.style.gridTemplateRows = `repeat(${rows}, minmax(0, 1fr))`;
  for (const fig of figures) stage.appendChild(fig);
  for (let i = figures.length; i < cols * rows; i++) {
    const empty = doc.createElement("div");
    empty.className = "ss-empty";
    stage.appendChild(empty);
  }
  const bar = doc.createElement("div");
  bar.className = "ss-bar";
  bar.innerHTML = barHTML();
  box.replaceChildren(stage, bar);
  box.removeAttribute("hidden");
  box.setAttribute("data-arrange", arrange);

  // The longest run sets the duration (the clock keeps the max of its players' claims).
  const stepDt = () => {
    const dts = els.map((el) => el.player && el.player.info() && el.player.info().dt).filter((d) => d > 0);
    return dts.length ? Math.min(...dts) : 0.02;
  };
  // The camera, collision and contacts controls act on every pane. The cameras are linked, so a view or a frame goes to one pane and reaches the rest.
  const live = () => els.map((el) => el.player).filter(Boolean);
  const first = els[0] && els[0].getAttribute("view");
  let view = ["iso", "front", "side", "top"].includes(first) ? first : "iso";
  let collisionOn = false;
  let contactsOn = false;
  const parts = barParts(bar);
  const systemDark = () => typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = () => (box.getAttribute("data-theme") || (systemDark() ? "dark" : "light")) === "dark";
  parts.theme.hidden = false;
  const ctl = bindBar(parts, {
    stepDt,
    outside: doc,
    theme: {
      dark: isDark,
      toggle: () => {
        const next = isDark() ? "light" : "dark";
        box.setAttribute("data-theme", next);
        for (const el of els) el.setAttribute("theme", next);
      },
    },
    camera: {
      view: () => view,
      setView: (name) => {
        const ps = live();
        for (const pl of ps.length > 1 ? ps.slice(0, 1) : ps) pl.setView(name);
        view = name;
      },
      frame: () => {
        const ps = live();
        for (const pl of ps.length > 1 ? ps.slice(0, 1) : ps) pl.frame("focus");
      },
      follow: () => {
        const pl = live()[0];
        return pl && pl.follow ? pl.follow().mode : "off";
      },
      setFollow: (mode) => {
        for (const el of els) {
          if (el.player && el.player.setFollow) el.player.setFollow({ mode });
          el.setAttribute("follow", mode);
        }
      },
    },
    collision: {
      on: () => collisionOn,
      set: (on) => {
        collisionOn = on;
        for (const el of els) {
          if (on) el.setAttribute("collision", "");
          else el.removeAttribute("collision");
        }
      },
    },
    contacts: {
      on: () => contactsOn,
      set: (on) => {
        contactsOn = on;
        for (const el of els) {
          if (on) el.setAttribute("contacts", "");
          else el.removeAttribute("contacts");
        }
      },
    },
  });
  ctl.setClock(clock);
  // An orbit in any pane leaves the preset behind. The collision and contacts toggles wait for a pane whose run has the data.
  for (const pl of live()) pl.addEventListener("camera", () => view !== null && ((view = null), ctl.paint()));
  const showData = () => {
    const has = (key) => live().some((pl) => pl.info() && pl.info()[key]);
    setAvailable(parts.col, has("hasCollision"), "Collision geometry", "No collision geometry in these runs");
    setAvailable(parts.contacts, has("hasContacts"), "Contact forces", "No contact data in these runs");
  };
  showData();

  const onKey = (e) => {
    if (e.target && /^(input|button|select)$/i.test(e.target.tagName || "")) return;
    if (e.key === " ") {
      e.preventDefault?.();
      clock.toggle();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      clock.pause();
      clock.step(e.key === "ArrowLeft" ? -1 : 1, stepDt());
    }
  };
  doc.addEventListener("keydown", onKey);

  // Link the cameras once every player has one; autoplay once every pane has settled.
  const players = els.map((el) => el.player).filter(Boolean);
  const unlink = players.length > 1 ? linkCameras(players) : () => {};
  const settled = new Set();
  const settle = (el) => {
    settled.add(el);
    if (settled.size < els.length) return;
    if (box.getAttribute("data-autoplay") !== "1") return;
    // Play once every pane has framed its run (the group fits the union of their ranges, and never while playing).
    Promise.all(players.map((p) => p._extentJob)).then(() => clock.duration > 0 && clock.play(), () => clock.play());
  };
  for (const el of els) {
    el.addEventListener("ready", () => {
      showData();
      settle(el);
    });
    el.addEventListener("error", () => settle(el));
  }

  return {
    clock,
    arrange,
    dispose() {
      doc.removeEventListener("keydown", onKey);
      unlink();
      ctl.dispose();
    },
  };
}
