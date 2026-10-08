// Pictures of the viewport: a PNG at a chosen scale, or a short GIF of a
// stretch of the run. The player draws the frames (core/player.js); this file
// only chooses the stretch, encodes, and hands the bytes to the browser.

import { applyPalette, GIFEncoder, quantize } from "./gif.ts";

import type { PlayerLike } from "./core";

/** The longest GIF, in seconds. A longer run needs a loop region on the timeline. */
export const GIF_MAX_SECONDS = 5;
/** Frame rates whose delay is a whole number of centiseconds, the unit a GIF counts in. */
export const GIF_FPS = [10, 20, 25] as const;
export const GIF_WIDTHS = [480, 720, 960] as const;
export const SHOT_SCALES = [1, 2, 4] as const;

const MIN_SECONDS = 0.1;
const EPS = 1e-6;

export interface GifWindow {
  t0: number;
  t1: number;
  /** Why this stretch cannot be a GIF, or null when it can. */
  problem: string | null;
}

/**
 * The stretch a GIF would show: the loop region when there is one, else the
 * whole run. It must be at most `GIF_MAX_SECONDS` long.
 */
export function gifWindow(duration: number, region: readonly [number, number] | null): GifWindow {
  const [t0, t1] = region ?? [0, duration];
  const length = t1 - t0;
  let problem: string | null = null;
  if (!(duration > 0)) problem = "Open a run first";
  else if (length < MIN_SECONDS - EPS) problem = "Select a longer stretch on the timeline";
  else if (length > GIF_MAX_SECONDS + EPS) {
    problem = region
      ? `The selected stretch is ${length.toFixed(1)} s. Shorten it to ${GIF_MAX_SECONDS} s or less`
      : `The run is ${length.toFixed(1)} s. Drag on the timeline ruler to select up to ${GIF_MAX_SECONDS} s`;
  }
  return { t0, t1, problem };
}

/** Frames in a GIF of `seconds` at `fps`; the same count the player draws. */
export function gifFrames(seconds: number, fps: number): number {
  return Math.max(1, Math.round(seconds * fps));
}

/** A file name with no characters a file system dislikes. */
export function fileName(run: string, suffix: string, ext: string): string {
  const base = run.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 64) || "simscope";
  return `${base}${suffix ? `-${suffix}` : ""}.${ext}`;
}

/** Offer `blob` to the user as a download. */
export function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const seconds = (t: number) => `${t.toFixed(2).replace(/\.?0+$/, "")}s`;

/** Save the viewport as a PNG, `scale` times the pixels on screen. */
export async function saveScreenshot(player: PlayerLike, run: string, scale: number): Promise<void> {
  const blob = await player.snapshot("image/png", { scale });
  download(blob, fileName(run, `${seconds(player.clock.time)}${scale > 1 ? `-${scale}x` : ""}`, "png"));
}

export interface GifOptions {
  t0: number;
  t1: number;
  fps: number;
  width: number;
  signal?: AbortSignal;
  onProgress?(done: number, total: number): void;
}

/** Draw and encode a GIF of `t0..t1`. It loops, and its last frame leads into its first. */
export async function encodeGif(player: PlayerLike, { t0, t1, fps, width, signal, onProgress }: GifOptions): Promise<Blob> {
  const gif = GIFEncoder();
  const delay = Math.round(1000 / fps);
  for await (const f of player.captureFrames({ t0, t1, fps, width, signal })) {
    const palette = quantize(f.data, 256);
    gif.writeFrame(applyPalette(f.data, palette), f.width, f.height, { palette, delay });
    onProgress?.(f.index + 1, f.count);
    // Let the page paint and answer a click on Cancel between frames.
    await new Promise((done) => setTimeout(done, 0));
  }
  gif.finish();
  return new Blob([gif.bytes()], { type: "image/gif" });
}

export async function saveGif(player: PlayerLike, run: string, opts: GifOptions): Promise<void> {
  const blob = await encodeGif(player, opts);
  download(blob, fileName(run, `${seconds(opts.t0)}-${seconds(opts.t1)}`, "gif"));
}
