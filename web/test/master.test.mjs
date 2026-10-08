// The compare master and the shared bar, on a stand-in DOM (fakedom.mjs).

import assert from "node:assert/strict";
import test from "node:test";

import { clockFor } from "../src/core/clock.js";
import { attachMaster } from "../src/element/master.js";
import { barHTML, barParts, bindBar, icon, readout, setAvailable } from "../src/element/ui.js";
import { Clock } from "../src/core/clock.js";
import { makeDocument } from "./fakedom.mjs";

let counter = 0;

/** A compare page as export.py writes it: a box of figures, each a title and a player. */
function page(titles, arrange, { dts = [] } = {}) {
  const doc = makeDocument();
  const sync = `cmp${counter++}`;
  const box = doc.createElement("div");
  box.id = "ss-master";
  box.setAttribute("id", "ss-master");
  if (arrange) box.setAttribute("data-arrange", arrange);
  box.setAttribute("data-loop", "1");
  doc.body.appendChild(box);
  const players = titles.map((title, i) => {
    const fig = doc.createElement("figure");
    const cap = doc.createElement("figcaption");
    cap.textContent = title;
    const el = doc.createElement("simscope-player");
    el.setAttribute("sync", sync);
    el.setAttribute("run", title);
    // A stand-in for the core player: what attachMaster asks of it.
    el.player = {
      dt: dts[i] ?? 0.02,
      info() { return { dt: this.dt }; },
      addEventListener() {},
      removeEventListener() {},
      linked: null,
      rig: { state: () => ({}), setAngles() {}, targetHeight: 1, setHeight() {} },
      _frameTarget: () => ({}),
      _fitFrame() {},
      _extent: () => null,
    };
    fig.appendChild(cap);
    fig.appendChild(el);
    box.appendChild(fig);
    return el;
  });
  return { doc, box, players, sync, master: attachMaster(box, sync) };
}

const click = (n) => n.dispatchEvent(new Event("click"));
const stageOf = (box) => box.querySelector(".ss-stage");

test("arrangement: the stage's grid for two, three and four runs in each arrangement", () => {
  const want = {
    "2 side": [2, 1, 0], "2 stack": [1, 2, 0], "2 grid": [2, 1, 0],
    "3 side": [3, 1, 0], "3 stack": [1, 3, 0], "3 grid": [2, 2, 1],
    "4 side": [4, 1, 0], "4 stack": [1, 4, 0], "4 grid": [2, 2, 0],
  };
  for (const n of [2, 3, 4]) {
    for (const arrange of ["side", "stack", "grid"]) {
      const { box } = page(["a", "b", "c", "d"].slice(0, n).map((x) => `run_${x}`), arrange);
      const stage = stageOf(box);
      const [cols, rows, empty] = want[`${n} ${arrange}`];
      assert.equal(stage.style.gridTemplateColumns, `repeat(${cols}, minmax(0, 1fr))`, `${n} ${arrange}`);
      assert.equal(stage.style.gridTemplateRows, `repeat(${rows}, minmax(0, 1fr))`, `${n} ${arrange}`);
      assert.equal(stage.querySelectorAll("figure").length, n);
      assert.equal(stage.querySelectorAll(".ss-empty").length, empty, `${n} ${arrange}: empty cells`);
      assert.equal(box.getAttribute("data-arrange"), arrange);
    }
  }
});

test("no arrangement given: side for two, a grid for three or four", () => {
  assert.equal(page(["a", "b"]).box.getAttribute("data-arrange"), "side");
  assert.equal(page(["a", "b", "c"]).box.getAttribute("data-arrange"), "grid");
  assert.equal(page(["a", "b", "c", "d"], "bogus").master.arrange, "grid");
});

test("one title per pane and nothing else: no letters, no colour dots, no colours, no highlight rows", () => {
  const titles = ["d12_cad2_stage3_w050", "m_roll_d001", "n_roll_d000"];
  const { box, players, doc } = page(titles, "grid");
  const caps = box.querySelectorAll("figcaption");
  assert.deepEqual(caps.map((c) => c.textContent), titles, "the full run name, as given");
  for (const c of caps) assert.equal(c.children.length, 0, "a title is text only: no letter badge, no dot");
  for (const n of box.all()) {
    assert.ok(!n.hasAttribute("data-ss-dot") && !n.hasAttribute("color"), "no dot, no color attribute");
    assert.ok(!/^[A-D]$/.test(n.textContent.trim()), `no stand-alone letter: "${n.textContent}"`);
    assert.ok(!n.style.background && !n.style.backgroundColor, "nothing is coloured inline");
  }
  assert.equal(box.querySelectorAll("u").length + box.querySelectorAll("b").length + box.querySelectorAll("i").length, 0, "no marker nodes");
  assert.equal(box.querySelector("#ss-marks"), null);
  for (const el of players) {
    assert.ok(el.hasAttribute("nocontrols"), "players hide their own bars");
    assert.ok(!el.hasAttribute("color"));
  }
  // The only control row is the shared one, under the stage.
  assert.equal(box.querySelectorAll(".ss-bar").length, 1);
  assert.equal(box.children[box.children.length - 1].className, "ss-bar");
  const css = doc.getElementById("ss-master-style").textContent;
  assert.ok(!/uppercase/.test(css), "sentence case");
});

test("the bar is icon buttons: the only text is the readout and the speed", () => {
  const { box } = page(["a", "b"], "side");
  const buttons = box.querySelectorAll("button").filter((b) => !/ss-item/.test(b.className));
  assert.ok(buttons.length >= 5);
  for (const b of buttons) {
    assert.ok(b.getAttribute("aria-label"), "labelled for screen readers");
    assert.ok(!/^(Play|Pause|Loop)$/.test(b.textContent), `no text label: "${b.textContent}"`);
  }
  assert.ok(barHTML().includes("<svg"));
  assert.ok(icon("play").includes('stroke="currentColor"'));
});

test("the bar's duration is the longest run, and its buttons drive the shared clock", () => {
  const { box, sync } = page(["a", "b"], "side", { dts: [0.04, 0.02] });
  const clock = clockFor(sync);
  clock.claim("short", 2, 0.02, false);
  clock.claim("long", 5, 0.02, false);
  assert.equal(clock.duration, 5, "the max over the runs");
  const time = box.querySelector(".ss-time");
  assert.equal(time.textContent, "0.00 / 5.00 s");
  const [play, back, fwd] = ["ss-play", "ss-back", "ss-fwd"].map((c) => box.querySelector(`.${c}`));
  assert.equal(play.disabled, false, "enabled once there is a duration");

  click(play);
  assert.equal(clock.playing, true);
  assert.equal(play.getAttribute("aria-label"), "Pause");
  click(play);
  assert.equal(clock.playing, false);
  assert.equal(play.getAttribute("aria-label"), "Play");

  // A step is the shortest frame of the runs (0.02 s), and stops playback.
  click(play);
  click(fwd);
  assert.equal(clock.playing, false);
  assert.ok(Math.abs(clock.time - 0.02) < 1e-9, `${clock.time}`);
  click(fwd);
  click(back);
  assert.ok(Math.abs(clock.time - 0.02) < 1e-9);
  assert.equal(time.textContent, "0.02 / 5.00 s");

  const scrub = box.querySelector(".ss-scrub");
  scrub.value = "500";
  scrub.dispatchEvent(new Event("input"));
  assert.ok(Math.abs(clock.time - 2.5) < 1e-9);
  assert.equal(time.textContent, "2.50 / 5.00 s");
  assert.equal(scrub.style["--p"], "50%", "progress");
  clock.seek(5);
  assert.equal(String(scrub.value), "1000");
});

test("loop and speed: the loop button toggles the clock, the speed menu sets it", () => {
  const { box, sync } = page(["a", "b"], "side");
  const clock = clockFor(sync);
  clock.claim("r", 3, 0.02, false);
  const loop = box.querySelector(".ss-loop");
  assert.equal(clock.loop, true, "from data-loop");
  assert.equal(loop.getAttribute("aria-pressed"), "true");
  click(loop);
  assert.equal(clock.loop, false);
  assert.equal(loop.getAttribute("aria-pressed"), "false");

  const speed = box.querySelector(".ss-speed"), menu = box.querySelector(".ss-menu");
  assert.equal(menu.hidden, true);
  assert.equal(speed.textContent, "1×");
  click(speed);
  assert.equal(menu.hidden, false);
  assert.equal(speed.getAttribute("aria-expanded"), "true");
  const two = box.querySelectorAll(".ss-item").find((i) => i.getAttribute("data-speed") === "2");
  click(two);
  assert.equal(clock.speed, 2);
  assert.equal(menu.hidden, true);
  assert.equal(speed.textContent, "2×");
  assert.equal(two.getAttribute("aria-checked"), "true");
});

/** A bar on a stand-in DOM with a recording camera and contacts adapter. */
function cameraBar(withAdapters = true) {
  const doc = makeDocument();
  const root = doc.createElement("div");
  root.innerHTML = barHTML();
  const parts = barParts(root);
  const log = [];
  const state = { view: "iso", follow: "off", contacts: false, collision: false };
  const opts = withAdapters
    ? {
        camera: {
          view: () => state.view,
          setView: (v) => (log.push(`view ${v}`), (state.view = v)),
          frame: () => log.push("frame"),
          follow: () => state.follow,
          setFollow: (m) => (log.push(`follow ${m}`), (state.follow = m)),
        },
        contacts: { on: () => state.contacts, set: (on) => (log.push(`contacts ${on}`), (state.contacts = on)) },
        collision: { on: () => state.collision, set: (on) => (log.push(`collision ${on}`), (state.collision = on)) },
      }
    : {};
  const ctl = bindBar(parts, opts);
  ctl.setClock(new Clock());
  const item = (attr, value) => parts.camItems.find((i) => i.getAttribute(`data-${attr}`) === value);
  return { parts, log, state, ctl, item };
}

test("camera menu: views and follow modes stay open for more, Frame closes it, one menu open at a time", () => {
  const { parts, log, state, ctl, item } = cameraBar();
  assert.equal(parts.camWrap.hidden, false);
  assert.equal(parts.camMenu.hidden, true);
  assert.equal(item("view", "iso").getAttribute("aria-checked"), "true", "the current preset is checked");
  click(parts.cam);
  assert.equal(parts.camMenu.hidden, false);
  assert.equal(parts.cam.getAttribute("aria-expanded"), "true");
  click(item("view", "top"));
  click(item("follow", "pose"));
  assert.deepEqual(log, ["view top", "follow pose"]);
  assert.equal(parts.camMenu.hidden, false, "still open");
  assert.equal(item("view", "top").getAttribute("aria-checked"), "true");
  assert.equal(item("view", "iso").getAttribute("aria-checked"), "false");
  assert.equal(item("follow", "pose").getAttribute("aria-checked"), "true");
  // An orbit leaves no preset checked.
  state.view = null;
  ctl.paint();
  assert.ok(parts.camItems.filter((i) => i.getAttribute("data-view") !== null).every((i) => i.getAttribute("aria-checked") === "false"));
  click(parts.speed);
  assert.equal(parts.menu.hidden, false);
  assert.equal(parts.camMenu.hidden, true, "opening the speed menu closes the camera menu");
  click(parts.cam);
  assert.equal(parts.menu.hidden, true);
  click(parts.camItems.find((i) => i.getAttribute("data-frame") !== null));
  assert.equal(log.at(-1), "frame");
  assert.equal(parts.camMenu.hidden, true);
  ctl.dispose();
});

test("camera menu: without an adapter it is hidden, and no option changes the speed", () => {
  const { parts, ctl } = cameraBar(false);
  assert.equal(parts.camWrap.hidden, true);
  for (const it of parts.camItems) click(it);
  assert.equal(parts.items.length, 5, "the speed menu keeps its own five options");
  ctl.dispose();
});

test("contacts and collision toggles: present from the start, disabled until the caller enables them, and they toggle through their adapters", () => {
  const { parts, log, state, ctl } = cameraBar();
  for (const key of ["contacts", "col"]) {
    assert.equal(parts[key].hidden, false, "never hidden: a disabled toggle says why");
    assert.equal(parts[key].getAttribute("aria-disabled"), "true");
    click(parts[key]);
  }
  assert.deepEqual(log, [], "a disabled toggle does nothing");
  setAvailable(parts.contacts, true, "Contact forces", "No contact data in this run");
  assert.equal(parts.contacts.getAttribute("aria-disabled"), "false");
  assert.equal(parts.contacts.title, "Contact forces");
  setAvailable(parts.col, false, "Collision geometry", "No collision geometry in this run");
  assert.equal(parts.col.title, "No collision geometry in this run", "the tooltip gives the reason");
  click(parts.contacts);
  assert.equal(state.contacts, true);
  assert.equal(parts.contacts.getAttribute("aria-pressed"), "true");
  click(parts.contacts);
  setAvailable(parts.col, true, "Collision geometry", "");
  click(parts.col);
  assert.deepEqual(log, ["contacts true", "contacts false", "collision true"]);
  assert.equal(parts.col.getAttribute("aria-pressed"), "true");
  ctl.dispose();
});

test("theme toggle: hidden until the caller shows it, flips through its adapter, and shows the icon of the current theme", () => {
  const doc = makeDocument();
  const root = doc.createElement("div");
  root.innerHTML = barHTML();
  const parts = barParts(root);
  assert.equal(parts.theme.hidden, true);
  let dark = false;
  const ctl = bindBar(parts, { theme: { dark: () => dark, toggle: () => (dark = !dark) } });
  ctl.setClock(new Clock());
  assert.match(parts.theme.getAttribute("aria-label"), /dark/);
  click(parts.theme);
  assert.equal(dark, true);
  assert.match(parts.theme.getAttribute("aria-label"), /light/, "now it offers the other theme");
  ctl.dispose();
});

test("compare page: the shared bar's theme button sets the theme on the page and on every pane", () => {
  const { box, players } = page(["a", "b"], "side");
  const button = box.querySelector(".ss-theme");
  assert.equal(button.hidden, false);
  click(button);
  const first = box.getAttribute("data-theme");
  assert.ok(first === "dark" || first === "light");
  for (const el of players) assert.equal(el.getAttribute("theme"), first);
  click(button);
  assert.notEqual(box.getAttribute("data-theme"), first, "a second click flips it back");
});

test("the transport icons are solid, and the outline ones stay outline", () => {
  assert.ok(icon("play").includes('fill="currentColor"') && icon("pause").includes('fill="currentColor"'));
  assert.ok(icon("repeat").includes('fill="none"'), "outline icons stay outline");
});

test("keyboard: space plays and pauses, the arrows step", () => {
  const { doc, sync } = page(["a", "b"], "side");
  const clock = clockFor(sync);
  clock.claim("r", 3, 0.02, false);
  const key = (k) => {
    const e = new Event("keydown");
    e.key = k;
    Object.defineProperty(e, "target", { value: { tagName: "BODY" } });
    doc.dispatchEvent(e);
  };
  key(" ");
  assert.equal(clock.playing, true);
  key(" ");
  assert.equal(clock.playing, false);
  key("ArrowRight");
  assert.ok(Math.abs(clock.time - 0.02) < 1e-9);
  key("ArrowLeft");
  assert.equal(clock.time, 0);
});

test("a bar without a duration is disabled; the readout is two numbers in seconds", () => {
  const doc = makeDocument();
  const root = doc.createElement("div");
  root.innerHTML = barHTML();
  const parts = barParts(root);
  const clock = new Clock();
  const ctl = bindBar(parts);
  ctl.setClock(clock);
  assert.ok(parts.play.disabled && parts.scrub.disabled && parts.back.disabled);
  assert.equal(parts.time.textContent, "0.00 / 0.00 s");
  clock.claim("x", 8, 0.02, false);
  assert.equal(parts.play.disabled, false);
  assert.equal(readout(2.487, 7.98), "2.49 / 7.98 s");
  ctl.dispose();
});

test("the style sheet carries the app's neutral tokens and no uppercase or colour accents", () => {
  const { doc } = page(["a", "b"], "side");
  const css = doc.getElementById("ss-master-style").textContent;
  assert.match(css, /--ss-border:#e5e5e5/, "shadcn border, oklch(0.922 0 0)");
  assert.match(css, /--ss-fg:#0a0a0a/);
  assert.match(css, /prefers-color-scheme: dark/);
  assert.match(css, /border-radius: 6px/);
  assert.match(css, /height: 28px/);
  assert.match(css, /tabular-nums/);
  assert.ok(!/#[0-9a-f]{6}/i.test(css.replace(/--ss-[\w-]+:#[0-9a-f]{6}/gi, "")), "every colour is a token");
});
