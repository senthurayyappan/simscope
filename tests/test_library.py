from typing import Protocol, runtime_checkable

import numpy as np
import pytest

from simscope import annotations, core, library
from simscope.io import blockfile, errors, manifest


def make_scene(n_bodies=4):
    bodies = tuple(
        core.Body(f"b{i}", -1 if i == 0 else 0) for i in range(n_bodies)
    )
    return core.Scene(bodies=bodies)


def make_poses(n, n_envs, n_bodies, seed=0):
    rng = np.random.default_rng(seed)
    quat = rng.normal(size=(n, n_envs, n_bodies, 4))
    quat /= np.linalg.norm(quat, axis=-1, keepdims=True)
    pos = rng.normal(size=(n, n_envs, n_bodies, 3))
    return np.concatenate([pos, quat], -1).astype(np.float32)


def record(lib, name, n=120, envs=1, bodies=4, **kwargs):
    poses = make_poses(n, envs, bodies, seed=hash(name) % 1000)
    kwargs.setdefault("dt", 0.02)
    kwargs.setdefault("n_envs", envs)
    with lib.record(name, scene=make_scene(bodies), **kwargs) as rec:
        rec.log_frames(poses)
    return poses


@pytest.fixture
def lib(tmp_path):
    lib = library.Library(tmp_path / "lib")
    yield lib
    lib.close()


@runtime_checkable
class FrameSource(Protocol):
    n_frames: int
    n_envs: int
    dt: float

    def read(self, t0: int, t1: int) -> np.ndarray: ...


def test_layout_is_created_lazily(tmp_path):
    root = tmp_path / "fresh"
    lib = library.Library(root)
    assert lib.runs() == [] and lib.query(text="x") == []
    assert lib.event_types()["fall"].name == "Fall"
    assert not root.exists()
    with pytest.raises(FileNotFoundError):
        lib.open("nope")
    with pytest.raises(ValueError, match="invalid run name"):
        lib.open("../etc")
    record(lib, "first")
    assert (root / "runs" / "first" / "rollout.json").exists()
    assert list((root / "scenes").glob("*/*.json"))
    lib.close()


def test_open_reads_manifest_and_scene_lazily(lib):
    record(lib, "a", envs=2, env_origins=[[0, 0, 0], [1, 2, 3]])
    run = lib.open("a")
    assert run.name == "a" and run.manifest.n_envs == 2
    assert (run.dt, run.n_frames, run.n_envs) == (0.02, 120, 2)
    np.testing.assert_array_equal(run.env_origins[1], [1, 2, 3])
    assert run._scene is None and run._readers == {}
    assert run.scene.n_bodies == 4 and run.scene is run.scene
    assert set(run._readers) == set()
    reader = run.stream("body_pose")
    assert run.stream("body_pose") is reader
    assert reader.n_frames == 120
    with pytest.raises(KeyError, match="no stream 'nope'"):
        run.stream("nope")
    run.close()
    assert run._readers == {}


def test_frame_source_protocol(lib):
    poses = record(lib, "fs", envs=3)
    with lib.open("fs") as run:
        src = run.frame_source()
        assert isinstance(src, FrameSource)
        assert (src.n_frames, src.n_envs, src.dt) == (120, 3, 0.02)
        out = src.read(10, 25)
        assert out.shape == (15, 3, 4, 7) and out.dtype == np.float32
        dot = np.sum(out[..., 3:] * poses[10:25, ..., 3:], -1, keepdims=True)
        np.testing.assert_array_equal(
            out[..., 3:], poses[10:25, ..., 3:] * np.where(dot < 0, -1, 1)
        )
        np.testing.assert_array_equal(out[..., :3], poses[10:25, ..., :3])
        assert src.read(5, 5).shape == (0, 3, 4, 7)
        assert src.read(0, 120).shape[0] == 120
        with pytest.raises(IndexError):
            src.read(100, 121)
        for attr in ("n_frames", "n_envs", "dt"):
            with pytest.raises(AttributeError):
                setattr(src, attr, 1)
        assert src.env_origins.shape == (3, 3)


def test_frame_source_rejects_non_pose_streams(lib):
    with lib.record("x", scene=make_scene(3), dt=0.02) as rec:
        rec.log_frames(make_poses(5, 1, 3), reward=np.zeros(5))
    with lib.open("x") as run:
        with pytest.raises(ValueError, match="not pose"):
            run.frame_source("reward")
        with pytest.raises(KeyError):
            run.frame_source("missing")


def test_q16d_frame_source_has_unit_quaternions(lib):
    record(lib, "q", codec="q16d")
    with lib.open("q") as run:
        out = run.frame_source().read(0, 120)
    np.testing.assert_allclose(
        np.linalg.norm(out[..., 3:], axis=-1), 1, atol=1e-6
    )


def test_runs_and_query_follow_recordings_and_annotations(lib):
    record(lib, "walk_a", tags=["walk"])
    record(lib, "run_b", n=50, tags=["run", "walk"])
    record(lib, "walk_c", n=80)
    assert {r.name for r in lib.runs()} == {"walk_a", "run_b", "walk_c"}
    assert lib.count(tags=["walk"]) == 2
    info = {r.name: r for r in lib.runs()}["run_b"]
    assert (info.n_frames, info.status, info.tags) == (
        50, "complete", ("run", "walk"),
    )  # fmt: skip
    assert lib.query(sort="n_frames", descending=False)[0].name == "run_b"

    with lib.open("walk_c") as run:
        ann = run.annotations
        assert run.annotations is ann
        ann.set_favorite()
        ann.set_group("keepers")
        ann.add_note("nice gait", author="ada")
        ann.rate(5, author="ada")
        ann.add_event("fall", t0=0.5, author="ada")
        ann.save()
    got = lib.query(favorite=True)
    assert [r.name for r in got] == ["walk_c"]
    assert got[0].rating == 5 and got[0].n_events == 1 and got[0].n_notes == 1
    assert [r.name for r in lib.query(text="gait")] == ["walk_c"]
    assert got[0].group == "keepers"
    assert [r.name for r in lib.query(text="keepers")] == ["walk_c"]
    assert lib.query(favorite=True, refresh=False)[0].name == "walk_c"
    # snapped to a frame of this run
    assert lib.open("walk_c").annotations.events[0].f0 == 25

    # a run added later shows up on the next query
    record(lib, "late")
    assert lib.count() == 4
    assert lib.refresh().unchanged == 4


def test_annotations_belong_to_the_run(lib):
    record(lib, "n", n=10)
    run = lib.open("n")
    ann = run.annotations
    assert ann.run_id == run.manifest.id and ann.n_frames == 10
    assert ann.dt == 0.02
    e = ann.add_event(t0=9.0, author="ada")
    assert e.f0 == 9  # clipped to the last frame
    ann.save()
    assert (run.path / "annotations.json").exists()


def test_event_types_round_trip(lib):
    assert set(lib.event_types()) == {"fall", "slip", "success", "note"}
    types = lib.event_types()
    types["hop"] = annotations.EventType(type_id="hop", name="Hop", key="h")
    lib.set_event_types(types)
    assert lib.event_types()["hop"].key == "h"
    lib.set_event_types([annotations.EventType(type_id="only", name="Only")])
    assert set(lib.event_types()) == {"only"}


def crashed_run(lib, name, n=250, block_frames=100, streams=("v",)):
    poses = make_poses(n, 1, 4)
    rec = lib.record(
        name, scene=make_scene(4), dt=0.02, block_frames=block_frames
    )
    for s in streams:
        rec.add_stream(s, "scalar")
    for t in range(n):
        rec.log(poses[t], **{s: float(t) for s in streams})
    rec.abort()
    return poses


def stream_frames(lib, name, stream):
    with lib.open(name) as run:
        return run.stream(stream).n_frames


def test_open_unfinished_run_points_to_recover(lib):
    crashed_run(lib, "u")
    run = lib.open("u")
    assert run.manifest.status == "recording"
    with pytest.raises(errors.FormatError, match="recover"):
        run.stream("body_pose")
    assert lib.query()[0].status == "recording"
    assert lib.query(status="recording")[0].name == "u"
    lib.recover("u")
    assert lib.query()[0].status == "complete"
    assert lib.query(status="recording") == []


def test_recover_aligns_streams_after_partial_last_window(lib):
    crashed_run(lib, "a", n=250)
    run_dir = lib.run_dir("a")
    # The crash cut `v` in the middle of its third (short) window.
    v_path = run_dir / "v.blk"
    v_path.write_bytes(v_path.read_bytes()[:-9])
    report = lib.recover("a")
    assert report.n_frames == 200 and not report.already_complete
    assert report.streams == {"body_pose": 250, "v": 200}
    assert report.dropped_frames == 50
    assert stream_frames(lib, "a", "body_pose") == 200
    assert stream_frames(lib, "a", "v") == 200
    with lib.open("a") as run:
        assert run.n_frames == 200 and run.manifest.status == "complete"
        np.testing.assert_array_equal(
            run.stream("v").read(0, 200)[:, 0], np.arange(200, dtype=np.float32)
        )
        src = run.frame_source()
        assert src.n_frames == 200 and src.read(150, 200).shape[0] == 50
    # The repaired file is a normal finished block file.
    reader = blockfile.BlockReader(run_dir / "body_pose.blk", kind="pose")
    assert reader.n_blocks == 2 and reader.directory["t0"].tolist() == [0, 100]
    reader.close()


def test_recover_when_a_stream_lost_everything(lib):
    crashed_run(lib, "z", n=150)
    run_dir = lib.run_dir("z")
    (run_dir / "v.blk").write_bytes(b"")  # unusable file
    report = lib.recover("z")
    assert report.n_frames == 0
    assert stream_frames(lib, "z", "v") == 0
    assert stream_frames(lib, "z", "body_pose") == 0
    with lib.open("z") as run:
        assert run.frame_source().read(0, 0).shape == (0, 1, 4, 7)


def test_recover_short_final_window_and_finished_runs(lib):
    poses = crashed_run(lib, "s", n=137, block_frames=50, streams=("v", "w"))
    report = lib.recover("s")
    assert report.n_frames == 137 and report.dropped_frames == 0
    with lib.open("s") as run:
        out = run.stream("body_pose").read(0, 137)
    np.testing.assert_array_equal(out[..., :3], poses[..., :3])
    again = lib.recover("s")
    assert again.already_complete and again.n_frames == 137
    with pytest.raises(FileNotFoundError):
        lib.recover("ghost")


def test_recover_multi_env(lib):
    n, envs = 210, 3
    poses = make_poses(n, envs, 4)
    rec = lib.record("m", scene=make_scene(4), dt=0.02, n_envs=envs)
    rec.log_frames(poses)
    rec.abort()
    assert lib.recover("m").n_frames == 210
    with lib.open("m") as run:
        out = run.stream("body_pose").read(0, n)
    np.testing.assert_array_equal(out[..., :3], poses[..., :3])
    assert manifest.read_manifest(lib.run_dir("m")).status == "complete"


def test_record_keeps_a_given_creation_time(tmp_path):
    from simscope import core

    lib = library.Library(tmp_path / "lib")
    scene = core.Scene(bodies=(core.Body("world", -1),))
    with lib.record(
        "old", scene=scene, dt=0.02, created="2026-09-10T00:58:46Z"
    ) as rec:
        rec.log_frames(np.zeros((3, 1, 1, 7), np.float32))
    assert lib.open("old").manifest.created == "2026-09-10T00:58:46Z"
