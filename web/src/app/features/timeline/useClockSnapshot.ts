import { useEffect, useState } from "react";

import { getClock, onFrame } from "@/lib/runtime";

export interface ClockSnapshot {
  playing: boolean;
  speed: number;
  loop: boolean;
  region: boolean;
  duration: number;
}

/**
 * Low-rate clock facts for buttons (play icon, speed, loop). The time itself
 * is never read here: it would re-render 60 times a second. The frame
 * subscriber only calls setState when one of these actually changes.
 */
export function useClockSnapshot(): ClockSnapshot {
  const read = (): ClockSnapshot => {
    const c = getClock();
    return {
      playing: c.playing,
      speed: c.speed,
      loop: c.loop,
      region: !!c.loopRegion,
      duration: Math.round(c.duration * 1000) / 1000,
    };
  };
  const [snap, setSnap] = useState(read);
  useEffect(() => {
    return onFrame(() => {
      const next = read();
      setSnap((prev) =>
        prev.playing === next.playing &&
        prev.speed === next.speed &&
        prev.loop === next.loop &&
        prev.region === next.region &&
        prev.duration === next.duration
          ? prev
          : next,
      );
    });
  }, []);
  return snap;
}
