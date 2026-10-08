"""Serving a folder that contains nested rollout libraries."""

from simscope import library

from .conftest import make_client, record


def test_lists_and_reads_a_nested_rollout(tmp_path):
    stamp = "20261002-131651-488607Z"
    nested = tmp_path / "position_vault_barkour" / "cad" / stamp
    lib = library.Library(nested)
    record(lib, stamp, 12, 1, seed=4)
    lib.close()
    with make_client(tmp_path) as client:
        body = client.get("/api/runs").json()
        assert [row["name"] for row in body["runs"]] == [stamp]
        assert body["runs"][0]["n_frames"] == 12
        manifest = client.get(f"/files/runs/{stamp}/rollout.json")
        assert manifest.status_code == 200
        assert manifest.json()["name"] == stamp
        sha = manifest.json()["scene"]["sha256"]
        scene = client.get(f"/files/scenes/{sha[:2]}/{sha}.json")
        assert scene.status_code == 200
        blk = client.get(f"/files/runs/{stamp}/body_pose.blk")
        assert blk.status_code == 200 and blk.content


def test_rescan_sees_a_library_added_under_the_root(client, lib_root):
    nested = lib_root / "experiments" / "cad" / "extra"
    lib = library.Library(nested)
    record(lib, "extra", 8, 1, seed=5)
    lib.close()
    state = client.app.state.services.state
    assert state.rescan() is True
    names = {row["name"] for row in client.get("/api/runs").json()["runs"]}
    assert "extra" in names and "walk" in names
    assert client.get("/files/runs/extra/rollout.json").status_code == 200
    manifest = client.get("/files/runs/extra/rollout.json").json()
    sha = manifest["scene"]["sha256"]
    assert client.get(f"/files/scenes/{sha[:2]}/{sha}.json").status_code == 200
