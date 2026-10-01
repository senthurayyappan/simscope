// Framing from the whole run (viewer v3.1, trajectory-aware follow).
//
// Position follow holds the camera at one height and follows the robot in x
// and y. Fitting that to frame 0 crops a robot that jumps, climbs a crate or
// vaults a wall. So the vertical framing comes from the run: the vertical
// range of the robot's geometry over the run (the followed body and what moves
// with it, sampled), the ground (z = 0) and the tops of the static geometry
// near the robot's path. The camera holds the centre of that range and shows
// all of it.
//
// Pure functions of a decoded env (no three.js, no DOM), so Node tests them.
//
// Why a full fit is not just "(zhi - zlo) x margin": in an oblique view
// (iso) a metre of z is only cos(elevation) metres on screen, and a wall that
// stands beside the path is not at the camera target's depth, so its top
// shifts on screen with the robot's position. `fitHeight` evaluates the exact
// screen rows for the camera's up vector. In the side and front views that
// reduces to the z range.

/** How far a robot's bodies reach from the followed body, m. A prop thrown farther away is not the robot. */
export const REACH = 1.0;
/** Static geometry within this of the robot's path (plus its radius) counts, m. */
export const NEAR = 1.0;
/** Margin around the extent: the view shows 10% more than it needs. */
export const MARGIN = 1.1;
/** Room around a followed body that has no drawn geometry to measure, m. */
const NO_GEOMETRY = 0.3;
/** Static boxes considered; a scene with more keeps the first of them. */
const MAX_BOXES = 256;
/** A body that moves less than this over the run is static. */
const EPS_POS = 1e-4;
const EPS_QUAT = 1e-6;
/** Static geometry whose top is lower than this is ground. */
const GROUND_TOP = 0.05;

/** Row-major rotation matrix of the unit quaternion (x, y, z, w). */
function quatToMat(x, y, z, w) {
  const xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
  return [1 - 2 * (yy + zz), 2 * (xy - wz), 2 * (xz + wy), 2 * (xy + wz), 1 - 2 * (xx + zz), 2 * (yz - wx), 2 * (xz - wy), 2 * (yz + wx), 1 - 2 * (xx + yy)];
}

const _lo = [0, 0, 0], _hi = [0, 0, 0];

/**
 * World axis-aligned bounds of an oriented box carried by a body: `box` is
 * `{c, axes, h}` in the body frame (centre; the box's axes as the columns of
 * a column-major 3x3; half extents), the body is at `p` with quaternion `q`
 * (both read from `poses` at `at`), the env origin is `origin`. Written to
 * `lo` and `hi` (new arrays if not given).
 *
 * @returns {{lo: number[], hi: number[]}}
 */
export function boxBounds(box, poses, at, origin, lo = [0, 0, 0], hi = [0, 0, 0]) {
  const R = quatToMat(poses[at + 3], poses[at + 4], poses[at + 5], poses[at + 6]);
  const a = box.axes;
  for (let i = 0; i < 3; i++) {
    const centre = poses[at + i] + origin[i] + R[3 * i] * box.c[0] + R[3 * i + 1] * box.c[1] + R[3 * i + 2] * box.c[2];
    let half = 0;
    for (let j = 0; j < 3; j++) {
      // (R * axes)[i][j], with axes column-major: element (k, j) is a[3 * j + k]
      const m = R[3 * i] * a[3 * j] + R[3 * i + 1] * a[3 * j + 1] + R[3 * i + 2] * a[3 * j + 2];
      half += Math.abs(m) * box.h[j];
    }
    lo[i] = centre - half;
    hi[i] = centre + half;
  }
  return { lo, hi };
}

/** Frames at most this many are looked at for the robot's geometry (the followed body's highest and lowest are always among them). */
const MAX_SAMPLES = 1024;

/**
 * The extent of a run for the followed body of one env.
 *
 * @param {object} o
 * @param {Float32Array} o.poses  every frame of the env, `[T, B, 7]`.
 * @param {number} o.T  frames.
 * @param {number} o.B  bodies.
 * @param {number} o.follow  the followed body.
 * @param {ArrayLike<number>} o.origin  the env's origin (x, y, z).
 * @param {Array<{body: number, c: number[], axes: number[], h: number[]}>} o.boxes  the scene's drawn non-plane geoms as oriented boxes in their body's frame.
 * @returns {object} `{zlo, zhi, rz, Rxy, xs, ys, corners, T}`: the vertical
 *   range to show (the robot's geometry over the run, the ground, the tops of
 *   the static geometry near the path), the robot's own range `rz`, the
 *   horizontal radius `Rxy` of its geometry around the followed body, its
 *   path, and the top corners (x, y, z triples) of the static geometry near
 *   the path.
 */
export function buildExtent({ poses, T, B, follow, origin, boxes }) {
  const K = B * 7;
  // Which bodies move at all: the others are scenery (the world, a wall, a crate).
  const moving = new Uint8Array(B);
  for (let t = 1; t < T; t++) {
    const o = t * K;
    for (let b = 0; b < B; b++) {
      if (moving[b]) continue;
      const i = o + 7 * b, j = 7 * b;
      if (Math.abs(poses[i] - poses[j]) > EPS_POS || Math.abs(poses[i + 1] - poses[j + 1]) > EPS_POS || Math.abs(poses[i + 2] - poses[j + 2]) > EPS_POS) {
        moving[b] = 1;
        continue;
      }
      const dot = poses[i + 3] * poses[j + 3] + poses[i + 4] * poses[j + 4] + poses[i + 5] * poses[j + 5] + poses[i + 6] * poses[j + 6];
      if (1 - Math.abs(dot) > EPS_QUAT) moving[b] = 1;
    }
  }

  // The followed body's path.
  const xs = new Float32Array(T), ys = new Float32Array(T);
  let zmin = Infinity, zmax = -Infinity, xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
  let tLow = 0, tHigh = 0;
  for (let t = 0; t < T; t++) {
    const o = t * K + 7 * follow;
    const x = poses[o] + origin[0], y = poses[o + 1] + origin[1], z = poses[o + 2] + origin[2];
    xs[t] = x;
    ys[t] = y;
    if (z < zmin) {
      zmin = z;
      tLow = t;
    }
    if (z > zmax) {
      zmax = z;
      tHigh = t;
    }
    if (x < xmin) xmin = x;
    if (x > xmax) xmax = x;
    if (y < ymin) ymin = y;
    if (y > ymax) ymax = y;
  }

  // The robot's geometry: every drawn geom of the followed body and of the
  // bodies that move with it (not a prop thrown far away), as world boxes on
  // sampled frames. Its vertical range is exact; horizontally it is a radius.
  const robot = boxes.filter((b) => b.body === follow || moving[b.body]);
  let rzmin = zmin, rzmax = zmax, Rxy = 0.05;
  const step = Math.max(1, Math.floor(T / MAX_SAMPLES));
  const sample = (t) => {
    const f = t * K + 7 * follow;
    const fx = poses[f] + origin[0], fy = poses[f + 1] + origin[1];
    for (const box of robot) {
      const at = t * K + 7 * box.body;
      if (box.body !== follow && Math.hypot(poses[at] - poses[f], poses[at + 1] - poses[f + 1], poses[at + 2] - poses[f + 2]) > REACH) continue;
      boxBounds(box, poses, at, origin, _lo, _hi);
      if (_lo[2] < rzmin) rzmin = _lo[2];
      if (_hi[2] > rzmax) rzmax = _hi[2];
      const dx = Math.max(Math.abs(_lo[0] - fx), Math.abs(_hi[0] - fx)), dy = Math.max(Math.abs(_lo[1] - fy), Math.abs(_hi[1] - fy));
      const r = Math.hypot(dx, dy);
      if (r > Rxy) Rxy = r;
    }
  };
  for (let t = 0; t < T; t += step) sample(t);
  sample(T - 1);
  sample(tLow);
  sample(tHigh);
  if (!robot.length) {
    // Nothing of the robot is drawn (or it has no geoms we can bound): give the body some room.
    rzmin = zmin - NO_GEOMETRY;
    rzmax = zmax + NO_GEOMETRY;
    Rxy = NO_GEOMETRY;
  }

  // Static geometry near the path: its top face, clipped to the neighbourhood.
  const m = NEAR + Rxy;
  const nlo = [xmin - m, ymin - m], nhi = [xmax + m, ymax + m];
  const corners = [];
  let top = -Infinity;
  let used = 0;
  for (const box of boxes) {
    if (moving[box.body] || box.body === follow) continue;
    if (++used > MAX_BOXES) break;
    boxBounds(box, poses, 7 * box.body, origin, _lo, _hi);
    if (_hi[2] < GROUND_TOP) continue;
    if (_hi[0] < nlo[0] || _lo[0] > nhi[0] || _hi[1] < nlo[1] || _lo[1] > nhi[1]) continue;
    const x0 = Math.max(_lo[0], nlo[0]), x1 = Math.min(_hi[0], nhi[0]);
    const y0 = Math.max(_lo[1], nlo[1]), y1 = Math.min(_hi[1], nhi[1]);
    corners.push(x0, y0, _hi[2], x1, y0, _hi[2], x0, y1, _hi[2], x1, y1, _hi[2]);
    if (_hi[2] > top) top = _hi[2];
  }

  return {
    zlo: Math.min(0, rzmin),
    zhi: Math.max(rzmax, top),
    rz: [rzmin, rzmax],
    Rxy,
    xs,
    ys,
    corners: Float32Array.from(corners),
    T,
  };
}

/**
 * The world height (metres on screen, top to bottom) that shows `ext` with
 * the camera target held at height `zc`, for a view whose up vector is
 * `(ux, uy, uz)`, in a viewport of the given width / height ratio.
 *
 * With the target on the robot in x and y, a point at offset `d` from the
 * robot and height `z` is at screen row `u . d_xy + uz (z - zc)` from the
 * centre. The robot is a column: its z range exactly, its radius `Rxy`
 * across; the ground under it is a point; a wall's top corners move with the
 * robot along the path.
 */
export function fitHeight(ext, zc, ux, uy, uz, aspect, margin = MARGIN) {
  let half = Math.max(Math.abs(uz * (ext.rz[0] - zc)), Math.abs(uz * (ext.rz[1] - zc))) + ext.Rxy * Math.hypot(ux, uy);
  half = Math.max(half, Math.abs(uz * zc)); // the ground under the robot
  const c = ext.corners;
  if (c.length) {
    let pmin = Infinity, pmax = -Infinity;
    for (let t = 0; t < ext.T; t++) {
      const v = ux * ext.xs[t] + uy * ext.ys[t];
      if (v < pmin) pmin = v;
      if (v > pmax) pmax = v;
    }
    for (let i = 0; i < c.length; i += 3) {
      const v = ux * c[i] + uy * c[i + 1];
      const z = uz * (c[i + 2] - zc);
      half = Math.max(half, Math.abs(v - pmax + z), Math.abs(v - pmin + z));
    }
  }
  const tall = 2 * half * margin;
  const wide = (2 * ext.Rxy * margin) / Math.max(aspect, 1e-3);
  return Math.max(tall, wide, 0.1);
}
