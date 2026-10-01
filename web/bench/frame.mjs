// Per-frame main-thread JS cost of the tiers at 4,096 envs (viewer v3 §6
// budget: <= 4 ms, <= 2 MB of GPU upload per frame), without a GPU:
//
//   node bench/frame.mjs [envs=4096] [focus=64] [bodies=20] [geoms=40]
//
// It times the same functions the player runs every frame: pose
// interpolation for the focus envs, composing their instance matrices, and
// interpolating and placing one proxy per env. The browser half (draw calls,
// decode worker, end-to-end frame time) is bench/crowd.html.

import { createCrowd } from "../src/core/crowd.js";
import { lerpPoses } from "../src/core/interp.js";
import { buildScene } from "../src/core/scene.js";

const [E = 4096, F = 64, B = 20, G = 40] = process.argv.slice(2).map(Number);

const scene = {
  bodies: Array.from({ length: B }, (_, i) => ({ name: i ? `b${i}` : "world", parent: i ? 0 : -1 })),
  geoms: Array.from({ length: G }, (_, j) => ({
    body: 1 + (j % (B - 1)),
    kind: j % 3 ? "capsule" : "box",
    size: [0.03, 0.08, 0.05],
    pos: [0, 0, -0.05],
    quat: [0, 0, 0, 1],
    scale: [1, 1, 1],
    material: 0,
    mesh: null,
    role: "visual",
  })),
  materials: [{ rgba: [0.6, 0.6, 0.7, 1], metallic: 0, roughness: 0.7, texture: null, texrepeat: [1, 1] }],
  meshes: [],
  textures: [],
};
const part = await buildScene(scene, { mesh: async () => null, release() {}, texture: async () => null }, F);
for (let s = 0; s < F; s++) part.slotOn[s] = 1;

const K = B * 7;
const a0 = new Float32Array(100 * K), a1 = new Float32Array(100 * K);
for (let i = 0; i < a0.length; i += 7) {
  a0[i + 6] = a1[i + 6] = 1;
  a1[i] = 0.01;
}
const root0 = new Float32Array(100 * 7), root1 = new Float32Array(100 * 7);
for (let i = 0; i < root0.length; i += 7) root0[i + 6] = root1[i + 6] = 1;
const rootBuf = new Float32Array(7 * E), origins = new Float32Array(3 * E), hidden = new Uint8Array(E);
const crowd = createCrowd(E, [0.6, 0.3, 0.2]);

function time(name, fn, n = 2000) {
  for (let i = 0; i < 200; i++) fn(i); // warm up the JIT
  const t0 = performance.now();
  for (let i = 0; i < n; i++) fn(i);
  const ms = (performance.now() - t0) / n;
  console.log(`${name.padEnd(46)} ${ms.toFixed(4)} ms`);
  return ms;
}

const tLerp = time(`interpolate ${F} focus envs x ${B} bodies`, (i) => {
  for (let s = 0; s < F; s++) lerpPoses(part.poses, s * K, a0, (i % 99) * K, a1, (i % 99) * K, (i % 10) / 10, B);
});
const tApply = time(`compose ${F} x ${G} instance matrices`, () => part.apply());
const tRoot = time(`interpolate ${E} crowd roots`, (i) => {
  for (let e = 0; e < E; e++) lerpPoses(rootBuf, 7 * e, root0, (i % 99) * 7, root1, (i % 99) * 7, 0.5, 1);
});
const tCrowd = time(`place ${E} crowd proxies`, () => crowd.update(rootBuf, origins, hidden));

const total = tLerp + tApply + tRoot + tCrowd;
const upload = (part.root.children.reduce((s, m) => s + m.instanceMatrix.array.byteLength, 0) + crowd.mesh.instanceMatrix.array.byteLength) / 1e6;
console.log("-".repeat(60));
console.log(`per-frame JS total ${total.toFixed(3)} ms (budget 4 ms); instanced upload ${upload.toFixed(3)} MB/frame (budget 2 MB)`);
if (total > 4 || upload > 2) {
  console.error("over budget");
  process.exit(1);
}
