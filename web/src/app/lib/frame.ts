// The UI's one requestAnimationFrame loop (playhead, readout, plot cursors).
// No imports: it is tested on its own.

type FrameFn = (now: number) => void;
const subscribers = new Set<FrameFn>();
let raf = 0;

/** Cost of the UI's frame subscribers (timeline, readout, plot cursors); enable from the console with `?debug`. */
export const prof = { on: false, ms: 0, frames: 0, max: 0 };

const reported = new WeakSet<FrameFn>();

function reportOnce(fn: FrameFn, e: unknown): void {
  if (reported.has(fn)) return;
  reported.add(fn);
  console.error("frame subscriber failed", e);
}

function loop(now: number) {
  const t0 = prof.on ? performance.now() : 0;
  // One subscriber that throws (a plot caught between two runs, say) must not stop the loop: that would
  // freeze the playhead, the plots and the play button until a reload.
  for (const fn of subscribers) {
    try {
      fn(now);
    } catch (e) {
      reportOnce(fn, e);
    }
  }
  if (prof.on) {
    const d = performance.now() - t0;
    prof.ms += d;
    prof.frames++;
    if (d > prof.max) prof.max = d;
  }
  raf = subscribers.size ? requestAnimationFrame(loop) : 0;
}

/**
 * Runs `fn` every animation frame until the returned function is called.
 * The one loop serves the playhead, readout, plot cursors and reel driver.
 */
export function onFrame(fn: FrameFn): () => void {
  subscribers.add(fn);
  if (!raf) raf = requestAnimationFrame(loop);
  return () => {
    subscribers.delete(fn);
  };
}
