"""Benchmark for the single-file HTML export.

Run ``uv run python benchmarks/bench_export.py``. It exports a synthetic,
Unitree-G1-like run (31 bodies, 20 s at 50 Hz, about 7 MB of raw meshes made
procedurally) and reports the HTML size with and without transcoding, where
the bytes go, what gzipping the runtime saves over inlining the minified
JavaScript, and the export time.

Mesh compressibility decides most of the size, so three mesh sets are run:
``smooth`` (regular latitude/longitude grids), ``noisy`` (the same grids
with vertex jitter of 1e-4 of the mesh size, closer to scanned or
CAD-tessellated robot meshes), and ``rough`` (jitter of 5e-3, about 130
quantization steps: a near worst case). Poses are smooth sinusoids with
small jitter.
"""

import base64
import gzip
import pathlib
import tempfile
import time

import numpy as np

from simscope import core, export, transforms
from simscope.io import blockfile, cas, manifest, pack, scene

N_BODIES = 31
N_FRAMES = 1000
DT = 0.02
RAW_MESH_BYTES = 7_000_000
TARGET_HTML_BYTES = 4_000_000


def make_mesh(
    n_lat: int, n_lon: int, rng: np.random.Generator, jitter: float
) -> core.Mesh:
    """Builds a deformed, closed lat/lon ellipsoid with normals and UVs."""
    lat = np.linspace(0.02, np.pi - 0.02, n_lat)
    lon = np.linspace(0, 2 * np.pi, n_lon, endpoint=False)
    la, lo = np.meshgrid(lat, lon, indexing="ij")
    bumps = 1 + 0.15 * np.sin(3 * lo + rng.uniform(0, 6)) * np.sin(2 * la)
    unit = np.stack(
        [np.sin(la) * np.cos(lo), np.sin(la) * np.sin(lo), np.cos(la)], -1
    )
    radii = rng.uniform(0.03, 0.12, 3)
    verts = (unit * bumps[..., None] * radii).reshape(-1, 3)
    verts += rng.normal(scale=jitter * radii.max(), size=verts.shape)
    a = (np.arange(n_lat - 1)[:, None] * n_lon + np.arange(n_lon)).reshape(-1)
    b = (
        np.arange(n_lat - 1)[:, None] * n_lon + (np.arange(n_lon) + 1) % n_lon
    ).reshape(-1)
    faces = np.concatenate(
        [
            np.stack([a, b, a + n_lon], -1),
            np.stack([b, b + n_lon, a + n_lon], -1),
        ]
    )
    normals = unit.reshape(-1, 3)
    uvs = np.stack([lo / (2 * np.pi), la / np.pi], -1).reshape(-1, 2)
    return core.Mesh(
        verts.astype(np.float32),
        faces.astype(np.uint32),
        normals.astype(np.float32),
        uvs.astype(np.float32),
    )


def make_scene(jitter: float) -> core.Scene:
    """Builds a 31-body scene with ~7 MB of raw (normals + uv) mesh data."""
    rng = np.random.default_rng(0)
    per_mesh = RAW_MESH_BYTES // (N_BODIES - 1)
    meshes = []
    for _ in range(N_BODIES - 1):
        # bytes per vertex: verts 12 + normals 12 + uvs 8 + faces ~2*12.
        n_verts = per_mesh // 56
        n_lon = int(rng.integers(40, 80))
        meshes.append(make_mesh(max(n_verts // n_lon, 4), n_lon, rng, jitter))
    bodies = [core.Body("world", -1)] + [
        core.Body(f"link{i}", max(i - 1, 0)) for i in range(1, N_BODIES)
    ]
    geoms = [
        core.Geom(i + 1, "mesh", mesh=i, scale=(1.0, 1.0, 1.0))
        for i in range(N_BODIES - 1)
    ]
    geoms.append(core.Geom(0, "plane", size=(0.0, 0.0, 0.5)))
    return core.Scene(
        bodies=tuple(bodies),
        geoms=tuple(geoms),
        materials=(core.Material(), core.Material(rgba=(0.3, 0.5, 0.8, 1.0))),
        meshes=tuple(meshes),
    )


def make_poses() -> np.ndarray:
    """Builds smooth poses with sensor-like jitter, ``[T, 1, 31, 7]``."""
    rng = np.random.default_rng(1)
    t = (np.arange(N_FRAMES) * DT)[:, None, None, None]
    shape = (1, 1, N_BODIES, 1)
    pos = rng.uniform(-0.5, 0.5, shape) + 0.3 * np.sin(
        t * rng.uniform(0.5, 4, (1, 1, N_BODIES, 3))
        + rng.uniform(0, 6, (1, 1, N_BODIES, 3))
    )
    pos += rng.normal(scale=2e-5, size=pos.shape)
    axis = rng.normal(size=(1, 1, N_BODIES, 3))
    axis /= np.linalg.norm(axis, axis=-1, keepdims=True)
    ang = 1.2 * np.sin(t * rng.uniform(0.5, 4, shape))
    quat = np.concatenate([axis * np.sin(ang / 2), np.cos(ang / 2)], -1)
    pose = np.concatenate([pos, quat], -1).astype(np.float32)
    return transforms.enforce_sign_continuity(pose)


def raw_mesh_bytes(sc: core.Scene) -> int:
    """Uncompressed size of all mesh arrays of a scene."""
    return sum(
        a.nbytes
        for m in sc.meshes
        for a in (m.vertices, m.faces, m.normals, m.uvs)
        if a is not None
    )


def build_library(root: pathlib.Path, jitter: float) -> int:
    """Writes the synthetic run ``g1_walk`` into a fresh library.

    Returns:
        The uncompressed size of the meshes in bytes.
    """
    sc = make_scene(jitter)
    ref = scene.put_scene(cas.ContentStore(root), sc)
    run_dir = root / "runs" / "g1_walk"
    run_dir.mkdir(parents=True)
    with blockfile.BlockWriter(
        run_dir / "body_pose.blk",
        item_shape=(N_BODIES, 7),
        n_envs=1,
        kind="pose",
    ) as writer:
        writer.append(make_poses())
    manifest.write_manifest(
        run_dir,
        manifest.RolloutManifest(
            id="01J9Z3GGGGGGGGGGGGGGGGGGGG",
            name="g1_walk",
            created="2026-09-30T12:00:00Z",
            dt=DT,
            n_frames=N_FRAMES,
            n_envs=1,
            n_bodies=N_BODIES,
            scene=ref,
            streams={
                "body_pose": manifest.StreamInfo(
                    "body_pose.blk", "pose", (N_BODIES, 7)
                )
            },
            env_origins=((0.0, 0.0, 0.0),),
        ),
        partial=False,
    )
    return raw_mesh_bytes(sc)


def dir_bytes(root: pathlib.Path, sub: str) -> int:
    """Total size of the files under ``root/sub``."""
    return sum(p.stat().st_size for p in (root / sub).rglob("*") if p.is_file())


def mb(n: float) -> str:
    """Formats bytes as megabytes."""
    return f"{n / 1e6:6.2f} MB"


def bench(label: str, jitter: float, tmp: pathlib.Path) -> bool:
    """Exports one mesh set and prints the numbers. Returns pass/fail."""
    root = tmp / label
    raw_meshes = build_library(root, jitter)
    stored_meshes = dir_bytes(root, "assets")
    raw_poses = (root / "runs/g1_walk/body_pose.blk").stat().st_size
    print(
        f"\n[{label}] library: meshes {mb(raw_meshes)} raw"
        f" ({mb(stored_meshes).strip()} stored), poses {mb(raw_poses)}"
    )
    ok = True
    for transcode in (True, False):
        times = []
        for _ in range(3):
            start = time.perf_counter()
            out = export.export_html(
                root,
                ["g1_walk"],
                tmp / f"{label}-{transcode}.html",
                layout="single",
                transcode=transcode,
            )
            times.append(time.perf_counter() - start)
        size = out.stat().st_size
        print(
            f"  transcode={transcode!s:5}: HTML {mb(size)}"
            f"  export {min(times):5.2f} s (best of 3)"
        )
        if transcode:
            data = export.build_pack(root, ["g1_walk"])
            with pack.PackReader(data) as reader:
                by_kind: dict[str, int] = {}
                for path in reader.paths():
                    kind = path.split("/")[0]
                    by_kind[kind] = by_kind.get(kind, 0) + len(
                        reader.read(path)
                    )
            print(
                "    pack:",
                ", ".join(f"{k} {mb(v)}" for k, v in sorted(by_kind.items())),
                f"(base64 x{len(base64.b64encode(data)) / len(data):.3f})",
            )
            ok = size <= TARGET_HTML_BYTES
    return ok


def main() -> None:
    """Runs the benchmark."""
    runtime = export.read_asset(export.RUNTIME_ASSET)
    gz = export.gzip_runtime(runtime)
    b64 = len(base64.b64encode(gz))
    print(f"runtime: minified {mb(len(runtime))}, gzip level 9 {mb(len(gz))}")
    print(
        f"  inlined as gzip+base64: {mb(b64)}; as raw minified JS: "
        f"{mb(len(runtime))}; saved {mb(len(runtime) - b64)}"
        f" ({100 * (1 - b64 / len(runtime)):.0f}%)"
    )
    print(f"  (gzip level 6 would be {mb(len(gzip.compress(runtime, 6)))})")
    results = []
    with tempfile.TemporaryDirectory(prefix="bench-export-") as tmp_name:
        tmp = pathlib.Path(tmp_name)
        for label, jitter in (
            ("smooth", 0.0),
            ("noisy", 1e-4),
            ("rough", 5e-3),
        ):
            results.append(bench(label, jitter, tmp))
    verdict = "PASS" if all(results) else "FAIL"
    print(f"\ntarget: HTML <= {mb(TARGET_HTML_BYTES).strip()} -> {verdict}")


if __name__ == "__main__":
    main()
