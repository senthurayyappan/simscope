// Reading a run's files through a Source: the manifest, its streams' block
// directories, annotations, and the derived files. No three.js here, so Node
// can test it.

import { makeStream } from "./cache.js";
import * as fmt from "./format.js";
import { SourceError } from "./source.js";

export const POSE_STREAM = "body_pose";
export const CONTACTS_STREAM = "contacts";

function fail(message) {
  throw new Error(`simscope: ${message}`);
}

/**
 * Pick the run to open: the named one, else the source's first. A named run
 * is not checked against the source's run list (over HTTP that is every run
 * of the library); a missing one fails when its manifest is read.
 */
export async function chooseRun(source, run) {
  if (run) return run;
  const runs = await source.runs();
  if (!runs.length) fail("pack contains no runs");
  return runs[0];
}

/** Parse and validate `runs/<run>/rollout.json`. */
export async function readManifest(source, run) {
  let bytes;
  try {
    bytes = await source.get(`runs/${run}/rollout.json`);
  } catch (err) {
    if (!(err instanceof SourceError) || err.status !== 404) throw err;
    const have = await source.runs().catch(() => []);
    const list = have.length > 0 && have.length <= 20 ? ` (have: ${have.join(", ")})` : "";
    return fail(`run "${run}" not found${list}`);
  }
  const manifest = fmt.parseJson(bytes, "rollout.json");
  fmt.checkFormat(manifest, "simscope-rollout", "rollout.json");
  const nEnvs = manifest.n_envs;
  if (!(nEnvs >= 1) || !(manifest.n_frames >= 0) || !(manifest.dt > 0)) fail("manifest needs n_envs >= 1, n_frames >= 0, dt > 0");
  return manifest;
}

/**
 * Open the block directories of every stream the player draws or plots.
 *
 * @returns {Promise<Map<string, object>>}  name -> store stream, plus
 *   `kind`, `shape` and manifest `info` on each.
 */
export async function readStreams(source, run, manifest) {
  const out = new Map();
  const entries = Object.entries(manifest.streams || {});
  const indexes = await Promise.all(
    entries.map(async ([name, info]) => {
      const path = `runs/${run}/${info.file}`;
      try {
        return await source.blockIndex(path);
      } catch (err) {
        // A live run may list a stream that has no windows yet.
        if (err instanceof SourceError && err.status === 404 && name !== POSE_STREAM) return null;
        throw err;
      }
    }),
  );
  entries.forEach(([name, info], i) => {
    const index = indexes[i];
    if (!index) return;
    if (index.nEnvs !== manifest.n_envs) fail(`stream ${info.file}: ${index.nEnvs} envs, manifest says ${manifest.n_envs}`);
    const stream = makeStream(i + 1, `runs/${run}/${info.file}`, index, info.kind === "pose");
    Object.assign(stream, { name, kind: info.kind, shape: index.itemShape, info });
    out.set(name, stream);
  });
  return out;
}

/** Annotation events (`annotations.json`) as timeline markers; empty when absent. */
export async function readEvents(source, run) {
  let bytes;
  try {
    bytes = await source.get(`runs/${run}/annotations.json`);
  } catch (err) {
    if (err instanceof SourceError && err.status === 404) return [];
    throw err;
  }
  const ann = fmt.parseJson(bytes, "annotations.json");
  return (Array.isArray(ann.events) ? ann.events : [])
    .filter((e) => Number.isFinite(e.t0))
    .map((e) => ({ t0: e.t0, t1: Number.isFinite(e.t1) ? e.t1 : e.t0, label: String(e.label ?? "") }));
}

/** A derived JSON document (`derived/<run>/…`), or null when it does not apply. */
export async function readDerivedJson(source, path) {
  try {
    return fmt.parseJson(await source.get(path), path);
  } catch (err) {
    if (err instanceof SourceError && (err.status === 404 || err.status === 202)) return null;
    throw err;
  }
}

/** Frames every listed stream has on disk (a live run's readable length). */
export function coveredFrames(manifest, streams) {
  let frames = manifest.n_frames;
  for (const s of streams) frames = Math.min(frames, s.nFrames);
  return frames;
}
