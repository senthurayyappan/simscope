// A pan is shared between linked panes as a camera-relative offset. See
// headless.mjs for how players run without WebGL and how a drag is made.

import assert from "node:assert/strict";
import test from "node:test";

import { assertAligned, Clock, drag, DT, linkCameras, makeWalkerPack, nullRenderer, PackSource, pane, panes, Player, project, pxPerMetre, SPECS, setViews, settle, W, H } from "./headless.mjs";

const MODES = ["position", "pose", "heading", "off"];
const VIEWS = ["iso", "front", "side", "top"];

/** Where each pane shows its robot, in pixels. */
const robots = (players) => players.map((p) => project(p, p.followPt.x, p.followPt.y, p.followPt.z));

async function linked(n, mode, view, opts) {
  const ps = await panes(n, opts);
  linkCameras(ps, opts && opts.link);
  ps.forEach((p) => p.setFollow({ mode }));
  setViews(ps, view);
  ps[0].clock.seek(0.5);
  settle(ps, 1.5);
  return ps;
}

const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a.toFixed(2)} vs ${b.toFixed(2)}`);

for (const mode of MODES) {
  for (const view of VIEWS) {
    test(`a pan in one pane moves every linked pane by the same pixels: ${mode} follow, ${view} view`, async () => {
      const ps = await linked(3, mode, view);
      const before = robots(ps);
      const groundBefore = ps.map((p) => project(p, p.followPt.x, p.followPt.y, 0)[1]);
      drag(ps[1], 0.3, -0.2); // screen metres: right, down
      ps[1].update(DT);
      settle(ps, 1.5);
      const after = robots(ps);
      const d = after.map(([c, r], i) => [c - before[i][0], r - before[i][1]]);
      assert.ok(Math.hypot(...d[0]) > 20, `the pan is visible: ${d[0].map((v) => v.toFixed(1))} px`);
      d.forEach((v, i) => {
        near(v[0], d[0][0], 1, `pane ${i} dx`);
        near(v[1], d[0][1], 1, `pane ${i} dy`);
      });
      // And it is the pan: the robot moves opposite to the target.
      const [a, b] = [ps[0].pan.a, ps[0].pan.b];
      const ppm = pxPerMetre(ps[0]);
      near(d[0][0], -a * ppm, 1.5, "dx is -pan.right in pixels");
      near(d[0][1], b * ppm, 1.5, "dy is +pan.up in pixels");
      near(Math.hypot(a, b), Math.hypot(0.3, 0.2), 1e-6, "the drag's length, in metres");
      ps.forEach((p, i) => near(p.pan.a, a, 1e-9, `pane ${i} shares the offset`));
      if (mode !== "off") {
        // The ground stays on one row, including after a vertical pan.
        assertAligned(ps, `${mode} ${view} after the pan`);
        const g = ps.map((p) => project(p, p.followPt.x, p.followPt.y, 0)[1]);
        near(g[0] - groundBefore[0], b * ppm, 1.5, "the ground moved by the vertical pan");
      }
    });
  }
}

test("a pan survives playback: after a run of frames every pane still shows its robot at the shared offset", async () => {
  for (const mode of ["position", "heading"]) {
    const ps = await linked(2, mode, "side");
    drag(ps[0], -0.25, 0.15);
    ps[0].update(DT);
    settle(ps, 1);
    // Where the robot is across (its height may bob in position follow): the column, and the ground's row.
    const where = () => ps.map((p) => [project(p, p.followPt.x, p.followPt.y, 0)[0], project(p, p.followPt.x, p.followPt.y, 0)[1]]);
    const before = where();
    const clock = ps[0].clock;
    clock.play();
    for (let i = 0; i < 90; i++) {
      clock.tick(1000 + (i * 1000) / 60);
      ps.forEach((p) => p.update(DT));
    }
    clock.pause();
    settle(ps, 1.5);
    const after = where();
    assert.ok(clock.time > 0.5, "time moved");
    after.forEach(([c, r], i) => {
      near(c, before[i][0], 1.5, `${mode} pane ${i} col`);
      near(r, before[i][1], 1.5, `${mode} pane ${i} row`);
    });
    assertAligned(ps, `${mode} after playback`);
  }
});

test("a pan does not pause following: the robot keeps its place on screen while it moves under a drag", async () => {
  const ps = await linked(1, "position", "side");
  const clock = ps[0].clock;
  clock.play();
  let now = 1000;
  const step = () => {
    now += 1000 / 60;
    clock.tick(now);
    ps[0].update(DT);
  };
  for (let i = 0; i < 30; i++) step();
  drag(ps[0], 0.2, 0);
  for (let i = 0; i < 90; i++) {
    step();
    if (i % 10 === 0) drag(ps[0], 0.01, 0); // still dragging
  }
  const pan = ps[0].pan.a;
  assert.ok(Math.abs(pan - (0.2 + 0.09)) < 1e-6, `pan ${pan}`);
  const [c] = project(ps[0], ps[0].followPt.x, ps[0].followPt.y, ps[0].followPt.z);
  near(c, W / 2 - pan * pxPerMetre(ps[0]), 25, "the robot is at centre minus the pan (the follow lags by speed x 0.12 s)");
});

test("two pointer events in one frame add up, and none is counted twice", async () => {
  const ps = await linked(2, "position", "iso");
  drag(ps[0], 0.1, 0.05);
  drag(ps[0], 0.2, -0.1);
  ps[0].update(DT);
  near(ps[0].pan.a, 0.3, 1e-6, "right");
  near(ps[0].pan.b, 0.05, 1e-6, "up (a drag of (0.1, 0.05) and (0.2, -0.1) screen metres right and down)");
});

test("frame() clears the pan in every pane and shows the framed view again", async () => {
  for (const mode of MODES) {
    const ps = await linked(3, mode, "iso");
    const before = robots(ps);
    drag(ps[2], 0.4, 0.3);
    ps[2].update(DT);
    settle(ps, 1);
    assert.ok(ps.every((p) => p.pan.a !== 0 || p.pan.b !== 0));
    ps[0].frame("focus", { animate: false });
    settle(ps, 1.5);
    const after = robots(ps);
    ps.forEach((p, i) => {
      assert.deepEqual([p.pan.a, p.pan.b], [0, 0], `${mode}: pane ${i}`);
      // Following, the framed view is where it was before the pan; not following, it is centred on the robots.
      if (mode !== "off") {
        near(after[i][0], before[i][0], 1, `${mode} pane ${i} col`);
        near(after[i][1], before[i][1], 1, `${mode} pane ${i} row`);
      } else near(after[i][0], W / 2, 25, `${mode} pane ${i} col`);
    });
  }
});

test("setView() clears the pan, as for one pane", async () => {
  for (const mode of ["position", "off"]) {
    const ps = await linked(2, mode, "iso");
    drag(ps[0], 0.4, 0.3);
    ps[0].update(DT);
    settle(ps, 1);
    ps[1].setView("side", { animate: false });
    settle(ps, 1.5);
    ps.forEach((p, i) => assert.deepEqual([p.pan.a, p.pan.b], [0, 0], `${mode}: pane ${i}`));
    setViews(ps, "iso");
    settle(ps, 1.5);
    const single = await pane(new Clock(), SPECS[0]);
    single.setView("iso", { animate: false });
    single.setFollow({ mode });
    drag(single, 0.4, 0.3);
    single.update(DT);
    single.setView("iso", { animate: false });
    assert.deepEqual([single.pan.a, single.pan.b], [0, 0], "and for a pane on its own");
  }
});

test("loading a run into a linked pane keeps the group's pan reset", async () => {
  const ps = await linked(3, "position", "side");
  drag(ps[0], 0.4, 0.3);
  ps[0].update(DT);
  settle(ps, 1);
  await ps[2].load(new PackSource(makeWalkerPack(SPECS[3])), "d");
  await ps[2]._extentJob;
  ps.forEach((p, i) => assert.deepEqual([p.pan.a, p.pan.b], [0, 0], `pane ${i}`));
  settle(ps, 1.5);
  assertAligned(ps, "after the load");
});

test("unlinking gives each pane its own pan back: a drag no longer moves the others", async () => {
  const ps = await panes(2);
  const unlink = linkCameras(ps);
  ps.forEach((p) => p.setFollow({ mode: "position" }));
  setViews(ps, "side");
  settle(ps, 1.5);
  unlink();
  settle(ps, 1.5); // each pane fits its own run again
  const before = robots(ps);
  drag(ps[0], 0.4, 0.3);
  ps[0].update(DT);
  settle(ps, 1.5);
  const after = robots(ps);
  assert.ok(Math.hypot(after[0][0] - before[0][0], after[0][1] - before[0][1]) > 20, "the dragged pane moved");
  near(after[1][0], before[1][0], 0.5, "the other did not (col)");
  near(after[1][1], before[1][1], 0.5, "the other did not (row)");
});

test("linked without ground alignment, pans are shared too (the orbit and zoom are, as ever)", async () => {
  const ps = await linked(2, "position", "side", { link: { alignGround: false } });
  drag(ps[0], 0.3, 0.1);
  ps[0].update(DT);
  settle(ps, 1.5);
  near(ps[1].pan.a, ps[0].pan.a, 1e-9, "the same offset in metres");
  near(ps[1].pan.b, ps[0].pan.b, 1e-9, "both ways");
  near(ps[1].rig.height, ps[0].rig.height, 1e-6, "and the zoom");
  const [a, b] = robots(ps);
  near(a[0], b[0], 1, "each robot is where the shared pan puts it (col)");
  near(a[0], W / 2 - ps[0].pan.a * pxPerMetre(ps[0]), 1.5, "at centre minus the pan");
});

test("the camera state carries the pan, and a state round-trips through another player", async () => {
  for (const mode of ["position", "off"]) {
    const a = await pane(new Clock(), SPECS[0]);
    const b = await pane(new Clock(), SPECS[1]);
    for (const p of [a, b]) {
      p.setFollow({ mode });
      p.setView("front", { animate: false });
    }
    settle([a, b], 1.5);
    drag(a, 0.25, -0.1);
    a.update(DT);
    const state = JSON.parse(JSON.stringify(a.cameraState()));
    assert.deepEqual(state.pan, [a.pan.a, a.pan.b]);
    near(state.pan[0], 0.25, 1e-6, "right");
    near(state.pan[1], 0.1, 1e-6, "up");
    const before = project(b, b.followPt.x, b.followPt.y, b.followPt.z);
    b.setCameraState(state);
    settle([b], 1.5);
    const after = project(b, b.followPt.x, b.followPt.y, b.followPt.z);
    near(b.pan.a, a.pan.a, 1e-9, `${mode} pan a`);
    near(b.pan.b, a.pan.b, 1e-9, `${mode} pan b`);
    near(after[0] - before[0], -a.pan.a * pxPerMetre(b), 1.5, `${mode} dx`);
    // The state of a pane round-trips onto itself.
    a.setCameraState(a.cameraState());
    settle([a], 1);
    near(a.pan.a, state.pan[0], 1e-9, "own state");
  }
});

test("a state without a pan (older, or from elsewhere) puts a camera that is not following at its absolute target", async () => {
  const p = await pane(new Clock(), SPECS[0]);
  p.setFollow({ mode: "off" });
  settle([p], 1);
  const state = p.cameraState();
  delete state.pan;
  state.target = [5, 6, 7];
  p.setCameraState(state);
  assert.deepEqual(p.cameraState().target.map((v) => +v.toFixed(6)), [5, 6, 7]);
  assert.deepEqual([p.pan.a, p.pan.b], [0, 0]);
  // After that a pan is relative to the new place.
  drag(p, 0.2, 0);
  p.update(DT);
  assert.ok(p.cameraState().target[0] !== 5 || p.cameraState().target[1] !== 6);
});

test("pan sync needs the pan in the camera state (mutation check)", async () => {
  const ps = await linked(2, "position", "side");
  const [a, b] = ps;
  // Receive states with the pan removed, as if cameraState() did not carry it.
  const original = a.cameraState.bind(a);
  a.cameraState = () => {
    const s = original();
    delete s.pan;
    return s;
  };
  const before = robots(ps);
  drag(a, 0.3, 0.1);
  a.update(DT);
  settle(ps, 1.5);
  const after = robots(ps);
  const moved = Math.hypot(after[1][0] - before[1][0], after[1][1] - before[1][1]);
  assert.ok(moved < 1, "the other pane does not move without it");
  assert.ok(Math.hypot(after[0][0] - before[0][0], after[0][1] - before[0][1]) > 10, "the dragged pane did");
});
