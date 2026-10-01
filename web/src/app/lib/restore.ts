// Applies a restored workspace (guideline P7) to the panes as they load:
// the saved camera, env and pinned envs; then, once every pane has loaded,
// the time, play state, loop region and timeline span. Everything is applied
// without animation and before the next frame is drawn, so a reload does not
// show the default view first. A manual change after this wins: each saved
// value is applied exactly once.

import type { PlayerLike } from "./core";
import { paneSettled, savedCamera } from "./plan";
import { getClock } from "./runtime";
import { useApp } from "./store";
import { armTimelineView } from "./timeline-view";

/** Applies the saved camera to a player that has just been created or loaded. */
export function restoreCamera(index: number, run: string, p: PlayerLike): void {
  const cam = savedCamera(index, run);
  if (!cam) return;
  try {
    p.setCameraState?.(cam.state, { animate: false, keep: true });
    // A restored hand-set view is "Free", not a preset.
    if (useApp.getState().camView !== null) useApp.setState({ camView: null });
  } catch {
    /* a state the core cannot apply: keep the automatic view */
  }
}

/** Applies the saved env of a pane once its run has loaded. */
export function restoreEnv(index: number, run: string, p: PlayerLike, envs: number): void {
  const cam = savedCamera(index, run);
  if (cam && cam.env > 0 && cam.env < envs) p.selectEnv?.(cam.env);
}

/**
 * A pane has finished loading (or failed). When it was the last one awaited,
 * applies the time, loop, timeline span and open drafts.
 */
export function settlePane(index: number, run: string): void {
  const p = paneSettled(index, run);
  if (!p) return;
  const clock = getClock();
  try {
    if (p.loop) clock.loopRegion = p.loop;
    clock.seek(p.t);
    if (p.view) armTimelineView(p.view);
    const s = useApp.getState();
    if (p.label && s.api?.writable && !s.labelDraft) {
      useApp.setState({ labelDraft: { t: Math.min(p.label.t, clock.duration), id: p.label.id, text: p.label.text } });
    }
    if (p.playing && clock.duration > 0) clock.play();
  } catch {
    /* restoring is best effort */
  }
}
