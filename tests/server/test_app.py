import http.client
import json
import threading
import time

import pytest
import uvicorn

from simscope import library, server

from .conftest import make_client, record


def test_empty_library_and_missing_folder(tmp_path):
    empty = tmp_path / "empty"
    empty.mkdir()
    with make_client(empty) as c:
        assert c.get("/api/runs").json()["runs"] == []
        assert c.get("/api/library").json()["n_runs"] == 0
        assert (
            c.get("/api/changes", params={"since": 0}).json()["changed"] == []
        )
        assert c.get("/").status_code == 200
    with pytest.raises(FileNotFoundError):
        server.create_app(tmp_path / "nope")


def test_a_library_that_gets_its_first_run_while_served(tmp_path):
    root = tmp_path / "fresh"
    root.mkdir()
    with make_client(root, watch=True) as c:
        seq = c.get("/api/library").json()["seq"]
        lib = library.Library(root)
        record(lib, "first", 10, 1, seed=1)
        lib.close()
        end = time.monotonic() + 10
        while time.monotonic() < end:
            body = c.get("/api/changes", params={"since": seq}).json()
            if body["changed"]:
                break
            time.sleep(0.05)
        assert body["changed"] == ["first"]
        assert [r["name"] for r in c.get("/api/runs").json()["runs"]] == [
            "first"
        ]


def test_invalid_manifest_shows_as_an_invalid_row(tmp_path):
    root = tmp_path / "bad"
    (root / "runs" / "broken").mkdir(parents=True)
    (root / "runs" / "broken" / "rollout.json").write_text(
        "{nope", encoding="utf-8"
    )
    with make_client(root) as c:
        rows = c.get("/api/runs").json()["runs"]
        assert rows[0]["name"] == "broken" and rows[0]["status"] == "invalid"
        assert rows[0]["streams"] == []


def test_head_requests(client):
    r = client.head("/files/runs/walk/rollout.json")
    assert r.status_code == 200 and r.content == b""
    assert int(r.headers["content-length"]) > 0


def test_real_uvicorn_server(lib_root):
    app = server.create_app(lib_root, token="t", warm=False)
    srv = uvicorn.Server(
        uvicorn.Config(app, port=0, log_level="error", access_log=False)
    )
    thread = threading.Thread(target=srv.run, daemon=True)
    thread.start()
    end = time.monotonic() + 10
    while not srv.started and time.monotonic() < end:
        time.sleep(0.01)
    assert srv.started
    port = srv.servers[0].sockets[0].getsockname()[1]
    try:
        conn = http.client.HTTPConnection("127.0.0.1", port)
        conn.request("GET", "/api/runs")
        resp = conn.getresponse()
        rows = json.loads(resp.read())["runs"]
        assert resp.status == 200 and len(rows) == 4
        conn.request(
            "GET",
            "/files/runs/walk/body_pose.blk",
            headers={"Range": "bytes=0-3"},
        )
        resp = conn.getresponse()
        assert resp.status == 206 and resp.read() == b"SSBK"
        conn.request("GET", "/api/runs", headers={"Host": "evil.example"})
        resp = conn.getresponse()
        resp.read()
        assert resp.status == 400
        conn.close()
    finally:
        srv.should_exit = True
        thread.join(timeout=15)
    assert not thread.is_alive()  # the lifespan shut the watcher down too


def test_block_file_without_a_header_yet_is_404(client, lib_root):
    (lib_root / "runs" / "walk" / "reward.blk").write_bytes(b"SS")
    r = client.get("/api/blk", params={"path": "runs/walk/reward.blk"})
    assert r.status_code == 404
