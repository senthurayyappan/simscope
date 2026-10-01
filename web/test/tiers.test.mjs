import assert from "node:assert/strict";
import test from "node:test";

import { pickNearest, rayToSphere } from "../src/core/picking.js";
import { chooseFocus, CROWD_ABOVE, focusCapacity, isTiered, MAX_FOCUS, MAX_PINNED } from "../src/core/tiers.js";

/** Env origins on a grid `cols` wide, `spacing` apart. */
function grid(n, cols, spacing = 2) {
  const o = new Float32Array(3 * n);
  for (let e = 0; e < n; e++) {
    o[3 * e] = (e % cols) * spacing;
    o[3 * e + 1] = Math.floor(e / cols) * spacing;
  }
  return o;
}

test("tiers switch on above 64 envs", () => {
  assert.equal(CROWD_ABOVE, 64);
  assert.equal(isTiered(64), false);
  assert.equal(isTiered(65), true);
  assert.equal(isTiered(1), false);
});

test("capacity: the triangle budget over triangles per env, capped and never zero", () => {
  assert.equal(focusCapacity(10, 18_000), 10, "small runs draw every env");
  assert.equal(focusCapacity(4096, 400_000), 12, "G1-like: 5M / 400k");
  assert.equal(focusCapacity(4096, 1_670_000), 2, "CAD-like");
  assert.equal(focusCapacity(4096, 9_000_000), 1, "one env is always drawn");
  assert.equal(focusCapacity(4096, 1000), MAX_FOCUS, "cheap robots are capped");
  assert.equal(focusCapacity(100, 1000), MAX_FOCUS);
  assert.equal(focusCapacity(4096, 100_000, 1_000_000), 10, "custom budget");
});

test("focus: selected first, then pinned, then the nearest envs", () => {
  const origins = grid(4096, 64);
  const f = chooseFocus({ nEnvs: 4096, selected: 2080, pinned: [5, 4000], origins, capacity: 12 });
  assert.equal(f[0], 2080);
  assert.deepEqual(f.slice(1, 3), [5, 4000]);
  assert.equal(f.length, 12);
  assert.equal(new Set(f).size, 12, "no duplicates");
  // the rest are the nearest by origin distance
  const d = (e) => Math.hypot(origins[3 * e] - origins[3 * 2080], origins[3 * e + 1] - origins[3 * 2080 + 1]);
  const chosen = f.slice(3).map(d);
  const farthestChosen = Math.max(...chosen);
  const others = Array.from({ length: 4096 }, (_, e) => e).filter((e) => !f.includes(e));
  assert.ok(others.every((e) => d(e) >= farthestChosen), "nothing nearer was left out");
});

test("focus: a capacity of 1 is just the selected env; pins cap at four", () => {
  assert.deepEqual(chooseFocus({ nEnvs: 100, selected: 7, pinned: [1, 2, 3], capacity: 1 }), [7]);
  const f = chooseFocus({ nEnvs: 100, selected: 0, pinned: [1, 2, 3, 4, 5, 6, 7], capacity: 50, origins: grid(100, 10) });
  assert.deepEqual(f.slice(1, 1 + MAX_PINNED), [1, 2, 3, 4]);
  assert.ok(f.length === 50);
});

test("focus: ignores invalid, duplicate and selected pins; without origins it is index distance", () => {
  const f = chooseFocus({ nEnvs: 20, selected: 10, pinned: [10, 10, -1, 99, 2.5, 3], capacity: 5 });
  assert.equal(f[0], 10);
  assert.equal(f[1], 3);
  assert.deepEqual(f.slice(2).sort((a, b) => a - b), [9, 11, 8].sort((a, b) => a - b).slice(0, 3));
});

test("focus is stable: same inputs, same set and order", () => {
  const o = grid(500, 25);
  const a = chooseFocus({ nEnvs: 500, selected: 123, pinned: [9], origins: o, capacity: 16 });
  const b = chooseFocus({ nEnvs: 500, selected: 123, pinned: [9], origins: o, capacity: 16 });
  assert.deepEqual(a, b);
});

// ---- picking ----

test("ray to sphere: hit, miss, grazing, behind, inside", () => {
  assert.equal(rayToSphere(0, 0, 0, 1, 0, 0, 5, 0, 0, 1), 4);
  assert.equal(rayToSphere(0, 0, 0, 1, 0, 0, 5, 2, 0, 1), null);
  assert.ok(Math.abs(rayToSphere(0, 0, 0, 1, 0, 0, 5, 1, 0, 1) - 5) < 1e-9, "tangent");
  assert.equal(rayToSphere(0, 0, 0, 1, 0, 0, -5, 0, 0, 1), null, "behind the origin");
  assert.equal(rayToSphere(0, 0, 0, 1, 0, 0, 0.5, 0, 0, 1), 1.5, "origin inside: exit point");
});

test("pick the nearest of several overlapping env roots along the ray", () => {
  const roots = Float32Array.of(10, 0, 0, 4, 0, 0, 7, 0.5, 0, 4, 9, 0);
  assert.equal(pickNearest([0, 0, 0, 1, 0, 0], roots, 4, 1), 1);
  assert.equal(pickNearest([4, 3, 0, 0, 1, 0], roots, 4, 1), 3);
  assert.equal(pickNearest([0, 5, 0, 1, 0, 0], roots, 4, 1), null);
  assert.equal(pickNearest([0, 0.5, 0, 1, 0, 0], roots, 4, [0.1, 0.1, 1, 0.1]), 2, "per-env radii");
});

test("picking 4,096 envs is fast (CPU ray-to-sphere, no Raycaster)", () => {
  const n = 4096;
  const roots = grid(n, 64, 2.5);
  const t0 = performance.now();
  for (let i = 0; i < 200; i++) pickNearest([100 + (i % 7), 50, 10, 0, 0, -1], roots, n, 0.5);
  const ms = (performance.now() - t0) / 200;
  console.log(`# pickNearest 4096 envs: ${ms.toFixed(3)} ms`);
  assert.ok(ms < 1, `${ms} ms per pick`);
});
