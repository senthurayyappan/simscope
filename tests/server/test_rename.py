import json

from simscope import derived

from .conftest import HOST, ORIGIN, TOKEN, make_client
from .test_derived_routes import fetch


def rename(client, name, to, **kw):
    return client.post(
        f"/api/runs/{name}/rename", json={"to": to}, headers=ORIGIN, **kw
    )


def rows(client):
    return {r["name"]: r for r in client.get("/api/runs").json()["runs"]}


def test_rename_answers_with_the_new_name_and_moves_the_folder(
    client, lib_root
):
    r = rename(client, "walk", "stride-1")
    assert r.status_code == 200 and r.json() == {"name": "stride-1"}
    assert r.headers["cache-control"] == "no-store"
    assert not (lib_root / "runs" / "walk").exists()
    man = json.loads(
        (lib_root / "runs" / "stride-1" / "rollout.json").read_text()
    )
    assert man["name"] == "stride-1"
    assert "walk" not in rows(client) and "stride-1" in rows(client)
    assert client.get("/files/runs/stride-1/rollout.json").status_code == 200
    assert client.get("/files/runs/walk/rollout.json").status_code == 404


def test_the_changes_feed_lists_the_old_and_new_names(client):
    seq = client.get("/api/library").json()["seq"]
    assert rename(client, "walk", "stride").status_code == 200
    body = client.get("/api/changes", params={"since": seq}).json()
    assert body["removed"] == ["walk"] and body["changed"] == ["stride"]
    assert body["seq"] > seq  # no waiting for the watcher
    # Nothing else moved, and a rescan has nothing to add.
    st = client.app.state.services.state
    assert st.rescan() is False


def test_the_id_notes_group_and_cached_data_stay_with_the_run(client, lib_root):
    ann = lambda body: client.post(  # noqa: E731
        "/api/runs/walk/annotations", json=body, headers=ORIGIN
    )
    assert ann({"op": "favorite", "value": True}).status_code == 200
    assert ann({"op": "group", "value": "Vault"}).status_code == 200
    jobs = client.app.state.services.jobs
    jobs.compute("walk", derived.HIGHLIGHTS)
    _, done = fetch(client, "derived/crowd/summaries.json")
    assert done.status_code == 200
    before = rows(client)
    old_id = before["walk"]["id"]
    assert before["walk"]["n_highlights"] is not None

    assert rename(client, "walk", "stride").status_code == 200
    assert rename(client, "crowd", "mob").status_code == 200
    after = rows(client)
    row = after["stride"]
    assert row["id"] == old_id
    assert row["favorite"] is True and row["group"] == "Vault"
    assert row["n_highlights"] == before["walk"]["n_highlights"]
    ann_doc = json.loads(
        (lib_root / "runs" / "stride" / "annotations.json").read_text()
    )
    assert ann_doc["run_id"] == old_id
    # The derived files are served at once under the new name (no 202).
    first, done = fetch(client, "derived/stride/highlights.json")
    assert first.status_code == 200 and done.json()["run_id"] == old_id
    first, _ = fetch(client, "derived/mob/summaries.json")
    assert first.status_code == 200
    # Annotation writes follow the new name.
    r = client.post(
        "/api/runs/stride/annotations",
        json={"op": "favorite", "value": False},
        headers=ORIGIN,
    )
    assert r.status_code == 200 and rows(client)["stride"]["favorite"] is False


def test_a_renamed_run_exports(client, tmp_path):
    assert rename(client, "walk", "stride").status_code == 200
    r = client.get("/api/export", params={"runs": "stride"})
    assert r.status_code == 200 and b'run="stride"' in r.content
    assert client.get("/api/export", params={"runs": "walk"}).status_code == 404
    full = client.get("/api/export", params={"runs": "stride", "ui": "full"})
    assert full.status_code == 200
    assert 'filename="stride.html"' in r.headers["content-disposition"]


def test_invalid_names_are_400(client):
    for bad in ("", "../x", ".a", "a/b", "x" * 129, "a b"):
        r = rename(client, "walk", bad)
        assert r.status_code == 400 and "error" in r.json(), bad
    for body in ({}, {"to": 3}, {"to": None}, {"name": "x"}):
        r = client.post("/api/runs/walk/rename", json=body, headers=ORIGIN)
        assert r.status_code == 400
    r = client.post("/api/runs/walk/rename", content=b"[", headers=ORIGIN)
    assert r.status_code == 400
    assert "walk" in rows(client)


def test_unknown_run_is_404(client):
    assert rename(client, "ghost", "x").status_code == 404
    assert rename(client, "..", "x").status_code == 404
    assert rename(client, "a.b..", "x").status_code == 404


def test_existing_target_is_409_and_nothing_changes(client, lib_root):
    seq = client.get("/api/library").json()["seq"]
    for to in ("crowd", "walk"):
        r = rename(client, "walk", to)
        assert r.status_code == 409 and "already exists" in r.json()["error"]
    assert sorted(rows(client)) == ["crowd", "run_a", "run_b", "walk"]
    assert client.get("/api/library").json()["seq"] == seq
    assert (lib_root / "runs" / "walk").is_dir()


def test_a_recording_run_is_409(client, live):
    live.grow(20)
    client.app.state.services.state.rescan()
    r = rename(client, "live", "done")
    assert r.status_code == 409 and "recording" in r.json()["error"]
    assert "live" in rows(client)


def test_an_os_failure_is_409_and_restores_the_run(
    client, lib_root, monkeypatch
):
    from simscope import library

    def boom(src, dst):
        raise PermissionError("in use")

    monkeypatch.setattr(library.os, "rename", boom)
    r = rename(client, "walk", "stride")
    monkeypatch.undo()
    assert r.status_code == 409 and "in use" in r.json()["error"]
    man = json.loads((lib_root / "runs" / "walk" / "rollout.json").read_text())
    assert man["name"] == "walk" and "walk" in rows(client)


def test_writes_need_token_origin_and_a_writable_library(client, lib_root):
    body = {"to": "x"}
    url = "/api/runs/walk/rename"
    assert client.post(url, json=body).status_code == 403
    no_token = client.post(url, json=body, headers={"Origin": HOST})
    assert no_token.status_code == 403
    wrong = client.post(
        url, json=body, headers={"Origin": HOST, "X-Simscope-Token": "nope"}
    )
    assert wrong.status_code == 403
    evil = client.post(
        url,
        json=body,
        headers={"Origin": "http://evil.example", "X-Simscope-Token": TOKEN},
    )
    assert evil.status_code == 403
    assert client.get(url).status_code == 405
    assert (lib_root / "runs" / "walk").is_dir()
    with make_client(lib_root) as c:
        c.app.state.services.state.writable = False
        r = c.post(url, json=body, headers=ORIGIN)
        assert r.status_code == 403 and "read-only" in r.json()["error"]
        assert (lib_root / "runs" / "walk").is_dir()


def test_the_watcher_after_a_rename_finds_nothing_new(client, lib_root):
    st = client.app.state.services.state
    assert rename(client, "walk", "stride").status_code == 200
    seq = st.seq
    st.rescan(["walk", "stride"])
    assert st.seq == seq


def test_the_warmer_skips_a_run_renamed_underneath_it(client, caplog):
    jobs = client.app.state.services.jobs
    assert rename(client, "walk", "stride").status_code == 200
    with caplog.at_level("ERROR"):
        jobs._run("walk", derived.HIGHLIGHTS, ("id", derived.HIGHLIGHTS, "d"))
    assert not caplog.records
    assert ("id", derived.HIGHLIGHTS, "d") not in jobs._failed
