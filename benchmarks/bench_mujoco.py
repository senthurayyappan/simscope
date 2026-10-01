"""Benchmarks for the MuJoCo adapter.

Run ``uv run python benchmarks/bench_mujoco.py``. Pass ``--check`` to exit
non-zero when ``poses`` misses its budget (proposal decision D12).
"""

import argparse
import statistics
import sys
import time
from collections.abc import Callable

import mujoco
import numpy as np

from simscope import mujoco as smj

POSES_BUDGET_MS = 2.0
"""Target for ``poses`` at E=4096, B=31."""


def _time_ms(fn: Callable[[], object], repeats: int) -> tuple[float, float]:
    """Times a callable.

    Args:
        fn: The callable to time.
        repeats: Number of timed calls, after 3 warm-up calls.

    Returns:
        ``(median, minimum)`` in milliseconds.
    """
    for _ in range(3):
        fn()
    samples = []
    for _ in range(repeats):
        start = time.perf_counter()
        fn()
        samples.append((time.perf_counter() - start) * 1e3)
    return statistics.median(samples), min(samples)


def _big_model(n_bodies: int, n_mesh_verts: int) -> mujoco.MjModel:
    """Builds a model with a chain of geoms and one large textured mesh.

    Args:
        n_bodies: Number of bodies (each has three geoms).
        n_mesh_verts: Vertices of the large mesh, a fan-triangulated ring
            stack.

    Returns:
        The compiled model.
    """
    rng = np.random.default_rng(0)
    points = rng.normal(size=(n_mesh_verts, 3))
    points /= np.linalg.norm(points, axis=1, keepdims=True)
    hull = " ".join(f"{x:.6f}" for x in points.ravel())
    bodies = "".join(
        f'<body name="b{i}" pos="0 0 .1"><joint type="hinge" axis="0 1 0"/>'
        f'<geom type="capsule" size=".02 .05"/>'
        f'<geom type="box" size=".03 .03 .03" rgba=".{i % 9 + 1} .4 .5 1"/>'
        f'<geom type="sphere" size=".02" group="3"/>'
        for i in range(n_bodies)
    )
    xml = (
        f'<mujoco><asset><mesh name="m" vertex="{hull}"/></asset>'
        f'<worldbody><geom type="mesh" mesh="m"/>{bodies}'
        f"{'</body>' * n_bodies}</worldbody></mujoco>"
    )
    return mujoco.MjModel.from_xml_string(xml)


def main() -> int:
    """Runs the benchmarks and prints a table.

    Returns:
        Process exit code: 1 if ``--check`` was given and a budget failed.
    """
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    rng = np.random.default_rng(0)
    n_envs, n_bodies = 4096, 31
    xpos = rng.normal(size=(n_envs, n_bodies, 3)).astype(np.float32)
    xquat = rng.normal(size=(n_envs, n_bodies, 4)).astype(np.float32)
    xquat /= np.linalg.norm(xquat, axis=-1, keepdims=True)
    xpos64, xquat64 = xpos.astype(np.float64), xquat.astype(np.float64)
    out = np.empty((n_envs, n_bodies, 7), dtype=np.float32)

    rows = [
        (
            "poses E=4096 B=31 float32",
            _time_ms(lambda: smj.poses(xpos, xquat), 200),
        ),
        (
            "poses E=4096 B=31 float32, out=",
            _time_ms(lambda: smj.poses(xpos, xquat, out=out), 200),
        ),
        (
            "poses E=4096 B=31 float64",
            _time_ms(lambda: smj.poses(xpos64, xquat64), 200),
        ),
    ]
    one_x, one_q = xpos[:1], xquat[:1]
    rows.append(
        ("poses E=1 B=31", _time_ms(lambda: smj.poses(one_x, one_q), 2000))
    )

    model = _big_model(n_bodies=60, n_mesh_verts=20_000)
    data = mujoco.MjData(model)
    mujoco.mj_forward(model, data)
    rows.append(
        (
            f"poses MjData B={model.nbody}",
            _time_ms(lambda: smj.poses(data), 2000),
        )
    )
    rows.append(
        (
            f"scene_from_model ({model.ngeom} geoms, "
            f"{model.nmeshface} mesh faces)",
            _time_ms(lambda: smj.scene_from_model(model), 20),
        )
    )

    print(f"{'benchmark':52s} {'median ms':>10s} {'min ms':>10s}")
    for name, (median, best) in rows:
        print(f"{name:52s} {median:10.3f} {best:10.3f}")

    median = rows[0][1][0]
    ok = median <= POSES_BUDGET_MS
    print(
        f"\nposes budget {POSES_BUDGET_MS:.1f} ms: "
        f"{'OK' if ok else 'MISSED'} ({median:.3f} ms)"
    )
    return 1 if args.check and not ok else 0


if __name__ == "__main__":
    sys.exit(main())
