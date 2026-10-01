// Canvas drawing for the timeline strip (UI guidelines TL4-TL12). Pure with
// respect to React: it takes a snapshot of everything it shows and returns
// the hit targets it drew.

import { clusterHighlights, tickLabel, ticks, niceStep, type Cluster, type View } from "@/lib/timeline-math";
import type { Highlight, MarkEvent } from "@/lib/types";
import { formatTimecode } from "@/lib/format";

import { kindIcon } from "./icons";

export const GUTTER = 88;
export const RULER_H = 30;
export const LANE_H = 28;
/** Space under the last lane so glyphs never sit on the window edge. */
export const BOTTOM_PAD = 8;
export const RIGHT_PAD = 14;
export const GLYPH = 14;

export interface Palette {
  bg: string;
  fg: string;
  muted: string;
  border: string;
  popover: string;
  secondary: string;
  series: string[];
  kinds: Record<string, string>;
  sans: string;
}

export interface LaneSpec {
  id: string;
  /** Plain label; in compare also the run letter and slot (TL7). */
  label: string;
  slot: number | null;
  letter?: string;
  items: Highlight[];
  labels?: MarkEvent[];
  /** Which pane owns the lane (compare). */
  pane: number;
}

export interface DrawState {
  width: number;
  height: number;
  dpr: number;
  view: View;
  duration: number;
  dt: number;
  time: number;
  loop: [number, number] | null;
  lanes: LaneSpec[];
  hoverT: number | null;
  plotHoverT: number | null;
  hoverHit: Hit | null;
  empty: boolean;
}

export interface Hit {
  lane: string;
  pane: number;
  x: number;
  y: number;
  r: number;
  cluster?: Cluster;
  label?: MarkEvent;
}

export const laneTop = (i: number) => RULER_H + i * LANE_H;

export function readPalette(): Palette {
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string) => cs.getPropertyValue(n).trim();
  return {
    bg: v("--background"),
    fg: v("--foreground"),
    muted: v("--muted-foreground"),
    border: v("--border"),
    popover: v("--popover"),
    secondary: v("--secondary"),
    series: [1, 2, 3, 4].map((i) => v(`--series-${i}`)),
    kinds: {
      landing: v("--kind-landing"),
      contact_spike: v("--kind-contact"),
      torque_spike: v("--kind-torque"),
      fall: v("--kind-fall"),
    },
    sans: v("--font-sans") || "system-ui, sans-serif",
  };
}

const xOf = (t: number, s: Pick<DrawState, "view" | "width">) =>
  GUTTER + ((t - s.view.t0) / (s.view.t1 - s.view.t0)) * (s.width - GUTTER - RIGHT_PAD);

export function timeAt(x: number, s: Pick<DrawState, "view" | "width">): number {
  return s.view.t0 + ((x - GUTTER) / (s.width - GUTTER - RIGHT_PAD)) * (s.view.t1 - s.view.t0);
}

export function laneWidth(width: number): number {
  return width - GUTTER - RIGHT_PAD;
}

/** The colour a glyph is drawn in: the run's slot in compare (TL7), else the kind's. */
function glyphColor(h: Highlight, lane: LaneSpec, pal: Palette): string {
  if (lane.slot !== null) return pal.series[lane.slot % 4];
  return pal.kinds[h.kind] ?? pal.muted;
}

export function drawTimeline(ctx: CanvasRenderingContext2D, s: DrawState, pal: Palette): { hits: Hit[] } {
  const { width: W, height: H, dpr } = s;
  const hits: Hit[] = [];
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const span = s.view.t1 - s.view.t0;
  const lw = laneWidth(W);
  if (s.empty || !(span > 0) || lw < 20) return { hits };
  const pxPerSec = lw / span;
  const lanesBottom = RULER_H + s.lanes.length * LANE_H;

  // Vertical hairlines at major ticks, through the lanes only.
  const step = niceStep(span, lw);
  const tk = ticks(s.view, lw);
  ctx.lineWidth = 1;
  ctx.strokeStyle = pal.border;
  ctx.beginPath();
  for (const t of tk) {
    if (!t.major) continue;
    const x = Math.round(xOf(t.t, s)) + 0.5;
    if (x < GUTTER || x > W - RIGHT_PAD + 1) continue;
    ctx.moveTo(x, RULER_H);
    ctx.lineTo(x, lanesBottom);
  }
  ctx.stroke();

  // Beyond the end of the run: a flat muted wash, so the data's extent is plain.
  const endX = xOf(s.duration, s);
  if (endX < W - RIGHT_PAD && lanesBottom > RULER_H) {
    ctx.fillStyle = pal.bg;
    ctx.globalAlpha = 0.6;
    ctx.fillRect(endX, RULER_H, W - RIGHT_PAD - endX + 1, lanesBottom - RULER_H);
    ctx.globalAlpha = 1;
  }

  // Loop region: foreground 6% fill, 2 px foreground 40% edges on the ruler (TL12).
  if (s.loop) {
    const x0 = Math.max(GUTTER, xOf(s.loop[0], s));
    const x1 = Math.min(W - RIGHT_PAD, xOf(s.loop[1], s));
    if (x1 > x0) {
      ctx.fillStyle = pal.fg;
      ctx.globalAlpha = 0.06;
      ctx.fillRect(x0, 0, x1 - x0, lanesBottom || RULER_H);
      ctx.globalAlpha = 0.4;
      ctx.fillRect(x0, 0, 2, RULER_H);
      ctx.fillRect(x1 - 2, 0, 2, RULER_H);
      ctx.globalAlpha = 1;
    }
  }

  // Ruler: 11 px Geist ticks.
  ctx.save();
  ctx.beginPath();
  ctx.rect(GUTTER - 1, 0, lw + 2, RULER_H);
  ctx.clip();
  ctx.strokeStyle = pal.muted;
  ctx.fillStyle = pal.muted;
  ctx.font = `11px ${pal.sans}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  for (const t of tk) {
    const x = Math.round(xOf(t.t, s)) + 0.5;
    ctx.globalAlpha = t.major ? 0.9 : 0.35;
    ctx.beginPath();
    ctx.moveTo(x, RULER_H);
    ctx.lineTo(x, RULER_H - (t.major ? 7 : 3));
    ctx.stroke();
    if (t.major) {
      ctx.globalAlpha = 1;
      ctx.fillText(tickLabel(t.t, step), x + 4, RULER_H - 11);
    }
  }
  const pxPerFrame = pxPerSec * s.dt;
  if (pxPerFrame >= 7 && s.dt > 0) {
    ctx.globalAlpha = 0.45;
    const f0 = Math.max(0, Math.floor(s.view.t0 / s.dt));
    const f1 = Math.ceil(s.view.t1 / s.dt);
    ctx.beginPath();
    for (let f = f0; f <= f1 && f - f0 < 2000; f++) {
      const x = Math.round(xOf(f * s.dt, s)) + 0.5;
      ctx.moveTo(x, RULER_H);
      ctx.lineTo(x, RULER_H - 2.5);
    }
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = pal.border;
  ctx.beginPath();
  ctx.moveTo(0, RULER_H + 0.5);
  ctx.lineTo(W, RULER_H + 0.5);
  ctx.stroke();

  // Lanes: hairline rows, 11 px muted sentence-case labels.
  s.lanes.forEach((lane, i) => {
    const y = laneTop(i);
    if (i > 0) {
      ctx.strokeStyle = pal.border;
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(W, y + 0.5);
      ctx.stroke();
    }
    drawLaneLabel(ctx, lane, y, pal);
    ctx.save();
    ctx.beginPath();
    ctx.rect(GUTTER, y, lw, LANE_H);
    ctx.clip();
    drawLane(ctx, s, pal, lane, y, hits);
    ctx.restore();
  });

  // Hairlines: the pointer's, and the one mirrored from a plot's hover.
  for (const [t, a] of [[s.plotHoverT, 0.25], [s.hoverT, 0.2]] as const) {
    if (t === null || t < s.view.t0 || t > s.view.t1) continue;
    const x = Math.round(xOf(t, s)) + 0.5;
    ctx.strokeStyle = pal.fg;
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.moveTo(x, RULER_H);
    ctx.lineTo(x, Math.max(lanesBottom, RULER_H + 1));
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (s.hoverT !== null && s.hoverT >= s.view.t0 && s.hoverT <= s.view.t1) {
    const x = Math.round(xOf(s.hoverT, s)) + 0.5;
    const label = formatTimecode(s.hoverT, pxPerSec > 400 ? 3 : 2);
    ctx.font = `11px ${pal.sans}`;
    const tw = ctx.measureText(label).width + 10;
    const bx = Math.min(Math.max(x - tw / 2, GUTTER), W - RIGHT_PAD - tw);
    ctx.fillStyle = pal.popover;
    ctx.strokeStyle = pal.border;
    ctx.beginPath();
    ctx.roundRect(bx, 3, tw, 16, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = pal.fg;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, bx + tw / 2, 11.5);
  }

  // Playhead (TL4): neutral 1.5 px line, an 8 x 10 handle on the ruler.
  const px = xOf(s.time, s);
  if (px >= GUTTER - 6 && px <= W - RIGHT_PAD + 6) {
    ctx.fillStyle = pal.fg;
    ctx.fillRect(Math.round(px) - 0.75, 6, 1.5, Math.max(lanesBottom, RULER_H) - 6);
    ctx.beginPath();
    ctx.moveTo(px - 4, 2);
    ctx.lineTo(px + 4, 2);
    ctx.lineTo(px + 4, 7);
    ctx.lineTo(px, 12);
    ctx.lineTo(px - 4, 7);
    ctx.closePath();
    ctx.fill();
  }
  return { hits };
}

function drawLaneLabel(ctx: CanvasRenderingContext2D, lane: LaneSpec, y: number, pal: Palette) {
  ctx.font = `11px ${pal.sans}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  let x = 12;
  const cy = y + LANE_H / 2 + 0.5;
  if (lane.slot !== null) {
    ctx.fillStyle = pal.series[lane.slot % 4];
    ctx.beginPath();
    ctx.arc(x + 4, cy, 4, 0, Math.PI * 2);
    ctx.fill();
    x += 14;
    ctx.fillStyle = pal.muted;
    ctx.fillText(lane.letter ?? "", x, cy);
    x += ctx.measureText(lane.letter ?? "").width + 5;
  }
  ctx.fillStyle = pal.muted;
  ctx.fillText(fit(ctx, lane.label, GUTTER - x - 6), x, cy);
}

function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}

/** A glyph: the lucide path in colour on a 2 px surface ring, no disc (TL6). */
function glyph(ctx: CanvasRenderingContext2D, kind: string, cx: number, cy: number, color: string, ring: string, size = GLYPH) {
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(size / 24, size / 24);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const path = kindIcon(kind);
  ctx.strokeStyle = ring;
  ctx.lineWidth = 2 * 2 + 2; // ring: the 2 px stroke plus 2 px of surface on each side, in icon units
  ctx.stroke(path);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke(path);
  ctx.restore();
}

function drawLane(ctx: CanvasRenderingContext2D, s: DrawState, pal: Palette, lane: LaneSpec, y: number, hits: Hit[]) {
  const lw = laneWidth(s.width);
  const cy = y + LANE_H / 2;

  // Jump spans: a neutral bar ending at its landing glyph.
  for (const h of lane.items) {
    if (h.t1 === null || h.t1 === undefined) continue;
    const x0 = xOf(h.t, s);
    const x1 = xOf(h.t1, s);
    if (x1 < GUTTER || x0 > s.width) continue;
    ctx.fillStyle = pal.muted;
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.roundRect(x0, cy - 2, Math.max(2, x1 - x0), 4, 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  const moments = lane.items.filter((h) => h.t1 === null || h.t1 === undefined);
  const spans = lane.items.filter((h) => h.t1 !== null && h.t1 !== undefined);
  const clusters = clusterHighlights(moments, s.view, lw, 14);
  for (const c of clusters) {
    const cx = GUTTER + c.x;
    if (cx < GUTTER - 12 || cx > s.width - RIGHT_PAD + 12) continue;
    const hot = !!s.hoverHit && s.hoverHit.lane === lane.id && s.hoverHit.cluster?.best === c.best;
    if (c.items.length > 1) {
      // A neutral pill with the count and a dot of the most important kind.
      const label = c.items.length > 99 ? "99+" : String(c.items.length);
      ctx.font = `11px ${pal.sans}`;
      const tw = ctx.measureText(label).width;
      const w = tw + 24;
      ctx.fillStyle = hot ? pal.secondary : pal.bg;
      ctx.strokeStyle = pal.border;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(cx - w / 2, cy - 9, w, 18, 9);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = glyphColor(c.best, lane, pal);
      ctx.beginPath();
      ctx.arc(cx - w / 2 + 9, cy, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pal.fg;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(label, cx - w / 2 + 16, cy + 0.5);
      hits.push({ lane: lane.id, pane: lane.pane, x: cx, y: cy, r: Math.max(12, w / 2), cluster: c });
    } else {
      if (hot) {
        ctx.fillStyle = pal.secondary;
        ctx.beginPath();
        ctx.arc(cx, cy, 11, 0, Math.PI * 2);
        ctx.fill();
      }
      glyph(ctx, c.best.kind, cx, cy, glyphColor(c.best, lane, pal), pal.bg);
      hits.push({ lane: lane.id, pane: lane.pane, x: cx, y: cy, r: 12, cluster: c });
    }
  }

  // Span ends: the landing glyph in neutral, clickable like a moment.
  for (const h of spans) {
    const cx = xOf(h.t1 as number, s);
    if (cx < GUTTER - 12 || cx > s.width - RIGHT_PAD + 12) continue;
    glyph(ctx, "landing", cx, cy, pal.muted, pal.bg);
    hits.push({
      lane: lane.id,
      pane: lane.pane,
      x: cx,
      y: cy,
      r: 12,
      cluster: { x: cx - GUTTER, items: [h], best: h },
    });
  }

  // Labels (D26): a tag glyph with the name when there is room.
  for (const m of lane.labels ?? []) {
    const cx = xOf(m.t0, s);
    if (cx < GUTTER - 12 || cx > s.width + 12) continue;
    glyph(ctx, "label", cx, cy, pal.fg, pal.bg);
    ctx.fillStyle = pal.fg;
    ctx.font = `11px ${pal.sans}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const room = s.width - RIGHT_PAD - (cx + 10);
    if (m.label && room > 30) ctx.fillText(fit(ctx, m.label, Math.min(room, 140)), cx + 10, cy + 0.5);
    hits.push({ lane: lane.id, pane: lane.pane, x: cx, y: cy, r: 12, label: m });
  }
}

/** Finds the glyph under a pointer, preferring the nearest centre. */
export function hitAt(hits: readonly Hit[], x: number, y: number): Hit | null {
  let best: Hit | null = null;
  let bestD = Infinity;
  for (const h of hits) {
    const d = Math.hypot(x - h.x, y - h.y);
    if (d <= h.r && d < bestD) {
      best = h;
      bestD = d;
    }
  }
  return best;
}
