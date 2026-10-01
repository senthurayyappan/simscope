// Number and time formatting. Kept pure so node --test can run it.

/** Timeline readout: seconds with 2 decimals, `m:ss.cc` past a minute. */
export function formatTimecode(t: number, decimals = 2): string {
  const sign = t < 0 ? "-" : "";
  const a = Math.abs(t);
  if (a < 60) return `${sign}${a.toFixed(decimals)}`;
  const m = Math.floor(a / 60);
  const s = a - m * 60;
  return `${sign}${m}:${s.toFixed(decimals).padStart(decimals + 3, "0")}`;
}

/** Parses typed time: `2.14`, `2.14s`, `1:05.2`, `107f`, `f107`. Returns seconds or null. */
export function parseTime(text: string, dt: number): number | null {
  const s = text.trim().toLowerCase();
  if (!s) return null;
  let m = /^(?:f\s*(\d+)|(\d+)\s*f)$/.exec(s);
  if (m) return Number(m[1] ?? m[2]) * dt;
  m = /^(\d+):(\d+(?:\.\d*)?)$/.exec(s);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = /^(\d+(?:\.\d*)?|\.\d+)\s*(?:s|sec)?$/.exec(s);
  if (m) return Number(m[1]);
  m = /^(\d+(?:\.\d*)?)\s*ms$/.exec(s);
  if (m) return Number(m[1]) / 1000;
  return null;
}

/** `4,096`. */
export function formatCount(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

/** `50 Hz` for a frame interval. */
export function formatRate(dt: number): string {
  if (!(dt > 0)) return "-";
  const hz = 1 / dt;
  return `${Math.abs(hz - Math.round(hz)) < 0.01 ? Math.round(hz) : hz.toFixed(1)} Hz`;
}

/** `Sep 10, 00:58` in the viewer's timezone (the run's recording time). */
export function formatRecorded(iso: string): string {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "-";
  const date = t.toLocaleDateString("en", { month: "short", day: "numeric", year: t.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
  const time = t.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${date}, ${time}`;
}

/** Three significant digits, U+2212 for negatives, thousands separators (K2, PL9). */
export function formatValue(v: number): string {
  if (!Number.isFinite(v)) return "-";
  const a = Math.abs(v);
  let s: string;
  if (a === 0) s = "0";
  else if (a >= 1000) s = Math.round(a).toLocaleString("en-US");
  else if (a >= 0.001) s = String(+a.toPrecision(3));
  else s = a.toExponential(1);
  return (v < 0 && s !== "0" ? "\u2212" : "") + s;
}

/** Time of the last frame, `(frames - 1) * dt`: the one definition of "duration" (the core's RunInfo.duration). */
export function lastFrameTime(frames: number, dt: number): number {
  return Math.max(0, frames - 1) * dt;
}

/** A duration as the library rows, Metadata and the timeline show it: `4.98 s`, `1:05.50 s`. */
export function formatDuration(seconds: number): string {
  return `${formatTimecode(Number.isFinite(seconds) ? Math.max(0, seconds) : 0)} s`;
}

// ---- highlight readouts (contracts §9.1): `value` is m/s² for acceleration and N for contact force; `ratio` is x the run's typical peak ----

/** Standard gravity, m/s², to express an acceleration in g. */
export const G = 9.80665;

export interface Readout {
  /** The kind's name, for the card's first row. */
  title: string;
  /** The reading: the primary number (or a custom kind's detail), shown large. */
  main: string;
  /** The secondary value, muted, on the right; null when there is none. */
  sub: string | null;
}

interface Hl {
  kind: string;
  label: string;
  detail: string;
  value: number;
  ratio: number | null;
}

/** A ratio to two significant digits: 1.9, 4.2, 12. */
export function formatRatio(r: number): string {
  return r >= 10 ? String(Math.round(r)) : r.toFixed(1);
}

/** The fields of a highlight hover card (contracts §11.2). */
export function readout(h: Hl): Readout {
  if (h.kind === "acceleration" && Number.isFinite(h.value)) {
    return { title: h.label, main: `${formatValue(h.value)} m/s²`, sub: `${formatValue(h.value / G)} g` };
  }
  if (h.kind === "contact" && Number.isFinite(h.value)) {
    return {
      title: h.label,
      main: `${formatValue(h.value)} N`,
      sub: h.ratio !== null && h.ratio !== undefined && Number.isFinite(h.ratio) ? `${formatRatio(h.ratio)}× typical` : null,
    };
  }
  // Custom kinds say what they want to say in `detail`.
  return { title: h.label, main: h.detail || h.label, sub: null };
}
