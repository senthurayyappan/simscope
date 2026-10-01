// Writes demo.simscope and index.html (pack inlined as base64) for the
// simscope-player demo page, using the test-only encoder that mirrors the
// on-disk format.
//
//   node demo/make_demo.mjs

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

import { encodeBlk, encodeMesh, encodePack } from "../test/encoder.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const canonical = (obj) => {
  const sort = (v) =>
    Array.isArray(v) ? v.map(sort) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sort(v[k])])) : v;
  return new TextEncoder().encode(JSON.stringify(sort(obj)));
};
const cas = (dir, sha, ext = "") => `${dir}/${sha.slice(0, 2)}/${sha}${ext}`;

// ---- assets: an icosphere mesh and a checker texture ----

function icosphere() {
  const t = (1 + Math.sqrt(5)) / 2;
  let verts = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t],
    [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ].map((v) => v.map((c) => c / Math.hypot(...v)));
  let faces = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];
  for (let level = 0; level < 2; level++) {
    const cache = new Map();
    const mid = (a, b) => {
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      if (!cache.has(key)) {
        const m = verts[a].map((c, i) => c + verts[b][i]);
        const l = Math.hypot(...m);
        verts.push(m.map((c) => c / l));
        cache.set(key, verts.length - 1);
      }
      return cache.get(key);
    };
    faces = faces.flatMap(([a, b, c]) => {
      const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
      return [[a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]];
    });
  }
  const uvs = verts.map(([x, y, z]) => [0.5 + Math.atan2(y, x) / (2 * Math.PI), 0.5 - Math.asin(z) / Math.PI]);
  return {
    verts: Float32Array.from(verts.flat()),
    faces: Uint32Array.from(faces.flat()),
    uvs: Float32Array.from(uvs.flat()),
  };
}

function checkerPng(size = 32, cells = 4) {
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = new Uint8Array(1 + size * 3);
    for (let x = 0; x < size; x++) {
      const on = (Math.floor((x * cells) / size) + Math.floor((y * cells) / size)) % 2 === 0;
      row.set(on ? [240, 240, 240] : [90, 120, 200], 1 + x * 3);
    }
    rows.push(row);
  }
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(zlib.crc32(body), 8 + data.length);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return new Uint8Array(
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", ihdr),
      chunk("IDAT", zlib.deflateSync(Buffer.concat(rows.map((r) => Buffer.from(r))))),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
}

const meshBytes = encodeMesh({ ...icosphere(), codec: "q16" });
const textureBytes = checkerPng();
const meshSha = sha256(meshBytes);
const texSha = sha256(textureBytes);

// ---- scene ----

const scene = {
  format: "simscope-scene/1",
  bodies: [
    { name: "world", parent: -1 },
    { name: "torso", parent: 0 },
    { name: "arm", parent: 1 },
    { name: "orbiter", parent: 0 },
  ],
  geoms: [
    { body: 0, kind: "plane", size: [0, 0, 0.5], pos: [0, 0, 0], quat: [0, 0, 0, 1], scale: [1, 1, 1], material: 0, mesh: null, role: "visual", name: "floor" },
    { body: 0, kind: "box", size: [0.1, 0.1, 0.5], pos: [-1, -0.8, 0.5], quat: [0, 0, 0, 1], scale: [1, 1, 1], material: 1, mesh: null, role: "visual", name: "pillar" },
    { body: 1, kind: "capsule", size: [0.08, 0.2, 0], pos: [0, 0, 0], quat: [0, 0, 0, 1], scale: [1, 1, 1], material: 2, mesh: null, role: "visual", name: "torso_geom" },
    { body: 1, kind: "sphere", size: [0.09, 0, 0], pos: [0, 0, 0.36], quat: [0, 0, 0, 1], scale: [1, 1, 1], material: 3, mesh: null, role: "visual", name: "head" },
    { body: 1, kind: "box", size: [0.12, 0.12, 0.26], pos: [0, 0, 0], quat: [0, 0, 0, 1], scale: [1, 1, 1], material: 2, mesh: null, role: "collision", name: "torso_col" },
    { body: 2, kind: "capsule", size: [0.045, 0.16, 0], pos: [0, 0, 0], quat: [0, Math.SQRT1_2, 0, Math.SQRT1_2], scale: [1, 1, 1], material: 2, mesh: null, role: "visual", name: "arm_geom" },
    { body: 2, kind: "cylinder", size: [0.05, 0.02, 0], pos: [0.2, 0, 0], quat: [0, Math.SQRT1_2, 0, Math.SQRT1_2], scale: [1, 1, 1], material: 3, mesh: null, role: "visual", name: "hand" },
    { body: 3, kind: "mesh", size: [0, 0, 0], pos: [0, 0, 0], quat: [0, 0, 0, 1], scale: [0.12, 0.12, 0.12], material: 4, mesh: 0, role: "visual", name: "orbiter_mesh" },
    { body: 3, kind: "ellipsoid", size: [0.05, 0.05, 0.02], pos: [0, 0, -0.16], quat: [0, 0, 0, 1], scale: [1, 1, 1], material: 3, mesh: null, role: "visual", name: "shadow" },
  ],
  materials: [
    { rgba: [0.5, 0.5, 0.5, 1], metallic: 0, roughness: 1, texture: null, texrepeat: [1, 1] },
    { rgba: [0.55, 0.55, 0.6, 1], metallic: 0.2, roughness: 0.6, texture: null, texrepeat: [1, 1] },
    { rgba: [0.85, 0.45, 0.3, 1], metallic: 0, roughness: 0.7, texture: null, texrepeat: [1, 1] },
    { rgba: [0.25, 0.55, 0.85, 0.7], metallic: 0, roughness: 0.5, texture: null, texrepeat: [1, 1] },
    { rgba: [1, 1, 1, 1], metallic: 0, roughness: 0.6, texture: 0, texrepeat: [2, 2] },
  ],
  meshes: [{ sha256: meshSha, size: meshBytes.length, n_verts: 162, n_faces: 320 }],
  textures: [{ sha256: texSha, size: textureBytes.length, media_type: "image/png", width: 32, height: 32 }],
};
const sceneBytes = canonical(scene);
const sceneSha = sha256(sceneBytes);

// ---- motion: 5 s at 50 Hz ----

const DT = 0.02, T = 250, B = 4;
const zq = (a) => [0, 0, Math.sin(a / 2), Math.cos(a / 2)];

function motion(nEnvs) {
  const pose = new Float32Array(T * nEnvs * B * 7);
  const force = new Float32Array(T * nEnvs * 2 * 6);
  const path = new Float32Array(T * nEnvs * 20 * 3);
  for (let t = 0; t < T; t++) {
    const s = t * DT;
    for (let e = 0; e < nEnvs; e++) {
      const phase = e * 0.9;
      const tx = 0.5 * Math.cos(0.8 * s + phase), ty = 0.5 * Math.sin(0.8 * s + phase), tz = 0.3 + 0.03 * Math.sin(4 * s + phase);
      const yaw = 0.8 * s + phase + Math.PI / 2;
      const armA = 0.9 * Math.sin(2 * s + phase);
      const put = (b, p, q) => pose.set([...p, ...q], ((t * nEnvs + e) * B + b) * 7);
      put(0, [0, 0, 0], [0, 0, 0, 1]);
      put(1, [tx, ty, tz], zq(yaw));
      put(2, [tx, ty, tz + 0.15], zq(yaw + armA));
      put(3, [1.0 * Math.cos(-1.3 * s + phase), 1.0 * Math.sin(-1.3 * s + phase), 0.6 + 0.2 * Math.sin(3 * s)], zq(2 * s));
      // "Foot" forces: two arrows under the torso, pulsing.
      const f = ((t * nEnvs + e) * 2) * 6;
      force.set([tx - 0.1, ty, 0.02, 0, 0, 0.8 + 0.6 * Math.sin(6 * s + phase)], f);
      force.set([tx + 0.1, ty, 0.02, 0, 0, 0.8 + 0.6 * Math.sin(6 * s + phase + Math.PI)], f + 6);
      // A prediction: the next second of the torso's circular path.
      for (let i = 0; i < 20; i++) {
        const a = 0.8 * (s + i * 0.05) + phase;
        path.set([0.5 * Math.cos(a), 0.5 * Math.sin(a), 0.3], ((t * nEnvs + e) * 20 + i) * 3);
      }
    }
  }
  return { pose, force, path };
}

function run(name, nEnvs, origins) {
  const m = motion(nEnvs);
  const files = {
    [`runs/${name}/rollout.json`]: {
      format: "simscope-rollout/1",
      id: "01J9Z3DEMO0000000000000000",
      name,
      created: "2026-09-30T12:00:00Z",
      status: "complete",
      dt: DT,
      n_frames: T,
      n_envs: nEnvs,
      n_bodies: B,
      scene: { sha256: sceneSha, size: sceneBytes.length },
      env_scenes: null,
      env_origins: origins,
      streams: {
        body_pose: { file: "body_pose.blk", kind: "pose", item_shape: [B, 7] },
        contact: { file: "contact.blk", kind: "arrows", item_shape: [2, 6] },
        prediction: { file: "prediction.blk", kind: "polyline", item_shape: [20, 3] },
      },
      source: { simulator: "mujoco", version: "3.14.0" },
      tags: ["demo"],
      meta: {},
    },
    [`runs/${name}/body_pose.blk`]: encodeBlk({ itemShape: [B, 7], nEnvs, nFrames: T, codec: "q16d", data: m.pose }),
    [`runs/${name}/contact.blk`]: encodeBlk({ itemShape: [2, 6], nEnvs, nFrames: T, codec: "f32s", data: m.force }),
    [`runs/${name}/prediction.blk`]: encodeBlk({ itemShape: [20, 3], nEnvs, nFrames: T, codec: "f32s", data: m.path }),
    [`runs/${name}/annotations.json`]: {
      events: [
        { t0: 1.0, t1: 1.6, label: "arm swing", type: "note" },
        { t0: 3.2, t1: 3.2, label: "bump", author: "demo" },
      ],
    },
    // Automatic highlights (contracts §4): the lean player draws them as ticks on the scrub bar.
    [`derived/${name}/highlights.json`]: {
      format: "simscope-highlights/1",
      detector: "simscope/1",
      signals: [{ key: "acceleration", label: "Acceleration", unit: "m/s²" }],
      highlights: [
        { t: 0.8, frame: 40, env: 0, signal: "acceleration", score: 7.1, value: 9.2, body: 1 },
        { t: 2.4, frame: 120, env: 0, signal: "acceleration", score: 11.4, value: 14.8, body: 1 },
        { t: 4.1, frame: 205, env: 0, signal: "acceleration", score: 8.3, value: 10.5, body: 1 },
      ],
    },
  };
  return files;
}

const pack = encodePack({
  ...run("walk", 1, [[0, 0, 0]]),
  ...run("grid", 4, [[-2, -2, 0], [2, -2, 0], [-2, 2, 0], [2, 2, 0]]),
  [cas("scenes", sceneSha, ".json")]: sceneBytes,
  [cas("assets", meshSha)]: meshBytes,
  [cas("assets", texSha)]: textureBytes,
});
fs.writeFileSync(path.join(here, "demo.simscope"), pack);

const b64 = Buffer.from(pack).toString("base64").replace(/(.{100})/g, "$1\n");
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>simscope-player demo</title>
<style>
  body { font: 14px system-ui, sans-serif; margin: 24px; max-width: 980px; }
  .row { display: flex; gap: 16px; flex-wrap: wrap; }
  simscope-player { flex: 1 1 420px; border: 1px solid #0002; }
  button { margin: 4px 4px 0 0; }
  .master { display: flex; gap: 8px; align-items: center; margin: 8px 0; }
  .master .track { position: relative; flex: 1; height: 24px; }
  .master .marks { position: absolute; left: 0; right: 0; top: 0; height: 6px; }
  .master .marks i { position: absolute; height: 6px; min-width: 3px; background: #d1495b; }
  .master .scrub { position: absolute; left: 0; right: 0; bottom: 0; width: 100%; }
</style>
</head>
<body>
<h1>simscope-player</h1>
<p>Players share one WebGL context. Generated by <code>demo/make_demo.mjs</code>; this page makes no network requests.</p>
<div class="row">
  <simscope-player id="a" src="#pack" run="walk" loop autoplay></simscope-player>
  <simscope-player id="b" src="#pack" run="grid" view="top" loop speed="0.5" autoplay></simscope-player>
</div>
<p>
  <button onclick="a.play()">play A</button><button onclick="a.pause()">pause A</button>
  <button onclick="a.seek(2.5)">A: seek 2.5 s</button>
  <button onclick="a.setView('front')">A: front</button><button onclick="a.setView('iso')">A: iso</button>
  <button onclick="b.setView('side')">B: side</button><button onclick="b.setView('top')">B: top</button>
  <button onclick="a.snapshot().then(b => window.open(URL.createObjectURL(b)))">A: snapshot</button>
</p>
<p>
  Follow (A):
  <button onclick="a.setAttribute('follow', 'off')">off</button><button onclick="a.setAttribute('follow', 'position')">position</button><button onclick="a.setAttribute('follow', 'pose')">pose</button><button onclick="a.setAttribute('follow', 'heading')">heading</button>
  Ground:
  <button onclick="document.querySelectorAll('simscope-player').forEach(e => e.setAttribute('ground', 'checker'))">checker</button><button onclick="document.querySelectorAll('simscope-player').forEach(e => e.setAttribute('ground', 'grid'))">grid</button>
  Theme:
  <button onclick="document.querySelectorAll('simscope-player').forEach(e => e.setAttribute('theme', 'light'))">light</button><button onclick="document.querySelectorAll('simscope-player').forEach(e => e.setAttribute('theme', 'dark'))">dark</button>
</p>
<h2>Compare</h2>
<p>Two players on one clock (<code>sync="cmp"</code>) and one master control.</p>
<div class="master" id="ss-master" hidden data-autoplay="1" data-loop="1">
  <button id="ss-play" disabled>Play</button>
  <div class="track"><div class="marks" id="ss-marks"></div><input class="scrub" id="ss-scrub" type="range" min="0" max="1000" value="0" disabled></div>
  <span id="ss-time">0.00s / 0.00s</span>
  <select id="ss-speed"><option>0.25</option><option>0.5</option><option selected>1</option><option>2</option></select>
</div>
<div class="row">
  <simscope-player id="c" sync="cmp" nocontrols src="#pack" run="walk"></simscope-player>
  <simscope-player id="d" sync="cmp" nocontrols src="#pack" run="grid"></simscope-player>
</div>
<pre id="log"></pre>
<script type="text/plain" id="pack">
${b64}
</script>
<script src="../../src/simscope/_assets/simscope-player.js"></script>
<script>
  SimscopePlayer.attachMaster(document.getElementById("ss-master"), "cmp");
  for (const el of document.querySelectorAll("simscope-player")) {
    for (const type of ["ready", "ended", "error"]) {
      el.addEventListener(type, (e) => { document.getElementById("log").textContent += el.id + " " + type + " " + JSON.stringify(e.detail) + "\\n"; });
    }
  }
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(here, "index.html"), html);
console.log(`demo.simscope: ${pack.length} bytes; index.html: ${html.length} bytes`);
