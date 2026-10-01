import assert from "node:assert/strict";
import test from "node:test";

import { distributeGaps, itemSizes } from "../src/app/lib/distribute.ts";

const sum = (a) => a.reduce((x, y) => x + y, 0);

test("distributeGaps: no leftover keeps the minimum gap", () => {
  assert.deepEqual(distributeGaps([100, 100, 100], 100 + 100 + 100 + 28, 14), [14, 14]);
});

test("distributeGaps: one block has no gaps", () => {
  assert.deepEqual(distributeGaps([100], 900, 14), []);
  assert.deepEqual(distributeGaps([], 900, 14), []);
});

test("distributeGaps: the leftover is shared evenly between sections", () => {
  // 3 blocks of 100, 2 min gaps of 14 = 328; 400 available leaves 72, 36 per gap.
  assert.deepEqual(distributeGaps([100, 100, 100], 400, 14), [50, 50]);
});

test("distributeGaps: rounding adds up to exactly the leftover", () => {
  for (const [n, extra] of [[2, 7], [4, 10], [8, 13], [8, 5], [3, 1], [9, 1000]]) {
    const heights = new Array(n).fill(90);
    const avail = sum(heights) + 14 * (n - 1) + extra;
    const gaps = distributeGaps(heights, avail, 14);
    assert.equal(gaps.length, n - 1);
    assert.equal(sum(gaps), 14 * (n - 1) + extra, `n=${n} extra=${extra}`);
    assert.ok(Math.max(...gaps) - Math.min(...gaps) <= 1, "gaps differ by at most one pixel");
    assert.ok(gaps.every((g) => Number.isInteger(g) && g >= 14));
  }
});

test("distributeGaps: content taller than the room scrolls with minimum gaps", () => {
  assert.deepEqual(distributeGaps([500, 500, 500], 300, 14), [14, 14]);
  assert.deepEqual(distributeGaps([500, 500], 1014, 14), [14]);
  assert.deepEqual(distributeGaps([500, 500], 1013, 14), [14]);
});

test("distributeGaps: a fractional room is floored, never overfilled", () => {
  const gaps = distributeGaps([100, 100], 300.9, 14);
  assert.deepEqual(gaps, [100]);
});

test("itemSizes: the gap is added to each block's first item, the first block stays put", () => {
  // header+2 rows | header+3 rows | header
  const heights = [32, 34, 34, 32, 34, 34, 34, 32];
  const starts = [true, false, false, true, false, false, false, true];
  const none = itemSizes(heights, starts, 0, 14);
  assert.deepEqual(none, [32, 34, 34, 46, 34, 34, 34, 46]);
  const content = sum(heights) + 28;
  const roomy = itemSizes(heights, starts, content + 40, 14);
  assert.equal(roomy[0], 32);
  assert.equal(sum(roomy), content + 40);
  assert.equal(roomy[3], 32 + 14 + 20);
  assert.equal(roomy[7], 32 + 14 + 20);
});

test("itemSizes: a single section is unchanged however much room there is", () => {
  const heights = [32, 34, 34];
  assert.deepEqual(itemSizes(heights, [true, false, false], 2000, 14), heights);
});
