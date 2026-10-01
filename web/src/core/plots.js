// Data for plots and highlights: a whole timeline of one env from the
// windows the store decodes, and the derived documents of a run
// (`derived/<run>/…`, contracts §1). Pure functions of a loaded run `r`
// (see player.js), so Node can test them.

import * as runs from "./run.js";

function fail(message) {
  throw new Error(`simscope: ${message}`);
}

/** Every frame of one env of a stream, `[T * K]`, cached per (stream, env, frame count). */
export function envArray(r, stream, env) {
  const key = `${stream.id}:${env}:${stream.nFrames}`;
  let hit = r.seriesCache.get(key);
  if (!hit) {
    hit = (async () => {
      const K = stream.itemK, bf = stream.blockFrames;
      const out = new Float32Array(stream.nFrames * K);
      for (let w = 0; w < stream.nWindows; w++) {
        await r.store.request(stream, w, [env]);
        const a = r.store.get(stream, w, env);
        if (a) out.set(a.subarray(0, Math.min(a.length, out.length - w * bf * K)), w * bf * K);
      }
      return out;
    })();
    r.seriesCache.set(key, hit);
    hit.catch(() => r.seriesCache.delete(key));
  }
  return hit;
}

/** One component of a recorded stream for one env over the whole timeline. */
export async function series(r, name, env, component = 0) {
  const stream = r.streams.get(name);
  if (!stream) fail(`series(): run has no stream "${name}"`);
  if (!(env >= 0 && env < r.nEnvs)) fail(`series(): env ${env} out of range`);
  if (!(component >= 0 && component < stream.itemK)) fail(`series(): component ${component} out of range (stream has ${stream.itemK})`);
  const all = await envArray(r, stream, env);
  const K = stream.itemK, T = stream.nFrames;
  const out = new Float32Array(T);
  for (let i = 0, j = component; i < T; i++, j += K) out[i] = all[j];
  return out;
}

/** Height (world z, env origin included) or speed (m/s) of one body of one env. */
export async function bodySeries(r, kind, env, body) {
  if (kind !== "height" && kind !== "speed") fail(`bodySeries(): unknown kind "${kind}"`);
  if (!(body >= 0 && body < r.B)) fail(`bodySeries(): body ${body} out of range`);
  if (!(env >= 0 && env < r.nEnvs)) fail(`bodySeries(): env ${env} out of range`);
  const all = await envArray(r, r.pose, env);
  const K = r.K, T = r.pose.nFrames, dt = r.dt;
  const at = body * 7;
  const out = new Float32Array(T);
  if (kind === "height") {
    const oz = r.origins[3 * env + 2];
    for (let i = 0; i < T; i++) out[i] = all[i * K + at + 2] + oz;
    return out;
  }
  for (let i = 0; i < T; i++) {
    // Central differences; one-sided at the ends.
    const a = Math.max(i - 1, 0), b = Math.min(i + 1, T - 1);
    const span = (b - a) * dt;
    out[i] = span > 0 ? Math.hypot(all[b * K + at] - all[a * K + at], all[b * K + at + 1] - all[a * K + at + 1], all[b * K + at + 2] - all[a * K + at + 2]) / span : 0;
  }
  return out;
}

/** A derived JSON document of the run, cached; null when it does not apply. */
export function derived(r, file) {
  let hit = r.derived.get(file);
  if (!hit) {
    hit = runs.readDerivedJson(r.source, `derived/${r.run}/${file}`);
    r.derived.set(file, hit);
    hit.catch(() => r.derived.delete(file));
  }
  return hit;
}

/**
 * A highlights document in the `simscope-highlights/2` shape (contracts
 * §8.2), whichever version it was written in. A `/1` document (old caches
 * and packs) has raw signal peaks: each becomes a moment whose `kind` and
 * `label` are the signal's. Both versions also get the `/1` fields
 * (`signal`, `signals`) that the app read before it knew `kind`, until it
 * stops reading them. Anything that is not a highlights document is returned
 * as it is.
 */
export function upgradeHighlights(doc) {
  if (!doc || !Array.isArray(doc.highlights)) return doc;
  const labels = new Map();
  for (const s of doc.signals || []) labels.set(s.key, s.label);
  for (const k of doc.kinds || []) labels.set(k.key, k.label);
  const highlights = doc.highlights.map((h) => {
    const kind = h.kind ?? h.signal;
    return {
      t1: null,
      frame1: null,
      ratio: null,
      body: null,
      also: [],
      detail: "",
      ...h,
      kind,
      label: h.label ?? labels.get(kind) ?? kind,
      signal: kind,
    };
  });
  const kinds = doc.kinds || (doc.signals || []).map((s) => ({ key: s.key, label: s.label }));
  const signals = doc.signals || kinds.map((k) => ({ key: k.key, label: k.label, unit: "" }));
  return { ...doc, kinds, signals, highlights };
}

/** `derived/<run>/highlights.json`, upgraded to the /2 shape and cached; null when absent. */
export function highlights(r) {
  const key = "highlights.json#2";
  let hit = r.derived.get(key);
  if (!hit) {
    hit = derived(r, "highlights.json").then(upgradeHighlights);
    r.derived.set(key, hit);
    hit.catch(() => r.derived.delete(key));
  }
  return hit;
}

/** One component of `derived/<run>/envelopes/<stream>.json` as typed arrays, or null. */
export async function envelope(r, stream, component = 0) {
  const doc = await derived(r, `envelopes/${stream}.json`);
  if (!doc || !Array.isArray(doc.p50) || !doc.p50[component]) return null;
  return {
    dt: doc.dt,
    t0: doc.t0 ?? 0,
    components: doc.components ?? doc.p50.length,
    component,
    p5: Float32Array.from(doc.p5[component]),
    p50: Float32Array.from(doc.p50[component]),
    p95: Float32Array.from(doc.p95[component]),
  };
}
