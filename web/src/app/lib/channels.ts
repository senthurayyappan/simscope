// The fixed channel list of the Plots tab: derived height and speed of the
// followed body, plus every scalar stream and every component of every
// vector stream the run recorded. No plot builder (viewer v3 §16).

import type { StreamInfo } from "./types";

export interface Channel {
  id: string;
  label: string;
  unit: string;
  group: string;
  /** Derived from body_pose: the followed body's height or speed. */
  body?: "height" | "speed";
  stream?: string;
  component?: number;
}

export const MAX_VECTOR_COMPONENTS = 64;

/** Builds the channel list from the manifest's streams. */
export function buildChannels(streams: Record<string, StreamInfo>): Channel[] {
  const out: Channel[] = [
    { id: "body:height", label: "Height", unit: "m", group: "Followed body", body: "height" },
    { id: "body:speed", label: "Speed", unit: "m/s", group: "Followed body", body: "speed" },
  ];
  for (const [name, s] of Object.entries(streams)) {
    if (s.kind === "scalar") {
      out.push({ id: `s:${name}`, label: name, unit: s.units ?? "", group: name, stream: name, component: 0 });
    } else if (s.kind === "vector") {
      const k = Math.min(s.item_shape[0] ?? 0, MAX_VECTOR_COMPONENTS);
      for (let i = 0; i < k; i++) {
        out.push({
          id: `v:${name}:${i}`,
          label: s.labels?.[i] ?? `${name}[${i}]`,
          unit: s.units ?? "",
          group: name,
          stream: name,
          component: i,
        });
      }
    }
  }
  return out;
}

/** What to show first: height, speed, and up to two recorded channels. */
export function defaultChannelIds(channels: readonly Channel[]): string[] {
  const recorded = channels.filter((c) => !c.body).slice(0, 2);
  return ["body:height", "body:speed", ...recorded.map((c) => c.id)];
}
