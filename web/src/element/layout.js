// Arrangement of a compare page (contracts §10.1): panes side by side, stacked,
// or in a 2 x 2 grid. Pure geometry; master.js turns it into CSS.

export const ARRANGEMENTS = ["side", "stack", "grid"];

/** The arrangement to use: the requested one, else `side` for two runs and `grid` for more. */
export function arrangementOf(arrange, n) {
  if (ARRANGEMENTS.includes(arrange)) return arrange;
  return n <= 2 ? "side" : "grid";
}

/**
 * Columns and rows of `n` panes. A grid has two columns (one cell stays
 * empty for three runs); fewer than three panes in a grid sit side by side.
 */
export function gridShape(n, arrange) {
  const count = Math.max(n, 1);
  const a = arrangementOf(arrange, count);
  if (a === "stack") return { cols: 1, rows: count };
  if (a === "side" || count <= 2) return { cols: count, rows: 1 };
  return { cols: 2, rows: Math.ceil(count / 2) };
}

/**
 * Pane rectangles in a `width` x `height` box, with `gap` px hairlines
 * between them. Every pane of an arrangement has the same size.
 *
 * @returns {Array<{x: number, y: number, w: number, h: number}>}
 */
export function cellRects(n, arrange, width, height, gap = 1) {
  const { cols, rows } = gridShape(n, arrange);
  const w = (width - gap * (cols - 1)) / cols;
  const h = (height - gap * (rows - 1)) / rows;
  return Array.from({ length: n }, (_, i) => ({ x: (i % cols) * (w + gap), y: Math.floor(i / cols) * (h + gap), w, h }));
}
