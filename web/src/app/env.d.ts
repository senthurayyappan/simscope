// Ambient types for deep imports the packages do not type.
declare module "lucide-react/dist/esm/icons/*.mjs" {
  export const __iconData: { name: string; size: number; node: [string, Record<string, string | number>][] };
  const icon: unknown;
  export default icon;
}
declare module "*.css";
declare module "gifenc" {
  export type Palette = number[][];
  export interface GifEncoder {
    writeFrame(index: Uint8Array, width: number, height: number, opts?: { palette?: Palette; delay?: number; repeat?: number }): void;
    finish(): void;
    bytes(): Uint8Array<ArrayBuffer>;
  }
  export function GIFEncoder(opts?: { initialCapacity?: number; auto?: boolean }): GifEncoder;
  export function quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number, opts?: { format?: "rgb565" | "rgb444" | "rgba4444" }): Palette;
  export function applyPalette(rgba: Uint8Array | Uint8ClampedArray, palette: Palette, format?: "rgb565" | "rgb444" | "rgba4444"): Uint8Array;
}
