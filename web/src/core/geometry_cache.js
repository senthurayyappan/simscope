// A page-level cache of mesh geometries, keyed by the mesh's sha256.
//
// Every player on a page shares one WebGL context (renderer.js), so they can
// share GPU buffers too: a 30-slide deck of the same robot uploads its meshes
// once, not 30 times. Entries are reference-counted and disposed when the
// last player drops them.

import { BufferAttribute, BufferGeometry } from "three";

const cache = new Map(); // sha -> {promise, geometry, refs}

function build(decoded) {
  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(decoded.verts, 3));
  geo.setAttribute("normal", new BufferAttribute(decoded.normals, 3));
  if (decoded.uvs) geo.setAttribute("uv", new BufferAttribute(decoded.uvs, 2));
  geo.setIndex(new BufferAttribute(decoded.faces, 1));
  return geo;
}

/**
 * The geometry for mesh `sha`, decoding it with `decode()` (a promise of
 * `{verts, faces, normals, uvs}`) on first use. Call `releaseMesh(sha)` once
 * per `acquireMesh`.
 */
export function acquireMesh(sha, decode) {
  let hit = cache.get(sha);
  if (!hit) {
    hit = { refs: 0, geometry: null, promise: null };
    hit.promise = decode().then(
      (decoded) => (hit.geometry = build(decoded)),
      (err) => {
        if (cache.get(sha) === hit) cache.delete(sha);
        throw err;
      },
    );
    cache.set(sha, hit);
  }
  hit.refs++;
  return hit.promise;
}

export function releaseMesh(sha) {
  const hit = cache.get(sha);
  if (!hit || --hit.refs > 0) return;
  cache.delete(sha);
  if (hit.geometry) hit.geometry.dispose();
  else hit.promise.then((g) => g.dispose(), () => {});
}

/** Geometries currently cached (tests, stats). */
export function cachedMeshes() {
  return cache.size;
}
