// Scene building: scene JSON to three.js objects.
//
// Geometry table and colours follow mkdeck's rollout_viewer.js (makeGeometry,
// buildScene), but every geom becomes an *instance* of an InstancedMesh:
// geoms that share geometry, material and role share one draw call, across
// bodies and slots. A slot is room for one env's robot; the player assigns
// envs to slots (all envs at small E, the focus set above 64).
//
// Per frame the player writes interpolated poses into `part.poses` and calls
// `part.apply()`, which composes each instance matrix straight into the
// instanceMatrix buffer and allocates nothing.
//
// Frames: pose = [px py pz qx qy qz qw] (xyzw), world = body pose o (geom
// pos, quat, scale). Matrices are stored column-major as in three.js.
// Colours in scene JSON are display (sRGB) values, as the simulators use them.

import {
  BoxGeometry,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  MeshStandardMaterial,
  RepeatWrapping,
  SphereGeometry,
  SRGBColorSpace,
  Texture,
} from "three";

import { colorOf, paletteOf } from "./theme.js";


// ---- geometry table ----

/** Unit geometry (built once per key) and the per-axis scale that sizes it. */
function shapeOf(geom, meshes) {
  const s = geom.size;
  const gs = geom.scale || [1, 1, 1];
  const scaled = (a, b, c) => [a * gs[0], b * gs[1], c * gs[2]];
  switch (geom.kind) {
    case "box":
      return { key: "box", make: () => new BoxGeometry(1, 1, 1), scale: scaled(2 * s[0], 2 * s[1], 2 * s[2]) };
    case "sphere":
      return { key: "sphere", make: unitSphere, scale: scaled(s[0], s[0], s[0]) };
    case "ellipsoid":
      return { key: "sphere", make: unitSphere, scale: scaled(s[0], s[1], s[2]) };
    case "cylinder":
      return { key: "cylinder", make: unitCylinder, scale: scaled(s[0], s[0], s[1]) };
    case "capsule":
      // A capsule cannot be scaled without deforming its caps, so each
      // (r, h) gets its own geometry. +z axis: CapsuleGeometry runs along y.
      return {
        key: `capsule:${s[0]}:${s[1]}`,
        make: () => new CapsuleGeometry(s[0], 2 * s[1], 8, 16).rotateX(Math.PI / 2),
        scale: gs.slice(),
      };
    case "mesh":
      if (geom.mesh === null || geom.mesh === undefined || !meshes[geom.mesh]) return null;
      return { key: `mesh:${geom.mesh}`, mesh: geom.mesh, scale: gs.slice() };
    default:
      return null;
  }
}

function unitSphere() {
  return new SphereGeometry(1, 24, 16);
}

function unitCylinder() {
  return new CylinderGeometry(1, 1, 2, 24).rotateX(Math.PI / 2);
}

const triangles = (geo) => (geo.index ? geo.index.count : geo.getAttribute("position").count) / 3;

/**
 * A geom as an oriented box in its body's frame, for framing: `{body, c, axes,
 * h}` with the centre `c`, the box's axes as the columns of a column-major
 * 3x3, and the half extents `h`. Primitives get their exact box (a capsule or
 * sphere its bounding box); a mesh gets its bounding box from the decoded
 * geometry.
 */
function geomBox(g, sc, geo) {
  let c = [0, 0, 0], h;
  switch (g.kind) {
    case "box":
      h = [sc[0] / 2, sc[1] / 2, sc[2] / 2];
      break;
    case "capsule": {
      const s = g.size, gs = g.scale || [1, 1, 1];
      h = [s[0] * gs[0], s[0] * gs[1], (s[1] + s[0]) * gs[2]];
      break;
    }
    case "mesh": {
      geo.computeBoundingBox();
      const { min, max } = geo.boundingBox;
      c = [((min.x + max.x) / 2) * sc[0], ((min.y + max.y) / 2) * sc[1], ((min.z + max.z) / 2) * sc[2]];
      h = [((max.x - min.x) / 2) * Math.abs(sc[0]), ((max.y - min.y) / 2) * Math.abs(sc[1]), ((max.z - min.z) / 2) * Math.abs(sc[2])];
      break;
    }
    default: // sphere, ellipsoid, cylinder: the unit shape reaches 1 along each axis
      h = [Math.abs(sc[0]), Math.abs(sc[1]), Math.abs(sc[2])];
  }
  const [x, y, z, w] = g.quat || [0, 0, 0, 1];
  const xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
  const axes = [1 - 2 * (yy + zz), 2 * (xy + wz), 2 * (xz - wy), 2 * (xy - wz), 1 - 2 * (xx + zz), 2 * (yz + wx), 2 * (xz + wy), 2 * (yz - wx), 1 - 2 * (xx + yy)];
  const pos = g.pos || [0, 0, 0];
  const at = [0, 1, 2].map((i) => pos[i] + axes[i] * c[0] + axes[3 + i] * c[1] + axes[6 + i] * c[2]);
  return { body: g.body, c: at, axes, h };
}

// ---- matrix helpers (no allocation) ----

/**
 * out[o..o+16] = body(R, t at `b`) o local(M 3x3 cols, t at `l`), column-major.
 * `bodyRT` holds 12 floats per body: R columns then t.
 */
function compose(out, o, bodyRT, b, local, l) {
  const r0 = bodyRT[b], r1 = bodyRT[b + 1], r2 = bodyRT[b + 2];
  const r3 = bodyRT[b + 3], r4 = bodyRT[b + 4], r5 = bodyRT[b + 5];
  const r6 = bodyRT[b + 6], r7 = bodyRT[b + 7], r8 = bodyRT[b + 8];
  for (let k = 0; k < 3; k++) {
    const m0 = local[l + 3 * k], m1 = local[l + 3 * k + 1], m2 = local[l + 3 * k + 2];
    out[o + 4 * k] = r0 * m0 + r3 * m1 + r6 * m2;
    out[o + 4 * k + 1] = r1 * m0 + r4 * m1 + r7 * m2;
    out[o + 4 * k + 2] = r2 * m0 + r5 * m1 + r8 * m2;
    out[o + 4 * k + 3] = 0;
  }
  const t0 = local[l + 9], t1 = local[l + 10], t2 = local[l + 11];
  out[o + 12] = r0 * t0 + r3 * t1 + r6 * t2 + bodyRT[b + 9];
  out[o + 13] = r1 * t0 + r4 * t1 + r7 * t2 + bodyRT[b + 10];
  out[o + 14] = r2 * t0 + r5 * t1 + r8 * t2 + bodyRT[b + 11];
  out[o + 15] = 1;
}

/** Fill local[l..l+12] = R(quat) * diag(scale), then t. */
function writeLocal(local, l, pos, quat, scale) {
  const [x, y, z, w] = quat;
  const xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
  const r = [
    1 - 2 * (yy + zz), 2 * (xy + wz), 2 * (xz - wy),
    2 * (xy - wz), 1 - 2 * (xx + zz), 2 * (yz + wx),
    2 * (xz + wy), 2 * (yz - wx), 1 - 2 * (xx + yy),
  ];
  for (let k = 0; k < 3; k++) for (let i = 0; i < 3; i++) local[l + 3 * k + i] = r[3 * k + i] * scale[k];
  local[l + 9] = pos[0];
  local[l + 10] = pos[1];
  local[l + 11] = pos[2];
}

/** Write body rotation columns and translation for one pose into dst[o..o+12]. */
export function poseToRT(dst, o, a, s, ox, oy, oz) {
  const x = a[s + 3], y = a[s + 4], z = a[s + 5], w = a[s + 6];
  const xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
  dst[o] = 1 - 2 * (yy + zz);
  dst[o + 1] = 2 * (xy + wz);
  dst[o + 2] = 2 * (xz - wy);
  dst[o + 3] = 2 * (xy - wz);
  dst[o + 4] = 1 - 2 * (xx + zz);
  dst[o + 5] = 2 * (yz + wx);
  dst[o + 6] = 2 * (xz + wy);
  dst[o + 7] = 2 * (yz - wx);
  dst[o + 8] = 1 - 2 * (xx + yy);
  dst[o + 9] = a[s] + ox;
  dst[o + 10] = a[s + 1] + oy;
  dst[o + 11] = a[s + 2] + oz;
}

// ---- scene ----

/**
 * Build the three.js objects of one scene with room for `nSlots` robots.
 *
 * @param {object} sceneJson  parsed `simscope-scene/1`.
 * @param {{mesh(i): Promise<import("three").BufferGeometry>, release(i): void,
 *   texture(i): Promise<ImageBitmap|null>}} loaders  shared mesh geometries
 *   (refcounted: `release` is called once per mesh on dispose) and textures.
 * @param {number} nSlots
 * @returns {Promise<object>} a part: `{root, poses, origins, slotOn, apply,
 *   setRoles, dispose, drawnBodies, bodyRadius, geomBoxes, nBodies,
 *   bodyNames, hasCollision, trianglesPerEnv, planes}`.
 */
export async function buildScene(sceneJson, loaders, nSlots) {
  const bodies = sceneJson.bodies || [];
  const geoms = sceneJson.geoms || [];
  const materials = sceneJson.materials || [];
  const meshes = sceneJson.meshes || [];
  const B = bodies.length;
  const E = nSlots;

  // Bucket instanced geoms by (role, geometry, material); collect planes.
  const buckets = new Map();
  const planes = [];
  const drawnBodies = new Uint8Array(B);
  const usedMeshes = new Set();
  const usedTextures = new Set();
  for (let j = 0; j < geoms.length; j++) {
    const g = geoms[j];
    if (!(g.body >= 0 && g.body < B)) throw new Error(`simscope: geom ${j} references missing body ${g.body}`);
    const collision = g.role === "collision";
    if (g.kind === "plane") {
      if (!collision) planes.push({ z: (g.pos || [0, 0, 0])[2], tile: g.size[2], body: g.body });
      continue;
    }
    const shape = shapeOf(g, meshes);
    if (!shape) {
      console.warn(`simscope: skipping geom ${j} (unsupported kind "${g.kind}" or missing mesh)`);
      continue;
    }
    const matIdx = collision ? -1 : g.material;
    const key = `${collision ? "c" : "v"}|${shape.key}|${matIdx}`;
    let bucket = buckets.get(key);
    if (!bucket) buckets.set(key, (bucket = { collision, shape, matIdx, geoms: [], scales: [] }));
    bucket.geoms.push(g);
    bucket.scales.push(shape.scale); // boxes of different sizes share a bucket, not a size
    if (shape.mesh !== undefined) usedMeshes.add(shape.mesh);
    if (!collision) {
      drawnBodies[g.body] = 1;
      const m = materials[g.material];
      if (m && m.texture !== null && m.texture !== undefined) usedTextures.add(m.texture);
    }
  }

  // Load meshes and textures in parallel. Meshes are shared page-wide.
  const meshGeo = new Map();
  const textureData = new Map();
  await Promise.all([
    ...[...usedMeshes].map(async (i) => meshGeo.set(i, await loaders.mesh(i))),
    ...[...usedTextures].map(async (i) => textureData.set(i, await loaders.texture(i))),
  ]);

  const root = new Group();
  const disposables = [];
  const geometryCache = new Map();
  const materialCache = new Map();
  const collisionMaterials = [];

  const geometryFor = (shape) => {
    let geo = geometryCache.get(shape.key);
    if (!geo) {
      if (shape.mesh !== undefined) geo = meshGeo.get(shape.mesh); // shared: not ours to dispose
      else {
        geo = shape.make();
        disposables.push(geo);
      }
      geometryCache.set(shape.key, geo);
    }
    return geo;
  };

  const materialFor = (bucket) => {
    const cached = materialCache.get(bucket.matIdx);
    if (cached) return cached;
    let mat;
    if (bucket.collision) {
      // Neutral: the foreground colour at 35% against the viewport, so it reads in both themes.
      mat = new MeshStandardMaterial({ color: colorOf(paletteOf("light").fg), opacity: 0.35, transparent: true, roughness: 0.8 });
      collisionMaterials.push(mat);
    } else {
      const m = materials[bucket.matIdx] || { rgba: [0.7, 0.7, 0.7, 1] };
      const rgba = m.rgba || [0.7, 0.7, 0.7, 1];
      const opacity = Math.min(Math.max(rgba[3], 0.05), 1);
      const params = {
        color: new Color().setRGB(rgba[0], rgba[1], rgba[2], SRGBColorSpace),
        opacity,
        transparent: opacity < 1,
        metalness: m.metallic ?? 0,
        roughness: m.roughness ?? 0.7,
      };
      const bitmap = m.texture !== null && m.texture !== undefined ? textureData.get(m.texture) : null;
      if (bitmap) {
        const tex = new Texture(bitmap);
        tex.colorSpace = SRGBColorSpace;
        tex.wrapS = tex.wrapT = RepeatWrapping;
        const rep = m.texrepeat || [1, 1];
        tex.repeat.set(rep[0], rep[1]);
        tex.needsUpdate = true;
        disposables.push(tex);
        params.map = tex;
      }
      mat = new MeshStandardMaterial(params);
    }
    materialCache.set(bucket.matIdx, mat);
    disposables.push(mat);
    return mat;
  };

  // How far each body's geometry reaches from the body origin, for framing:
  // the geom's offset plus its own bounding radius.
  const bodyRadius = new Float32Array(B);
  const geomRadius = (g, shape) => {
    const sc = Math.max(...(g.scale || [1, 1, 1]));
    const s = g.size;
    switch (g.kind) {
      case "box":
        return Math.hypot(s[0], s[1], s[2]) * sc;
      case "sphere":
        return s[0] * sc;
      case "ellipsoid":
        return Math.max(s[0], s[1], s[2]) * sc;
      case "capsule":
        return (s[0] + s[1]) * sc;
      case "cylinder":
        return Math.hypot(s[0], s[1]) * sc;
      case "mesh": {
        const geo = meshGeo.get(shape.mesh);
        geo.computeBoundingSphere();
        const c = geo.boundingSphere.center;
        return (Math.hypot(c.x, c.y, c.z) + geo.boundingSphere.radius) * sc;
      }
      default:
        return 0;
    }
  };
  for (const bucket of buckets.values()) {
    if (bucket.collision) continue;
    for (const g of bucket.geoms) {
      const pos = g.pos || [0, 0, 0];
      bodyRadius[g.body] = Math.max(bodyRadius[g.body], Math.hypot(pos[0], pos[1], pos[2]) + geomRadius(g, bucket.shape));
    }
  }

  // Every drawn geom as a box, for framing the run (extent.js).
  const geomBoxes = [];
  for (const bucket of buckets.values()) {
    if (bucket.collision) continue;
    const geo = bucket.shape.mesh !== undefined ? meshGeo.get(bucket.shape.mesh) : null;
    bucket.geoms.forEach((g, i) => geomBoxes.push(geomBox(g, bucket.scales[i], geo)));
  }

  const groups = [];
  let trianglesPerEnv = 0;
  for (const bucket of buckets.values()) {
    const list = bucket.geoms;
    const n = list.length;
    const geo = geometryFor(bucket.shape);
    if (!bucket.collision) trianglesPerEnv += n * triangles(geo);
    const mesh = new InstancedMesh(geo, materialFor(bucket), E * n);
    mesh.instanceMatrix.array.fill(0); // three.js starts at identity: hide until placed
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.frustumCulled = false; // instances move; the base geometry's sphere is meaningless
    mesh.visible = !bucket.collision;
    const body = new Int32Array(n);
    const local = new Float32Array(12 * n);
    list.forEach((g, i) => {
      body[i] = g.body;
      // The shape's own scale (unit geometry -> size) times the geom's scale is
      // already folded into the geom's `shape.scale`; primitives never carry a
      // rotation of their own, so this is R(geom.quat) * diag(that scale).
      writeLocal(local, 12 * i, g.pos || [0, 0, 0], g.quat || [0, 0, 0, 1], bucket.scales[i]);
    });
    root.add(mesh);
    groups.push({ mesh, n, body, local, collision: bucket.collision });
  }

  const bodyRT = new Float32Array(Math.max(E, 1) * B * 12);
  const poses = new Float32Array(E * B * 7); // written by the player
  const origins = new Float32Array(E * 3);
  const slotOn = new Uint8Array(E);
  const wasOn = new Uint8Array(E);

  /** Place every instance of every slot that is on; hide slots that just went off. */
  function apply() {
    for (let s = 0, o = 0, p = 0; s < E; s++, o += 12 * B, p += 7 * B) {
      if (!slotOn[s]) continue;
      const ox = origins[3 * s], oy = origins[3 * s + 1], oz = origins[3 * s + 2];
      for (let b = 0, q = p, r = o; b < B; b++, q += 7, r += 12) poseToRT(bodyRT, r, poses, q, ox, oy, oz);
    }
    for (const g of groups) {
      const out = g.mesh.instanceMatrix.array;
      for (let s = 0; s < E; s++) {
        const k0 = s * g.n * 16;
        if (!slotOn[s]) {
          if (wasOn[s]) out.fill(0, k0, k0 + g.n * 16);
          continue;
        }
        const base = s * B * 12;
        for (let i = 0, k = k0; i < g.n; i++, k += 16) compose(out, k, bodyRT, base + 12 * g.body[i], g.local, 12 * i);
      }
      g.mesh.instanceMatrix.needsUpdate = true;
    }
    wasOn.set(slotOn);
  }

  /**
   * Draw only the first `n` slots. Instances with a zero matrix still cost
   * vertex work on the GPU, so slots that can never be used (the focus tier
   * has room for fewer envs than the buffers were sized for) are not drawn.
   */
  function limitSlots(n) {
    for (const g of groups) g.mesh.count = Math.min(Math.max(n, 0), E) * g.n;
  }

  /** Show or hide visual and collision geoms. */
  function setRoles(visual, collision) {
    for (const g of groups) g.mesh.visible = g.collision ? collision : visual;
  }

  /** Collision geoms are the foreground colour at 35%: recolour for a theme. */
  function setTheme(theme) {
    for (const m of collisionMaterials) m.color.copy(colorOf(paletteOf(theme).fg));
  }

  function dispose() {
    for (const d of disposables) d.dispose();
    for (const g of groups) g.mesh.dispose();
    for (const i of usedMeshes) loaders.release(i);
    disposables.length = 0;
    usedMeshes.clear();
  }

  return {
    root,
    poses,
    origins,
    slotOn,
    apply,
    limitSlots,
    setRoles,
    setTheme,
    dispose,
    drawnBodies,
    bodyRadius,
    geomBoxes,
    nSlots: E,
    nBodies: B,
    bodyNames: bodies.map((b) => b.name),
    hasCollision: groups.some((g) => g.collision),
    trianglesPerEnv,
    planes,
  };
}
