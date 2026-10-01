import assert from "node:assert/strict";
import test from "node:test";

import { createArrowLayer, createPolylineLayer } from "../src/core/overlays.js";
import { buildScene } from "../src/core/scene.js";
import { createCrowd, rampColor } from "../src/core/crowd.js";
import { Color } from "three";

const loaders = { mesh: async () => null, release() {}, texture: async () => null };
const sceneJson = {
  bodies: [{ name: "world", parent: -1 }, { name: "torso", parent: 0 }, { name: "foot", parent: 1 }],
  geoms: [
    { body: 0, kind: "plane", size: [0, 0, 0.5], pos: [0, 0, 0.02], quat: [0, 0, 0, 1], scale: [1, 1, 1], material: 0, mesh: null, role: "visual" },
    { body: 1, kind: "box", size: [0.3, 0.1, 0.05], pos: [0, 0, 0], quat: [0, 0, 0, 1], scale: [1, 1, 1], material: 0, mesh: null, role: "visual" },
    { body: 2, kind: "capsule", size: [0.03, 0.1, 0], pos: [0, 0, -0.1], quat: [0, 0, 0, 1], scale: [1, 1, 1], material: 0, mesh: null, role: "visual" },
    { body: 2, kind: "sphere", size: [0.05, 0, 0], pos: [0, 0, 0], quat: [0, 0, 0, 1], scale: [1, 1, 1], material: 0, mesh: null, role: "collision" },
  ],
  materials: [{ rgba: [0.5, 0.6, 0.7, 1], metallic: 0, roughness: 0.7, texture: null, texrepeat: [1, 1] }],
  meshes: [],
  textures: [],
};

test("a scene part has room for N slots, one draw call per (role, geometry, material) bucket", async () => {
  const part = await buildScene(sceneJson, loaders, 5);
  assert.equal(part.nSlots, 5);
  assert.equal(part.nBodies, 3);
  assert.equal(part.root.children.length, 3, "box, capsule, collision sphere");
  assert.deepEqual(part.root.children.map((m) => m.count), [5, 5, 5]);
  assert.equal(part.hasCollision, true);
  assert.deepEqual(part.planes, [{ z: 0.02, tile: 0.5, body: 0 }], "planes are not drawn as geometry: the ground shader takes them");
  assert.ok(part.trianglesPerEnv > 12, "box + capsule triangles, collision geoms excluded");
  assert.equal(part.root.children[2].visible, false, "collision geoms start hidden");
  part.setRoles(true, true);
  assert.equal(part.root.children[2].visible, true);
  part.dispose();
});

test("body reach (for framing) is the geom offset plus its own radius", async () => {
  const part = await buildScene(sceneJson, loaders, 1);
  assert.ok(Math.abs(part.bodyRadius[1] - Math.hypot(0.3, 0.1, 0.05)) < 1e-6);
  assert.ok(Math.abs(part.bodyRadius[2] - (0.1 + 0.03 + 0.1)) < 1e-6, "offset 0.1 + capsule r+h");
  assert.equal(part.bodyRadius[0], 0, "the plane does not count");
});

test("apply places instances from poses and origins; slots that are off are hidden, then stay hidden", async () => {
  const part = await buildScene(sceneJson, loaders, 3);
  const B = 3;
  const setPose = (slot, body, x, y, z) => part.poses.set([x, y, z, 0, 0, 0, 1], (slot * B + body) * 7);
  for (const s of [0, 2]) {
    for (let b = 0; b < B; b++) setPose(s, b, s, 0, 1);
    part.slotOn[s] = 1;
  }
  part.origins.set([0, 0, 0, 0, 0, 0, 0, 10, 0], 0);
  part.apply();
  const box = part.root.children[0].instanceMatrix.array; // the torso box: one instance per slot
  assert.deepEqual([box[12], box[13], box[14]], [0, 0, 1], "slot 0 at its pose");
  assert.deepEqual([box[2 * 16 + 12], box[2 * 16 + 13], box[2 * 16 + 14]], [2, 10, 1], "slot 2 pose plus its origin");
  assert.equal(box[16 + 15], 0, "slot 1 is off: a zero matrix");
  assert.ok(Math.abs(box[0] - 0.6) < 1e-6, "box x scale = 2 * half extent");
  // turn slot 0 off: its matrices are zeroed once
  part.slotOn[0] = 0;
  part.apply();
  assert.equal(box[15], 0);
  assert.equal(box[2 * 16 + 15], 1, "slot 2 untouched");
  part.limitSlots(1);
  assert.deepEqual(part.root.children.map((m) => m.count), [1, 1, 1]);
  part.limitSlots(99);
  assert.deepEqual(part.root.children.map((m) => m.count), [3, 3, 3], "never above the slots built");
});

test("a geom with a rotation composes body o geom: the capsule hangs below the foot body", async () => {
  const part = await buildScene(sceneJson, loaders, 1);
  // Foot body rotated 90 degrees about x: its local -z points along world +y.
  const s = Math.SQRT1_2;
  part.poses.set([0, 0, 0, 0, 0, 0, 1], 0);
  part.poses.set([0, 0, 0, 0, 0, 0, 1], 7);
  part.poses.set([1, 2, 3, s, 0, 0, s], 14);
  part.slotOn[0] = 1;
  part.apply();
  const cap = part.root.children[1].instanceMatrix.array;
  // geom offset (0, 0, -0.1) rotated by +90 deg about x -> (0, 0.1, 0); plus the body at (1, 2, 3).
  assert.ok(Math.abs(cap[12] - 1) < 1e-6 && Math.abs(cap[13] - 2.1) < 1e-6 && Math.abs(cap[14] - 3) < 1e-6, Array.from(cap.slice(12, 15)).join(","));
});

test("arrow layers hide zero-length arrows, clamp long ones, and draw contact points only for real contacts", () => {
  const layer = createArrowLayer(2, 2, 1.0, 1, { points: true });
  const rows = Float32Array.of(0, 0, 0, 0, 0, 0, /* zero */ 1, 1, 0, 0, 0, 2 /* up, 2 N */);
  layer.update(0, rows, 0, 0, 0, 0);
  const [shaft, head, points] = layer.root.children.map((m) => m.instanceMatrix.array);
  assert.equal(shaft[15], 0, "the zero arrow is hidden");
  assert.equal(points[15], 0, "and so is its contact point");
  assert.equal(shaft[16 + 15], 1, "the real one is placed");
  assert.deepEqual([points[16 + 12], points[16 + 13], points[16 + 14]], [1, 1, 0], "point at the arrow origin");
  assert.ok(head[16 + 14] > 0.5, "the head sits at the arrow's far end");
  layer.update(1, Float32Array.of(0, 0, 0, 0, 0, 1000, 0, 0, 0, 0, 0, 0), 0, 0, 0, 0);
  const len = Math.hypot(shaft[2 * 16 + 8], shaft[2 * 16 + 9], shaft[2 * 16 + 10]) + Math.hypot(head[2 * 16 + 8], head[2 * 16 + 9], head[2 * 16 + 10]);
  assert.ok(len <= 3.0 + 1e-6, `clamped at 3 robot heights, got ${len}`);
  layer.clear(1);
  assert.equal(shaft[2 * 16 + 15], 0);
  layer.dispose();
});

test("the polyline layer is one buffer for all slots", () => {
  const layer = createPolylineLayer(3, 4);
  assert.equal(layer.root.children.length, 1);
  const pos = layer.root.children[0].geometry.getAttribute("position");
  assert.equal(pos.count, 3 * 3 * 2, "3 slots x 3 segments x 2 vertices");
  layer.update(1, Float32Array.of(0, 0, 0, 1, 0, 0, 2, 0, 0, 3, 0, 0), 0, 10, 0, 0);
  const a = pos.array;
  assert.deepEqual(Array.from(a.slice(18, 24)), [10, 0, 0, 11, 0, 0]);
  assert.equal(a[0], 0, "other slots untouched");
  layer.clear(1);
  assert.ok(Array.from(a.slice(18, 36)).every((v) => v === 0));
  layer.dispose();
});

test("crowd proxies: posed by the root, hidden for focus envs, coloured by a column", () => {
  const crowd = createCrowd(3, [0.6, 0.3, 0.2]);
  const poses = Float32Array.of(1, 2, 3, 0, 0, 0, 1, 4, 5, 6, 0, 0, 0, 1, 7, 8, 9, 0, 0, 0, 1);
  const origins = Float32Array.of(0, 0, 0, 10, 0, 0, 0, 0, 0);
  crowd.update(poses, origins, Uint8Array.of(0, 0, 1));
  const m = crowd.mesh.instanceMatrix.array;
  assert.deepEqual([m[12], m[13], m[14]], [1, 2, 3]);
  assert.deepEqual([m[16 + 12], m[16 + 13], m[16 + 14]], [14, 5, 6], "env origin added");
  assert.equal(m[32 + 15], 0, "focus envs are not drawn twice");
  assert.ok(Math.abs(m[0] - 0.6) < 1e-6 && Math.abs(m[5] - 0.3) < 1e-6 && Math.abs(m[10] - 0.2) < 1e-6);
  crowd.setColors([0, 5, 10], "high");
  const c = crowd.mesh.instanceColor.array;
  const lo = new Color().fromArray(c, 0), hi = new Color().fromArray(c, 6);
  assert.ok(hi.g > lo.g && hi.r > lo.r, "high values are the bright end of the ramp");
  crowd.setColors([0, 5, 10], "low");
  assert.ok(new Color().fromArray(c, 0).g > new Color().fromArray(c, 6).g, "for 'low is better' the order flips");
  crowd.setColors(null);
  assert.equal(c[0], c[3], "back to one colour");
  assert.ok(rampColor(0.5, new Color()).g > 0);
  crowd.dispose();
});

test("primitives of different sizes that share a material each keep their own size", async () => {
  const mk = (kind, size, pos) => ({ body: 1, kind, size, pos, quat: [0, 0, 0, 1], scale: [1, 1, 1], material: 0, mesh: null, role: "visual" });
  const scene = {
    ...sceneJson,
    geoms: [mk("box", [0.5, 0.2, 0.1], [0, 0, 0]), mk("box", [0.1, 0.1, 1.0], [2, 0, 0]), mk("sphere", [0.3, 0, 0], [0, 2, 0]), mk("sphere", [0.7, 0, 0], [0, 4, 0])],
  };
  const part = await buildScene(scene, loaders, 1);
  assert.equal(part.root.children.length, 2, "one draw call per geometry (box, sphere), not per size");
  part.poses.set([0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1], 0);
  part.slotOn[0] = 1;
  part.apply();
  const [boxes, spheres] = part.root.children.map((m) => m.instanceMatrix.array);
  assert.ok(Math.abs(boxes[0] - 1.0) < 1e-6 && Math.abs(boxes[10] - 0.2) < 1e-6, "first box: x 1.0, z 0.2");
  assert.ok(Math.abs(boxes[16] - 0.2) < 1e-6 && Math.abs(boxes[16 + 10] - 2.0) < 1e-6, "second box: x 0.2, z 2.0");
  assert.ok(Math.abs(spheres[0] - 0.3) < 1e-6 && Math.abs(spheres[16] - 0.7) < 1e-6, "sphere radii");
  // And framing sees the same sizes.
  const second = part.geomBoxes[1];
  assert.deepEqual(second.h.map((v) => +v.toFixed(6)), [0.1, 0.1, 1.0]);
  assert.deepEqual(second.c, [2, 0, 0]);
  part.dispose();
});

test("geomBoxes: capsule, rotated box and mesh bounds, in the body's frame", async () => {
  const s = Math.SQRT1_2;
  const scene = {
    ...sceneJson,
    meshes: [{ sha256: "m".repeat(64) }],
    geoms: [
      { body: 1, kind: "capsule", size: [0.05, 0.2, 0], pos: [1, 0, 0], quat: [0, 0, 0, 1], scale: [1, 1, 1], material: 0, mesh: null, role: "visual" },
      { body: 1, kind: "box", size: [0.4, 0.1, 0.1], pos: [0, 1, 0], quat: [0, 0, s, s], scale: [1, 1, 1], material: 0, mesh: null, role: "visual" },
      { body: 2, kind: "mesh", size: [0, 0, 0], pos: [0, 0, 0], quat: [0, 0, 0, 1], scale: [2, 2, 2], material: 0, mesh: 0, role: "visual" },
    ],
  };
  const { BufferGeometry, BufferAttribute } = await import("three");
  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(Float32Array.of(0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 3), 3));
  const part = await buildScene(scene, { ...loaders, mesh: async () => geo }, 1);
  const [cap, box, mesh] = part.geomBoxes;
  assert.deepEqual(cap.h.map((v) => +v.toFixed(6)), [0.05, 0.05, 0.25], "capsule: radius, radius, half length + radius");
  // The box is turned 90 degrees about z: its x axis is the body's y axis.
  const worldX = [box.axes[0], box.axes[1], box.axes[2]].map((v) => +v.toFixed(6) + 0);
  assert.deepEqual(worldX, [0, 1, 0]);
  assert.deepEqual(mesh.h, [1, 2, 3], "mesh: half of its bounding box, times the geom's scale");
  assert.deepEqual(mesh.c, [1, 2, 3], "and its centre");
  part.dispose();
});
