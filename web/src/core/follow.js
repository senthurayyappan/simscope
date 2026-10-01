// Follow-camera maths, free of three.js and of the DOM so Node can test it.
//
// Follow is critically damped: the camera target chases the followed body's
// interpolated position with `smoothTime` of about 0.12 s (Unity's SmoothDamp,
// the same filter camera-controls uses for its own transitions). A critically
// damped target never overshoots, and it low-passes both the gait wobble of
// the body and any hiccup in frame timing, which is what makes follow read as
// smooth. Follow happens in the same tick as the pose update, on the render
// thread, so camera and robot never disagree by a frame.

export const FOLLOW_SMOOTH_TIME = 0.12;

/**
 * The held camera height (position follow) moves to a new value with this
 * smooth time, about 250 ms to settle: the same as a camera preset, so a
 * framing change and the zoom that goes with it arrive together.
 */
export const HOLD_SMOOTH_TIME = 0.08;

/**
 * Body names that make a robot's root, in priority order. The same rule is
 * `simscope.highlights.root_body` in Python (contracts §5), which picks the
 * body of the derived root-pose stream; the two must agree, or the crowd
 * proxies would follow another body than the camera does.
 */
export const FOLLOW_ALIASES = ["torso", "base", "trunk", "pelvis", "chassis"];

/**
 * The followed (root) body of a scene: the first of FOLLOW_ALIASES by exact
 * name (case-insensitive), then the first by prefix, else the first body that
 * is not the world.
 *
 * @param {string[]} names  body names in scene order.
 * @returns {number} a body index.
 */
export function rootBody(names) {
  const lower = names.map((n) => String(n).toLowerCase());
  for (const exact of [true, false]) {
    for (const wanted of FOLLOW_ALIASES) {
      const at = lower.findIndex((n) => (exact ? n === wanted : n.startsWith(wanted)));
      if (at >= 0) return at;
    }
  }
  const at = lower.findIndex((n) => n !== "world");
  return at >= 0 ? at : 0;
}

/** State of one damped scalar: value and velocity. */
export function makeDamper(value = 0) {
  return { x: value, v: 0 };
}

/**
 * Advance `d` toward `target` by `dt` seconds. Critically damped, no
 * overshoot (the clamp keeps the output on the near side of the target).
 * Returns the new value.
 */
export function smoothDamp(d, target, smoothTime, dt) {
  if (!(dt > 0)) return d.x;
  const st = Math.max(0.0001, smoothTime);
  const omega = 2 / st;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = d.x - target;
  const temp = (d.v + omega * change) * dt;
  d.v = (d.v - omega * temp) * exp;
  let out = target + (change + temp) * exp;
  if (target - d.x > 0 === out > target) {
    out = target;
    d.v = 0;
  }
  d.x = out;
  return out;
}

/** Shortest signed difference `b - a` of two angles, in (-pi, pi]. */
export function angleDelta(a, b) {
  let d = (b - a) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  else if (d <= -Math.PI) d += 2 * Math.PI;
  return d;
}

/**
 * Damp an angle toward `target` along the short way round. `d.x` stays
 * continuous (it may leave (-pi, pi]) so the camera never spins backwards.
 */
export function smoothDampAngle(d, target, smoothTime, dt) {
  return smoothDamp(d, d.x + angleDelta(d.x, target), smoothTime, dt);
}

/** A follow target: three dampers for x, y, z. */
export function makeFollower() {
  return { x: makeDamper(), y: makeDamper(), z: makeDamper(), yaw: makeDamper(), primed: false };
}

/** Put the follower exactly on a point (first frame, seeks, env switches). */
export function snapFollower(f, x, y, z, yaw = 0) {
  f.x.x = x; f.x.v = 0;
  f.y.x = y; f.y.v = 0;
  f.z.x = z; f.z.v = 0;
  f.yaw.x = yaw; f.yaw.v = 0;
  f.primed = true;
}

/**
 * Step the follower toward a point. A jump of more than `snapDistance`
 * (a seek, another env) snaps instead of sweeping across the scene.
 * Returns true if it snapped.
 */
export function stepFollower(f, x, y, z, yaw, dt, smoothTime = FOLLOW_SMOOTH_TIME, snapDistance = Infinity) {
  if (!f.primed || Math.hypot(x - f.x.x, y - f.y.x, z - f.z.x) > snapDistance) {
    snapFollower(f, x, y, z, yaw);
    return true;
  }
  smoothDamp(f.x, x, smoothTime, dt);
  smoothDamp(f.y, y, smoothTime, dt);
  smoothDamp(f.z, z, smoothTime, dt);
  smoothDampAngle(f.yaw, yaw, smoothTime, dt);
  return false;
}
