import time

from simscope import library

from .conftest import ORIGIN, make_client


def wait_for(fn, what, timeout=10.0):
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        value = fn()
        if value:
            return value
        time.sleep(0.05)
    raise AssertionError(f"timed out waiting for {what}")


def changes(client, since):
    r = client.get("/api/changes", params={"since": since})
    assert r.status_code == 200
    return r.json()


def test_nothing_changed(client):
    seq = client.get("/api/library").json()["seq"]
    body = changes(client, seq)
    assert body == {"seq": seq, "changed": [], "removed": [], "live": {}}


def test_unknown_since_resyncs_everything(client):
    body = changes(client, 0)
    assert sorted(body["changed"]) == ["crowd", "run_a", "run_b", "walk"]
    future = changes(client, body["seq"] + 10_000)
    assert len(future["changed"]) == 4  # a client from a previous server
    assert client.get("/api/changes", params={"since": "x"}).status_code == 400


def test_rescan_reports_added_changed_and_removed(client, lib_root):
    st = client.app.state.services.state
    seq0 = st.seq
    lib = library.Library(lib_root)
    from .conftest import record

    record(lib, "fresh", 10, 1, seed=9)
    lib.close()
    assert st.rescan() is True
    body = changes(client, seq0)
    assert body["changed"] == ["fresh"] and body["removed"] == []
    assert body["seq"] > seq0
    assert any(
        r["name"] == "fresh" for r in client.get("/api/runs").json()["runs"]
    )
    seq1 = body["seq"]
    assert st.rescan() is False  # nothing new: no bump
    assert changes(client, seq1)["seq"] == seq1
    import shutil

    shutil.rmtree(lib_root / "runs" / "fresh")
    st.rescan()
    body = changes(client, seq1)
    assert body["removed"] == ["fresh"] and body["changed"] == []
    assert all(
        r["name"] != "fresh" for r in client.get("/api/runs").json()["runs"]
    )
    # Everything since seq0 collapses: added then removed is just removed.
    assert changes(client, seq0)["removed"] == ["fresh"]
    assert "fresh" not in changes(client, seq0)["changed"]


def test_annotation_writes_bump_seq(client):
    seq = client.get("/api/library").json()["seq"]
    client.post(
        "/api/runs/walk/annotations",
        json={"op": "favorite", "value": True},
        headers=ORIGIN,
    )
    body = changes(client, seq)
    assert body["changed"] == ["walk"] and body["seq"] > seq


def test_live_frames_from_the_partial_manifest(client, live):
    st = client.app.state.services.state
    seq = st.seq
    live.grow(20)
    st.rescan()
    body = changes(client, seq)
    assert body["changed"] == ["live"]
    assert body["live"] == {"live": 20}
    row = next(
        r for r in client.get("/api/runs").json()["runs"] if r["name"] == "live"
    )
    assert row["status"] == "recording" and row["n_frames"] == 20
    seq = body["seq"]
    live.grow(30)
    st.rescan()
    body = changes(client, seq)
    assert body["live"] == {"live": 50} and body["changed"] == ["live"]
    seq = body["seq"]
    live.finish()
    st.rescan()
    body = changes(client, seq)
    assert body["changed"] == ["live"] and body["live"] == {}
    row = next(
        r for r in client.get("/api/runs").json()["runs"] if r["name"] == "live"
    )
    assert row["status"] == "complete" and row["n_frames"] == 50


def test_watcher_sees_a_run_grow_between_two_polls(lib_root):
    lib = library.Library(lib_root)
    from .conftest import LiveRun

    run = LiveRun(lib, "tail", 40)
    try:
        with make_client(lib_root, watch=True) as c:
            seq = c.get("/api/library").json()["seq"]
            run.grow(10)
            first = wait_for(
                lambda: (b := changes(c, seq))["changed"] and b, "first window"
            )
            assert first["changed"] == ["tail"]
            assert first["live"] == {"tail": 10}
            run.grow(20)
            second = wait_for(
                lambda: (
                    (b := changes(c, first["seq"]))["live"].get("tail") == 30
                    and b
                ),
                "next windows",
            )
            assert second["seq"] > first["seq"] and second["changed"] == [
                "tail"
            ]
            run.finish()
            done = wait_for(
                lambda: (b := changes(c, second["seq"]))["changed"] and b,
                "finish",
            )
            assert done["live"] == {}
            rows = {r["name"]: r for r in c.get("/api/runs").json()["runs"]}
            assert rows["tail"]["status"] == "complete"
    finally:
        run.rec.close()
        lib.close()


def test_watcher_sees_new_and_deleted_runs(lib_root):
    import shutil

    with make_client(lib_root, watch=True) as c:
        seq = c.get("/api/library").json()["seq"]
        shutil.copytree(lib_root / "runs" / "walk", lib_root / "runs" / "copy")
        body = wait_for(
            lambda: (b := changes(c, seq))["changed"] and b, "the new run"
        )
        assert body["changed"] == ["copy"]
        shutil.rmtree(lib_root / "runs" / "copy")
        gone = wait_for(
            lambda: (b := changes(c, body["seq"]))["removed"] and b, "removal"
        )
        assert gone["removed"] == ["copy"]


def test_writes_to_the_index_cache_do_not_cause_changes(lib_root):
    with make_client(lib_root, watch=True) as c:
        seq = c.get("/api/library").json()["seq"]
        (lib_root / ".simscope").mkdir(exist_ok=True)
        (lib_root / ".simscope" / "noise").write_text("x")
        time.sleep(0.6)
        assert changes(c, seq)["seq"] == seq
