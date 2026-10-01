import json
import pathlib
import subprocess
import sys
import textwrap
import time

import numpy as np
import pytest

from simscope import core, library, recorder
from simscope.io import blockfile, manifest


def make_scene(n_bodies=5):
    bodies = tuple(
        core.Body(f"b{i}", -1 if i == 0 else i - 1) for i in range(n_bodies)
    )
    geoms = tuple(
        core.Geom(body=i, kind="box", size=(0.1, 0.1, 0.1))
        for i in range(n_bodies)
    )
    return core.Scene(bodies=bodies, geoms=geoms)


def make_poses(n, n_envs, n_bodies, seed=0, random_signs=True):
    """Smooth random poses with unit quaternions and arbitrary signs."""
    rng = np.random.default_rng(seed)
    t = np.arange(n, dtype=np.float64)[:, None, None, None]
    shape = (1, n_envs, n_bodies, 3)
    pos = np.sin(
        0.05 * t * rng.uniform(0.5, 2, shape) + rng.uniform(0, 6, shape)
    )
    axis = rng.normal(size=shape)
    axis /= np.linalg.norm(axis, axis=-1, keepdims=True)
    ang = np.sin(0.03 * t * rng.uniform(0.5, 2, (*shape[:-1], 1)))
    quat = np.concatenate([axis * np.sin(ang / 2), np.cos(ang / 2)], -1)
    if random_signs:
        quat *= rng.choice([-1.0, 1.0], size=(*quat.shape[:-1], 1))
    return np.concatenate([pos, quat], -1).astype(np.float32)


def assert_same_up_to_sign(out, expected):
    """Positions identical; quaternions equal up to per-pose sign."""
    np.testing.assert_array_equal(out[..., :3], expected[..., :3])
    dot = np.sum(out[..., 3:] * expected[..., 3:], axis=-1, keepdims=True)
    np.testing.assert_array_equal(
        out[..., 3:], expected[..., 3:] * np.where(dot < 0, -1, 1)
    )


def assert_continuous(out):
    q = out[..., 3:]
    assert (np.sum(q[1:] * q[:-1], axis=-1) >= 0).all()


@pytest.fixture
def lib(tmp_path):
    yield library.Library(tmp_path / "lib")


def read_all(lib, name, stream):
    with lib.open(name) as run:
        reader = run.stream(stream)
        return reader.read(0, reader.n_frames)


def test_round_trip_single_env_with_extra_streams(lib):
    n, bodies = 250, 5
    poses = make_poses(n, 1, bodies)
    rng = np.random.default_rng(1)
    vec = rng.normal(size=(n, 1, 3)).astype(np.float32)
    arrows = rng.normal(size=(n, 1, 2, 6)).astype(np.float32)
    reward = rng.normal(size=(n,)).astype(np.float32)
    with lib.record(
        "walk",
        scene=make_scene(bodies),
        dt=0.02,
        tags=["sweep_07", "a"],
        meta={"seed": 17},
        source={"simulator": "test"},
        block_frames=100,
    ) as rec:
        rec.add_stream("vec", "vector", (3,), labels=["x", "y", "z"], units="N")
        rec.add_stream("arrows", "arrows", (2, 6))
        for t in range(n):
            rec.log(
                poses[t, 0],  # [B, 7] accepted for one env
                vec=vec[t],
                arrows=arrows[t],
                reward=float(reward[t]),  # undeclared float -> scalar
            )
        assert rec.n_frames == n
    assert rec.stats["stalls"] == 0

    run_dir = lib.root / "runs" / "walk"
    assert (run_dir / "rollout.json").exists()
    assert not (run_dir / "rollout.json.partial").exists()
    m = manifest.read_manifest(run_dir)
    assert (m.status, m.n_frames, m.n_envs, m.n_bodies, m.dt) == (
        "complete", n, 1, bodies, 0.02,
    )  # fmt: skip
    assert m.tags == ("sweep_07", "a") and m.meta == {"seed": 17}
    assert m.source == {"simulator": "test"}
    assert set(m.streams) == {"body_pose", "vec", "arrows", "reward"}
    assert m.streams["vec"].labels == ("x", "y", "z")
    assert m.streams["vec"].units == "N"
    assert m.streams["reward"].kind == "scalar"

    out = read_all(lib, "walk", "body_pose")
    assert out.shape == (n, 1, bodies, 7)
    assert_same_up_to_sign(out, poses)
    assert_continuous(out)
    np.testing.assert_array_equal(read_all(lib, "walk", "vec"), vec)
    np.testing.assert_array_equal(read_all(lib, "walk", "arrows"), arrows)
    np.testing.assert_array_equal(
        read_all(lib, "walk", "reward"), reward[:, None]
    )
    with lib.open("walk") as run:
        assert run.scene.n_bodies == bodies
        assert len(run.scene.geoms) == bodies


def test_round_trip_three_envs_log_and_log_frames(lib):
    n, envs, bodies = 230, 3, 4
    poses = make_poses(n, envs, bodies, seed=3)
    rng = np.random.default_rng(4)
    cost = rng.normal(size=(n, envs)).astype(np.float32)
    pts = rng.normal(size=(n, envs, 5, 3)).astype(np.float32)
    origins = np.arange(envs * 3, dtype=np.float64).reshape(envs, 3)
    with lib.record(
        "multi",
        scene=make_scene(bodies),
        dt=0.01,
        n_envs=envs,
        env_origins=origins,
        block_frames=64,
    ) as rec:
        rec.add_stream("pts", "points", (5, 3))
        rec.add_stream("cost", "scalar")
        for t in range(30):  # single frames first
            rec.log(poses[t], pts=pts[t], cost=cost[t])
        rec.log_frames(poses[30:170], pts=pts[30:170], cost=cost[30:170])
        rec.log_frames(poses[170:], pts=pts[170:], cost=cost[170:])
    out = read_all(lib, "multi", "body_pose")
    assert out.shape == (n, envs, bodies, 7)
    assert_same_up_to_sign(out, poses)
    assert_continuous(out)
    np.testing.assert_array_equal(read_all(lib, "multi", "pts"), pts)
    np.testing.assert_array_equal(read_all(lib, "multi", "cost"), cost)
    with lib.open("multi") as run:
        np.testing.assert_array_equal(run.env_origins, origins)
        assert run.stream("body_pose").block_frames == 64


def test_log_frames_and_log_are_equivalent(lib):
    poses = make_poses(130, 2, 3, seed=5)
    val = np.random.default_rng(6).normal(size=(130, 2)).astype(np.float32)
    for name, batch in (("single", False), ("batch", True)):
        with lib.record(name, scene=make_scene(3), dt=0.02, n_envs=2) as rec:
            rec.add_stream("v", "scalar")
            if batch:
                rec.log_frames(poses, v=val)
            else:
                for t in range(130):
                    rec.log(poses[t], v=val[t])
    for stream in ("body_pose", "v"):
        np.testing.assert_array_equal(
            read_all(lib, "single", stream), read_all(lib, "batch", stream)
        )
    a = (lib.root / "runs" / "single" / "body_pose.blk").read_bytes()
    b = (lib.root / "runs" / "batch" / "body_pose.blk").read_bytes()
    assert a == b


def test_log_frames_single_env_shortcuts(lib):
    poses = make_poses(50, 1, 3, seed=7)
    v = np.arange(50, dtype=np.float32)
    with lib.record("s", scene=make_scene(3), dt=0.02) as rec:
        rec.log_frames(poses[:, 0], v=v)  # [n, B, 7] and [n]
    assert_same_up_to_sign(read_all(lib, "s", "body_pose"), poses)
    np.testing.assert_array_equal(read_all(lib, "s", "v")[:, 0], v)


def test_q16d_within_bound(lib):
    n, bodies = 300, 6
    poses = make_poses(n, 1, bodies, seed=8)
    with lib.record(
        "lossy", scene=make_scene(bodies), dt=0.02, codec="q16d"
    ) as rec:
        rec.add_stream("exact", "scalar")
        for t in range(n):
            rec.log(poses[t], exact=float(t) * 1.5)
    with lib.open("lossy") as run:
        reader = run.stream("body_pose")
        assert set(reader.directory["codec"].tolist()) == {2}
        out = reader.read(0, n)
    # Positions lie in [-1, 1]: per-block step/2 is at most 2/65535/2.
    assert np.abs(out[..., :3] - poses[..., :3]).max() < 2e-5
    dot = np.sum(out[..., 3:] * poses[..., 3:], -1, keepdims=True)
    q = poses[..., 3:] * np.where(dot < 0, -1, 1)
    assert np.abs(out[..., 3:] - q).max() < 1e-4
    np.testing.assert_allclose(
        np.linalg.norm(out[..., 3:], axis=-1), 1, atol=1e-6
    )
    # Extra streams stay lossless unless asked otherwise.
    with lib.open("lossy") as run:
        assert set(run.stream("exact").directory["codec"].tolist()) == {1}
        np.testing.assert_array_equal(
            run.stream("exact").read(0, n)[:, 0], np.arange(n) * 1.5
        )


def test_validation_errors_do_not_record_the_frame(lib):
    poses = make_poses(20, 2, 3)
    with lib.record("v", scene=make_scene(3), dt=0.02, n_envs=2) as rec:
        rec.add_stream("vec", "vector", (2,))
        with pytest.raises(ValueError, match="expected shape"):
            rec.log(poses[0, :, :2], vec=np.zeros((2, 2)))  # wrong body count
        assert rec.n_frames == 0
        with pytest.raises(ValueError, match="expected shape"):
            rec.log(poses[0, :1], vec=np.zeros((2, 2)))  # missing env
        rec.log(poses[0], vec=np.zeros((2, 2)))
        with pytest.raises(ValueError, match="stream 'vec'"):
            rec.log(poses[1], vec=np.zeros((2, 3)))
        with pytest.raises(ValueError, match="stream 'vec'"):
            rec.log(poses[1], vec=np.zeros((1, 2)))  # no silent broadcast
        with pytest.raises(ValueError, match="missing streams"):
            rec.log(poses[1])
        with pytest.raises(ValueError, match="undeclared streams"):
            rec.log(poses[1], vec=np.zeros((2, 2)), other=1.0)
        with pytest.raises(ValueError, match="undeclared streams"):
            rec.log(poses[1], other=np.zeros((2, 2)))
        with pytest.raises(recorder.RecorderError, match="before the first"):
            rec.add_stream("late", "scalar")
        with pytest.raises(ValueError, match="expected shape"):
            rec.log_frames(poses[:5, :, :2], vec=np.zeros((5, 2, 2)))
        with pytest.raises(ValueError, match="stream 'vec'"):
            rec.log_frames(poses[:5], vec=np.zeros((4, 2, 2)))
        assert rec.n_frames == 1
        rec.log(poses[1], vec=np.ones((2, 2)))
    assert read_all(lib, "v", "vec").shape == (2, 2, 2)


def test_first_frame_validation_leaves_nothing_behind(lib):
    rec = lib.record("nofiles", scene=make_scene(3), dt=0.02)
    with pytest.raises(ValueError):
        rec.log(np.zeros((9, 7)))
    with pytest.raises(ValueError, match="not declared"):
        rec.log(make_poses(1, 1, 3)[0], thing=np.zeros((1, 4)))
    assert not (lib.root / "runs" / "nofiles").exists()
    rec.close()
    assert not (lib.root / "runs" / "nofiles").exists()


def test_scalar_broadcast_and_kinds(lib):
    poses = make_poses(3, 2, 3)
    with lib.record("b", scene=make_scene(3), dt=0.02, n_envs=2) as rec:
        rec.add_stream("g", "scalar")
        rec.log(poses[0], g=2.5)  # a float applies to every env
        rec.log(poses[1], g=np.float32(1.0))
        rec.log(poses[2], g=np.array([1.0, 2.0]))
    np.testing.assert_array_equal(
        read_all(lib, "b", "g"), [[2.5, 2.5], [1.0, 1.0], [1.0, 2.0]]
    )
    with pytest.raises(ValueError):
        lib.record("x", scene=make_scene(3), dt=0.02).add_stream(
            "bad", "arrows", (3,)
        )
    with pytest.raises(ValueError, match="already declared"):
        rec = lib.record("y", scene=make_scene(3), dt=0.02)
        rec.add_stream("a", "scalar")
        rec.add_stream("a", "scalar")
    with pytest.raises(ValueError, match="already declared"):
        lib.record("z", scene=make_scene(3), dt=0.02).add_stream(
            "body_pose", "scalar"
        )


def test_run_names_and_overwrite(lib):
    scene = make_scene(3)
    for bad in ("", "../x", "a/b", ".hidden", "x" * 200):
        with pytest.raises(ValueError, match="invalid run name"):
            lib.record(bad, scene=scene, dt=0.02)
    with pytest.raises(ValueError, match="dt"):
        lib.record("r", scene=scene, dt=0)
    with pytest.raises(ValueError, match=r"codec|Codec|unknown"):
        lib.record("r", scene=scene, dt=0.02, codec="zip")
    with pytest.raises(ValueError, match="env_origins"):
        lib.record("r", scene=scene, dt=0.02, env_origins=[[0, 0]])

    poses = make_poses(5, 1, 3)
    with lib.record("r", scene=scene, dt=0.02) as rec:
        rec.log_frames(poses)
    with pytest.raises(FileExistsError):
        lib.record("r", scene=scene, dt=0.02)
    old = manifest.read_manifest(lib.root / "runs" / "r").id
    (lib.root / "runs" / "r" / "annotations.json").write_text(
        "{}", encoding="utf-8"
    )
    with lib.record("r", scene=scene, dt=0.02, overwrite=True) as rec:
        rec.log_frames(poses[:2])
    m = manifest.read_manifest(lib.root / "runs" / "r")
    assert m.n_frames == 2 and m.id != old
    assert not (lib.root / "runs" / "r" / "annotations.json").exists()

    # A crashed run of the same name also blocks a new recording.
    rec = lib.record("c", scene=scene, dt=0.02)
    rec.log_frames(poses)
    rec.abort()
    with pytest.raises(FileExistsError):
        lib.record("c", scene=scene, dt=0.02)


def test_lifecycle(lib):
    rec = lib.record("l", scene=make_scene(3), dt=0.02)
    rec.close()  # never logged: nothing is created
    rec.close()
    assert not (lib.root / "runs").exists()
    with pytest.raises(recorder.RecorderError, match="closed"):
        rec.log(make_poses(1, 1, 3)[0])

    with lib.record("l2", scene=make_scene(3), dt=0.02) as rec:
        rec.log(make_poses(1, 1, 3)[0])
    rec.close()  # idempotent
    with pytest.raises(recorder.RecorderError, match="closed"):
        rec.log(make_poses(1, 1, 3)[0])
    assert manifest.read_manifest(lib.root / "runs" / "l2").n_frames == 1


def test_exception_in_with_block_leaves_recoverable_run(lib):
    n, bodies = 250, 4
    poses = make_poses(n, 1, bodies)
    with (
        pytest.raises(KeyboardInterrupt),
        lib.record("boom", scene=make_scene(bodies), dt=0.02) as rec,
    ):
        rec.add_stream("v", "scalar")
        for t in range(n):
            rec.log(poses[t], v=float(t))
        raise KeyboardInterrupt
    run_dir = lib.root / "runs" / "boom"
    assert (run_dir / "rollout.json.partial").exists()
    assert not (run_dir / "rollout.json").exists()
    assert manifest.read_manifest(run_dir).status == "recording"
    with pytest.raises(Exception, match=r"unfinished|recover"):
        lib.open("boom").stream("body_pose")

    report = lib.recover("boom")
    assert report.n_frames == n and not report.already_complete
    assert not (run_dir / "rollout.json.partial").exists()
    assert_same_up_to_sign(read_all(lib, "boom", "body_pose"), poses)
    np.testing.assert_array_equal(
        read_all(lib, "boom", "v")[:, 0], np.arange(n, dtype=np.float32)
    )
    assert lib.recover("boom").already_complete


def test_worker_exception_surfaces(lib, monkeypatch):
    real = blockfile.encode_window
    calls = []

    def flaky(window, codec="f32s"):
        calls.append(1)
        if len(calls) > 1:  # the first stream of the first window works
            raise RuntimeError("disk full")
        return real(window, codec)

    monkeypatch.setattr(blockfile, "encode_window", flaky)
    poses = make_poses(60, 1, 3)
    rec = lib.record("bad", scene=make_scene(3), dt=0.02, block_frames=10)
    rec.add_stream("v", "scalar")
    with pytest.raises(RuntimeError, match="disk full"):
        for t in range(60):
            rec.log(poses[t], v=1.0)
            if t == 9:  # first window queued: wait for the worker to fail
                with pytest.raises(RuntimeError, match="disk full"):
                    rec.flush()
    with pytest.raises(RuntimeError, match="disk full"):
        rec.close()
    run_dir = lib.root / "runs" / "bad"
    assert (run_dir / "rollout.json.partial").exists()
    monkeypatch.setattr(blockfile, "encode_window", real)
    report = lib.recover("bad")
    assert report.n_frames == 0  # v never got its first window
    assert lib.open("bad").n_frames == 0


def test_worker_exception_in_with_block_does_not_mask(lib, monkeypatch):
    def boom(window, codec="f32s"):
        raise RuntimeError("encoder exploded")

    monkeypatch.setattr(blockfile, "encode_window", boom)
    poses = make_poses(30, 1, 3)
    with (
        pytest.raises(RuntimeError, match="encoder exploded"),
        lib.record("m", scene=make_scene(3), dt=0.02, block_frames=10) as rec,
    ):
        for t in range(30):
            rec.log(poses[t])
            time.sleep(0.01)
    assert (lib.root / "runs" / "m" / "rollout.json.partial").exists()


def test_backpressure_blocks_and_counts(lib, monkeypatch):
    real = blockfile.encode_window

    def slow(window, codec="f32s"):
        time.sleep(0.03)
        return real(window, codec)

    monkeypatch.setattr(blockfile, "encode_window", slow)
    n = 120
    poses = make_poses(n, 1, 3)
    with lib.record(
        "slow", scene=make_scene(3), dt=0.02, block_frames=10
    ) as rec:
        for t in range(n):
            rec.log(poses[t])
    assert rec.stats["stalls"] > 0 and rec.stats["stall_seconds"] > 0
    assert_same_up_to_sign(read_all(lib, "slow", "body_pose"), poses)


def test_hard_kill_recovers_complete_windows(tmp_path):
    script = textwrap.dedent(
        f"""
        import os, sys
        sys.path.insert(0, {str(pathlib.Path(__file__).parent)!r})
        import numpy as np
        from simscope import library
        from test_recorder import make_scene, make_poses

        lib = library.Library({str(tmp_path / "killed")!r})
        poses = make_poses(250, 1, 4)
        rec = lib.record("k", scene=make_scene(4), dt=0.02, block_frames=100)
        rec.add_stream("v", "scalar")
        for t in range(250):
            rec.log(poses[t], v=float(t))
        rec.flush()  # both full windows are on disk
        os._exit(0)  # no close(), no atexit: like SIGKILL
        """
    )
    subprocess.run([sys.executable, "-c", script], check=True, timeout=120)
    lib = library.Library(tmp_path / "killed")
    run_dir = lib.root / "runs" / "k"
    assert (run_dir / "rollout.json.partial").exists()
    report = lib.recover("k")
    assert report.n_frames == 200 and report.dropped_frames == 0
    poses = make_poses(250, 1, 4)
    assert_same_up_to_sign(read_all(lib, "k", "body_pose"), poses[:200])
    np.testing.assert_array_equal(
        read_all(lib, "k", "v")[:, 0], np.arange(200, dtype=np.float32)
    )
    assert lib.open("k").manifest.status == "complete"


def test_max_pending_windows_bounds_memory(lib):
    rec = recorder.Recorder(
        lib.root, "mp2", scene=make_scene(3), dt=0.02, max_pending=1,
        block_frames=5,
    )  # fmt: skip
    poses = make_poses(50, 1, 3)
    with rec:
        rec.log_frames(poses)
    assert read_all(lib, "mp2", "body_pose").shape[0] == 50


MJCF = """
<mujoco>
  <option timestep="0.01"/>
  <worldbody>
    <geom type="plane" size="5 5 .1"/>
    <body name="ball" pos="0 0 1">
      <freejoint/>
      <geom type="sphere" size=".1" rgba="1 0 0 1"/>
      <body name="arm" pos=".3 0 0">
        <joint type="hinge" axis="0 1 0"/>
        <geom type="capsule" size=".03 .15"/>
      </body>
    </body>
  </worldbody>
</mujoco>
"""


def test_records_a_mujoco_rollout(lib):
    mujoco = pytest.importorskip("mujoco")
    from simscope import mujoco as smj

    model = mujoco.MjModel.from_xml_string(MJCF)
    data = mujoco.MjData(model)
    data.qvel[:] = [1.0, 0.5, 2.0, 3.0, -2.0, 1.0, 4.0][: model.nv]
    scene = smj.scene_from_model(model)
    expected = []
    with lib.record(
        "mj",
        scene=scene,
        dt=model.opt.timestep,
        source=smj.source_info(),
        block_frames=64,
    ) as rec:
        rec.add_stream("height", "scalar", units="m")
        for _ in range(300):
            mujoco.mj_step(model, data)
            frame = smj.poses(data)
            expected.append(frame.copy())
            rec.log(frame, height=float(data.xpos[1, 2]))
    expected = np.stack(expected)
    out = read_all(lib, "mj", "body_pose")
    assert out.shape == (300, 1, model.nbody, 7)
    assert_same_up_to_sign(out, expected)
    assert_continuous(out)
    with lib.open("mj") as run:
        assert run.manifest.source["simulator"] == "mujoco"
        assert run.scene.n_bodies == model.nbody
        assert run.dt == pytest.approx(0.01)
        np.testing.assert_array_equal(
            run.stream("height").read(0, 300)[:, 0], expected[:, 0, 1, 2]
        )


def test_manifest_json_is_pretty_and_sorted(lib):
    with lib.record("p", scene=make_scene(3), dt=0.02) as rec:
        rec.log(make_poses(1, 1, 3)[0])
    text = (lib.root / "runs" / "p" / "rollout.json").read_text(
        encoding="utf-8"
    )
    obj = json.loads(text)
    assert text == json.dumps(obj, indent=2, sort_keys=True) + "\n"


def test_parallel_encoding_matches_serial(lib):
    poses = make_poses(230, 6, 3, seed=9)
    for name, threads in (("serial", 1), ("threads", 3)):
        with lib.record(
            name, scene=make_scene(3), dt=0.02, n_envs=6, encode_threads=threads
        ) as rec:
            rec.log_frames(poses)
    a = (lib.root / "runs" / "serial" / "body_pose.blk").read_bytes()
    b = (lib.root / "runs" / "threads" / "body_pose.blk").read_bytes()
    assert a == b
    with pytest.raises(ValueError, match="encode_threads"):
        lib.record("x", scene=make_scene(3), dt=0.02, encode_threads=0)
