import json

import pytest

from simscope import annotations

from .conftest import ORIGIN


def post(client, body, name="walk"):
    return client.post(
        f"/api/runs/{name}/annotations", json=body, headers=ORIGIN
    )


def sidecar(lib_root, name="walk"):
    return json.loads(
        (lib_root / "runs" / name / "annotations.json").read_text()
    )


def row(client, name="walk"):
    return next(
        r for r in client.get("/api/runs").json()["runs"] if r["name"] == name
    )


def test_favorite_and_the_row_follows_at_once(client, lib_root):
    seq = client.get("/api/library").json()["seq"]
    r = post(client, {"op": "favorite", "value": True})
    assert r.status_code == 200
    assert r.json()["marks"]["favorite"] is True
    assert sidecar(lib_root)["marks"]["favorite"] is True
    assert row(client)["favorite"] is True  # no waiting for the watcher
    assert client.get("/api/library").json()["seq"] > seq
    post(client, {"op": "favorite", "value": False})
    assert row(client)["favorite"] is False


def test_rate_uses_the_overall_stars_and_the_server_author(client, lib_root):
    r = post(client, {"op": "rate", "value": 4})
    assert r.status_code == 200
    rating = sidecar(lib_root)["ratings"][0]
    assert rating["criterion"] == "overall" and rating["scale"] == "stars5"
    assert rating["value"] == 4 and rating["author"] == "ada"
    assert row(client)["rating"] == 4
    post(client, {"op": "rate", "value": 2})
    assert len(sidecar(lib_root)["ratings"]) == 1  # replaced, not appended
    assert row(client)["rating"] == 2


@pytest.mark.parametrize("value", [0, 6, "4", True, None, 2.5])
def test_rate_rejects_bad_values(client, lib_root, value):
    assert post(client, {"op": "rate", "value": value}).status_code == 400
    assert not (lib_root / "runs" / "walk" / "annotations.json").exists()


@pytest.mark.parametrize(
    "op",
    [
        {"op": "tag_add", "tag": "keep"},
        {"op": "tag_remove", "tag": "keep"},
        {"op": "status", "value": "candidate"},
        {"op": "flag", "value": "review"},
    ],
)
def test_the_curation_ops_of_v3_are_gone(client, lib_root, op):
    r = post(client, op)
    assert r.status_code == 400
    assert r.json() == {"error": f"unsupported op {op['op']!r}"}
    assert not (lib_root / "runs" / "walk" / "annotations.json").exists()


def test_a_run_row_has_no_flag_or_status_but_a_group(client):
    keys = set(row(client))
    assert not {"flag", "mark_status"} & keys
    assert row(client)["group"] is None
    assert row(client)["tags"] == ["sweep"]  # record-time tags only


def test_deprecated_marks_are_kept_when_the_sidecar_is_saved(client, lib_root):
    marks = {"favorite": False, "flag": "review", "status": "candidate"}
    marks["tags"] = ["old"]
    path = lib_root / "runs" / "walk" / "annotations.json"
    ann = annotations.Annotations.load(path.parent, "x", 0.02, 40)
    ann.marks = annotations.Marks.from_json(marks)
    ann._dirty = True
    ann.save()
    post(client, {"op": "favorite", "value": True})
    saved = sidecar(lib_root)["marks"]
    assert saved["flag"] == "review" and saved["status"] == "candidate"
    assert saved["tags"] == ["old"] and saved["favorite"] is True
    assert row(client)["tags"] == ["sweep"]  # still record-time only


def test_group_op_moves_a_run_and_creates_the_group(client, lib_root):
    r = post(client, {"op": "group", "value": "Vault sweep"})
    assert r.status_code == 200
    assert r.json()["marks"]["group"] == "Vault sweep"
    assert sidecar(lib_root)["marks"]["group"] == "Vault sweep"
    assert row(client)["group"] == "Vault sweep"
    n_runs = len(client.get("/api/runs").json()["runs"])
    listed = client.get("/api/groups").json()
    assert listed == {
        "groups": [{"name": "Vault sweep", "count": 1}],
        "ungrouped": n_runs - 1,
    }
    assert (lib_root / ".simscope" / "groups.json").is_file()
    # The spelling the library has wins, whatever case the client sends.
    post(client, {"op": "group", "value": "vault SWEEP"}, name="crowd")
    assert row(client, "crowd")["group"] == "Vault sweep"
    r = post(client, {"op": "group", "value": None})
    assert r.json()["marks"]["group"] is None
    assert row(client)["group"] is None
    assert client.get("/api/groups").json()["groups"] == [
        {"name": "Vault sweep", "count": 1}
    ]  # an emptied group stays


@pytest.mark.parametrize("value", ["", "  ", "x" * 65, 3, True, "a\nb"])
def test_group_op_rejects_bad_names(client, lib_root, value):
    assert post(client, {"op": "group", "value": value}).status_code == 400
    assert not (lib_root / "runs" / "walk" / "annotations.json").exists()
    assert not (lib_root / ".simscope" / "groups.json").exists()


def test_notes(client, lib_root):
    r = post(client, {"op": "note_add", "text": "left foot slips"})
    assert r.json()["notes"][0]["text"] == "left foot slips"
    assert r.json()["notes"][0]["author"] == "ada"
    assert row(client)["n_notes"] == 1
    assert post(client, {"op": "note_add", "text": " "}).status_code == 400


def test_events_and_remove(client, lib_root):
    r = post(
        client,
        {"op": "event_add", "t0": 0.5, "t1": None, "type": "fall",
         "label": "fell", "env": None},
    )  # fmt: skip
    assert r.status_code == 200
    event = sidecar(lib_root)["events"][0]
    assert event["t0"] == event["t1"] == 0.5
    assert event["f0"] == 25 and event["type"] == "fall"
    post(
        client,
        {
            "op": "event_add",
            "t0": 0.2,
            "t1": 0.4,
            "type": "",
            "label": "",
            "env": 0,
        },
    )
    assert len(sidecar(lib_root)["events"]) == 2
    done = post(client, {"op": "remove", "id": event["id"]})
    assert done.status_code == 200
    assert [e["t0"] for e in sidecar(lib_root)["events"]] == [0.2]
    assert post(client, {"op": "remove", "id": "01NOPE"}).status_code == 404
    bad = post(
        client,
        {"op": "event_add", "t0": 1.0, "t1": 0.5, "type": "x", "label": ""},
    )
    assert bad.status_code == 400
    assert (
        post(client, {"op": "event_add", "t0": "x", "type": "x"}).status_code
        == 400
    )


def test_response_is_the_new_annotations_object(client, lib_root):
    post(client, {"op": "favorite", "value": True})
    body = post(client, {"op": "note_add", "text": "a"}).json()
    assert body == sidecar(lib_root)
    assert body["format"] == annotations.ANNOTATIONS_FORMAT


def test_labels_are_untyped_events_that_can_be_edited(client, lib_root):
    def add(**fields):
        body = {"op": "event_add", "type": "", "env": None, "t1": None}
        return post(client, {**body, **fields}).json()["events"][-1]

    label = add(t0=0.5, label="touchdown")
    assert (label["type"], label["t0"], label["t1"]) == ("", 0.5, 0.5)
    assert label["f0"] == 25
    got = post(client, {"op": "event_update", "id": label["id"], "label": "x"})
    assert got.json()["events"][0]["label"] == "x"
    # Moving an instant keeps it an instant, and snaps the frames again.
    moved = post(client, {"op": "event_update", "id": label["id"], "t0": 0.7})
    event = moved.json()["events"][0]
    assert (event["t0"], event["t1"], event["f0"], event["f1"]) == (
        0.7, 0.7, 35, 35,
    )  # fmt: skip
    assert event["updated"] >= label["updated"]
    # A span can end later, and go back to an instant with null.
    span = post(
        client, {"op": "event_update", "id": label["id"], "t1": 1.2}
    ).json()["events"][0]
    assert (span["t0"], span["t1"]) == (0.7, 1.2)
    back = post(
        client, {"op": "event_update", "id": label["id"], "t1": None}
    ).json()["events"][0]
    assert back["t1"] == back["t0"] == 0.7
    assert sidecar(lib_root)["events"][0]["label"] == "x"


def test_event_update_errors(client):
    add = {"op": "event_add", "type": "", "t0": 0.5, "label": "a"}
    event_id = post(client, add).json()["events"][0]["id"]
    assert post(client, {"op": "event_update", "label": "x"}).status_code == 400
    missing = {"op": "event_update", "id": "01NOPE", "label": "x"}
    assert post(client, missing).status_code == 404
    for bad in ({"label": 3}, {"t0": "x"}, {"t0": 2.0, "t1": 1.0}):
        r = post(client, {"op": "event_update", "id": event_id, **bad})
        assert r.status_code == 400, bad


def test_unknown_ops_and_malformed_bodies(client):
    assert post(client, {"op": "explode"}).status_code == 400
    assert post(client, {}).status_code == 400
    r = client.post("/api/runs/walk/annotations", content=b"{", headers=ORIGIN)
    assert r.status_code == 400
    r = client.post(
        "/api/runs/walk/annotations", content=b"[1]", headers=ORIGIN
    )
    assert r.status_code == 400
    big = b'{"op":"note_add","text":"' + b"x" * 70000 + b'"}'
    r = client.post("/api/runs/walk/annotations", content=big, headers=ORIGIN)
    assert r.status_code == 413


def test_unknown_and_invalid_runs(client):
    assert (
        post(client, {"op": "favorite", "value": True}, "ghost").status_code
        == 404
    )
    assert (
        post(client, {"op": "favorite", "value": True}, "..x").status_code
        == 404
    )
    assert (
        post(client, {"op": "favorite", "value": True}, "bad name").status_code
        == 404
    )


def test_recording_run_can_be_annotated(client, live):
    live.grow(20)
    client.app.state.services.state.rescan()
    assert (
        post(client, {"op": "favorite", "value": True}, "live").status_code
        == 200
    )
    assert (live.rec.path / "annotations.json").exists()
    live.finish()


def test_existing_sidecar_is_kept(client, lib_root):
    post(client, {"op": "note_add", "text": "first"})
    data = sidecar(lib_root)
    data["extra_field"] = {"kept": True}
    (lib_root / "runs" / "walk" / "annotations.json").write_text(
        json.dumps(data)
    )
    post(client, {"op": "favorite", "value": True})
    after = sidecar(lib_root)
    assert after["extra_field"] == {"kept": True}
    assert after["notes"][0]["text"] == "first"


def test_a_corrupt_sidecar_is_a_409_and_left_alone(client, lib_root):
    path = lib_root / "runs" / "walk" / "annotations.json"
    path.write_text("{ broken")
    assert post(client, {"op": "favorite", "value": True}).status_code == 409
    assert path.read_text() == "{ broken"
