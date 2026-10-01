import assert from "node:assert/strict";
import test from "node:test";
import { Spherical, Vector3 } from "three";

// camera-controls builds DOMRects in its constructor; Node has none.
globalThis.DOMRect ??= class {
  constructor(x = 0, y = 0, width = 0, height = 0) {
    Object.assign(this, { x, y, width, height, left: x, top: y, right: x + width, bottom: y + height });
  }
};

const { CameraRig, viewAngles } = await import("../src/core/camera.js");
import { angleDelta, FOLLOW_SMOOTH_TIME, makeDamper, makeFollower, smoothDamp, smoothDampAngle, stepFollower } from "../src/core/follow.js";

const DT = 1 / 60;

test("a step input converges without overshoot, at any frame rate", () => {
  for (const hz of [30, 60, 120, 144, 240]) {
    const d = makeDamper(0);
    let peak = 0;
    let t = 0;
    for (; t < 2; t += 1 / hz) {
      peak = Math.max(peak, smoothDamp(d, 1, FOLLOW_SMOOTH_TIME, 1 / hz));
    }
    assert.ok(peak <= 1 + 1e-12, `${hz} Hz overshoots: ${peak}`);
    assert.ok(Math.abs(d.x - 1) < 1e-3, `${hz} Hz converges: ${d.x}`);
  }
});

test("about 98% of a step is crossed in three smooth times, the same at 30 and 240 Hz", () => {
  const at = (hz) => {
    const d = makeDamper(0);
    for (let i = 0; i < Math.round(3 * FOLLOW_SMOOTH_TIME * hz); i++) smoothDamp(d, 1, FOLLOW_SMOOTH_TIME, 1 / hz);
    return d.x;
  };
  assert.ok(at(60) > 0.97 && at(60) < 1);
  assert.ok(Math.abs(at(30) - at(240)) < 0.01, "frame rate independent");
});

test("a target moving at constant speed is tracked with a steady lag of about speed x smoothTime", () => {
  const d = makeDamper(0);
  const v = 1.5;
  let t = 0;
  for (; t < 3; t += DT) smoothDamp(d, v * (t + DT), FOLLOW_SMOOTH_TIME, DT);
  const lag = v * t - d.x;
  assert.ok(Math.abs(lag - v * FOLLOW_SMOOTH_TIME) < 0.02, `lag ${lag}`);
  assert.ok(Math.abs(d.v - v) < 1e-2, "velocity matches the target's");
});

test("damping removes frame-to-frame irregularity that a stepped target has", () => {
  // The target advances in 50 Hz steps, sampled at 60 Hz (a floored player).
  const stepped = (t) => Math.floor(t / 0.02 + 1e-6) * 0.02 * 0.8;
  const d = makeDamper(0);
  const out = [];
  const raw = [];
  for (let k = 0; k < 240; k++) {
    const t = k * DT;
    raw.push(stepped(t));
    out.push(smoothDamp(d, stepped(t), FOLLOW_SMOOTH_TIME, DT));
  }
  const accel = (a) => {
    let m = 0;
    for (let i = 2; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - 2 * a[i - 1] + a[i - 2]));
    return m;
  };
  assert.ok(accel(out.slice(30)) < accel(raw.slice(30)) / 4, `${accel(out.slice(30))} vs ${accel(raw.slice(30))}`);
});

test("non-positive dt changes nothing", () => {
  const d = makeDamper(2);
  assert.equal(smoothDamp(d, 5, 0.12, 0), 2);
  assert.equal(smoothDamp(d, 5, 0.12, -1), 2);
});

test("angles take the short way round and stay continuous", () => {
  assert.ok(Math.abs(angleDelta(3.0, -3.0) - (2 * Math.PI - 6.0)) < 1e-9);
  const d = makeDamper(3.0);
  for (let i = 0; i < 120; i++) smoothDampAngle(d, -3.0, FOLLOW_SMOOTH_TIME, DT);
  // -3.0 is 3.0 + (2pi - 6) ahead: the damper must have gone up through pi, not back through 0.
  assert.ok(Math.abs(d.x - (-3.0 + 2 * Math.PI)) < 1e-2, `${d.x}`);
});

test("a jump beyond the snap distance lands at once, a small one is damped", () => {
  const f = makeFollower();
  assert.equal(stepFollower(f, 0, 0, 0, 0, DT, FOLLOW_SMOOTH_TIME, 5), true, "the first point primes it");
  assert.equal(stepFollower(f, 1, 0, 0, 0, DT, FOLLOW_SMOOTH_TIME, 5), false);
  assert.ok(f.x.x > 0 && f.x.x < 1);
  assert.equal(stepFollower(f, 50, 0, 0, 0, DT, FOLLOW_SMOOTH_TIME, 5), true);
  assert.equal(f.x.x, 50);
  assert.equal(f.x.v, 0);
});

// ---- the camera rig (camera-controls under z-up orthographic) ----

const rig = () => new CameraRig(null);
const dirOf = (r) => r.camera.position.clone().sub(r.controls.getTarget(new Vector3(), false)).normalize();

test("named views put the camera where their names say", () => {
  const r = rig();
  r.setTargetNow(0, 0, 0);
  r.setDepth(50, 500);
  const expect = {
    iso: [1, 1, 0.8],
    front: [1, 0, 0],
    side: [0, 1, 0],
  };
  for (const [view, want] of Object.entries(expect)) {
    r.setView(view, false);
    r.update(0.016);
    const n = new Vector3(...want).normalize();
    assert.ok(dirOf(r).distanceTo(n) < 1e-4, `${view}: ${dirOf(r).toArray()}`);
  }
});

test("top view looks straight down with +x to the right and +y up on screen, and keeps z-up", () => {
  const r = rig();
  r.setTargetNow(0, 0, 0);
  r.setDepth(50, 500);
  r.setView("top", false);
  r.update(0.016);
  const cam = r.camera;
  cam.updateMatrixWorld();
  assert.ok(dirOf(r).z > 0.999);
  const right = new Vector3(1, 0, 0).applyQuaternion(cam.quaternion.clone().invert());
  const up = new Vector3(0, 1, 0).applyQuaternion(cam.quaternion.clone().invert());
  assert.ok(right.x > 0.99, `x should be screen-right: ${right.toArray()}`);
  assert.ok(up.y > 0.99, `y should be screen-up: ${up.toArray()}`);
  assert.deepEqual(cam.up.toArray(), [0, 0, 1], "up is never changed");
});

test("a preset animates in about a quarter of a second, the shortest way round", () => {
  const r = rig();
  r.setTargetNow(0, 0, 0);
  r.setDepth(50, 500);
  r.setView("front", false);
  r.update(0.016);
  r.setView("side", true);
  let t = 0;
  let still = -1;
  for (; t < 1.5; t += DT) {
    const moved = r.update(DT);
    if (!moved && still < 0) still = t;
  }
  assert.ok(still > 0.15 && still < 0.9, `settled after ${still}s`);
  assert.ok(dirOf(r).distanceTo(new Vector3(0, 1, 0)) < 1e-3);
  assert.ok(Math.abs(r.controls.getSpherical(new Spherical(), true).theta - viewAngles("side").azimuth) < 1.6, "no full turn");
});

test("camera state round-trips and reproduces the world height between rigs with another scale", () => {
  const a = rig(), b = rig();
  a.setFrame(4, 1.5);
  b.setFrame(8, 1.5);
  a.setTargetNow(1, 2, 3);
  a.setView("front", false);
  a.controls.zoomTo(2, false);
  a.update(0.016);
  const state = JSON.parse(JSON.stringify(a.state(false)));
  b.apply(state, false, true);
  b.update(0.016);
  assert.ok(Math.abs(a.height - 2) < 1e-6);
  assert.ok(Math.abs(b.height - a.height) < 1e-6, `${b.height} vs ${a.height}`);
  assert.ok(dirOf(a).distanceTo(dirOf(b)) < 1e-4);
  assert.ok(b.controls.getTarget(new Vector3(), true).distanceTo(new Vector3(1, 2, 3)) < 1e-9);
  // A following rig keeps its own target.
  const c = rig();
  c.setTargetNow(9, 9, 9);
  c.apply(state, false, false);
  assert.deepEqual(c.controls.getTarget(new Vector3(), true).toArray(), [9, 9, 9]);
});

test("fitRadius sets the zoom so a sphere fills the shorter side", () => {
  const r = rig();
  r.setFrame(3, 2);
  r.fitRadius(1, false, 1);
  r.update(0.016);
  // diameter 2 must fit the shorter side (height): 2 = scale / zoom
  assert.ok(Math.abs(r.height - 2) < 1e-6, `${r.height}`);
  r.setFrame(3, 0.5);
  r.fitRadius(1, false, 1);
  r.update(0.016);
  assert.ok(Math.abs(r.height - 4) < 1e-6, "portrait: the width is the limit");
});

test("setTargetNow moves the camera with the target, keeping the orbit offset (follow)", () => {
  const r = rig();
  r.setDepth(50, 500);
  r.setTargetNow(0, 0, 0);
  r.setView("iso", false);
  r.update(0.016);
  const before = r.camera.position.clone();
  r.setTargetNow(10, -4, 2);
  r.update(0.016);
  const delta = r.camera.position.clone().sub(before);
  assert.ok(delta.distanceTo(new Vector3(10, -4, 2)) < 1e-4, `${delta.toArray()}`);
});

// ---- the followed body: the same rule as Python's highlights.root_body ----

test("root body: exact alias names first, in alias order, then prefixes, else the first non-world body", async () => {
  const { rootBody, FOLLOW_ALIASES } = await import("../src/core/follow.js");
  assert.deepEqual(FOLLOW_ALIASES, ["torso", "base", "trunk", "pelvis", "chassis"]);
  // The cases of tests/test_highlights.py::test_root_body_rules.
  assert.equal(rootBody(["world", "leg", "Torso"]), 2);
  assert.equal(rootBody(["world", "leg", "base_link"]), 2);
  assert.equal(rootBody(["world", "leg", "arm"]), 1);
  assert.equal(rootBody(["trunk"]), 0);
  // An exact name beats an earlier prefix match, and alias order beats body order.
  assert.equal(rootBody(["world", "base_link", "trunk", "torso_2", "torso"]), 4);
  assert.equal(rootBody(["world", "pelvis", "trunk"]), 2, "trunk comes before pelvis in the alias list");
  assert.equal(rootBody(["world", "torso_link", "base"]), 2, "exact `base` beats prefix `torso_*` for every alias");
  assert.equal(rootBody(["world", "pelvis_link", "chassis_2"]), 1, "no exact names: aliases in order, by prefix");
  // Nameless scenes: the first body that is not the world (which may be body 0).
  assert.equal(rootBody(["world", "a", "b"]), 1);
  assert.equal(rootBody(["a", "b"]), 0);
  assert.equal(rootBody(["WORLD", "x"]), 1, "case-insensitive, like Python");
  assert.equal(rootBody(["world"]), 0);
  assert.equal(rootBody([]), 0);
});

test("the player exports the alias list Python's docstring names", async () => {
  const { FOLLOW_ALIASES } = await import("../src/core/player.js");
  assert.equal(FOLLOW_ALIASES[0], "torso");
});
