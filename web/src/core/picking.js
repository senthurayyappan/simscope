// Picking an env by a CPU ray-to-sphere test against the env roots.
//
// three's Raycaster on an InstancedMesh tests every instance's triangles (or
// a stale bounding sphere when instances move), which is far too slow at
// thousands of envs. One sphere per env at its root is ~0.1 ms for 4,096.

/**
 * Distance along the ray to the first intersection with a sphere, or null.
 * The direction must be unit length.
 */
export function rayToSphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const lx = cx - ox, ly = cy - oy, lz = cz - oz;
  const tc = lx * dx + ly * dy + lz * dz;
  const d2 = lx * lx + ly * ly + lz * lz - tc * tc;
  const r2 = r * r;
  if (d2 > r2) return null;
  const half = Math.sqrt(r2 - d2);
  const t = tc - half;
  if (t >= 0) return t;
  return tc + half >= 0 ? tc + half : null; // origin inside the sphere
}

/**
 * The env whose root sphere the ray hits first (nearest along the ray).
 *
 * @param {ArrayLike<number>} ray  `[ox, oy, oz, dx, dy, dz]`.
 * @param {Float32Array} roots  3 floats per env (world root positions).
 * @param {number} nEnvs
 * @param {number | ArrayLike<number>} radius  sphere radius (shared, or per env).
 * @returns {number | null}
 */
export function pickNearest(ray, roots, nEnvs, radius) {
  let best = null;
  let bestT = Infinity;
  const per = typeof radius !== "number";
  for (let e = 0; e < nEnvs; e++) {
    const t = rayToSphere(ray[0], ray[1], ray[2], ray[3], ray[4], ray[5], roots[3 * e], roots[3 * e + 1], roots[3 * e + 2], per ? radius[e] : radius);
    if (t !== null && t < bestT) {
      bestT = t;
      best = e;
    }
  }
  return best;
}
