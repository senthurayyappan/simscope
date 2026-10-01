// Spreads the library's sections along the sidebar height, like CSS
// `justify-content: space-between`: when the list is shorter than the room it
// has, the leftover goes evenly into the gaps between sections. Pure
// arithmetic on whole pixels, so the virtual list can use it for item sizes.

/**
 * The gap before each block but the first (so `heights.length - 1` gaps).
 * Every gap is at least `minGap`. The leftover room, if any, is shared among
 * the gaps in whole pixels that add up to exactly the leftover (the earlier
 * gaps never get less than the later ones by more than one pixel). With no
 * leftover, or when the content is taller than `available`, every gap is
 * `minGap` and the list scrolls.
 */
export function distributeGaps(heights: number[], available: number, minGap: number): number[] {
  const n = heights.length - 1;
  if (n <= 0) return [];
  const content = heights.reduce((a, b) => a + b, 0) + minGap * n;
  const leftover = Math.floor(available) - content;
  if (!(leftover > 0)) return new Array<number>(n).fill(minGap);
  const gaps: number[] = [];
  for (let i = 0; i < n; i++) {
    // Cumulative rounding: the sum of the first i + 1 shares is floor(leftover * (i + 1) / n).
    gaps.push(minGap + Math.floor((leftover * (i + 1)) / n) - Math.floor((leftover * i) / n));
  }
  return gaps;
}

/**
 * Item sizes for a list made of blocks. `heights[i]` is item i's own height,
 * `starts[i]` is true when it opens a block (a section header). Each block but
 * the first has its gap added to its first item.
 */
export function itemSizes(heights: number[], starts: boolean[], available: number, minGap: number): number[] {
  const blocks: number[] = [];
  heights.forEach((h, i) => {
    if (starts[i] || blocks.length === 0) blocks.push(h);
    else blocks[blocks.length - 1] += h;
  });
  const gaps = distributeGaps(blocks, available, minGap);
  let block = -1;
  return heights.map((h, i) => {
    if (starts[i] || block < 0) block++;
    const opens = starts[i] || i === 0;
    return opens && block > 0 ? h + gaps[block - 1] : h;
  });
}
