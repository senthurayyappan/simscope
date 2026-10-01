// CSS colour strings -> three.js colours. three's Color.setStyle knows hex,
// rgb(), hsl() and names, not oklch() or color-mix(), which design tokens
// (the app's viewport background) may use. The browser knows all of them:
// paint the string into one pixel and read it back as sRGB.

import { Color, SRGBColorSpace } from "three";

let pixel = null;
const SENTINEL = "#010203";

/** A Color (linear working space) for any CSS colour string; null if the browser rejects it. */
export function cssColor(css) {
  const out = new Color();
  if (typeof document !== "undefined") {
    try {
      pixel ??= document.createElement("canvas");
      pixel.width = pixel.height = 1;
      const ctx = pixel.getContext("2d", { willReadFrequently: true });
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = SENTINEL;
      ctx.fillStyle = css; // an invalid string leaves the sentinel in place
      if (ctx.fillStyle === SENTINEL && String(css).trim().toLowerCase() !== SENTINEL) return null;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      return out.setRGB(r / 255, g / 255, b / 255, SRGBColorSpace);
    } catch {
      // fall through to three's own parser
    }
  }
  try {
    return out.setStyle(css, SRGBColorSpace);
  } catch {
    return null;
  }
}
