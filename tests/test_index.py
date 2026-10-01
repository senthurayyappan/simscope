import json
import os
import sqlite3

import pytest

from simscope import index

SCENE = "a" * 64


def write_run(
    root,
    name,
    *,
    n_frames=100,
    created="2026-09-30T12:00:00Z",
    tags=(),
    status="complete",
    annotations=None,
    partial=False,
):
    run_dir = root / "runs" / name
    run_dir.mkdir(parents=True, exist_ok=True)
    manifest = {
        "format": "simscope-rollout/1",
        "id": f"id-{name}",
        "name": name,
        "created": created,
        "status": status,
        "dt": 0.02,
        "n_frames": n_frames,
        "n_envs": 2,
        "n_bodies": 5,
        "scene": {"sha256": SCENE, "size": 10},
        "streams": {},
        "tags": list(tags),
    }
    fname = "rollout.json.partial" if partial else "rollout.json"
    (run_dir / fname).write_text(json.dumps(manifest))
    if annotations is not None:
        write_annotations(root, name, annotations)
    return run_dir


def write_annotations(root, name, marks=None, **lists):
    obj = {"format": "simscope-annotations/1", "run_id": f"id-{name}"}
    obj["marks"] = marks or {}
    obj.update(lists)
    path = root / "runs" / name / "annotations.json"
    path.write_text(json.dumps(obj))
    return path


def bump(path):
    """Moves a file's mtime forward so the change is always detected."""
    st = path.stat()
    os.utime(path, ns=(st.st_atime_ns, st.st_mtime_ns + 5_000_000_000))


def names(runs):
    return [r.name for r in runs]


@pytest.fixture
def lib(tmp_path):
    write_run(tmp_path, "alpha", n_frames=300, created="2026-09-01T00:00:00Z",
              tags=["walk", "sweep_1"])  # fmt: skip
    write_run(
        tmp_path,
        "bravo",
        n_frames=100,
        created="2026-09-02T00:00:00Z",
        tags=["walk"],
        # Flag, status and curation tags are deprecated: nothing indexes them.
        annotations={
            "favorite": True,
            "group": "Vault sweep",
            "status": "candidate",
            "tags": ["good"],
        },
    )
    write_run(tmp_path, "charlie", n_frames=200, created="2026-09-03T00:00:00Z",
              status="recording", partial=True)  # fmt: skip
    write_annotations(
        tmp_path,
        "alpha",
        {"flag": "review", "group": 7},  # a group is a string
        notes=[{"id": "1", "text": "Front-left foot slips 100%"}],
        ratings=[
            {"id": "r1", "criterion": "overall", "value": 4},
            {"id": "r2", "criterion": "overall", "value": 2},
            {"id": "r3", "criterion": "gait", "value": 5},
        ],
        events=[{"id": "e1"}, {"id": "e2"}],
    )
    idx = index.Index(tmp_path)
    yield idx
    idx.close()


def test_refresh_reads_summary_fields(lib):
    stats = lib.refresh()
    assert (stats.added, stats.updated, stats.removed) == (3, 0, 0)
    a = lib.get("alpha")
    assert a is not None
    assert (a.id, a.n_frames, a.n_envs, a.n_bodies, a.dt) == (
        "id-alpha", 300, 2, 5, 0.02,
    )  # fmt: skip
    assert a.scene_hash == SCENE and a.status == "complete"
    assert a.tags == ("sweep_1", "walk")
    assert a.group is None and a.favorite is False
    assert not hasattr(a, "flag") and not hasattr(a, "mark_status")
    assert a.n_events == 2 and a.n_notes == 1 and a.rating == 3.0
    b = lib.get("bravo")
    assert b is not None and b.favorite and b.group == "Vault sweep"
    assert b.tags == ("walk",) and b.rating is None  # record-time only
    c = lib.get("charlie")
    assert c is not None and c.status == "recording"
    assert lib.get("missing") is None


def test_refresh_is_incremental(lib, tmp_path):
    lib.refresh()
    assert lib.refresh() == index.RefreshStats(unchanged=3)

    path = write_annotations(
        tmp_path, "bravo", {"favorite": False, "group": "Crates"},
        events=[{"id": "x"}],
    )  # fmt: skip
    bump(path)
    stats = lib.refresh()
    assert (stats.added, stats.updated, stats.unchanged) == (0, 1, 2)
    bravo = lib.get("bravo")
    assert bravo is not None and not bravo.favorite and bravo.n_events == 1
    assert bravo.group == "Crates"

    write_run(tmp_path, "delta")
    stats = lib.refresh()
    assert (stats.added, stats.updated, stats.unchanged) == (1, 0, 3)

    # A finished recording replaces the .partial manifest.
    run_dir = tmp_path / "runs" / "charlie"
    write_run(tmp_path, "charlie", n_frames=250)
    (run_dir / "rollout.json.partial").unlink()
    assert lib.refresh().updated == 1
    charlie = lib.get("charlie")
    assert charlie is not None
    assert (charlie.status, charlie.n_frames) == ("complete", 250)

    # Deleting the annotations file is a change too.
    (tmp_path / "runs" / "alpha" / "annotations.json").unlink()
    assert lib.refresh().updated == 1
    alpha = lib.get("alpha")
    assert alpha is not None and alpha.n_events == 0 and alpha.group is None

    import shutil

    shutil.rmtree(tmp_path / "runs" / "delta")
    stats = lib.refresh()
    assert (stats.removed, stats.unchanged) == (1, 3)
    assert lib.get("delta") is None
    assert lib.count() == 3


def test_ignores_non_runs_and_flags_invalid(lib, tmp_path):
    (tmp_path / "runs" / "empty_dir").mkdir()
    (tmp_path / "runs" / ".hidden").mkdir()
    (tmp_path / "runs" / "stray.txt").write_text("x")
    bad = tmp_path / "runs" / "broken"
    bad.mkdir()
    (bad / "rollout.json").write_text("{not json")
    lib.refresh()
    assert lib.count() == 4
    broken = lib.get("broken")
    assert broken is not None and broken.status == index.INVALID
    assert lib.get("empty_dir") is None
    assert lib.refresh().unchanged == 4  # the broken run is not rescanned


def test_missing_root_gives_empty_and_creates_nothing(tmp_path):
    idx = index.Index(tmp_path / "nowhere")
    assert idx.refresh() == index.RefreshStats()
    assert not (tmp_path / "nowhere").exists()


def test_query_text_tags_favorite_status(lib):
    lib.refresh()
    assert names(lib.query(text="alp")) == ["alpha"]
    assert names(lib.query(text="SLIPS")) == ["alpha"]  # note text
    assert names(lib.query(text="sweep_1")) == [
        "alpha"
    ]  # tags, and "_" literal
    assert lib.query(text="sweep-1") == []
    assert names(lib.query(text="100%")) == ["alpha"]
    assert lib.query(text="%") != [] and lib.query(text="50%") == []
    assert names(lib.query(text="foot walk")) == ["alpha"]  # all terms
    assert lib.query(text="good") == []  # a curation tag is not indexed
    assert names(lib.query(text="vault sweep")) == ["bravo"]  # the group

    assert set(names(lib.query(tags=["walk"]))) == {"alpha", "bravo"}
    assert names(lib.query(tags=["walk", "sweep_1"])) == ["alpha"]
    assert lib.query(tags=["walk", "good"]) == []
    assert lib.query(tags=["walk", "nope"]) == []

    assert names(lib.query(favorite=True)) == ["bravo"]
    assert set(names(lib.query(favorite=False))) == {"alpha", "charlie"}
    assert lib.query(status="candidate") == []  # the manifest status only
    assert names(lib.query(status="recording")) == ["charlie"]
    assert names(lib.query(status="complete", favorite=True)) == ["bravo"]
    assert lib.count(tags=["walk"]) == 2 and lib.count(status="x") == 0


def test_query_sort_and_paging(lib):
    lib.refresh()
    assert names(lib.query()) == ["charlie", "bravo", "alpha"]
    assert names(lib.query(descending=False)) == ["alpha", "bravo", "charlie"]
    assert names(lib.query(sort="name", descending=False)) == [
        "alpha", "bravo", "charlie",
    ]  # fmt: skip
    assert names(lib.query(sort="n_frames")) == ["alpha", "charlie", "bravo"]
    assert names(lib.query(sort="rating")) == ["alpha", "bravo", "charlie"]
    assert names(lib.query(sort="rating", descending=False)) == [
        "alpha", "bravo", "charlie",
    ]  # fmt: skip
    assert names(lib.query(limit=2)) == ["charlie", "bravo"]
    assert names(lib.query(limit=2, offset=2)) == ["alpha"]
    assert names(lib.query(limit=None, offset=1)) == ["bravo", "alpha"]
    assert lib.query(offset=10) == []
    with pytest.raises(ValueError, match="sort"):
        lib.query(sort="name; DROP TABLE runs")


def test_sql_injection_in_filters_is_inert(lib):
    lib.refresh()
    assert lib.query(text="x' OR '1'='1") == []
    assert lib.query(tags=["x') OR 1=1 --"]) == []
    assert lib.query(status="' OR 1=1 --") == []
    assert lib.count() == 3


def test_corrupt_index_is_rebuilt(lib, tmp_path):
    lib.refresh()
    lib.close()
    path = tmp_path / ".simscope" / "index.sqlite"
    path.write_bytes(b"this is not a sqlite database" * 200)
    fresh = index.Index(tmp_path)
    assert fresh.refresh().added == 3
    assert fresh.count() == 3
    fresh.close()


def test_stale_schema_version_is_rebuilt(lib, tmp_path):
    lib.refresh()
    lib.close()
    path = tmp_path / ".simscope" / "index.sqlite"
    conn = sqlite3.connect(path)
    conn.execute("PRAGMA user_version=99")
    conn.execute("DROP TABLE run_tags")
    conn.commit()
    conn.close()
    fresh = index.Index(tmp_path)
    assert fresh.refresh().added == 3
    assert fresh.count(tags=["walk"]) == 2
    fresh.close()


def test_wal_mode_and_persistence(lib, tmp_path):
    lib.refresh()
    lib.close()
    path = tmp_path / ".simscope" / "index.sqlite"
    conn = sqlite3.connect(path)
    assert conn.execute("PRAGMA journal_mode").fetchone()[0] == "wal"
    conn.close()
    again = index.Index(tmp_path)
    assert again.refresh() == index.RefreshStats(unchanged=3)
    again.close()


def test_rebuild(lib):
    lib.refresh()
    assert lib.rebuild().added == 3
