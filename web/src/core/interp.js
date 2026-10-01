// Pose interpolation between two recorded frames.
//
// Data at 50 Hz on a 60 or 120 Hz display would otherwise show the same
// frame two or three times in a row and then step, which reads as judder and
// makes a camera locked to the robot visibly stutter. Positions lerp;
// quaternions nlerp (normalised lerp) after flipping to the same hemisphere:
// q and -q are the same rotation, and a writer's sign continuity (spec §1)
// is not guaranteed across a block boundary or for q16d round-off.

/**
 * out[o .. o+7n) = poses between rows a0[s0 ..] and a1[s1 ..] at fraction `t`.
 *
 * @param {Float32Array} out  destination.
 * @param {number} o  destination offset.
 * @param {Float32Array} a0  pose rows of the earlier frame, `n` poses of 7 floats from `s0`.
 * @param {number} s0
 * @param {Float32Array} a1  pose rows of the later frame (may be the same array).
 * @param {number} s1
 * @param {number} t  0 at frame 0 (earlier), 1 at frame 1 (later).
 * @param {number} n  number of poses (bodies).
 */
export function lerpPoses(out, o, a0, s0, a1, s1, t, n) {
  if (t <= 1e-4) {
    for (let i = 0, k = 7 * n; i < k; i++) out[o + i] = a0[s0 + i];
    return;
  }
  if (t >= 1 - 1e-4) {
    for (let i = 0, k = 7 * n; i < k; i++) out[o + i] = a1[s1 + i];
    return;
  }
  const u = 1 - t;
  for (let b = 0; b < n; b++, o += 7, s0 += 7, s1 += 7) {
    out[o] = a0[s0] * u + a1[s1] * t;
    out[o + 1] = a0[s0 + 1] * u + a1[s1 + 1] * t;
    out[o + 2] = a0[s0 + 2] * u + a1[s1 + 2] * t;
    const x0 = a0[s0 + 3], y0 = a0[s0 + 4], z0 = a0[s0 + 5], w0 = a0[s0 + 6];
    let x1 = a1[s1 + 3], y1 = a1[s1 + 4], z1 = a1[s1 + 5], w1 = a1[s1 + 6];
    if (x0 * x1 + y0 * y1 + z0 * z1 + w0 * w1 < 0) {
      x1 = -x1;
      y1 = -y1;
      z1 = -z1;
      w1 = -w1;
    }
    const x = x0 * u + x1 * t, y = y0 * u + y1 * t, z = z0 * u + z1 * t, w = w0 * u + w1 * t;
    const len = Math.hypot(x, y, z, w);
    if (len > 1e-12) {
      out[o + 3] = x / len;
      out[o + 4] = y / len;
      out[o + 5] = z / len;
      out[o + 6] = w / len;
    } else {
      // Opposite quaternions half-way: any rotation is as good as another.
      out[o + 3] = x0;
      out[o + 4] = y0;
      out[o + 5] = z0;
      out[o + 6] = w0;
    }
  }
}

/** Which frames a time falls between: `{f0, f1, t}` into `out`, clamped to the run. */
export function frameSpan(time, dt, nFrames, out) {
  const x = time / dt + 1e-6;
  let f0 = Math.floor(x);
  if (f0 < 0) f0 = 0;
  const last = nFrames - 1;
  if (f0 >= last) {
    out.f0 = out.f1 = Math.max(last, 0);
    out.t = 0;
    return out;
  }
  out.f0 = f0;
  out.f1 = f0 + 1;
  out.t = Math.min(Math.max(x - 1e-6 - f0, 0), 1);
  return out;
}

/** Yaw (rotation about +z, radians) of the xyzw quaternion at `a[s+3 ..]`. */
export function yawOf(a, s) {
  const x = a[s + 3], y = a[s + 4], z = a[s + 5], w = a[s + 6];
  return Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z));
}
