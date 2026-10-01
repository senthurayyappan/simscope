// The playback clock. One clock may drive many players (compare): the
// players read `time`, the shared rAF loop (loop.js) calls `tick()` once per
// display frame, and UI code subscribes to "time" / "state" events or reads
// `time` from its own rAF callback. The clock never lives in React state.
//
// Time is in seconds. A clock's duration is the longest of its players'
// durations, so in a compare a shorter run simply holds its last frame.

const EPS = 1e-6;
const MAX_WALL_STEP = 0.25; // seconds: a long stall (tab switch) does not jump the playhead
const PERIOD_GAIN = 0.1; // how fast the smoothed frame period follows the display
const CATCH_UP = 0.15; // fraction of the time owed to real time that is played per frame
const MIN_SPEED = 0.01, MAX_SPEED = 32;

/**
 * Frame times, smoothed. The display runs at a steady cadence but rAF
 * timestamps wobble by a millisecond or two, and using the wobble moves a
 * followed robot (and a camera chasing it) by speed x wobble, which reads as
 * judder. `step()` returns the display's smoothed frame period, corrected
 * toward real time: a late frame is made up over a few frames instead of in
 * one jump, and the total never drifts from the wall clock.
 */
export class FrameTimer {
  constructor() {
    this.period = 0; // smoothed seconds between frames
    this.owed = 0; // real time not played yet (late frames), seconds
  }

  /** Forget owed time (the loop was idle, or playback stalled for data). */
  reset() {
    this.owed = 0;
  }

  /** The smoothed step for a frame that took `raw` seconds (0: no previous frame). */
  step(raw) {
    if (!(raw > 0)) return 0;
    raw = Math.min(raw, MAX_WALL_STEP);
    // Follow the display's period with a slow average, ignoring hiccups.
    if (!this.period) this.period = raw;
    else if (raw > 0.4 * this.period && raw < 2.5 * this.period) this.period += PERIOD_GAIN * (raw - this.period);
    const step = Math.min(this.period + CATCH_UP * this.owed, MAX_WALL_STEP);
    this.owed = Math.min(Math.max(this.owed + raw - step, -MAX_WALL_STEP), MAX_WALL_STEP);
    return step;
  }
}

export class Clock extends EventTarget {
  constructor() {
    super();
    this._time = 0;
    this._playing = false;
    this._speed = 1;
    this._loop = false;
    this._region = null;
    this._explicit = 0; // setDuration()
    this._claims = new Map(); // owner -> {seconds, pad}
    this._holds = new Set(); // owners waiting for data
    this._duration = 0;
    this._pad = 0;
    this._last = 0; // rAF time of the previous tick, 0 = none yet
    this._timer = new FrameTimer();
    this._live = false;
  }

  get time() {
    return this._time;
  }

  get duration() {
    return this._duration;
  }

  get playing() {
    return this._playing;
  }

  get speed() {
    return this._speed;
  }

  set speed(x) {
    const v = Number(x);
    if (Number.isFinite(v) && v > 0) this._speed = Math.min(Math.max(v, MIN_SPEED), MAX_SPEED);
    this._emit("state");
  }

  get loop() {
    return this._loop;
  }

  set loop(on) {
    this._loop = !!on;
    this._emit("state");
  }

  get loopRegion() {
    return this._region;
  }

  set loopRegion(region) {
    const ok = Array.isArray(region) && region.length === 2 && region[1] > region[0];
    this._region = ok ? [Math.max(0, region[0]), Math.min(region[1], this._duration || region[1])] : null;
    this._emit("state");
  }

  play() {
    if (this._duration <= 0) return;
    const end = this._region ? this._region[1] : this._duration;
    if (!this._loop && this._time >= end - EPS) this._time = this._region ? this._region[0] : 0;
    this._playing = true;
    this._last = 0;
    this._timer.reset();
    this._emit("state");
    this._emit("time");
  }

  pause() {
    if (!this._playing) return;
    this._playing = false;
    this._emit("state");
  }

  toggle() {
    if (this._playing) this.pause();
    else this.play();
  }

  seek(t) {
    const v = Math.min(Math.max(Number(t) || 0, 0), this._duration);
    this._time = v;
    this._last = 0;
    this._timer.reset();
    this._emit("time");
  }

  /** Move by `frames` frames of `dt` seconds, landing on the frame grid. */
  step(frames, dt) {
    if (!(dt > 0)) return;
    this.seek((Math.round(this._time / dt + EPS) + frames) * dt);
  }

  /** The duration the clock's owner wants; the clock keeps the max with its players'. */
  setDuration(seconds) {
    this._explicit = Math.max(0, Number(seconds) || 0);
    this._recount();
  }

  /**
   * A player claims `seconds` of timeline; `pad` is how long its last frame
   * dwells when looping. A `live` claim (a run still being recorded) makes
   * playback wait at the end for more, instead of ending.
   */
  claim(owner, seconds, pad = 0, live = false) {
    this._claims.set(owner, { seconds: Math.max(0, seconds), pad: Math.max(0, pad), live: !!live });
    this._recount();
  }

  release(owner) {
    this._claims.delete(owner);
    this._holds.delete(owner);
    this._recount();
  }

  /** While any owner holds, a playing clock waits (data not decoded yet). */
  hold(owner, on) {
    if (on) this._holds.add(owner);
    else this._holds.delete(owner);
  }

  /** Forget the previous tick's wall time (the loop was idle). */
  rebase() {
    this._last = 0;
    this._timer.reset();
  }

  /**
   * Advance by the (smoothed, see FrameTimer) wall time since the previous
   * tick. `nowMs` is the rAF timestamp.
   */
  tick(nowMs) {
    const prev = this._last;
    this._last = nowMs;
    if (!this._playing) return;
    // Nothing loaded (a run is being swapped for another): stay in the playing state, so the new run plays on.
    if (this._duration <= 0) {
      this._timer.reset();
      return;
    }
    if (this._holds.size) {
      this._timer.reset(); // stalled for data: the wait is not played back later
      return;
    }
    // Timestamps only go forward; a stray earlier one (two drivers) counts nothing.
    const step = this._timer.step(prev ? Math.max((nowMs - prev) / 1000, 0) : 0);
    if (step === 0) return;
    let t = this._time + step * this._speed;
    const region = this._region;
    if (region && t >= region[1] - EPS) {
      if (this._loop) t = region[0] + ((t - region[0]) % (region[1] - region[0]));
      else return this._finish(region[1]);
    } else if (t > this._duration + (this._loop ? this._pad : 0) - EPS) {
      if (this._loop) t %= this._duration + this._pad;
      else if (this._live) {
        // At the live edge: wait for more frames instead of ending.
        if (this._time < this._duration) {
          this._time = this._duration;
          this._emit("time");
        }
        return;
      } else return this._finish(this._duration);
    }
    this._time = t;
    this._emit("time");
  }

  _finish(t) {
    this._time = t;
    this._playing = false;
    this._emit("time");
    this._emit("state");
    this._emit("ended");
  }

  _recount() {
    let d = this._explicit, pad = 0, live = false;
    for (const c of this._claims.values()) {
      d = Math.max(d, c.seconds);
      pad = Math.max(pad, c.pad);
      live = live || c.live;
    }
    this._pad = pad;
    this._live = live;
    if (d !== this._duration) {
      this._duration = d;
      if (this._time > d) this._time = d;
      if (this._region && this._region[1] > d) this._region = d > this._region[0] ? [this._region[0], d] : null;
    }
    this._emit("state");
  }

  _emit(type) {
    this.dispatchEvent(type === "time" ? new CustomEvent("time", { detail: { t: this._time } }) : new CustomEvent(type));
  }
}

// ---- named clocks (the element's `sync` attribute) ----

const NAMED = new Map();

/** The clock shared by every player that asks for `name`. */
export function clockFor(name) {
  let c = NAMED.get(name);
  if (!c) NAMED.set(name, (c = new Clock()));
  return c;
}
