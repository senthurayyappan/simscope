// Compare in the app's three arrangements: panes of very different shapes
// (a tall column, a short wide strip, a quarter), robots that stand at
// different heights. Ground rows must match and the whole motion must stay
// in every pane. See headless.mjs.

import assert from "node:assert/strict";
import test from "node:test";

import { assertAligned, Clock, linkCameras, makeWalkerPack, nullRenderer, PackSource, Player, project, setViews, settle } from "./headless.mjs";

// The page of the app's compare view at 918 px wide: three runs in each arrangement.
const SIZES = { side: [306, 700], stack: [918, 229], grid: [459, 350] };

// Standing heights that differ as in the real library (m_roll_d001 0.257, n_roll_d000 and d12 0.202; here a bit more); two of them jump.
const RUNS = [
  { run: "m", T: 150, path: (t) => [0.2 * t, 0, 0.35 + 0.5 * Math.max(0, Math.sin((Math.PI * t) / 3))], walls: [{ x: 0.4, y: 0.35, hx: 0.1, hy: 0.2, top: 0.9 }] },
  { run: "n", T: 150, path: (t) => [0.25 * t, 0, 0.202 + 0.02 * Math.sin(5 * t)], walls: [{ x: 0.4, y: 0.35, hx: 0.1, hy: 0.2, top: 0.6 }] },
  { run: "d", T: 150, path: (t) => [0.15 * t, 0, 0.202 + 0.3 * Math.max(0, Math.sin((Math.PI * t) / 3))], walls: [{ x: 0.4, y: 0.35, hx: 0.1, hy: 0.2, top: 0.5 }] },
];

function robotBox(p) {
  const { x, y, z } = p.followPt;
  const pts = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) pts.push([x + sx * 0.3, y + sy * 0.1, z + sz * 0.05]);
  return pts;
}

/** Pixels of margin between the robot's box and the pane's edges (negative: cropped). */
function margin(p) {
  let m = Infinity;
  for (const [x, y, z] of robotBox(p)) {
    const [c, r] = project(p, x, y, z);
    m = Math.min(m, c, r, p.cssWidth - c, p.cssHeight - r);
  }
  return m;
}

async function pane(clock, spec, size, source = null) {
  const p = new Player(null, { renderer: nullRenderer, clock });
  p.resize(size[0], size[1], 1);
  await p.load(source || new PackSource(makeWalkerPack(spec)), spec.run);
  await p._extentJob;
  return p;
}

for (const arrange of ["side", "stack", "grid"]) {
  test(`${arrange} (${SIZES[arrange].join(" x ")} panes): ground rows match in side, iso and front, and every robot stays in its pane`, async () => {
    const clock = new Clock();
    const ps = [];
    for (const spec of RUNS) ps.push(await pane(clock, spec, SIZES[arrange]));
    linkCameras(ps);
    for (const view of ["side", "iso", "front"]) {
      setViews(ps, view);
      settle(ps, 1);
      const tz = ps.map((p) => p.cameraState().target[2]);
      assert.ok(Math.max(...tz) - Math.min(...tz) < 1e-3, `${arrange} ${view}: one held height, got ${tz.map((v) => v.toFixed(3))}`);
      for (let t = 0; t <= 2.9; t += 0.3) {
        clock.seek(t);
        settle(ps, 0.8);
        assertAligned(ps, `${arrange} ${view} t=${t.toFixed(1)}`);
        ps.forEach((p, i) => assert.ok(margin(p) >= 0, `${arrange} ${view} t=${t.toFixed(1)} pane ${i}: robot ${margin(p).toFixed(1)} px outside`));
      }
    }
  });
}

test("a short wide pane before the runs are decoded: the frame-0 view leaves room for the group's held height", async () => {
  const clock = new Clock();
  const ps = [];
  let open;
  const gate = new Promise((r) => (open = r));
  for (const spec of RUNS) {
    // Three windows; the later two wait for the gate, so the series cannot be decoded yet.
    const source = new PackSource(makeWalkerPack({ ...spec, T: 250 }));
    const blocks = source.blocks.bind(source);
    source.blocks = async (path, w, envs) => {
      if (w > 0) await gate;
      return blocks(path, w, envs);
    };
    const p = new Player(null, { renderer: nullRenderer, clock });
    p.resize(...SIZES.stack, 1);
    await p.load(source, spec.run);
    ps.push(p);
  }
  linkCameras(ps);
  // The group holds the first robot's standing height (0.35); the others stand at 0.202.
  for (const view of ["side", "iso"]) {
    setViews(ps, view);
    settle(ps, 1);
    ps.forEach((p, i) => assert.ok(margin(p) >= 0, `${view} pane ${i}: ${margin(p).toFixed(1)} px outside before the series arrived`));
    assert.equal(ps[0]._extent(), undefined, "still decoding");
  }
  open();
});

test("changing the arrangement refits for the new shape: the strip becomes a column and the robot is not cut at the sides", async () => {
  const clock = new Clock();
  const ps = [];
  for (const spec of RUNS) ps.push(await pane(clock, spec, SIZES.stack));
  linkCameras(ps);
  setViews(ps, "iso");
  settle(ps, 1);
  const wide = ps[0].rig.targetHeight;
  for (const p of ps) p.resize(...SIZES.side, 1);
  settle(ps, 1);
  const tall = ps[0].rig.targetHeight;
  assert.ok(tall >= wide * 0.9, `${wide} then ${tall}`);
  for (let t = 0; t <= 2.9; t += 0.5) {
    clock.seek(t);
    settle(ps, 0.8);
    ps.forEach((p, i) => assert.ok(margin(p) >= 0, `column pane ${i} t=${t}: ${margin(p).toFixed(1)} px outside`));
    assertAligned(ps, `column t=${t}`);
  }
  for (const p of ps) p.resize(...SIZES.stack, 1);
  settle(ps, 1);
  ps.forEach((p, i) => assert.ok(margin(p) >= 0, `strip again, pane ${i}`));
});

test("a single pane too: a very wide pane is limited by its height, a narrow one by its width", async () => {
  for (const size of [[918, 229], [306, 700], [1200, 150]]) {
    const p = await pane(new Clock(), RUNS[0], size);
    for (const view of ["side", "iso", "front"]) {
      p.setView(view, { animate: false });
      settle([p], 1);
      for (let t = 0; t <= 2.9; t += 0.4) {
        p.clock.seek(t);
        settle([p], 0.8);
        assert.ok(margin(p) >= 0, `${size.join("x")} ${view} t=${t}: ${margin(p).toFixed(1)} px outside`);
      }
    }
  }
});

for (const arrange of ["side", "stack", "grid"]) {
  test(`${arrange}: panes that are not following sit on the same ground row too (the group's height, not each run's)`, async () => {
    const clock = new Clock();
    const ps = [];
    for (const spec of RUNS) ps.push(await pane(clock, spec, SIZES[arrange]));
    linkCameras(ps);
    ps.forEach((p) => p.setFollow({ mode: "off" }));
    for (const view of ["side", "iso", "front"]) {
      setViews(ps, view);
      ps[0].frame("focus", { animate: false });
      settle(ps, 1);
      const tz = ps.map((p) => p.cameraState().target[2]);
      assert.ok(Math.max(...tz) - Math.min(...tz) < 1e-3, `${arrange} ${view}: targets ${tz.map((v) => v.toFixed(3))}`);
      assertAligned(ps, `${arrange} ${view} not following`);
    }
  });
}
