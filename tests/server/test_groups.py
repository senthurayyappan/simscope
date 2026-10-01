import json

import pytest

from simscope import annotations

from .conftest import HOST, ORIGIN, TOKEN, make_client

RUNS = ["crowd", "run_a", "run_b", "walk"]


def post(client, body, headers=ORIGIN):
    return client.post("/api/groups", json=body, headers=headers)


def annotate(client, name, value):
    r = client.post(
        f"/api/runs/{name}/annotations",
        json={"op": "group", "value": value},
        headers=ORIGIN,
    )
    assert r.status_code == 200, r.text
    return r.json()


def listing(client):
    r = client.get("/api/groups")
    assert r.status_code == 200
    return r.json()


def names(client):
    return [g["name"] for g in listing(client)["groups"]]


def groups_file(lib_root):
    return json.loads(
        (lib_root / ".simscope" / "groups.json").read_text(encoding="utf-8")
    )


def sidecar_group(lib_root, name):
    path = lib_root / "runs" / name / "annotations.json"
    return json.loads(path.read_text(encoding="utf-8"))["marks"]["group"]


def row_group(client, name):
    rows = client.get("/api/runs").json()["runs"]
    return next(r["group"] for r in rows if r["name"] == name)


def seq(client):
    return client.get("/api/library").json()["seq"]


def test_no_groups_at_first(client):
    assert listing(client) == {"groups": [], "ungrouped": len(RUNS)}


def test_create_lists_in_order_and_writes_the_file(client, lib_root):
    before = seq(client)
    r = post(client, {"op": "create", "name": "  Vault sweep "})
    assert r.status_code == 200
    assert r.json() == {
        "groups": [{"name": "Vault sweep", "count": 0}],
        "ungrouped": len(RUNS),
    }
    post(client, {"op": "create", "name": "Crates"})
    assert names(client) == ["Vault sweep", "Crates"]
    doc = groups_file(lib_root)
    assert doc["format"] == "simscope-groups/1"
    assert [g["name"] for g in doc["groups"]] == ["Vault sweep", "Crates"]
    assert all(g["created"].endswith("Z") for g in doc["groups"])
    assert seq(client) > before  # other clients learn of it
    raw = (lib_root / ".simscope" / "groups.json").read_text(encoding="utf-8")
    assert raw == json.dumps(doc, indent=2, sort_keys=True) + "\n"
    assert not list((lib_root / ".simscope").glob("*.tmp*"))


@pytest.mark.parametrize(
    "name", ["", "   ", "x" * 65, 7, None, True, "two\nlines"]
)
def test_create_rejects_bad_names(client, name):
    r = post(client, {"op": "create", "name": name})
    assert r.status_code == 400 and "error" in r.json()
    assert listing(client)["groups"] == []


def test_names_are_unique_ignoring_case(client):
    post(client, {"op": "create", "name": "Vault"})
    r = post(client, {"op": "create", "name": "vault"})
    assert r.status_code == 409 and "exists" in r.json()["error"]
    assert names(client) == ["Vault"]
    assert post(client, {"op": "create", "name": "v" * 64}).status_code == 200


def test_move_a_run_in_and_out_counts_follow(client, lib_root):
    post(client, {"op": "create", "name": "A"})
    annotate(client, "walk", "A")
    annotate(client, "crowd", "A")
    assert listing(client) == {
        "groups": [{"name": "A", "count": 2}],
        "ungrouped": len(RUNS) - 2,
    }
    assert row_group(client, "walk") == "A"
    annotate(client, "walk", None)
    assert listing(client)["groups"] == [{"name": "A", "count": 1}]


def test_groups_runs_use_but_the_file_lacks_come_last(client, lib_root):
    # A sidecar written by hand (or by a collaborator) names a group that
    # groups.json does not list.
    post(client, {"op": "create", "name": "Zeta"})
    for run, group in (("walk", "beta"), ("crowd", "Alpha"), ("run_a", "Zeta")):
        ann = annotations.Annotations.load(
            lib_root / "runs" / run, "x", 0.02, 10
        )
        ann.marks.group = group
        ann._dirty = True
        ann.save()
    client.app.state.services.state.rescan()
    assert listing(client) == {
        "groups": [
            {"name": "Zeta", "count": 1},
            {"name": "Alpha", "count": 1},
            {"name": "beta", "count": 1},
        ],
        "ungrouped": len(RUNS) - 3,
    }


def test_rename_rewrites_every_member(client, lib_root):
    post(client, {"op": "create", "name": "Old"})
    post(client, {"op": "create", "name": "Keep"})
    for run in ("walk", "crowd"):
        annotate(client, run, "Old")
    annotate(client, "run_a", "Keep")
    before = seq(client)
    r = post(client, {"op": "rename", "name": "old", "to": " New name "})
    assert r.status_code == 200
    assert r.json()["groups"] == [
        {"name": "New name", "count": 2},
        {"name": "Keep", "count": 1},
    ]
    for run in ("walk", "crowd"):
        assert sidecar_group(lib_root, run) == "New name"
        assert row_group(client, run) == "New name"
    assert sidecar_group(lib_root, "run_a") == "Keep"
    assert [g["name"] for g in groups_file(lib_root)["groups"]] == [
        "New name",
        "Keep",
    ]
    # The clients are told which rows changed.
    body = client.get("/api/changes", params={"since": before}).json()
    assert {"walk", "crowd"} <= set(body["changed"])
    assert "run_a" not in body["changed"] and body["seq"] > before


def test_rename_errors_and_case_only_rename(client):
    post(client, {"op": "create", "name": "A"})
    post(client, {"op": "create", "name": "B"})
    taken = post(client, {"op": "rename", "name": "A", "to": "b"})
    assert taken.status_code == 409
    assert (
        post(client, {"op": "rename", "name": "Z", "to": "Y"}).status_code
        == 404
    )
    assert (
        post(client, {"op": "rename", "name": "A", "to": ""}).status_code == 400
    )
    assert post(client, {"op": "rename", "name": "A"}).status_code == 400
    assert names(client) == ["A", "B"]
    annotate(client, "walk", "A")
    assert (
        post(client, {"op": "rename", "name": "A", "to": "a"}).status_code
        == 200
    )
    assert names(client) == ["a", "B"]
    assert row_group(client, "walk") == "a"


def test_delete_ungroups_the_members(client, lib_root):
    post(client, {"op": "create", "name": "Doomed"})
    post(client, {"op": "create", "name": "Safe"})
    annotate(client, "walk", "Doomed")
    annotate(client, "crowd", "Safe")
    r = post(client, {"op": "delete", "name": "DOOMED"})
    assert r.status_code == 200
    assert r.json() == {
        "groups": [{"name": "Safe", "count": 1}],
        "ungrouped": len(RUNS) - 1,
    }
    assert sidecar_group(lib_root, "walk") is None
    assert row_group(client, "walk") is None
    assert sidecar_group(lib_root, "crowd") == "Safe"
    assert [g["name"] for g in groups_file(lib_root)["groups"]] == ["Safe"]
    assert post(client, {"op": "delete", "name": "Doomed"}).status_code == 404


def test_move_reorders(client, lib_root):
    for name in ("A", "B", "C"):
        post(client, {"op": "create", "name": name})
    assert (
        post(client, {"op": "move", "name": "C", "index": 0}).status_code == 200
    )
    assert names(client) == ["C", "A", "B"]
    post(client, {"op": "move", "name": "C", "index": 99})  # past the end
    assert names(client) == ["A", "B", "C"]
    post(client, {"op": "move", "name": "a", "index": 1})
    assert names(client) == ["B", "A", "C"]
    post(client, {"op": "move", "name": "C", "index": -5})
    assert names(client) == ["C", "B", "A"]
    assert [g["name"] for g in groups_file(lib_root)["groups"]] == names(client)
    for bad in ({"index": "1"}, {"index": 1.5}, {"index": True}, {}):
        r = post(client, {"op": "move", "name": "A", **bad})
        assert r.status_code == 400, bad
    assert (
        post(client, {"op": "move", "name": "Q", "index": 0}).status_code == 404
    )


def test_unknown_group_ops_and_bodies(client):
    for body in ({"op": "explode"}, {}, {"op": None}):
        assert post(client, body).status_code == 400
    r = client.post("/api/groups", content=b"[", headers=ORIGIN)
    assert r.status_code == 400
    r = client.post("/api/groups", content=b"[1]", headers=ORIGIN)
    assert r.status_code == 400


def test_writes_need_the_token_origin_and_a_writable_library(client, lib_root):
    body = {"op": "create", "name": "X"}
    assert client.post("/api/groups", json=body).status_code == 403
    no_token = client.post("/api/groups", json=body, headers={"Origin": HOST})
    assert no_token.status_code == 403
    wrong = client.post(
        "/api/groups",
        json=body,
        headers={"Origin": HOST, "X-Simscope-Token": "nope"},
    )
    assert wrong.status_code == 403
    evil = client.post(
        "/api/groups",
        json=body,
        headers={"Origin": "http://evil.example", "X-Simscope-Token": TOKEN},
    )
    assert evil.status_code == 403
    assert not (lib_root / ".simscope" / "groups.json").exists()
    with make_client(lib_root) as c:
        c.app.state.services.state.writable = False
        r = c.post("/api/groups", json=body, headers=ORIGIN)
        assert r.status_code == 403 and "read-only" in r.json()["error"]
        assert c.get("/api/groups").status_code == 200  # reading is fine


def test_unknown_fields_of_the_file_survive(client, lib_root):
    post(client, {"op": "create", "name": "A"})
    path = lib_root / ".simscope" / "groups.json"
    doc = json.loads(path.read_text(encoding="utf-8"))
    doc["future"] = {"x": 1}
    doc["groups"][0]["color"] = "#fff"
    path.write_text(json.dumps(doc), encoding="utf-8")
    post(client, {"op": "create", "name": "B"})
    after = json.loads(path.read_text(encoding="utf-8"))
    assert after["future"] == {"x": 1}
    assert after["groups"][0]["color"] == "#fff"
    assert [g["name"] for g in after["groups"]] == ["A", "B"]


def test_a_broken_file_is_read_as_empty_and_blocks_writes(client, lib_root):
    post(client, {"op": "create", "name": "A"})
    (lib_root / ".simscope" / "groups.json").write_text(
        "{not json", encoding="utf-8"
    )
    assert listing(client)["groups"] == []
    r = post(client, {"op": "create", "name": "B"})
    assert r.status_code == 409 and "groups.json" in r.json()["error"]
    assert (lib_root / ".simscope" / "groups.json").read_text(
        encoding="utf-8"
    ) == "{not json"


def test_a_run_that_vanished_does_not_stop_a_rename(client, lib_root):
    import shutil

    post(client, {"op": "create", "name": "G"})
    annotate(client, "walk", "G")
    annotate(client, "crowd", "G")
    shutil.rmtree(lib_root / "runs" / "walk")  # gone before the next scan
    r = post(client, {"op": "rename", "name": "G", "to": "H"})
    assert r.status_code == 200
    assert sidecar_group(lib_root, "crowd") == "H"
