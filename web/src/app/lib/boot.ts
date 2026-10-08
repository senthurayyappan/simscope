import type { Boot } from "./api";

/**
 * A full export of one run: the library would list a single row and group
 * nothing, so the page leaves it out and shows the brand on the inspector.
 */
export function isSoloExport(boot: Pick<Boot, "mode" | "runs">): boolean {
  return boot.mode === "pack" && (boot.runs?.length ?? 0) === 1;
}
