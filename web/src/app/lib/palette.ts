// The categorical palette of the UI guidelines, by name. Slots 1-4 are runs A-D
// (and, in a single run, the selected env and up to three pinned envs); slots
// 5-8 are highlight kinds. Canvas code resolves the CSS variables at draw time
// so light and dark share one source (app.css).

export const SLOT_LETTERS = ["A", "B", "C", "D"] as const;
export const MAX_SLOTS = 4;

/** CSS colour for series slot `i` (0-3): usable in `style` and in SVG. */
export function seriesVar(i: number): string {
  return `var(--series-${(i % MAX_SLOTS) + 1})`;
}

const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** A developer-supplied kind colour if it is a plain hex colour, else null (anything else could smuggle CSS). */
export function validColor(color: string | null | undefined): string | null {
  return typeof color === "string" && HEX.test(color.trim()) ? color.trim() : null;
}

/** The two built-in kinds have palette slots; custom kinds bring a colour or stay neutral (C8). */
export function kindVar(kind: string, custom?: string | null): string {
  if (kind === "contact") return "var(--kind-contact)";
  if (kind === "acceleration") return "var(--kind-acceleration)";
  return validColor(custom) ?? "var(--muted-foreground)";
}

/** Reads a CSS variable from the root, for canvas and the player. */
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

let probe: CanvasRenderingContext2D | null = null;

/** `rgba(...)` of any CSS colour at `alpha`, for canvas fills (oklch cannot take an alpha suffix). */
export function withAlpha(css: string, alpha: number): string {
  probe ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  if (!probe) return css;
  probe.canvas.width = probe.canvas.height = 1;
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = css;
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
  return `rgba(${r},${g},${b},${alpha})`;
}
