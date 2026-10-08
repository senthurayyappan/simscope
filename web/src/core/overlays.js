// Optional stream overlays: force arrows (`arrows` streams, including the
// `contacts` stream with its contact points) and predicted polylines
// (`polyline` streams). Arrow proportions follow the gallery's viewer.js
// (artifacts-server static/viewer.js: ARROW_* constants), scaled to the size
// of the robot instead of assuming a human-sized one.
//
// Layers are sized in slots (the focus tier's envs), update in place from a
// decoded row, and allocate nothing per frame.

import {
  BufferAttribute,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  MeshBasicMaterial,
  SphereGeometry,
} from "three";

import { colorOf, paletteOf } from "./theme.js";

const SHAFT_R = 0.013, HEAD_R = 0.034, HEAD_L = 0.07; // metres on a 1.7 m robot
const POINT_R = 0.022;
const REFERENCE_HEIGHT = 1.7;
const ARROW_MAX_HEIGHTS = 3; // clamp an arrow at this many robot heights

/** Contacts are the contact kind's red; every other stream is a neutral grey (theme.js). */
const layerColor = (theme, contacts) => colorOf(contacts ? paletteOf(theme).contact : paletteOf(theme).arrow);

/**
 * K arrows per slot as InstancedMeshes (shaft and head, plus a point at each
 * arrow's origin for contacts).
 *
 * @param {number} nSlots  envs drawn at once.
 * @param {number} k  arrows per env.
 * @param {number} height  robot height (m), for proportions and clamping.
 * @param {number} lengthScale  world metres of arrow per unit of vector.
 * @param {{points?: boolean}} [opts]  `points`: also draw a marker where each arrow starts.
 */
export function createArrowLayer(nSlots, k, height, lengthScale, opts = {}) {
  const unit = Math.max(height, 0.3) / REFERENCE_HEIGHT;
  const maxLen = ARROW_MAX_HEIGHTS * height;
  const count = Math.max(nSlots * k, 1);
  const material = new MeshBasicMaterial({ color: layerColor("light", opts.points) });
  // Both along +z, base at z = 0, unit length.
  const shaftGeo = new CylinderGeometry(1, 1, 1, 10).rotateX(Math.PI / 2).translate(0, 0, 0.5);
  const headGeo = new ConeGeometry(1, 1, 14).rotateX(Math.PI / 2).translate(0, 0, 0.5);
  const shaft = new InstancedMesh(shaftGeo, material, count);
  const head = new InstancedMesh(headGeo, material, count);
  const root = new Group();
  const meshes = [shaft, head];
  let pointGeo = null, points = null, pa = null;
  if (opts.points) {
    pointGeo = new SphereGeometry(1, 10, 8);
    points = new InstancedMesh(pointGeo, material, count);
    pa = points.instanceMatrix.array;
    meshes.push(points);
  }
  for (const m of meshes) {
    m.instanceMatrix.array.fill(0); // three.js starts at identity: hide until placed
    m.instanceMatrix.setUsage(DynamicDrawUsage);
    m.frustumCulled = false;
    root.add(m);
  }
  const sa = shaft.instanceMatrix.array;
  const ha = head.instanceMatrix.array;

  function put(out, o, dx, dy, dz, radius, len, px, py, pz) {
    // Orthonormal basis (bx, by, d) with the arrow along d.
    let ax = 0, ay = 0, az = 1;
    if (Math.abs(dz) > 0.9) {
      ax = 1;
      az = 0;
    }
    let bx = ay * dz - az * dy, by = az * dx - ax * dz, bz = ax * dy - ay * dx;
    const bl = Math.hypot(bx, by, bz) || 1;
    bx /= bl; by /= bl; bz /= bl;
    const cx = dy * bz - dz * by, cy = dz * bx - dx * bz, cz = dx * by - dy * bx;
    out[o] = bx * radius; out[o + 1] = by * radius; out[o + 2] = bz * radius; out[o + 3] = 0;
    out[o + 4] = cx * radius; out[o + 5] = cy * radius; out[o + 6] = cz * radius; out[o + 7] = 0;
    out[o + 8] = dx * len; out[o + 9] = dy * len; out[o + 10] = dz * len; out[o + 11] = 0;
    out[o + 12] = px; out[o + 13] = py; out[o + 14] = pz; out[o + 15] = 1;
  }

  /** Draw slot `slot`'s K arrows from `a[s ..]` (K x [ox oy oz vx vy vz]). */
  function update(slot, a, s, ox, oy, oz) {
    for (let i = 0, n = slot * k; i < k; i++, s += 6, n++) {
      const vx = a[s + 3], vy = a[s + 4], vz = a[s + 5];
      const mag = Math.hypot(vx, vy, vz);
      const o = n * 16;
      const len = Math.min(mag * lengthScale, maxLen);
      if (!(len > 1e-6)) {
        sa.fill(0, o, o + 16);
        ha.fill(0, o, o + 16);
        if (pa) pa.fill(0, o, o + 16);
        continue;
      }
      const dx = vx / mag, dy = vy / mag, dz = vz / mag;
      const px = a[s] + ox, py = a[s + 1] + oy, pz = a[s + 2] + oz;
      const headLen = Math.min(HEAD_L * unit, 0.4 * len);
      const shaftLen = len - headLen;
      put(sa, o, dx, dy, dz, SHAFT_R * unit, shaftLen, px, py, pz);
      put(ha, o, dx, dy, dz, HEAD_R * unit, headLen, px + dx * shaftLen, py + dy * shaftLen, pz + dz * shaftLen);
      if (pa) {
        const r = POINT_R * unit;
        pa.fill(0, o, o + 16);
        pa[o] = pa[o + 5] = pa[o + 10] = r;
        pa[o + 12] = px; pa[o + 13] = py; pa[o + 14] = pz; pa[o + 15] = 1;
      }
    }
  }

  /** Hide everything in slot `slot` (the env left the focus set, or has no data yet). */
  function clear(slot) {
    const o = slot * k * 16, e = o + k * 16;
    sa.fill(0, o, e);
    ha.fill(0, o, e);
    if (pa) pa.fill(0, o, e);
  }

  function commit() {
    for (const m of meshes) m.instanceMatrix.needsUpdate = true;
  }

  function dispose() {
    shaftGeo.dispose();
    headGeo.dispose();
    if (pointGeo) pointGeo.dispose();
    material.dispose();
    for (const m of meshes) m.dispose();
  }

  /** Recolour for a theme. */
  function setTheme(theme) {
    material.color.copy(layerColor(theme, opts.points));
  }

  return { root, update, clear, commit, dispose, setTheme };
}

/**
 * One K-vertex polyline per slot (predictions), all in one LineSegments
 * buffer: one draw call and one upload at any number of envs.
 */
export function createPolylineLayer(nSlots, k) {
  const material = new LineBasicMaterial({ color: layerColor("light", false) });
  const segs = Math.max(k - 1, 0);
  const geo = new BufferGeometry();
  const attr = new BufferAttribute(new Float32Array(Math.max(nSlots * segs * 6, 6)), 3);
  attr.setUsage(DynamicDrawUsage);
  geo.setAttribute("position", attr);
  const lines = new LineSegments(geo, material);
  lines.frustumCulled = false;
  const root = new Group();
  root.add(lines);
  const arr = attr.array;

  /** Copy slot `slot`'s vertices from `a[s ..]` (K x 3) plus the env origin. */
  function update(slot, a, s, ox, oy, oz) {
    let o = slot * segs * 6;
    for (let i = 0; i < segs; i++, o += 6, s += 3) {
      arr[o] = a[s] + ox;
      arr[o + 1] = a[s + 1] + oy;
      arr[o + 2] = a[s + 2] + oz;
      arr[o + 3] = a[s + 3] + ox;
      arr[o + 4] = a[s + 4] + oy;
      arr[o + 5] = a[s + 5] + oz;
    }
  }

  function clear(slot) {
    arr.fill(0, slot * segs * 6, (slot + 1) * segs * 6);
  }

  function commit() {
    attr.needsUpdate = true;
  }

  function dispose() {
    geo.dispose();
    material.dispose();
  }

  /** Recolour for a theme. */
  function setTheme(theme) {
    material.color.copy(layerColor(theme, false));
  }

  return { root, update, clear, commit, dispose, setTheme };
}
