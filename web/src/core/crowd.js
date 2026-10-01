// The crowd tier: every env as one instanced box proxy (one draw call at any
// number of envs), posed by the root body's pose and sized to the robot's
// frame-0 bounding box. Envs that are drawn in full (the focus tier) are
// hidden here so the two tiers never double-draw. `instanceColor` carries a
// per-env scalar (a summaries column) so thousands of envs read at a glance.

import { BoxGeometry, Color, DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh, MeshStandardMaterial, SRGBColorSpace } from "three";

const NEUTRAL = "#8d99ae";
// Viridis, sampled: perceptually even, colour-blind safe, legible on light and dark.
const RAMP = ["#440154", "#3b528b", "#21918c", "#5ec962", "#fde725"].map((c) => new Color().setStyle(c, SRGBColorSpace));

/** The ramp colour at `u` in [0, 1], written into `out`. */
export function rampColor(u, out) {
  const x = Math.min(Math.max(u, 0), 1) * (RAMP.length - 1);
  const i = Math.min(Math.floor(x), RAMP.length - 2);
  return out.copy(RAMP[i]).lerp(RAMP[i + 1], x - i);
}

/**
 * @param {number} nEnvs
 * @param {[number, number, number]} size  proxy box size in the root body's frame (m).
 */
export function createCrowd(nEnvs, size) {
  const geometry = new BoxGeometry(1, 1, 1);
  const material = new MeshStandardMaterial({ roughness: 0.75, metalness: 0 });
  const mesh = new InstancedMesh(geometry, material, nEnvs);
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.instanceMatrix.array.fill(0);
  mesh.frustumCulled = false;
  const neutral = new Color().setStyle(NEUTRAL, SRGBColorSpace);
  mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(nEnvs * 3), 3);
  for (let e = 0; e < nEnvs; e++) neutral.toArray(mesh.instanceColor.array, 3 * e);
  mesh.instanceColor.needsUpdate = true;
  const m = mesh.instanceMatrix.array;
  const [sx, sy, sz] = size;

  /**
   * Pose every proxy. `poses` holds 7 floats per env (root pose in env
   * coordinates), `origins` 3 per env, `hidden[e]` nonzero to skip an env.
   */
  function update(poses, origins, hidden) {
    for (let e = 0, p = 0, o = 0; e < nEnvs; e++, p += 7, o += 16) {
      if (hidden[e]) {
        m.fill(0, o, o + 16);
        continue;
      }
      const x = poses[p + 3], y = poses[p + 4], z = poses[p + 5], w = poses[p + 6];
      const xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
      m[o] = (1 - 2 * (yy + zz)) * sx;
      m[o + 1] = 2 * (xy + wz) * sx;
      m[o + 2] = 2 * (xz - wy) * sx;
      m[o + 3] = 0;
      m[o + 4] = 2 * (xy - wz) * sy;
      m[o + 5] = (1 - 2 * (xx + zz)) * sy;
      m[o + 6] = 2 * (yz + wx) * sy;
      m[o + 7] = 0;
      m[o + 8] = 2 * (xz + wy) * sz;
      m[o + 9] = 2 * (yz - wx) * sz;
      m[o + 10] = (1 - 2 * (xx + yy)) * sz;
      m[o + 11] = 0;
      m[o + 12] = poses[p] + origins[3 * e];
      m[o + 13] = poses[p + 1] + origins[3 * e + 1];
      m[o + 14] = poses[p + 2] + origins[3 * e + 2];
      m[o + 15] = 1;
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Colour by a per-env column. `better` decides which end of the ramp is
   * "good" (high: bright). Null values restore the single neutral colour.
   */
  function setColors(values, better = "high") {
    const c = new Color();
    const arr = mesh.instanceColor.array;
    if (!values || values.length !== nEnvs) {
      for (let e = 0; e < nEnvs; e++) neutral.toArray(arr, 3 * e);
    } else {
      let lo = Infinity, hi = -Infinity;
      for (let e = 0; e < nEnvs; e++) {
        const v = values[e];
        if (Number.isFinite(v)) {
          lo = Math.min(lo, v);
          hi = Math.max(hi, v);
        }
      }
      const span = hi > lo ? hi - lo : 1;
      for (let e = 0; e < nEnvs; e++) {
        const v = values[e];
        if (!Number.isFinite(v)) neutral.toArray(arr, 3 * e);
        else rampColor(better === "low" ? 1 - (v - lo) / span : (v - lo) / span, c).toArray(arr, 3 * e);
      }
    }
    mesh.instanceColor.needsUpdate = true;
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
    mesh.dispose();
  }

  return { mesh, update, setColors, dispose };
}
