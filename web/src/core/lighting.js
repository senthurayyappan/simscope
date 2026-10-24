// The lights of a player's scene, and the shadows they cast.
//
// Two setups. "studio" (the default) lights the robot from the viewer's side:
// a key light above and to the left of the camera, and a weak fill from the
// right, both turning with the camera, so an orbit never leaves the robot in
// the dark. "sun" is one light fixed in the world, set by its azimuth and
// height, as outdoors: shadows stay put while the camera moves.
//
// The key light (or the sun) casts shadows. Its shadow camera is fitted to
// the view each frame: a box around the camera target as wide as the view.
// The ground is a shader plane that takes no light, so shadows fall on a
// transparent catcher plane at the ground's height.
//
// `update(camera, target)` runs just before every draw (Scene.onBeforeRender),
// with the camera of that draw: the viewport's, or a capture's.

import { DirectionalLight, HemisphereLight, Mesh, PCFSoftShadowMap, PlaneGeometry, ShadowMaterial, Vector3 } from "three";

export const LIGHT_MODES = ["studio", "sun"];
export const DEFAULT_LIGHTING = Object.freeze({ mode: "studio", brightness: 1, shadows: true, azimuth: 135, height: 50 });

const SHADOW_SIZE = 2048;
// Physically based units (three r155+): intensities are pi times the old ones for the same look.
const LEVELS = {
  studio: { sky: 0.45, key: 0.9, fill: 0.3 },
  sun: { sky: 0.5, key: 1.1, fill: 0 },
};
const Z = new Vector3(0, 0, 1);
const _back = new Vector3();
const _right = new Vector3();
const _dir = new Vector3();
const _fill = new Vector3();
const _camBack = new Vector3();
const _camRight = new Vector3();

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

/** A lighting setting with every field present and in range. */
export function normalizeLighting(l = {}) {
  const d = DEFAULT_LIGHTING;
  const num = (v, lo, hi, def) => (typeof v === "number" && Number.isFinite(v) ? clamp(v, lo, hi) : def);
  return {
    mode: LIGHT_MODES.includes(l.mode) ? l.mode : d.mode,
    brightness: num(l.brightness, 0.25, 2, d.brightness),
    shadows: typeof l.shadows === "boolean" ? l.shadows : d.shadows,
    azimuth: num(l.azimuth, 0, 360, d.azimuth),
    height: num(l.height, 5, 90, d.height),
  };
}

/** Turn on shadow maps on a WebGLRenderer; lights decide whether any are drawn. */
export function enableShadows(renderer) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
}

/** The unit vector towards a sun at `azimuth` degrees (counterclockwise from +x) and `height` degrees above the ground. */
export function sunDirection(azimuth, height, out = new Vector3()) {
  const a = (azimuth * Math.PI) / 180;
  const h = (height * Math.PI) / 180;
  return out.set(Math.cos(h) * Math.cos(a), Math.cos(h) * Math.sin(a), Math.sin(h));
}

/**
 * The key light's direction (towards the light) for a camera looking along `-back`: above the view, a little to the
 * left of the camera. Looking straight down, it comes from the top of the screen.
 */
export function studioDirection(back, right, out = new Vector3()) {
  const flat = _back.set(back.x, back.y, 0);
  if (flat.lengthSq() < 1e-6) flat.set(right.y, -right.x, 0); // from above: "back" is the screen's down
  flat.normalize();
  const side = _right.set(right.x, right.y, 0).normalize();
  return out.copy(flat).multiplyScalar(0.6).addScaledVector(side, -0.4).addScaledVector(Z, 1).normalize();
}

export function createLighting(settings = DEFAULT_LIGHTING) {
  const sky = new HemisphereLight(0xffffff, 0x444444, 1);
  const key = new DirectionalLight(0xffffff, 1);
  const fill = new DirectionalLight(0xffffff, 1);
  key.shadow.mapSize.set(SHADOW_SIZE, SHADOW_SIZE);
  key.shadow.bias = -0.0005;
  const catcher = new Mesh(new PlaneGeometry(2, 2), new ShadowMaterial({ opacity: 0.25, depthWrite: false }));
  catcher.receiveShadow = true;
  catcher.frustumCulled = false;
  catcher.renderOrder = -8; // over the ground (-10) and its line (-9)
  catcher.material.polygonOffset = true;
  catcher.material.polygonOffsetFactor = -1;
  catcher.material.polygonOffsetUnits = -4;
  const objects = [sky, key, key.target, fill, fill.target, catcher];
  const state = { ...normalizeLighting(settings), groundZ: 0, ground: true, theme: "light" };

  function apply() {
    const lv = LEVELS[state.mode];
    const b = state.brightness * Math.PI;
    sky.intensity = lv.sky * b;
    key.intensity = lv.key * b;
    fill.intensity = lv.fill * b;
    fill.visible = lv.fill > 0;
    key.castShadow = state.shadows;
    catcher.visible = state.shadows && state.ground;
    catcher.material.opacity = state.theme === "dark" ? 0.45 : 0.25;
  }
  apply();

  return {
    objects,
    get settings() {
      const { mode, brightness, shadows, azimuth, height } = state;
      return { mode, brightness, shadows, azimuth, height };
    },
    set(next) {
      Object.assign(state, normalizeLighting({ ...this.settings, ...next }));
      apply();
    },
    setTheme(theme) {
      state.theme = theme === "dark" ? "dark" : "light";
      apply();
    },
    /** Where the ground is, and whether it is drawn (shadows fall on it only then). */
    setGround(z, visible) {
      state.groundZ = z;
      state.ground = !!visible;
      apply();
    },
    /** Aim the lights for a draw through `camera` (orthographic, z-up) looking at `target`. */
    update(camera, target) {
      const back = _camBack.set(0, 0, 1).applyQuaternion(camera.quaternion);
      const right = _camRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
      if (state.mode === "sun") sunDirection(state.azimuth, state.height, _dir);
      else {
        studioDirection(back, right, _dir);
        // The fill comes from the other side, lower, so the key's far side is not black.
        _fill.copy(_dir).addScaledVector(right, 1.2).setZ(_dir.z * 0.4).normalize();
      }
      // The shadow box covers the view around the target: half its diagonal, plus a margin.
      const zoom = camera.zoom || 1;
      const halfW = (camera.right - camera.left) / 2 / zoom;
      const halfH = (camera.top - camera.bottom) / 2 / zoom;
      const r = Math.max(Math.hypot(halfW, halfH) * 1.1, 0.5);
      const far = 4 * r + 20;
      key.target.position.copy(target);
      key.position.copy(target).addScaledVector(_dir, far / 2);
      const sc = key.shadow.camera;
      sc.left = -r;
      sc.right = r;
      sc.top = r;
      sc.bottom = -r;
      sc.near = 0.05;
      sc.far = far;
      sc.updateProjectionMatrix();
      // Texels grow with the box; offset along the normal by about one to keep surfaces from shadowing themselves.
      key.shadow.normalBias = (2 * r) / SHADOW_SIZE;
      fill.target.position.copy(target);
      fill.position.copy(target).add(_fill);
      catcher.position.set(target.x, target.y, state.groundZ);
      catcher.scale.set(1.5 * r, 1.5 * r, 1);
      // onBeforeRender runs after the scene's matrices were updated.
      for (const o of objects) o.updateMatrixWorld();
    },
    dispose() {
      key.shadow.dispose();
      catcher.geometry.dispose();
      catcher.material.dispose();
    },
  };
}
