import inspect

from simscope import export

HAS_UI = "ui" in inspect.signature(export.export_html).parameters
HAS_ENVS = "envs" in inspect.signature(export.export_html).parameters


def test_single_run_download(client):
    r = client.get("/api/export", params={"runs": "walk"})
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/html")
    assert (
        r.headers["content-disposition"] == 'attachment; filename="walk.html"'
    )
    assert r.headers["cache-control"] == "no-store"
    assert r.content.startswith(b"<!doctype html>")
    assert b'id="simscope-pack"' in r.content


def test_layouts_and_several_runs(client):
    r = client.get(
        "/api/export", params={"runs": "run_a,walk", "layout": "compare"}
    )
    assert r.status_code == 200
    assert 'filename="simscope-export.html"' in r.headers["content-disposition"]
    grid = client.get("/api/export", params={"runs": "run_a,walk"})
    assert grid.status_code == 200  # grid is the default for several runs
    assert (
        client.get(
            "/api/export", params={"runs": "walk", "layout": "grid"}
        ).status_code
        == 200
    )


def test_bad_requests(client):
    get = lambda **q: client.get("/api/export", params=q)  # noqa: E731
    assert get().status_code == 400
    assert get(runs="").status_code == 400
    assert get(runs="../x").status_code == 400
    assert get(runs="walk,walk").status_code == 400
    assert get(runs="ghost").status_code == 404
    assert get(runs="walk", layout="mosaic").status_code == 400
    assert get(runs="run_a,walk", layout="single").status_code == 400
    assert get(runs="walk", ui="huge").status_code == 400
    assert get(runs="walk", envs="a").status_code == 400
    assert get(runs="walk", envs="-1").status_code == 400


def test_a_recording_run_cannot_be_exported(client, live):
    live.grow(20)
    client.app.state.services.state.rescan()
    r = client.get("/api/export", params={"runs": "live"})
    assert r.status_code == 400 and "error" in r.json()


def test_ui_and_envs_until_the_export_options_land(client):
    lean = client.get("/api/export", params={"runs": "walk", "ui": "lean"})
    assert lean.status_code == 200
    full = client.get("/api/export", params={"runs": "walk", "ui": "full"})
    subset = client.get("/api/export", params={"runs": "crowd", "envs": "0,1"})
    if HAS_UI:
        assert full.status_code == 200
    else:
        assert full.status_code == 501
    if HAS_ENVS:
        assert subset.status_code == 200
    else:
        assert subset.status_code == 501
