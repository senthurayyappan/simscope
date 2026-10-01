import os

import pytest

from simscope.server import security

from .conftest import HOST, ORIGIN, TOKEN, make_client

GOOD_SHA = "ab" + "c" * 62


@pytest.mark.parametrize(
    "path",
    [
        "../etc/passwd",
        "runs/../../etc/passwd",
        "runs/walk/../../../etc/passwd",
        "runs/walk/..%2f..%2fx.blk",
        "runs//walk/rollout.json",
        "runs/walk/rollout.json/",
        "runs/walk/",
        "runs/",
        "runs",
        "",
        "/etc/passwd",
        "runs/walk/body_pose.blk%00.json",
        "runs/walk\\rollout.json",
        "runs/.hidden/rollout.json",
        "runs/walk/.secret.blk",
        "runs/walk/notes.txt",
        "runs/walk/rollout.json.partial",
        ".simscope/index.sqlite",
        ".simscope/derived/x/stamp.json",
        "scenes/",
        "scenes/ab/",
        f"scenes/ab/{GOOD_SHA}",  # scenes end in .json
        f"assets/ab/{GOOD_SHA}.json",  # assets have no extension
        f"assets/cd/{GOOD_SHA}",  # prefix must match the hash
        f"assets/ab/{GOOD_SHA.upper()}",
        "assets/ab/" + "c" * 10,
        "derived/walk/",
        "derived/walk/stamp.json",
        "derived/walk/_root_stats.json",
        "derived/walk/envelopes/../stamp.json",
    ],
)
def test_paths_outside_the_closed_set_are_404(client, path):
    assert security.parse_path(path) is None
    r = client.get("/files/" + path)
    assert r.status_code == 404
    assert set(r.json()) == {"error"}


def test_raw_traversal_on_the_wire(client):
    # httpx normalises "..", so send the request line by hand-encoding.
    for path in (
        "/files/%2e%2e/%2e%2e/etc/passwd",
        "/files/runs/walk/%2e%2e/%2e%2e/%2e%2e/etc/passwd",
        "/files/runs%2fwalk%2frollout.json%2f..%2f..",
    ):
        r = client.get(path)
        assert r.status_code == 404, path
        assert b"root:" not in r.content


def test_no_directory_listings(client):
    for path in ("/files/runs", "/files/runs/", "/files/runs/walk/", "/files/"):
        assert client.get(path).status_code == 404
    assert client.get("/api/blk").status_code == 400
    assert client.get("/api/blk?path=runs/walk").status_code == 400


def test_symlinks_cannot_leave_the_library(client, lib_root, tmp_path):
    outside = tmp_path / "secret.json"
    outside.write_text('{"secret": true}', encoding="utf-8")
    run = lib_root / "runs" / "walk"
    os.symlink(outside, run / "annotations.json")
    r = client.get("/files/runs/walk/annotations.json")
    assert r.status_code == 404 and b"secret" not in r.content
    # A symlink that stays inside the library is fine.
    os.unlink(run / "annotations.json")
    os.symlink(run / "rollout.json", run / "annotations.json")
    assert client.get("/files/runs/walk/annotations.json").status_code == 200
    # A run directory that points elsewhere is out of bounds too.
    other = tmp_path / "elsewhere"
    other.mkdir()
    (other / "rollout.json").write_text("{}", encoding="utf-8")
    os.symlink(other, lib_root / "runs" / "linked")
    assert client.get("/files/runs/linked/rollout.json").status_code == 404


def test_blk_routes_refuse_other_files(client):
    for path in ("runs/walk/rollout.json", "scenes/ab/x", "../x.blk", ""):
        assert client.get(f"/api/blk?path={path}").status_code == 400
        assert (
            client.get(f"/api/blocks?path={path}&w=0&envs=0").status_code == 400
        )


@pytest.mark.parametrize(
    "host",
    [
        "evil.example",
        "localhost.evil.example",
        "127.0.0.1.nip.io",
        "testserver",
    ],
)
def test_foreign_host_headers_are_rejected(client, host):
    for url in ("/", "/api/runs", "/files/runs/walk/rollout.json"):
        r = client.get(url, headers={"Host": host})
        assert r.status_code == 400, (url, host)
        assert r.json() == {"error": "invalid host"}


@pytest.mark.parametrize(
    "host", ["localhost", "localhost:8080", "127.0.0.1:9", "[::1]:8000"]
)
def test_loopback_hosts_are_accepted(client, host):
    assert client.get("/api/library", headers={"Host": host}).status_code == 200


def test_allowed_hosts_for_the_bind_address():
    assert security.allowed_hosts_for("127.0.0.1") == security.LOOPBACK_HOSTS
    assert security.allowed_hosts_for("localhost") == security.LOOPBACK_HOSTS
    assert security.allowed_hosts_for("0.0.0.0") == ("*",)
    assert security.allowed_hosts_for("::") == ("*",)
    assert "10.0.0.5" in security.allowed_hosts_for("10.0.0.5")
    assert "evil" not in security.allowed_hosts_for("10.0.0.5")


def test_wildcard_bind_accepts_any_host(lib_root):
    with make_client(lib_root, allowed_hosts=("*",)) as c:
        assert c.get("/api/library", headers={"Host": "lab.example"}).is_success


def test_host_header_parsing():
    assert security.host_of("LocalHost:80") == "localhost"
    assert security.host_of("[::1]") == "::1"
    assert security.host_of("[::1]:99") == "::1"
    assert security.host_of("a:b") is None
    assert security.host_of("[::1") is None
    assert security.host_of("") is None
    assert security.host_of(None) is None


def post(client, name="walk", body=None, headers=None):
    return client.post(
        f"/api/runs/{name}/annotations",
        json=body or {"op": "favorite", "value": True},
        headers=headers if headers is not None else ORIGIN,
    )


def test_writes_need_the_token(client):
    assert post(client).status_code == 200
    no_token = post(client, headers={"Origin": HOST})
    assert no_token.status_code == 403
    wrong = post(client, headers={**ORIGIN, "X-Simscope-Token": "nope"})
    assert wrong.status_code == 403
    assert "token" in wrong.json()["error"]


def test_writes_need_a_matching_origin(client):
    token = {"X-Simscope-Token": TOKEN}
    assert post(client, headers=token).status_code == 403  # no Origin
    for origin in (
        "http://evil.example",
        "http://localhost:9999",
        "https://localhost.evil.example",
        "null",
        "ftp://localhost",
        "localhost",
    ):
        r = post(client, headers={**token, "Origin": origin})
        assert r.status_code == 403, origin
    assert (
        post(
            client, headers={**token, "Origin": "https://localhost"}
        ).status_code
        == 200
    )


def test_rejected_writes_change_nothing(client, lib_root):
    post(client, headers={"Origin": "http://evil.example"})
    post(client, headers={"X-Simscope-Token": "bad", "Origin": HOST})
    assert not (lib_root / "runs" / "walk" / "annotations.json").exists()


def test_token_comparison_is_exact(client):
    for token in (TOKEN[:-1], TOKEN + "x", TOKEN.upper(), ""):
        r = post(client, headers={"Origin": HOST, "X-Simscope-Token": token})
        assert r.status_code == 403


def test_read_only_library_refuses_writes(lib_root):
    with make_client(lib_root) as c:
        c.app.state.services.state.writable = False
        r = post(c)
        assert r.status_code == 403 and "read-only" in r.json()["error"]
        assert c.get("/api/library").json()["writable"] is False
