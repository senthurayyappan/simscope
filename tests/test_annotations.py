import json

import pytest

from simscope import annotations
from simscope.io import errors

RUN_ID = "01J9Z3TESTRUN00000000000000"


def make(tmp_path, n_frames=1000, dt=0.02, run_id=RUN_ID):
    run_dir = tmp_path / "run"
    run_dir.mkdir(exist_ok=True)
    return annotations.Annotations.load(run_dir, run_id, dt, n_frames)


def test_missing_file_is_empty_and_save_is_lazy(tmp_path):
    ann = make(tmp_path)
    assert ann.notes == [] and ann.marks.tags == []
    assert ann.save() is False
    assert not ann.path.exists()
    ann.set_favorite()
    assert ann.dirty and ann.save() is True
    assert ann.path.exists() and not ann.dirty


def test_round_trip_and_file_format(tmp_path):
    ann = make(tmp_path)
    ann.set_favorite()
    ann.set_group("Vault sweep")
    note = ann.add_note("Front-left foot slips.", author="ada")
    ann.rate(4, rationale="clean gait", author="ada")
    ev = ann.add_event(
        "fall", t0=3.2, label="falls", props={"a": 1}, author="ada"
    )
    sp = ann.add_spatial(
        "box",
        [0.4, 0.1, 0.02],
        t=3.2,
        size=[1, 1, 1],
        event=ev.id,
        author="ada",
    )
    ann.save()

    raw = ann.path.read_text()
    assert raw.endswith("\n") and not raw.endswith("\n\n")
    obj = json.loads(raw)
    assert obj["format"] == "simscope-annotations/1"
    assert obj["run_id"] == RUN_ID
    assert obj["marks"] == {
        "favorite": True,
        "group": "Vault sweep",
        "flag": None,
        "status": None,
        "tags": [],
    }
    assert raw == json.dumps(obj, indent=2, sort_keys=True) + "\n"
    assert set(obj["events"][0]) >= {
        "id", "author", "created", "updated", "type", "label",
        "t0", "t1", "f0", "f1", "env", "props",
    }  # fmt: skip

    again = annotations.Annotations.load(ann.path.parent, RUN_ID, 0.02, 1000)
    assert again.to_json() == ann.to_json()
    assert again.notes[0].id == note.id
    assert again.spatial[0].id == sp.id and again.spatial[0].event == ev.id
    assert again.events[0].env is None
    assert not again.id_mismatch


def test_lists_sorted_by_id_on_write(tmp_path):
    ann = make(tmp_path)
    for i in range(5):
        ann.add_note(f"n{i}", author="ada")
    ann.notes.reverse()
    ann.save()
    ids = [n["id"] for n in json.loads(ann.path.read_text())["notes"]]
    assert ids == sorted(ids)


def test_event_snapping_and_validation(tmp_path):
    ann = make(tmp_path, n_frames=100, dt=0.02)
    ev = ann.add_event("fall", t0=3.2, author="ada")
    assert (ev.t0, ev.t1, ev.f0, ev.f1) == (3.2, 3.2, 99, 99)  # clipped
    half = make(tmp_path, n_frames=10, dt=0.5)
    ev = half.add_event(t0=0.25, t1=0.75, author="ada")
    assert (ev.f0, ev.f1) == (1, 2)  # halves round up
    ev = ann.add_event(t0=-1.0, t1=0.0, author="ada")
    assert ev.f0 == 0 and ev.f1 == 0
    with pytest.raises(ValueError, match="t0 <= t1"):
        ann.add_event(t0=2.0, t1=1.0, author="ada")
    with pytest.raises(ValueError, match="finite"):
        ann.add_event(t0=float("nan"), author="ada")

    long_run = make(tmp_path, n_frames=1000)
    ev = long_run.add_event(t0=3.2, author="ada")
    assert ev.f0 == 160

    upd = long_run.update_event(ev.id, t1=4.0, label="x")
    assert (upd.t0, upd.t1, upd.f0, upd.f1, upd.label) == (
        3.2,
        4.0,
        160,
        200,
        "x",
    )
    with pytest.raises(ValueError, match="t0 <= t1"):
        long_run.update_event(ev.id, t0=5.0)
    with pytest.raises(ValueError, match="cannot update"):
        long_run.update_event(ev.id, id="z")
    with pytest.raises(KeyError):
        long_run.update_event("nope", label="x")


def test_rating_replaces_per_author_and_criterion(tmp_path):
    ann = make(tmp_path)
    first = ann.rate(3, author="ada")
    second = ann.rate(5, rationale="better", author="ada")
    assert second.id == first.id and len(ann.ratings) == 1
    assert ann.ratings[0].value == 5 and ann.ratings[0].rationale == "better"
    ann.rate(2, author="bob")
    ann.rate(80, criterion="gait", scale="score100", author="ada")
    ann.rate(-1, criterion="safe", scale="thumb", author="ada")
    assert len(ann.ratings) == 4
    bads = [(0, "stars5"), (6, "stars5"), (2.5, "stars5"), (101, "score100")]
    for bad in [*bads, (0, "thumb"), (1, "wat")]:
        with pytest.raises(ValueError):
            ann.rate(bad[0], scale=bad[1], author="ada")


def test_group_mark(tmp_path):
    ann = make(tmp_path)
    assert ann.marks.group is None
    ann.set_group("  Vault sweep ")
    assert ann.marks.group == "Vault sweep" and ann.dirty
    ann.save()
    again = annotations.Annotations.load(ann.path.parent, RUN_ID, 0.02, 1000)
    assert again.marks.group == "Vault sweep"
    again.set_group(None)
    assert again.marks.group is None
    for bad in ("", "   ", "x" * 65, "a\tb"):
        with pytest.raises(ValueError):
            again.set_group(bad)
    assert again.marks.group is None
    again.set_group("x" * 64)  # the longest name there is


def test_a_sidecar_without_a_group_still_loads(tmp_path):
    run_dir = tmp_path / "run"
    run_dir.mkdir()
    obj = {
        "format": "simscope-annotations/1",
        "run_id": RUN_ID,
        "marks": {"favorite": True, "flag": None, "status": None, "tags": []},
    }
    (run_dir / "annotations.json").write_text(json.dumps(obj))
    ann = annotations.Annotations.load(run_dir, RUN_ID, 0.02, 10)
    assert ann.marks.favorite and ann.marks.group is None


def test_deprecated_marks_are_read_and_written_back(tmp_path):
    # Viewer v3.1 dropped flag, status and curation tags: nothing sets them
    # any more, but a file that has them keeps them (spec 3.2).
    run_dir = tmp_path / "run"
    run_dir.mkdir()
    marks = {
        "favorite": False,
        "flag": "review",
        "status": "candidate",
        "tags": ["b", "a", "a"],
        "color": "red",
    }
    obj = {"format": "simscope-annotations/1", "run_id": RUN_ID, "marks": marks}
    (run_dir / "annotations.json").write_text(json.dumps(obj))
    ann = annotations.Annotations.load(run_dir, RUN_ID, 0.02, 10)
    assert (ann.marks.flag, ann.marks.status) == ("review", "candidate")
    assert ann.marks.tags == ["a", "b"] and ann.marks.extra == {"color": "red"}
    ann.set_group("G")
    ann.save()
    saved = json.loads((run_dir / "annotations.json").read_text())["marks"]
    assert saved == {
        "favorite": False,
        "group": "G",
        "flag": "review",
        "status": "candidate",
        "tags": ["a", "b"],
        "color": "red",
    }
    assert not hasattr(ann, "add_tag") and not hasattr(ann, "set_status")


def test_remove_and_get(tmp_path):
    ann = make(tmp_path)
    note = ann.add_note("hi", author="ada")
    ev = ann.add_event(t0=1, author="ada")
    assert ann.remove(note.id) is True
    assert ann.remove(note.id) is False
    assert ann.get(ev.id) is ev
    with pytest.raises(KeyError):
        ann.get(note.id)


def test_spatial_validation(tmp_path):
    ann = make(tmp_path)
    p = ann.add_spatial("point", (0, 0, 1), t=1.0, frame="body:3", author="ada")
    assert p.size is None and p.f == 50 and p.env == 0
    with pytest.raises(ValueError):
        ann.add_spatial("box", (0, 0, 0), t=0, author="ada")
    with pytest.raises(ValueError):
        ann.add_spatial("point", (0, 0, 0), t=0, size=(1, 1, 1), author="ada")
    with pytest.raises(ValueError):
        ann.add_spatial("point", (0, 0, 0), t=0, frame="local", author="ada")
    with pytest.raises(ValueError):
        ann.add_spatial("sphere", (0, 0, 0), t=0, author="ada")
    with pytest.raises(ValueError):
        ann.add_spatial("point", (0, 0), t=0, author="ada")


def test_unknown_fields_preserved(tmp_path):
    run_dir = tmp_path / "run"
    run_dir.mkdir()
    src = {
        "format": "simscope-annotations/1.3",
        "run_id": RUN_ID,
        "future_top": {"x": [1, 2]},
        "marks": {"favorite": True, "color": "red", "tags": ["z", "a"]},
        "notes": [
            {
                "id": "01B",
                "author": "ada",
                "created": "2026-01-01T00:00:00Z",
                "updated": "2026-01-01T00:00:00Z",
                "text": "hello",
                "pinned": True,
            }
        ],
        "events": [],
    }
    (run_dir / "annotations.json").write_text(json.dumps(src))
    ann = annotations.Annotations.load(run_dir, RUN_ID, 0.02, 100)
    ann.add_note("another", author="bob")
    ann.save()
    out = json.loads((run_dir / "annotations.json").read_text())
    assert out["future_top"] == {"x": [1, 2]}
    assert out["marks"]["color"] == "red"
    assert out["marks"]["tags"] == ["a", "z"]
    assert out["notes"][0]["pinned"] is True
    assert out["format"] == "simscope-annotations/1"


def test_invalid_files_raise(tmp_path):
    run_dir = tmp_path / "run"
    run_dir.mkdir()
    path = run_dir / "annotations.json"
    path.write_text("{oops")
    with pytest.raises(errors.FormatError):
        annotations.Annotations.load(run_dir, RUN_ID, 0.02, 10)
    path.write_text(json.dumps({"format": "other/1"}))
    with pytest.raises(errors.FormatError):
        annotations.Annotations.load(run_dir, RUN_ID, 0.02, 10)
    path.write_text(json.dumps({"format": "simscope-annotations/2"}))
    with pytest.raises(errors.FormatError):
        annotations.Annotations.load(run_dir, RUN_ID, 0.02, 10)
    path.write_text(
        json.dumps({"format": "simscope-annotations/1", "notes": [{"id": "x"}]})
    )
    with pytest.raises(errors.FormatError):
        annotations.Annotations.load(run_dir, RUN_ID, 0.02, 10)


def test_run_id_mismatch_flagged(tmp_path, caplog):
    ann = make(tmp_path)
    ann.add_note("x", author="ada")
    ann.save()
    with caplog.at_level("WARNING"):
        other = annotations.Annotations.load(ann.path.parent, "OTHER", 0.02, 10)
    assert other.id_mismatch and "belongs to run" in caplog.text
    assert len(other.notes) == 1
    other.set_favorite()
    other.save()
    assert json.loads(ann.path.read_text())["run_id"] == "OTHER"


def test_two_authors_concurrent_edits_then_merge(tmp_path):
    base = make(tmp_path)
    shared = base.add_note("shared note", author="ada")
    shared_ev = base.add_event("fall", t0=1.0, author="ada")
    doomed = base.add_note("to delete", author="ada")
    base.marks.tags = ["base_tag"]  # deprecated, but old files have them
    base.marks.status = "candidate"
    base.set_group("Start")
    base.save()
    run_dir = base.path.parent

    def edit(author, fname):
        ann = annotations.Annotations.load(run_dir, RUN_ID, 0.02, 1000)
        ann.path = run_dir / fname  # each author saves their own copy
        ann.add_note(f"note by {author}", author=author)
        ann.add_event("slip", t0=2.0, label=author, author=author)
        ann.rate(4 if author == "ada" else 2, author=author)
        ann.marks.tags = [*ann.marks.tags, f"tag_{author}"]
        return ann

    a, b = edit("ada", "a.json"), edit("bob", "b.json")
    a.update_event(shared_ev.id, label="ada was here")
    b.remove(doomed.id)
    b.marks.status = "rejected"
    b.set_group("Bob's group")
    b.set_favorite()
    a.save()
    b.save()

    merged = annotations.merge(a, b, base=base)
    assert sorted(n.text for n in merged.notes) == [
        "note by ada", "note by bob", "shared note"
    ]  # fmt: skip
    assert doomed.id not in {n.id for n in merged.notes}
    assert shared.id in {n.id for n in merged.notes}
    assert len(merged.events) == 3
    assert merged.get(shared_ev.id).label == "ada was here"
    assert {r.author for r in merged.ratings} == {"ada", "bob"}
    assert merged.marks.tags == ["base_tag", "tag_ada", "tag_bob"]
    assert merged.marks.status == "rejected" and merged.marks.favorite
    # Only bob moved the run: the group follows the side that changed it.
    assert merged.marks.group == "Bob's group"
    assert annotations.merge(b, a, base=base).marks.group == "Bob's group"
    assert annotations.merge(a, b).marks.group == "Bob's group"  # b wins
    ids = [n.id for n in merged.notes]
    assert ids == sorted(ids)
    assert merged.dirty
    merged.path = base.path
    merged.save()
    reloaded = annotations.Annotations.load(run_dir, RUN_ID, 0.02, 1000)
    assert reloaded.to_json() == merged.to_json()

    # Without a base a deletion cannot be told apart from a missing add.
    loose = annotations.merge(a, b)
    assert doomed.id in {n.id for n in loose.notes}
    # The inputs were not modified.
    assert len(a.notes) == 3 and len(b.notes) == 2


def test_merge_same_id_newer_wins_and_rating_dedupe(tmp_path):
    a = make(tmp_path)
    note = a.add_note("v1", author="ada")
    b = annotations.Annotations(a.path, RUN_ID, a.dt, a.n_frames)
    b.notes.append(annotations.Note.from_json(note.to_json()))
    b.notes[0].text = "v2"
    b.notes[0].updated = "2999-01-01T00:00:00Z"
    assert annotations.merge(a, b).notes[0].text == "v2"
    assert annotations.merge(b, a).notes[0].text == "v2"

    # Two independent bases each created a rating for the same criterion.
    r1 = a.rate(3, author="ada")
    r2 = annotations.Rating.from_json(
        {
            **r1.to_json(),
            "id": "9" * 26,
            "value": 5,
            "updated": "2999-01-01T00:00:00Z",
        }
    )
    b.ratings.append(r2)
    merged = annotations.merge(a, b)
    assert len(merged.ratings) == 1 and merged.ratings[0].value == 5


def test_event_types_default_and_round_trip(tmp_path):
    types, extra = annotations.load_event_types(tmp_path)
    assert set(types) == {"fall", "slip", "success", "note"} and extra == {}
    assert types["fall"].props["severity"]["options"] == ["minor", "major"]
    assert not (tmp_path / ".simscope").exists()

    types["jump"] = annotations.EventType(
        type_id="jump", name="Jump", color="#00ff00", key="j"
    )
    annotations.save_event_types(tmp_path, types, {"custom": 1})
    path = tmp_path / ".simscope" / "event_types.json"
    obj = json.loads(path.read_text())
    assert obj["format"] == "simscope-event-types/1" and obj["custom"] == 1
    assert path.read_text() == json.dumps(obj, indent=2, sort_keys=True) + "\n"
    loaded, extra = annotations.load_event_types(tmp_path)
    assert extra == {"custom": 1}
    assert loaded["jump"].key == "j" and loaded["fall"].color == "#d33b3b"


def test_event_type_validation(tmp_path):
    with pytest.raises(ValueError, match="color"):
        annotations.EventType(type_id="x", name="X", color="red")
    with pytest.raises(ValueError, match="key"):
        annotations.EventType(type_id="x", name="X", key="ab")
    with pytest.raises(ValueError, match="unknown type"):
        annotations.EventType(type_id="x", name="X", props={"p": {"type": "q"}})
    with pytest.raises(ValueError, match="options"):
        annotations.EventType(
            type_id="x", name="X", props={"p": {"type": "select"}}
        )
    path = tmp_path / ".simscope" / "event_types.json"
    path.parent.mkdir()
    path.write_text(
        json.dumps(
            {
                "format": "simscope-event-types/1",
                "types": {"x": {"color": "bad"}},
            }
        )
    )
    with pytest.raises(errors.FormatError):
        annotations.load_event_types(tmp_path)


def test_group_list_default_and_round_trip(tmp_path):
    groups, extra = annotations.load_groups(tmp_path)
    assert groups == [] and extra == {}
    assert not (tmp_path / ".simscope").exists()  # reading creates nothing

    first = annotations.Group(
        name="Vault sweep", created="2026-09-30T10:00:00Z"
    )
    first.extra = {"color": "blue"}
    second = annotations.Group(name="Crates", created="2026-09-30T11:00:00Z")
    path = annotations.save_groups(tmp_path, [first, second], {"x": 1})
    assert path == tmp_path / ".simscope" / "groups.json"
    raw = path.read_text()
    obj = json.loads(raw)
    assert obj["format"] == "simscope-groups/1" and obj["x"] == 1
    assert raw == json.dumps(obj, indent=2, sort_keys=True) + "\n"
    assert obj["groups"][0] == {
        "color": "blue",
        "created": "2026-09-30T10:00:00Z",
        "name": "Vault sweep",
    }
    groups, extra = annotations.load_groups(tmp_path)
    assert [g.name for g in groups] == ["Vault sweep", "Crates"]  # ordered
    assert groups[0].extra == {"color": "blue"} and extra == {"x": 1}


def test_group_list_drops_repeats_and_rejects_bad_files(tmp_path):
    path = tmp_path / ".simscope" / "groups.json"
    path.parent.mkdir()

    def write(obj):
        path.write_text(json.dumps(obj))

    write(
        {
            "format": "simscope-groups/1",
            "groups": [{"name": "A"}, {"name": " a "}, {"name": "B"}],
        }
    )
    assert [g.name for g in annotations.load_groups(tmp_path)[0]] == ["A", "B"]
    bad = [
        {"format": "simscope-groups/2", "groups": []},
        {"format": "other/1", "groups": []},
        {"format": "simscope-groups/1", "groups": {"A": 1}},
        {"format": "simscope-groups/1", "groups": ["A"]},
        {"format": "simscope-groups/1", "groups": [{"created": "x"}]},
        {"format": "simscope-groups/1", "groups": [{"name": ""}]},
        {"format": "simscope-groups/1", "groups": [{"name": "x" * 65}]},
    ]
    for obj in bad:
        write(obj)
        with pytest.raises(errors.FormatError):
            annotations.load_groups(tmp_path)
    path.write_text("{")
    with pytest.raises(errors.FormatError):
        annotations.load_groups(tmp_path)


def test_check_group_name():
    assert annotations.check_group_name("  a b ") == "a b"
    assert annotations.check_group_name("x" * 64) == "x" * 64
    for bad in ("", " ", "x" * 65, "a\nb", 3, None, b"a"):
        with pytest.raises(ValueError):
            annotations.check_group_name(bad)
