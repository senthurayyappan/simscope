// Sources: the one seam between a pack held in memory (exports, fetched
// packs) and a library served over HTTP (`simscope serve`).
//
// Both are addressed by the same relative paths (contracts §1), so every
// other module reads `runs/<name>/rollout.json`, `scenes/…`, `derived/…` and
// block files through this interface and never knows which one it has.

import * as fmt from "./format.js";

/** A failed read. `status` is 404 (absent), 202 (derived file still pending), or an HTTP status. */
export class SourceError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "SourceError";
    this.status = status;
  }
}

// ---- block directories ----

const HEADER_SIZE = 64;
const BLOCK_HEADER = 32;

/** The directory shape that `Source.blockIndex` returns, from a `parseBlk` result. */
function indexOf(blk) {
  const { itemShape, itemK, nEnvs, nFrames, blockFrames, blocks } = blk;
  return { itemShape, itemK, nEnvs, nFrames, blockFrames, blocks };
}

/**
 * Parse what `/api/blk` returns: the 64-byte header followed by the
 * directory. The directory is read from `dir_offset` when the header points
 * into the body, else taken to start right after the header (a live file
 * whose header still says "unfinished"). The entries' `offset` fields are
 * file offsets and are not used over HTTP.
 */
export function parseBlkPrefix(bytes) {
  if (bytes.length < HEADER_SIZE || String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) !== "SSBK") {
    throw new SourceError("simscope: /api/blk did not return a block file header", 500);
  }
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const major = dv.getUint16(4, true);
  if (major !== 1) throw new SourceError(`simscope: unsupported block file major version ${major}`, 500);
  const itemNdim = dv.getUint32(12, true);
  const itemShape = [];
  let itemK = 1;
  for (let i = 0; i < Math.min(itemNdim, 4); i++) {
    itemShape.push(dv.getUint32(16 + 4 * i, true));
    itemK *= itemShape[i];
  }
  const nEnvs = dv.getUint32(32, true);
  let nFrames = dv.getUint32(36, true);
  const blockFrames = dv.getUint32(40, true);
  let nBlocks = dv.getUint32(44, true);
  const dirOffset = Number(dv.getBigUint64(48, true));
  const dirLength = dv.getUint32(56, true);
  let at = HEADER_SIZE;
  if (dirOffset >= HEADER_SIZE && dirOffset + dirLength <= bytes.length && dirLength === 32 * nBlocks) at = dirOffset;
  else nBlocks = Math.floor((bytes.length - HEADER_SIZE) / 32);
  const blocks = new Array(nBlocks);
  for (let i = 0; i < nBlocks; i++) {
    const e = at + 32 * i;
    blocks[i] = {
      offset: Number(dv.getBigUint64(e, true)),
      env: dv.getUint32(e + 8, true),
      t0: dv.getUint32(e + 12, true),
      n: dv.getUint32(e + 16, true),
      clen: dv.getUint32(e + 20, true),
      ulen: dv.getUint32(e + 24, true),
      codec: bytes[e + 28],
    };
  }
  // A recording file's header says n_frames = 0: take the frames the
  // directory covers.
  if (nFrames === 0) for (const b of blocks) nFrames = Math.max(nFrames, b.t0 + b.n);
  return { itemShape, itemK, nEnvs, nFrames, blockFrames, blocks };
}

/** Block bytes of window `w` per env, as `[env] -> entry` from a directory. */
export function windowEntries(index) {
  const windows = [];
  for (const b of index.blocks) {
    const w = Math.floor(b.t0 / index.blockFrames);
    (windows[w] || (windows[w] = new Array(index.nEnvs)))[b.env] = b;
  }
  return windows;
}

// ---- PackSource ----

/** A pack in memory. Blocks are copied out when asked for, ready to transfer. */
export class PackSource {
  /** @param {Uint8Array | ArrayBuffer} pack  the bytes of a `.simscope` pack. */
  constructor(pack) {
    const bytes = pack instanceof Uint8Array ? pack : new Uint8Array(pack);
    this.pack = fmt.parsePack(bytes);
    this._index = new Map(); // path -> {blk, windows}
  }

  /** Like the constructor, but also accepts a gzip-wrapped pack. */
  static async open(pack) {
    const bytes = pack instanceof Uint8Array ? pack : new Uint8Array(pack);
    return new PackSource(await fmt.inflateIfGzip(bytes));
  }

  has(path) {
    return this.pack.entries.has(path);
  }

  async get(path) {
    const bytes = this.pack.entries.get(path);
    if (!bytes) throw new SourceError(`simscope: entry missing from pack: ${path}`, 404);
    return bytes;
  }

  _blk(path) {
    let hit = this._index.get(path);
    if (!hit) {
      const bytes = this.pack.entries.get(path);
      if (!bytes) throw new SourceError(`simscope: stream missing from pack: ${path}`, 404);
      const blk = fmt.parseBlk(bytes);
      hit = { blk, windows: fmt.indexWindows(blk) };
      this._index.set(path, hit);
    }
    return hit;
  }

  async blockIndex(path) {
    return indexOf(this._blk(path).blk);
  }

  async blocks(path, w, envs) {
    const { blk, windows } = this._blk(path);
    const win = windows[w];
    return envs.map((env) => {
      const b = win && win[env];
      if (!b) throw new SourceError(`simscope: ${path} has no block for window ${w}, env ${env}`, 404);
      // A copy: a view would drag the whole pack through a structured clone.
      return blk.bytes.slice(b.offset, b.offset + BLOCK_HEADER + b.clen);
    });
  }

  async runs() {
    const names = new Set();
    for (const p of this.pack.entries.keys()) {
      const m = /^runs\/([^/]+)\/rollout\.json$/.exec(p);
      if (m) names.add(m[1]);
    }
    return [...names];
  }
}

// ---- HttpSource ----

const MAX_ENVS_PER_REQUEST = 256;
const PENDING_TIMEOUT_MS = 60_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Library paths that never change once written (contracts §2: `immutable`). */
const isImmutable = (path) => path.startsWith("scenes/") || path.startsWith("assets/");

/** `simscope serve`'s routes (contracts §2). */
export class HttpSource {
  /** @param {string} [base]  URL prefix of the server ("" for same origin). */
  constructor(base = "") {
    this.base = base.replace(/\/+$/, "");
    this._files = new Map(); // immutable path -> Promise<Uint8Array>
    this._index = new Map(); // path -> Promise<index>
  }

  /** GET with the 202 -> retry-with-backoff rule of derived files. */
  async _fetch(url, what) {
    const started = Date.now();
    let wait = 250;
    for (;;) {
      let res;
      try {
        res = await fetch(url);
      } catch (err) {
        throw new SourceError(`simscope: could not fetch ${what} (${err.message})`, 0);
      }
      if (res.status === 202) {
        if (Date.now() - started > PENDING_TIMEOUT_MS) throw new SourceError(`simscope: ${what} is still being computed`, 202);
        const hint = Number(res.headers.get("Retry-After"));
        await sleep(Math.max(wait, Number.isFinite(hint) ? hint * 1000 : 0));
        wait = Math.min(wait * 1.5, 2000);
        continue;
      }
      if (res.status === 404) throw new SourceError(`simscope: ${what} not found`, 404);
      if (!res.ok) throw new SourceError(`simscope: fetching ${what} failed with HTTP ${res.status}`, res.status);
      return res;
    }
  }

  get(path) {
    const load = async () => new Uint8Array(await (await this._fetch(`${this.base}/files/${path}`, path)).arrayBuffer());
    if (!isImmutable(path)) return load();
    let hit = this._files.get(path);
    if (!hit) {
      hit = load();
      this._files.set(path, hit);
      hit.catch(() => this._files.delete(path));
    }
    return hit;
  }

  async blockIndex(path, opts = {}) {
    let hit = opts.refresh ? null : this._index.get(path);
    if (!hit) {
      hit = (async () => {
        const res = await this._fetch(`${this.base}/api/blk?path=${encodeURIComponent(path)}`, path);
        const index = parseBlkPrefix(new Uint8Array(await res.arrayBuffer()));
        return { index, windows: windowEntries(index) };
      })();
      this._index.set(path, hit);
      hit.catch(() => this._index.delete(path));
    }
    return (await hit).index;
  }

  async blocks(path, w, envs) {
    const out = new Array(envs.length);
    const jobs = [];
    for (let at = 0; at < envs.length; at += MAX_ENVS_PER_REQUEST) {
      const slice = envs.slice(at, at + MAX_ENVS_PER_REQUEST);
      jobs.push(
        (async () => {
          const url = `${this.base}/api/blocks?path=${encodeURIComponent(path)}&w=${w}&envs=${slice.join(",")}`;
          const res = await this._fetch(url, `${path} window ${w}`);
          const lengths = (res.headers.get("X-Simscope-Block-Lengths") || "").split(",").map(Number);
          if (lengths.length !== slice.length) {
            throw new SourceError(`simscope: /api/blocks returned ${lengths.length} block lengths for ${slice.length} envs`, 500);
          }
          const body = new Uint8Array(await res.arrayBuffer());
          let o = 0;
          lengths.forEach((n, i) => {
            out[at + i] = body.slice(o, o + n);
            o += n;
          });
        })(),
      );
    }
    await Promise.all(jobs);
    return out;
  }

  async runs() {
    const res = await this._fetch(`${this.base}/api/runs`, "the run list");
    const doc = await res.json();
    return (doc.runs || []).map((r) => r.name);
  }
}
