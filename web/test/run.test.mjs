import assert from "node:assert/strict";
import test from "node:test";

import { chooseRun, coveredFrames, readDerivedJson, readEvents, readManifest, readStreams } from "../src/core/run.js";
import { PackSource, SourceError } from "../src/core/source.js";
import { encodeBlk } from "./encoder.mjs";
import { makeRunPack } from "./fixtures.mjs";

const source = (opts) => new PackSource(makeRunPack(opts).pack);

test("chooseRun: the named run, else the first; an unnamed empty pack is an error", async () => {
  const s = source({ run: "a", files: { "runs/b/rollout.json": {} } });
  assert.equal(await chooseRun(s, "zzz"), "zzz", "named runs are not checked against the list");
  assert.ok(["a", "b"].includes(await chooseRun(s, "")));
  const empty = new PackSource(makeRunPack({ run: "a" }).pack);
  empty.runs = async () => [];
  await assert.rejects(chooseRun(empty, undefined), /no runs/);
});

test("readManifest: parses, and names the runs you have when the run is missing", async () => {
  const s = source({ run: "walk", T: 100, E: 3 });
  const m = await readManifest(s, "walk");
  assert.deepEqual([m.n_envs, m.n_frames, m.dt], [3, 100, 0.02]);
  await assert.rejects(readManifest(s, "run"), /run "run" not found \(have: walk\)/);
});

test("readManifest: rejects the wrong format and nonsense counts", async () => {
  const bad = (manifest) => new PackSource(makeRunPack({ files: { "runs/r/rollout.json": manifest } }).pack);
  await assert.rejects(readManifest(bad({ format: "other/1" }), "r"), /rollout/);
  await assert.rejects(readManifest(bad({ format: "simscope-rollout/1", n_envs: 0, n_frames: 5, dt: 0.1 }), "r"), /n_envs/);
  await assert.rejects(readManifest(bad({ format: "simscope-rollout/2", n_envs: 1, n_frames: 5, dt: 0.1 }), "r"), /version/);
});

test("readStreams: one store stream per manifest stream, with kind and shape, ids distinct", async () => {
  const T = 250, E = 2;
  const extra = { contacts: { kind: "arrows", itemShape: [4, 6], data: new Float32Array(T * E * 24) } };
  const s = source({ T, E, B: 3, extra });
  const m = await readManifest(s, "r");
  const streams = await readStreams(s, "r", m);
  assert.deepEqual([...streams.keys()], ["body_pose", "contacts"]);
  const pose = streams.get("body_pose");
  assert.deepEqual([pose.kind, pose.itemK, pose.pose, pose.nWindows, pose.nEnvs], ["pose", 21, true, 3, 2]);
  assert.deepEqual(streams.get("contacts").shape, [4, 6]);
  assert.equal(streams.get("contacts").pose, false);
  assert.notEqual(pose.id, streams.get("contacts").id);
  assert.equal(pose.path, "runs/r/body_pose.blk");
});

test("readStreams: a live run may list a stream with no blocks yet, but body_pose must exist", async () => {
  const { pack } = makeRunPack({ T: 100, E: 1 });
  const s = new PackSource(pack);
  const m = await readManifest(s, "r");
  m.streams.later = { file: "later.blk", kind: "scalar", item_shape: [] };
  const streams = await readStreams(s, "r", m);
  assert.equal(streams.has("later"), false);
  m.streams.body_pose.file = "gone.blk";
  await assert.rejects(readStreams(s, "r", m), (e) => e instanceof SourceError && e.status === 404);
});

test("readStreams: an env count that disagrees with the manifest is an error", async () => {
  const s = source({ T: 100, E: 2 });
  const m = await readManifest(s, "r");
  m.n_envs = 3;
  await assert.rejects(readStreams(s, "r", m), /2 envs, manifest says 3/);
});

test("readEvents: annotation events become markers; a missing file is none", async () => {
  const ann = { events: [{ t0: 1, t1: 2, label: "a" }, { t0: 3, label: 7 }, { label: "no time" }] };
  const s = new PackSource(makeRunPack({ files: { "runs/r/annotations.json": ann } }).pack);
  assert.deepEqual(await readEvents(s, "r"), [{ t0: 1, t1: 2, label: "a" }, { t0: 3, t1: 3, label: "7" }]);
  assert.deepEqual(await readEvents(source({}), "r"), []);
});

test("readDerivedJson: parsed when there, null when absent or still pending, other errors rethrown", async () => {
  const s = new PackSource(makeRunPack({ files: { "derived/r/highlights.json": { highlights: [] } } }).pack);
  assert.deepEqual(await readDerivedJson(s, "derived/r/highlights.json"), { highlights: [] });
  assert.equal(await readDerivedJson(s, "derived/r/summaries.json"), null);
  const pending = { get: async () => Promise.reject(new SourceError("pending", 202)) };
  assert.equal(await readDerivedJson(pending, "derived/r/x.json"), null);
  const broken = { get: async () => Promise.reject(new SourceError("boom", 500)) };
  await assert.rejects(readDerivedJson(broken, "derived/r/x.json"), /boom/);
});

test("coveredFrames: a live run is readable up to the shortest stream", () => {
  assert.equal(coveredFrames({ n_frames: 500 }, [{ nFrames: 400 }, { nFrames: 300 }]), 300);
  assert.equal(coveredFrames({ n_frames: 200 }, [{ nFrames: 400 }]), 200);
});

test("block files for live runs: a pack cannot hold one, so the decoder rejects it clearly", async () => {
  const live = encodeBlk({ itemShape: [], nEnvs: 1, nFrames: 100, finalize: false, data: new Float32Array(100) });
  const s = new PackSource(makeRunPack({ files: { "runs/r/s.blk": live } }).pack);
  await assert.rejects(s.blockIndex("runs/r/s.blk"), /unfinished/);
});
