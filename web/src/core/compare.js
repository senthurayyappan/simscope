// Compare: several players on one Clock (see `clockFor` and the element's
// `sync` attribute), plus camera sync through the players' "camera" events.
// Time stays in step by construction: one clock, ticked once per frame by
// the shared loop, read by every player. A run shorter than the longest holds
// its last frame at its own end.
//
// Ground alignment (viewer v3.1 D27). Comparing a 1 m wall against a 0.8 m
// wall is only honest if world z = 0 sits on the same screen row in every
// pane. In an orthographic view the row of the point under a followed robot,
// (robot_x, robot_y, 0), depends on three things only: the orbit angles, the
// world height shown (pixels per metre) and the camera target's z, because
// follow puts the target's x and y on the robot. So the group shares those
// three: the orbit and the height are mirrored between panes like before, and
// every following pane holds the target at one shared height instead of its
// own. Robots that start higher or lower then stand higher or lower on the
// same ground.
//
// The shared height and the world height come from the runs, not from frame
// 0 (extent.js): once every pane has decoded the followed body's whole
// series, the group holds the middle of the union of their vertical extents
// and shows all of it, so a robot that jumps or climbs stays in frame in
// every pane. Until then the first player's standing height and the frame-0
// fits hold; the switch happens once, animated, and never while the clock is
// playing.
//
// A pan is shared as a camera-relative offset (metres along the view's right
// and up axes, carried by the camera state), so every pane moves by the same
// screen distance whatever its robot is doing, and the ground stays on the
// same row (the vertical part of the offset is shared too).

/**
 * The group a set of ground-aligned players belongs to. Players ask it for
 * the shared target height every frame, and hand it `setView` and `frame`
 * calls so that one pane's Frame button frames them all alike.
 *
 * @param {Array<import("./player.js").Player>} players  in pane order; the first leads.
 */
function makeGroup(players) {
  const group = {
    players,
    /** The shared target height once the runs' extents are fitted; null before (and after a fallback). */
    zc: null,
    /** An extent arrived while the clock was playing: fit it at the next pause. */
    pending: false,
    /** The runs have been fitted once; later fits wait for a pause. */
    fitted: false,

    /** Players still in the group (a destroyed or unlinked one drops out). */
    members: () => players.filter((p) => p.linked === group),

    loaded: () => group.members().filter((p) => p.info()),

    /** The shared target height: the fitted one, else the first loaded player's standing height, else null. */
    z() {
      if (group.zc !== null) return group.zc;
      for (const p of players) {
        if (p.linked !== group) continue;
        const z = p.standingHeight();
        if (z !== null) return z;
      }
      return null;
    },

    /** Back to the framed view in every pane. */
    clearPan() {
      for (const p of group.members()) p._zeroPan(false);
    },

    setView(view, opts) {
      for (const p of group.members()) p._setView(view, opts);
      // The height that shows the runs depends on the view, unless the user zoomed.
      if (group.zc !== null && !group.zoomed()) group.trajectory(opts.animate !== false);
    },

    /** Some pane's zoom was changed by hand: leave the zoom alone. */
    zoomed: () => group.members().some((p) => p.rig.userZoomed),

    playing: () => group.members().some((p) => p.clock.playing),

    /**
     * Fit the union of the loaded panes' extents: one held height (the middle
     * of the union) and one world height (the most any pane needs). Returns
     * false, changing nothing, if a pane is still decoding its series or none
     * has an extent.
     */
    trajectory(animate) {
      const loaded = group.loaded();
      const exts = loaded.map((p) => p._extent());
      if (!loaded.length || exts.some((e) => e === undefined)) return false;
      const have = exts.filter(Boolean);
      if (!have.length) return false;
      const zc = (Math.min(...have.map((e) => e.zlo)) + Math.max(...have.map((e) => e.zhi))) / 2;
      let height = 0;
      loaded.forEach((p, i) => {
        height = Math.max(height, exts[i] ? p._fitHeight(zc) : p.rig.targetHeight);
      });
      group.zc = zc;
      group.fitted = true;
      for (const p of loaded) p._fitVertical(zc, height, animate);
      return true;
    },

    /** A pane's extent arrived: once they all have, fit them (not while playing, not after a manual zoom). */
    arrived() {
      const loaded = group.loaded();
      if (loaded.some((p) => p._extent() === undefined)) return;
      // The first fit is not deferred, whatever the clock does (the frame-0 views can crop a robot); later ones wait.
      if (group.playing() && group.fitted) group.pending = true;
      else if (!group.zoomed()) group.trajectory(true);
    },

    /** The clock stopped: fit what arrived during playback. */
    flush() {
      if (!group.pending || group.playing()) return;
      group.pending = false;
      if (!group.zoomed()) group.trajectory(true);
    },

    /**
     * Fit every loaded pane and clear the pan. "focus" shows the whole runs
     * once they are known, else the frame-0 fits with the largest height any
     * of them needs; "all" is always the latter.
     */
    frame(what, opts) {
      const animate = opts.animate !== false;
      const loaded = group.loaded();
      const bounds = loaded.map((p) => p._frameTarget(what, animate));
      if (what !== "all" && group.trajectory(animate)) return;
      group.zc = null;
      loaded.forEach((p, i) => p._fitFrame(what, bounds[i], animate));
      const height = Math.max(...loaded.map((p) => p.rig.targetHeight));
      for (const p of loaded) p.rig.setHeight(height, animate);
    },

    /**
     * A run was loaded into a pane: take the leader's orbit, then frame them
     * all again, without animation. Called on "loaded" and when linking.
     */
    refit() {
      const loaded = group.loaded();
      if (!loaded.length) return;
      group.zc = null;
      group.pending = false;
      group.fitted = false;
      const lead = loaded[0].rig.state(false);
      for (const p of loaded) p.rig.setAngles(lead, false);
      group.frame("focus", { animate: false });
    },
  };
  return group;
}

/**
 * Mirror user-driven camera changes between players: when one is dragged,
 * the others take its orbit, zoom and pan (a player that is following keeps
 * following its own env; the pan is an offset from each pane's own robot).
 *
 * With `alignGround` (the default) the players also share the height of
 * their camera targets, so world z = 0 is on the same screen row under every
 * followed robot: every following pane holds one shared height (follow moves
 * only x and y, in "pose" and "heading" mode too), and `setView()` and
 * `frame()` on any player act on all of them. Position follow shows each
 * run's whole motion, not frame 0: the group holds the middle of the union of
 * the runs' vertical ranges (the followed body, the ground and the static
 * geometry beside its path) and fits the most any pane needs. `frame()` and
 * `setView()` clear the pan, and loading a run into a pane frames the group
 * again with the first player's orbit. With `alignGround: false` the players
 * only mirror orbit, zoom and pan.
 *
 * Equal pixels per metre, and so ground alignment and equal pan on screen,
 * need panes of equal height in pixels.
 *
 * @param {Array<import("./player.js").Player>} players
 * @param {{alignGround?: boolean}} [opts]
 * @returns {() => void} call to stop syncing.
 */
export function linkCameras(players, { alignGround = true } = {}) {
  const group = alignGround ? makeGroup(players) : null;
  const offs = players.map((source) => {
    const onCamera = (e) => {
      for (const other of players) if (other !== source) other.setCameraState(e.detail, { animate: false });
    };
    source.addEventListener("camera", onCamera);
    if (!group) return () => source.removeEventListener("camera", onCamera);
    const onLoaded = () => group.refit();
    source.addEventListener("loaded", onLoaded);
    source.linked = group;
    return () => {
      source.removeEventListener("camera", onCamera);
      source.removeEventListener("loaded", onLoaded);
      if (source.linked === group) {
        source.linked = null;
        source._autoFit(); // back to its own run's range
      }
    };
  });
  if (group) group.refit();
  return () => offs.forEach((off) => off());
}
