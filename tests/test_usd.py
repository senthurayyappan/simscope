"""Tests for simscope.usd: a run as a USDZ stage for Blender."""

import importlib
import io
import struct
import types
import zipfile
import zlib
from typing import Any

import numpy as np
import pytest

from simscope import core, library, transforms, usd

DT = 0.02
ORIGINS = [[0.0, 0.0, 0.0], [5.0, -2.0, 0.0]]


def _png() -> bytes:
    """A 1 x 1 grey PNG."""

    def chunk(kind: bytes, data: bytes) -> bytes:
        body = kind + data
        crc = zlib.crc32(body) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + body + struct.pack(">I", crc)

    ihdr = struct.pack(">IIBBBBB", 1, 1, 8, 0, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(b"\x00\x80"))
        + chunk(b"IEND", b"")
    )


def make_scene() -> core.Scene:
    tri = core.Mesh(
        vertices=np.array([[0, 0, 0], [1, 0, 0], [0, 1, 0]], np.float32),
        faces=np.array([[0, 1, 2]], np.uint32),
        uvs=np.array([[0, 0], [1, 0], [0, 1]], np.float32),
    )
    return core.Scene(
        bodies=(
            core.Body("world"),
            core.Body("/World/robot/base", 0),
            core.Body("base", 1),  # the same name as the last element above
            core.Body("", 1),
        ),
        geoms=(
            core.Geom(0, "plane", size=(0.0, 0.0, 1.0), material=1),
            core.Geom(1, "box", size=(0.1, 0.2, 0.3), name="torso"),
            core.Geom(1, "capsule", size=(0.05, 0.2, 0.0), pos=(0, 0, 0.1)),
            core.Geom(
                1,
                "sphere",
                size=(0.1, 0, 0),
                quat=(0.0, 0.0, 0.70710677, 0.70710677),
                role="collision",
            ),
            core.Geom(2, "cylinder", size=(0.1, 0.3, 0.0), name="torso"),
            core.Geom(2, "ellipsoid", size=(0.1, 0.2, 0.3)),
            core.Geom(3, "mesh", mesh=0, material=2, scale=(2.0, 2.0, 2.0)),
            core.Geom(3, "mesh", mesh=0, material=2),
        ),
        materials=(
            core.Material(rgba=(0.8, 0.2, 0.2, 1.0)),
            core.Material(rgba=(0.5, 0.5, 0.5, 1.0), roughness=0.4),
            core.Material(texture=0, texrepeat=(3.0, 2.0)),
        ),
        meshes=(tri,),
        textures=(core.Texture(_png(), "image/png", 1, 1),),
    )


def make_poses(n: int, n_envs: int) -> np.ndarray:
    rng = np.random.default_rng(0)
    poses = np.zeros((n, n_envs, 4, 7), np.float32)
    poses[..., 6] = 1.0  # the world body stays at the origin
    pos = rng.normal(size=(n, n_envs, 3, 3)).cumsum(axis=0) * 0.01
    quat = rng.normal(scale=0.2, size=(n, n_envs, 3, 4))
    quat[..., 3] += 1.0
    quat /= np.linalg.norm(quat, axis=-1, keepdims=True)
    poses[:, :, 1:] = np.concatenate([pos, quat], axis=-1)
    return poses


def _record(root, name, n=12, n_envs=2):
    lib = library.Library(root)
    poses = make_poses(n, n_envs)
    with lib.record(
        name,
        scene=make_scene(),
        dt=DT,
        n_envs=n_envs,
        env_origins=ORIGINS[:n_envs] if n_envs <= 2 else None,
        block_frames=8,
    ) as rec:
        for t in range(n):
            rec.log(poses[t])
    lib.close()
    return poses


@pytest.fixture
def root(tmp_path):
    root = tmp_path / "lib"
    _record(root, "two")
    _record(root, "one", n_envs=1)
    return root


# -- shapes --


@pytest.mark.parametrize(
    "shape",
    [
        usd.unit_box(),
        usd.unit_sphere(),
        usd.unit_cylinder(),
        usd.capsule(0.05, 0.2),
    ],
    ids=["box", "sphere", "cylinder", "capsule"],
)
def test_shapes_face_outwards(shape):
    p = shape.points.astype(np.float64)
    a, b, c = (p[shape.faces[:, k]] for k in range(3))
    face_n = np.cross(b - a, c - a)
    assert np.all(np.linalg.norm(face_n, axis=1) > 0)  # no degenerate faces
    centre = (a + b + c) / 3
    assert np.all(np.sum(face_n * centre, axis=1) > 0)  # convex, about 0
    vertex_n = shape.normals[shape.faces].mean(axis=1)
    assert np.all(np.sum(face_n * vertex_n, axis=1) > 0)
    assert np.allclose(np.linalg.norm(shape.normals, axis=1), 1, atol=1e-6)


def test_shape_sizes_match_the_viewer():
    assert np.allclose(np.abs(usd.unit_box().points), 0.5)
    assert np.allclose(np.linalg.norm(usd.unit_sphere().points, axis=1), 1)
    z = usd.unit_cylinder().points[:, 2]
    assert z.min() == -1 and z.max() == 1
    z = usd.capsule(0.05, 0.2).points[:, 2]
    assert np.isclose(z.min(), -0.25) and np.isclose(z.max(), 0.25)


def test_vertex_normals_are_area_weighted():
    points = np.array(
        [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]], dtype=np.float32
    )
    faces = np.array([[0, 2, 1], [0, 1, 3]])
    n = usd.vertex_normals(points, faces)
    assert np.allclose(n[2], (0, 0, -1)) and np.allclose(n[3], (0, -1, 0))
    assert np.allclose(n[0], np.array([0, -1, -1]) / np.sqrt(2))


def test_prim_names():
    used: set[str] = set()
    assert usd.prim_name("/World/env_0/Robot/base", used, "x") == "base"
    assert usd.prim_name("base", used, "x") == "base_1"
    assert usd.prim_name("plane_-1", used, "x") == "plane_1"
    assert usd.prim_name("2nd link", used, "x") == "_2nd_link"
    assert usd.prim_name("", used, "body_3") == "body_3"
    assert usd.prim_name("ü", used, "geom_0") == "geom_0"


# -- the package --


def test_usdz_is_stored_aligned_and_starts_with_the_stage(root, tmp_path):
    out = usd.export_usd(root, "two", tmp_path / "out" / "two.usdz")
    data = out.read_bytes()
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        infos = zf.infolist()
        assert [i.filename for i in infos] == ["scene.usda", "textures/t0.png"]
        for info in infos:
            assert info.compress_type == zipfile.ZIP_STORED
            name_len, extra_len = struct.unpack_from(
                "<HH", data, info.header_offset + 26
            )
            start = info.header_offset + 30 + name_len + extra_len
            assert start % usd.ALIGN == 0
            assert data[start : start + info.file_size] == zf.read(info)
        text = zf.read("scene.usda").decode()
    assert text.startswith("#usda 1.0\n")
    assert 'upAxis = "Z"' in text and "timeCodesPerSecond = 50" in text
    assert "endTimeCode = 11" in text
    assert 'def Xform "env_0"' in text and 'def Xform "env_1"' in text
    assert usd.export_usd(
        root, "two", tmp_path / "again.usdz"
    ).read_bytes() == (data)


def test_one_env_puts_bodies_under_world(root, tmp_path):
    out = usd.export_usd(root, "one", tmp_path / "one.usdz")
    with zipfile.ZipFile(out) as zf:
        text = zf.read("scene.usda").decode()
    assert "env_0" not in text
    assert '    def Xform "base"' in text and '    def Xform "base_1"' in text


def test_env_subsets(root, tmp_path, monkeypatch):
    out = usd.export_usd(root, "two", tmp_path / "a.usdz", envs=[1])
    with zipfile.ZipFile(out) as zf:
        text = zf.read("scene.usda").decode()
    assert 'def Xform "env_1"' in text and "env_0" not in text
    with pytest.raises(ValueError, match="envs"):
        usd.export_usd(root, "two", tmp_path / "b.usdz", envs=[2])
    with pytest.raises(ValueError, match="repeat"):
        usd.export_usd(root, "two", tmp_path / "b.usdz", envs=[0, 0])
    monkeypatch.setattr(usd, "MAX_ENVS", 1)
    with pytest.raises(ValueError, match="pick up to 1"):
        usd.export_usd(root, "two", tmp_path / "b.usdz")
    assert usd.export_usd(root, "two", tmp_path / "c.usdz", envs=[0]).exists()


def test_missing_and_recording_runs(root, tmp_path):
    with pytest.raises(FileNotFoundError):
        usd.export_usd(root, "ghost", tmp_path / "x.usdz")
    lib = library.Library(root)
    rec = lib.record("live", scene=make_scene(), dt=DT, block_frames=4)
    try:
        for pose in make_poses(8, 1):
            rec.log(pose)
        with pytest.raises(ValueError, match="recording"):
            usd.export_usd(root, "live", tmp_path / "x.usdz")
    finally:
        rec.close()
        lib.close()


# -- read back with USD --


@pytest.fixture
def pxr() -> Any:
    """The USD modules the read-back test uses; skips without usd-core."""
    pytest.importorskip("pxr")
    names = ("Usd", "UsdGeom", "UsdShade", "UsdValidation")
    return types.SimpleNamespace(
        **{n: importlib.import_module(f"pxr.{n}") for n in names}
    )


def test_usd_reads_the_stage(root, tmp_path, pxr):

    poses = make_poses(12, 2)
    out = usd.export_usd(root, "two", tmp_path / "two.usdz")
    stage = pxr.Usd.Stage.Open(str(out))
    assert pxr.UsdGeom.GetStageUpAxis(stage) == "Z"
    assert pxr.UsdGeom.GetStageMetersPerUnit(stage) == 1
    assert stage.GetTimeCodesPerSecond() == 50
    assert (stage.GetStartTimeCode(), stage.GetEndTimeCode()) == (0, 11)
    assert stage.GetDefaultPrim().GetPath() == "/World"

    validators = pxr.UsdValidation.ValidationRegistry().GetOrLoadAllValidators()
    errors = pxr.UsdValidation.ValidationContext(validators).Validate(stage)
    assert [e.GetMessage() for e in errors] == []

    # Bodies land where the run put them, env origin included.
    for t in (0, 5, 11):
        cache = pxr.UsdGeom.XformCache(t)
        for env in (0, 1):
            prim = stage.GetPrimAtPath(f"/World/env_{env}/base_1")
            m = cache.GetLocalToWorldTransform(prim)
            want = poses[t, env, 2]
            got = np.array(m.ExtractTranslation())
            assert np.allclose(got, want[:3] + ORIGINS[env], atol=1e-5)
            q = m.ExtractRotationQuat()
            got_q = np.array([*q.GetImaginary(), q.GetReal()])
            assert (
                min(
                    np.abs(got_q - want[3:]).max(),
                    np.abs(got_q + want[3:]).max(),
                )
                < 1e-5
            )

    # A geom's points, in the world, are its body's pose times its own.
    box = pxr.UsdGeom.Mesh(stage.GetPrimAtPath("/World/env_0/base/torso"))
    corner = box.GetPointsAttr().Get()[0]
    m = pxr.UsdGeom.XformCache(3).GetLocalToWorldTransform(box.GetPrim())
    world = np.array(m.Transform(corner))
    base = poses[3, 0, 1]
    local = np.array(corner) * (0.2, 0.4, 0.6)
    want = transforms.quat_rotate(base[3:], local) + base[:3]
    assert np.allclose(world, want, atol=1e-5)

    sphere = stage.GetPrimAtPath("/World/env_0/base/sphere_3")
    assert pxr.UsdGeom.Imageable(sphere).ComputePurpose() == "guide"
    assert pxr.UsdGeom.Imageable(box.GetPrim()).ComputePurpose() == "default"

    # The plane covers every body of its env, with a margin.
    plane = pxr.UsdGeom.Mesh(stage.GetPrimAtPath("/World/env_1/world/plane_0"))
    half = np.array(plane.GetPointsAttr().Get())[:, :2].max()
    assert half >= np.abs(poses[:, 1, :, :2] + ORIGINS[1][:2]).max() + 2

    # Shared meshes are one prototype, and the textured one finds its image.
    mesh = stage.GetPrimAtPath("/World/env_0/body_3/mesh_6")
    assert len(pxr.UsdGeom.Mesh(mesh).GetPointsAttr().Get()) == 3
    material, _ = pxr.UsdShade.MaterialBindingAPI(mesh).ComputeBoundMaterial()
    assert material.GetPath() == "/World/Looks/M2"
    tex = pxr.UsdShade.Shader(stage.GetPrimAtPath("/World/Looks/M2/Texture"))
    path = tex.GetInput("file").Get()
    assert path.resolvedPath.endswith("[textures/t0.png]")
    assert stage.GetPrimAtPath("/World/Prototypes").IsAbstract()
    meshes = [p for p in stage.Traverse() if p.IsA(pxr.UsdGeom.Mesh)]
    assert all("Prototypes" not in str(p.GetPath()) for p in meshes)
    assert len(meshes) == 2 * 8
