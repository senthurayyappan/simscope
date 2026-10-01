import json

from simscope.io import manifest

from .conftest import make_client


def test_library_info(client, lib_root):
    body = client.get("/api/library").json()
    assert body["name"] == "lib"
    assert body["n_runs"] == 4
    assert body["writable"] is True
    assert body["root"].endswith("lib")
    assert isinstance(body["seq"], int)


def test_runs_rows_and_etag(client):
    r = client.get("/api/runs")
    assert r.status_code == 200
    data = r.json()
    names = {row["name"] for row in data["runs"]}
    assert names == {"run_a", "run_b", "walk", "crowd"}
    assert data["seq"] == client.get("/api/library").json()["seq"]
    walk = next(row for row in data["runs"] if row["name"] == "walk")
    assert walk == {
        "name": "walk",
        "id": walk["id"],
        "created": walk["created"],
        "status": "complete",
        "dt": walk["dt"],
        "n_frames": 40,
        "n_envs": 1,
        "n_bodies": 3,
        "favorite": False,
        "group": None,
        "rating": None,
        "tags": ["sweep"],
        "n_notes": 0,
        "n_highlights": None,
        "simulator": "mujoco",
        "importer": None,
        "streams": ["body_pose", "contacts", "joint", "reward"],
    }
    assert abs(walk["dt"] - 0.02) < 1e-6
    etag = r.headers["etag"]
    r2 = client.get("/api/runs", headers={"If-None-Match": etag})
    assert r2.status_code == 304 and r2.content == b""
    assert client.get("/api/runs").headers["etag"] == etag


def test_runs_newest_first(client):
    created = [r["created"] for r in client.get("/api/runs").json()["runs"]]
    assert created == sorted(created, reverse=True)


def test_runs_gzip(client):
    r = client.get("/api/runs", headers={"Accept-Encoding": "gzip"})
    assert r.headers["content-encoding"] == "gzip"
    assert r.json()["runs"]
    raw = client.get("/api/runs", headers={"Accept-Encoding": "identity"})
    assert "content-encoding" not in raw.headers
    assert r.json() == raw.json()


def test_page_carries_the_boot_block(client):
    r = client.get("/")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/html")
    html = r.text
    start = html.index('<script id="simscope-boot" type="application/json">')
    body = html[html.index(">", start) + 1 : html.index("</script>", start)]
    assert json.loads(body) == {
        "mode": "http",
        "base": "",
        "token": "test-token",
        "library": "lib",
        "writable": True,
    }
    assert "/assets/simscope-app.js" in html
    assert "/assets/simscope-app.css" in html


def test_boot_block_escapes_markup(tmp_path):
    root = tmp_path / "x<b>&y"
    root.mkdir()
    with make_client(root) as c:
        html = c.get("/").text
    assert "x<b>" not in html.split('type="application/json">')[1]
    assert "x\\u003cb\\u003e\\u0026y" in html


def test_assets(client):
    for name in ("simscope-app.js", "simscope-app.css", "simscope-player.js"):
        r = client.get(f"/assets/{name}")
        assert r.status_code == 200, name
        assert r.headers["cache-control"] == "no-cache"
        assert r.headers["etag"]
        again = client.get(
            f"/assets/{name}", headers={"If-None-Match": r.headers["etag"]}
        )
        assert again.status_code == 304
    assert client.get("/assets/simscope-web.LICENSES.txt").status_code == 404
    assert client.get("/assets/nope.js").status_code == 404


def test_rollout_json_and_etag(client, lib_root):
    r = client.get("/files/runs/walk/rollout.json")
    assert r.status_code == 200
    assert r.json()["name"] == "walk"
    assert r.headers["content-type"].startswith("application/json")
    assert r.headers["cache-control"] == "no-cache"
    r2 = client.get(
        "/files/runs/walk/rollout.json",
        headers={"If-None-Match": r.headers["etag"]},
    )
    assert r2.status_code == 304
    assert r2.headers["etag"] == r.headers["etag"]
    stale = client.get(
        "/files/runs/walk/rollout.json", headers={"If-None-Match": '"zzz"'}
    )
    assert stale.status_code == 200


def test_blk_range_requests(client, lib_root):
    path = lib_root / "runs" / "walk" / "body_pose.blk"
    data = path.read_bytes()
    r = client.get("/files/runs/walk/body_pose.blk")
    assert r.status_code == 200 and r.content == data
    assert r.headers["accept-ranges"] == "bytes"
    part = client.get(
        "/files/runs/walk/body_pose.blk", headers={"Range": "bytes=64-127"}
    )
    assert part.status_code == 206
    assert part.content == data[64:128]
    assert part.headers["content-range"] == f"bytes 64-127/{len(data)}"
    tail = client.get(
        "/files/runs/walk/body_pose.blk", headers={"Range": "bytes=-32"}
    )
    assert tail.status_code == 206 and tail.content == data[-32:]
    bad = client.get(
        "/files/runs/walk/body_pose.blk",
        headers={"Range": f"bytes={len(data) + 5}-"},
    )
    assert bad.status_code == 416


def test_cas_paths_are_immutable(client, lib_root):
    scene_files = sorted((lib_root / "scenes").rglob("*.json"))
    assets = sorted(p for p in (lib_root / "assets").rglob("*") if p.is_file())
    assert scene_files and assets
    for path, rel in [
        (scene_files[0], scene_files[0].relative_to(lib_root)),
        (assets[0], assets[0].relative_to(lib_root)),
    ]:
        r = client.get(f"/files/{rel.as_posix()}")
        assert r.status_code == 200
        assert r.content == path.read_bytes()
        assert (
            r.headers["cache-control"] == "public, max-age=31536000, immutable"
        )
        assert r.headers["etag"]


def test_scene_referenced_by_a_manifest_is_reachable(client):
    m = client.get("/files/runs/run_a/rollout.json").json()
    sha = m["scene"]["sha256"]
    r = client.get(f"/files/scenes/{sha[:2]}/{sha}.json")
    assert r.status_code == 200
    assert r.json()["format"].startswith("simscope-scene/")


def test_missing_annotations_is_404_then_served(client, lib_root):
    assert client.get("/files/runs/walk/annotations.json").status_code == 404
    (lib_root / "runs" / "walk" / "annotations.json").write_text("{}")
    assert client.get("/files/runs/walk/annotations.json").status_code == 200


def test_recording_run_serves_the_partial_manifest(client, live):
    live.grow(20)
    r = client.get("/files/runs/live/rollout.json")
    assert r.status_code == 200
    m = r.json()
    assert m["status"] == "recording" and m["n_frames"] == 20
    live.finish()
    m = client.get("/files/runs/live/rollout.json").json()
    assert m["status"] == "complete"
    assert not (live.rec.path / manifest.PARTIAL_NAME).exists()


def test_growing_blk_is_sent_up_to_its_size(client, live):
    live.grow(20)
    r = client.get("/files/runs/live/body_pose.blk")
    assert r.status_code == 200
    size = (live.rec.path / "body_pose.blk").stat().st_size
    assert len(r.content) == size == int(r.headers["content-length"])


def test_errors_are_json(client):
    for url in ("/nope", "/files/", "/files/runs/walk", "/api/runs/walk"):
        r = client.get(url)
        assert r.status_code in (404, 405), url
        assert set(r.json()) == {"error"}
    assert client.post("/api/runs").status_code == 405
