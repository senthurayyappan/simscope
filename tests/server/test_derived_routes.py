import json
import time

import numpy as np

from simscope import derived
from simscope.io import blockfile
from simscope.server import jobs

from .conftest import make_client


def fetch(client, path, timeout=20.0):
    """GET a derived path, following 202 the way the client does."""
    first = None
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        r = client.get(f"/files/{path}")
        first = first or r
        if r.status_code != 202:
            return first, r
        assert r.json() == {"status": "pending"}
        assert r.headers["retry-after"] == "1"
        time.sleep(0.02)
    raise AssertionError(f"{path} stayed pending")


def test_summaries_pending_then_ready(client):
    _, done = fetch(client, "derived/crowd/summaries.json")
    assert done.status_code == 200
    doc = done.json()
    assert {"return", "min_height", "peak_speed"} <= {
        c["key"] for c in doc["columns"]
    }
    assert all(len(v) == 70 for v in doc["values"].values())
    assert done.headers["cache-control"] == "no-cache"
    # Once cached it is an ordinary file: ETag and 304.
    again = client.get(
        "/files/derived/crowd/summaries.json",
        headers={"If-None-Match": done.headers["etag"]},
    )
    assert again.status_code == 304


def test_first_request_is_202_for_slow_work(lib_root, monkeypatch):
    gate = __import__("threading").Event()
    real = derived.ensure

    def slow(ro, cache, what):
        gate.wait(10)
        return real(ro, cache, what)

    monkeypatch.setattr(derived, "ensure", slow)
    with make_client(lib_root) as c:
        r = c.get("/files/derived/crowd/summaries.json")
        assert r.status_code == 202 and r.headers["retry-after"] == "1"
        assert c.get("/files/derived/crowd/summaries.json").status_code == 202
        gate.set()
        _, done = fetch(c, "derived/crowd/summaries.json")
        assert done.status_code == 200


def test_one_job_per_file(lib_root, monkeypatch):
    calls = []
    real = derived.ensure

    def counting(ro, cache, what):
        calls.append(what)
        return real(ro, cache, what)

    monkeypatch.setattr(derived, "ensure", counting)
    with make_client(lib_root) as c:
        for _ in range(5):
            c.get("/files/derived/crowd/summaries.json")
        fetch(c, "derived/crowd/summaries.json")
        assert calls.count("summaries.json") == 1


def test_root_pose_for_a_crowd_is_a_block_file(client, lib_root):
    _, r = fetch(client, "derived/crowd/root_pose.blk")
    assert r.status_code == 200
    head = blockfile.Header.parse(r.content)
    assert head.n_envs == 70 and head.item_shape == (1, 7)
    # And the block routes serve it like any stream.
    idx = client.get("/api/blk", params={"path": "derived/crowd/root_pose.blk"})
    assert idx.status_code == 200
    blocks = client.get(
        "/api/blocks",
        params={"path": "derived/crowd/root_pose.blk", "w": 0, "envs": "0,69"},
    )
    assert blocks.status_code == 200
    assert len(blocks.headers["x-simscope-block-lengths"].split(",")) == 2


def test_blk_routes_answer_202_while_the_root_stream_is_computed(
    lib_root, monkeypatch
):
    gate = __import__("threading").Event()
    real = derived.ensure
    monkeypatch.setattr(
        derived, "ensure", lambda *a: (gate.wait(10), real(*a))[1]
    )
    with make_client(lib_root) as c:
        r = c.get("/api/blk", params={"path": "derived/crowd/root_pose.blk"})
        assert r.status_code == 202
        r = c.get(
            "/api/blocks",
            params={"path": "derived/crowd/root_pose.blk", "w": 0, "envs": "0"},
        )
        assert r.status_code == 202
        gate.set()


def test_no_root_stream_for_a_small_run(client):
    for path in ("derived/walk/root_pose.blk",):
        r = client.get(f"/files/{path}")
        assert r.status_code == 404 and "error" in r.json()
    assert (
        client.get(
            "/api/blk", params={"path": "derived/walk/root_pose.blk"}
        ).status_code
        == 404
    )


def test_envelopes(client):
    _, r = fetch(client, "derived/crowd/envelopes/reward.json")
    doc = r.json()
    assert doc["components"] == 1 and len(doc["p50"][0]) == 30
    _, r = fetch(client, "derived/crowd/envelopes/joint.json")
    assert r.json()["components"] == 2


def test_envelope_not_applicable(client):
    for path in (
        "derived/walk/envelopes/reward.json",  # one env
        "derived/crowd/envelopes/body_pose.json",  # not a plot stream
        "derived/crowd/envelopes/contacts.json",
        "derived/crowd/envelopes/nope.json",
        "derived/ghost/summaries.json",
    ):
        assert client.get(f"/files/{path}").status_code == 404, path


def test_summaries_of_a_single_env_run(client):
    _, r = fetch(client, "derived/walk/summaries.json")
    assert r.status_code == 200
    assert all(len(v) == 1 for v in r.json()["values"].values())


def test_highlights_route(client):
    _, r = fetch(client, "derived/walk/highlights.json")
    assert r.status_code == 200
    doc = r.json()
    assert doc["format"] == "simscope-highlights/2"
    assert doc["detector"] == "simscope/2.1" and "kinds" in doc
    assert "signals" not in doc


def test_recording_runs_are_not_derived(client, live):
    live.grow(20)
    client.app.state.services.state.rescan()
    assert client.get("/files/derived/live/summaries.json").status_code == 404


def test_derived_files_follow_the_manifest(client, lib_root):
    _, before = fetch(client, "derived/crowd/summaries.json")
    path = lib_root / "runs" / "crowd" / "rollout.json"
    m = json.loads(path.read_text())
    m["tags"] = ["changed"]
    path.write_text(json.dumps(m))
    first = client.get("/files/derived/crowd/summaries.json")
    assert first.status_code == 202  # stale: recomputed, not served
    _, after = fetch(client, "derived/crowd/summaries.json")
    assert after.json() == before.json()
    assert after.headers["etag"] != before.headers["etag"]


def test_a_failing_pass_is_reported_once_not_retried(lib_root, monkeypatch):
    calls = []

    def boom(ro, cache, what):
        calls.append(what)
        raise RuntimeError("no luck")

    monkeypatch.setattr(derived, "ensure", boom)
    with make_client(lib_root) as c:
        assert c.get("/files/derived/crowd/summaries.json").status_code == 202
        end = time.monotonic() + 10
        r = c.get("/files/derived/crowd/summaries.json")
        while r.status_code == 202 and time.monotonic() < end:
            time.sleep(0.02)
            r = c.get("/files/derived/crowd/summaries.json")
        assert r.status_code == 500 and "no luck" in r.json()["error"]
        c.get("/files/derived/crowd/summaries.json")
        assert len(calls) == 1


def test_highlight_counts_reach_the_run_rows(lib_root):
    with make_client(lib_root, warm=True) as c:
        end = time.monotonic() + 30
        while time.monotonic() < end:
            rows = {r["name"]: r for r in c.get("/api/runs").json()["runs"]}
            if all(r["n_highlights"] is not None for r in rows.values()):
                break
            time.sleep(0.1)
        assert all(r["n_highlights"] is not None for r in rows.values()), rows
        seq = c.get("/api/library").json()["seq"]
        assert (
            c.get("/api/changes", params={"since": seq}).json()["changed"] == []
        )


def test_job_statuses(client):
    j = client.app.state.services.jobs
    assert j.request("ghost", "summaries.json")[0] is jobs.Status.MISSING
    assert j.request("walk", "root_pose.blk")[0] is jobs.Status.NOT_APPLICABLE


def test_root_stream_matches_the_recording(client, lib_root):
    _, r = fetch(client, "derived/crowd/root_pose.blk")
    with (
        blockfile.BlockReader(r.content, kind="pose") as got,
        blockfile.BlockReader(
            lib_root / "runs" / "crowd" / "body_pose.blk", kind="pose"
        ) as src,
    ):
        a = got.read(0, got.n_frames)[:, :, 0]
        b = src.read(0, src.n_frames)[:, :, 1]
    assert np.abs(a - b).max() < 1e-3
