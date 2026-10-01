// The app's shared frame loop keeps running when one subscriber throws.
import assert from "node:assert/strict";
import test from "node:test";

test("a throwing frame subscriber does not stop the others", async () => {
  const frames = [];
  globalThis.requestAnimationFrame = (fn) => frames.push(fn);
  const { onFrame } = await import("../src/app/lib/frame.ts");
  const errors = [];
  const orig = console.error;
  console.error = (...a) => errors.push(a);
  let good = 0;
  let bad = 0;
  onFrame(() => {
    bad++;
    throw new Error("boom");
  });
  onFrame(() => good++);
  try {
    for (let i = 0; i < 3; i++) frames.shift()(i * 16);
  } finally {
    console.error = orig;
  }
  assert.equal(good, 3, "the healthy subscriber ran every frame");
  assert.equal(bad, 3);
  assert.equal(errors.length, 1, "reported once, not every frame");
  assert.equal(frames.length, 1, "the loop is still scheduled");
});
