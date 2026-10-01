// A byte-bounded LRU for decoded windows (viewer v3 §6: 256 MB, not "three
// windows"), plus the store that fills it: ask for (stream, window, envs),
// get them decoded in the worker, read them back synchronously.

import { decodeBlocks, decodeWindow } from "./decode.js";

export const DEFAULT_CACHE_BYTES = 256 * 1024 * 1024;

/** Map with a byte budget; `get` refreshes recency and `set` evicts the oldest. */
export class ByteLRU {
  constructor(maxBytes = DEFAULT_CACHE_BYTES) {
    this.maxBytes = maxBytes;
    this.bytes = 0;
    this.map = new Map(); // key -> {value, size}
  }

  get size() {
    return this.map.size;
  }

  has(key) {
    return this.map.has(key);
  }

  /** The value, marked most recently used; undefined if absent. */
  get(key) {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    this.map.delete(key);
    this.map.set(key, hit);
    return hit.value;
  }

  /** The value without touching recency. */
  peek(key) {
    const hit = this.map.get(key);
    return hit ? hit.value : undefined;
  }

  set(key, value, size) {
    const old = this.map.get(key);
    if (old) this.bytes -= old.size;
    this.map.delete(key);
    this.map.set(key, { value, size });
    this.bytes += size;
    // Never evict the entry just written, even if it alone exceeds the budget.
    for (const [k, hit] of this.map) {
      if (this.bytes <= this.maxBytes || k === key) break;
      this.map.delete(k);
      this.bytes -= hit.size;
    }
  }

  delete(key) {
    const hit = this.map.get(key);
    if (!hit) return false;
    this.bytes -= hit.size;
    return this.map.delete(key);
  }

  clear() {
    this.map.clear();
    this.bytes = 0;
  }
}

/**
 * A stream of a run as the store sees it: where its blocks live, how they
 * are laid out, and a small integer `id` for cache keys.
 */
export function makeStream(id, path, index, pose) {
  return {
    id,
    path,
    pose,
    itemK: index.itemK,
    blockFrames: index.blockFrames,
    nEnvs: index.nEnvs,
    nFrames: index.nFrames,
    nWindows: Math.ceil(index.nFrames / index.blockFrames),
  };
}

// key = ((stream * 2^16 + window) * 2^24 + env): exact in a double up to
// 2^12 streams, 2^16 windows, 16M envs.
const keyOf = (stream, w, env) => (stream.id * 65536 + w) * 16777216 + env;
const DENSE = 16777215; // the env slot of a whole-window entry

export class BlockStore {
  /**
   * @param {object} source  a `Source`.
   * @param {number} [maxBytes]
   */
  constructor(source, maxBytes = DEFAULT_CACHE_BYTES) {
    this.source = source;
    this.lru = new ByteLRU(maxBytes);
    this.inflight = new Map(); // key -> Promise
    this.epoch = 0; // bumped whenever new data lands
    this.pending = 0;
    this.onChange = null;
    this.errors = new Map(); // key -> Error (windows the server does not have yet)
  }

  /** Decoded `[n, K]` array of one env's window, or undefined. */
  get(stream, w, env) {
    return this.lru.get(keyOf(stream, w, env));
  }

  has(stream, w, env) {
    return this.lru.has(keyOf(stream, w, env));
  }

  /** Whether every env in `envs` of window `w` is decoded. */
  ready(stream, w, envs) {
    for (let i = 0; i < envs.length; i++) if (!this.lru.has(keyOf(stream, w, envs[i]))) return false;
    return true;
  }

  /**
   * Fetch and decode the missing envs of window `w`. Resolves once all of
   * `envs` are cached (rejects on the first failure).
   */
  request(stream, w, envs) {
    if (w < 0 || w >= stream.nWindows) return Promise.resolve();
    const missing = [];
    const waits = [];
    for (let i = 0; i < envs.length; i++) {
      const e = envs[i];
      const k = keyOf(stream, w, e);
      if (this.lru.has(k)) continue;
      const flying = this.inflight.get(k);
      if (flying) waits.push(flying);
      else missing.push(e);
    }
    if (missing.length) {
      const job = this._fetch(stream, w, missing);
      for (const e of missing) this.inflight.set(keyOf(stream, w, e), job);
      waits.push(job);
    }
    return waits.length ? Promise.all(waits).then(() => undefined) : Promise.resolve();
  }

  /** A whole window of every env as one dense `{data: [n, E, K], n}`, or undefined. */
  getWindow(stream, w) {
    return this.lru.get(keyOf(stream, w, DENSE));
  }

  hasWindow(stream, w) {
    return this.lru.has(keyOf(stream, w, DENSE));
  }

  /**
   * Fetch and decode window `w` of every env into one dense array (frame-major,
   * `[n, E, K]`). For streams read for all envs each frame (the crowd's roots).
   */
  requestWindow(stream, w) {
    if (w < 0 || w >= stream.nWindows) return Promise.resolve();
    const k = keyOf(stream, w, DENSE);
    if (this.lru.has(k)) return Promise.resolve();
    let job = this.inflight.get(k);
    if (!job) {
      job = this._fetchDense(stream, w, k);
      this.inflight.set(k, job);
    }
    return job;
  }

  async _fetchDense(stream, w, key) {
    this._pending(+1);
    try {
      const envs = Array.from({ length: stream.nEnvs }, (_, i) => i);
      const blocks = await this.source.blocks(stream.path, w, envs);
      const win = await decodeWindow(blocks, stream.itemK, stream.pose);
      this.lru.set(key, win, win.data.byteLength);
      this.epoch++;
    } finally {
      this.inflight.delete(key);
      this._pending(-1);
    }
  }

  async _fetch(stream, w, envs) {
    this._pending(+1);
    const keys = envs.map((e) => keyOf(stream, w, e));
    try {
      const blocks = await this.source.blocks(stream.path, w, envs);
      const arrays = await decodeBlocks(blocks, stream.itemK, stream.pose);
      for (let i = 0; i < envs.length; i++) this.lru.set(keys[i], arrays[i], arrays[i].byteLength);
      this.epoch++;
    } finally {
      for (const k of keys) this.inflight.delete(k);
      this._pending(-1);
    }
  }

  _pending(d) {
    this.pending += d;
    if (this.onChange) this.onChange(this.pending);
  }

  /** Drop everything of a stream (live runs re-read windows that have grown). */
  forget(stream) {
    for (const k of [...this.lru.map.keys()]) if (Math.floor(k / (65536 * 16777216)) === stream.id) this.lru.delete(k);
    this.epoch++;
  }

  clear() {
    this.lru.clear();
    this.inflight.clear();
    this.epoch++;
  }

  get bytes() {
    return this.lru.bytes;
  }
}
