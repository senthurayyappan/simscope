// The ground: one shader plane sized to the view. Its greys come from theme.js.
//
// A MuJoCo-style checkerboard (default) or a plane with grey grid
// lines, antialiased with fwidth so orthographic views at grazing angles do
// not moire: where a tile gets smaller than a few pixels, the checker fades
// to its average colour and grid lines fade out. The plane is a quad of a
// few view-heights around the camera target that fades to nothing at its
// rim, so it never shows an edge and never runs out, at any zoom. Replaces
// the 30 m line grid.
//
// Seen edge-on (the side and front views) a plane has no area, so the checker
// vanishes; a thin grey line along each axis, faded in as the view flattens,
// keeps the ground's height readable. It is two upright strips a pixel and a
// half thick (a GL line is one device pixel, too faint on a high-DPI screen).

import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Mesh, MeshBasicMaterial, PlaneGeometry, ShaderMaterial } from "three";

import { colorOf, groundPalette } from "./theme.js";

const setLch = (color, lch) => color.copy(colorOf(lch));

export const DEFAULT_TILE = 1; // metres

const VERTEX = /* glsl */ `
uniform vec2 uCenter;
uniform float uHalf;
varying vec2 vWorld;
void main() {
  vec2 w = uCenter + position.xy * uHalf;
  vWorld = w;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(w, 0.0, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
uniform vec2 uCenter;
uniform float uHalf;
uniform float uTile;
uniform float uMode;
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uLine;
varying vec2 vWorld;

void main() {
  vec2 p = vWorld / uTile;
  vec2 w = fwidth(p) + 1e-4;
  vec3 col;
  if (uMode < 0.5) {
    // Box-filtered checker (period 2 in p): exact average once tiles are sub-pixel.
    vec2 i = 2.0 * (abs(fract((p - 0.5 * w) * 0.5) - 0.5) - abs(fract((p + 0.5 * w) * 0.5) - 0.5)) / w;
    float c = 0.5 - 0.5 * i.x * i.y;
    // Tiles under ~2 px (grazing views, zoomed far out): the exact average, with no noise.
    c = mix(c, 0.5, smoothstep(0.35, 0.8, max(w.x, w.y)));
    col = mix(uA, uB, c);
  } else {
    vec2 g = abs(fract(p - 0.5) - 0.5) / w;      // distance to a tile edge, in pixels
    float line = 1.0 - clamp(min(g.x, g.y) - 0.5, 0.0, 1.0);
    float keep = 1.0 - smoothstep(0.25, 0.5, max(w.x, w.y)); // drop lines once tiles are tiny
    col = mix(uA, uLine, line * keep);
  }
  float d = length(vWorld - uCenter) / uHalf;
  float alpha = 1.0 - smoothstep(0.55, 1.0, d);
  gl_FragColor = vec4(col, alpha);
  #include <colorspace_fragment>
}
`;

/**
 * The ground object. `mesh` goes into the scene; `update()` runs every
 * frame before drawing; `setStyle()` and `setTheme()` restyle it.
 */
export function createGround(style = "checker", theme = "light", scheme = "auto") {
  const material = new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      uCenter: { value: [0, 0] },
      uHalf: { value: 100 },
      uTile: { value: DEFAULT_TILE },
      uMode: { value: 0 },
      uA: { value: new Color() },
      uB: { value: new Color() },
      uLine: { value: new Color() },
    },
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  const geometry = new PlaneGeometry(2, 2);
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  // The ground line: an upright strip along x and one along y through the view's centre, a unit long and high
  // each way (scaled in update()).
  const lineGeometry = new BufferGeometry();
  lineGeometry.setAttribute("position", new Float32BufferAttribute([-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, -1, 1, 0, 1, -1, 0, 1, 0, -1, -1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, 1, 1, 0, -1, 1], 3));
  const lineMaterial = new MeshBasicMaterial({ transparent: true, depthWrite: false, side: DoubleSide });
  const line = new Mesh(lineGeometry, lineMaterial);
  line.frustumCulled = false;
  line.renderOrder = -9;
  line.visible = false;
  mesh.add(line);
  const u = material.uniforms;
  const state = { style, theme, scheme, z: 0 };

  function restyle() {
    mesh.visible = state.style !== "none";
    const pal = groundPalette(state.scheme, state.theme);
    lineMaterial.color.copy(colorOf(pal.horizon));
    if (state.style === "grid") {
      u.uMode.value = 1;
      setLch(u.uA.value, pal.grid.base);
      setLch(u.uLine.value, pal.grid.line);
    } else {
      u.uMode.value = 0;
      setLch(u.uA.value, pal.checker[0]);
      setLch(u.uB.value, pal.checker[1]);
    }
  }
  restyle();

  return {
    mesh,
    get style() {
      return state.style;
    },
    setStyle(s) {
      state.style = s === "grid" || s === "none" ? s : "checker";
      restyle();
    },
    setTheme(t) {
      state.theme = t === "dark" ? "dark" : "light";
      restyle();
    },
    /** The colour scheme: "auto" (the theme's), "light", "dark" or "mujoco". */
    setScheme(s) {
      state.scheme = s;
      restyle();
    },
    /** Height of the plane and its tile size (from the scene's plane geom). */
    setPlane(z, tile) {
      state.z = z;
      mesh.position.z = z;
      u.uTile.value = tile > 0 ? tile : DEFAULT_TILE;
    },
    /**
     * Follow the view: centre under the target, a few view-heights wide.
     * `up` is how much the view looks down (|z| of the view direction, 0 edge-on, 1 from above): it fades the ground line,
     * whose thickness is `worldPerPx` (metres per CSS pixel) times 1.5.
     */
    update(cx, cy, viewHeight, aspect, up = 1, worldPerPx = 0) {
      const span = viewHeight * Math.max(1, aspect);
      u.uCenter.value[0] = cx;
      u.uCenter.value[1] = cy;
      u.uHalf.value = Math.max(40, span * 3);
      const t = Math.min(Math.max((up - 0.02) / 0.16, 0), 1);
      const fade = 1 - t * t * (3 - 2 * t);
      line.visible = fade > 0.01;
      lineMaterial.opacity = fade;
      line.position.set(cx, cy, 0);
      line.scale.set(u.uHalf.value, u.uHalf.value, Math.max(0.75 * worldPerPx, 1e-4));
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      lineGeometry.dispose();
      lineMaterial.dispose();
    },
  };
}
