import assert from "node:assert/strict";
import test from "node:test";

import { frameSpan, lerpPoses, yawOf } from "../src/core/interp.js";

const pose = (x, y, z, qx, qy, qz, qw) => Float32Array.of(x, y, z, qx, qy, qz, qw);
const qz = (a) => [0, 0, Math.sin(a / 2), Math.cos(a / 2)];
const angleOf = (q) => 2 * Math.atan2(q[2], q[3]);

test("positions lerp, the ends are exact copies", () => {
  const a = pose(0, 0, 0, 0, 0, 0, 1), b = pose(2, 4, 6, 0, 0, 0, 1);
  const out = new Float32Array(7);
  lerpPoses(out, 0, a, 0, b, 0, 0.25, 1);
  assert.deepEqual(Array.from(out.slice(0, 3)), [0.5, 1, 1.5]);
  lerpPoses(out, 0, a, 0, b, 0, 0, 1);
  assert.deepEqual(Array.from(out), Array.from(a));
  lerpPoses(out, 0, a, 0, b, 0, 1, 1);
  assert.deepEqual(Array.from(out), Array.from(b));
});

test("nlerp of a rotation about z is a unit quaternion at about the middle angle", () => {
  const out = new Float32Array(7);
  const a = pose(0, 0, 0, ...qz(0.2)), b = pose(0, 0, 0, ...qz(1.0));
  lerpPoses(out, 0, a, 0, b, 0, 0.5, 1);
  const len = Math.hypot(out[3], out[4], out[5], out[6]);
  assert.ok(Math.abs(len - 1) < 1e-6);
  assert.ok(Math.abs(angleOf(out.slice(3)) - 0.6) < 1e-3);
});

test("a sign flip between frames interpolates the short way (q and -q are one rotation)", () => {
  const out = new Float32Array(7);
  const q0 = qz(0.3);
  const a = pose(0, 0, 0, ...q0);
  const b = pose(0, 0, 0, ...qz(0.5).map((v) => -v)); // same rotation as 0.5 rad, opposite sign
  lerpPoses(out, 0, a, 0, b, 0, 0.5, 1);
  const ang = angleOf(out.slice(3));
  assert.ok(Math.abs(ang - 0.4) < 1e-3, `expected ~0.4, got ${ang}`);
  // Without the fix the midpoint would be near-zero length or flip to ~pi.
  assert.ok(Math.hypot(out[3], out[4], out[5], out[6]) > 0.99);
});

test("exactly opposite quaternions do not produce NaN", () => {
  const out = new Float32Array(7);
  const a = pose(0, 0, 0, 0, 0, 1, 0), b = pose(0, 0, 0, 0, 0, -1, 0);
  lerpPoses(out, 0, a, 0, b, 0, 0.5, 1);
  assert.ok(Array.from(out).every(Number.isFinite));
  // dot(a, b) = -1 -> flipped b equals a, so the result is a.
  assert.ok(Math.abs(Math.abs(out[5]) - 1) < 1e-6);
});

test("many bodies with offsets into bigger arrays", () => {
  const B = 4;
  const a0 = new Float32Array(3 * B * 7), a1 = new Float32Array(3 * B * 7);
  for (let i = 0; i < 3 * B; i++) {
    a0.set(pose(i, 0, 0, 0, 0, 0, 1), 7 * i);
    a1.set(pose(i + 10, 0, 0, 0, 0, 0, 1), 7 * i);
  }
  const out = new Float32Array(2 * B * 7);
  lerpPoses(out, B * 7, a0, B * 7, a1, B * 7, 0.5, B);
  for (let b = 0; b < B; b++) assert.equal(out[B * 7 + 7 * b], B + b + 5);
  assert.equal(out[0], 0, "earlier slots are untouched");
});

test("frameSpan: floor with tolerance, clamps at both ends", () => {
  const s = { f0: 0, f1: 0, t: 0 };
  frameSpan(0, 0.02, 100, s);
  assert.deepEqual([s.f0, s.f1, s.t], [0, 1, 0]);
  frameSpan(0.5 * 0.02, 0.02, 100, s);
  assert.deepEqual([s.f0, s.f1], [0, 1]);
  assert.ok(Math.abs(s.t - 0.5) < 1e-9);
  // a frame time that floats to just below the integer still lands on it
  frameSpan(49 * 0.02, 0.02, 100, s);
  assert.equal(s.f0, 49);
  assert.ok(s.t < 1e-3);
  frameSpan(1e9, 0.02, 100, s);
  assert.deepEqual([s.f0, s.f1, s.t], [99, 99, 0]);
  frameSpan(-3, 0.02, 100, s);
  assert.equal(s.f0, 0);
  frameSpan(0, 0.02, 1, s);
  assert.deepEqual([s.f0, s.f1, s.t], [0, 0, 0]);
});

test("yawOf recovers the heading", () => {
  for (const a of [-2.5, -0.4, 0, 0.7, 3.0]) {
    const p = pose(0, 0, 0, ...qz(a));
    let d = yawOf(p, 0) - a;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    assert.ok(Math.abs(d) < 1e-5, `a=${a}`);
  }
});
