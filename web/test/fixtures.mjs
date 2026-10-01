// Small synthetic packs for the core's tests (no scene needed for the data
// layer: sources, caches and the worker only read manifests and blocks).

import { createHash } from "node:crypto";

import { encodeBlk, encodePack } from "./encoder.mjs";

/** Deterministic pose stream [T, E, B, 7]: bodies drift along +x, unit quaternions. */
export function poseData(T, E, B) {
  const data = new Float32Array(T * E * B * 7);
  for (let t = 0; t < T; t++) {
    for (let e = 0; e < E; e++) {
      for (let b = 0; b < B; b++) {
        const o = ((t * E + e) * B + b) * 7;
        data[o] = 0.01 * t + e + 0.1 * b;
        data[o + 1] = 0.5 * e;
        data[o + 2] = 0.3 + 0.01 * Math.sin(t / 5) + 0.05 * b;
        const a = 0.02 * t + 0.1 * b;
        data[o + 5] = Math.sin(a / 2);
        data[o + 6] = Math.cos(a / 2);
      }
    }
  }
  return data;
}

/**
 * A pack with one run: `body_pose` (and `extra` streams), no scene. Returns
 * `{pack, data, manifest}`.
 */
export function makeRunPack({ run = "r", T = 250, E = 2, B = 3, blockFrames = 100, codec = "f32s", dt = 0.02, extra = {}, files = {} } = {}) {
  const data = poseData(T, E, B);
  const manifest = {
    format: "simscope-rollout/1",
    name: run,
    status: "complete",
    dt,
    n_frames: T,
    n_envs: E,
    n_bodies: B,
    scene: { sha256: "0".repeat(64), size: 0 },
    env_origins: Array.from({ length: E }, () => [0, 0, 0]),
    streams: { body_pose: { file: "body_pose.blk", kind: "pose", item_shape: [B, 7] } },
  };
  const entries = {
    [`runs/${run}/body_pose.blk`]: encodeBlk({ itemShape: [B, 7], nEnvs: E, nFrames: T, blockFrames, codec, data }),
  };
  for (const [name, s] of Object.entries(extra)) {
    manifest.streams[name] = { file: `${name}.blk`, kind: s.kind, item_shape: s.itemShape };
    entries[`runs/${run}/${name}.blk`] = encodeBlk({ itemShape: s.itemShape, nEnvs: E, nFrames: T, blockFrames, codec: "f32s", data: s.data });
  }
  entries[`runs/${run}/rollout.json`] = manifest;
  Object.assign(entries, files);
  return { pack: encodePack(entries), data, manifest };
}

/**
 * A scene with a ground plane, a torso box (visual) and a foot sphere
 * (collision); `scale` sizes the robot. Each wall `{x, y, hx, hy, top}` is a
 * box on the world body standing on the ground.
 */
export function sceneOf(scale = 1, walls = []) {
  return {
    format: "simscope-scene/1",
    bodies: [
      { name: "world", parent: -1 },
      { name: "torso", parent: 0 },
    ],
    geoms: [
      { body: 0, kind: "plane", size: [0, 0, 0.5], pos: [0, 0, 0], quat: [0, 0, 0, 1], scale: [1, 1, 1], material: 0, mesh: null, role: "visual" },
      { body: 1, kind: "box", size: [0.3 * scale, 0.1 * scale, 0.05 * scale], pos: [0, 0, 0], quat: [0, 0, 0, 1], scale: [1, 1, 1], material: 0, mesh: null, role: "visual" },
      { body: 1, kind: "sphere", size: [0.08 * scale, 0, 0], pos: [0, 0, -0.1 * scale], quat: [0, 0, 0, 1], scale: [1, 1, 1], material: 0, mesh: null, role: "collision" },
      ...walls.map((w) => ({ body: 0, kind: "box", size: [w.hx, w.hy, w.top / 2], pos: [w.x, w.y, w.top / 2], quat: [0, 0, 0, 1], scale: [1, 1, 1], material: 0, mesh: null, role: "visual" })),
    ],
    materials: [{ rgba: [0.5, 0.6, 0.7, 1], metallic: 0, roughness: 0.7, texture: null, texrepeat: [1, 1] }],
    meshes: [],
    textures: [],
  };
}

/**
 * A pack that Player can load (`envs` envs, 2 m apart in y): `sceneOf(scale,
 * walls)` and a torso that starts at `start` and moves at `vel` (m/s) with a
 * little vertical bob, or follows `path(t)`, any `[x, y, z]` of the time.
 * `files` adds entries (derived documents, annotations).
 */
export function makeWalkerPack({ run = "walker", T = 100, dt = 0.02, envs = 1, start = [0, 0, 0.3], vel = [0.5, 0, 0], bob = 0.02, scale = 1, walls = [], path = null, files = {} } = {}) {
  const scene = sceneOf(scale, walls);
  const sha = createHash("sha256").update(JSON.stringify(scene)).digest("hex");
  const data = new Float32Array(T * envs * 14);
  for (let t = 0; t < T; t++) {
    for (let e = 0; e < envs; e++) {
      const o = (t * envs + e) * 14;
      const [x, y, z] = path ? path(t * dt) : [start[0] + vel[0] * t * dt, start[1] + vel[1] * t * dt, start[2] + vel[2] * t * dt + bob * Math.sin(t / 4 + e)];
      data[o + 6] = 1; // world: identity
      data[o + 7] = x;
      data[o + 8] = y;
      data[o + 9] = z;
      data[o + 13] = 1;
    }
  }
  const entries = {
    [`runs/${run}/rollout.json`]: {
      format: "simscope-rollout/1",
      name: run,
      status: "complete",
      dt,
      n_frames: T,
      n_envs: envs,
      n_bodies: 2,
      scene: { sha256: sha, size: 0 },
      env_origins: Array.from({ length: envs }, (_, e) => [0, 2 * e, 0]),
      streams: { body_pose: { file: "body_pose.blk", kind: "pose", item_shape: [2, 7] } },
    },
    [`runs/${run}/body_pose.blk`]: encodeBlk({ itemShape: [2, 7], nEnvs: envs, nFrames: T, blockFrames: 100, codec: "f32s", data }),
    [`scenes/${sha.slice(0, 2)}/${sha}.json`]: scene,
    ...files,
  };
  return encodePack(entries);
}

/** The `renderer` option of a Player that never draws (there is no WebGL in Node). */
export const nullRenderer = {
  attach() {},
  detach() {},
  draw(player) {
    player.dirty = false;
  },
  info: { render: { calls: 0, triangles: 0 } },
};
