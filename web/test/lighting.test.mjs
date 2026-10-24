import assert from "node:assert/strict";
import test from "node:test";
import { OrthographicCamera, Vector3 } from "three";

import { createLighting, DEFAULT_LIGHTING, normalizeLighting, studioDirection, sunDirection } from "../src/core/lighting.js";

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

/** An orthographic camera at `pos` looking at `at`, z-up, showing a world height of `height`. */
function camera(pos, at, height = 4, aspect = 1.5) {
  const cam = new OrthographicCamera((-height * aspect) / 2, (height * aspect) / 2, height / 2, -height / 2, 0.05, 500);
  cam.up.set(0, 0, 1);
  cam.position.set(...pos);
  cam.lookAt(new Vector3(...at));
  cam.updateMatrixWorld();
  return cam;
}

test("settings are completed from the defaults and clamped to their ranges", () => {
  assert.deepEqual(normalizeLighting(), { ...DEFAULT_LIGHTING });
  assert.deepEqual(normalizeLighting({ mode: "disco", brightness: 9, shadows: "yes", azimuth: -10, height: 0 }), {
    mode: "studio",
    brightness: 2,
    shadows: true,
    azimuth: 0,
    height: 5,
  });
  assert.equal(normalizeLighting({ brightness: Number.NaN }).brightness, 1);
});

test("the sun's direction follows its azimuth and height", () => {
  const up = sunDirection(0, 90);
  close(up.z, 1);
  const east = sunDirection(0, 0);
  close(east.x, 1);
  const north = sunDirection(90, 30);
  close(north.x, 0);
  close(north.y, Math.cos(Math.PI / 6));
  close(north.z, 0.5);
});

test("the studio key comes from above, on the camera's side, at every orbit angle", () => {
  for (let deg = 0; deg < 360; deg += 30) {
    const a = (deg * Math.PI) / 180;
    const cam = camera([5 * Math.cos(a), 5 * Math.sin(a), 3], [0, 0, 0]);
    const back = new Vector3(0, 0, 1).applyQuaternion(cam.quaternion);
    const right = new Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
    const key = studioDirection(back, right);
    close(key.length(), 1);
    assert.ok(key.z > 0.6, `key from above at ${deg} deg`);
    // Towards the camera: the side of the robot the viewer sees is the lit one.
    assert.ok(key.x * Math.cos(a) + key.y * Math.sin(a) > 0, `key on the camera's side at ${deg} deg`);
  }
  // Straight down, the camera's "back" is vertical; the key still has a direction and comes from above.
  const top = camera([0, 0, 10], [0, 0, 0]);
  top.up.set(0, 1, 0);
  top.lookAt(0, 0, 0);
  const key = studioDirection(new Vector3(0, 0, 1).applyQuaternion(top.quaternion), new Vector3(1, 0, 0).applyQuaternion(top.quaternion));
  assert.ok(Number.isFinite(key.x) && key.z > 0.6);
});

test("the shadow box is fitted to the view around the target", () => {
  const l = createLighting();
  const [, key] = l.objects;
  const target = new Vector3(2, -1, 0.3);
  l.update(camera([7, 4, 3.3], [2, -1, 0.3], 4, 1.5), target);
  const sc = key.shadow.camera;
  const half = Math.hypot(3, 2) * 1.1; // half the view's diagonal, plus 10 %
  close(sc.right, half);
  close(sc.top, half);
  close(key.target.position.distanceTo(target), 0);
  // The light sits on the key's side of the target, far enough for the whole box.
  assert.ok(key.position.distanceTo(target) > 2 * half);
  // Zooming in shrinks the box, so shadows stay sharp.
  const zoomed = camera([7, 4, 3.3], [2, -1, 0.3], 4, 1.5);
  zoomed.zoom = 4;
  l.update(zoomed, target);
  close(sc.right, half / 4);
});

test("modes, brightness, shadows and the ground", () => {
  const l = createLighting({ mode: "sun", azimuth: 90, height: 45, shadows: false });
  const [sky, key, , fill, , catcher] = l.objects;
  l.update(camera([5, 0, 3], [0, 0, 0]), new Vector3());
  const dir = key.position.clone().sub(key.target.position).normalize();
  close(dir.x, 0);
  close(dir.y, Math.SQRT1_2);
  assert.equal(fill.visible, false, "the sun has no fill");
  assert.equal(key.castShadow, false);
  assert.equal(catcher.visible, false);

  const before = sky.intensity;
  l.set({ brightness: 2, shadows: true });
  close(sky.intensity, 2 * before);
  assert.equal(key.castShadow, true);
  assert.equal(catcher.visible, true);
  assert.equal(l.settings.mode, "sun", "set keeps what it is not given");

  l.setGround(-0.5, false);
  assert.equal(catcher.visible, false, "no ground, nothing to catch shadows");
  l.setGround(-0.5, true);
  l.update(camera([5, 0, 3], [1, 1, 0]), new Vector3(1, 1, 0));
  assert.deepEqual(catcher.position.toArray(), [1, 1, -0.5]);

  l.set({ mode: "studio" });
  assert.equal(fill.visible, true);
  l.dispose();
});

test("the ground's light level: 1 by default from any angle, 0 in the dark, lower for a low sun", () => {
  const l = createLighting();
  for (const deg of [0, 90, 200]) {
    const a = (deg * Math.PI) / 180;
    l.update(camera([5 * Math.cos(a), 5 * Math.sin(a), 3], [0, 0, 0]), new Vector3());
    close(l.groundLevel, 1);
  }
  l.set({ brightness: 0.5 });
  l.update(camera([5, 0, 3], [0, 0, 0]), new Vector3());
  close(l.groundLevel, 0.5);
  l.set({ brightness: 0 });
  l.update(camera([5, 0, 3], [0, 0, 0]), new Vector3());
  assert.equal(l.groundLevel, 0);
  l.set({ mode: "sun", brightness: 1, height: 80 });
  l.update(camera([5, 0, 3], [0, 0, 0]), new Vector3());
  const high = l.groundLevel;
  l.set({ height: 10 });
  l.update(camera([5, 0, 3], [0, 0, 0]), new Vector3());
  assert.ok(l.groundLevel < high);
});
