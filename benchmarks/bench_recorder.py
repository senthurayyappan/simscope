"""Benchmarks for the Recorder and the SQLite index.

Run ``uv run python benchmarks/bench_recorder.py`` (add ``--quick`` for a
short run). Budgets (decision D12):

* ``Recorder.log`` adds at most 50 us per step at E=1, B=31 with two extra
  scalar streams;
* 5,000 runs index in at most 1 s from scratch, and a refresh that finds
  nothing changed takes at most 50 ms.
"""

import argparse
import json
import pathlib
import shutil
import tempfile
import time

import numpy as np

from simscope import core, index, library

N_BODIES = 31
DT = 0.02
TARGET_LOG_US = 50.0
TARGET_INDEX_S = 1.0
TARGET_NOOP_MS = 50.0


def make_scene(n_bodies: int = N_BODIES) -> core.Scene:
    """Builds a scene with ``n_bodies`` bodies and no geoms."""
    bodies = tuple(
        core.Body(f"b{i}", -1 if i == 0 else i - 1) for i in range(n_bodies)
    )
    return core.Scene(bodies=bodies)


def synth(n: int, envs: int) -> np.ndarray:
    """Builds smooth poses ``[n, E, 31, 7]``, float32."""
    rng = np.random.default_rng(0)
    t = (np.arange(n) * DT)[:, None, None, None]
    shape = (1, envs, N_BODIES, 1)
    pos = rng.uniform(-1, 1, shape) + 0.3 * np.sin(
        t * rng.uniform(0.5, 4, (1, envs, N_BODIES, 3))
    )
    axis = rng.normal(size=(1, envs, N_BODIES, 3))
    axis /= np.linalg.norm(axis, axis=-1, keepdims=True)
    ang = 1.5 * np.sin(t * rng.uniform(0.5, 4, shape))
    quat = np.concatenate([axis * np.sin(ang / 2), np.cos(ang / 2)], -1)
    return np.concatenate([pos, quat], -1).astype(np.float32)


def summarize(samples_ns: list[int]) -> str:
    """Formats median, p99 and max of nanosecond samples in microseconds."""
    us = np.asarray(samples_ns) / 1e3
    return (
        f"median {np.median(us):8.1f} us   p99 {np.percentile(us, 99):9.1f} us"
        f"   max {us.max():10.1f} us"
    )


def bench_log(
    root: pathlib.Path,
    name: str,
    envs: int,
    n: int,
    block_frames: int,
    sim_sleep: float = 0.0,
) -> float:
    """Times ``Recorder.log`` per step. Returns the median in microseconds."""
    poses = synth(min(n, 200), envs)
    reward = np.zeros(envs, np.float32)
    lib = library.Library(root)
    rec = lib.record(
        name,
        scene=make_scene(),
        dt=DT,
        n_envs=envs,
        block_frames=block_frames,
    )
    rec.add_stream("reward", "scalar")
    rec.add_stream("cost", "scalar")
    samples = []
    start = time.perf_counter()
    for t in range(n):
        frame = poses[t % len(poses)]
        if sim_sleep:
            time.sleep(sim_sleep)
        t0 = time.perf_counter_ns()
        rec.log(frame, reward=reward, cost=1.5)
        samples.append(time.perf_counter_ns() - t0)
    loop_s = time.perf_counter() - start
    t0 = time.perf_counter()
    rec.close()
    close_s = time.perf_counter() - t0
    total_s = time.perf_counter() - start
    mb = n * envs * (N_BODIES * 7 + 2) * 4 / 1e6
    label = f"log E={envs:<5} B={N_BODIES} bf={block_frames:<3}"
    if sim_sleep:
        label += f" +{sim_sleep * 1e6:.0f}us sim"
    print(f"{label:<38} {summarize(samples)}")
    print(
        f"{'':<38} stalls {int(rec.stats['stalls'])} "
        f"({rec.stats['stall_seconds'] * 1e3:.1f} ms), "
        f"close {close_s * 1e3:.1f} ms, loop {loop_s:.2f} s, "
        f"end-to-end {mb / total_s:.0f} MB/s of raw floats"
    )
    return float(np.median(samples)) / 1e3


def bench_log_frames(
    root: pathlib.Path, name: str, envs: int, n_chunks: int, chunk: int = 100
) -> None:
    """Times ``log_frames`` with 100-frame chunks."""
    poses = synth(chunk, envs)
    reward = np.zeros((chunk, envs), np.float32)
    lib = library.Library(root)
    rec = lib.record(name, scene=make_scene(), dt=DT, n_envs=envs)
    rec.add_stream("reward", "scalar")
    samples = []
    start = time.perf_counter()
    for _ in range(n_chunks):
        t0 = time.perf_counter_ns()
        rec.log_frames(poses, reward=reward)
        samples.append(time.perf_counter_ns() - t0)
    t0 = time.perf_counter()
    rec.close()
    close_s = time.perf_counter() - t0
    total_s = time.perf_counter() - start
    mb = n_chunks * chunk * envs * (N_BODIES * 7 + 1) * 4 / 1e6
    per_call = np.asarray(samples) / 1e3
    print(
        f"log_frames E={envs:<5} {chunk} frames/call"
        f"      median {np.median(per_call):9.1f} us   "
        f"p99 {np.percentile(per_call, 99):9.1f} us   "
        f"max {per_call.max():9.1f} us"
    )
    print(
        f"{'':<38} stalls {int(rec.stats['stalls'])}, "
        f"close {close_s * 1e3:.1f} ms, end-to-end {mb / total_s:.0f} MB/s"
    )


def write_synthetic_runs(root: pathlib.Path, n_runs: int) -> None:
    """Writes minimal manifests and annotations (no block files)."""
    runs = root / "runs"
    for i in range(n_runs):
        d = runs / f"run_{i:05d}"
        d.mkdir(parents=True)
        manifest = {
            "format": "simscope-rollout/1",
            "id": f"{i:026d}",
            "name": d.name,
            "created": f"2026-09-{1 + i % 28:02d}T{i % 24:02d}:00:00Z",
            "status": "complete",
            "dt": 0.02,
            "n_frames": 100 + i % 900,
            "n_envs": 1,
            "n_bodies": 31,
            "scene": {"sha256": "ab" * 32, "size": 100},
            "streams": {},
            "tags": [f"sweep_{i % 50}", "walk"],
        }
        (d / "rollout.json").write_text(
            json.dumps(manifest, indent=2), encoding="utf-8"
        )
        if i % 3 == 0:
            ann = {
                "format": "simscope-annotations/1",
                "run_id": manifest["id"],
                "marks": {"favorite": i % 2 == 0, "tags": ["good"]},
                "notes": [{"id": "n", "text": "note about run"}],
                "ratings": [{"id": "r", "criterion": "overall", "value": 4}],
                "events": [{"id": "e1"}, {"id": "e2"}],
            }
            (d / "annotations.json").write_text(
                json.dumps(ann, indent=2), encoding="utf-8"
            )


def bench_index(root: pathlib.Path, n_runs: int) -> None:
    """Times a full scan, a no-change refresh and a 1% incremental one."""
    write_synthetic_runs(root, n_runs)
    idx = index.Index(root)
    t0 = time.perf_counter()
    stats = idx.refresh()
    full = time.perf_counter() - t0
    noop = []
    for _ in range(20):
        t0 = time.perf_counter()
        idx.refresh()
        noop.append(time.perf_counter() - t0)
    for i in range(0, n_runs, 100):
        p = root / "runs" / f"run_{i:05d}" / "rollout.json"
        p.write_text(p.read_text() + "\n", encoding="utf-8")
    t0 = time.perf_counter()
    inc = idx.refresh()
    inc_s = time.perf_counter() - t0
    t0 = time.perf_counter()
    rows = idx.query(text="note", tags=["walk"], sort="rating", limit=50)
    query_s = time.perf_counter() - t0
    idx.close()
    print(
        f"index {n_runs} runs: full scan {full:.3f} s "
        f"(target <= {TARGET_INDEX_S} s, {stats.added} added)"
    )
    print(
        f"  no-change refresh: median {np.median(noop) * 1e3:.1f} ms, "
        f"max {max(noop) * 1e3:.1f} ms (target <= {TARGET_NOOP_MS} ms)"
    )
    print(
        f"  1% changed ({inc.updated}): {inc_s * 1e3:.1f} ms; "
        f"query {len(rows)} rows: {query_s * 1e3:.1f} ms"
    )


def main() -> None:
    """Runs every benchmark and prints a report."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--quick", action="store_true", help="short run")
    args = parser.parse_args()
    steps = 3000 if args.quick else 20000
    tmp = pathlib.Path(tempfile.mkdtemp(prefix="simscope-bench-"))
    try:
        print(f"== Recorder.log (budget: median <= {TARGET_LOG_US:.0f} us) ==")
        med = bench_log(tmp, "e1_tight", 1, steps, 100)
        bench_log(tmp, "e1_sim", 1, steps // 10, 100, sim_sleep=100e-6)
        bench_log(tmp, "e4096", 4096, 60 if args.quick else 200, 20)
        print("== Recorder.log_frames ==")
        bench_log_frames(tmp, "lf_e1", 1, 100 if args.quick else 300)
        bench_log_frames(tmp, "lf_e64", 64, 5 if args.quick else 20)
        print("== SQLite index ==")
        bench_index(tmp / "index_lib", 1000 if args.quick else 5000)
        verdict = "PASS" if med <= TARGET_LOG_US else "FAIL"
        print(f"log() median at E=1: {med:.1f} us -> {verdict}")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
