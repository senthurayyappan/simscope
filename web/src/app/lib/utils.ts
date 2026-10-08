import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export type { ClassValue };

/** Joins class names and resolves conflicting Tailwind utilities, so a later class wins (shadcn's `cn`). */
export function cn(...values: ClassValue[]): string {
  return twMerge(clsx(values));
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
