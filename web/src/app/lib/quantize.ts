// A palette for a GIF, made once from every frame.
//
// A GIF has 256 colours. A palette made per frame, or by a coarse quantizer,
// merges the near-identical darks of a dark scene: the ground fades into the
// background through a few levels of grey, and each frame would pick other
// ones. The frames then flicker and the ground disappears. So the palette
// comes from all frames, keeps the most common colours exactly (backgrounds,
// the ground, flat parts), and shares the rest out by median cut.

type Rgb = number; // 0xRRGGBB

/** How often each colour occurs in `rgba`, looking at every `stride`-th pixel; adds to `hist`. */
export function sampleColors(rgba: ArrayLike<number>, hist: Map<Rgb, number>, stride = 5): void {
  for (let i = 0; i + 2 < rgba.length; i += 4 * stride) {
    const key = (rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2];
    hist.set(key, (hist.get(key) ?? 0) + 1);
  }
}

interface Box {
  colors: [Rgb, number][];
  count: number;
}

const channel = (c: Rgb, k: 0 | 1 | 2) => (c >> (16 - 8 * k)) & 255;

function average(box: Box): Rgb {
  let r = 0, g = 0, b = 0;
  for (const [c, n] of box.colors) {
    r += channel(c, 0) * n;
    g += channel(c, 1) * n;
    b += channel(c, 2) * n;
  }
  const n = box.count || 1;
  return (Math.round(r / n) << 16) | (Math.round(g / n) << 8) | Math.round(b / n);
}

/** Split `box` in two at the median, by pixel count, of its widest channel. */
function split(box: Box): [Box, Box] {
  let best: 0 | 1 | 2 = 0, widest = -1;
  for (const k of [0, 1, 2] as const) {
    let lo = 255, hi = 0;
    for (const [c] of box.colors) {
      const v = channel(c, k);
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    if (hi - lo > widest) {
      widest = hi - lo;
      best = k;
    }
  }
  const sorted = [...box.colors].sort((a, b) => channel(a[0], best) - channel(b[0], best) || a[0] - b[0]);
  let seen = 0;
  let at = 0;
  while (at < sorted.length - 1 && seen + sorted[at][1] < box.count / 2) seen += sorted[at++][1];
  const cut = Math.min(Math.max(at + 1, 1), sorted.length - 1);
  const make = (colors: [Rgb, number][]): Box => ({ colors, count: colors.reduce((s, [, n]) => s + n, 0) });
  return [make(sorted.slice(0, cut)), make(sorted.slice(cut))];
}

/**
 * At most `size` colours for the sampled `hist`, as `[r, g, b]`. The `exact`
 * most common colours are kept as they are; the others are grouped by median
 * cut. The length is padded to a power of two, as a GIF colour table needs.
 */
export function buildPalette(hist: Map<Rgb, number>, size = 256, exact = 64): number[][] {
  const sorted = [...hist.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  const keep = sorted.slice(0, Math.min(exact, size));
  const rest = sorted.slice(keep.length);
  const colors: Rgb[] = keep.map(([c]) => c);
  const room = size - colors.length;
  if (rest.length <= room) colors.push(...rest.map(([c]) => c));
  else {
    const boxes: Box[] = [{ colors: rest, count: rest.reduce((s, [, n]) => s + n, 0) }];
    while (boxes.length < room) {
      let at = -1;
      for (let i = 0; i < boxes.length; i++) if (boxes[i].colors.length > 1 && (at < 0 || boxes[i].count > boxes[at].count)) at = i;
      if (at < 0) break;
      boxes.splice(at, 1, ...split(boxes[at]));
    }
    colors.push(...boxes.map(average));
  }
  let length = 2;
  while (length < colors.length) length *= 2;
  const out = colors.map((c) => [channel(c, 0), channel(c, 1), channel(c, 2)]);
  while (out.length < length) out.push([0, 0, 0]);
  return out;
}

/** The palette index of every pixel of `rgba`, each colour mapped to its nearest entry. `cache` is kept between frames. */
export function indexFrame(rgba: ArrayLike<number>, palette: number[][], cache: Map<Rgb, number>): Uint8Array {
  const out = new Uint8Array(rgba.length / 4);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j++) {
    const key = (rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2];
    let at = cache.get(key);
    if (at === undefined) {
      at = nearest(rgba[i], rgba[i + 1], rgba[i + 2], palette);
      cache.set(key, at);
    }
    out[j] = at;
  }
  return out;
}

function nearest(r: number, g: number, b: number, palette: number[][]): number {
  let at = 0, best = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const p = palette[i];
    // Weighted so that green counts most, as the eye does.
    const d = 2 * (r - p[0]) ** 2 + 4 * (g - p[1]) ** 2 + 3 * (b - p[2]) ** 2;
    if (d < best) {
      best = d;
      at = i;
      if (d === 0) break;
    }
  }
  return at;
}
