// Layout of the scrub bar's highlight markers (no DOM, so Node can test it).
//
// Highlights come from the `simscope-highlights/2` document (contracts §8.2;
// the core upgrades a `/1` document to the same shape, a raw signal peak
// becoming a moment named after its signal). A moment is a tick, a span
// (`t1` set: a jump) a thin bar. Ticks closer than `minGap` pixels are
// drawn as one, the strongest, so a busy run does not become a comb; spans
// are all drawn, since each covers a stretch of time.

/** Tooltip text: the label, then the detail, then when (separate lines, no joined strings). */
export function tooltip(h, extra = 0) {
  const when = Number.isFinite(h.t1) && h.t1 > h.t ? `${h.t.toFixed(2)} s to ${h.t1.toFixed(2)} s` : `${h.t.toFixed(2)} s`;
  const lines = [h.label || h.kind || "Highlight"];
  if (h.detail) lines.push(h.detail);
  lines.push(when);
  if (extra > 0) lines.push(`and ${extra} more nearby`);
  return lines.join("\n");
}

/**
 * Place markers on a bar.
 *
 * @param {Array<object>} highlights  entries of one env, sorted by `t`.
 * @param {number} duration  seconds the bar covers.
 * @param {number} widthPx  bar width in pixels.
 * @param {number} [minGap]  least distance between two ticks, in pixels.
 * @returns {{spans: Array<{left: number, width: number, t: number, title: string}>,
 *   ticks: Array<{left: number, t: number, title: string}>}}  `left` and
 *   `width` in percent of the bar.
 */
export function layoutMarks(highlights, duration, widthPx, minGap = 6) {
  const spans = [], ticks = [];
  if (!(duration > 0)) return { spans, ticks };
  const pct = (t) => Math.min(100, Math.max(0, (t / duration) * 100));
  const gap = (minGap / Math.max(widthPx, 1)) * duration;
  let cluster = null;
  const flush = () => {
    if (cluster) ticks.push({ left: pct(cluster.best.t), t: cluster.best.t, title: tooltip(cluster.best, cluster.n - 1) });
    cluster = null;
  };
  for (const h of highlights) {
    if (!Number.isFinite(h.t)) continue;
    if (Number.isFinite(h.t1) && h.t1 > h.t) {
      spans.push({ left: pct(h.t), width: pct(h.t1) - pct(h.t), t: h.t, title: tooltip(h) });
      continue;
    }
    if (cluster && h.t - cluster.first < gap) {
      cluster.n++;
      if ((h.score ?? 0) > (cluster.best.score ?? 0)) cluster.best = h;
    } else {
      flush();
      cluster = { best: h, first: h.t, n: 1 };
    }
  }
  flush();
  return { spans, ticks };
}
