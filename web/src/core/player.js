// Player: one loaded run, drawn into one canvas.
//
// The player owns a scene, an orthographic camera rig, the decoded-window
// cache and the tiers; it does not own a clock (it reads one, possibly shared
// with other players) or a loop (loop.js drives `update()` and the renderer
// draws). Nothing here plays by itself.
//
// Per frame (`update`): read the clock, find the two recorded frames around
// the time, interpolate poses between them (focus tier), step the follow
// camera with critical damping, advance camera-controls, place the ground.
// The camera and the poses come from the same time in the same tick, which is
// what makes follow smooth.

import {
  DirectionalLight,
  HemisphereLight,
  Scene,
  Vector3,
} from "three";

import { BlockStore, makeStream } from "./cache.js";
import { CameraRig, VIEWS } from "./camera.js";
import { Clock } from "./clock.js";
import { cssColor } from "./color.js";
import { colorOf, paletteOf } from "./theme.js";
import { createCrowd } from "./crowd.js";
import { decodeMeshBlob, decoder } from "./decode.js";
import { buildExtent, fitHeight } from "./extent.js";
import { FOLLOW_ALIASES, FOLLOW_SMOOTH_TIME, HOLD_SMOOTH_TIME, makeDamper, makeFollower, rootBody, smoothDamp, snapFollower, stepFollower } from "./follow.js";
import * as fmt from "./format.js";
import { acquireMesh, releaseMesh } from "./geometry_cache.js";
import { createGround } from "./ground.js";
import { frameSpan, lerpPoses, yawOf } from "./interp.js";
import { addPlayer, removePlayer, wake } from "./loop.js";
import { createArrowLayer, createPolylineLayer } from "./overlays.js";
import { pickNearest } from "./picking.js";
import { createDirectRenderer, getSharedRenderer } from "./renderer.js";
import { chooseFocus, DEFAULT_TRIANGLE_BUDGET, focusCapacity, isTiered, MAX_FOCUS } from "./tiers.js";
import * as plots from "./plots.js";
import * as runs from "./run.js";
import { SourceError } from "./source.js";
import { WindowView } from "./window_view.js";
import { buildScene } from "./scene.js";

const FOLLOW_MODES = ["off", "position", "pose", "heading"];
const ROOT_STREAM_ID = 4000;
const WHOLE_RUN_BYTES = 64 * 1024 * 1024;

export { FOLLOW_ALIASES };

const _v = new Vector3();
const _dir = new Vector3();
const _span = { f0: 0, f1: 0, t: 0 };
const _pan = [0, 0];

function fail(message) {
  throw new Error(`simscope: ${message}`);
}

export class Player extends EventTarget {
  /**
   * @param {HTMLCanvasElement} canvas  the player's display canvas (also the
   *   target of pointer input).
   * @param {object} [opts]  see `PlayerOptions` in index.d.ts.
   */
  constructor(canvas, opts = {}) {
    super();
    this.canvas = canvas;
    this.clock = opts.clock || new Clock();
    this.theme = opts.theme === "dark" ? "dark" : "light";
    this.bgExplicit = opts.background !== undefined && opts.background !== null;
    this.cssWidth = 300;
    this.cssHeight = 150;
    this.dpr = 1;
    this.visible = typeof IntersectionObserver !== "function";
    this.dirty = true;
    this.transparent = false;
    this.opts = {
      budget: opts.triangleBudget || DEFAULT_TRIANGLE_BUDGET,
      arrowScale: opts.arrowScale ?? 1,
    };
    this.showVisual = true;
    this.showCollision = false;
    this.contactsOn = false;
    this.color = typeof opts.color === "string" && opts.color ? opts.color : null; // compare slot colour
    this.linked = null; // the ground-aligned camera group this player is in (compare.js)
    // A pan is kept as a camera-relative offset (metres along the view's right
    // and up axes) from the followed point, or from `rest` when not following.
    this.pan = { a: 0, b: 0 };
    this.rest = new Vector3();
    this.holdZ = null; // the height position follow holds once the run's extent is known
    this._fitPending = false;
    this._fitted = false; // the run's extent has been fitted once
    this.r = null; // the loaded run
    this._token = 0;
    this.followPref = opts.follow;
    this.camMoving = false;
    this.poseDirty = true;
    this.viewName = VIEWS.includes(opts.view) ? opts.view : "iso";
    this.groundForced = false;

    this.scene = new Scene();
    // Physically-based units (r155+): intensities are pi times the old ones for the same look.
    this.scene.add(new HemisphereLight(0xffffff, 0x444444, 0.5 * Math.PI));
    const key = new DirectionalLight(0xffffff, 0.8 * Math.PI);
    key.position.set(3, 3, 6);
    this.scene.add(key);
    this.ground = createGround(opts.ground || "checker", this.theme);
    this.scene.add(this.ground.mesh);
    this._groundStyle = opts.ground || "checker";
    this._applyGroundVisibility();
    this._setBackground(this.bgExplicit ? opts.background : undefined);

    this.rig = new CameraRig(canvas);
    this.camera = this.rig.camera;
    this.rig.setView(this.viewName, false);
    for (const type of ["controlstart", "control", "controlend"]) this.rig.controls.addEventListener(type, () => this.invalidate());
    this.rig.controls.addEventListener("control", () => this._onControl());

    this.fstate = {
      mode: "off",
      env: 0,
      body: -1,
      follower: makeFollower(),
      azOff: 0,
      settled: true,
      z0: new Map(),
      z0Default: null,
      hold: makeDamper(), // the held height, moving to a new one over ~250 ms
      holdInit: false,
    };
    this.followPt = { valid: false, x: 0, y: 0, z: 0, yaw: 0 };

    // `opts.renderer` replaces the WebGL renderer (tests and benchmarks run players headless).
    this.renderer = opts.renderer || (opts.direct ? createDirectRenderer(canvas) : getSharedRenderer());
    this.renderer.attach(this);

    this._onClock = () => this.invalidate();
    this._onClockState = () => {
      if (!this.clock.playing) {
        if (this.linked) this.linked.flush();
        else if (this._fitPending) this._autoFit();
      }
      this.invalidate();
    };
    this.clock.addEventListener("time", this._onClock);
    this.clock.addEventListener("state", this._onClockState);
    this._onEnded = () => this.emit("ended", {});
    this.clock.addEventListener("ended", this._onEnded);

    if (typeof IntersectionObserver === "function") {
      this._seen = new IntersectionObserver(
        (entries) => {
          this.visible = entries[entries.length - 1].isIntersecting;
          if (this.visible) this.invalidate();
        },
        { rootMargin: "64px" },
      );
      this._seen.observe(canvas);
    }
    addPlayer(this);
  }

  // ---- loading ----

  /**
   * Load run `run` from `source` (the source's first run when `run` is empty).
   * Resolves with `RunInfo` once the first frame is ready to draw.
   */
  async load(source, run, opts = {}) {
    this.unload();
    this._frozen = false;
    const token = ++this._token;
    try {
      return await this._load(source, run, opts, token);
    } catch (err) {
      if (this._token === token) this.unload();
      throw err;
    }
  }

  async _load(source, runArg, opts, token) {
    const stale = () => this._token !== token;
    const run = await runs.chooseRun(source, runArg);
    const manifest = await runs.readManifest(source, run);
    const nEnvs = manifest.n_envs;
    const tiered = isTiered(nEnvs);
    const streams = await runs.readStreams(source, run, manifest);
    const pose = streams.get(runs.POSE_STREAM);
    if (!pose || pose.kind !== "pose") fail("manifest has no body_pose stream of kind pose");
    if (stale()) fail("load superseded");

    const live = manifest.status === "recording";
    const covered = [...streams.values()].filter((s) => s.kind === "pose" || s.kind === "arrows" || s.kind === "polyline");
    const nFrames = live ? runs.coveredFrames(manifest, covered) : manifest.n_frames;
    if (!(nFrames >= 1)) fail(live ? "the run has no complete window yet" : "manifest needs n_frames >= 1");
    if (!live && pose.nFrames < nFrames) fail(`stream ${pose.name}: ${pose.nFrames} frames, manifest says ${nFrames}`);

    // Scenes: one per unique reference; envs that share one share its objects.
    const refs = manifest.env_scenes || Array.from({ length: nEnvs }, () => manifest.scene);
    if (refs.length !== nEnvs) fail("env_scenes length does not match n_envs");
    const byScene = new Map();
    refs.forEach((ref, env) => {
      if (!ref || !ref.sha256) fail("manifest has no scene reference");
      if (!byScene.has(ref.sha256)) byScene.set(ref.sha256, []);
      byScene.get(ref.sha256).push(env);
    });
    const plan = tiered ? [[[...byScene.keys()][0], null]] : [...byScene.entries()];
    if (tiered && byScene.size > 1) console.warn("simscope: per-env scenes are not supported above 64 envs; drawing every env with the first scene");
    const parts = [];
    try {
      for (const [sha, envs] of plan) {
        const sceneJson = fmt.parseJson(await source.get(fmt.casPath("scenes", sha, ".json")), "scene");
        fmt.checkFormat(sceneJson, "simscope-scene", "scene");
        const part = await buildScene(sceneJson, this._loaders(source, sceneJson), tiered ? MAX_FOCUS : envs.length);
        part.envs = envs;
        parts.push(part);
      }
    } catch (err) {
      for (const p of parts) p.dispose();
      throw err;
    }
    if (stale()) {
      for (const p of parts) p.dispose();
      fail("load superseded");
    }
    const B = parts[0].nBodies;
    const bad = parts.some((p) => p.nBodies !== B) ? "scenes of one run must have the same number of bodies" : pose.itemK !== B * 7 ? `body_pose has ${pose.itemK / 7} bodies but the scene has ${B}` : null;
    if (bad) {
      for (const p of parts) p.dispose();
      fail(bad);
    }

    const store = new BlockStore(source);
    store.onChange = (pending) => {
      this.emit("progress", { pending });
      this.invalidate();
    };
    const origins = new Float32Array(3 * nEnvs);
    (manifest.env_origins || []).slice(0, nEnvs).forEach((o, e) => origins.set(o.slice(0, 3), 3 * e));

    const r = {
      source,
      run,
      manifest,
      live,
      dt: manifest.dt,
      nFrames,
      nEnvs,
      B,
      K: B * 7,
      tiered,
      origins,
      parts,
      streams,
      pose,
      store,
      views: { a: new WindowView(nEnvs), b: new WindowView(nEnvs) },
      overlays: [],
      root: null,
      crowd: null,
      crowdState: tiered ? "pending" : "none",
      proxySize: [0.5, 0.5, 0.5],
      rootPos: new Float32Array(3 * nEnvs),
      rootBuf: null,
      hidden: null,
      allEnvs: null,
      focus: [],
      selected: 0,
      pinned: [],
      capacity: nEnvs,
      envSlot: new Int32Array(nEnvs).fill(-1), // env -> global slot
      gEnv: null, // global slot -> env
      gBase: [], // part -> first global slot
      focusVer: 0,
      derived: new Map(),
      seriesCache: new Map(),
      prefetch: { id: 0, w0: -1, ahead: -1, ver: -1, contacts: -1, root: -1 },
      events: [],
      extents: new Map(), // "env:body" -> the run's extent for framing, or null
      extentJobs: new Map(),
      followBody: this._pickFollowBody(parts[0]),
      hasContacts: streams.has(runs.CONTACTS_STREAM),
    };
    this.r = r;

    // Slots: every env in a slot at small E; the focus set above 64.
    let total = 0;
    for (const p of parts) {
      r.gBase.push(total);
      total += p.nSlots;
    }
    r.gEnv = new Int32Array(total).fill(-1);
    r.capacity = tiered ? focusCapacity(nEnvs, parts[0].trianglesPerEnv, this.opts.budget) : nEnvs;
    const initial = (opts.envs || []).filter((e) => Number.isInteger(e) && e >= 0 && e < nEnvs);
    r.selected = initial.length ? initial[0] : 0;
    r.pinned = initial.slice(1, 5);
    r.allEnvs = Int32Array.from({ length: nEnvs }, (_, i) => i);
    this._assignFocus();
    if (tiered) parts[0].limitSlots(r.capacity);
    for (const p of parts) {
      this.scene.add(p.root);
      p.setRoles(this.showVisual, this.showCollision);
      p.setTheme(this.theme);
    }

    // Overlay streams (arrows, contacts, polylines): focus envs only.
    for (const s of streams.values()) {
      if (s.kind !== "arrows" && s.kind !== "polyline") continue;
      const want = s.kind === "arrows" ? 6 : 3;
      if (s.itemK % want !== 0) fail(`stream ${s.name}: bad item shape for kind ${s.kind}`);
      const scale = typeof s.info.scale === "number" ? s.info.scale : 1; // spec §5
      r.overlays.push({
        name: s.name,
        kind: s.kind,
        stream: s,
        k: s.itemK / want,
        scale,
        contacts: s.name === runs.CONTACTS_STREAM,
        layer: null,
        views: { a: new WindowView(nEnvs), b: new WindowView(nEnvs) },
      });
    }

    // Window 0 of everything drawn, so the first frame can be shown.
    this._claimClock();
    await Promise.all([
      store.request(pose, 0, r.focus),
      ...r.overlays.filter((o) => !o.contacts).map((o) => store.request(o.stream, 0, r.focus)),
    ]);
    if (stale()) fail("load superseded");

    r.events = await runs.readEvents(source, run);
    if (stale()) fail("load superseded");
    this._refreshViews(0, 0);
    if (!r.views.a.arrs[r.selected]) fail("the first window of body_pose is missing");
    this._poseAt(0, 0, 0);
    const b = this._bounds(false);
    const all = this._bounds(true);
    r.proxySize = this._proxySize();
    this._applyGroundVisibility();
    for (const o of r.overlays) {
      const height = Math.max(2 * b.radius, 0.3);
      o.layer =
        o.kind === "arrows"
          ? createArrowLayer(total, o.k, height, this.opts.arrowScale * o.scale, { points: o.contacts })
          : createPolylineLayer(total, o.k);
      o.layer.setTheme(this.theme);
      o.layer.root.visible = o.contacts ? this.contactsOn : true;
      this.scene.add(o.layer.root);
    }

    // Camera: fit the whole scene at small E, the selected env above 64.
    const fit = tiered ? b : all;
    this.rig.setFrame(Math.max((2 * Math.max(fit.radius, 0.3) * 1.15) / Math.min(1, this.rig.aspect), 1.5), this.rig.aspect);
    this.rig.setZoomNow(1);
    this.rig.setTarget(fit.cx, fit.cy, fit.cz, false);
    this.rest.set(fit.cx, fit.cy, fit.cz);
    this.pan.a = this.pan.b = 0;
    this.holdZ = null;
    this._fitPending = false;
    this._fitted = false;
    this.rig.setView(this.viewName, false);
    this.rig.fitBox(fit.ex / 2, fit.ey / 2, fit.ez / 2, false);
    this._setDepth(tiered ? all : fit);
    this.rig.userZoomed = false;

    const fs = this.fstate;
    fs.env = r.selected;
    fs.body = r.followBody;
    fs.z0.set(r.selected, this.followPt.z);
    fs.z0Default = this.followPt.z;
    const mode = this.followPref ?? (nEnvs === 1 ? "position" : "off");
    fs.mode = FOLLOW_MODES.includes(mode) ? mode : "off";
    fs.holdInit = false;
    fs.follower.primed = false;
    this._primeFollow();

    this.poseDirty = true;
    this._applyGroundVisibility();
    this.invalidate();
    const info = this.info();
    this.emit("loaded", info);
    if (tiered) this._buildCrowd(token);
    this._scheduleWhole(token);
    this._requestExtent(r.selected);
    return info;
  }

  /** The loaders the scene builder uses: shared mesh geometries and textures. */
  _loaders(source, sceneJson) {
    const meshes = sceneJson.meshes || [];
    const textures = sceneJson.textures || [];
    const cache = new Map();
    const once = (key, fn) => {
      if (!cache.has(key)) cache.set(key, fn());
      return cache.get(key);
    };
    return {
      mesh: (i) =>
        acquireMesh(meshes[i].sha256, async () => decodeMeshBlob(await source.get(fmt.casPath("assets", meshes[i].sha256)))),
      release: (i) => releaseMesh(meshes[i].sha256),
      texture: (i) =>
        once(`t${i}`, async () => {
          const t = textures[i];
          if (!t || typeof createImageBitmap !== "function") return null;
          const bytes = await source.get(fmt.casPath("assets", t.sha256));
          // Spec §6: UV (0, 0) is the image's bottom-left. WebGL ignores
          // three's flipY for ImageBitmaps, so flip while decoding.
          return createImageBitmap(new Blob([bytes], { type: t.media_type || "image/png" }), { imageOrientation: "flipY" });
        }),
    };
  }

  /** The followed body: the same rule as Python's `highlights.root_body` (see follow.js). */
  _pickFollowBody(part) {
    return rootBody(part.bodyNames || []);
  }

  _claimClock() {
    const r = this.r;
    this.clock.claim(this, Math.max(r.nFrames - 1, 0) * r.dt, r.dt, r.live);
  }

  info() {
    const r = this.r;
    if (!r) return null;
    return {
      run: r.run,
      dt: r.dt,
      frames: r.nFrames,
      duration: Math.max(r.nFrames - 1, 0) * r.dt,
      envs: r.nEnvs,
      bodies: r.parts[0].bodyNames,
      followBody: r.followBody,
      streams: [...r.streams.values()].map((s) => ({ name: s.name, kind: s.kind, shape: s.shape })),
      hasCollision: r.parts.some((p) => p.hasCollision),
      hasContacts: r.hasContacts,
      live: r.live,
      tiered: r.tiered,
      events: r.events,
      hasGround: r.parts.some((p) => p.planes.length > 0),
      color: this.color,
    };
  }

  /**
   * Drop the loaded run and free its GPU resources. With `keepFrame` the
   * canvas keeps showing the last frame (a deck slide that scrolled away)
   * until the next load.
   */
  unload(opts = {}) {
    this._token = (this._token || 0) + 1;
    this._frozen = !!opts.keepFrame && !!this.r;
    const r = this.r;
    if (r) {
      for (const p of r.parts) {
        this.scene.remove(p.root);
        p.dispose();
      }
      for (const o of r.overlays) {
        if (o.layer) {
          this.scene.remove(o.layer.root);
          o.layer.dispose();
        }
      }
      if (r.crowd) {
        this.scene.remove(r.crowd.mesh);
        r.crowd.dispose();
      }
      r.store.onChange = null;
      r.store.clear();
    }
    this.r = null;
    this.clock.release(this);
    this.followPt.valid = false;
    this.fstate.mode = "off";
    this.fstate.follower.primed = false;
    this.fstate.holdInit = false;
    this.fstate.z0.clear();
    this.holdZ = null;
    this._fitPending = false;
    this._fitted = false;
    this.pan.a = this.pan.b = 0;
    this.poseDirty = true;
    this.invalidate();
  }

  /** Unload and release everything, including the canvas's input handlers. */
  destroy() {
    this.unload();
    this.linked = null;
    this.clock.removeEventListener("time", this._onClock);
    this.clock.removeEventListener("state", this._onClockState);
    this.clock.removeEventListener("ended", this._onEnded);
    if (this._seen) this._seen.disconnect();
    removePlayer(this);
    this.rig.dispose();
    this.ground.dispose();
    this.renderer.detach(this);
  }

  // ---- focus set ----

  /** Assign the focus envs to slots, keeping envs that stay in the same slot. */
  _assignFocus() {
    const r = this.r;
    const focus = r.tiered
      ? chooseFocus({ nEnvs: r.nEnvs, selected: r.selected, pinned: r.pinned, origins: r.origins, capacity: r.capacity })
      : r.allEnvs
        ? Array.from(r.allEnvs)
        : Array.from({ length: r.nEnvs }, (_, i) => i);
    r.focus = focus;
    const keep = new Set(focus);
    if (r.tiered) {
      const g = r.gEnv;
      for (let s = 0; s < g.length; s++) {
        if (g[s] >= 0 && !keep.has(g[s])) {
          r.envSlot[g[s]] = -1;
          g[s] = -1;
        }
      }
      let s = 0;
      for (const e of focus) {
        if (r.envSlot[e] >= 0) continue;
        while (s < g.length && g[s] >= 0) s++;
        if (s >= g.length) break;
        g[s] = e;
        r.envSlot[e] = s;
      }
    } else if (r.gEnv.some((e) => e >= 0) === false) {
      // Small runs: slots follow the scene parts' env lists, fixed for the run.
      r.parts.forEach((part, i) => {
        part.envs.forEach((e, s) => {
          r.gEnv[r.gBase[i] + s] = e;
          r.envSlot[e] = r.gBase[i] + s;
        });
      });
    }
    r.focusVer++;
    r.prefetch.w0 = -1; // ask again
  }

  /** Make `env` the selected env (follow target, plots, nearest neighbours in focus). */
  selectEnv(env) {
    const r = this.r;
    if (!r || !Number.isInteger(env) || env < 0 || env >= r.nEnvs || env === r.selected) return;
    r.selected = env;
    this.fstate.env = env;
    this._refocus();
  }

  pinEnvs(envs) {
    const r = this.r;
    if (!r) return;
    r.pinned = (envs || []).filter((e) => Number.isInteger(e) && e >= 0 && e < r.nEnvs && e !== r.selected).slice(0, 4);
    this._refocus();
  }

  _refocus() {
    const r = this.r;
    this._assignFocus();
    this._requestZ0(r.selected);
    this._requestExtent(r.selected);
    this.poseDirty = true;
    this.emit("focus", { env: r.selected, focus: r.focus.slice() });
    this.invalidate();
  }

  focusEnvs() {
    return this.r ? this.r.focus.slice() : [];
  }

  /** Fetch frame 0 of an env to learn its resting height (position follow holds z there). */
  _requestZ0(env) {
    const r = this.r;
    if (!r || this.fstate.z0.has(env)) return;
    r.store
      .request(r.pose, 0, [env])
      .then(() => {
        const a = r.store.get(r.pose, 0, env);
        if (a && this.r === r) this.fstate.z0.set(env, a[r.followBody * 7 + 2] + r.origins[3 * env + 2]);
      })
      .catch(() => {});
  }

  // ---- data: requests, views, readiness ----

  _streamsWanted() {
    const r = this.r;
    const out = [{ stream: r.pose, envs: r.focus }];
    for (const o of r.overlays) if (!o.contacts || this.contactsOn) out.push({ stream: o.stream, envs: r.focus });
    return out;
  }

  _prefetch(w0, ahead) {
    const r = this.r;
    // Numbers, not a string key: this runs every frame and must not allocate.
    const pk = r.prefetch;
    const root = r.root ? 1 : 0, contacts = this.contactsOn ? 1 : 0;
    if (pk.w0 === w0 && pk.ahead === ahead && pk.ver === r.focusVer && pk.contacts === contacts && pk.root === root) return;
    const key = ++pk.id;
    Object.assign(pk, { w0, ahead, ver: r.focusVer, contacts, root });
    const n = r.pose.nWindows, pbf = r.pose.blockFrames;
    const wins = new Set();
    for (let i = 0; i <= ahead; i++) wins.add(Math.min(w0 + i, n - 1));
    if (this.clock.loop && w0 >= n - 1) wins.add(0);
    // Streams may use another block size than body_pose: ask for the windows
    // that cover the same frames.
    const windowsOf = (stream) => {
      const out = new Set();
      for (const w of wins) {
        const lo = Math.floor((w * pbf) / stream.blockFrames);
        const hi = Math.floor(((w + 1) * pbf - 1) / stream.blockFrames);
        for (let x = lo; x <= hi; x++) if (x >= 0 && x < stream.nWindows) out.add(x);
      }
      return out;
    };
    for (const { stream, envs } of this._streamsWanted()) {
      for (const x of windowsOf(stream)) r.store.request(stream, x, envs).catch((err) => this._dataError(err, key));
    }
    if (r.root) {
      // The crowd's roots: every env of a window as one dense array.
      for (const x of windowsOf(r.root.stream)) r.store.requestWindow(r.root.stream, x).catch((err) => this._dataError(err, key));
    }
  }

  _dataError(err, key) {
    const r = this.r;
    if (!r) return;
    // A window the server has not written yet (live run): try again shortly.
    if (err instanceof SourceError && err.status === 404 && r.live) {
      setTimeout(() => {
        if (this.r === r && r.prefetch.id === key) {
          r.prefetch.w0 = -1; // ask again
          this.invalidate();
        }
      }, 1000);
      return;
    }
    this.clock.pause();
    this.emit("error", { error: err, message: err.message });
    this.invalidate();
  }

  /** Refresh the window views for frames f0 and f1. Returns their windows. */
  _refreshViews(f0, f1) {
    const r = this.r;
    const bf = r.pose.blockFrames;
    const w0 = Math.floor(f0 / bf), w1 = Math.floor(f1 / bf);
    r.views.a.refresh(r.store, r.pose, w0, r.focus, r.focusVer);
    r.views.b.refresh(r.store, r.pose, w1, r.focus, r.focusVer);
    if (r.root) {
      const root = r.root, rb = root.stream.blockFrames;
      root.w0 = Math.floor(f0 / rb);
      root.w1 = Math.floor(f1 / rb);
      root.d0 = r.store.getWindow(root.stream, root.w0) || null;
      root.d1 = root.w1 === root.w0 ? root.d0 : r.store.getWindow(root.stream, root.w1) || null;
    }
    return [w0, w1];
  }

  /**
   * Background-load the whole run when it is small enough to decode (<= 64 MB
   * across the streams drawn for the focus envs), so scrubbing is instant.
   * The crowd's root stream is never loaded whole: it is one window at a time.
   */
  async _scheduleWhole(token) {
    const r = this.r;
    const wanted = this._streamsWanted().filter((w) => !r.root || w.stream !== r.root.stream);
    let bytes = 0;
    for (const { stream, envs } of wanted) bytes += 4 * stream.itemK * stream.nFrames * envs.length;
    if (r.live || bytes > WHOLE_RUN_BYTES) return;
    try {
      for (const { stream, envs } of wanted) {
        for (let w = 1; w < stream.nWindows; w++) {
          if (this._token !== token || this.r !== r) return;
          await r.store.request(stream, w, envs);
        }
      }
    } catch {
      // the playback path reports errors
    }
  }

  // ---- crowd tier ----

  async _buildCrowd(token) {
    const r = this.r;
    const path = `derived/${r.run}/root_pose.blk`;
    try {
      const index = await r.source.blockIndex(path);
      if (this._token !== token) return;
      const stream = makeStream(ROOT_STREAM_ID, path, index, true);
      if (stream.itemK !== 7) fail(`${path}: expected one pose per env`);
      await r.store.requestWindow(stream, 0);
      if (this._token !== token) return;
      r.root = { stream, w0: -1, w1: -1, d0: null, d1: null };
      r.rootBuf = new Float32Array(7 * r.nEnvs);
      r.hidden = new Uint8Array(r.nEnvs);
      r.crowd = createCrowd(r.nEnvs, r.proxySize);
      this.scene.add(r.crowd.mesh);
      r.crowdState = "ready";
      r.prefetch.w0 = -1; // ask again
      this.poseDirty = true;
      this.invalidate();
      this.setCrowdColor("return").catch(() => {});
    } catch (err) {
      if (this._token !== token) return;
      r.crowdState = err instanceof SourceError && err.status === 404 ? "unavailable" : "failed";
      console.warn(`simscope: no crowd tier for ${r.run} (${err.message})`);
    }
  }

  /** Colour the crowd proxies by a summaries column (null: one colour). */
  async setCrowdColor(column) {
    const r = this.r;
    if (!r) return;
    r.crowdColumn = column;
    if (!r.crowd) return;
    if (column === null) {
      r.crowd.setColors(null);
      return this.invalidate();
    }
    const doc = await this.summaries();
    if (!doc || this.r !== r || r.crowdColumn !== column) return;
    const col = (doc.columns || []).find((c) => c.key === column);
    const values = doc.values && doc.values[column];
    if (!col || !values) return;
    r.crowd.setColors(values, col.better);
    this.invalidate();
  }

  _proxySize() {
    const b = this._bounds(false);
    return [Math.max(b.ex, 0.15), Math.max(b.ey, 0.15), Math.max(b.ez, 0.15)];
  }

  // ---- per-frame work ----

  needsFrame() {
    if (this.dirty || this.camMoving || !this.fstate.settled) return true;
    const r = this.r;
    if (!r) return false;
    return this.clock.playing || r.store.pending > 0;
  }

  invalidate() {
    this.dirty = true;
    wake();
  }

  /**
   * Advance the player by `dt` seconds of wall time (the loop calls this for
   * every visible player after the clocks ticked). Returns true if the scene
   * changed.
   */
  update(dt) {
    const r = this.r;
    if (this._frozen && !r) {
      this.dirty = false;
      return false;
    }
    let changed = false;
    if (r) {
      changed = this._syncPose();
      changed = this._followStep(dt) || changed;
    }
    const moved = this.rig.update(dt);
    this.camMoving = moved;
    if (moved) changed = true;
    const tgt = this.rig.getTarget(_v);
    this.ground.update(tgt.x, tgt.y, this.rig.height, this.rig.aspect, Math.abs(this.rig.camera.getWorldDirection(_dir).z), this.rig.height / this.cssHeight);
    if (this.rig.userChanged) {
      this.rig.userChanged = false;
      this.emit("camera", this.cameraState());
    }
    return changed;
  }

  /**
   * Bring the drawn poses up to the clock's time: request windows, refresh the
   * views, and re-pose if the time, the data or the focus set changed. A
   * playing clock stalls while the window under the playhead is not decoded.
   * Returns true if the scene changed.
   */
  _syncPose() {
    const r = this.r;
    const span = frameSpan(this.clock.time, r.dt, r.nFrames, _span);
    const w0 = Math.floor(span.f0 / r.pose.blockFrames);
    this._prefetch(w0, this.clock.playing && this.clock.speed > 2 ? 2 : 1);
    this._refreshViews(span.f0, span.f1);
    const haveA = !!r.views.a.arrs[r.selected];
    const haveRoot = !r.root || !!r.root.d0;
    this.clock.hold(this, !(haveA && haveRoot));
    if (!haveA) return false;
    if (span.f0 === r.f0 && span.f1 === r.f1 && span.t === r.t && r.store.epoch === r.epochSeen && !this.poseDirty) return false;
    this._poseAt(span.f0, span.f1, span.t);
    return true;
  }

  /** Place every pose, overlay and proxy for the time between frames f0 and f1. */
  _poseAt(f0, f1, t) {
    const r = this.r;
    const K = r.K, B = r.B, bf = r.pose.blockFrames;
    const va = r.views.a.arrs, vb = r.views.b.arrs;
    const row0 = (f0 - r.views.a.w * bf) * K, row1 = (f1 - r.views.b.w * bf) * K;
    const fb = r.followBody;
    for (let p = 0; p < r.parts.length; p++) {
      const part = r.parts[p], base = r.gBase[p];
      for (let s = 0; s < part.nSlots; s++) {
        const env = r.gEnv[base + s];
        const a0 = env >= 0 ? va[env] : null;
        if (!a0) {
          part.slotOn[s] = 0;
          continue;
        }
        const a1 = vb[env] || a0;
        lerpPoses(part.poses, s * K, a0, row0, vb[env] ? a1 : a0, vb[env] ? row1 : row0, vb[env] ? t : 0, B);
        part.origins[3 * s] = r.origins[3 * env];
        part.origins[3 * s + 1] = r.origins[3 * env + 1];
        part.origins[3 * s + 2] = r.origins[3 * env + 2];
        part.slotOn[s] = 1;
        if (!r.tiered) {
          // Env roots for picking and framing, when there is no crowd buffer.
          const o = s * K + fb * 7;
          r.rootPos[3 * env] = part.poses[o] + r.origins[3 * env];
          r.rootPos[3 * env + 1] = part.poses[o + 1] + r.origins[3 * env + 1];
          r.rootPos[3 * env + 2] = part.poses[o + 2] + r.origins[3 * env + 2];
        }
      }
      part.apply();
    }

    // The followed point: the selected env's follow body, interpolated.
    const g = r.envSlot[r.selected];
    if (g >= 0) {
      let p = 0;
      while (p + 1 < r.parts.length && r.gBase[p + 1] <= g) p++;
      const part = r.parts[p], s = g - r.gBase[p];
      if (part.slotOn[s]) {
        const o = s * K + (this.fstate.body >= 0 ? this.fstate.body : fb) * 7;
        const pt = this.followPt;
        pt.x = part.poses[o] + r.origins[3 * r.selected];
        pt.y = part.poses[o + 1] + r.origins[3 * r.selected + 1];
        pt.z = part.poses[o + 2] + r.origins[3 * r.selected + 2];
        pt.yaw = yawOf(part.poses, o);
        pt.valid = true;
      }
    }

    // Crowd proxies: every env's root, interpolated. The window is one dense
    // [n, E, 7] array, so a frame of every env is contiguous.
    if (r.crowd && r.root.d0) {
      const root = r.root, E = r.nEnvs, rb = root.stream.blockFrames;
      const d0 = root.d0.data, d1 = (root.d1 || root.d0).data;
      const base0 = (f0 - root.w0 * rb) * E * 7;
      const base1 = root.d1 ? (f1 - root.w1 * rb) * E * 7 : base0;
      const tt = root.d1 ? t : 0;
      const buf = r.rootBuf, hidden = r.hidden, slotOn = r.parts[0].slotOn, envSlot = r.envSlot;
      const src1 = root.d1 ? d1 : d0;
      for (let e = 0, o = 0; e < E; e++, o += 7) {
        lerpPoses(buf, o, d0, base0 + o, src1, base1 + o, tt, 1);
        r.rootPos[3 * e] = buf[o] + r.origins[3 * e];
        r.rootPos[3 * e + 1] = buf[o + 1] + r.origins[3 * e + 1];
        r.rootPos[3 * e + 2] = buf[o + 2] + r.origins[3 * e + 2];
        const s = envSlot[e];
        hidden[e] = s >= 0 && slotOn[s] ? 1 : 0;
      }
      r.crowd.update(buf, r.origins, hidden);
    }

    // Overlays: the nearest recorded frame of the focus envs.
    const fo = t >= 0.5 ? f1 : f0;
    for (const o of r.overlays) {
      if (!o.layer || (o.contacts && !this.contactsOn)) continue;
      const bfo = o.stream.blockFrames;
      const wo = Math.floor(fo / bfo);
      o.views.a.refresh(r.store, o.stream, wo, r.focus, r.focusVer);
      const row = (fo - wo * bfo) * o.stream.itemK;
      const arrs = o.views.a.arrs;
      for (let gi = 0; gi < r.gEnv.length; gi++) {
        const env = r.gEnv[gi];
        const a = env >= 0 ? arrs[env] : null;
        if (a) o.layer.update(gi, a, row, r.origins[3 * env], r.origins[3 * env + 1], r.origins[3 * env + 2]);
        else o.layer.clear(gi);
      }
      o.layer.commit();
    }

    r.f0 = f0;
    r.f1 = f1;
    r.t = t;
    r.epochSeen = r.store.epoch;
    this.poseDirty = false;
    this.dirty = true;
  }

  /**
   * World bounds of the drawn bodies of the selected and pinned envs (or of
   * every env root): centre, half extents (`ex`..), and a bounding radius.
   * Each body counts as a sphere of the reach of its geometry.
   */
  _bounds(all) {
    const r = this.r;
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    const add = (x, y, z, rad) => {
      if (!(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z))) return;
      if (x - rad < lo[0]) lo[0] = x - rad;
      if (y - rad < lo[1]) lo[1] = y - rad;
      if (z - rad < lo[2]) lo[2] = z - rad;
      if (x + rad > hi[0]) hi[0] = x + rad;
      if (y + rad > hi[1]) hi[1] = y + rad;
      if (z + rad > hi[2]) hi[2] = z + rad;
    };
    const K = r.K;
    const envsOf = all ? null : new Set([r.selected, ...r.pinned]);
    if (all && r.tiered) {
      // Every env root: live positions once the crowd is up, the static env origins before.
      const src = r.crowd ? r.rootPos : r.origins;
      const half = Math.max(...r.proxySize) / 2;
      for (let e = 0; e < r.nEnvs; e++) add(src[3 * e], src[3 * e + 1], src[3 * e + 2], half);
    } else {
      for (let p = 0; p < r.parts.length; p++) {
        const part = r.parts[p], base = r.gBase[p];
        // The world body is static and may sit anywhere; frame the moving bodies.
        let anyDrawn = false;
        for (let b = 1; b < part.nBodies; b++) if (part.drawnBodies[b]) anyDrawn = true;
        for (let s = 0; s < part.nSlots; s++) {
          const env = r.gEnv[base + s];
          if (env < 0 || !part.slotOn[s]) continue;
          if (envsOf && !envsOf.has(env)) continue;
          for (let b = 0; b < part.nBodies; b++) {
            if (anyDrawn ? b === 0 || !part.drawnBodies[b] : false) continue;
            const o = s * K + b * 7;
            add(part.poses[o] + r.origins[3 * env], part.poses[o + 1] + r.origins[3 * env + 1], part.poses[o + 2] + r.origins[3 * env + 2], part.bodyRadius[b]);
          }
        }
      }
    }
    if (!(lo[0] <= hi[0])) return { cx: 0, cy: 0, cz: 0.6, radius: 1.5, ex: 0.5, ey: 0.5, ez: 1 };
    const ex = hi[0] - lo[0], ey = hi[1] - lo[1], ez = hi[2] - lo[2];
    return {
      cx: (lo[0] + hi[0]) / 2,
      cy: (lo[1] + hi[1]) / 2,
      cz: (lo[2] + hi[2]) / 2,
      radius: Math.hypot(ex, ey, ez) / 2,
      ex,
      ey,
      ez,
    };
  }

  _setDepth(b) {
    const R = Math.max(b.radius, 5);
    const distance = Math.max(60, 4 * R);
    this.rig.setDepth(distance, distance + Math.max(1000, 40 * R));
  }

  // ---- follow ----

  /** Start a follow from where the camera is now, so switching it on sweeps, not jumps. */
  _primeFollow() {
    const fs = this.fstate;
    const t = this.rig.getTarget(_v);
    snapFollower(fs.follower, t.x, t.y, t.z, 0);
    fs.follower.primed = true;
    fs.holdInit = false;
    fs.settled = false;
    if (fs.mode === "heading" && this.followPt.valid) fs.azOff = this.rig.azimuth - this.followPt.yaw;
  }

  setFollow(opts = {}) {
    const r = this.r;
    const fs = this.fstate;
    const before = `${fs.mode}:${fs.env}:${fs.body}`;
    if (opts.body !== undefined && Number.isInteger(opts.body) && r && opts.body >= 0 && opts.body < r.B) {
      fs.body = opts.body;
      this.poseDirty = true;
      this._requestExtent(r.selected);
    }
    if (opts.env !== undefined) this.selectEnv(opts.env);
    if (opts.mode !== undefined && FOLLOW_MODES.includes(opts.mode)) this.followPref = opts.mode;
    if (opts.mode !== undefined && FOLLOW_MODES.includes(opts.mode) && opts.mode !== fs.mode) {
      // Leaving follow, the camera stays where it is; a pan means something else from another base.
      if (opts.mode === "off") this.rest.copy(this.rig.getTarget(_v));
      fs.mode = opts.mode;
      this._clearPan();
      this._primeFollow();
      if (fs.mode === "heading" && this.followPt.valid) fs.azOff = this.rig.azimuth - this.followPt.yaw;
      this._autoFit();
    }
    if (`${fs.mode}:${fs.env}:${fs.body}` !== before) {
      this.emit("follow", this.follow());
      this.invalidate();
    }
  }

  follow() {
    const fs = this.fstate;
    const r = this.r;
    return { mode: fs.mode, env: r ? r.selected : fs.env, body: fs.body >= 0 ? fs.body : r ? r.followBody : 0 };
  }

  /**
   * The height the camera target is held at: in a linked group the group's
   * (one height for every pane, so the ground is on the same screen row
   * under every robot), else, in position follow, the height the run's extent
   * asks for; null where the target follows the body's z.
   */
  _heldZ() {
    if (this.linked) return this.linked.z();
    return this.fstate.mode === "position" ? this.holdZ : null;
  }

  /** Step the damped follow target and apply it to the camera. True if the camera target moved. */
  _followStep(dt) {
    const fs = this.fstate, rig = this.rig, pt = this.followPt;
    if (fs.mode === "off" || !pt.valid) {
      fs.settled = true;
      return false;
    }
    const mode = fs.mode;
    const held = this._heldZ();
    const f = fs.follower;
    let tz, holdBusy = false;
    if (held !== null) {
      // A held height moves to a new one (the run's extent arrived, a linked
      // pane loaded) as a camera preset does, not at the follower's pace.
      const d = fs.hold;
      if (!fs.holdInit) {
        d.x = f.z.x;
        d.v = 0;
        fs.holdInit = true;
      }
      smoothDamp(d, held, HOLD_SMOOTH_TIME, dt);
      tz = d.x;
      holdBusy = Math.abs(d.x - held) > 1e-4 || Math.abs(d.v) > 1e-4;
    } else {
      fs.holdInit = false;
      tz = mode === "position" ? (fs.z0.get(this.r.selected) ?? fs.z0Default ?? pt.z) : pt.z;
    }
    stepFollower(f, pt.x, pt.y, tz, pt.yaw, dt, FOLLOW_SMOOTH_TIME, 2 * rig.height);
    if (held !== null) {
      f.z.x = tz;
      f.z.v = 0;
    }
    if (mode === "heading") {
      // The camera swings with the body's yaw; the user's own orbit is kept as an offset.
      if (rig.rotateBusy) fs.azOff = rig.azimuth - f.yaw.x;
      else rig.setAzimuthNow(f.yaw.x + fs.azOff);
    }
    this._writeFollowTarget();
    const err = Math.hypot(f.x.x - pt.x, f.y.x - pt.y, f.z.x - tz);
    const speed = Math.hypot(f.x.v, f.y.v, f.z.v) + Math.abs(f.yaw.v);
    fs.settled = this.clock.playing ? false : err < 1e-4 && speed < 1e-4 && !holdBusy;
    return true;
  }

  // ---- pan ----
  //
  // A pan moves camera-controls' target along the view's right and up axes.
  // The player turns that into `pan`, an offset in those axes (metres), and
  // writes the target back as base + offset: the base is the follower while
  // following (so the robot keeps its place on screen, even as it moves) and
  // `rest` otherwise. In camera-relative terms the offset means the same
  // thing in every pane of a compare group, whatever its robot is doing and
  // wherever it is, so linked panes share it through the camera state.

  /** The target a pan left behind: fold it into `pan`, put the target back. */
  _onControl() {
    if (!this.rig.dragDelta(_pan)) return;
    this.pan.a += _pan[0];
    this.pan.b += _pan[1];
    if (this.fstate.mode !== "off" && this.followPt.valid && this.fstate.follower.primed) this._writeFollowTarget();
    else this._writeRestTarget(false, false);
  }

  /** target = follower + pan, in the view's current axes. */
  _writeFollowTarget() {
    const f = this.fstate.follower, u = this.rig.basis(false), a = this.pan.a, c = this.pan.b;
    this.rig.setTargetNow(f.x.x + a * u.rx + c * u.ux, f.y.x + a * u.ry + c * u.uy, f.z.x + a * u.rz + c * u.uz);
  }

  /** target = rest + pan (not following); `end` reads the axes of the orbit the camera is heading to. */
  _writeRestTarget(animate, end) {
    const u = this.rig.basis(end), a = this.pan.a, c = this.pan.b, t = this.rest;
    this.rig.setTarget(t.x + a * u.rx + c * u.ux, t.y + a * u.ry + c * u.uy, t.z + a * u.rz + c * u.uz, animate);
  }

  /** Back to the framed view, in this pane only. */
  _zeroPan(animate) {
    this.pan.a = this.pan.b = 0;
    if (this.fstate.mode === "off" && this.r) this.rig.setTarget(this.rest.x, this.rest.y, this.rest.z, animate);
  }

  /** Back to the framed view; in a linked group, in every pane. */
  _clearPan() {
    if (this.linked) this.linked.clearPan();
    else this._zeroPan(false);
  }

  // ---- the run's extent (framing) ----

  _extentKey(env) {
    const fs = this.fstate;
    return `${env}:${fs.body >= 0 ? fs.body : this.r.followBody}`;
  }

  /**
   * The extent (extent.js) of the selected env's followed body over the whole
   * run: `undefined` while its series is being decoded, `null` if there is
   * none (a live run, a failed decode), else the extent.
   *
   * @internal
   */
  _extent() {
    const r = this.r;
    if (!r) return undefined;
    const key = this._extentKey(r.selected);
    return r.extents.has(key) ? r.extents.get(key) : undefined;
  }

  /** Decode the whole series of `env` (the worker does the work) and work out its extent. */
  _requestExtent(env) {
    const r = this.r;
    if (!r) return;
    const key = this._extentKey(env);
    if (r.extentJobs.has(key)) {
      this._extentJob = r.extentJobs.get(key);
      return;
    }
    if (r.live) {
      r.extents.set(key, null); // the future of a recording is not known
      r.extentJobs.set(key, Promise.resolve());
      return;
    }
    const body = this.fstate.body >= 0 ? this.fstate.body : r.followBody;
    const job = plots
      .envArray(r, r.pose, env)
      .then(
        (all) => {
          if (this.r !== r) return;
          const part = r.parts.find((p) => !p.envs || p.envs.includes(env)) || r.parts[0];
          r.extents.set(
            key,
            buildExtent({
              poses: all,
              T: r.pose.nFrames,
              B: r.B,
              follow: body,
              origin: [r.origins[3 * env], r.origins[3 * env + 1], r.origins[3 * env + 2]],
              boxes: part.geomBoxes,
            }),
          );
        },
        () => {
          if (this.r === r) r.extents.set(key, null);
        },
      )
      .then(() => {
        if (this.r === r && env === r.selected) this._extentArrived();
      });
    r.extentJobs.set(key, job);
    this._extentJob = job;
  }

  _extentArrived() {
    if (this.linked) this.linked.arrived();
    else this._autoFit();
  }

  /**
   * The world height that shows the extent with the target held at `zc`, for
   * the orbit the camera is heading to; null without an extent.
   *
   * @internal
   */
  _fitHeight(zc) {
    const ext = this._extent();
    if (!ext) return null;
    const u = this.rig.basis(true);
    return fitHeight(ext, zc, u.ux, u.uy, u.uz, this.rig.aspect);
  }

  /** Hold the target at height `zc` and show `height` metres of world (animated). @internal */
  _fitVertical(zc, height, animate) {
    this.holdZ = zc;
    if (this.linked && this.fstate.mode === "off") {
      this.rest.z = zc;
      this._writeRestTarget(animate, true);
    }
    this.rig.setHeight(height, animate);
    this.fstate.settled = false;
    this.invalidate();
  }

  /** Position follow with the extent known: hold the middle of it, show all of it. */
  _trajectoryFit(animate) {
    if (this.linked || this.fstate.mode !== "position") return false;
    const ext = this._extent();
    if (!ext) return false;
    const zc = (ext.zlo + ext.zhi) / 2;
    this._fitVertical(zc, this._fitHeight(zc), animate);
    this._fitted = true;
    return true;
  }

  /**
   * The extent arrived (or position follow was switched on): fit it. The
   * first fit of a run happens at once, even if the clock is already playing
   * (the frame-0 view would otherwise stay: it can crop the robot), as one
   * short animation. Later ones (another env's range) wait for a pause: the
   * view must not move under a running clock. Never after the user zoomed.
   */
  _autoFit() {
    if (this.linked || !this.r || this.fstate.mode !== "position" || !this._extent()) return;
    if (this.clock.playing && this._fitted) {
      this._fitPending = true;
      return;
    }
    this._fitPending = false;
    if (!this.rig.userZoomed) this._trajectoryFit(true);
  }

  // ---- camera ----

  setView(view, opts = {}) {
    if (this.linked) this.linked.setView(view, opts);
    else this._setView(view, opts);
  }

  _setView(view, opts) {
    if (!VIEWS.includes(view)) return;
    this.viewName = view;
    const animate = opts.animate !== false && !!this.r;
    this.rig.setView(view, animate);
    this._zeroPan(animate);
    if (!this.linked && this.r && this.fstate.mode === "position" && this.holdZ !== null && !this.rig.userZoomed) {
      // The height that shows the run depends on the view.
      const h = this._fitHeight(this.holdZ);
      if (h) this.rig.setHeight(h, animate);
    }
    this.invalidate();
  }

  /**
   * Fit the view to the selected and pinned envs ("focus") or to every env
   * ("all") and clear any pan. Position follow shows the whole run (the
   * followed body's height range, the ground and the static geometry beside
   * its path) instead of frame 0 as soon as that is known. In a ground-aligned
   * compare group this frames every pane to the same world height (the
   * largest any of them needs) and the same held height.
   */
  frame(what = "focus", opts = {}) {
    if (this.linked) this.linked.frame(what, opts);
    else this._frame(what, opts);
  }

  _frame(what, opts) {
    const animate = opts.animate !== false;
    const b = this._frameTarget(what, animate);
    if (b) this._fitFrame(what, b, animate);
    this.invalidate();
  }

  /** Clear the pan, aim the camera (not following) and return the bounds to fit. @internal */
  _frameTarget(what, animate) {
    const r = this.r;
    if (!r) return null;
    this._syncPose(); // bounds of the time shown now, not of the previous frame
    const fs = this.fstate;
    if (what === "all") {
      if (fs.mode !== "off") this.setFollow({ mode: "off" });
      const b = this._bounds(true);
      this.pan.a = this.pan.b = 0;
      this.rest.set(b.cx, b.cy, b.cz);
      this.rig.setTarget(b.cx, b.cy, b.cz, animate);
      return b;
    }
    const b = this._bounds(false);
    this.pan.a = this.pan.b = 0;
    if (fs.mode === "off") {
      // In a ground-aligned group the camera looks at the group's height even when not following.
      const z = this.linked && this.linked.z() !== null ? this.linked.z() : b.cz;
      this.rest.set(b.cx, b.cy, z);
      this.rig.setTarget(b.cx, b.cy, z, animate);
    }
    return b;
  }

  /** The zoom of a frame: the whole run in position follow when known, else the bounds `b` of the time shown. @internal */
  _fitFrame(what, b, animate) {
    if (what === "all") {
      this.rig.fitBox(b.ex / 2, b.ey / 2, b.ez / 2, animate);
      this._setDepth(b);
    } else if (!this._trajectoryFit(animate)) {
      // Frame 0's box is centred on the bounds, but position follow holds the camera at
      // the standing height (or the group's): leave room for the difference, or a robot
      // whose bounds centre is off that height is cropped in a short pane.
      const mode = this.fstate.mode;
      const held = mode === "pose" || (mode === "off" && !this.linked) ? null : (this._heldZ() ?? this.standingHeight());
      const dz = held === null ? 0 : Math.abs(b.cz - held);
      this.rig.fitBox(b.ex / 2, b.ey / 2, b.ez / 2 + dz, animate);
    }
  }

  /** Orbit, zoom and pan (`pan`: right and up, metres), plus where the target is now. */
  cameraState() {
    const state = this.rig.state(this.fstate.mode !== "off");
    state.pan = [this.pan.a, this.pan.b];
    return state;
  }

  /**
   * Height of the followed body at frame 0 (world z), or null before a run
   * is loaded. Linked cameras (compare.js) share the first player's.
   *
   * @internal
   */
  standingHeight() {
    const r = this.r;
    if (!r) return null;
    return this.fstate.z0.get(r.selected) ?? this.fstate.z0Default;
  }

  /**
   * Apply a camera state. The pan is camera-relative, so a state taken in
   * another pane (another run, another place) puts this pane's view at the
   * same offset from its own base; a state without one (old, or from a
   * foreign source) moves a camera that is not following to its absolute
   * target.
   */
  setCameraState(state, opts = {}) {
    if (!state) return;
    const animate = opts.animate === true;
    this.rig.apply(state, animate, false);
    // A restored view is the user's own: the automatic fit must not undo it.
    if (opts.keep === true) this.rig.userZoomed = true;
    const pan = state.pan;
    if (Array.isArray(pan) && Number.isFinite(pan[0]) && Number.isFinite(pan[1])) {
      this.pan.a = pan[0];
      this.pan.b = pan[1];
      if (this.fstate.mode === "off") this._writeRestTarget(animate, true);
    } else if (this.fstate.mode === "off" && Array.isArray(state.target)) {
      this.pan.a = this.pan.b = 0;
      this.rest.set(state.target[0], state.target[1], state.target[2]);
      this.rig.setTarget(state.target[0], state.target[1], state.target[2], animate);
    }
    this.invalidate();
  }

  /** Env under a client position, by ray-to-sphere against the env roots; null if none. */
  pickEnv(clientX, clientY) {
    const r = this.r;
    if (!r) return null;
    const rect = this.canvas.getBoundingClientRect();
    if (!(rect.width > 0 && rect.height > 0)) return null;
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((clientY - rect.top) / rect.height) * 2 - 1);
    this.camera.updateMatrixWorld();
    const origin = new Vector3(x, y, -1).unproject(this.camera);
    const dir = this.camera.getWorldDirection(new Vector3());
    // Sphere radius: half of a robot, in metres; at least a few pixels wide.
    const px = this.rig.height / rect.height;
    const robot = Math.max(r.proxySize[0], r.proxySize[1], r.proxySize[2]);
    const radius = Math.max(0.6 * robot, 6 * px);
    return pickNearest([origin.x, origin.y, origin.z, dir.x, dir.y, dir.z], r.rootPos, r.nEnvs, radius);
  }

  // ---- display ----

  resize(cssWidth, cssHeight, dpr = 1) {
    this.cssWidth = Math.max(cssWidth, 1);
    this.cssHeight = Math.max(cssHeight, 1);
    this.dpr = dpr;
    const before = this.rig.aspect;
    this.rig.setFrame(undefined, this.cssWidth / this.cssHeight);
    // The height that shows the run depends on the pane's shape (in a narrow pane the width limits it):
    // fit it again for the new one, at once. Only if it was fitted to the run and not zoomed by hand.
    if (this.r && Math.abs(this.rig.aspect / before - 1) > 0.01 && !this.rig.userZoomed) {
      if (this.linked) {
        if (this.linked.zc !== null && !this.linked.zoomed()) this.linked.trajectory(false);
      } else if (this.fstate.mode === "position" && this.holdZ !== null) {
        const h = this._fitHeight(this.holdZ);
        if (h) this.rig.setHeight(h, false);
      }
    }
    this.invalidate();
  }

  _setBackground(css) {
    const clear = css === null || css === "transparent" || css === "none";
    this.transparent = clear;
    // No colour given: the theme's neutral viewport grey (theme.js).
    this.scene.background = clear ? null : (typeof css === "string" && cssColor(css)) || colorOf(paletteOf(this.theme).viewport);
  }

  setTheme(theme, background) {
    this.theme = theme === "dark" ? "dark" : "light";
    this.ground.setTheme(this.theme);
    if (this.r) {
      for (const p of this.r.parts) p.setTheme(this.theme);
      for (const o of this.r.overlays) if (o.layer) o.layer.setTheme(this.theme);
    }
    this.bgExplicit = background !== undefined && background !== null;
    this._setBackground(this.bgExplicit ? background : undefined);
    this.invalidate();
  }

  /** CSS colour or "transparent" (the element's `background` attribute). */
  setBackground(css) {
    this.bgExplicit = css !== undefined && css !== null;
    this._setBackground(this.bgExplicit ? css : undefined);
    this.invalidate();
  }

  setGround(style) {
    this.groundForced = true;
    this._groundStyle = style === "grid" || style === "none" ? style : "checker";
    this.ground.setStyle(this._groundStyle);
    this._applyGroundVisibility();
    this.invalidate();
  }

  /** The ground draws where the scene has a plane (or when a style was asked for). */
  _applyGroundVisibility() {
    const r = this.r;
    const has = r ? r.parts.some((p) => p.planes.length > 0) : false;
    this.ground.mesh.visible = this._groundStyle !== "none" && (has || this.groundForced || !r);
    if (r && has) {
      const pl = r.parts.find((p) => p.planes.length).planes[0];
      // A tile about half a robot wide, from a few round sizes; 1 m for a field of envs.
      const robot = r.tiered ? 2 : Math.max(...r.proxySize);
      const tile = [0.05, 0.1, 0.25, 0.5, 1, 2, 5].reduce((best, t) => (Math.abs(t - robot / 2) < Math.abs(best - robot / 2) ? t : best));
      this.ground.setPlane(pl.z, tile);
    }
  }

  setContacts(on) {
    this.contactsOn = !!on;
    const r = this.r;
    if (r) {
      for (const o of r.overlays) if (o.contacts && o.layer) o.layer.root.visible = this.contactsOn;
      r.prefetch.w0 = -1; // ask again
      this.poseDirty = true;
    }
    this.invalidate();
  }

  /** Show or hide visual geoms. Collision geoms and contacts have their own setters. */
  setVisual(on) {
    this.showVisual = !!on;
    if (this.r) for (const p of this.r.parts) p.setRoles(this.showVisual, this.showCollision);
    this.invalidate();
  }

  setCollision(on) {
    this.showCollision = !!on;
    if (this.r) for (const p of this.r.parts) p.setRoles(this.showVisual, this.showCollision);
    this.invalidate();
  }

  /**
   * Set the player's slot colour (any CSS colour; null for none). It draws
   * nothing in the viewport: it is what the element's markers and the app's
   * pane dot use, and what `info().color` reports.
   */
  setColor(css) {
    const color = typeof css === "string" && css ? css : null;
    if (color === this.color) return;
    this.color = color;
    this.emit("color", { color });
  }

  setRoles(visual, collision) {
    this.showVisual = !!visual;
    this.showCollision = !!collision;
    if (this.r) for (const p of this.r.parts) p.setRoles(this.showVisual, this.showCollision);
    this.invalidate();
  }

  stats() {
    const r = this.r;
    const info = this.renderer.info;
    return {
      cachedBytes: r ? r.store.bytes : 0,
      pending: (r ? r.store.pending : 0) + decoder.pending,
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      focusEnvs: r ? r.focus.length : 0,
      threaded: decoder.threaded,
    };
  }

  // ---- live runs ----

  /** Re-read a live run's manifest and block directories; grows the clock's duration. */
  async refresh() {
    const r = this.r;
    if (!r || !r.live) return;
    const manifest = await runs.readManifest(r.source, r.run);
    const fresh = [];
    for (const s of r.streams.values()) {
      const index = await r.source.blockIndex(s.path, { refresh: true });
      s.nFrames = index.nFrames;
      s.nWindows = Math.ceil(index.nFrames / index.blockFrames);
      fresh.push(s);
    }
    if (this.r !== r) return;
    const live = manifest.status === "recording";
    const covered = fresh.filter((s) => s.kind === "pose" || s.kind === "arrows" || s.kind === "polyline");
    const frames = live ? runs.coveredFrames(manifest, covered) : manifest.n_frames;
    const wasLive = r.live;
    r.live = live;
    if (wasLive !== live) this._claimClock();
    if (frames > r.nFrames) {
      r.nFrames = frames;
      this._claimClock();
      r.prefetch.w0 = -1; // ask again
      this.emit("live", { frames });
      this.invalidate();
    }
  }

  // ---- data for plots ----

  /** One component of a recorded stream for one env over the whole timeline. */
  async series(name, env, component = 0) {
    return plots.series(this._need("series"), name, env, component);
  }

  /** Height (world z) or speed (m/s) of one body of one env over the whole timeline. */
  async bodySeries(kind, env, body) {
    return plots.bodySeries(this._need("bodySeries"), kind, env, body);
  }

  /**
   * `derived/<run>/highlights.json` as a `simscope-highlights/2` document
   * (a `/1` document is upgraded, see plots.js), or null when it does not exist.
   */
  highlights() {
    return this.r ? plots.highlights(this.r) : Promise.resolve(null);
  }

  /** `derived/<run>/summaries.json`, or null. */
  summaries() {
    return this.r ? plots.derived(this.r, "summaries.json") : Promise.resolve(null);
  }

  /** p5 / p50 / p95 across envs of one component of a stream, or null (single env, absent). */
  envelope(stream, component = 0) {
    return this.r ? plots.envelope(this.r, stream, component) : Promise.resolve(null);
  }

  _need(what) {
    if (!this.r) fail(`${what}(): no run is loaded`);
    return this.r;
  }

  // ---- misc ----

  /** Draw now and resolve with an image of the canvas. */
  async snapshot(type = "image/png") {
    this.update(0);
    this.renderer.draw(this);
    return new Promise((resolve, reject) =>
      this.canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("simscope: snapshot failed"))), type),
    );
  }

  emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
}
