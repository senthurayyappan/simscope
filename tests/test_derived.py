"""Tests for simscope.derived: root stream, summaries, envelopes, cache."""

import json

import numpy as np
import pytest

from simscope import core, derived, library
from simscope.io import blockfile, codecs

BF = 10
DT = 0.02


def make_scene():
    names = ["world", "torso", "leg"]
    bodies = tuple(
        core.Body(n, -1 if i == 0 else 0) for i, n in enumerate(names)
    )
    return core.Scene(bodies=bodies)


def make_poses(n, n_envs, seed=0):
    rng = np.random.default_rng(seed)
    quat = rng.normal(scale=0.1, size=(n, n_envs, 3, 4))
    quat[..., 3] += 1.0
    quat /= np.linalg.norm(quat, axis=-1, keepdims=True)
    pos = rng.normal(size=(n, n_envs, 3, 3))
    pos += np.arange(n)[:, None, None, None] * 0.03
    return np.concatenate([pos, quat], -1).astype(np.float32)


class Built:
    """A recorded run and the arrays that went into it."""

    def __init__(self, root, name, n, n_envs, *, codec="f32s", seed=0):
        self.root, self.name, self.n, self.n_envs = root, name, n, n_envs
        rng = np.random.default_rng(seed + 100)
        self.poses = make_poses(n, n_envs, seed)
        self.reward = rng.normal(size=(n, n_envs)).astype(np.float32)
        self.joint = rng.normal(size=(n, n_envs, 2)).astype(np.float32)
        self.contacts = rng.normal(size=(n, n_envs, 3, 6)).astype(np.float32)
        lib = library.Library(root)
        with lib.record(
            name,
            scene=make_scene(),
            dt=DT,
            n_envs=n_envs,
            block_frames=BF,
            codec=codec,
        ) as rec:
            rec.add_stream("reward", "scalar")
            rec.add_stream("joint", "vector", (2,), codec=codec)
            rec.add_stream("contacts", "arrows", (3, 6), codec=codec)
            rec.log_frames(
                self.poses,
                reward=self.reward,
                joint=self.joint,
                contacts=self.contacts,
            )
        lib.close()
        self.lib = library.Library(root)
        self.rollout = self.lib.open(name)
        self.cache = derived.cache_dir(root, self.rollout)

    def ensure(self, what):
        return derived.ensure(self.rollout, self.cache, what)

    def json(self, what):
        path = self.ensure(what)
        assert path is not None
        return json.loads(path.read_text(encoding="utf-8"))

    def close(self):
        self.rollout.close()
        self.lib.close()


@pytest.fixture
def make_run(tmp_path):
    runs = []

    def make(name="r", n=35, n_envs=3, **kw):
        run = Built(tmp_path / "lib", name, n, n_envs, **kw)
        runs.append(run)
        return run

    yield make
    for run in runs:
        run.close()


# -- reading components --


@pytest.mark.parametrize("codec", ["f32s", "q16d"])
@pytest.mark.parametrize("cols", [(0, 1), (7, 14), (0, 21), (20, 21)])
def test_component_decode_matches_the_full_reader(make_run, codec, cols):
    run = make_run(n_envs=2, codec=codec)
    src = derived._Source(run.rollout, "body_pose")
    ref = run.rollout.stream("body_pose").read(0, run.n)
    ref = ref.reshape(run.n, 2, 21)
    import concurrent.futures

    with concurrent.futures.ThreadPoolExecutor(2) as pool:
        for w in range(src.n_windows):
            got = src.window(w, cols[0], cols[1], pool)
            lo, hi = w * BF, min((w + 1) * BF, run.n)
            want = ref[lo:hi, :, cols[0] : cols[1]]
            if codec == "f32s":
                np.testing.assert_array_equal(got, want)
            else:  # whole poses are renormalized like the reader does
                np.testing.assert_allclose(got, want, atol=1e-5)


def test_env_chunks_of_a_window(make_run):
    import concurrent.futures

    run = make_run(n_envs=5)
    src = derived._Source(run.rollout, "joint")
    with concurrent.futures.ThreadPoolExecutor(2) as pool:
        full = src.window(1, 0, 2, pool)
        part = src.window(1, 0, 2, pool, (2, 4))
    np.testing.assert_array_equal(part, full[:, 2:4])
    np.testing.assert_array_equal(full, run.joint[BF : 2 * BF])


# -- root pose --


def test_root_pose_for_a_crowd(make_run):
    run = make_run(n_envs=70)
    path = run.ensure(derived.ROOT_POSE)
    assert path == run.cache / "root_pose.blk"
    with blockfile.BlockReader(path, kind="pose") as r:
        assert (r.n_envs, r.n_frames, r.item_shape) == (70, 35, (1, 7))
        assert r.block_frames == BF
        assert set(r.directory["codec"].tolist()) == {codecs.CODEC_Q16D}
        got = r.read(0, 35)
    want = run.poses[:, :, 1:2]  # the torso
    np.testing.assert_allclose(got[..., :3], want[..., :3], atol=1e-3)
    np.testing.assert_allclose(got[..., 3:], want[..., 3:], atol=1e-3)
    # Quaternion signs stay continuous, like any pose stream.
    dots = np.sum(got[1:, :, 0, 3:] * got[:-1, :, 0, 3:], axis=-1)
    assert (dots > 0).all()


def test_no_root_pose_for_a_small_run(make_run):
    run = make_run(n_envs=derived.CROWD_ENVS)
    assert not derived.applicable(run.rollout, derived.ROOT_POSE)
    assert run.ensure(derived.ROOT_POSE) is None
    assert not run.cache.exists() or not (run.cache / "root_pose.blk").exists()


def test_root_body_choice():
    def scene(*names):
        return core.Scene(
            bodies=tuple(
                core.Body(n, -1 if i == 0 else 0) for i, n in enumerate(names)
            )
        )

    assert derived.root_body(scene("world", "leg", "Torso")) == 2
    assert derived.root_body(scene("world", "leg", "base_link", "trunk")) == 3
    assert derived.root_body(scene("world", "leg", "base_link")) == 2
    assert derived.root_body(scene("world", "pelvis", "leg")) == 1
    assert derived.root_body(scene("hip", "world")) == 0
    assert derived.root_body(scene("world")) == 0


# -- summaries --


def test_summaries_match_numpy(make_run):
    run = make_run(n_envs=4)
    doc = run.json(derived.SUMMARIES)
    cols = {c["key"]: c for c in doc["columns"]}
    assert {"return", "min_height", "peak_speed", "peak_contact_force"} <= set(
        cols
    )
    assert cols["return"]["better"] == "high"
    assert cols["min_height"] == {
        "key": "min_height",
        "label": "Min height",
        "unit": "m",
        "better": "high",
    }
    assert cols["peak_contact_force"]["better"] == "low"
    v = doc["values"]
    root = run.poses[:, :, 1, :3].astype(np.float64)
    np.testing.assert_allclose(
        v["return"], run.reward.sum(axis=0, dtype=np.float64), rtol=1e-6
    )
    np.testing.assert_allclose(
        v["min_height"], root[..., 2].min(axis=0), rtol=1e-6
    )
    speed = np.linalg.norm(np.diff(root, axis=0), axis=-1) / DT
    np.testing.assert_allclose(v["peak_speed"], speed.max(axis=0), rtol=1e-5)
    force = np.linalg.norm(run.contacts[..., 3:], axis=-1)
    np.testing.assert_allclose(
        v["peak_contact_force"], force.max(axis=(0, 2)), rtol=1e-5
    )
    assert all(len(x) == 4 for x in v.values())


def test_summaries_columns_only_when_the_data_exists(tmp_path):
    lib = library.Library(tmp_path / "lib")
    poses = make_poses(12, 2)
    with lib.record(
        "bare", scene=make_scene(), dt=DT, n_envs=2, block_frames=BF
    ) as rec:
        rec.log_frames(poses)
    with lib.open("bare") as ro:
        cache = derived.cache_dir(tmp_path / "lib", ro)
        path = derived.ensure(ro, cache, derived.SUMMARIES)
        assert path is not None
        doc = json.loads(path.read_text(encoding="utf-8"))
    keys = [c["key"] for c in doc["columns"]]
    assert "return" not in keys and "peak_contact_force" not in keys
    assert keys[:2] == ["min_height", "peak_speed"]
    lib.close()


def test_summaries_include_highlight_counts(make_run):
    run = make_run(n_envs=3)
    doc = run.json(derived.SUMMARIES)
    cols = [c["key"] for c in doc["columns"]]
    assert cols[-1] == "n_highlights"
    counts = doc["values"]["n_highlights"]
    assert len(counts) == 3 and all(isinstance(c, int) for c in counts)
    hl = json.loads((run.cache / "highlights.json").read_text(encoding="utf-8"))
    assert sum(counts) == len(hl["highlights"])


def test_summaries_for_a_crowd_also_write_the_root_stream(make_run):
    run = make_run(n_envs=66, n=25)
    run.ensure(derived.SUMMARIES)
    assert (run.cache / "root_pose.blk").is_file()
    before = (run.cache / "root_pose.blk").stat().st_mtime_ns
    run.ensure(derived.ROOT_POSE)  # already there: not recomputed
    assert (run.cache / "root_pose.blk").stat().st_mtime_ns == before


# -- envelopes --


def test_envelope_of_a_vector_stream(make_run):
    run = make_run(n_envs=9)
    doc = run.json(derived.envelope_name("joint"))
    assert doc["dt"] == pytest.approx(DT, rel=1e-6)
    assert doc["t0"] == 0 and doc["components"] == 2
    for key, q in (("p5", 5), ("p50", 50), ("p95", 95)):
        want = np.percentile(run.joint, q, axis=1).T  # [K, T]
        got = np.array(doc[key])
        assert got.shape == (2, 35)
        np.testing.assert_allclose(got, want, rtol=1e-5, atol=1e-6)
    assert (np.array(doc["p5"]) <= np.array(doc["p50"])).all()
    assert (np.array(doc["p50"]) <= np.array(doc["p95"])).all()


def test_envelope_of_a_scalar_stream(make_run):
    run = make_run(n_envs=9, n=23)
    doc = run.json(derived.envelope_name("reward"))
    assert doc["components"] == 1
    want = np.percentile(run.reward, 50, axis=1)
    np.testing.assert_allclose(
        np.array(doc["p50"])[0], want, rtol=1e-5, atol=1e-6
    )


def test_envelope_applicability(make_run):
    run = make_run(n_envs=3)
    ro = run.rollout
    assert derived.applicable(ro, derived.envelope_name("reward"))
    assert not derived.applicable(ro, derived.envelope_name("body_pose"))
    assert not derived.applicable(ro, derived.envelope_name("contacts"))
    assert not derived.applicable(ro, derived.envelope_name("nope"))
    assert run.ensure(derived.envelope_name("contacts")) is None
    single = make_run("one", n_envs=1)
    assert not derived.applicable(
        single.rollout, derived.envelope_name("reward")
    )
    assert not derived.applicable(ro, "stamp.json")
    assert not derived.applicable(ro, "../x")


def test_envelope_reads_in_groups_when_a_window_is_large(make_run, monkeypatch):
    run = make_run(n_envs=9)
    want = run.json(derived.envelope_name("joint"))
    (run.cache / "envelopes" / "joint.json").unlink()
    monkeypatch.setattr(derived, "_WINDOW_BYTES", BF * 9 * 4)  # one component
    assert run.json(derived.envelope_name("joint")) == want


# -- the cache --


def test_files_are_reused_until_the_manifest_changes(make_run):
    run = make_run(n_envs=70)
    first = run.ensure(derived.SUMMARIES)
    stamp = json.loads((run.cache / "stamp.json").read_text(encoding="utf-8"))
    assert stamp["version"] == derived.VERSION
    assert derived.fresh(run.rollout, run.cache, derived.SUMMARIES) == first
    mtime = first.stat().st_mtime_ns
    assert run.ensure(derived.SUMMARIES) == first
    assert first.stat().st_mtime_ns == mtime
    # Touching the manifest discards every derived file of the run.
    path = run.rollout.path / "rollout.json"
    m = json.loads(path.read_text(encoding="utf-8"))
    m["tags"] = ["edited"]
    path.write_text(json.dumps(m), encoding="utf-8")
    assert derived.fresh(run.rollout, run.cache, derived.SUMMARIES) is None
    again = run.ensure(derived.SUMMARIES)
    assert again == first and again.stat().st_mtime_ns != mtime
    assert (
        json.loads((run.cache / "stamp.json").read_text(encoding="utf-8"))
        != stamp
    )


def test_cache_is_keyed_by_run_id(make_run, tmp_path):
    run = make_run()
    assert (
        run.cache
        == tmp_path / "lib" / ".simscope" / "derived" / run.rollout.manifest.id
    )


def test_read_only_library_falls_back_to_a_temp_cache(tmp_path, monkeypatch):
    root = tmp_path / "ro"
    root.mkdir()
    import os

    real = os.access
    monkeypatch.setattr(
        derived.os,
        "access",
        lambda p, m: False if str(p).startswith(str(root)) else real(p, m),
    )
    path = derived.cache_root(root)
    assert not str(path).startswith(str(root))
    assert path.name and "simscope-derived" in str(path)


def test_recording_runs_have_no_derived_data(tmp_path):
    lib = library.Library(tmp_path / "lib")
    rec = lib.record(
        "live", scene=make_scene(), dt=DT, n_envs=70, block_frames=BF
    )
    rec.add_stream("reward", "scalar")
    rec.log_frames(make_poses(10, 70), reward=np.zeros((10, 70), np.float32))
    rec.flush()
    with lib.open("live") as ro:
        for what in (
            derived.ROOT_POSE,
            derived.SUMMARIES,
            derived.HIGHLIGHTS,
            derived.envelope_name("reward"),
        ):
            assert not derived.applicable(ro, what)
            assert (
                derived.ensure(
                    ro, derived.cache_dir(tmp_path / "lib", ro), what
                )
                is None
            )
    rec.close()
    lib.close()


def test_failed_pass_leaves_no_partial_file(make_run, monkeypatch):
    run = make_run(n_envs=70)

    def boom(*a, **k):
        raise RuntimeError("boom")

    monkeypatch.setattr(derived.blockfile.BlockWriter, "finalize", boom)
    with pytest.raises(RuntimeError):
        run.ensure(derived.ROOT_POSE)
    assert not list(run.cache.glob("root_pose*"))


def test_highlights_are_delegated(make_run):
    run = make_run()
    path = run.ensure(derived.HIGHLIGHTS)
    assert path == run.cache / "highlights.json"
    doc = json.loads(path.read_text(encoding="utf-8"))
    assert doc["format"] == "simscope-highlights/2"
    assert derived.highlight_count(run.cache) == len(doc["highlights"])
    assert derived.highlight_count(run.cache / "nowhere") is None


# -- number formatting --


def test_sig_list_rounds_to_short_literals():
    out = derived._sig_list(
        np.array([0.1 + 0.2, 123456.789123, -1e-9 * 3.14159265, 0.0])
    )
    assert out[0] == 0.3 and out[1] == 123456.8 and out[3] == 0.0
    assert out[2] == pytest.approx(-3.141593e-9)
    assert len(json.dumps(out)) < 60
    big = derived._sig_list(np.array([1.23456789e12, np.float32(2.5)]))
    assert big == [1.234568e12, 2.5]
    assert derived._sig_list(np.array([1.0, np.nan, np.inf])) == [
        1.0,
        None,
        None,
    ]
    assert derived._sig_list(np.zeros((2, 3))) == [[0.0] * 3] * 2
