// The viewport's colours: a neutral grey ground and background, the contact kind's
// violet for contact points and arrows, neutral greys for every other
// overlay and for collision geoms. They are written in oklch, as the app's
// tokens are, and converted to sRGB here; three.js takes sRGB and converts to
// its linear working space itself (`Color.setRGB(r, g, b, SRGBColorSpace)`,
// colour management of r152+).

import { Color, SRGBColorSpace } from "three";

/** oklch (L 0..1, chroma, hue in degrees) to gamma-encoded sRGB `[r, g, b]` in 0..1, clipped. */
export function oklchToSrgb(l, c, h) {
  const a = c * Math.cos((h * Math.PI) / 180), b = c * Math.sin((h * Math.PI) / 180);
  // oklab -> LMS (cube roots) -> linear sRGB (Bjorn Ottosson's matrices).
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_, -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_, -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_];
  return lin.map((v) => {
    const x = Math.min(Math.max(v, 0), 1);
    return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
  });
}

/** A three.js Color (linear working space) from oklch. */
export function oklch(l, c = 0, h = 0) {
  const [r, g, b] = oklchToSrgb(l, c, h);
  return new Color().setRGB(r, g, b, SRGBColorSpace);
}

/** `#rrggbb` of an oklch colour, for CSS that cannot take oklch (the element's own styles). */
export function oklchHex(l, c = 0, h = 0) {
  return "#" + oklchToSrgb(l, c, h).map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("");
}

/** [L, C, H] triples. `fg` is the foreground token, for collision geoms drawn at 35%. */
export const PALETTE = {
  light: {
    viewport: [0.97, 0, 0],
    checker: [[0.955, 0, 0], [0.93, 0, 0]],
    grid: { base: [0.955, 0, 0], line: [0.86, 0, 0] },
    contact: [0.54, 0.2, 295],
    arrow: [0.35, 0, 0],
    fg: [0.145, 0, 0],
  },
  dark: {
    viewport: [0.15, 0, 0],
    checker: [[0.2, 0, 0], [0.175, 0, 0]],
    grid: { base: [0.2, 0, 0], line: [0.29, 0, 0] },
    contact: [0.56, 0.2, 295],
    arrow: [0.8, 0, 0],
    fg: [0.985, 0, 0],
  },
};

/** The palette of a theme name (anything but "dark" is light). */
export const paletteOf = (theme) => (theme === "dark" ? PALETTE.dark : PALETTE.light);

/** A three.js Color from one of the palette's triples. */
export const colorOf = (lch) => oklch(lch[0], lch[1], lch[2]);
