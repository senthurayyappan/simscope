import importlib.util
import pathlib
import warnings

import numpy as np
import pytest

with warnings.catch_warnings():
    warnings.simplefilter("ignore")
    from starlette.testclient import TestClient

from simscope import core, library, server

FIXTURES = pathlib.Path(__file__).parent.parent / "fixtures"
TOKEN = "test-token"
BF = 10
HOST = "http://localhost"
ORIGIN = {"Origin": HOST, "X-Simscope-Token": TOKEN}


def make_scene(n_bodies=3):
    names = ["world", "torso", "leg", "arm"]
    bodies = tuple(
        core.Body(names[i] if i < 4 else f"b{i}", -1 if i == 0 else 0)
        for i in range(n_bodies)
    )
    return core.Scene(bodies=bodies)


def make_poses(n, n_envs=1, n_bodies=3, seed=0):
    rng = np.random.default_rng(seed)
    quat = rng.normal(scale=0.1, size=(n, n_envs, n_bodies, 4))
    quat[..., 3] += 1.0
    quat /= np.linalg.norm(quat, axis=-1, keepdims=True)
    pos = rng.normal(size=(n, n_envs, n_bodies, 3))
    # A drifting trajectory, so speeds and heights differ per env.
    pos += np.arange(n)[:, None, None, None] * 0.05
    return np.concatenate([pos, quat], -1).astype(np.float32)


def _load_fixture_module():
    spec = importlib.util.spec_from_file_location(
        "make_format_fixtures", FIXTURES / "make_format_fixtures.py"
    )
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def record(lib, name, n, n_envs, *, seed, n_bodies=3, extras=True, **kw):
    """Records a finished run and returns its poses and rewards."""
    poses = make_poses(n, n_envs, n_bodies, seed)
    rewards = np.random.default_rng(seed).normal(size=(n, n_envs))
    rewards = rewards.astype(np.float32)
    with lib.record(
        name,
        scene=make_scene(n_bodies),
        dt=0.02,
        n_envs=n_envs,
        block_frames=BF,
        source={"simulator": "mujoco", "version": "3"},
        **kw,
    ) as rec:
        if extras:
            rec.add_stream("reward", "scalar")
            rec.add_stream("joint", "vector", (2,))
            rec.add_stream("contacts", "arrows", (2, 6))
        joint = np.random.default_rng(seed + 1).normal(size=(n, n_envs, 2))
        contacts = np.random.default_rng(seed + 2).normal(
            size=(n, n_envs, 2, 6)
        )
        for t in range(n):
            if extras:
                rec.log(
                    poses[t],
                    reward=rewards[t],
                    joint=joint[t].astype(np.float32),
                    contacts=contacts[t].astype(np.float32),
                )
            else:
                rec.log(poses[t])
    return poses, rewards


@pytest.fixture
def lib_root(tmp_path):
    """A library with two meshed runs, a single-env run and a crowd run."""
    root = tmp_path / "lib"
    _load_fixture_module().build_library(root)
    lib = library.Library(root)
    record(lib, "walk", 40, 1, seed=1, tags=["sweep"])
    record(lib, "crowd", 30, 70, seed=2)
    lib.close()
    return root


def make_client(root, **kw):
    kw.setdefault("watch", False)
    kw.setdefault("warm", False)
    app = server.create_app(root, author="ada", token=TOKEN, **kw)
    return TestClient(app, base_url=HOST)


@pytest.fixture
def client(lib_root):
    with make_client(lib_root) as c:
        yield c


@pytest.fixture
def state(client):
    return client.app.state.services.state


class LiveRun:
    """A run whose recorder stays open so the tests can grow it."""

    def __init__(self, lib, name, total, n_envs=2):
        self.poses = make_poses(total, n_envs, 3, 7)
        self.rewards = np.arange(total * n_envs, dtype=np.float32).reshape(
            total, n_envs
        )
        self.pos = 0
        self.rec = lib.record(
            name, scene=make_scene(), dt=0.02, n_envs=n_envs, block_frames=BF
        )
        self.rec.add_stream("reward", "scalar")

    def grow(self, n):
        """Logs ``n`` more frames and waits until the windows are on disk."""
        sl = slice(self.pos, self.pos + n)
        self.rec.log_frames(self.poses[sl], reward=self.rewards[sl])
        self.rec.flush()
        self.pos += n

    def finish(self):
        self.rec.close()


@pytest.fixture
def live(lib_root):
    lib = library.Library(lib_root)
    run = LiveRun(lib, "live", 60)
    yield run
    if run.rec is not None:
        run.rec.close()
    lib.close()
