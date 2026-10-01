// Pure math for the timeline strip: adaptive ticks, zoom and pan, and
// clustering of highlight glyphs. No DOM, so node --test covers it.

import type { Highlight } from "./types";

/** The visible span, in seconds. */
export interface View {
  t0: number;
  t1: number;
}

export interface Tick {
  t: number;
  major: boolean;
}

const STEPS = [
  0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600,
];

/** Smallest "nice" step whose on-screen spacing is at least `minPx`. */
export function niceStep(span: number, widthPx: number, minPx = 84): number {
  const secPerPx = span / Math.max(1, widthPx);
  const want = secPerPx * minPx;
  for (const s of STEPS) if (s >= want) return s;
  return STEPS[STEPS.length - 1];
}

/** Ticks over a view: majors every step, minors at fifths. */
export function ticks(view: View, widthPx: number, minPx = 84): Tick[] {
  const span = view.t1 - view.t0;
  if (!(span > 0) || widthPx < 10) return [];
  const step = niceStep(span, widthPx, minPx);
  const sub = step / 5;
  const out: Tick[] = [];
  const first = Math.floor(view.t0 / sub) * sub;
  const count = Math.ceil((view.t1 - first) / sub);
  for (let i = 0; i <= count && i < 4000; i++) {
    const t = Number((first + i * sub).toFixed(6));
    const k = Math.round(t / step);
    out.push({ t, major: Math.abs(t - k * step) < sub * 0.01 });
  }
  return out;
}

/** Decimals needed to write multiples of `step` exactly. */
export function stepDecimals(step: number): number {
  if (step >= 1) return 0;
  return Math.min(3, Math.max(1, Math.ceil(-Math.log10(step) - 1e-9)));
}

/** Label for a ruler tick: `2.5`, `1:05`, `1:05.5`. */
export function tickLabel(t: number, step: number): string {
  const d = stepDecimals(step);
  if (t < 60) return t.toFixed(d);
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(d).padStart(d ? d + 3 : 2, "0")}`;
}

/** Keeps `view` inside `[0, duration]` without changing its span unless it is wider. */
export function clampView(view: View, duration: number, minSpan: number): View {
  let span = Math.max(minSpan, view.t1 - view.t0);
  if (span >= duration) return { t0: 0, t1: Math.max(duration, minSpan) };
  let t0 = view.t0;
  if (t0 < 0) t0 = 0;
  if (t0 + span > duration) t0 = duration - span;
  span = Math.min(span, duration);
  return { t0, t1: t0 + span };
}

/** Zoom by `factor` (>1 zooms out) keeping the time under `anchor` fixed. */
export function zoomView(view: View, anchor: number, factor: number, duration: number, minSpan: number): View {
  const a = Math.min(Math.max(anchor, view.t0), view.t1);
  const f = (a - view.t0) / (view.t1 - view.t0 || 1);
  const span = (view.t1 - view.t0) * factor;
  const t0 = a - f * span;
  return clampView({ t0, t1: t0 + span }, duration, minSpan);
}

/** Pan by a fraction of the visible span. */
export function panView(view: View, fraction: number, duration: number, minSpan: number): View {
  const d = (view.t1 - view.t0) * fraction;
  return clampView({ t0: view.t0 + d, t1: view.t1 + d }, duration, minSpan);
}

/** Puts `t` on screen: if it left the view, scrolls one page so it sits at 10%. */
export function followPlayhead(view: View, t: number, duration: number, minSpan: number): View {
  const span = view.t1 - view.t0;
  if (t >= view.t0 && t <= view.t1) return view;
  if (span >= duration) return view;
  return clampView({ t0: t - span * 0.1, t1: t - span * 0.1 + span }, duration, minSpan);
}

/** Importance when a cluster shows one dot: fall, landing, contact spike, torque spike (TL6). */
const RANK: Record<string, number> = { fall: 4, landing: 3, contact_spike: 2, torque_spike: 1 };
export function kindRank(kind: string): number {
  return RANK[kind] ?? 0;
}

const stronger = (a: Highlight, b: Highlight) =>
  kindRank(b.kind) > kindRank(a.kind) || (kindRank(b.kind) === kindRank(a.kind) && b.score > a.score) ? b : a;

export interface Cluster {
  /** Pixel x of the glyph (of the best item). */
  x: number;
  items: Highlight[];
  best: Highlight;
}

/**
 * Groups highlights whose glyphs would be closer than `minGapPx`, so dense
 * auto-highlights stay legible. Items must be sorted by time.
 */
export function clusterHighlights(items: readonly Highlight[], view: View, widthPx: number, minGapPx = 6): Cluster[] {
  const span = view.t1 - view.t0;
  if (!(span > 0)) return [];
  const pxPerSec = widthPx / span;
  const out: Cluster[] = [];
  let cur: Highlight[] = [];
  let lastX = -Infinity;
  const flush = () => {
    if (cur.length === 0) return;
    const best = cur.reduce(stronger);
    out.push({ x: (best.t - view.t0) * pxPerSec, items: cur, best });
    cur = [];
  };
  for (const h of items) {
    if (h.t < view.t0 - 1 / pxPerSec * 12 || h.t > view.t1 + 1 / pxPerSec * 12) continue;
    const x = (h.t - view.t0) * pxPerSec;
    if (cur.length > 0 && x - lastX < minGapPx) {
      cur.push(h);
    } else {
      flush();
      cur = [h];
    }
    lastX = x;
  }
  flush();
  return out;
}

/** Snaps a time to the nearest frame. */
export function snapFrame(t: number, dt: number): number {
  return dt > 0 ? Math.round(t / dt) * dt : t;
}
