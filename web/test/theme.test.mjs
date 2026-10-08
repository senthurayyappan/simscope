import assert from "node:assert/strict";
import test from "node:test";
import { Color, SRGBColorSpace } from "three";

import { colorOf, oklch, oklchHex, oklchToSrgb, PALETTE, paletteOf } from "../src/core/theme.js";

test("oklch to sRGB: the tokens of the UI guidelines come out as their hex values", () => {
  assert.equal(oklchHex(1), "#ffffff");
  assert.equal(oklchHex(0), "#000000");
  assert.equal(oklchHex(0.145), "#0a0a0a", "shadcn foreground");
  assert.equal(oklchHex(0.97), "#f5f5f5", "light viewport");
  assert.equal(oklchHex(0.985), "#fafafa");
  assert.equal(oklchHex(0.54, 0.2, 295), "#7b4bd4", "contact kind, light");
  assert.equal(oklchHex(0.56, 0.2, 295), "#8151db", "contact kind, dark");
  assert.equal(oklchHex(0.62, 0.2, 257), "#2282fb", "run A");
});

test("zero chroma is grey, out-of-gamut colours are clipped into 0..1", () => {
  for (const l of [0.18, 0.205, 0.24, 0.9, 0.94, 0.97]) {
    const [r, g, b] = oklchToSrgb(l, 0, 0);
    assert.ok(Math.abs(r - g) < 1e-3 && Math.abs(g - b) < 1e-3, `L ${l}`);
  }
  for (const v of oklchToSrgb(0.7, 0.4, 150)) assert.ok(v >= 0 && v <= 1);
});

test("a three.js colour is the linear value of the sRGB one (colour management)", () => {
  const c = oklch(0.97, 0, 0);
  const expect = new Color().setRGB(245 / 255, 245 / 255, 245 / 255, SRGBColorSpace);
  assert.ok(Math.abs(c.r - expect.r) < 2e-3, `${c.r} vs ${expect.r}`);
  assert.ok(c.r < 0.95 && c.r > 0.85, "stored linear, not as the sRGB number");
});

test("the viewport and ground are neutral in both themes, the checker is a step off the viewport", () => {
  for (const theme of ["light", "dark"]) {
    const pal = paletteOf(theme);
    for (const lch of [pal.viewport, ...pal.checker, pal.grid.base, pal.grid.line, pal.arrow, pal.fg]) assert.equal(lch[1], 0, `${theme} chroma`);
    assert.ok(pal.checker[0][0] !== pal.checker[1][0]);
  }
  assert.deepEqual(PALETTE.light.checker, [[0.955, 0, 0], [0.93, 0, 0]]);
  assert.deepEqual(PALETTE.dark.checker, [[0.2, 0, 0], [0.175, 0, 0]]);
  assert.deepEqual(PALETTE.dark.viewport, [0.15, 0, 0]);
  assert.equal(paletteOf("anything"), PALETTE.light);
});

test("contacts are the contact kind's violet in both themes; other overlays are grey and flip with the theme", async () => {
  const { createArrowLayer, createPolylineLayer } = await import("../src/core/overlays.js");
  const contacts = createArrowLayer(1, 1, 1, 1, { points: true });
  const arrows = createArrowLayer(1, 1, 1, 1);
  const lines = createPolylineLayer(1, 3);
  const col = (layer) => layer.root.children[0].material.color;
  for (const theme of ["light", "dark"]) {
    for (const l of [contacts, arrows, lines]) l.setTheme(theme);
    assert.ok(col(contacts).equals(colorOf(paletteOf(theme).contact)), `${theme} contacts`);
    assert.ok(Math.abs(col(arrows).r - col(arrows).b) < 1e-6, `${theme} arrows are grey`);
    assert.ok(col(arrows).equals(colorOf(paletteOf(theme).arrow)));
    assert.ok(col(lines).equals(colorOf(paletteOf(theme).arrow)));
  }
  assert.ok(col(arrows).r > 0.4, "light grey in the dark theme");
  contacts.setTheme("light");
  arrows.setTheme("light");
  assert.ok(col(arrows).r < 0.2, "dark grey in the light theme");
});

test("collision geoms are the foreground colour at 35%, per theme", async () => {
  const { buildScene } = await import("../src/core/scene.js");
  const { sceneOf } = await import("./fixtures.mjs");
  const part = await buildScene(sceneOf(1), { mesh: async () => null, release() {}, texture: async () => null }, 1);
  const collision = part.root.children.find((m) => m.material.transparent);
  assert.equal(collision.material.opacity, 0.35);
  part.setTheme("dark");
  assert.ok(collision.material.color.equals(colorOf(PALETTE.dark.fg)));
  part.setTheme("light");
  assert.ok(collision.material.color.equals(colorOf(PALETTE.light.fg)));
  part.dispose();
});

test("the ground and the viewport follow the theme through the Player, with the same setTheme(theme, background)", async () => {
  const { Player, nullRenderer, PackSource, makeWalkerPack } = await import("./headless.mjs");
  const p = new Player(null, { renderer: nullRenderer, theme: "dark" });
  await p.load(new PackSource(makeWalkerPack()), "walker");
  const u = p.ground.mesh.material.uniforms;
  assert.ok(p.scene.background.equals(colorOf(PALETTE.dark.viewport)));
  assert.ok(u.uA.value.equals(colorOf(PALETTE.dark.checker[0])) && u.uB.value.equals(colorOf(PALETTE.dark.checker[1])));
  p.setTheme("light");
  assert.ok(p.scene.background.equals(colorOf(PALETTE.light.viewport)));
  assert.ok(u.uA.value.equals(colorOf(PALETTE.light.checker[0])));
  p.setGround("grid");
  assert.ok(u.uA.value.equals(colorOf(PALETTE.light.grid.base)) && u.uLine.value.equals(colorOf(PALETTE.light.grid.line)));
  p.setTheme("dark", "transparent");
  assert.equal(p.scene.background, null, "an explicit background still wins");
  p.setColor("#e4572e");
  assert.equal(p.info().color, "#e4572e", "the slot colour the app uses for the pane dot");
});
