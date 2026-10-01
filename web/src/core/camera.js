// The camera: orthographic, z-up, on camera-controls.
//
// camera-controls keeps its orbit in a y-up frame and maps to ours through
// `camera.up`, which must be set before the controls are built and is never
// changed afterwards (the top view stays z-up too, at a polar angle of 1e-3
// rather than 0, where look-at is degenerate).
//
// Zoom model: the frustum is fixed from `scale`, the world height shown at
// zoom 1; camera-controls owns `camera.zoom`; the world height on screen is
// `scale / zoom`. "Fitting" a set of envs is a zoom.
//
// Follow (player.js) drives the target from outside, every frame, without a
// transition; everything user-driven (orbit, zoom, truck) stays with
// camera-controls and is reported through `userChanged`. A pan (truck) moves
// camera-controls' target; the player reads how far (`dragDelta`), keeps it
// as a camera-relative offset and writes the target back, so `applied` is
// always the target the player last asked for.

import CameraControls from "camera-controls";
import { Box3, MathUtils, Matrix4, OrthographicCamera, Quaternion, Raycaster, Sphere, Spherical, Vector2, Vector3, Vector4 } from "three";

CameraControls.install({ THREE: { Vector2, Vector3, Vector4, Quaternion, Matrix4, Spherical, Box3, Sphere, Raycaster, MathUtils } });

export const VIEWS = ["iso", "front", "side", "top"];

// Directions from the target to the camera. `top` leans a hair south so that
// +y is screen-up and +x screen-right.
const OFFSETS = {
  iso: [1, 1, 0.8],
  front: [1, 0, 0],
  side: [0, 1, 0],
  top: [0, -1e-3, 1],
};

const MIN_POLAR = 1e-3;
const MAX_POLAR = Math.PI / 2; // never below the ground
const PRESET_SMOOTH_TIME = 0.08; // ~250 ms to settle
const A = CameraControls.ACTION;
const ROTATE_BITS = A.ROTATE | A.TOUCH_ROTATE | A.TOUCH_DOLLY_ROTATE | A.TOUCH_ZOOM_ROTATE;

const _v = new Vector3();
const _s = new Spherical();
const _q = new Quaternion();
const _up = new Vector3(0, 0, 1);
const _w = new Vector3();
const _r = new Vector3();
const _u = new Vector3();
const _y = new Vector3(0, 1, 0);
const _basis = { rx: 1, ry: 0, rz: 0, ux: 0, uy: 0, uz: 1 };

/** Orbit angles (camera-controls' azimuth and polar) for a named view. */
export function viewAngles(view) {
  const dir = OFFSETS[Object.hasOwn(OFFSETS, view) ? view : "iso"];
  _q.setFromUnitVectors(_up, _y);
  _s.setFromVector3(_v.set(dir[0], dir[1], dir[2]).normalize().applyQuaternion(_q));
  return { azimuth: _s.theta, polar: _s.phi };
}

/** `a` shifted by whole turns to be as close as possible to `near`. */
function nearestTurn(a, near) {
  const turn = 2 * Math.PI;
  return a + turn * Math.round((near - a) / turn);
}

export class CameraRig {
  /**
   * @param {HTMLElement | null} dom  element that receives pointer input (null: no input, for tests).
   */
  constructor(dom) {
    this.camera = new OrthographicCamera(-1, 1, 1, -1, 0.05, 500);
    this.camera.up.set(0, 0, 1);
    this.camera.position.set(1, 1, 0.8).normalize().multiplyScalar(50);
    this.controls = new CameraControls(this.camera, dom || undefined);
    const c = this.controls;
    c.smoothTime = PRESET_SMOOTH_TIME;
    c.draggingSmoothTime = 0.1;
    c.minPolarAngle = MIN_POLAR;
    c.maxPolarAngle = MAX_POLAR;
    c.minZoom = 1e-3;
    c.maxZoom = 1e3;
    c.dollyToCursor = false;
    c.mouseButtons.left = A.ROTATE;
    c.mouseButtons.middle = A.ZOOM;
    c.mouseButtons.right = A.TRUCK;
    c.mouseButtons.wheel = A.ZOOM;
    c.touches.one = A.TOUCH_ROTATE;
    c.touches.two = A.TOUCH_ZOOM_TRUCK;
    c.touches.three = A.TOUCH_TRUCK;

    this.scale = 3; // world height shown at zoom 1
    this.aspect = 1;
    this.distance = 50;
    this.dragging = false;
    this.dragRotate = false;
    this.applied = new Vector3(); // the target the player last asked for
    this.userChanged = false; // set by any user-driven change, cleared by the player
    this.userZoomed = false; // the user changed the zoom: stop auto-fitting

    c.addEventListener("controlstart", () => {
      this.dragging = true;
      this.dragRotate = (c.currentAction & ROTATE_BITS) !== 0;
      c.smoothTime = PRESET_SMOOTH_TIME;
    });
    c.addEventListener("controlend", () => {
      this.dragging = false;
      this.dragRotate = false;
    });
    c.addEventListener("control", () => {
      this.userChanged = true;
      if (!this.dragging || (c.currentAction & (A.ZOOM | A.TOUCH_ZOOM | A.TOUCH_ZOOM_TRUCK)) !== 0) this.userZoomed = true;
    });
    this.applyFrustum();
    this.setAngles(viewAngles("iso"), false);
  }

  get dom() {
    return this.controls._domElement;
  }

  // ---- frustum and depth ----

  /** Set the world height shown at zoom 1 and the viewport aspect (width / height). */
  setFrame(scale, aspect) {
    if (scale > 0) this.scale = scale;
    if (aspect > 0) this.aspect = aspect;
    this.applyFrustum();
  }

  applyFrustum() {
    const h = this.scale / 2, w = h * this.aspect;
    const cam = this.camera;
    cam.left = -w;
    cam.right = w;
    cam.top = h;
    cam.bottom = -h;
    cam.updateProjectionMatrix();
  }

  /** Camera distance and far plane from the scene's radius (ortho depth is linear). */
  setDepth(distance, far) {
    this.distance = distance;
    this.camera.near = 0.05;
    this.camera.far = far;
    this.camera.updateProjectionMatrix();
    this.controls.dollyTo(distance, false);
  }

  /** World height currently shown. */
  get height() {
    return this.scale / this.camera.zoom;
  }

  // ---- orbit ----

  setAngles({ azimuth, polar }, animate) {
    const cur = this.controls.getSpherical(_s, true);
    const az = nearestTurn(azimuth, cur.theta);
    this.controls.smoothTime = PRESET_SMOOTH_TIME;
    this.controls.rotateTo(az, polar, animate);
  }

  /** Animate (or jump) to a named view, keeping the target and zoom. */
  setView(view, animate) {
    this.setAngles(viewAngles(view), animate);
  }

  get azimuth() {
    return this.controls.azimuthAngle;
  }

  /** Jump the azimuth (heading follow), shortest way round, without a transition. */
  setAzimuthNow(theta) {
    const cur = this.controls.getSpherical(_s, true);
    this.controls.rotateTo(nearestTurn(theta, cur.theta), cur.phi, false);
  }

  // ---- target and zoom ----

  getTarget(out) {
    return this.controls.getTarget(out, false);
  }

  /** Put the orbit target somewhere at once (follow; also keeps the camera's offset). */
  setTargetNow(x, y, z) {
    this.applied.set(x, y, z);
    this.controls.moveTo(x, y, z, false);
  }

  setTarget(x, y, z, animate) {
    this.applied.set(x, y, z);
    this.controls.smoothTime = PRESET_SMOOTH_TIME;
    this.controls.moveTo(x, y, z, animate);
  }

  /**
   * How far the user has moved the target (a pan) since the last
   * `setTarget` / `setTargetNow`, as screen-relative metres `out = [right, up]`.
   * camera-controls' truck moves the target along the camera's own right and
   * up axes, so this is the pan exactly. Returns false if there is none.
   */
  dragDelta(out) {
    const t = this.controls.getTarget(_v, true);
    const dx = t.x - this.applied.x, dy = t.y - this.applied.y, dz = t.z - this.applied.z;
    if (dx === 0 && dy === 0 && dz === 0) return false;
    this.camera.updateMatrix();
    _r.setFromMatrixColumn(this.camera.matrix, 0);
    _u.setFromMatrixColumn(this.camera.matrix, 1);
    out[0] = _r.x * dx + _r.y * dy + _r.z * dz;
    out[1] = _u.x * dx + _u.y * dy + _u.z * dz;
    return true;
  }

  /**
   * The view's right and up vectors in world coordinates, as `{rx, ry, rz, ux,
   * uy, uz}` (a shared object, overwritten by the next call). With `end` for the
   * orbit the camera is heading to, else for where it is now. The camera looks
   * along `-toCamera`, and up is the world's z.
   */
  basis(end = true) {
    const s = this.controls.getSpherical(_s, end);
    _q.setFromUnitVectors(_up, _y).invert();
    const toCam = _v.setFromSpherical(s).normalize().applyQuaternion(_q);
    const fwd = _w.copy(toCam).negate();
    const right = _r.crossVectors(fwd, _up);
    if (right.lengthSq() < 1e-8) right.set(1, 0, 0);
    right.normalize();
    const up = _u.crossVectors(right, fwd).normalize();
    const b = _basis;
    b.rx = right.x; b.ry = right.y; b.rz = right.z;
    b.ux = up.x; b.uy = up.y; b.uz = up.z;
    return b;
  }

  /** Zoom so that a sphere of `radius` fills the view with `margin` to spare. */
  fitRadius(radius, animate, margin = 1.15) {
    const need = (2 * Math.max(radius, 0.05) * margin) / Math.min(1, this.aspect);
    this.controls.smoothTime = PRESET_SMOOTH_TIME;
    this.controls.zoomTo(MathUtils.clamp(this.scale / need, this.controls.minZoom, this.controls.maxZoom), animate);
    this.userZoomed = false;
  }

  /**
   * Zoom so that a box (centre, half extents) fits the view the camera is
   * heading to, with `margin` to spare. Exact for the current orbit angles.
   */
  fitBox(hx, hy, hz, animate, margin = 1.04) {
    const b = this.basis(true);
    const w = hx * Math.abs(b.rx) + hy * Math.abs(b.ry) + hz * Math.abs(b.rz);
    const h = hx * Math.abs(b.ux) + hy * Math.abs(b.uy) + hz * Math.abs(b.uz);
    const need = 2 * margin * Math.max(h, w / this.aspect, 0.05);
    this.controls.smoothTime = PRESET_SMOOTH_TIME;
    this.controls.zoomTo(MathUtils.clamp(this.scale / need, this.controls.minZoom, this.controls.maxZoom), animate);
    this.userZoomed = false;
  }

  setZoomNow(zoom) {
    this.controls.zoomTo(zoom, false);
  }

  /**
   * World height the zoom is heading to (`height` is where it is now, which
   * lags during an animation). Compare takes the largest of these.
   */
  get targetHeight() {
    return this.scale / this.controls._zoomEnd;
  }

  /** Zoom so that `height` metres of world fill the view's height. */
  setHeight(height, animate) {
    this.controls.smoothTime = PRESET_SMOOTH_TIME;
    this.controls.zoomTo(MathUtils.clamp(this.scale / height, this.controls.minZoom, this.controls.maxZoom), animate);
    this.userZoomed = false;
  }

  // ---- frame update ----

  /** Advance camera-controls by `dt` seconds. True if the view changed. */
  update(dt) {
    return this.controls.update(dt);
  }

  get rotateBusy() {
    return this.dragRotate;
  }

  // ---- state ----

  /** A JSON-serialisable description of the view (orbit, zoom, target), as it will be once it settles. */
  state(following) {
    const s = this.controls.getSpherical(_s, true);
    const t = this.controls.getTarget(_v, true);
    return {
      v: 1,
      azimuth: s.theta,
      polar: s.phi,
      // Where the zoom is heading, like the orbit and target above: a wheel
      // zoom reports once, at its start, and the others must end up where it ends.
      zoom: this.controls._zoomEnd,
      scale: this.scale,
      target: [t.x, t.y, t.z],
      following: !!following,
    };
  }

  /**
   * Apply a state from `state()`. The world height shown is reproduced even if
   * this rig's `scale` differs. The target is applied only when `withTarget`
   * (a following camera keeps following its own body).
   */
  apply(state, animate, withTarget) {
    if (!state || state.v !== 1) return;
    this.controls.smoothTime = PRESET_SMOOTH_TIME;
    const cur = this.controls.getSpherical(_s, true);
    const polar = MathUtils.clamp(state.polar, MIN_POLAR, MAX_POLAR);
    this.controls.rotateTo(nearestTurn(state.azimuth, cur.theta), polar, animate);
    const height = state.scale / state.zoom;
    this.controls.zoomTo(MathUtils.clamp(this.scale / height, this.controls.minZoom, this.controls.maxZoom), animate);
    if (withTarget) this.setTarget(state.target[0], state.target[1], state.target[2], animate);
  }

  dispose() {
    this.controls.dispose();
  }
}
