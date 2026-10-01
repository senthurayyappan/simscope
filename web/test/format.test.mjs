import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import * as fmt from "../src/core/format.js";
import { encodeBlk, encodeMesh, encodePack, zlibCrc32 } from "./encoder.mjs";

// Small deterministic PRNG so failures reproduce.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** A random-walk pose stream [T, E, B, 7] with unit quaternions. */
function poseData(T, E, B, seed = 1) {
  const r = rng(seed);
  const data = new Float32Array(T * E * B * 7);
  const state = new Float64Array(E * B * 7);
  for (let i = 0; i < E * B; i++) state[i * 7 + 6] = 1;
  for (let t = 0; t < T; t++) {
    for (let i = 0; i < E * B; i++) {
      const s = state.subarray(i * 7, i * 7 + 7);
      for (let j = 0; j < 3; j++) s[j] += (r() - 0.5) * 0.02;
      for (let j = 3; j < 7; j++) s[j] += (r() - 0.5) * 0.02;
      const n = Math.hypot(s[3], s[4], s[5], s[6]);
      for (let j = 3; j < 7; j++) s[j] /= n;
      data.set(s, (t * E * B + i) * 7);
    }
  }
  return data;
}

const bits = (f32) => Array.from(new Uint32Array(f32.buffer, f32.byteOffset, f32.length));

test("crc32 matches zlib", () => {
  const r = rng(7);
  for (const n of [0, 1, 5, 1000]) {
    const b = new Uint8Array(n).map(() => r() * 256);
    assert.equal(fmt.crc32(b), zlibCrc32(b));
  }
  assert.equal(fmt.crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
});

test("f32s is bit-exact, including NaN payloads and -0", async () => {
  const T = 250, E = 2, B = 3, K = B * 7;
  const data = poseData(T, E, B);
  const words = new Uint32Array(data.buffer);
  words[5] = 0x7fc00001; // NaN with payload
  words[17] = 0xff800000; // -inf
  words[100] = 0x80000000; // -0
  const file = encodeBlk({ itemShape: [B, 7], nEnvs: E, nFrames: T, blockFrames: 100, codec: "f32s", data });
  const blk = fmt.parseBlk(file);
  assert.deepEqual([blk.nEnvs, blk.nFrames, blk.blockFrames, blk.itemK], [E, T, 100, K]);
  assert.equal(blk.blocks.length, 3 * E);
  assert.equal(blk.blocks.at(-1).n, 50); // short last window
  for (let e = 0; e < E; e++) {
    const got = await fmt.decodeEnv(blk, e);
    for (let t = 0; t < T; t++) {
      const want = data.subarray((t * E + e) * K, (t * E + e + 1) * K);
      assert.deepEqual(bits(got.subarray(t * K, (t + 1) * K)), bits(want), `env ${e} frame ${t}`);
    }
  }
});

test("scalar streams (item_ndim 0) decode", async () => {
  const T = 130;
  const data = Float32Array.from({ length: T }, (_, i) => Math.sin(i / 7));
  const blk = fmt.parseBlk(encodeBlk({ itemShape: [], nEnvs: 1, nFrames: T, codec: "f32s", data }));
  assert.equal(blk.itemK, 1);
  assert.deepEqual(bits(await fmt.decodeEnv(blk, 0)), bits(data));
});

test("q16d error is bounded and poses are renormalized", async () => {
  const T = 300, E = 1, B = 4, K = B * 7;
  const data = poseData(T, E, B, 3);
  const blk = fmt.parseBlk(encodeBlk({ itemShape: [B, 7], nEnvs: E, nFrames: T, codec: "q16d", data }));
  const got = await fmt.decodeEnv(blk, 0, { pose: true });
  let worst = 0;
  for (let i = 0; i < got.length; i++) worst = Math.max(worst, Math.abs(got[i] - data[i]));
  assert.ok(worst < 2e-4, `worst error ${worst}`);
  for (let i = 0; i < T * B; i++) {
    const q = got.subarray(i * 7 + 3, i * 7 + 7);
    assert.ok(Math.abs(Math.hypot(...q) - 1) < 1e-6, "quaternion not unit");
  }
  // Without the flag the quaternions are just dequantized.
  const raw = await fmt.decodeEnv(blk, 0);
  assert.equal(raw.length, T * K);
});

test("q16d handles constant components (step = 0)", async () => {
  const T = 10;
  const data = new Float32Array(T * 2).map((_, i) => (i % 2 ? 1.25 : i));
  const blk = fmt.parseBlk(encodeBlk({ itemShape: [2], nEnvs: 1, nFrames: T, codec: "q16d", data }));
  const got = await fmt.decodeEnv(blk, 0);
  for (let t = 0; t < T; t++) assert.equal(got[t * 2 + 1], 1.25);
  assert.ok(Math.abs(got[2 * 5] - 10) < 1e-3);
});

test("unfinished block files are rejected with a clear error", () => {
  const data = poseData(30, 1, 2, 9);
  const open = encodeBlk({ itemShape: [2, 7], nEnvs: 1, nFrames: 30, codec: "f32s", data, finalize: false });
  assert.throws(() => fmt.parseBlk(open), /unfinished block file \(dir_offset = 0\)/);
});

test("empty finished streams parse to zero blocks", () => {
  const file = encodeBlk({ itemShape: [2, 7], nEnvs: 1, nFrames: 0, codec: "f32s", data: new Float32Array(0) });
  const blk = fmt.parseBlk(file);
  assert.deepEqual([blk.nFrames, blk.blocks.length], [0, 0]);
  assert.equal(fmt.indexWindows(blk).length, 0);
});

test("windows index blocks by time window and env", () => {
  const data = poseData(250, 2, 1);
  const blk = fmt.parseBlk(encodeBlk({ itemShape: [1, 7], nEnvs: 2, nFrames: 250, codec: "f32s", data }));
  const w = fmt.indexWindows(blk);
  assert.equal(w.length, 3);
  assert.equal(w[2][1].t0, 200);
});

test("block errors are explicit", async () => {
  const data = poseData(20, 1, 1);
  const file = encodeBlk({ itemShape: [1, 7], nEnvs: 1, nFrames: 20, codec: "f32s", data });

  const badMagic = file.slice();
  badMagic[0] = 0x58;
  assert.throws(() => fmt.parseBlk(badMagic), /simscope: bad SSBK magic/);

  const badHeader = file.slice();
  badHeader[36] ^= 1; // n_frames, covered by header CRC
  assert.throws(() => fmt.parseBlk(badHeader), /header CRC mismatch/);

  const badMajor = file.slice();
  new DataView(badMajor.buffer).setUint16(4, 2, true);
  assert.throws(() => fmt.parseBlk(badMajor), /unsupported block file major version 2/);

  const blk = fmt.parseBlk(file);
  const corrupt = file.slice();
  corrupt[blk.blocks[0].offset + 40] ^= 0xff;
  await assert.rejects(fmt.decodeBlock(fmt.parseBlk(corrupt), blk.blocks[0]), /block CRC mismatch/);

  const badCodec = file.slice();
  badCodec[blk.blocks[0].offset + 4] = 9;
  await assert.rejects(fmt.decodeBlock(fmt.parseBlk(badCodec), blk.blocks[0]), /unknown block codec 9/);

  const badMagicBlock = file.slice();
  badMagicBlock[blk.blocks[0].offset] = 0;
  await assert.rejects(fmt.decodeBlock(fmt.parseBlk(badMagicBlock), blk.blocks[0]), /bad SSBB magic/);
});

function cube() {
  const verts = new Float32Array([
    -1, -1, -1, 1, -1, -1, 1, 1, -1, -1, 1, -1, -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1,
  ]).map((v) => v * 0.5);
  const faces = new Uint32Array([
    0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 2, 3, 7, 2, 7, 6, 1, 2, 6, 1, 6, 5, 3, 0, 4, 3, 4, 7,
  ]);
  const uvs = new Float32Array(16).map((_, i) => (i % 5) / 4);
  return { verts, faces, uvs };
}

test("raw mesh round trip; normals computed when absent", async () => {
  const { verts, faces, uvs } = cube();
  const m = await fmt.decodeMesh(encodeMesh({ verts, faces, uvs, codec: "raw" }));
  assert.deepEqual(Array.from(m.verts), Array.from(verts));
  assert.deepEqual(Array.from(m.faces), Array.from(faces));
  assert.deepEqual(Array.from(m.uvs), Array.from(uvs));
  assert.equal(m.normals.length, verts.length);
  // Stored normals are passed through untouched.
  const normals = new Float32Array(verts.length).fill(0.25);
  const m2 = await fmt.decodeMesh(encodeMesh({ verts, faces, normals, codec: "raw" }));
  assert.deepEqual(Array.from(m2.normals), Array.from(normals));
  assert.equal(m2.uvs, null);
});

test("q16 mesh decodes within step/2 and gets outward normals", async () => {
  const { verts, faces, uvs } = cube();
  const m = await fmt.decodeMesh(encodeMesh({ verts, faces, uvs, codec: "q16" }));
  assert.deepEqual(Array.from(m.faces), Array.from(faces));
  for (let i = 0; i < verts.length; i++) assert.ok(Math.abs(m.verts[i] - verts[i]) < 1e-4);
  for (let i = 0; i < uvs.length; i++) assert.ok(Math.abs(m.uvs[i] - uvs[i]) < 1e-4);
  for (let v = 0; v < 8; v++) {
    // A cube corner's normal points away from the centre.
    const dot = m.normals[3 * v] * verts[3 * v] + m.normals[3 * v + 1] * verts[3 * v + 1] + m.normals[3 * v + 2] * verts[3 * v + 2];
    assert.ok(dot > 0.5, `vertex ${v} normal points inward`);
  }
});

test("mesh errors are explicit", async () => {
  const { verts, faces } = cube();
  const blob = encodeMesh({ verts, faces, codec: "q16" });
  const badMagic = blob.slice();
  badMagic[1] = 0;
  await assert.rejects(fmt.decodeMesh(badMagic), /bad SSMH magic/);
  const badCrc = blob.slice();
  badCrc[40] ^= 1;
  await assert.rejects(fmt.decodeMesh(badCrc), /mesh CRC mismatch/);
  const badCodec = blob.slice();
  badCodec[20] = 7;
  await assert.rejects(fmt.decodeMesh(badCodec), /unknown mesh codec 7/);
  const badMajor = blob.slice();
  badMajor[4] = 2;
  await assert.rejects(fmt.decodeMesh(badMajor), /unsupported mesh major version 2/);
});

test("pack round trip, gzip wrapper, and errors", async () => {
  const files = {
    "runs/a/rollout.json": { format: "simscope-rollout/1", n_frames: 3 },
    "assets/ab/abcdef": new Uint8Array([1, 2, 3, 4, 5]),
  };
  const pack = encodePack(files);
  const { entries } = fmt.parsePack(pack);
  assert.deepEqual([...entries.keys()], Object.keys(files));
  assert.deepEqual(Array.from(entries.get("assets/ab/abcdef")), [1, 2, 3, 4, 5]);
  assert.equal(fmt.parseJson(entries.get("runs/a/rollout.json"), "manifest").n_frames, 3);

  const zlib = await import("node:zlib");
  const gz = await fmt.unwrapPack(new Uint8Array(zlib.gzipSync(pack)));
  assert.equal(gz.entries.size, 2);

  const bad = pack.slice();
  bad[0] = 0;
  assert.throws(() => fmt.parsePack(bad), /bad SSPK magic/);
  const badDir = pack.slice();
  badDir[badDir.length - 3] ^= 1;
  assert.throws(() => fmt.parsePack(badDir), /directory CRC mismatch/);
  const badMajor = pack.slice();
  badMajor[4] = 3;
  assert.throws(() => fmt.parsePack(badMajor), /unsupported pack major version 3/);
});

test("checkFormat and casPath", () => {
  fmt.checkFormat({ format: "simscope-scene/1" }, "simscope-scene", "scene");
  assert.throws(() => fmt.checkFormat({ format: "simscope-scene/2" }, "simscope-scene", "scene"), /major version 2/);
  assert.throws(() => fmt.checkFormat({}, "simscope-scene", "scene"), /expected format/);
  assert.equal(fmt.casPath("assets", "abcd"), "assets/ab/abcd");
});

test("decoding 1000 frames x 31 bodies (f32s) meets the 10 ms budget", async () => {
  const T = 1000, B = 31, K = B * 7;
  const data = poseData(T, 1, B, 5);
  const blk = fmt.parseBlk(encodeBlk({ itemShape: [B, 7], nEnvs: 1, nFrames: T, blockFrames: 100, codec: "f32s", data }));
  await fmt.decodeEnv(blk, 0); // warm up the JIT
  const runs = [];
  for (let i = 0; i < 7; i++) {
    const t0 = performance.now();
    const out = await fmt.decodeEnv(blk, 0);
    runs.push(performance.now() - t0);
    assert.equal(out.length, T * K);
  }
  runs.sort((a, b) => a - b);
  const median = runs[3];
  console.log(`# decode 1000x31 f32s: median ${median.toFixed(2)} ms (min ${runs[0].toFixed(2)})`);
  // Shared CI runners are several times slower and noisy; the strict 10 ms
  // budget applies on a developer machine, and web/bench tracks the numbers.
  const slack = process.env.CI ? 5 : 1;
  assert.ok(median < 10 * slack, `median ${median} ms`);
});

// Golden files from the Python reference writer (tests/fixtures/format/).
const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../tests/fixtures/format");
const hasGolden = fs.existsSync(path.join(FIXTURES, "expected.json"));
const skip = !hasGolden && "tests/fixtures/format/expected.json not present";
const golden = () => JSON.parse(fs.readFileSync(path.join(FIXTURES, "expected.json"), "utf8"));
const readFixture = (name) => new Uint8Array(fs.readFileSync(path.join(FIXTURES, name)));

/** Decode a whole stream into a Float32Array laid out [t][env][item...]. */
async function decodeAll(blk, options = {}) {
  const K = blk.itemK, E = blk.nEnvs;
  const out = new Float32Array(blk.nFrames * E * K);
  for (let e = 0; e < E; e++) {
    const env = await fmt.decodeEnv(blk, e, options);
    for (let t = 0; t < blk.nFrames; t++) out.set(env.subarray(t * K, (t + 1) * K), (t * E + e) * K);
  }
  return out;
}

const sameFloats = (got, want, label) => {
  assert.equal(got.length, want.length, `${label}: length`);
  for (let i = 0; i < want.length; i++) assert.ok(got[i] === want[i], `${label}[${i}]: ${got[i]} !== ${want[i]}`);
};

test("golden f32s block file is bit-exact", { skip }, async () => {
  const g = golden().f32s;
  const blk = fmt.parseBlk(readFixture(g.file));
  assert.deepEqual([blk.nFrames, blk.nEnvs, blk.blockFrames, blk.itemShape], [g.n_frames, g.n_envs, g.block_frames, g.item_shape]);
  assert.deepEqual(blk.blocks.map((b) => b.codec), g.codecs);
  const got = await decodeAll(blk);
  assert.deepEqual(bits(got), g.bits); // includes NaN payloads, -0 and infinities
});

test("golden q16d block file matches exactly, raw and renormalized", { skip }, async () => {
  const g = golden().q16d;
  const blk = fmt.parseBlk(readFixture(g.file));
  assert.deepEqual([blk.nFrames, blk.nEnvs, blk.blockFrames, blk.itemShape], [g.n_frames, g.n_envs, g.block_frames, g.item_shape]);
  assert.deepEqual(blk.blocks.map((b) => b.codec), g.codecs);
  sameFloats(await decodeAll(blk), g.values_raw, "q16d raw");
  sameFloats(await decodeAll(blk, { pose: true }), g.values_renormalized, "q16d renormalized");
});

test("golden meshes decode exactly", { skip }, async () => {
  const g = golden();
  const raw = await fmt.decodeMesh(readFixture(g.mesh_raw.file));
  assert.deepEqual([raw.nVerts, raw.nFaces], [g.mesh_raw.n_verts, g.mesh_raw.n_faces]);
  sameFloats(raw.verts, g.mesh_raw.vertices, "raw vertices");
  sameFloats(raw.faces, g.mesh_raw.faces, "raw faces");
  sameFloats(raw.normals, g.mesh_raw.normals, "raw normals");
  sameFloats(raw.uvs, g.mesh_raw.uvs, "raw uvs");

  const q = await fmt.decodeMesh(readFixture(g.mesh_q16.file));
  assert.deepEqual([q.nVerts, q.nFaces], [g.mesh_q16.n_verts, g.mesh_q16.n_faces]);
  sameFloats(q.verts, g.mesh_q16.vertices, "q16 vertices");
  sameFloats(q.faces, g.mesh_q16.faces, "q16 faces");
  sameFloats(q.uvs, g.mesh_q16.uvs, "q16 uvs");
  assert.equal(q.normals.length, q.verts.length); // computed by the reader
  for (let i = 0; i < q.normals.length; i += 3) {
    assert.ok(Math.abs(Math.hypot(q.normals[i], q.normals[i + 1], q.normals[i + 2]) - 1) < 1e-5);
  }
});

test("golden two-run pack: directory, manifests, scenes, streams", { skip }, async () => {
  const g = golden().pack;
  const { entries } = await fmt.unwrapPack(readFixture(g.file));
  assert.deepEqual([...entries.keys()].sort(), [...g.paths].sort());
  for (const p of g.shared_mesh_entries) assert.ok(entries.has(p), p);
  for (const [name, run] of Object.entries(g.runs)) {
    const manifest = fmt.parseJson(entries.get(`runs/${name}/rollout.json`), "manifest");
    fmt.checkFormat(manifest, "simscope-rollout", name);
    assert.deepEqual(manifest, run.manifest);
    const scene = fmt.parseJson(entries.get(run.scene_path), "scene");
    fmt.checkFormat(scene, "simscope-scene", name);
    assert.equal(scene.bodies.length, manifest.n_bodies);
    for (const m of scene.meshes) {
      const mesh = await fmt.decodeMesh(entries.get(fmt.casPath("assets", m.sha256)));
      assert.deepEqual([mesh.nVerts, mesh.nFaces], [m.n_verts, m.n_faces]);
    }
    for (const [sname, s] of Object.entries(run.streams)) {
      const blk = fmt.parseBlk(entries.get(`runs/${name}/${s.file}`));
      assert.deepEqual([blk.nFrames, blk.nEnvs, blk.itemShape], [manifest.n_frames, manifest.n_envs, manifest.streams[sname].item_shape]);
      sameFloats(await decodeAll(blk, { pose: s.kind === "pose" }), s.values, `${name}/${sname}`);
    }
  }
});
