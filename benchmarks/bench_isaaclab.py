"""Benchmarks for the Isaac Lab adapter, on numpy fakes (no Isaac needed).

Run ``uv run python benchmarks/bench_isaaclab.py``. Pass ``--check`` to exit
non-zero when a budget is missed (proposal decision D12). The fake arrays are
host numpy, so this measures the CPU fallback path; on a GPU the same calls
are one device copy per ``push`` and one transfer per ``drain``.
"""

import argparse
import statistics
import sys
import time
import types
from collections.abc import Callable

import numpy as np

from simscope import isaaclab as sil

N_ENVS = 4096
N_BODIES = 31
BLOCK_FRAMES = 100
PUSH_BUDGET_MS = 0.1
"""Target for one ``PoseBuffer.push`` at E=4096, B=31."""
DRAIN_BUDGET_MS = 20.0
"""Target for draining a 100-frame block."""
CHECK_SLACK = 1.5
"""``--check`` allows this factor over budget. On the CPU fallback, ``push``
copies 3.5 MB, which is bound by memory bandwidth and lands near the budget."""


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


def _fake_env(n_envs: int, n_bodies: int) -> types.SimpleNamespace:
    """Builds a fake env with a robot and a one-body cube.

    Args:
        n_envs: Number of envs.
        n_bodies: Total bodies, the robot getting all but one.

    Returns:
        An object with ``scene["robot"]`` and ``scene["cube"]``.
    """
    rng = np.random.default_rng(0)

    def asset(bodies: int) -> types.SimpleNamespace:
        pose = rng.normal(size=(n_envs, bodies, 7)).astype(np.float32)
        return types.SimpleNamespace(
            data=types.SimpleNamespace(body_link_pose_w=pose)
        )

    return types.SimpleNamespace(
        scene={"robot": asset(n_bodies - 1), "cube": asset(1)}
    )


def main() -> int:
    """Runs the benchmarks and prints a table.

    Returns:
        0, or 1 if ``--check`` was given and a budget was missed.
    """
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--repeats", type=int, default=50)
    args = parser.parse_args()

    env = _fake_env(N_ENVS, N_BODIES)
    assets = ["robot", "cube"]
    buffer = sil.PoseBuffer(env, assets, capacity=BLOCK_FRAMES)

    poses_ms = _time_ms(lambda: sil.poses(env, assets), args.repeats)

    push_samples = []
    for i in range(args.repeats * 4):
        if buffer.full:
            buffer.drain()  # untimed: measured separately below
        start = time.perf_counter()
        buffer.push()
        if i >= 3:
            push_samples.append((time.perf_counter() - start) * 1e3)
    push_median = statistics.median(push_samples)
    buffer.drain()

    drain_samples = []
    for _ in range(max(args.repeats // 5, 5)):
        for _ in range(BLOCK_FRAMES):
            buffer.push()
        start = time.perf_counter()
        buffer.drain()
        drain_samples.append((time.perf_counter() - start) * 1e3)
    drain_median = statistics.median(drain_samples)

    print(f"E={N_ENVS} B={N_BODIES}  (numpy fakes, CPU)")
    print(f"poses()              median {poses_ms[0]:8.3f} ms")
    print(
        f"PoseBuffer.push()    median {push_median:8.3f} ms"
        f"  (budget {PUSH_BUDGET_MS} ms)"
    )
    print(
        f"drain() of {BLOCK_FRAMES} frames  median {drain_median:8.3f} ms"
        f"  (budget {DRAIN_BUDGET_MS} ms)"
    )
    ok = (
        push_median <= PUSH_BUDGET_MS * CHECK_SLACK
        and drain_median <= DRAIN_BUDGET_MS * CHECK_SLACK
    )
    if args.check and not ok:
        print("FAILED: over budget", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
