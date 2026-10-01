"""Benchmarks for the block codecs and BlockReader.

Run ``uv run python benchmarks/bench_io.py``. Uses a synthetic, smooth
31-body, 1000-frame, 50 Hz pose trajectory at E=1 and E=64 envs.
"""

import pathlib
import statistics
import tempfile
import time

import numpy as np

from simscope import transforms
from simscope.io import blockfile, codecs

N_FRAMES = 1000
N_BODIES = 31
DT = 0.02
TARGET_DECODE_MBPS = 300.0
TARGET_WINDOW_MS = 1.0


def synth(envs: int) -> np.ndarray:
    """Builds smooth poses of shape ``[T, E, 31, 7]`` at 50 Hz."""
    rng = np.random.default_rng(0)
    t = (np.arange(N_FRAMES) * DT)[:, None, None, None]
    shape = (1, envs, N_BODIES, 1)
    pos = rng.uniform(-1, 1, shape) + 0.3 * np.sin(
        t * rng.uniform(0.5, 4, (1, envs, N_BODIES, 3))
        + rng.uniform(0, 6, (1, envs, N_BODIES, 3))
    )
    axis = rng.normal(size=(1, envs, N_BODIES, 3))
    axis /= np.linalg.norm(axis, axis=-1, keepdims=True)
    ang = 1.5 * np.sin(t * rng.uniform(0.5, 4, shape))
    quat = np.concatenate([axis * np.sin(ang / 2), np.cos(ang / 2)], -1)
    pose = np.concatenate([pos, quat], -1).astype(np.float32)
    return transforms.enforce_sign_continuity(pose)


def best_time(fn, repeat: int = 5, number: int = 1) -> float:
    """Returns the best per-call time in seconds."""
    times = []
    for _ in range(repeat):
        start = time.perf_counter()
        for _ in range(number):
            fn()
        times.append((time.perf_counter() - start) / number)
    return min(times)


def bench_codec(x: np.ndarray, codec: str, tmp: pathlib.Path) -> None:
    """Prints encode/decode throughput and size for one codec."""
    envs = x.shape[1]
    k = N_BODIES * 7
    flat = np.ascontiguousarray(x.reshape(N_FRAMES, envs, k))
    window = flat[:100]
    nbytes = window.nbytes  # f32 bytes in one window

    enc = best_time(lambda: blockfile.encode_window(window, codec), 3)
    blocks = blockfile.encode_window(window, codec)
    out = np.empty((100, k), np.float32)
    blk = blocks[0]
    dec = best_time(
        lambda: [
            codecs.decode_block_into(b.payload, b.codec, out) for b in blocks
        ],
        5,
        number=3,
    )

    path = tmp / f"{codec}_{envs}.blk"
    with blockfile.BlockWriter(
        path,
        item_shape=(N_BODIES, 7),
        n_envs=envs,
        kind="pose",
        codec=codec,
    ) as w:
        w.append(x)
    size = path.stat().st_size
    per_frame_env = size / (N_FRAMES * envs)
    raw_per = k * 4
    dec_mbps = nbytes / dec / 1e6
    flag = "OK " if dec_mbps >= TARGET_DECODE_MBPS else "MISS"
    print(
        f"  {codec:5s} E={envs:<3d} encode {nbytes / enc / 1e6:7.1f} MB/s | "
        f"decode {dec_mbps:7.1f} MB/s [{flag} target "
        f"{TARGET_DECODE_MBPS:.0f}] | {per_frame_env:7.1f} B/frame/env "
        f"({raw_per / per_frame_env:.2f}x vs f32) | first block "
        f"{len(blk.payload)} B"
    )

    # Random window reads from a warm mmap, cache disabled (worst case).
    with blockfile.BlockReader(path, cache_blocks=0) as r:
        r.read(0, N_FRAMES, [0])  # warm the page cache
        rng = np.random.default_rng(1)
        starts = rng.integers(0, N_FRAMES - 100, 200)
        lat = []
        for s in starts:
            t0 = time.perf_counter()
            r.read(int(s), int(s) + 100, [0])
            lat.append((time.perf_counter() - t0) * 1e3)
        med, p95 = statistics.median(lat), float(np.percentile(lat, 95))
        aligned = best_time(lambda: r.read(300, 400, [0]), 5, number=20) * 1e3
        flag = "OK " if med <= TARGET_WINDOW_MS else "MISS"
        print(
            f"        window 100f x 1env uncached: median {med:.3f} ms, "
            f"p95 {p95:.3f} ms, aligned {aligned:.3f} ms "
            f"[{flag} target {TARGET_WINDOW_MS} ms]"
        )
    with blockfile.BlockReader(path, cache_blocks=64) as r:
        r.read(300, 400, [0])
        hit = best_time(lambda: r.read(300, 400, [0]), 5, number=200) * 1e3
        frame = best_time(lambda: r.read(350, 351), 5, number=200) * 1e3
        print(
            f"        cached window {hit:.3f} ms, single frame (all envs) "
            f"{frame:.3f} ms"
        )


def main() -> None:
    """Runs all benchmarks."""
    with tempfile.TemporaryDirectory() as tmp_name:
        tmp = pathlib.Path(tmp_name)
        for envs in (1, 64):
            x = synth(envs)
            print(
                f"31 bodies x 1000 frames x {envs} env(s), "
                f"{x.nbytes / 1e6:.1f} MB f32"
            )
            for codec in ("f32s", "q16d"):
                bench_codec(x, codec, tmp)


if __name__ == "__main__":
    main()
