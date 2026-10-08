// Everything a button or key can do, in one place. Keyboard and UI both call
// these so they cannot drift.

import type { FollowMode, PlayerLike, ViewName } from "./core";
import { activePlayer, allPlayers, getClock } from "./runtime";
import { useApp } from "./store";
import { fitTimeline, panTimeline, zoomTimeline } from "./timeline-view";
import { clamp } from "./utils";
import type { Action } from "./keys";

const state = () => useApp.getState();

export function frameDt(): number {
  return state().infos[state().active]?.dt ?? 0.02;
}

export function seekTo(t: number): void {
  const clock = getClock();
  clock.seek(clamp(t, 0, clock.duration));
}

export function stepFrames(n: number): void {
  getClock().step(n, frameDt());
}

export function setView(view: ViewName): void {
  for (const p of allPlayers()) p.setView?.(view, { animate: true });
  useApp.setState({ camView: view });
}

export function frame(what: "focus" | "all"): void {
  for (const p of allPlayers()) p.frame?.(what, { animate: true });
}

/** Re-applies display and follow settings to a player (after load and on change). */
export function applyDisplay(p: PlayerLike): void {
  const s = state();
  p.setGround?.(s.groundOn ? s.groundKind : "none");
  p.setGroundColor?.(s.groundColor);
  p.setVisual?.(s.visual);
  p.setContacts?.(s.contacts);
  p.setCollision?.(s.collision);
}

/** Applies a display toggle to every pane and records it. */
export function setDisplay(patch: { groundOn?: boolean; visual?: boolean; collision?: boolean; contacts?: boolean }): void {
  useApp.setState(patch);
  for (const p of allPlayers()) applyDisplay(p);
}

export function applyFollow(p: PlayerLike, mode: FollowMode): void {
  p.setFollow?.({ mode });
}

export function selectEnv(env: number): void {
  const p = activePlayer();
  const info = state().infos[state().active];
  if (!p || !info) return;
  p.selectEnv?.(clamp(env, 0, info.envs - 1));
}

// The Envs tab publishes its current sort here so `[` and `]` follow it.
let envOrder: readonly number[] | null = null;

export function setEnvOrder(order: readonly number[] | null): void {
  envOrder = order;
}

export function stepEnv(delta: number): void {
  const info = state().infos[state().active];
  if (!info || info.envs < 2) return;
  const cur = state().envs[state().active] ?? 0;
  if (envOrder && envOrder.length === info.envs) {
    const at = envOrder.indexOf(cur);
    selectEnv(envOrder[(at + delta + envOrder.length) % envOrder.length]);
  } else selectEnv((cur + delta + info.envs) % info.envs);
}

export function toggleTheme(): void {
  const { resolvedTheme, setTheme } = state();
  setTheme(resolvedTheme === "dark" ? "light" : "dark");
}

/** Runs a keyboard action. Returns true if it did something. */
export function runAction(a: Action): boolean {
  const s = state();
  const clock = getClock();
  const hasRun = s.panes.length > 0;
  switch (a.type) {
    case "toggle-play":
      if (hasRun) clock.toggle();
      return hasRun;
    case "step":
      if (hasRun) stepFrames(a.frames);
      return hasRun;
    case "run":
      s.stepRun(a.delta);
      return true;
    case "next-unrated":
      s.openNextUnrated();
      return true;
    case "rate":
      if (s.api?.writable && hasRun) void s.annotate({ op: "rate", value: a.value });
      return true;
    case "favorite":
      if (s.api?.writable && hasRun) void s.annotate({ op: "favorite", value: !s.annotations?.marks.favorite });
      return true;
    case "env":
      stepEnv(a.delta);
      return true;
    case "follow":
      s.cycleFollow();
      return true;
    case "frame-all":
      frame("all");
      return true;
    case "zoom":
      zoomTimeline(a.factor);
      return true;
    case "pan":
      panTimeline(a.fraction);
      return true;
    case "label":
      if (hasRun && s.api?.writable) useApp.setState({ labelDraft: { t: clock.time } });
      return hasRun;
    case "contacts":
      if (s.infos[s.active]?.hasContacts) setDisplay({ contacts: !s.contacts });
      return true;
    case "theme":
      toggleTheme();
      return true;
    case "escape":
      if (clock.loopRegion) clock.loopRegion = null;
      else if (s.labelDraft) useApp.setState({ labelDraft: null });
      else fitTimeline();
      return true;
  }
}
