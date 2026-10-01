import assert from "node:assert/strict";
import test from "node:test";

import { BlockStore } from "../src/core/cache.js";
import * as plots from "../src/core/plots.js";
import { readManifest, readStreams } from "../src/core/run.js";
import { PackSource } from "../src/core/source.js";
import { WindowView } from "../src/core/window_view.js";
import { makeRunPack, poseData } from "./fixtures.mjs";

/** A loaded-run stand-in: what plots.js reads from the player's `r`. */
async function loadedRun({ T = 250, E = 3, B = 3, extra = {}, files = {} } = {}) {
  const { pack, data } = makeRunPack({ T, E, B, extra, files });
  const source = new PackSource(pack);
  const manifest = await readManifest(source, "r");
  const streams = await readStreams(source, "r", manifest);
  const origins = new Float32Array(3 * E);
  origins[3 * 1 + 2] = 10; // env 1 sits 10 m up
  const r = {
    source,
    run: "r",
    dt: manifest.dt,
    nEnvs: E,
    B,
    K: B * 7,
    streams,
    pose: streams.get("body_pose"),
    store: new BlockStore(source),
    origins,
    seriesCache: new Map(),
    derived: new Map(),
  };
  return { r, data };
}

test("series: one component of one env over the whole timeline, across windows", async () => {
  const T = 250, E = 3, B = 3, K = B * 7;
  const { r, data } = await loadedRun({ T, E, B });
  const x = await plots.series(r, "body_pose", 2, 7 * 1); // body 1, x
  assert.equal(x.length, T);
  for (const t of [0, 99, 100, 101, 249]) assert.equal(x[t], data[(t * E + 2) * K + 7], `frame ${t}`);
  const again = await plots.series(r, "body_pose", 2, 7 * 1);
  assert.deepEqual(Array.from(again), Array.from(x));
  assert.equal(r.seriesCache.size, 1, "the env's whole array is cached once");
});

test("series: scalar streams and bad arguments", async () => {
  const T = 250, E = 2;
  const reward = Float32Array.from({ length: T * E }, (_, i) => Math.floor(i / E) + 0.5 * (i % E));
  const { r } = await loadedRun({ T, E, extra: { reward: { kind: "scalar", itemShape: [], data: reward } } });
  const y = await plots.series(r, "reward", 1);
  assert.equal(y[0], 0.5);
  assert.equal(y[249], 249.5);
  await assert.rejects(plots.series(r, "nope", 0), /no stream "nope"/);
  await assert.rejects(plots.series(r, "reward", 5), /env 5 out of range/);
  await assert.rejects(plots.series(r, "reward", 0, 3), /component 3 out of range/);
});

test("bodySeries height adds the env origin; speed is the central difference in m/s", async () => {
  const T = 250, E = 3, B = 3, K = B * 7;
  const { r, data } = await loadedRun({ T, E, B });
  const z = await plots.bodySeries(r, "height", 1, 2);
  assert.equal(z.length, T);
  assert.ok(Math.abs(z[10] - (data[(10 * E + 1) * K + 14 + 2] + 10)) < 1e-6);
  const v = await plots.bodySeries(r, "speed", 0, 1);
  // The fixture moves body 1 along +x at 0.01 m per frame = 0.5 m/s (dt 0.02).
  for (const t of [1, 50, 150, 248]) assert.ok(Math.abs(v[t] - 0.5) < 0.02, `t=${t}: ${v[t]}`);
  assert.ok(Math.abs(v[0] - 0.5) < 0.02 && Math.abs(v[249] - 0.5) < 0.02, "one-sided at the ends");
  await assert.rejects(plots.bodySeries(r, "accel", 0, 0), /unknown kind/);
  await assert.rejects(plots.bodySeries(r, "speed", 0, 9), /body 9 out of range/);
});

test("derived documents: cached, null when absent; envelopes come back as typed arrays", async () => {
  const env = { dt: 0.02, t0: 0, components: 2, p5: [[1, 2], [3, 4]], p50: [[2, 3], [4, 5]], p95: [[3, 4], [5, 6]] };
  const { r } = await loadedRun({
    files: {
      "derived/r/highlights.json": { highlights: [{ t: 1 }] },
      "derived/r/envelopes/reward.json": env,
    },
  });
  const a = plots.derived(r, "highlights.json");
  assert.equal(plots.derived(r, "highlights.json"), a, "one read per file");
  assert.deepEqual(await a, { highlights: [{ t: 1 }] });
  assert.equal(await plots.derived(r, "summaries.json"), null);
  const e = await plots.envelope(r, "reward", 1);
  assert.deepEqual([e.dt, e.t0, e.components, e.component], [0.02, 0, 2, 1]);
  assert.ok(e.p50 instanceof Float32Array);
  assert.deepEqual(Array.from(e.p5), [3, 4]);
  assert.deepEqual(Array.from(e.p95), [5, 6]);
  assert.equal(await plots.envelope(r, "reward", 2), null, "no such component");
  assert.equal(await plots.envelope(r, "missing", 0), null);
});

test("WindowView: refreshes only when the window, the env set or the store changed", async () => {
  const { r } = await loadedRun({ T: 250, E: 4 });
  const view = new WindowView(4);
  view.refresh(r.store, r.pose, 0, [0, 2], 1);
  assert.equal(view.complete, false);
  assert.deepEqual(view.arrs, [null, null, null, null]);
  await r.store.request(r.pose, 0, [0, 2]);
  view.refresh(r.store, r.pose, 0, [0, 2], 1);
  assert.equal(view.complete, true);
  assert.ok(view.arrs[0] instanceof Float32Array && view.arrs[2] instanceof Float32Array);
  assert.equal(view.arrs[1], null, "envs nobody asked for stay empty");
  const a0 = view.arrs[0];
  view.refresh(r.store, r.pose, 0, [0, 2], 1);
  assert.equal(view.arrs[0], a0, "unchanged: nothing re-read");
  // a new focus set with the same window: stale slots are cleared
  await r.store.request(r.pose, 0, [1]);
  view.refresh(r.store, r.pose, 0, [1], 2);
  assert.deepEqual(view.arrs.map((a) => a !== null), [false, true, false, false]);
  // another window
  view.refresh(r.store, r.pose, 1, [1], 2);
  assert.equal(view.arrs[1], null);
  assert.equal(view.complete, false);
});
