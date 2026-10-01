// Linked cameras: ground alignment. See headless.mjs for how players run
// without WebGL.

import assert from "node:assert/strict";
import test from "node:test";

import { assertAligned, Clock, groundRows, linkCameras, makeWalkerPack, nullRenderer, pane, PackSource, panes, Player, SPECS, setViews, settle, W, H, DT } from "./headless.mjs";

test("linked panes put world z = 0 on the same screen row in iso, front, side and top views", async () => {
  const players = await panes(4);
  const standing = players.map((p) => p.standingHeight());
  assert.ok(Math.max(...standing) - Math.min(...standing) > 0.5, "the robots start at different heights");
  linkCameras(players);
  players[0].clock.seek(0.8);
  for (const view of ["iso", "front", "side", "top"]) {
    setViews(players, view);
    settle(players);
    assertAligned(players, view);
    const xy = players.map((p) => [p.followPt.x, p.followPt.y]);
    assert.ok(new Set(xy.map((a) => a.join())).size === 4, "at different positions");
  }
});

test("without alignment the rows differ: the test can fail", async () => {
  const players = await panes(2);
  linkCameras(players, { alignGround: false });
  players[0].clock.seek(0.8);
  setViews(players, "front");
  settle(players);
  const [a, b] = groundRows(players);
  assert.ok(Math.abs(a - b) > 10, `unaligned ground rows ${a.toFixed(1)} and ${b.toFixed(1)}`);
});

test("the ground stays aligned at any time of the run", async () => {
  const players = await panes(2);
  linkCameras(players);
  setViews(players, "side");
  const clock = players[0].clock;
  for (const t of [0.2, 0.9, 1.6]) {
    clock.seek(t);
    settle(players, 1);
    assertAligned(players, `t = ${t}`);
  }
});

test("the shared height is the middle of the union of the runs' ranges, in position, pose and heading follow", async () => {
  const players = await panes(3);
  linkCameras(players);
  const exts = players.map((p) => p._extent());
  const zc = (Math.min(...exts.map((e) => e.zlo)) + Math.max(...exts.map((e) => e.zhi))) / 2;
  setViews(players, "front");
  players[0].clock.seek(0.5);
  for (const mode of ["position", "pose", "heading"]) {
    players.forEach((p) => p.setFollow({ mode }));
    settle(players);
    for (const p of players) assert.ok(Math.abs(p.cameraState().target[2] - zc) < 1e-3, `${mode}: target z ${p.cameraState().target[2]} vs ${zc}`);
    if (mode !== "heading") assertAligned(players, mode);
  }
});

test("until the runs are decoded the first player's standing height is shared, then it switches once to the runs' extent", async () => {
  const clock = new Clock();
  const ps = [];
  let open;
  const gate = new Promise((r) => (open = r));
  for (const spec of SPECS.slice(0, 2)) {
    const p = new Player(null, { renderer: nullRenderer, clock });
    p.resize(W, H, 1);
    // The run has three windows; the later two arrive when the gate opens.
    const source = new PackSource(makeWalkerPack({ ...spec, T: 250 }));
    const blocks = source.blocks.bind(source);
    source.blocks = async (path, w, envs) => {
      if (w > 0) await gate;
      return blocks(path, w, envs);
    };
    await p.load(source, spec.run);
    ps.push(p);
  }
  linkCameras(ps);
  assert.equal(ps[0]._extent(), undefined, "still decoding");
  const z = ps[0].standingHeight();
  settle(ps);
  for (const p of ps) assert.ok(Math.abs(p.cameraState().target[2] - z) < 1e-3, "frame-0 fit: the first player's standing height");
  assertAligned(ps, "before the series are decoded");
  const before = ps.map((p) => p.rig.targetHeight);
  open();
  await Promise.all(ps.map((p) => p._extentJob));
  settle(ps);
  assert.ok(ps[0]._extent() && ps[1]._extent());
  const after = ps.map((p) => p.rig.targetHeight);
  assert.ok(Math.abs(after[0] - after[1]) < 1e-9, "one height for both");
  assert.notEqual(after[0], before[0], "and it is the runs', not frame 0's");
  assertAligned(ps, "after");
  // Once: nothing moves the height again.
  settle(ps);
  assert.ok(Math.abs(ps[0].rig.targetHeight - after[0]) < 1e-12);
});

test("a user orbit or zoom in one pane carries to the others and the ground stays aligned", async () => {
  const players = await panes(3);
  linkCameras(players);
  settle(players, 1);
  const [first, , last] = players;
  last.rig.controls.rotateTo(0.9, 1.05, false);
  last.rig.controls.zoomTo(2.5, true); // a wheel zoom: reported once, then it animates
  last.rig.userChanged = true;
  last.update(DT);
  settle(players, 1.5);
  assert.ok(Math.abs(first.rig.azimuth - last.rig.azimuth) < 1e-6, "same azimuth");
  const heights = players.map((p) => p.rig.height);
  assert.ok(Math.max(...heights) - Math.min(...heights) < 1e-6, `same world height: ${heights}`);
  assertAligned(players, "after an orbit and zoom");
});

test("frame() on any pane frames all of them to the largest height any needs, at one held height", async () => {
  const players = await panes(3);
  linkCameras(players);
  setViews(players, "iso");
  players[2].frame("focus", { animate: false });
  settle(players, 1);
  const heights = players.map((p) => p.rig.height);
  assert.ok(Math.max(...heights) - Math.min(...heights) < 1e-6, `same world height: ${heights}`);
  const zc = players[0].linked.zc;
  assert.ok(zc !== null);
  for (const p of players) {
    assert.ok(heights[0] >= p._fitHeight(zc) - 1e-6, "no pane needs more than it got");
    assert.ok(Math.abs(p.cameraState().target[2] - zc) < 1e-3);
  }
  assert.ok(players.some((p) => Math.abs(p._fitHeight(zc) - heights[0]) < 1e-6), "and the largest need is exactly met");
  assertAligned(players, "after frame()");
});

test("loading a run into a linked pane frames the group again, with the leader's orbit", async () => {
  const clock = new Clock();
  const a = await pane(clock, SPECS[0], { view: "front" });
  const b = await pane(clock, SPECS[2], { view: "side" });
  linkCameras([a, b]);
  assert.ok(Math.abs(a.rig.azimuth - b.rig.azimuth) < 1e-6, "linking takes the leader's orbit");
  await b.load(new PackSource(makeWalkerPack(SPECS[1])), "b");
  await b._extentJob;
  settle([a, b]);
  assert.ok(Math.abs(a.rig.azimuth - b.rig.azimuth) < 1e-6, "still the leader's orbit");
  assert.ok(Math.abs(a.rig.height - b.rig.height) < 1e-6, "same height");
  assertAligned([a, b], "after the swap");
});

test("linking before the runs load works too: the panes align when the last one arrives", async () => {
  const clock = new Clock();
  const ps = [0, 1].map(() => new Player(null, { renderer: nullRenderer, clock }));
  ps.forEach((p) => p.resize(W, H, 1));
  linkCameras(ps);
  await ps[1].load(new PackSource(makeWalkerPack(SPECS[1])), "b");
  await ps[0].load(new PackSource(makeWalkerPack(SPECS[0])), "a");
  await Promise.all(ps.map((p) => p._extentJob));
  setViews(ps, "side");
  settle(ps);
  assertAligned(ps, "late load");
  assert.ok(Math.abs(ps[0].rig.height - ps[1].rig.height) < 1e-6);
});

test("unlinking gives every pane its own camera height and held height back", async () => {
  const players = await panes(2);
  const unlink = linkCameras(players);
  unlink();
  assert.ok(players.every((p) => p.linked === null));
  setViews(players, "front");
  settle(players);
  const [a, b] = groundRows(players);
  assert.ok(Math.abs(a - b) > 10, "independent again");
  const [ea, eb] = players.map((p) => p._extent());
  for (const [p, e] of [[players[0], ea], [players[1], eb]]) assert.ok(Math.abs(p.cameraState().target[2] - (e.zlo + e.zhi) / 2) < 1e-3, "each holds the middle of its own range");
});

test("batched runs link too: one env follows and holds the shared height, and frame() acts on every pane", async () => {
  for (const envs of [3, 70]) {
    const clock = new Clock();
    const ps = [];
    for (const spec of SPECS.slice(0, 2)) {
      const p = new Player(null, { renderer: nullRenderer, clock });
      p.resize(W, H, 1);
      await p.load(new PackSource(makeWalkerPack({ ...spec, envs })), spec.run);
      await p._extentJob;
      ps.push(p);
    }
    assert.equal(ps[0].info().tiered, envs > 64);
    linkCameras(ps);
    assert.equal(ps[0].follow().mode, "off", "batched runs start without follow");
    ps.forEach((p) => p.setFollow({ mode: "position" }));
    setViews(ps, "front");
    ps[0].frame("focus", { animate: false });
    clock.seek(0.6);
    settle(ps);
    assert.ok(Math.abs(ps[0].rig.height - ps[1].rig.height) < 1e-6, `${envs} envs: same height`);
    assertAligned(ps, `${envs} envs`);
  }
});
