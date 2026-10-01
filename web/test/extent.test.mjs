import assert from "node:assert/strict";
import test from "node:test";

import { boxBounds, buildExtent, fitHeight, MARGIN, NEAR, REACH } from "../src/core/extent.js";

// A scene of three bodies: the world (0), a torso that moves (1) and a foot
// that moves with it (2). Poses are [T, 3, 7].
const B = 3;
function runOf(T, torso, foot = () => [0, 0, -0.2]) {
  const poses = new Float32Array(T * B * 7);
  for (let t = 0; t < T; t++) {
    const k = t * B * 7;
    poses[k + 6] = 1; // world
    const [x, y, z] = torso(t);
    poses.set([x, y, z, 0, 0, 0, 1], k + 7);
    const [fx, fy, fz] = foot(t);
    poses.set([x + fx, y + fy, z + fz, 0, 0, 0, 1], k + 14);
  }
  return poses;
}
const box = (body, c, h, axes = [1, 0, 0, 0, 1, 0, 0, 0, 1]) => ({ body, c, axes, h });
const torso = box(1, [0, 0, 0], [0.3, 0.1, 0.05]);
const foot = box(2, [0, 0, 0], [0.05, 0.05, 0.1]); // hangs 0.2 below the torso: reaches down to 0.3 below it
const jump = (t) => [0.01 * t, 0, 0.3 + 0.7 * Math.sin((Math.PI * t) / 99)]; // 0.3 m up to 1.0 m and back

const wall = box(0, [0.5, 0, 0.6], [0.1, 0.5, 0.6]); // x 0.4..0.6, y +-0.5, top 1.2
const slab = box(0, [0, 0, -0.5], [50, 50, 0.5]); // a floor slab: top at 0
const far = box(0, [20, 0, 1], [0.1, 0.5, 1]); // a wall 20 m off the path

const extent = (o = {}) => buildExtent({ poses: runOf(100, jump), T: 100, B, follow: 1, origin: [0, 0, 0], boxes: [torso, foot, wall], ...o });

test("a jump: the range runs from the ground to the highest part of the robot, and covers a higher wall", () => {
  const e = extent({ boxes: [torso, foot] });
  // The foot hangs 0.2 below the torso and reaches 0.1 further; the torso box is 0.05 thick.
  assert.ok(Math.abs(e.rz[0] - (0.3 - 0.3)) < 2e-4 && Math.abs(e.rz[1] - (1.0 + 0.05)) < 2e-4, `robot range ${e.rz}`);
  assert.equal(e.zlo, Math.min(0, e.rz[0]), "the ground is always in");
  assert.ok(Math.abs(e.zhi - e.rz[1]) < 1e-9);
  assert.ok(Math.abs(e.Rxy - Math.hypot(0.3, 0.1)) < 0.02, `radius ${e.Rxy}: the torso box is 0.3 by 0.1 about the followed body`);
  const w = extent();
  assert.ok(Math.abs(w.zhi - Math.max(w.rz[1], 1.2)) < 1e-6, "the wall's top (1.2) is in when it is the higher");
  assert.equal(w.corners.length, 12, "four corners of the wall's top");
  assert.deepEqual(Array.from(w.corners.filter((_, i) => i % 3 === 2)).map((z) => +z.toFixed(5)), [1.2, 1.2, 1.2, 1.2]);
  const tall = extent({ boxes: [torso, foot, box(0, [0.5, 0.3, 1], [0.1, 0.1, 1])] });
  assert.ok(Math.abs(tall.zhi - 2) < 1e-6, "a 2 m wall sets the top");
});

test("the robot's range is its geometry, not a sphere about the followed body: a foot that swings up raises it", () => {
  const swing = extent({ poses: runOf(100, () => [0, 0, 0.5], (t) => [0, 0, t === 40 ? 0.6 : -0.2]), boxes: [torso, foot] });
  assert.ok(Math.abs(swing.rz[1] - (0.5 + 0.6 + 0.1)) < 1e-4, `${swing.rz}`);
  assert.ok(Math.abs(swing.rz[0] - (0.5 - 0.2 - 0.1)) < 1e-4);
  // A robot with nothing drawn gets room around its body.
  const bare = extent({ boxes: [wall] });
  assert.ok(bare.rz[1] > bare.rz[0] + 0.3 && bare.Rxy >= 0.3);
});

test("a robot below the ground (a pit) lowers the range; a robot above it does not raise zlo above 0", () => {
  const pit = extent({ poses: runOf(100, (t) => [0.01 * t, 0, -0.5 + 0.001 * t]), boxes: [torso, foot] });
  assert.ok(pit.zlo < -0.5, `zlo ${pit.zlo}`);
  const flat = extent({ poses: runOf(100, () => [0, 0, 0.5]), boxes: [torso, foot] });
  assert.equal(flat.zlo, 0);
});

test("static geometry counts when it is near the path and above the ground, and is not part of the robot", () => {
  assert.equal(extent({ boxes: [torso, foot, far] }).corners.length, 0, "a wall 20 m away is not near the path");
  assert.equal(extent({ boxes: [torso, foot, slab] }).corners.length, 0, "a floor slab is the ground");
  // Near is measured from the path's box plus NEAR plus the robot's radius.
  const e = extent();
  const edge = 1.0 + NEAR + e.Rxy;
  assert.equal(extent({ boxes: [torso, foot, box(0, [edge - 0.05, 0, 1], [0.1, 0.1, 1])] }).corners.length, 12, "just inside the neighbourhood");
  assert.equal(extent({ boxes: [torso, foot, box(0, [edge + 0.2, 0, 1], [0.1, 0.1, 1])] }).corners.length, 0, "just outside");
  assert.equal(extent({ boxes: [box(1, [0, 0, 0], [0.3, 0.1, 0.05])] }).corners.length, 0, "the followed body's own geoms are the robot");
  assert.equal(extent({ boxes: [torso, box(2, [0, 0, 0], [0.1, 0.1, 0.1])] }).corners.length, 0, "the foot moves: it is the robot too");
});

test("a wide wall is clipped to the neighbourhood, so corners far down a long wall do not blow the fit up", () => {
  const long = box(0, [0.5, 0, 0.6], [0.1, 40, 0.6]);
  const e = extent({ boxes: [torso, foot, long] });
  const ys = Array.from(e.corners).filter((_, i) => i % 3 === 1);
  assert.ok(Math.max(...ys.map(Math.abs)) <= NEAR + e.Rxy + 1e-5, `y reaches ${Math.max(...ys.map(Math.abs))}`);
});

test("a body that is still for the whole run is scenery; one that moves only at the end is not", () => {
  const T = 50;
  const poses = runOf(T, (t) => [0.01 * t, 0, 0.5]);
  const b2 = (t, v) => poses.set(v, t * B * 7 + 14);
  for (let t = 0; t < T; t++) b2(t, [0.2, 0, 0.1, 0, 0, 0, 1]); // the foot stands still
  const at = (boxes) => buildExtent({ poses, T, B, follow: 1, origin: [0, 0, 0], boxes });
  const crate = box(2, [0, 0, 0], [0.1, 0.1, 0.3]);
  assert.equal(at([torso, crate]).corners.length, 12, "a still body's top is geometry");
  b2(T - 1, [0.2, 0, 0.1004, 0, 0, 0, 1]); // 0.4 mm in the last frame is movement
  assert.equal(at([torso, crate]).corners.length, 0);
  b2(T - 1, [0.2, 0, 0.1, 0.0, 0.0, 0.0, -1]); // the same rotation with the quaternion's sign flipped
  assert.equal(at([torso, crate]).corners.length, 12, "q and -q are one rotation");
});

test("a prop thrown far from the robot is not the robot", () => {
  const poses = runOf(100, () => [0, 0, 0.5], (t) => [0, 0, t < 50 ? -0.2 : 5]);
  const e = extent({ poses, boxes: [torso, foot] });
  assert.ok(e.rz[1] < 1, `${e.rz}: the foot at 5 m above does not count`);
});

test("the env origin moves everything: path, heights and walls", () => {
  const e = extent({ origin: [10, 5, 0.2] });
  assert.ok(Math.abs(e.rz[0] - 0.2) < 2e-4);
  assert.ok(Math.abs(e.xs[0] - 10) < 1e-5 && Math.abs(e.ys[0] - 5) < 1e-5);
  assert.equal(e.corners.length, 12, "the wall is in the env's frame, so it moves too");
  assert.ok(Math.abs(e.corners[0] - 10.4) < 1e-4 && Math.abs(e.corners[1] - 4.5) < 1e-4, `${e.corners[0]}, ${e.corners[1]}`);
});

test("boxBounds: an oriented box carried by a posed body", () => {
  const s = Math.SQRT1_2;
  const poses = Float32Array.of(1, 2, 3, 0, 0, s, s); // 90 degrees about z
  const b = boxBounds(box(0, [1, 0, 0], [0.5, 0.1, 0.2]), poses, 0, [0, 0, 10]);
  // The body turns the box's centre (1, 0, 0) to (0, 1, 0) and its long x axis to y.
  const near = (a, e) => a.every((v, i) => Math.abs(v - e[i]) < 1e-5);
  assert.ok(near(b.lo, [1 - 0.1, 2 + 1 - 0.5, 13 - 0.2]), b.lo);
  assert.ok(near(b.hi, [1 + 0.1, 2 + 1 + 0.5, 13 + 0.2]), b.hi);
});

// ---- the fit ----

/** View vectors for a camera at azimuth az and elevation el looking at the origin, z up. */
function upOf(az, el) {
  const d = [Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el)];
  const f = d.map((v) => -v);
  let r = [f[1], -f[0], 0]; // fwd x z
  const n = Math.hypot(r[0], r[1]);
  r = r.map((v) => v / n);
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  return u;
}

test("side and front views: the world height is the vertical range with the margin", () => {
  const e = extent();
  for (const az of [0, Math.PI / 2]) {
    const [ux, uy, uz] = upOf(az, 0);
    const zc = (e.zlo + e.zhi) / 2;
    const h = fitHeight(e, zc, ux, uy, uz, 4 / 3);
    assert.ok(Math.abs(h - (e.zhi - e.zlo) * MARGIN) < 1e-5, `${h} vs ${(e.zhi - e.zlo) * MARGIN}`);
  }
});

test("every point the fit promises is on screen, in any view, and the fit does not ask for much more", () => {
  const poses = runOf(100, (t) => [0.01 * t, 0.003 * t, 0.3 + 0.7 * Math.sin((Math.PI * t) / 99)]);
  const e = extent({ poses });
  const zc = (e.zlo + e.zhi) / 2;
  for (const az of [0, 0.7, 1.9, 3.3, 5.1]) {
    for (const el of [0, 0.2, 0.5236, 0.9, 1.3, Math.PI / 2 - 1e-3]) {
      const [ux, uy, uz] = upOf(az, el);
      const h = fitHeight(e, zc, ux, uy, uz, 4 / 3);
      let worst = 0;
      const F = (t) => [poses[t * 21 + 7], poses[t * 21 + 8]];
      for (let t = 0; t < e.T; t++) {
        // The target is on the robot in x and y and at zc. The robot's two boxes' corners, the ground below it, the wall's top corners.
        for (const bx of [torso, foot]) {
          const { lo, hi } = boxBounds(bx, poses, t * 21 + 7 * bx.body, [0, 0, 0]);
          for (const x of [lo[0], hi[0]]) for (const y of [lo[1], hi[1]]) for (const z of [lo[2], hi[2]]) {
            const [fx, fy] = F(t);
            worst = Math.max(worst, Math.abs(ux * (x - fx) + uy * (y - fy) + uz * (z - zc)));
          }
        }
        worst = Math.max(worst, Math.abs(uz * zc));
        for (let i = 0; i < e.corners.length; i += 3) {
          const row = ux * (e.corners[i] - e.xs[t]) + uy * (e.corners[i + 1] - e.ys[t]) + uz * (e.corners[i + 2] - zc);
          worst = Math.max(worst, Math.abs(row));
        }
      }
      const need = worst * 2 * MARGIN;
      assert.ok(need <= h + 1e-6, `az ${az} el ${el}: needs ${need}, fit ${h}`);
      // Not tight: the fit treats the robot as a column of radius Rxy, so it can be a little more.
      const slack = 2 * e.Rxy * MARGIN;
      assert.ok(h <= Math.max(need + slack, (2 * e.Rxy * MARGIN) / (4 / 3)), `az ${az} el ${el}: the fit ${h} is far from what is needed (${need})`);
    }
  }
});

test("a narrow viewport is limited by the robot's width, a wide one by its height", () => {
  const e = extent();
  const zc = (e.zlo + e.zhi) / 2;
  const [ux, uy, uz] = upOf(0, 0);
  const wide = fitHeight(e, zc, ux, uy, uz, 16 / 9);
  const narrow = fitHeight(e, zc, ux, uy, uz, 0.1);
  assert.ok(Math.abs(wide - (e.zhi - e.zlo) * MARGIN) < 1e-5);
  assert.ok(Math.abs(narrow - (2 * e.Rxy * MARGIN) / 0.1) < 1e-5, `${narrow}`);
});

test("constants: the robot's reach is a metre and the margin 10 %", () => {
  assert.equal(REACH, 1);
  assert.equal(MARGIN, 1.1);
});
