"""Benchmarks for the viewer server and the derived data.

Run ``uv run python benchmarks/bench_server.py`` (add ``--quick`` for a short
run; ``--keep DIR`` reuses the big synthetic run in DIR). Budgets (viewer v3
spec 15, decision D12):

* ``/api/runs`` answers in at most 50 ms with 5,000 runs;
* ``/api/blocks`` for 16 envs answers in at most 5 ms;
* deriving ``root_pose`` (and summaries) for 4,096 envs x 1,000 frames x 20
  bodies takes at most 15 s, in bounded memory.

Requests go over a real socket to a real ``uvicorn`` server in a thread, on a
kept-alive connection, so the numbers include HTTP framing and not only the
handlers.
"""

import argparse
import contextlib
import http.client
import json
import pathlib
import resource
import subprocess
import sys
import tempfile
import threading
import time

import numpy as np
import uvicorn

from simscope import core, derived, library, server

DT = 0.02
TARGET_RUNS_MS = 50.0
TARGET_BLOCKS_MS = 5.0
TARGET_DERIVE_S = 15.0
N_BODIES = 20


def make_scene(n_bodies: int = N_BODIES) -> core.Scene:
    """Builds a scene whose body 1 is named ``torso``."""
    names = ["world", "torso"] + [f"b{i}" for i in range(2, n_bodies)]
    bodies = tuple(
        core.Body(n, -1 if i == 0 else 0) for i, n in enumerate(names)
    )
    return core.Scene(bodies=bodies)


def write_synthetic_runs(root: pathlib.Path, n_runs: int) -> None:
    """Writes manifests and annotations for ``n_runs`` runs (no blocks)."""
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
            "dt": DT,
            "n_frames": 100 + i % 900,
            "n_envs": 1,
            "n_bodies": 14,
            "scene": {"sha256": "ab" * 32, "size": 100},
            "streams": {
                "body_pose": {
                    "file": "body_pose.blk",
                    "kind": "pose",
                    "item_shape": [14, 7],
                },
                "contacts": {
                    "file": "contacts.blk",
                    "kind": "arrows",
                    "item_shape": [4, 6],
                },
            },
            "source": {"simulator": "brax", "importer": "brax"},
            "tags": [f"sweep_{i % 50}", "source:brax"],
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


@contextlib.contextmanager
def running(root: pathlib.Path):
    """Runs a server on a free port in a thread and yields the port."""
    app = server.create_app(root, token="bench", watch=False, warm=False)
    config = uvicorn.Config(app, port=0, log_level="error", access_log=False)
    srv = uvicorn.Server(config)
    thread = threading.Thread(target=srv.run, daemon=True)
    thread.start()
    while not srv.started:
        time.sleep(0.01)
    port = srv.servers[0].sockets[0].getsockname()[1]
    try:
        yield port, app
    finally:
        srv.should_exit = True
        thread.join(timeout=10)


def timed_gets(port: int, url: str, n: int, **headers: str) -> list[float]:
    """Times ``n`` GETs on one kept-alive connection, in milliseconds."""
    conn = http.client.HTTPConnection("127.0.0.1", port)
    out = []
    for _ in range(n):
        t0 = time.perf_counter()
        conn.request("GET", url, headers=headers)
        resp = conn.getresponse()
        resp.read()
        out.append((time.perf_counter() - t0) * 1e3)
        assert resp.status in (200, 304), resp.status
    conn.close()
    return out


def bench_runs(tmp: pathlib.Path, n_runs: int) -> bool:
    """Times ``/api/runs`` with ``n_runs`` runs. Returns whether it passes."""
    root = tmp / "runs_lib"
    write_synthetic_runs(root, n_runs)
    t0 = time.perf_counter()
    with running(root) as (port, _):
        scan_s = time.perf_counter() - t0
        cold = timed_gets(port, "/api/runs", 1)[0]
        warm = timed_gets(port, "/api/runs", 50)
        gz = timed_gets(port, "/api/runs", 50, **{"Accept-Encoding": "gzip"})
        conn = http.client.HTTPConnection("127.0.0.1", port)
        conn.request("GET", "/api/runs")
        resp = conn.getresponse()
        size = len(resp.read())
        etag = resp.getheader("ETag") or ""
        conn.close()
        cond = timed_gets(port, "/api/runs", 50, **{"If-None-Match": etag})
    worst = max(np.median(warm), np.median(gz))
    ok = bool(worst <= TARGET_RUNS_MS)
    print(
        f"/api/runs, {n_runs} runs ({size / 1e6:.2f} MB): "
        f"startup scan {scan_s:.2f} s, first request {cold:.1f} ms"
    )
    print(
        f"  warm median {np.median(warm):.1f} ms (p99 "
        f"{np.percentile(warm, 99):.1f}), gzip {np.median(gz):.1f} ms, "
        f"304 {np.median(cond):.1f} ms  "
        f"(target <= {TARGET_RUNS_MS:.0f} ms) {'ok' if ok else 'OVER BUDGET'}"
    )
    return ok


def synth_window(n: int, envs: int, rng: np.random.Generator, start: int):
    """Builds random-walk poses ``[n, E, 20, 7]`` for frames from ``start``."""
    t = (start + np.arange(n))[:, None, None, None] * DT
    base = rng.uniform(-1, 1, (1, envs, N_BODIES, 3))
    pos = (
        base
        + 0.5 * np.sin(t * rng.uniform(0.5, 4, (1, envs, N_BODIES, 3)))
        + (t * 0.2)
    )
    axis = rng.normal(size=(1, envs, N_BODIES, 3))
    axis /= np.linalg.norm(axis, axis=-1, keepdims=True)
    ang = 1.5 * np.sin(t * rng.uniform(0.5, 4, (1, envs, N_BODIES, 1)))
    quat = np.concatenate([axis * np.sin(ang / 2), np.cos(ang / 2)], -1)
    noise = rng.normal(scale=1e-3, size=pos.shape)
    return np.concatenate([pos + noise, quat], -1).astype(np.float32)


def make_big_run(root: pathlib.Path, envs: int, frames: int) -> None:
    """Records the big synthetic run, one window at a time."""
    rng = np.random.default_rng(0)
    lib = library.Library(root)
    t0 = time.perf_counter()
    with lib.record(
        "big", scene=make_scene(), dt=DT, n_envs=envs, block_frames=100
    ) as rec:
        rec.add_stream("reward", "scalar")
        for start in range(0, frames, 100):
            n = min(100, frames - start)
            rec.log_frames(
                synth_window(n, envs, rng, start),
                reward=rng.normal(size=(n, envs)).astype(np.float32),
            )
    lib.close()
    print(
        f"  recorded {envs} envs x {frames} frames x {N_BODIES} bodies "
        f"in {time.perf_counter() - t0:.0f} s"
    )


def bench_blocks(root: pathlib.Path, envs: int, frames: int) -> bool:
    """Times ``/api/blk`` and ``/api/blocks`` on the big run."""
    with running(root) as (port, _):
        path = "runs/big/body_pose.blk"
        blk = timed_gets(port, f"/api/blk?path={path}", 5)
        ids = ",".join(str(i * (envs // 16)) for i in range(16))
        w = frames // 200  # a window in the middle of the run
        url = f"/api/blocks?path={path}&w={w}&envs={ids}"
        blocks = timed_gets(port, url, 100)
        conn = http.client.HTTPConnection("127.0.0.1", port)
        conn.request("GET", url)
        resp = conn.getresponse()
        size = len(resp.read())
        conn.close()
        one = timed_gets(port, f"/api/blocks?path={path}&w={w}&envs=0", 100)
    ok = bool(np.median(blocks) <= TARGET_BLOCKS_MS)
    print(
        f"/api/blocks, 16 envs of {envs} ({size / 1e3:.0f} KB): median "
        f"{np.median(blocks):.2f} ms, p99 {np.percentile(blocks, 99):.2f} ms "
        f"(target <= {TARGET_BLOCKS_MS:.0f} ms) "
        f"{'ok' if ok else 'OVER BUDGET'}"
    )
    print(
        f"  1 env: {np.median(one):.2f} ms; /api/blk "
        f"(directory of {envs * 10} blocks): {np.median(blk):.1f} ms"
    )
    return ok


def peak_rss_mb() -> int:
    """Returns this process's peak resident set size in MiB."""
    scale = 1 if sys.platform == "darwin" else 1024
    return round(
        resource.getrusage(resource.RUSAGE_SELF).ru_maxrss * scale / 2**20
    )


def derive_child(root: pathlib.Path) -> None:
    """Derives root_pose and summaries in this process; prints JSON."""
    lib = library.Library(root)
    out = {}
    with lib.open("big") as ro:
        cache = derived.cache_dir(root, ro)
        for what in (derived.ROOT_POSE, derived.SUMMARIES):
            t0 = time.perf_counter()
            path = derived.ensure(ro, cache, what)
            assert path is not None
            out[what] = round(time.perf_counter() - t0, 2)
            out[what + "_bytes"] = path.stat().st_size
            out[what + "_rss"] = peak_rss_mb()
    print(json.dumps(out))


def bench_derive(root: pathlib.Path, envs: int, frames: int) -> bool:
    """Derives the root stream in a fresh process; reports time and RSS."""
    big = root / "runs" / "big" / "body_pose.blk"
    raw_gb = frames * envs * N_BODIES * 7 * 4 / 2**30
    for what in ("root_pose.blk", "summaries.json"):  # cold cache
        for p in (root / ".simscope" / "derived").rglob(what):
            p.unlink()
    for p in (root / ".simscope" / "derived").rglob("_root_stats.json"):
        p.unlink()
    proc = subprocess.run(
        [sys.executable, __file__, "--derive-child", str(root)],
        check=True,
        capture_output=True,
        text=True,
    )
    res = json.loads(proc.stdout.strip().splitlines()[-1])
    # summaries.json reuses the pass (the stats file), so the second number
    # is only the small extra streams.
    total = res["root_pose.blk"]
    ok = total <= TARGET_DERIVE_S
    print(
        f"root_pose derivation, {envs} envs x {frames} frames x {N_BODIES} "
        f"bodies ({raw_gb:.2f} GiB raw, {big.stat().st_size / 2**30:.2f} GiB "
        f"on disk): {total:.1f} s (target <= {TARGET_DERIVE_S:.0f} s) "
        f"{'ok' if ok else 'OVER BUDGET'}"
    )
    print(
        f"  root_pose.blk {res['root_pose.blk_bytes'] / 2**20:.1f} MiB; "
        f"peak RSS {res['root_pose.blk_rss']} MiB; summaries (extra, with "
        f"highlights) {res['summaries.json']:.1f} s, peak RSS "
        f"{res['summaries.json_rss']} MiB"
    )
    return ok


def main() -> None:
    """Runs every benchmark and prints a report."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--quick", action="store_true", help="smaller sizes")
    parser.add_argument(
        "--keep", type=pathlib.Path, help="reuse/keep the big run here"
    )
    parser.add_argument("--derive-child", type=pathlib.Path)
    args = parser.parse_args()
    if args.derive_child:
        derive_child(args.derive_child)
        return
    envs, frames = (512, 200) if args.quick else (4096, 1000)
    results = []
    with tempfile.TemporaryDirectory() as tmp_name:
        tmp = pathlib.Path(tmp_name)
        results.append(bench_runs(tmp, 1000 if args.quick else 5000))
        root = args.keep or tmp / "big_lib"
        if not (root / "runs" / "big" / "rollout.json").exists():
            make_big_run(root, envs, frames)
        results.append(bench_blocks(root, envs, frames))
        results.append(bench_derive(root, envs, frames))
    sys.exit(0 if all(results) else 1)


if __name__ == "__main__":
    main()
