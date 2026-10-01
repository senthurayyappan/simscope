"""Scene descriptors: canonical JSON and content-addressed storage."""

import json
from collections.abc import Callable, Iterable, Mapping, Sequence
from typing import Any

import numpy as np

from simscope import core
from simscope.io import cas, codecs, errors

SCENE_FORMAT = "simscope-scene/1"

AssetGetter = Callable[[cas.Ref], bytes]


def canonical_bytes(obj: Any) -> bytes:
    """Serializes a JSON value canonically, so equal content hashes the same.

    Args:
        obj: A JSON-compatible value. Floats must already be widened from f32.

    Returns:
        Sorted-key, compact, UTF-8 bytes without a trailing newline.

    Raises:
        ValueError: If a float is NaN or infinite.
    """
    return json.dumps(
        obj,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        allow_nan=False,
    ).encode("utf-8")


def _f(x: float) -> float:
    """Widens a value through float32, so the JSON hash is stable."""
    return float(np.float32(x))


def _fs(values: Iterable[float]) -> list[float]:
    """Widens each value through float32."""
    return [_f(v) for v in values]


def _body_json(body: core.Body) -> dict[str, Any]:
    """Returns a body's descriptor; ``mass`` only when it is known (> 0).

    A scene without masses thus keeps the bytes, and the hash, it had before
    bodies had a mass.
    """
    out: dict[str, Any] = {"name": body.name, "parent": body.parent}
    if body.mass > 0:
        out["mass"] = _f(body.mass)
    return out


def scene_to_json(
    scene: core.Scene,
    mesh_refs: Sequence[cas.Ref],
    texture_refs: Sequence[cas.Ref],
) -> dict[str, Any]:
    """Builds the JSON object of a scene descriptor.

    Args:
        scene: The scene.
        mesh_refs: References to the encoded mesh blobs, one per mesh.
        texture_refs: References to the texture blobs, one per texture.

    Returns:
        The descriptor as a JSON-compatible dict, with every float widened
        through float32.

    Raises:
        ValueError: If the reference counts do not match the scene.
    """
    if len(mesh_refs) != len(scene.meshes):
        raise ValueError("need one mesh ref per mesh")
    if len(texture_refs) != len(scene.textures):
        raise ValueError("need one texture ref per texture")
    return {
        "format": SCENE_FORMAT,
        "bodies": [_body_json(b) for b in scene.bodies],
        "geoms": [
            {
                "body": g.body,
                "kind": g.kind,
                "size": _fs(g.size),
                "pos": _fs(g.pos),
                "quat": _fs(g.quat),
                "scale": _fs(g.scale),
                "material": g.material,
                "mesh": g.mesh,
                "role": g.role,
                "name": g.name,
            }
            for g in scene.geoms
        ],
        "materials": [
            {
                "rgba": _fs(m.rgba),
                "metallic": _f(m.metallic),
                "roughness": _f(m.roughness),
                "texture": m.texture,
                "texrepeat": _fs(m.texrepeat),
            }
            for m in scene.materials
        ],
        "meshes": [
            {
                **ref.to_json(),
                "n_verts": len(mesh.vertices),
                "n_faces": len(mesh.faces),
            }
            for mesh, ref in zip(scene.meshes, mesh_refs, strict=True)
        ],
        "textures": [
            {
                **ref.to_json(),
                "media_type": t.media_type,
                "width": t.width,
                "height": t.height,
            }
            for t, ref in zip(scene.textures, texture_refs, strict=True)
        ],
    }


def put_scene(store: cas.ContentStore, scene: core.Scene) -> cas.Ref:
    """Stores a scene: raw mesh blobs, texture blobs, then the descriptor.

    Args:
        store: The content store of the library.
        scene: The scene to store.

    Returns:
        The reference of the canonical scene JSON under ``scenes/``. Equal
        scenes give equal references.
    """
    mesh_refs = [store.put(codecs.encode_mesh(m, "raw")) for m in scene.meshes]
    tex_refs = [store.put(t.data) for t in scene.textures]
    doc = scene_to_json(scene, mesh_refs, tex_refs)
    return store.put(canonical_bytes(doc), "scene")


def _check_format(doc: Mapping[str, Any]) -> None:
    """Rejects a descriptor with an unknown format string."""
    fmt = doc.get("format")
    if not isinstance(fmt, str) or not fmt.startswith("simscope-scene/"):
        raise errors.FormatError(f"not a scene descriptor: format={fmt!r}")
    if fmt.split("/", 1)[1].split(".")[0] != "1":
        raise errors.FormatError(f"unknown scene major version: {fmt!r}")


def scene_from_json(
    doc: Mapping[str, Any], get_asset: AssetGetter
) -> core.Scene:
    """Rebuilds a scene from its descriptor.

    Args:
        doc: The parsed descriptor.
        get_asset: Returns the bytes of a mesh or texture blob by reference.

    Returns:
        The scene. Meshes are decoded from their blobs (q16 meshes have no
        normals).

    Raises:
        errors.FormatError: If the descriptor or a blob is malformed.
    """
    _check_format(doc)
    try:
        bodies = tuple(
            core.Body(b["name"], int(b["parent"]), float(b.get("mass", 0.0)))
            for b in doc["bodies"]
        )
        geoms = tuple(
            core.Geom(
                body=int(g["body"]),
                kind=g["kind"],
                size=tuple(g["size"]),
                pos=tuple(g["pos"]),
                quat=tuple(g["quat"]),
                scale=tuple(g["scale"]),
                material=int(g["material"]),
                mesh=g["mesh"],
                role=g["role"],
                name=g.get("name", ""),
            )
            for g in doc["geoms"]
        )
        materials = tuple(
            core.Material(
                rgba=tuple(m["rgba"]),
                metallic=m["metallic"],
                roughness=m["roughness"],
                texture=m["texture"],
                texrepeat=tuple(m["texrepeat"]),
            )
            for m in doc["materials"]
        )
        meshes = tuple(
            codecs.decode_mesh(get_asset(cas.Ref.from_json(m)))
            for m in doc["meshes"]
        )
        textures = tuple(
            core.Texture(
                get_asset(cas.Ref.from_json(t)),
                t["media_type"],
                int(t["width"]),
                int(t["height"]),
            )
            for t in doc["textures"]
        )
        return core.Scene(bodies, geoms, materials, meshes, textures)
    except (KeyError, TypeError) as exc:
        raise errors.FormatError(
            f"malformed scene descriptor: {exc!r}"
        ) from exc


def load_scene(store: cas.ContentStore, ref: cas.Ref) -> core.Scene:
    """Loads a scene and its assets from a content store.

    Args:
        store: The content store of the library.
        ref: Reference of the scene JSON.

    Returns:
        The scene.

    Raises:
        errors.FormatError: If the scene or an asset is malformed.
        FileNotFoundError: If a referenced file is missing.
    """
    doc = json.loads(store.get(ref, "scene"))
    return scene_from_json(doc, store.get)
