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

function set(next: View) {
  if (next.t0 === view.t0 && next.t1 === view.t1) return;
  view = next;
  for (const fn of listeners) fn();
}

export function subscribeTimelineView(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
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
