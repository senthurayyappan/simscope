import queue
import threading
import time

import numpy as np
import pytest

from simscope import core, library
from simscope.io import errors

BF = 10


def make_scene(n_bodies=3):
    bodies = tuple(
        core.Body(f"b{i}", -1 if i == 0 else 0) for i in range(n_bodies)
    )
    return core.Scene(bodies=bodies)


def make_poses(n, n_envs=1, n_bodies=3, seed=0):
    rng = np.random.default_rng(seed)
    # Near the identity, so the writer's sign continuity leaves it alone.
    quat = rng.normal(scale=0.1, size=(n, n_envs, n_bodies, 4))
    quat[..., 3] += 1.0
    quat /= np.linalg.norm(quat, axis=-1, keepdims=True)
    pos = rng.normal(size=(n, n_envs, n_bodies, 3))
    return np.concatenate([pos, quat], -1).astype(np.float32)


@pytest.fixture
def lib(tmp_path):
    lib = library.Library(tmp_path / "lib")
    yield lib
    lib.close()


class SteppedRecorder:
    """Logs a run on a background thread, one chunk per ``step()``."""

    def __init__(self, lib, name, poses, rewards, chunks):
        self.poses, self.rewards, self.chunks = poses, rewards, chunks
        self._go: queue.Queue[bool] = queue.Queue()
        self._done: queue.Queue[int] = queue.Queue()
        self.error: BaseException | None = None
        self._lib, self._name = lib, name
        self.thread = threading.Thread(target=self._run, daemon=True)
        self.thread.start()

    def _run(self):
        try:
            rec = self._lib.record(
                self._name,
                scene=make_scene(),
                dt=0.02,
                block_frames=BF,
                n_envs=self.poses.shape[1],
            )
            rec.add_stream("reward", "scalar")
            pos = 0
            for size in self.chunks:
                self._go.get(timeout=60)
                rec.log_frames(
                    self.poses[pos : pos + size],
                    reward=self.rewards[pos : pos + size],
                )
                pos += size
                rec.flush()
                self._done.put(pos)
            self._go.get(timeout=60)
            rec.close()
            self._done.put(-1)
        except BaseException as exc:
            self.error = exc
            self._done.put(-2)

    def step(self) -> int:
        """Logs the next chunk and returns the frames logged so far."""
        self._go.put(True)
        got = self._done.get(timeout=30)
        assert got != -2, self.error
        return got

    def close(self):
        """Lets the recorder finish the run."""
        self._go.put(True)
        assert self._done.get(timeout=30) == -1, self.error
        self.thread.join()


def test_stepwise_growth_is_a_prefix_of_what_was_logged(lib):
    n = 95
    poses = make_poses(n)
    rewards = np.arange(n, dtype=np.float32).reshape(n, 1)
    chunks = [3, 4, 5, 8, 20, 1, 30, 24]
    assert sum(chunks) == n
    rec = SteppedRecorder(lib, "live", poses, rewards, chunks)
    logged = rec.step()
    run = lib.open("live")
    try:
        assert run.is_recording
        assert run.n_frames == 0  # nothing until the first refresh
        src = None
        seen = 0
        while True:
            got = run.refresh()
            assert got == (logged // BF) * BF  # only complete windows
            assert got >= seen
            assert run.n_frames == got
            if src is None:
                src = run.frame_source()
            assert src.n_frames == got
            if got:
                np.testing.assert_array_equal(src.read(0, got), poses[:got])
                reward = run.stream("reward").read(0, got)
                np.testing.assert_array_equal(reward, rewards[:got])
            seen = got
            if logged == n:
                break
            logged = rec.step()
        assert run.is_recording
        rec.close()
        assert run.refresh() == n
        assert not run.is_recording
        assert run.manifest.status == "complete" and run.n_frames == n
        assert src.n_frames == n
        np.testing.assert_array_equal(src.read(0, n), poses)
        np.testing.assert_array_equal(run.stream("reward").read(0, n), rewards)
        assert run.refresh() == n  # complete: a no-op
    finally:
        rec.thread.join(timeout=30)
        run.close()
    assert not rec.error


def test_frame_source_only_advances_on_refresh(lib):
    n = 40
    poses = make_poses(n)
    rewards = np.zeros((n, 1), np.float32)
    rec = SteppedRecorder(lib, "live", poses, rewards, [20, 20])
    rec.step()
    with lib.open("live") as run:
        src = run.frame_source()  # refreshes a recording run first
        assert src.n_frames == 20
        rec.step()
        assert src.n_frames == 20  # the recorder is ahead, the view is not
        with pytest.raises(IndexError):
            src.read(0, 21)
        assert run.refresh() == 40
        assert src.n_frames == 40
        np.testing.assert_array_equal(src.read(20, 40), poses[20:])
        rec.close()


def test_free_running_recorder_and_tailing_reader(lib):
    n = 400
    poses = make_poses(n, n_envs=2, seed=3)
    rewards = np.arange(n * 2, dtype=np.float32).reshape(n, 2)
    err: list[BaseException] = []

    def record():
        try:
            with lib.record(
                "live", scene=make_scene(), dt=0.02, n_envs=2, block_frames=BF
            ) as rec:
                rec.add_stream("reward", "scalar")
                for t in range(n):
                    rec.log(poses[t], reward=rewards[t])
                    if t % 7 == 0:
                        time.sleep(0.001)
        except BaseException as exc:
            err.append(exc)

    thread = threading.Thread(target=record)
    thread.start()
    deadline = time.time() + 30
    while not (lib.run_dir("live") / "rollout.json.partial").exists():
        assert time.time() < deadline
        time.sleep(0.001)
    seen = 0
    with lib.open("live") as run:
        src = run.frame_source()
        while time.time() < deadline:
            finished = not thread.is_alive()
            got = run.refresh()
            assert got >= seen and (got % BF == 0 or not run.is_recording)
            if got > seen:
                np.testing.assert_array_equal(
                    src.read(seen, got), poses[seen:got]
                )
                np.testing.assert_array_equal(
                    run.stream("reward").read(seen, got), rewards[seen:got]
                )
                seen = got
            if finished:
                break
        thread.join()
        assert not err
        assert run.refresh() == n and not run.is_recording
        assert seen == n


def test_open_complete_run_is_unchanged(lib):
    with lib.record("done", scene=make_scene(), dt=0.02) as rec:
        rec.log_frames(make_poses(25))
    with lib.open("done") as run:
        assert not run.is_recording
        assert run.refresh() == 25 == run.n_frames
        assert run.frame_source().n_frames == 25


def test_refresh_updates_loaded_annotations(lib):
    rec = SteppedRecorder(
        lib, "live", make_poses(20), np.zeros((20, 1), np.float32), [10, 10]
    )
    rec.step()
    with lib.open("live") as run:
        run.refresh()
        assert run.annotations.n_frames == 10
        rec.step()
        run.refresh()
        assert run.annotations.n_frames == 20
        rec.close()
        run.refresh()
        assert run.annotations.n_frames == 20


def test_index_row_of_a_recording_run_tracks_frames(lib):
    n = 60
    poses = make_poses(n)
    rec = SteppedRecorder(
        lib, "live", poses, np.zeros((n, 1), np.float32), [25, 15, 20]
    )
    rec.step()
    lib.refresh()
    (row,) = lib.runs()
    assert (row.status, row.n_frames) == ("recording", 20)
    rec.step()
    (row,) = lib.query(status="recording")
    assert row.n_frames == 40
    rec.step()
    assert lib.runs()[0].n_frames == 60
    rec.close()
    (row,) = lib.runs()
    assert (row.status, row.n_frames) == ("complete", 60)


def test_crashed_run_can_be_tailed_only_on_request(lib):
    poses = make_poses(35)
    rec = lib.record("crash", scene=make_scene(), dt=0.02, block_frames=BF)
    rec.log_frames(poses)
    rec.abort()
    run = lib.open("crash")
    with pytest.raises(errors.FormatError, match="recover"):
        run.stream("body_pose")
    assert run.refresh() == 35  # abort() wrote the short last window
    assert run.is_recording
    np.testing.assert_array_equal(run.frame_source().read(0, 35), poses)
    run.close()
    assert lib.runs()[0].n_frames == 35
    lib.recover("crash")
    assert lib.runs()[0].n_frames == 35
    with lib.open("crash") as done:
        assert not done.is_recording and done.n_frames == 35


def test_recording_before_first_window_has_zero_frames(lib):
    rec = lib.record("early", scene=make_scene(), dt=0.02, block_frames=BF)
    rec.log_frames(make_poses(3))
    with lib.open("early") as run:
        assert run.refresh() == 0
        assert run.frame_source().n_frames == 0
    assert lib.runs()[0].n_frames == 0
    rec.close()
    with lib.open("early") as run:
        assert run.refresh() == 3
