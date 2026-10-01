// The timeline's visible span. Shared by the canvas (draws it), the keyboard
// (W/S/A/D) and the toolbar (fit), so it lives outside React like the clock.

import { getClock } from "./runtime";
import { useApp } from "./store";
import { clampView, panView, zoomView, type View } from "./timeline-math";

let view: View = { t0: 0, t1: 1 };
const listeners = new Set<() => void>();

export function getTimelineView(): View {
  return view;
}

function minSpan(): number {
  const dt = useApp.getState().infos[useApp.getState().active]?.dt ?? 0.02;
  return Math.max(dt * 6, 0.05);
}

/** True once the span has been fitted or set to something real (the initial 0-1 s is a placeholder). */
let placed = false;

/** Whether the span is worth saving: placed, and no restored span waiting to be applied. */
export function viewSettled(): boolean {
  return placed && armed === null;
}

function set(next: View) {
  if (next.t0 === view.t0 && next.t1 === view.t1) return;
  placed = getClock().duration > 0;
  view = next;
  for (const fn of listeners) fn();
}

export function subscribeTimelineView(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

let armed: View | null = null;

/**
 * A restored span (guideline P7), applied by the timeline's frame loop after
 * its automatic fit of the newly loaded run, so the fit cannot undo it.
 */
export function armTimelineView(v: [number, number]): void {
  armed = { t0: v[0], t1: v[1] };
}

/** Applies the armed span once; true if it did. */
export function applyArmedView(): boolean {
  if (!armed) return false;
  const v = armed;
  armed = null;
  setTimelineView(v);
  return true;
}

export function fitTimeline(): void {
  set({ t0: 0, t1: Math.max(getClock().duration, minSpan()) });
}

export function setTimelineView(next: View): void {
  set(clampView(next, getClock().duration, minSpan()));
}

/** Zoom around the playhead, or around `anchor` when given. */
export function zoomTimeline(factor: number, anchor?: number): void {
  const clock = getClock();
  set(zoomView(view, anchor ?? clock.time, factor, clock.duration, minSpan()));
}

export function panTimeline(fraction: number): void {
  set(panView(view, fraction, getClock().duration, minSpan()));
}

export function timelineMinSpan(): number {
  return minSpan();
}
