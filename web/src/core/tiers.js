// Focus and crowd tiers (viewer v3 §6).
//
// Above CROWD_ABOVE envs the player draws only a focus set of envs in full
// detail (their own geoms, interpolation, follow, contacts, plots) and every
// other env as one instanced proxy posed by the derived root-pose stream.
// At or below it, every env is in the focus set and there is no crowd: the
// same code path at small E.

export const CROWD_ABOVE = 64;
export const MAX_PINNED = 4;
export const MAX_FOCUS = 64; // also caps instance buffers for cheap robots
export const DEFAULT_TRIANGLE_BUDGET = 5_000_000;

/** Whether a run of `nEnvs` envs uses the two tiers. */
export function isTiered(nEnvs) {
  return nEnvs > CROWD_ABOVE;
}

/** How many envs fit in the focus tier: the triangle budget over triangles per env. */
export function focusCapacity(nEnvs, trianglesPerEnv, budget = DEFAULT_TRIANGLE_BUDGET) {
  if (!isTiered(nEnvs)) return nEnvs;
  const fit = Math.floor(budget / Math.max(trianglesPerEnv, 1));
  return Math.min(Math.max(fit, 1), MAX_FOCUS, nEnvs);
}

/**
 * The focus set: the selected env first, then up to MAX_PINNED pinned envs,
 * then the envs nearest to the selected one, until `capacity` envs.
 *
 * Nearness is measured between env origins (static, so the set does not churn
 * as the robots move); `origins` holds 3 floats per env.
 *
 * @param {object} p
 * @param {number} p.nEnvs
 * @param {number} p.selected
 * @param {number[]} [p.pinned]
 * @param {Float32Array | number[]} [p.origins]
 * @param {number} p.capacity
 * @returns {number[]}
 */
export function chooseFocus({ nEnvs, selected, pinned = [], origins, capacity }) {
  const cap = Math.max(1, Math.min(capacity, nEnvs));
  const out = [];
  const seen = new Set();
  const take = (e) => {
    if (out.length < cap && e >= 0 && e < nEnvs && Number.isInteger(e) && !seen.has(e)) {
      seen.add(e);
      out.push(e);
    }
  };
  take(selected);
  // Pins that are not valid envs do not use up the four.
  const valid = pinned.filter((e) => Number.isInteger(e) && e >= 0 && e < nEnvs && e !== selected);
  for (const e of [...new Set(valid)].slice(0, MAX_PINNED)) take(e);
  if (out.length >= cap) return out;
  const ox = origins ? origins[3 * selected] : 0;
  const oy = origins ? origins[3 * selected + 1] : 0;
  const oz = origins ? origins[3 * selected + 2] : 0;
  // Partial selection of the `cap` nearest: sort candidate (distance, index)
  // pairs. O(E log E) once per selection change, not per frame.
  const dist = new Float64Array(nEnvs);
  const order = new Int32Array(nEnvs);
  for (let e = 0; e < nEnvs; e++) {
    order[e] = e;
    dist[e] = origins
      ? (origins[3 * e] - ox) ** 2 + (origins[3 * e + 1] - oy) ** 2 + (origins[3 * e + 2] - oz) ** 2
      : Math.abs(e - selected);
  }
  order.sort((a, b) => dist[a] - dist[b] || a - b);
  for (let i = 0; i < nEnvs && out.length < cap; i++) take(order[i]);
  return out;
}
