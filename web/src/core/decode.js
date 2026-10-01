// Main-thread side of the decode worker: one worker, a queue, and a cap of 8
// jobs in flight. The worker is created from a Blob URL of the bundled
// worker source (decode_worker.generated.js), so it works from file:// and
// needs no second file. If a worker cannot be created (no Worker, a CSP), the
// same handler runs on the main thread, one job per task.

import WORKER_SOURCE from "./decode_worker.generated.js";
import { handle } from "./decode_worker.js";

const MAX_IN_FLIGHT = 8;

function makeWorker() {
  if (typeof Worker === "undefined" || typeof Blob === "undefined" || typeof URL === "undefined" || !URL.createObjectURL) return null;
  if (!WORKER_SOURCE) return null;
  try {
    const url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: "text/javascript" }));
    const worker = new Worker(url);
    URL.revokeObjectURL(url);
    return worker;
  } catch {
    return null;
  }
}

class Decoder {
  constructor() {
    this.worker = null;
    this.started = false;
    this.nextId = 1;
    this.jobs = new Map(); // id -> {resolve, reject, msg, transfer}
    this.queue = [];
    this.inFlight = 0;
    this.onPending = null;
  }

  _start() {
    if (this.started) return;
    this.started = true;
    const w = makeWorker();
    if (!w) return;
    w.onmessage = (e) => this._done(e.data);
    w.onerror = (e) => {
      // A worker that cannot run (blocked script, CSP): finish everything
      // queued on the main thread instead of failing the run.
      e.preventDefault?.();
      this.worker = null;
      const stuck = [...this.jobs.values()];
      this.jobs.clear();
      this.inFlight = 0;
      for (const job of stuck) this.queue.unshift(job);
      this._pump();
    };
    this.worker = w;
  }

  /** Whether decoding runs in a worker (false: in-process fallback). */
  get threaded() {
    this._start();
    return !!this.worker;
  }

  /** Jobs queued or running, for progress reporting. */
  get pending() {
    return this.queue.length + this.inFlight;
  }

  /** Run one request; the returned promise rejects with the worker's error message. */
  request(msg, transfer = []) {
    this._start();
    return new Promise((resolve, reject) => {
      this.queue.push({ id: this.nextId++, msg, transfer, resolve, reject });
      this._notify();
      this._pump();
    });
  }

  _notify() {
    if (this.onPending) this.onPending(this.pending);
  }

  _pump() {
    while (this.inFlight < MAX_IN_FLIGHT && this.queue.length) {
      const job = this.queue.shift();
      this.inFlight++;
      if (this.worker) {
        this.jobs.set(job.id, job);
        this.worker.postMessage({ id: job.id, ...job.msg }, job.transfer);
      } else {
        handle(job.msg).then(({ reply }) => this._finish(job, reply));
      }
    }
  }

  _done(data) {
    const job = this.jobs.get(data.id);
    if (!job) return;
    this.jobs.delete(data.id);
    this._finish(job, data);
  }

  _finish(job, reply) {
    this.inFlight--;
    if (reply.ok) job.resolve(reply);
    else job.reject(new Error(`simscope: ${reply.error}`));
    this._notify();
    this._pump();
  }
}

/** The page's decoder. */
export const decoder = new Decoder();

/**
 * Decode raw SSBB blocks (copies the caller may not reuse) to `[n, K]` f32 arrays.
 *
 * @param {Uint8Array[]} blocks  whole blocks, header included, each owning its buffer.
 * @param {number} itemK  floats per env per frame.
 * @param {boolean} pose  renormalize q16d quaternions.
 * @returns {Promise<Float32Array[]>}
 */
export async function decodeBlocks(blocks, itemK, pose) {
  const buffers = blocks.map((b) => (b.byteOffset === 0 && b.byteLength === b.buffer.byteLength ? b.buffer : b.slice().buffer));
  const reply = await decoder.request({ op: "blocks", blocks: buffers, itemK, pose }, buffers);
  return reply.arrays.map((buf) => new Float32Array(buf));
}

/**
 * Decode every block of one window (one block per env, in env order) into a
 * dense `[n, E, K]` array.
 *
 * @returns {Promise<{data: Float32Array, n: number}>}
 */
export async function decodeWindow(blocks, itemK, pose) {
  const buffers = blocks.map((b) => (b.byteOffset === 0 && b.byteLength === b.buffer.byteLength ? b.buffer : b.slice().buffer));
  const reply = await decoder.request({ op: "window", blocks: buffers, itemK, pose }, buffers);
  return { data: new Float32Array(reply.data), n: reply.n };
}

/** Decode a mesh blob to `{verts, faces, normals, uvs, nVerts, nFaces}`. */
export async function decodeMeshBlob(bytes) {
  // The caller keeps using `bytes` (PackSource hands out views into the pack), so send a copy.
  const copy = bytes.slice().buffer;
  const reply = await decoder.request({ op: "mesh", bytes: copy }, [copy]);
  return reply.mesh;
}
