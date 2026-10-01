import assert from "node:assert/strict";
import test from "node:test";

import { layoutMarks, tooltip } from "../src/element/marks.js";

const landing = { t: 1.36, t1: null, kind: "landing", label: "Landing", detail: "4.1 g impact, after 0.38 s airborne", score: 9.2 };
const jump = { t: 0.98, t1: 1.36, kind: "jump", label: "Jump", detail: "0.38 s airborne, apex 0.83 m", score: 5 };
const fall = { t: 3.2, t1: null, kind: "fall", label: "Fall", detail: "tipped 94° at 3.20 s", score: 7 };

test("a moment is a tick and a jump is a span, both in percent of the bar", () => {
  const { ticks, spans } = layoutMarks([jump, landing, fall], 4, 400);
  assert.equal(ticks.length, 2);
  assert.equal(spans.length, 1);
  assert.ok(Math.abs(ticks[0].left - 34) < 1e-9 && Math.abs(ticks[1].left - 80) < 1e-9);
  assert.ok(Math.abs(spans[0].left - 24.5) < 1e-9 && Math.abs(spans[0].width - 9.5) < 1e-9);
  assert.equal(spans[0].t, 0.98, "a click seeks to the takeoff");
});

test("tooltips: the label, the detail and the time on separate lines, never dot-joined", () => {
  assert.equal(tooltip(landing), "Landing\n4.1 g impact, after 0.38 s airborne\n1.36 s");
  assert.equal(tooltip(jump), "Jump\n0.38 s airborne, apex 0.83 m\n0.98 s to 1.36 s");
  assert.equal(tooltip({ t: 2, label: "Spike" }), "Spike\n2.00 s");
  assert.equal(tooltip({ t: 2, kind: "fall" }), "fall\n2.00 s", "falls back to the kind");
  assert.match(tooltip(landing, 2), /\nand 2 more nearby$/);
});

test("ticks closer than the gap are drawn once, the strongest, and say how many it stands for", () => {
  // 400 px over 4 s: 6 px is 0.06 s.
  const near = [
    { t: 1.0, label: "A", score: 3 },
    { t: 1.03, label: "B", score: 9 },
    { t: 1.05, label: "C", score: 4 },
    { t: 1.5, label: "D", score: 1 },
  ];
  const { ticks } = layoutMarks(near, 4, 400);
  assert.equal(ticks.length, 2);
  assert.match(ticks[0].title, /^B\n/);
  assert.match(ticks[0].title, /and 2 more nearby/);
  assert.equal(ticks[0].t, 1.03);
  assert.match(ticks[1].title, /^D\n/);
  assert.equal(layoutMarks(near, 4, 40).ticks.length, 1, "a narrow bar merges more");
});

test("spans are never merged, and do not take part in tick clustering", () => {
  const spans = [
    { t: 1.0, t1: 1.01, label: "J1", score: 1 },
    { t: 1.02, t1: 1.03, label: "J2", score: 1 },
  ];
  const { ticks, spans: s } = layoutMarks([...spans, { t: 1.01, label: "M", score: 1 }], 4, 400);
  assert.equal(s.length, 2);
  assert.equal(ticks.length, 1);
});

test("an empty or zero-length run draws nothing; clamps inside the bar", () => {
  assert.deepEqual(layoutMarks([landing], 0, 400), { spans: [], ticks: [] });
  assert.deepEqual(layoutMarks([], 4, 400), { spans: [], ticks: [] });
  const { ticks, spans } = layoutMarks([{ t: 9, label: "late" }, { t: 3.9, t1: 6, label: "long" }], 4, 400);
  assert.equal(ticks[0].left, 100);
  assert.equal(spans[0].left + spans[0].width, 100);
  assert.deepEqual(layoutMarks([{ t: NaN }], 4, 400), { spans: [], ticks: [] });
});
