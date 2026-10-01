// The Player's display settings, slot colour and highlights, headless (see compare.test.mjs).

import assert from "node:assert/strict";
import test from "node:test";

globalThis.DOMRect ??= class {
  constructor(x = 0, y = 0, width = 0, height = 0) {
    Object.assign(this, { x, y, width, height, left: x, top: y, right: x + width, bottom: y + height });
  }
};

const { Player } = await import("../src/core/player.js");
const { upgradeHighlights } = await import("../src/core/plots.js");
const { PackSource } = await import("../src/core/source.js");
import { makeWalkerPack, nullRenderer } from "./fixtures.mjs";

const load = async (opts = {}, pack = {}) => {
  const p = new Player(null, { renderer: nullRenderer, ...opts });
  p.resize(320, 240, 1);
  await p.load(new PackSource(makeWalkerPack(pack)), "walker");
  return p;
};

// The scene has a visual torso box and a collision sphere.
const visible = (p) => p.r.parts[0].root.children.map((m) => m.visible);

test("visual, collision and contacts are three independent switches", async () => {
  const p = await load();
  assert.deepEqual(visible(p), [true, false], "visual on, collision off");
  p.setVisual(false);
  assert.deepEqual(visible(p), [false, false]);
  p.setCollision(true);
  assert.deepEqual(visible(p), [false, true], "collision alone");
  p.setVisual(true);
  assert.deepEqual(visible(p), [true, true]);
  p.setCollision(false);
  assert.deepEqual(visible(p), [true, false]);
  assert.equal(p.contactsOn, false);
  p.setContacts(true);
  p.setVisual(false);
  assert.equal(p.contactsOn, true, "contacts do not follow the visual switch");
  assert.equal(p.dirty, true, "and the change is drawn");
});

test("setVisual before a run is loaded applies to the run", async () => {
  const p = new Player(null, { renderer: nullRenderer });
  p.resize(320, 240, 1);
  p.setVisual(false);
  p.setCollision(true);
  await p.load(new PackSource(makeWalkerPack()), "walker");
  assert.deepEqual(visible(p), [false, true]);
});

test("a player's slot colour: option, setColor, info().color and the color event", async () => {
  const plain = await load();
  assert.equal(plain.info().color, null);
  const p = await load({ color: "#e4572e" });
  assert.equal(p.info().color, "#e4572e");
  const seen = [];
  p.addEventListener("color", (e) => seen.push(e.detail.color));
  p.setColor("rgb(10, 20, 30)");
  assert.equal(p.info().color, "rgb(10, 20, 30)");
  p.setColor("rgb(10, 20, 30)");
  p.setColor(null);
  assert.equal(p.info().color, null);
  assert.deepEqual(seen, ["rgb(10, 20, 30)", null], "an event per change, none for a repeat");
  // It survives loading another run.
  p.setColor("tomato");
  await p.load(new PackSource(makeWalkerPack()), "walker");
  assert.equal(p.info().color, "tomato");
});

const DOC2 = {
  format: "simscope-highlights/2",
  detector: "simscope/2",
  run_id: "01J",
  kinds: [
    { key: "landing", label: "Landing" },
    { key: "jump", label: "Jump" },
  ],
  highlights: [
    { t: 0.98, frame: 49, t1: 1.36, frame1: 68, env: 0, kind: "jump", label: "Jump", detail: "0.38 s airborne, apex 0.83 m", score: 5, ratio: null, value: 0.83, body: 1, also: [] },
    { t: 1.36, frame: 68, t1: null, frame1: null, env: 0, kind: "landing", label: "Landing", detail: "4.1 g impact, after 0.38 s airborne", score: 9.2, ratio: 4.1, value: 40.2, body: 1, also: ["contact_spike"] },
  ],
};
const DOC1 = {
  format: "simscope-highlights/1",
  detector: "simscope/1",
  run_id: "01J",
  signals: [{ key: "contact_force", label: "Contact force", unit: "N" }],
  highlights: [{ t: 1.24, frame: 62, env: 0, signal: "contact_force", score: 8.3, value: 412.0, body: null }],
};

test("highlights() returns the /2 document, spans included, untouched in its /2 fields", async () => {
  const p = await load({}, { files: { "derived/walker/highlights.json": DOC2 } });
  const doc = await p.highlights();
  assert.equal(doc.format, "simscope-highlights/2");
  assert.deepEqual(doc.kinds, DOC2.kinds);
  assert.equal(doc.highlights.length, 2);
  for (const [i, h] of doc.highlights.entries()) {
    for (const k of ["t", "frame", "t1", "frame1", "env", "kind", "label", "detail", "score", "ratio", "value", "body", "also"]) {
      assert.deepEqual(h[k], DOC2.highlights[i][k], `${h.kind}.${k}`);
    }
  }
  assert.equal(await p.highlights(), doc, "cached per run");
});

test("a /1 document becomes neutral moments: the signal is the kind and the label", async () => {
  const p = await load({}, { files: { "derived/walker/highlights.json": DOC1 } });
  const doc = await p.highlights();
  assert.deepEqual(doc.kinds, [{ key: "contact_force", label: "Contact force" }]);
  const [h] = doc.highlights;
  assert.equal(h.kind, "contact_force");
  assert.equal(h.label, "Contact force");
  assert.equal(h.detail, "");
  assert.equal(h.t1, null, "a moment, not a span");
  assert.equal(h.t, 1.24);
  assert.equal(h.score, 8.3);
});

test("the /1 fields the app read before it knew `kind` are still filled in, and no highlights is null", async () => {
  const doc = upgradeHighlights(DOC2);
  assert.equal(doc.highlights[1].signal, "landing");
  assert.deepEqual(doc.signals, [
    { key: "landing", label: "Landing", unit: "" },
    { key: "jump", label: "Jump", unit: "" },
  ]);
  assert.equal(upgradeHighlights(null), null);
  const p = await load();
  assert.equal(await p.highlights(), null, "a run without derived/highlights.json");
});

test("loading another run while playing keeps playing", async () => {
  const { Clock } = await import("../src/core/clock.js");
  const { stepLoop } = await import("../src/core/loop.js");
  const clock = new Clock();
  const p = new Player(null, { renderer: nullRenderer, clock });
  p.resize(320, 240, 1);
  await p.load(new PackSource(makeWalkerPack({ run: "a" })), "a");
  let now = 1000;
  const frames = (n) => {
    for (let i = 0; i < n; i++) stepLoop((now += 1000 / 60));
  };
  frames(3);
  clock.play();
  frames(20);
  const loading = p.load(new PackSource(makeWalkerPack({ run: "b" })), "b");
  frames(3);
  await loading;
  frames(30);
  assert.equal(clock.playing, true);
  assert.ok(clock.time > 0.2, `the new run advanced (t=${clock.time})`);
  p.destroy();
});
