// Small helpers shared by the components. shadcn normally pulls clsx,
// tailwind-merge and class-variance-authority for this; none of them is a
// pinned dependency, and the components below never pass conflicting
// utilities, so a plain join and a tiny variant table are enough.

export type ClassValue = string | false | null | undefined | ClassValue[];

/** Joins class names, dropping falsy entries. */
export function cn(...values: ClassValue[]): string {
  const out: string[] = [];
  for (const v of values) {
    if (!v) continue;
    out.push(Array.isArray(v) ? cn(...v) : v);
  }
  return out.join(" ");
}

/**
 * Builds a variant function: `variants("base", {size: {sm: "h-7"}})` returns
 * `(props) => className`. Missing props fall back to `defaults`.
 */
export function variants<V extends Record<string, Record<string, string>>>(
  base: string,
  table: V,
  defaults: { [K in keyof V]?: keyof V[K] },
) {
  return (props: { [K in keyof V]?: keyof V[K] | null } = {}, extra?: ClassValue): string => {
    const parts: string[] = [base];
    for (const key of Object.keys(table) as (keyof V)[]) {
      const picked = (props[key] ?? defaults[key]) as string | undefined;
      if (picked !== undefined) parts.push(table[key][picked] ?? "");
    }
    return cn(parts, extra);
  };
}

/** Clamps `x` to `[lo, hi]`. */
export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

/** localStorage read that never throws (private windows, blocked storage). */
export function readStore(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** localStorage write that never throws. */
export function writeStore(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the preference is simply not remembered */
  }
}
