import hashlib
import json

import numpy as np
import pytest

from simscope import core
from simscope.io import FormatError, cas, codecs, scene


def _mesh(seed=0, n=30):
    rng = np.random.default_rng(seed)
    return core.Mesh(
        rng.uniform(-1, 1, (n, 3)).astype(np.float32),
        rng.integers(0, n, (n, 3)).astype(np.uint32),
        rng.normal(size=(n, 3)).astype(np.float32),
        rng.uniform(0, 1, (n, 2)).astype(np.float32),
    )


def make_scene(seed=0):
    tex = core.Texture(b"\x89PNG-fake-bytes", "image/png", 4, 4)
    prims: list[tuple[core.GeomKind, core.Vec3]] = [
        ("box", (0.1, 0.2, 0.3)),
        ("sphere", (0.5, 0.0, 0.0)),
        ("capsule", (0.05, 0.2, 0.0)),
        ("cylinder", (0.05, 0.2, 0.0)),
        ("ellipsoid", (0.1, 0.2, 0.3)),
        ("plane", (0.0, 0.0, 1.0)),
    ]
    geoms = [core.Geom(1, k, size=s, name=k) for k, s in prims]
    geoms.append(
        core.Geom(
            1, "mesh", mesh=0, scale=(1.0, 2.0, 0.5), material=1, name="m0"
        )
    )
    geoms.append(
        core.Geom(2, "mesh", mesh=0, role="collision", pos=(0.1, 0.0, 0.0))
    )
    return core.Scene(
        bodies=(
            core.Body("world", -1),
            core.Body("torso", 0),
            core.Body("arm", 1),
        ),
        geoms=tuple(geoms),
        materials=(
            core.Material(),
            core.Material(
                rgba=(0.1, 0.2, 0.3, 0.5),
                metallic=0.3,
                roughness=0.7,
                texture=0,
                texrepeat=(2.0, 3.0),
            ),
        ),
        meshes=(_mesh(seed),),
        textures=(tex,),
    )


def test_canonical_bytes():
    out = scene.canonical_bytes({"b": [1, 2.5], "a": "é"})
    assert out == '{"a":"é","b":[1,2.5]}'.encode()
    with pytest.raises(ValueError):
        scene.canonical_bytes({"a": float("nan")})


def test_scene_hash_deterministic_and_matches_bytes(tmp_path):
    a = cas.ContentStore(tmp_path / "a")
    b = cas.ContentStore(tmp_path / "b")
    ra = scene.put_scene(a, make_scene())
    rb = scene.put_scene(b, make_scene())  # separately constructed, equal
    assert ra == rb
    data = a.path(ra, "scene").read_bytes()
    assert hashlib.sha256(data).hexdigest() == ra.sha256
    assert len(data) == ra.size
    assert a.path(ra, "scene").parent.name == ra.sha256[:2]
    assert a.path(ra, "scene").parent.parent.name == "scenes"
    assert not data.endswith(b"\n")
    assert scene.put_scene(a, make_scene()) == ra  # idempotent
    rc = scene.put_scene(a, make_scene(seed=1))  # different mesh
    assert rc != ra


def test_scene_json_content(tmp_path):
    store = cas.ContentStore(tmp_path)
    ref = scene.put_scene(store, make_scene())
    doc = json.loads(store.get(ref, "scene"))
    assert doc["format"] == "simscope-scene/1"
    assert len(doc["meshes"]) == 1  # shared by two geoms
    assert [g["mesh"] for g in doc["geoms"] if g["kind"] == "mesh"] == [0, 0]
    m = doc["meshes"][0]
    assert (m["n_verts"], m["n_faces"]) == (30, 30)
    assert store.has(cas.Ref.from_json(m))
    assert store.path(cas.Ref.from_json(m)).parts[-3] == "assets"
    t = doc["textures"][0]
    assert t["media_type"] == "image/png" and (t["width"], t["height"]) == (
        4,
        4,
    )
    assert store.get(cas.Ref.from_json(t)) == b"\x89PNG-fake-bytes"
    # f32 widening: 0.1 is stored as its float32 value.
    assert doc["materials"][1]["rgba"][0] == float(np.float32(0.1))
    assert list(doc) == sorted(doc)  # sorted keys


def test_scene_round_trip(tmp_path):
    store = cas.ContentStore(tmp_path)
    src = make_scene()
    ref = scene.put_scene(store, src)
    out = scene.load_scene(store, ref)
    assert out.bodies == src.bodies
    assert [g.kind for g in out.geoms] == [g.kind for g in src.geoms]
    assert out.geoms[6].mesh == out.geoms[7].mesh == 0
    assert out.geoms[6].scale == (1.0, 2.0, 0.5)
    assert out.geoms[7].role == "collision"
    assert out.materials[1].rgba == tuple(
        float(np.float32(v)) for v in (0.1, 0.2, 0.3, 0.5)
    )
    assert out.materials[1].texture == 0
    assert out.textures == src.textures
    m0, m1 = src.meshes[0], out.meshes[0]
    assert np.array_equal(m0.vertices, m1.vertices)
    assert np.array_equal(m0.faces, m1.faces)
    assert m0.normals is not None and m1.normals is not None
    assert m0.uvs is not None and m1.uvs is not None
    assert np.array_equal(m0.normals, m1.normals)
    assert np.array_equal(m0.uvs, m1.uvs)
    # Loading then re-storing yields the same hash.
    assert scene.put_scene(store, out) == ref


def test_load_scene_rejects_bad_format(tmp_path):
    store = cas.ContentStore(tmp_path)
    ref = store.put(scene.canonical_bytes({"format": "other/1"}), "scene")
    with pytest.raises(FormatError, match="not a scene"):
        scene.load_scene(store, ref)
    ref = store.put(
        scene.canonical_bytes({"format": "simscope-scene/2"}), "scene"
    )
    with pytest.raises(FormatError, match="major"):
        scene.load_scene(store, ref)
    ref = store.put(
        scene.canonical_bytes({"format": "simscope-scene/1"}), "scene"
    )
    with pytest.raises(FormatError, match="malformed"):
        scene.load_scene(store, ref)


# --- content store ------------------------------------------------------


def test_content_store_basics(tmp_path):
    store = cas.ContentStore(tmp_path)
    ref = store.put(b"hello")
    assert ref.sha256 == hashlib.sha256(b"hello").hexdigest()
    assert ref.size == 5
    p = store.path(ref)
    assert p == tmp_path / "assets" / ref.sha256[:2] / ref.sha256
    assert store.has(ref) and store.get(ref) == b"hello"
    mtime = p.stat().st_mtime_ns
    assert store.put(b"hello") == ref
    assert p.stat().st_mtime_ns == mtime  # write skipped
    assert not [q for q in p.parent.iterdir() if q.name.startswith(".tmp")]
    assert not store.has(cas.Ref("0" * 64, 1))


def test_content_store_size_and_verify(tmp_path):
    store = cas.ContentStore(tmp_path)
    ref = store.put(b"hello")
    with pytest.raises(FormatError, match="size mismatch"):
        store.get(cas.Ref(ref.sha256, 6))
    store.path(ref).write_bytes(b"jello")
    assert store.get(ref) == b"jello"
    with pytest.raises(FormatError, match="hash mismatch"):
        store.get(ref, verify=True)


def test_ref_json():
    ref = cas.Ref("ab" * 32, 7)
    assert ref.to_json() == {"sha256": "ab" * 32, "size": 7}
    assert cas.Ref.from_json({**ref.to_json(), "extra": 1}) == ref
    with pytest.raises(FormatError):
        cas.Ref.from_json({"sha256": "xyz", "size": 1})
    with pytest.raises(FormatError):
        cas.Ref.from_json({"size": 1})
    with pytest.raises(ValueError):
        cas.Ref("AB" * 32, 1)


def test_mesh_blob_is_raw_ssmh(tmp_path):
    store = cas.ContentStore(tmp_path)
    ref = scene.put_scene(store, make_scene())
    doc = json.loads(store.get(ref, "scene"))
    blob = store.get(cas.Ref.from_json(doc["meshes"][0]))
    assert blob[:4] == b"SSMH" and blob[20] == codecs.MESH_RAW
