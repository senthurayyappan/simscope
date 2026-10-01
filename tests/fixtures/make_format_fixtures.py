"""Writes golden format-v1 files to ``tests/fixtures/format/``.

Run ``uv run python tests/fixtures/make_format_fixtures.py``. The output is
deterministic. ``expected.json`` holds the decoded values so that the
JavaScript player can be tested against the same files.
"""

import json
import pathlib
import shutil
import tempfile

import numpy as np

from simscope import core, transforms
from simscope.io import blockfile, cas, codecs, manifest, pack, scene

OUT_DIR = pathlib.Path(__file__).parent / "format"
FIXED_TIME = "2026-09-30T12:00:00Z"


def _f(a: np.ndarray | None) -> list:
    """Flattens float32 values to a JSON list of exact float values."""
    assert a is not None
    return [float(v) for v in np.asarray(a, np.float32).reshape(-1)]


def _bits(a: np.ndarray) -> list[int]:
    """Flattens float32 values to their uint32 bit patterns."""
    return np.asarray(a, np.float32).reshape(-1).view(np.uint32).tolist()


def make_mesh() -> core.Mesh:
    """Builds a small deterministic UV sphere with normals and uvs."""
    n_lat, n_lon = 4, 6
    lat = np.linspace(0.15, np.pi - 0.15, n_lat)
    lon = np.linspace(0, 2 * np.pi, n_lon, endpoint=False)
    la, lo = np.meshgrid(lat, lon, indexing="ij")
    unit = np.stack(
        [np.sin(la) * np.cos(lo), np.sin(la) * np.sin(lo), np.cos(la)], -1
    ).reshape(-1, 3)
    faces = []
    for i in range(n_lat - 1):
        for j in range(n_lon):
            a = i * n_lon + j
            b = i * n_lon + (j + 1) % n_lon
            faces += [(a, b, a + n_lon), (b, b + n_lon, a + n_lon)]
    uvs = np.stack([lo.reshape(-1) / (2 * np.pi), la.reshape(-1) / np.pi], -1)
    return core.Mesh(
        (unit * 0.5 + np.array([0.1, -0.2, 0.3])).astype(np.float32),
        np.array(faces, np.uint32),
        unit.astype(np.float32),
        uvs.astype(np.float32),
    )


def make_pose(n: int, envs: int, bodies: int, seed: int) -> np.ndarray:
    """Builds smooth, unit-quaternion poses of shape ``[n, envs, B, 7]``."""
    rng = np.random.default_rng(seed)
    t = np.arange(n, dtype=np.float64)[:, None, None, None] * 0.02
    pos = np.sin(
        t * rng.uniform(1, 3, (1, envs, bodies, 3))
        + rng.uniform(0, 6, (1, envs, bodies, 3))
    )
    axis = rng.normal(size=(1, envs, bodies, 3))
    axis /= np.linalg.norm(axis, axis=-1, keepdims=True)
    ang = t * rng.uniform(2, 6, (1, envs, bodies, 1))
    quat = np.concatenate([axis * np.sin(ang / 2), np.cos(ang / 2)], -1)
    pose = np.concatenate([pos, quat], -1).astype(np.float32)
    return transforms.enforce_sign_continuity(pose)


def make_scene(mesh: core.Mesh, extra: core.Geom) -> core.Scene:
    """Builds a scene with one shared mesh geom and one primitive."""
    return core.Scene(
        bodies=(
            core.Body("world", -1),
            core.Body("torso", 0),
            core.Body("arm", 1),
        ),
        geoms=(
            core.Geom(1, "mesh", mesh=0, scale=(1.0, 1.0, 1.0), name="body"),
            extra,
        ),
        materials=(core.Material(), core.Material(rgba=(0.2, 0.4, 0.8, 1.0))),
        meshes=(mesh,),
    )


def _write_run(root, name, run_id, scene_ref, envs, n, seed):
    """Writes one run (manifest plus body_pose and reward streams)."""
    run_dir = root / "runs" / name
    run_dir.mkdir(parents=True)
    pose = make_pose(n, envs, 3, seed)
    reward = np.cumsum(np.full((n, envs), 0.1, np.float32), axis=0)
    for fname, kind, data in (
        ("body_pose.blk", "pose", pose),
        ("reward.blk", "scalar", reward),
    ):
        with blockfile.BlockWriter(
            run_dir / fname,
            item_shape=data.shape[2:],
            n_envs=envs,
            kind=kind,
            block_frames=10,
        ) as w:
            w.append(data)
    man = manifest.RolloutManifest(
        id=run_id,
        name=name,
        created=FIXED_TIME,
        dt=0.02,
        n_frames=n,
        n_envs=envs,
        n_bodies=3,
        scene=scene_ref,
        streams={
            "body_pose": manifest.StreamInfo("body_pose.blk", "pose", (3, 7)),
            "reward": manifest.StreamInfo("reward.blk", "scalar", ()),
        },
        env_origins=tuple((float(e), 0.0, 0.0) for e in range(envs)),
        source={"simulator": "mujoco", "version": "3.14.0"},
        tags=("fixture",),
    )
    manifest.write_manifest(run_dir, man, partial=False)


def build_library(root: pathlib.Path) -> tuple[str, str]:
    """Builds a two-run library whose scenes share one mesh.

    Args:
        root: Library directory to create.

    Returns:
        The two run names.
    """
    store = cas.ContentStore(root)
    mesh = make_mesh()
    ref_a = scene.put_scene(
        store, make_scene(mesh, core.Geom(2, "box", size=(0.1, 0.2, 0.3)))
    )
    ref_b = scene.put_scene(
        store, make_scene(mesh, core.Geom(2, "sphere", size=(0.25, 0, 0)))
    )
    _write_run(root, "run_a", "01J9Z3AAAAAAAAAAAAAAAAAAAA", ref_a, 2, 25, 11)
    _write_run(root, "run_b", "01J9Z3BBBBBBBBBBBBBBBBBBBB", ref_b, 1, 12, 12)
    return "run_a", "run_b"


def _write_stream_fixture(name, data, kind, codec, expected):
    """Writes one standalone block file and records its expected values."""
    path = OUT_DIR / name
    envs = data.shape[1]
    with blockfile.BlockWriter(
        path,
        item_shape=data.shape[2:],
        n_envs=envs,
        kind=kind,
        codec=codec,
        block_frames=10,
    ) as w:
        w.append(data)
    with blockfile.BlockReader(path, kind=kind) as r:
        out = r.read(0, r.n_frames)
        expected.update(
            file=name,
            kind=kind,
            n_frames=r.n_frames,
            n_envs=r.n_envs,
            item_shape=list(r.item_shape),
            block_frames=r.block_frames,
            codecs=r.directory["codec"].tolist(),
        )
    return out


def main() -> None:
    """Regenerates all fixtures."""
    if OUT_DIR.exists():
        shutil.rmtree(OUT_DIR)
    OUT_DIR.mkdir(parents=True)
    expected: dict = {"version": 1, "order": "[t][env][item...] row-major"}

    # f32s: special values, 2 envs, short last block.
    rng = np.random.default_rng(1)
    x = rng.normal(size=(25, 2, 2, 3)).astype(np.float32).cumsum(0)
    x[1, 0, 0, 0] = np.nan
    x[2, 1, 1, 2] = np.inf
    x[3, 0, 1, 1] = -np.inf
    x[4, 1, 0, 1] = -0.0
    e: dict = {}
    out = _write_stream_fixture("f32s.blk", x, "points", "f32s", e)
    assert out.view(np.uint32).tobytes() == x.view(np.uint32).tobytes()
    e["bits"] = _bits(out)
    expected["f32s"] = e

    # q16d pose, 3 envs, short last block (25 = 10 + 10 + 5).
    pose = make_pose(25, 3, 2, 5)
    e = {}
    out = _write_stream_fixture("q16d.blk", pose, "pose", "q16d", e)
    with blockfile.BlockReader(OUT_DIR / "q16d.blk") as r:
        raw = r.read(0, r.n_frames)  # not renormalized
    e["values_raw"] = _f(raw)
    e["values_renormalized"] = _f(out)
    e["max_abs_error_bound"] = 1e-3
    expected["q16d"] = e

    # Meshes.
    mesh = make_mesh()
    (OUT_DIR / "mesh_raw.ssmh").write_bytes(codecs.encode_mesh(mesh, "raw"))
    (OUT_DIR / "mesh_q16.ssmh").write_bytes(codecs.encode_mesh(mesh, "q16"))
    dq = codecs.decode_mesh((OUT_DIR / "mesh_q16.ssmh").read_bytes())
    expected["mesh_raw"] = {
        "file": "mesh_raw.ssmh",
        "n_verts": len(mesh.vertices),
        "n_faces": len(mesh.faces),
        "vertices": _f(mesh.vertices),
        "faces": mesh.faces.reshape(-1).tolist(),
        "normals": _f(mesh.normals),
        "uvs": _f(mesh.uvs),
    }
    expected["mesh_q16"] = {
        "file": "mesh_q16.ssmh",
        "n_verts": len(dq.vertices),
        "n_faces": len(dq.faces),
        "vertices": _f(dq.vertices),
        "faces": dq.faces.reshape(-1).tolist(),
        "uvs": _f(dq.uvs),
    }

    # Two-run pack sharing one mesh.
    with tempfile.TemporaryDirectory() as tmp:
        lib = pathlib.Path(tmp) / "lib"
        names = build_library(lib)
        pack_path = pack.write_pack(
            lib, list(names), OUT_DIR / "two_runs.simscope"
        )
    runs = {}
    with pack.PackReader(pack_path) as pr:
        for name in pr.runs():
            man = pr.manifest(name)
            streams = {}
            for sname, info in man.streams.items():
                with pr.stream(name, sname) as sr:
                    streams[sname] = {
                        "file": info.file,
                        "kind": info.kind,
                        "values": _f(sr.read(0, sr.n_frames)),
                    }
            runs[name] = {
                "manifest": man.to_json(),
                "scene_path": pack.scene_path(man.scene),
                "streams": streams,
            }
        expected["pack"] = {
            "file": pack_path.name,
            "paths": pr.paths(),
            "shared_mesh_entries": [
                p for p in pr.paths() if p.startswith("assets/")
            ],
            "runs": runs,
        }

    # Bytes, not text: Windows would turn "\n" into "\r\n" and change the file.
    (OUT_DIR / "expected.json").write_bytes(
        json.dumps(expected, indent=1).encode("utf-8")
    )
    total = sum(p.stat().st_size for p in OUT_DIR.iterdir())
    print(f"wrote {len(list(OUT_DIR.iterdir()))} files, {total} bytes")


if __name__ == "__main__":
    main()
