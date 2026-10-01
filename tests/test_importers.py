import base64
import gzip
import json
import os
import pathlib
import struct
import zlib

import numpy as np
import pytest

from simscope import importers, library, transforms


def rotmat_wxyz(q):
    """Independent wxyz quaternion -> matrix (not using simscope code)."""
    w, x, y, z = np.asarray(q, dtype=np.float64) / np.linalg.norm(q)
    return np.array(
        [
            [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
            [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
            [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
        ]
    )


def unit(rng, n):
    q = rng.normal(size=(n, 4))
    return q / np.linalg.norm(q, axis=-1, keepdims=True)


def world_point(lib_run, geom_idx, body_idx, frame, point):
    """World position of a geom-local point, from the stored library."""
    scene = lib_run.scene
    g = scene.geoms[geom_idx]
    poses = lib_run.frame_source().read(frame, frame + 1)[0, 0]
    body = poses[body_idx].astype(np.float64)
    gp = np.concatenate([g.pos, g.quat]).astype(np.float64)
    wp = transforms.compose_poses(body, gp)
    return wp[:3] + transforms.quat_rotate(wp[3:], np.asarray(point, float))


# -- .rbundle --

CUBE_V = np.array(
    [[x, y, z] for x in (0, 1) for y in (0, 1) for z in (0, 1)], np.float32
)
CUBE_F = np.array(
    [[0, 1, 3], [0, 3, 2], [4, 6, 7], [4, 7, 5], [0, 4, 5], [0, 5, 1]],
    np.uint32,
)


def make_rbundle(path, *, compress=True, n_frames=6, seed=0):
    rng = np.random.default_rng(seed)
    n_bodies = 3
    pos = rng.normal(size=(n_frames, n_bodies, 3)).astype(np.float32)
    quat = unit(rng, n_frames * n_bodies).reshape(n_frames, n_bodies, 4)
    quat = quat.astype(np.float32)
    forces = rng.normal(size=(n_frames, 2, 2, 3)).astype(np.float32)
    forces[2, 1] = np.nan
    preds = rng.normal(size=(n_frames, 4, 2, 3)).astype(np.float32)
    tail = bytearray()

    def put(arr):
        off = len(tail)
        tail.extend(np.ascontiguousarray(arr).tobytes())
        return {
            "off": off,
            "count": int(arr.size),
            "shape": list(arr.shape),
            "dtype": "f32",
        }

    buffers = {
        "body_pos": put(pos),
        "body_quat": put(quat),
        "forces": put(forces),
        "predictions": put(preds),
    }
    geoms = []

    def geom(name, body, kind, size, rgba=(0.5, 0.5, 0.5, 1.0), **kw):
        q = unit(rng, 1)[0]
        g = {
            "name": name,
            "body": body,
            "type": kind,
            "size": list(size),
            "rgba": list(rgba),
            "group": 0,
            "is_collision": kw.pop("is_collision", False),
            "local_pos": [0.1 * body + 0.2, -0.3, 0.4],
            "local_quat": q.tolist(),
        }
        g.update(kw)
        geoms.append(g)

    geom("floor", 0, "plane", (0, 0, 0.05))
    geom("box", 1, "box", (0.1, 0.2, 0.3))
    geom("ball", 1, "sphere", (0.15, 0, 0))
    geom("cap", 2, "capsule", (0.05, 0.2, 0), is_collision=True)
    geom("cyl", 2, "cylinder", (0.06, 0.25, 0))
    geom("ell", 2, "ellipsoid", (0.1, 0.2, 0.3))
    for i, body in enumerate((1, 2)):  # the same mesh twice, two bodies
        v = put(CUBE_V * 0.5)
        f = put(CUBE_F.view(np.uint32))
        f["dtype"] = "u32"
        geom(
            f"mesh{i}",
            body,
            "mesh",
            (0.5, 0.5, 0.5),
            mesh={
                "verts_off": v["off"],
                "verts_count": v["count"],
                "faces_off": f["off"],
                "faces_count": f["count"],
            },
        )
    header = {
        "format_version": 2,
        "meta": {
            "dt": 0.02,
            "fps": 50.0,
            "n_frames": n_frames,
            "n_bodies": n_bodies,
            "robot_mass_kg": 10.0,
        },
        "force_labels": ["a", "b"],
        "geoms": geoms,
        "buffers": buffers,
    }
    if compress:
        header["compression"] = "gzip"
    hjson = json.dumps(header).encode()
    hjson += b" " * ((-(12 + len(hjson))) % 8)
    body = gzip.compress(bytes(tail)) if compress else bytes(tail)
    path.write_bytes(b"RBDL" + struct.pack("<Q", len(hjson)) + hjson + body)
    return {"pos": pos, "quat": quat, "forces": forces, "geoms": geoms}


@pytest.fixture
def lib(tmp_path):
    return library.Library(tmp_path / "lib")


@pytest.mark.parametrize("compress", [True, False])
def test_rbundle_roundtrip(lib, tmp_path, compress):
    src = make_rbundle(tmp_path / "rollout.rbundle", compress=compress)
    (tmp_path / "config.json").write_text('{"seed": 3}', encoding="utf-8")
    name = importers.import_rbundle(
        lib, tmp_path / "rollout.rbundle", tags=["x"]
    )
    assert name == tmp_path.name
    with lib.open(name) as run:
        m = run.manifest
        assert (m.n_frames, m.n_bodies, m.dt) == (6, 3, pytest.approx(0.02))
        assert set(m.tags) == {"x", "source:rbundle"}
        assert m.source["importer"] == "rbundle"
        assert m.source["simulator"] == "mujoco"
        assert m.meta["config"] == {"seed": 3}
        scene = run.scene
        assert [g.kind for g in scene.geoms] == [
            "plane", "box", "sphere", "capsule", "cylinder", "ellipsoid",
            "mesh", "mesh",
        ]  # fmt: skip
        assert scene.geoms[3].role == "collision"
        assert scene.geoms[1].size == pytest.approx((0.1, 0.2, 0.3))
        assert scene.geoms[0].size == pytest.approx((0, 0, 0.05))
        assert len(scene.meshes) == 1  # identical meshes are merged
        assert scene.geoms[6].mesh == scene.geoms[7].mesh == 0
        poses = run.frame_source().read(0, 6)[:, 0]
    np.testing.assert_allclose(poses[..., :3], src["pos"], atol=1e-6)
    q = poses[..., 3:]
    w = src["quat"]
    sign = np.sign(np.sum(q * w[..., [1, 2, 3, 0]], -1, keepdims=True))
    np.testing.assert_allclose(q * sign, w[..., [1, 2, 3, 0]], atol=1e-6)


def test_rbundle_world_pose_matches_source_transform(lib, tmp_path):
    src = make_rbundle(tmp_path / "a.rbundle", seed=4)
    name = importers.import_rbundle(lib, tmp_path / "a.rbundle")
    point = np.array([0.3, -0.7, 0.2])
    with lib.open(name) as run:
        for frame in (0, 2, 5):
            for gi in (1, 3, 5, 7):
                g = src["geoms"][gi]
                rb = rotmat_wxyz(src["quat"][frame, g["body"]])
                rg = rotmat_wxyz(g["local_quat"])
                want = src["pos"][frame, g["body"]] + rb @ (
                    np.array(g["local_pos"]) + rg @ point
                )
                got = world_point(run, gi, g["body"], frame, point)
                np.testing.assert_allclose(got, want, atol=2e-6)


def test_rbundle_streams(lib, tmp_path):
    src = make_rbundle(tmp_path / "a.rbundle")
    name = importers.import_rbundle(lib, tmp_path / "a.rbundle")
    with lib.open(name) as run:
        info = run.manifest.streams
        assert "forces" not in info
        assert info["contacts"].kind == "arrows"
        assert info["contacts"].item_shape == (2, 6)
        assert info["contacts"].units == "N"
        assert info["contacts"].scale == pytest.approx(1 / (10.0 * 9.81))
        assert info["predictions_0"].kind == "polyline"
        assert info["predictions_1"].item_shape == (4, 3)
        arrows = run.stream("contacts").read(0, 6)[:, 0]
    np.testing.assert_allclose(
        arrows[0], src["forces"][0].reshape(2, 6), atol=1e-6
    )
    assert np.all(arrows[2, 1] == 0)  # NaN (inactive foot) -> zero arrow


def test_rbundle_names_are_unique_and_valid(lib, tmp_path):
    folder = tmp_path / "my run (1)"
    folder.mkdir()
    make_rbundle(folder / "rollout.rbundle")
    a = importers.import_rbundle(lib, folder / "rollout.rbundle")
    b = importers.import_rbundle(lib, folder / "rollout.rbundle")
    assert (a, b) == ("my_run_1", "my_run_1-2")
    c = importers.import_rbundle(
        lib, folder / "rollout.rbundle", name="a", overwrite=True
    )
    d = importers.import_rbundle(
        lib, folder / "rollout.rbundle", name="a", overwrite=True
    )
    assert c == d == "a"


def test_rbundle_rejects_junk(lib, tmp_path):
    (tmp_path / "x.rbundle").write_bytes(b"NOPE" + bytes(20))
    with pytest.raises(importers.ImportFormatError):
        importers.import_rbundle(lib, tmp_path / "x.rbundle")


# -- Brax HTML --


def make_brax(path, *, n_frames=5, seed=1, n_links=2):
    rng = np.random.default_rng(seed)
    pos = rng.normal(size=(n_frames, n_links, 3))
    quat = unit(rng, n_frames * n_links).reshape(n_frames, n_links, 4)

    def geom(kind, link, size, **kw):
        g = {
            "name": kind,
            "link_idx": link,
            "pos": rng.normal(size=3).tolist(),
            "rot": unit(rng, 1)[0].tolist(),
            "rgba": [0.1, 0.2, 0.3, 1.0],
            "size": list(size),
        }
        g.update(kw)
        return g

    cube = {"vert": CUBE_V.tolist(), "face": CUBE_F.tolist()}
    system = {
        "opt": {"timestep": 0.05, "name": "Option"},
        "link_names": ["torso", "arm"][:n_links],
        "name": "System",
        "geoms": {
            "world": [
                geom("Plane", -1, (0, 0, 0.05)),
                geom("Box", -1, (0.3, 0.4, 0.5)),
            ],
            "torso": [
                geom("Sphere", 0, (0.2, 0, 0)),
                geom("Mesh", 0, (0.5, 0.5, 0.5), **cube),
            ],
            "arm": [
                geom("Capsule", 1, (0.05, 0.3, 0)),
                geom("Cylinder", 1, (0.04, 0.2, 0)),
                geom("Mesh", 1, (0.5, 0.5, 0.5), **cube),
                geom("HeightMap", 1, (1, 1, 1)),
            ],
        },
        "states": {
            "x": [
                {
                    "pos": pos[t].tolist(),
                    "rot": quat[t].tolist(),
                    "name": "Transform",
                }
                for t in range(n_frames)
            ],
        },
    }
    blob = base64.b64encode(zlib.compress(json.dumps(system).encode()))
    path.write_bytes(
        b"<html><head><title>Brax visualizer</title></head><script>\n"
        b'var system = "' + blob + b'"\n</script></html>'
    )
    return system, pos, quat


def test_brax_roundtrip_and_world_pose(lib, tmp_path):
    system, pos, quat = make_brax(tmp_path / "v.html")
    name = importers.import_brax_html(lib, tmp_path / "v.html", tags=["t"])
    assert name == "v"
    with lib.open(name) as run:
        m = run.manifest
        assert (m.n_frames, m.n_bodies) == (5, 3)
        assert m.dt == pytest.approx(0.05)
        assert set(m.tags) == {"t", "source:brax"}
        assert m.source["importer"] == "brax"
        assert m.meta["brax"]["title"] == "Brax visualizer"
        scene = run.scene
        assert [b.name for b in scene.bodies] == ["world", "torso", "arm"]
        kinds = [g.kind for g in scene.geoms]
        assert kinds == [
            "plane",
            "box",
            "sphere",
            "mesh",
            "capsule",
            "cylinder",
            "mesh",
        ]  # fmt: skip  (HeightMap is skipped)
        assert [g.body for g in scene.geoms] == [0, 0, 1, 1, 2, 2, 2]
        assert len(scene.meshes) == 1
        assert scene.geoms[5].size == pytest.approx((0.04, 0.2, 0))
        assert scene.geoms[1].size == pytest.approx((0.3, 0.4, 0.5))
        poses = run.frame_source().read(0, 5)[:, 0]
        np.testing.assert_allclose(poses[:, 0, :3], 0)  # world is fixed
        np.testing.assert_allclose(poses[:, 0, 6], 1)
        point = np.array([0.25, -0.5, 0.75])
        flat = [g for gs in system["geoms"].values() for g in gs]
        for frame in (0, 2, 4):
            for gi, src_i in ((2, 2), (3, 3), (5, 5), (6, 6)):
                g = flat[src_i]
                link = g["link_idx"]
                rb = rotmat_wxyz(quat[frame, link])
                rg = rotmat_wxyz(g["rot"])
                want = pos[frame, link] + rb @ (np.array(g["pos"]) + rg @ point)
                got = world_point(run, gi, link + 1, frame, point)
                np.testing.assert_allclose(got, want, atol=2e-6)


def test_brax_rounded_quaternions_are_normalized(lib, tmp_path):
    system, _, _ = make_brax(tmp_path / "v.html")
    for s in system["states"]["x"]:
        s["rot"] = [[round(c, 3) for c in q] for q in s["rot"]]
    blob = base64.b64encode(zlib.compress(json.dumps(system).encode()))
    (tmp_path / "r.html").write_bytes(b'var system = "' + blob + b'"')
    name = importers.import_brax_html(lib, tmp_path / "r.html")
    with lib.open(name) as run:
        q = run.frame_source().read(0, 5)[..., 3:]
    np.testing.assert_allclose(np.linalg.norm(q, axis=-1), 1, atol=1e-6)


def test_import_path_sniffs_and_walks(lib, tmp_path):
    src = tmp_path / "in"
    (src / "sub").mkdir(parents=True)
    make_rbundle(src / "sub" / "rollout.rbundle")
    make_brax(src / "b.html")
    (src / "other.html").write_text("<html>hello</html>", encoding="utf-8")
    (src / "note.txt").write_text("x", encoding="utf-8")
    names = importers.import_path(lib, src, tags=["all"])
    assert sorted(names) == ["b", "sub"]
    assert {r.name for r in lib.runs()} == {"b", "sub"}
    assert importers.import_path(lib, src / "b.html") == ["b-2"]
    with pytest.raises(importers.ImportFormatError):
        importers.import_path(lib, src / "other.html")
    with pytest.raises(FileNotFoundError):
        importers.import_path(lib, src / "missing")


def asset_count(lib):
    return len([p for p in (lib.root / "assets").rglob("*") if p.is_file()])


def test_meshes_are_shared_across_runs(lib, tmp_path):
    make_brax(tmp_path / "a.html", seed=1)
    make_brax(tmp_path / "b.html", seed=2)
    importers.import_brax_html(lib, tmp_path / "a.html")
    assert asset_count(lib) == 1
    importers.import_brax_html(lib, tmp_path / "b.html")
    assert asset_count(lib) == 1


def test_real_files_share_meshes(tmp_path):
    home = pathlib.Path.home()
    rb = sorted((home / "Projects/dial-mpc/artifacts").rglob("rollout.rbundle"))
    bx = sorted(
        (home / "Projects/barkour-bench/slides/dmpc-vault-2026-09/assets").glob(
            "a*_cad_*.html"
        )
    )
    if len(rb) < 2 or len(bx) < 2:
        pytest.skip("real rollout files are not available")
    lib = library.Library(tmp_path / "real")
    a = importers.import_rbundle(lib, rb[0])
    n_first = asset_count(lib)
    b = importers.import_rbundle(lib, rb[1])
    assert asset_count(lib) == n_first  # the same robot: all meshes shared
    c = importers.import_brax_html(lib, bx[0])
    n_brax = asset_count(lib)
    d = importers.import_brax_html(lib, bx[1])
    assert asset_count(lib) == n_brax  # same CAD meshes: nothing new
    runs = {r.name: r for r in lib.runs()}
    assert set(runs) == {a, b, c, d}
    for n in (a, b):
        assert runs[n].n_frames in (4, 11)
    assert runs[c].n_frames == 100
    scenes = {lib.open(n).manifest.scene.sha256 for n in (a, b, c, d)}
    assert len(scenes) <= 3  # the two rbundles of one robot share a scene


def test_contact_scale_estimates_weight_without_mass():
    arrows = np.zeros((50, 2, 6), np.float32)
    arrows[:, :, 5] = 200.0  # two feet share a 400 N load
    assert importers._force_scale(arrows, {}) == pytest.approx(1 / 400.0)
    assert importers._force_scale(arrows, {"total_mass_kg": 20}) == (
        pytest.approx(1 / (20 * 9.81))
    )
    flying = np.zeros((5, 2, 6), np.float32)
    assert importers._force_scale(flying, {}) == pytest.approx(1 / 9.81)


@pytest.mark.parametrize(
    ("rel", "expected"),
    [
        ("20260911-132437_brax_visualization.html", "2026-09-11T13:24:37Z"),
        (
            "crate-20260910T005846895277Z/rollout.rbundle",
            "2026-09-10T00:58:46Z",
        ),
        ("x-20260910T003813Z/rollout.rbundle", "2026-09-10T00:38:13Z"),
    ],
)
def test_recorded_time_reads_the_stamp_in_the_name(tmp_path, rel, expected):
    path = tmp_path / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("x", encoding="utf-8")
    assert importers.recorded_time(path) == expected


def test_recorded_time_falls_back_to_the_file_mtime(tmp_path):
    path = tmp_path / "plain.html"
    path.write_text("x", encoding="utf-8")
    os.utime(path, (1_757_500_000, 1_757_500_000))
    assert importers.recorded_time(path) == "2025-09-10T10:26:40Z"
