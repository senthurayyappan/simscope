import assert from "node:assert/strict";
import test from "node:test";

import { arrangementOf, cellRects, gridShape } from "../src/element/layout.js";

const W = 1440, H = 856;
const near = (a, b) => Math.abs(a - b) < 1e-9;

test("the default arrangement: side for one or two runs, a grid for more; unknown values fall back", () => {
  assert.equal(arrangementOf(undefined, 2), "side");
  assert.equal(arrangementOf(null, 3), "grid");
  assert.equal(arrangementOf("", 4), "grid");
  assert.equal(arrangementOf("stack", 2), "stack");
  assert.equal(arrangementOf("diagonal", 2), "side");
});

test("shapes: side is a row, stack a column, a grid has two columns", () => {
  assert.deepEqual(gridShape(2, "side"), { cols: 2, rows: 1 });
  assert.deepEqual(gridShape(4, "side"), { cols: 4, rows: 1 });
  assert.deepEqual(gridShape(3, "stack"), { cols: 1, rows: 3 });
  assert.deepEqual(gridShape(3, "grid"), { cols: 2, rows: 2 });
  assert.deepEqual(gridShape(4, "grid"), { cols: 2, rows: 2 });
  assert.deepEqual(gridShape(2, "grid"), { cols: 2, rows: 1 }, "two runs in a grid sit side by side");
  assert.deepEqual(gridShape(1, "grid"), { cols: 1, rows: 1 });
});

test("pane rectangles tile the page with 1 px hairlines between them", () => {
  for (const n of [2, 3, 4]) {
    for (const arrange of ["side", "stack", "grid"]) {
      const rects = cellRects(n, arrange, W, H);
      assert.equal(rects.length, n);
      const { cols, rows } = gridShape(n, arrange);
      for (const r of rects) {
        assert.ok(near(r.w, rects[0].w) && near(r.h, rects[0].h), `${n} ${arrange}: equal panes (the cameras need equal pixel heights)`);
        assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= W + 1e-9 && r.y + r.h <= H + 1e-9, `${n} ${arrange}: inside the page`);
      }
      assert.ok(near(rects[0].w * cols + (cols - 1), W), `${n} ${arrange}: columns fill the width`);
      assert.ok(near(rects[0].h * rows + (rows - 1), H), `${n} ${arrange}: rows fill the height`);
      // Neighbours are exactly one pixel apart.
      for (let i = 1; i < n; i++) {
        const a = rects[i - 1], b = rects[i];
        if (b.y === a.y) assert.ok(near(b.x - (a.x + a.w), 1));
        else assert.ok(near(b.y - (a.y + a.h), 1));
      }
    }
  }
});

test("exact rectangles: two side by side, two stacked, three in a grid leave the last cell empty", () => {
  const side = cellRects(2, "side", 1001, 600);
  assert.deepEqual(side, [{ x: 0, y: 0, w: 500, h: 600 }, { x: 501, y: 0, w: 500, h: 600 }]);
  const stack = cellRects(2, "stack", 800, 601);
  assert.deepEqual(stack, [{ x: 0, y: 0, w: 800, h: 300 }, { x: 0, y: 301, w: 800, h: 300 }]);
  const grid = cellRects(3, "grid", 1001, 601);
  assert.deepEqual(grid, [{ x: 0, y: 0, w: 500, h: 300 }, { x: 501, y: 0, w: 500, h: 300 }, { x: 0, y: 301, w: 500, h: 300 }]);
});

test("a stack of four is tall and thin, a row of four narrow: the arrangements the user picks", () => {
  const stack = cellRects(4, "stack", 1000, 800);
  assert.ok(stack[0].w / stack[0].h > 4);
  const row = cellRects(4, "side", 1000, 800);
  assert.ok(row[0].h / row[0].w > 3);
});
