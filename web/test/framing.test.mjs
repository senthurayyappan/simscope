// Trajectory-aware framing: position follow shows the whole run, not frame 0.
// See headless.mjs for how players run without WebGL.

import assert from "node:assert/strict";
import test from "node:test";

import { assertAligned, Clock, DT, H, linkCameras, makeWalkerPack, nullRenderer, PackSource, Player, project, setViews, settle, W } from "./headless.mjs";

// A robot that jumps from 0.3 m to 1.0 m (the torso) beside a 1.2 m wall.
const WALL = { x: 0.55, y: 0.4, hx: 0.1, hy: 0.2, top: 1.2 };
const JUMPER = { run: "jump", T: 100, path: (t) => [0.3 * t, 0, 0.3 + 0.7 * Math.sin((Math.PI * t) / 2)], walls: [WALL] };
// And one that walks beside a lower wall.
const WALKER = { run: "walk", T: 100, path: (t) => [0.2 * t, 0, 0.25], walls: [{ ...WALL, top: 0.8 }] };

const wallTop = (w) => [
  [w.x - w.hx, w.y - w.hy, w.top],
  [w.x + w.hx, w.y - w.hy, w.top],
  [w.x - w.hx, w.y + w.hy, w.top],
  [w.x + w.hx, w.y + w.hy, w.top],
];

/** The corners of the test robot's bounding box (the torso box and the foot sphere) at the player's followed point. */
function robotBox(p) {
  const { x, y, z } = p.followPt;
  const pts = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) pts.push([x + sx * 0.3, y + sy * 0.1, z + sz * 0.05]);
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) pts.push([x + sx * 0.08, y + sy * 0.08, z - 0.1 + sz * 0.08]);
  return pts;
}

/**
 * The smallest distance, in pixels, of any projected point to the viewport's
 * edges (negative: outside); only the top and bottom edges with `rowsOnly`
 * (a wall can be off to the side: what is promised is that its top is not cut off).
 */
function margin(p, pts, rowsOnly = false) {
  let m = Infinity;
  for (const [x, y, z] of pts) {
    const [c, r] = project(p, x, y, z);
    m = Math.min(m, r, p.cssHeight - r);
    if (!rowsOnly) m = Math.min(m, c, p.cssWidth - c);
  }
  return m;
}

/** At each of `frames` times, settle and check that the robot and the wall's top are on screen. */
function assertInFrame(players, walls, what, frames) {
  let least = Infinity;
  for (const f of frames) {
    players[0].clock.seek(f * 0.02);
    settle(players, 0.8);
    players.forEach((p, i) => {
      const m = Math.min(margin(p, robotBox(p)), margin(p, wallTop(walls[i]), true));
      least = Math.min(least, m);
      assert.ok(m >= 0, `${what}, pane ${i}, frame ${f}: ${m.toFixed(1)} px outside the viewport`);
    });
  }
  return least;
}

const FRAMES = Array.from({ length: 34 }, (_, i) => i * 3); // 0, 3, ..., 99: every third frame of the run
const mk = async (spec, clock, opts) => {
  const p = new Player(null, { renderer: nullRenderer, clock, ...opts });
  p.resize(W, H, 1);
  await p.load(new PackSource(makeWalkerPack(spec)), spec.run);
  await p._extentJob;
  return p;
};

test("a jump to 1.0 m beside a 1.2 m wall stays in frame, in side, front and iso views; so does a wall taller than the jump", async () => {
  // Beside the path; taller than the jump; and a metre off the path, on either side, where in
  // iso its top sits well above or below the robot's row on screen.
  for (const wall of [WALL, { ...WALL, top: 1.9 }, { ...WALL, y: 1.15, hy: 0.15 }, { ...WALL, y: -1.15, hy: 0.15, top: 1.9 }]) {
    const p = await mk({ ...JUMPER, walls: [wall] }, new Clock());
    assert.ok(p._extent().zhi >= wall.top, "the wall's top is in the range");
    for (const view of ["side", "front", "iso"]) {
      p.setView(view, { animate: false });
      settle([p], 1);
      const least = assertInFrame([p], [wall], `${wall.top} m wall at y ${wall.y}, ${view}`, FRAMES);
      assert.ok(least < 40, `${view}: the fit is tight (${least.toFixed(1)} px to spare of ${H})`);
    }
  }
});

test("linked: both panes keep their robots and walls in frame, and the ground rows match", async () => {
  const clock = new Clock();
  const ps = [await mk(JUMPER, clock), await mk(WALKER, clock)];
  linkCameras(ps);
  for (const view of ["side", "iso"]) {
    setViews(ps, view);
    settle(ps, 1);
    assertInFrame(ps, [WALL, { ...WALL, top: 0.8 }], `linked ${view}`, FRAMES);
    assertAligned(ps, `linked ${view}`);
  }
});

test("the held height is the middle of the range and the world height fits it with a 10% margin", async () => {
  const p = await mk(JUMPER, new Clock());
  const e = p._extent();
  assert.ok(e.zhi >= 1.2, "the wall's top is in the range");
  assert.ok(e.zhi >= e.rz[1] - 1e-9 && e.zlo <= 0);
  p.setView("side", { animate: false });
  settle([p], 1.5);
  assert.ok(Math.abs(p.holdZ - (e.zlo + e.zhi) / 2) < 1e-9);
  assert.ok(Math.abs(p.cameraState().target[2] - p.holdZ) < 1e-3);
  assert.ok(Math.abs(p.rig.height - (e.zhi - e.zlo) * 1.1) < 1e-3, `${p.rig.height} vs ${(e.zhi - e.zlo) * 1.1}`);
});

/** A pack source whose later windows wait for `gate`. */
function gated(spec, gate) {
  const source = new PackSource(makeWalkerPack({ ...spec, T: 250, path: (t) => [0.3 * t, 0, 0.3 + 0.7 * Math.sin((Math.PI * t) / 2.5)] }));
  const blocks = source.blocks.bind(source);
  source.blocks = async (path, w, envs) => {
    if (w > 0) await gate.promise;
    return blocks(path, w, envs);
  };
  return source;
}
const gate = () => {
  let open;
  const promise = new Promise((r) => (open = r));
  return { promise, open };
};

test("until the series is decoded the frame-0 fit holds; then one animation of about 250 ms, and no more", async () => {
  const g = gate();
  const p = new Player(null, { renderer: nullRenderer, clock: new Clock() });
  p.resize(W, H, 1);
  await p.load(gated(JUMPER, g), "jump");
  p.setView("side", { animate: false });
  settle([p], 1);
  assert.equal(p._extent(), undefined);
  const h0 = p.rig.height, z0 = p.cameraState().target[2];
  assert.ok(Math.abs(z0 - p.standingHeight()) < 1e-3, "frame 0: held at the standing height");
  g.open();
  await p._extentJob;
  const goal = p.rig.targetHeight;
  assert.ok(goal > h0 * 1.3, `the whole jump needs more than frame 0 (${goal} vs ${h0})`);
  const zGoal = p.holdZ;
  // 250 ms later the height and the target are within 3% of the way there.
  for (let t = 0; t < 0.25; t += DT) p.update(DT);
  assert.ok(Math.abs(p.rig.height - goal) < 0.03 * (goal - h0), `height ${p.rig.height}, goal ${goal}`);
  assert.ok(Math.abs(p.cameraState().target[2] - zGoal) < 0.03 * Math.abs(zGoal - z0) + 1e-3, "target z arrives with it");
  // Then it stays: no refit as the clock runs.
  settle([p], 0.5);
  p.clock.seek(1.2);
  settle([p], 1);
  assert.equal(p.rig.targetHeight, goal);
});

test("the first fit of a run happens at once even if the clock is playing; a later one waits for a pause", async () => {
  const g = gate();
  const p = new Player(null, { renderer: nullRenderer, clock: new Clock() });
  p.resize(W, H, 1);
  await p.load(gated(JUMPER, g), "jump");
  settle([p], 1);
  const h0 = p.rig.targetHeight;
  p.clock.play();
  assert.equal(p.clock.playing, true);
  g.open();
  await p._extentJob;
  assert.ok(p.rig.targetHeight > h0 * 1.3, "the frame-0 view does not stay just because play was pressed first");
  const fitted = p.rig.targetHeight;
  settle([p], 1);
  assert.equal(p.rig.targetHeight, fitted, "and it is one fit");

  // A second env's range arriving during playback waits.
  const batch = new Player(null, { renderer: nullRenderer, clock: new Clock() });
  batch.resize(W, H, 1);
  await batch.load(new PackSource(makeWalkerPack({ ...JUMPER, envs: 3 })), "jump");
  await batch._extentJob;
  batch.setFollow({ mode: "position" });
  assert.equal(batch._fitted, true);
  batch.clock.play();
  batch.selectEnv(1);
  await batch._extentJob;
  assert.equal(batch._fitPending, true, "waits while playing");
  batch.clock.pause();
  assert.equal(batch._fitPending, false, "and fits at the pause");
});

test("a zoom by hand is respected: the extent arriving does not undo it, an explicit frame() does", async () => {
  const g = gate();
  const p = new Player(null, { renderer: nullRenderer, clock: new Clock() });
  p.resize(W, H, 1);
  await p.load(gated(JUMPER, g), "jump");
  p.rig.controls.zoomTo(2, false);
  p.rig.controls.dispatchEvent({ type: "control" }); // a wheel event: not a drag
  assert.equal(p.rig.userZoomed, true);
  settle([p], 0.5);
  const h = p.rig.targetHeight;
  g.open();
  await p._extentJob;
  settle([p], 1);
  assert.equal(p.rig.targetHeight, h);
  p.frame("focus", { animate: false });
  settle([p], 1);
  assert.ok(p.rig.targetHeight > h * 1.5, "frame() shows the run");
  assert.equal(p.rig.userZoomed, false);
});

test("a restored camera state with keep is final: the extent arriving does not undo it", async () => {
  const g = gate();
  const p = new Player(null, { renderer: nullRenderer, clock: new Clock() });
  p.resize(W, H, 1);
  await p.load(gated(JUMPER, g), "jump");
  const state = { ...p.cameraState(), zoom: p.cameraState().zoom * 3 };
  p.setCameraState(state, { animate: false, keep: true });
  settle([p], 0.5);
  const h = p.rig.targetHeight;
  g.open();
  await p._extentJob;
  settle([p], 1);
  assert.equal(p.rig.targetHeight, h, "the saved zoom survives the one-time fit");
});

test("a synced camera state without keep still lets the receiver fit", async () => {
  const g = gate();
  const p = new Player(null, { renderer: nullRenderer, clock: new Clock() });
  p.resize(W, H, 1);
  await p.load(gated(JUMPER, g), "jump");
  p.setCameraState(p.cameraState(), { animate: false });
  assert.equal(p.rig.userZoomed, false);
});

test("choosing a view refits the height for it, unless the user zoomed", async () => {
  const p = await mk(JUMPER, new Clock());
  p.setView("side", { animate: false });
  const side = p.rig.targetHeight;
  p.setView("iso", { animate: false });
  const iso = p.rig.targetHeight;
  assert.ok(Math.abs(side - iso) > 0.05, `side ${side}, iso ${iso}`);
  p.rig.controls.zoomTo(0.5, false);
  p.rig.controls.dispatchEvent({ type: "control" });
  p.setView("side", { animate: false });
  assert.equal(p.rig.targetHeight, p.rig.scale / 0.5, "a manual zoom stays");
});

test("only position follow is framed by the run: pose and off keep the frame-0 fit", async () => {
  const p = await mk(JUMPER, new Clock());
  assert.ok(p.holdZ !== null);
  p.setFollow({ mode: "pose" });
  assert.equal(p._heldZ(), null, "pose follow tracks the body's z");
  settle([p], 1);
  const z = p.followPt.z;
  assert.ok(Math.abs(p.cameraState().target[2] - z) < 1e-3);
  p.setFollow({ mode: "off" });
  p.frame("all", { animate: false });
  assert.equal(p._heldZ(), null);
  p.setFollow({ mode: "position" });
  assert.ok(p.holdZ !== null, "and switching position follow back on fits it once more");
});

test("a live run keeps the frame-0 fit: its future is not known", async () => {
  const pack = makeWalkerPack({ ...JUMPER, T: 100 });
  const p = new Player(null, { renderer: nullRenderer, clock: new Clock() });
  p.resize(W, H, 1);
  // Mark the run as recording: the player reads `status` from the manifest.
  const source = new PackSource(pack);
  const get = source.get.bind(source);
  source.get = async (path) => {
    const bytes = await get(path);
    if (!path.endsWith("rollout.json")) return bytes;
    const m = JSON.parse(new TextDecoder().decode(bytes));
    m.status = "recording";
    return new TextEncoder().encode(JSON.stringify(m));
  };
  await p.load(source, "jump");
  await p._extentJob;
  assert.equal(p._extent(), null);
  assert.equal(p.holdZ, null);
});
