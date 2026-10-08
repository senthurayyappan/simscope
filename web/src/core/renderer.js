// Renderers. They only draw; the shared rAF loop (loop.js) decides when.
//
// Shared (blit) mode, the default: one WebGLRenderer for every player on a
// page. Browsers keep about 16 live WebGL contexts and evict the oldest
// beyond that, so a deck of many players cannot give each its own. The one
// renderer draws a player's scene into a corner of its own canvas and blits
// that region into the player's 2D canvas with drawImage().
//
// Direct mode, for the one big viewport of the app: the player's own canvas
// is the WebGL canvas, so a 7-megapixel viewport does not pay a per-frame
// copy. It costs one context, so the app uses it for the main viewport only.

import { Vector2, WebGLRenderer } from "three";

import { wake } from "./loop.js";

let shared = null;

const pixels = (player) => [Math.max(1, Math.round(player.cssWidth * player.dpr)), Math.max(1, Math.round(player.cssHeight * player.dpr))];

class SharedRenderer {
  constructor() {
    // No preserveDrawingBuffer: the blit happens in the same task as the draw.
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(1);
    this.renderer.setScissorTest(true);
    this.canvas = this.renderer.domElement;
    this.width = 0;
    this.height = 0;
    this.players = new Set();
    this.lost = false;
    this.onLost = (e) => {
      e.preventDefault(); // allow restoration
      this.lost = true;
    };
    this.onRestored = () => {
      // three.js re-initialises its own GL state on restore; the scenes'
      // buffers and programs are re-uploaded lazily on the next draw.
      this.lost = false;
      for (const p of this.players) p.invalidate();
      wake();
    };
    this.canvas.addEventListener("webglcontextlost", this.onLost);
    this.canvas.addEventListener("webglcontextrestored", this.onRestored);
  }

  attach(player) {
    this.players.add(player);
  }

  detach(player) {
    this.players.delete(player);
    if (this.players.size === 0) this.destroy();
  }

  draw(player) {
    if (this.lost) return;
    const [w, h] = pixels(player);
    const out = player.canvas;
    if (out.width !== w || out.height !== h) {
      out.width = w;
      out.height = h;
    }
    if (w > this.width || h > this.height) {
      this.width = Math.max(this.width, w);
      this.height = Math.max(this.height, h);
      this.renderer.setSize(this.width, this.height, false);
    }
    const r = this.renderer;
    r.setViewport(0, 0, w, h);
    r.setScissor(0, 0, w, h);
    r.setClearColor(0x000000, player.transparent ? 0 : 1);
    r.render(player.scene, player.camera);
    const ctx = out.getContext("2d");
    ctx.clearRect(0, 0, w, h);
    // GL's origin is bottom-left, so our region is the bottom h rows.
    ctx.drawImage(this.canvas, 0, this.height - h, w, h, 0, 0, w, h);
    player.dirty = false;
  }

  /** Forget cached GPU state of objects that left the scene. */
  get info() {
    return this.renderer.info;
  }

  destroy() {
    this.canvas.removeEventListener("webglcontextlost", this.onLost);
    this.canvas.removeEventListener("webglcontextrestored", this.onRestored);
    this.renderer.dispose();
    this.renderer.forceContextLoss(); // give the context back right away
    if (shared === this) shared = null;
  }
}

class DirectRenderer {
  constructor(canvas) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(1);
    this.canvas = canvas;
    this.player = null;
    this.lost = false;
    this.onLost = (e) => {
      e.preventDefault();
      this.lost = true;
    };
    this.onRestored = () => {
      this.lost = false;
      if (this.player) this.player.invalidate();
      wake();
    };
    canvas.addEventListener("webglcontextlost", this.onLost);
    canvas.addEventListener("webglcontextrestored", this.onRestored);
  }

  attach(player) {
    this.player = player;
  }

  detach() {
    this.player = null;
    this.canvas.removeEventListener("webglcontextlost", this.onLost);
    this.canvas.removeEventListener("webglcontextrestored", this.onRestored);
    // No forceContextLoss: a canvas whose context was lost cannot be given a
    // new one, and an app may build another player on the same canvas.
    this.renderer.dispose();
  }

  draw(player) {
    if (this.lost) return;
    const [w, h] = pixels(player);
    const size = this.renderer.getSize(_size);
    const dpr = this.renderer.getPixelRatio();
    if (size.x !== w || size.y !== h || dpr !== 1) this.renderer.setSize(w, h, false);
    this.renderer.setClearColor(0x000000, player.transparent ? 0 : 1);
    this.renderer.render(player.scene, player.camera);
    player.dirty = false;
  }

  get info() {
    return this.renderer.info;
  }
}

const _size = new Vector2();

/**
 * A throwaway renderer for captures: its own canvas and context, at any size,
 * so a screenshot or a GIF frame does not depend on the pane's size or touch
 * what is on screen. `dispose()` gives the context back at once.
 */
class OffscreenRenderer {
  constructor() {
    this.canvas = document.createElement("canvas");
    // The 2D copy of a frame is read right after the draw, but a kept buffer makes that safe in every browser.
    this.renderer = new WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(1);
    const gl = this.renderer.getContext();
    /** The largest width or height a frame can have. */
    this.maxSize = Math.min(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), gl.getParameter(gl.MAX_TEXTURE_SIZE), gl.getParameter(gl.MAX_VIEWPORT_DIMS)[0]);
    this.copy = null;
  }

  /** Draw `player`'s scene, through `camera`, at `w` x `h` pixels; returns the canvas. */
  draw(player, w, h, camera) {
    this.renderer.setSize(w, h, false);
    this.renderer.setClearColor(0x000000, player.transparent ? 0 : 1);
    this.renderer.render(player.scene, camera);
    return this.canvas;
  }

  /** The drawn frame as RGBA bytes, top row first. */
  pixels(player, w, h, camera) {
    const gl = this.draw(player, w, h, camera);
    if (!this.copy) this.copy = this.canvas.ownerDocument.createElement("canvas").getContext("2d", { willReadFrequently: true });
    const ctx = this.copy;
    if (ctx.canvas.width !== w || ctx.canvas.height !== h) {
      ctx.canvas.width = w;
      ctx.canvas.height = h;
    }
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(gl, 0, 0);
    return ctx.getImageData(0, 0, w, h).data;
  }

  /** The drawn frame as an image file. */
  blob(player, w, h, type, camera) {
    const gl = this.draw(player, w, h, camera);
    return new Promise((resolve, reject) => gl.toBlob((b) => (b ? resolve(b) : reject(new Error("simscope: snapshot failed"))), type));
  }

  dispose() {
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}

/** A renderer for one capture; throws if WebGL is unavailable. Call `dispose()` when done. */
export function createOffscreenRenderer() {
  return new OffscreenRenderer();
}

/** The page's shared renderer; throws if WebGL is unavailable. */
export function getSharedRenderer() {
  if (!shared) shared = new SharedRenderer();
  return shared;
}

/** A renderer that draws into `canvas` itself (one per big viewport). */
export function createDirectRenderer(canvas) {
  return new DirectRenderer(canvas);
}
