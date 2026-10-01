// Players run headless: a null renderer, no canvas, camera-controls without
// input. The tests drive `update()` by hand, so they exercise the real load,
// pose, follow and camera paths of the core. Shared by the compare, framing
// and pan tests.

import assert from "node:assert/strict";
import { Vector3 } from "three";

// camera-controls builds DOMRects in its constructor; Node has none.
globalThis.DOMRect ??= class {
  constructor(x = 0, y = 0, width = 0, height = 0) {
    Object.assign(this, { x, y, width, height, left: x, top: y, right: x + width, bottom: y + height });
  }
};

export const { Clock } = await import("../src/core/clock.js");
export const { linkCameras } = await import("../src/core/compare.js");
export const { Player } = await import("../src/core/player.js");
export const { PackSource } = await import("../src/core/source.js");
import { makeWalkerPack, nullRenderer } from "./fixtures.mjs";

export { makeWalkerPack, nullRenderer };
export const W = 400, H = 300;
export const DT = 1 / 60;

/** Robots that start at different heights and positions, and move differently. */
export const SPECS = [
  { run: "a", start: [0, 0, 0.28], vel: [0.6, 0, 0] },
  { run: "b", start: [2, -1.5, 0.55], vel: [0, 0.4, 0.05], scale: 1.6 },
  { run: "c", start: [-3, 1, 0.9], vel: [0.2, 0.2, 0], scale: 0.8 },
  { run: "d", start: [0.5, 3, 0.15], vel: [-0.3, 0, 0] },
];

/** A pane on `clock` with `spec` loaded; resolves once its run's extent is known. */
export async function pane(clock, spec, opts = {}) {
  const p = new Player(null, { renderer: nullRenderer, clock, ...opts });
  p.resize(W, H, 1);
  await p.load(new PackSource(makeWalkerPack(spec)), spec.run);
  await p._extentJob;
  return p;
}

export async function panes(n, opts) {
  const clock = new Clock();
  const out = [];
  for (const spec of SPECS.slice(0, n)) out.push(await pane(clock, spec, opts));
  return out;
}

/** Step every player's frame loop for `seconds` of wall time. */
export function settle(players, seconds = 2) {
  for (let t = 0; t < seconds; t += DT) for (const p of players) p.update(DT);
}

/** Screen position, in pixels from the top left of the canvas, of a world point. */
export function project(p, x, y, z) {
  p.camera.updateMatrixWorld(true);
  const v = new Vector3(x, y, z).project(p.camera);
  return [((v.x + 1) / 2) * p.cssWidth, ((1 - v.y) / 2) * p.cssHeight];
}

/** Rows of (robot_x, robot_y, 0) for each player: where the ground is under its robot. */
export function groundRows(players) {
  return players.map((p) => project(p, p.followPt.x, p.followPt.y, 0)[1]);
}

export function assertAligned(players, what, tol = 1) {
  const rows = groundRows(players);
  const spread = Math.max(...rows) - Math.min(...rows);
  assert.ok(spread <= tol, `${what}: ground rows ${rows.map((r) => r.toFixed(2)).join(", ")} differ by ${spread.toFixed(2)} px`);
}

export const setViews = (players, view) => players.forEach((p) => p.setView(view, { animate: false }));

/**
 * A user's right-button drag in `p`, by the same code path camera-controls
 * runs: controlstart, a truck of (x, y) screen metres (right, down), control,
 * controlend.
 */
export function drag(p, x, y) {
  const c = p.rig.controls;
  c.dispatchEvent({ type: "controlstart" });
  c.truck(x, y, true);
  c.dispatchEvent({ type: "control" });
  c.dispatchEvent({ type: "controlend" });
}

/** Pixel size of one metre of the shown world in `p`. */
export const pxPerMetre = (p) => p.cssHeight / p.rig.height;
