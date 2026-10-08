"""Discovery of rollout libraries nested under a folder."""

import json
import logging
import shutil

import numpy as np
from tests.test_index import write_run

from simscope import core, discover, library
from simscope.io import pack


def _manifest(run_dir, frames):
    (run_dir / "rollout.json").write_text(
        json.dumps({"n_frames": frames}), encoding="utf-8"
    )


def test_finds_a_direct_library_and_nested_ones(tmp_path):
    write_run(tmp_path, "local", n_frames=3)
    nested = tmp_path / "task" / "model" / "20261002-131651-488607Z"
    write_run(nested, "20261002-131651-488607Z", n_frames=150)
    found = discover.by_name(tmp_path)
    assert set(found) == {"local", "20261002-131651-488607Z"}
    assert found["local"].library == tmp_path
    assert found["20261002-131651-488607Z"].library == nested
    assert found["20261002-131651-488607Z"].run_dir == (
        nested / "runs" / "20261002-131651-488607Z"
    )


def test_a_task_named_scenes_is_still_searched(tmp_path):
    # ``scenes`` is skipped only inside a library, where it is the content
    # store. A task of that name still holds libraries.
    write_run(tmp_path / "scenes" / "cad" / "from_scenes", "from_scenes")
    found = discover.by_name(tmp_path)
    assert set(found) == {"from_scenes"}


def test_skips_data_dirs_symlinks_and_dot_dirs(tmp_path):
    write_run(tmp_path, "local")
    write_run(tmp_path / "scenes" / "ab" / "buried_lib", "buried")
    write_run(tmp_path / "assets" / "ff" / "also", "also")
    write_run(tmp_path / ".hidden" / "lib", "secret")
    (tmp_path / "runs" / "local" / "runs" / "inner").mkdir(parents=True)
    _manifest(tmp_path / "runs" / "local" / "runs" / "inner", 1)
    outside = tmp_path.with_name(tmp_path.name + "-out")
    write_run(outside, "escaped")
    (tmp_path / "linked").symlink_to(outside, target_is_directory=True)
    (tmp_path / "runs" / "empty_dir").mkdir()
    try:
        assert set(discover.by_name(tmp_path)) == {"local"}
    finally:
        shutil.rmtree(outside, ignore_errors=True)


def test_same_depth_collision_keeps_the_smaller_path(tmp_path, caplog):
    write_run(tmp_path / "b" / "lib", "same", n_frames=2)
    write_run(tmp_path / "a" / "lib", "same", n_frames=1)
    with caplog.at_level(logging.WARNING, logger="simscope.discover"):
        found = discover.by_name(tmp_path)
    assert found["same"].library == tmp_path / "a" / "lib"
    assert "skipping run 'same'" in caplog.text


def test_partial_manifest_is_a_run(tmp_path):
    write_run(
        tmp_path / "task" / "id",
        "live",
        status="recording",
        partial=True,
    )
    found = discover.by_name(tmp_path)
    assert found["live"].run_dir.name == "live"
    assert (found["live"].run_dir / "rollout.json.partial").is_file()


def test_missing_root_is_empty(tmp_path):
    assert discover.find_runs(tmp_path / "missing") == []


def test_library_opens_a_nested_run(tmp_path):
    nested = tmp_path / "task" / "model" / "walk"
    lib = library.Library(nested)
    with lib.record("walk", scene=_scene(), dt=0.02) as rec:
        rec.log_frames(_poses(4))
    lib.close()
    parent = library.Library(tmp_path)
    with parent.open("walk") as run:
        assert run.n_frames == 4
        assert run.path == nested / "runs" / "walk"
        assert len(run.scene.bodies) == 2
    assert parent.run_dir("walk") == nested / "runs" / "walk"
    assert not parent.run_dir("missing").exists()
    parent.close()


def test_pack_reads_scenes_from_each_nested_library(tmp_path):
    names = []
    for i, label in enumerate(("alpha", "bravo")):
        root = tmp_path / "outputs" / label / "model" / label
        n_bodies = i + 1
        lib = library.Library(root)
        with lib.record(label, scene=_scene(n_bodies), dt=0.02) as rec:
            rec.log_frames(_poses(3, n_bodies, seed=i))
        lib.close()
        names.append(label)
    out = pack.write_pack(tmp_path / "outputs", names, tmp_path / "x.simscope")
    with pack.PackReader(out) as reader:
        assert sorted(reader.runs()) == ["alpha", "bravo"]
        for name in names:
            manifest = json.loads(
                bytes(reader.read(f"runs/{name}/rollout.json"))
            )
            sha = manifest["scene"]["sha256"]
            assert f"scenes/{sha[:2]}/{sha}.json" in reader


def _scene(n_bodies=2):
    bodies = tuple(
        core.Body(f"b{i}", -1 if i == 0 else 0) for i in range(n_bodies)
    )
    return core.Scene(bodies=bodies)


def _poses(n, n_bodies=2, seed=0):
    rng = np.random.default_rng(seed)
    quat = rng.normal(scale=0.1, size=(n, 1, n_bodies, 4))
    quat[..., 3] += 1.0
    quat /= np.linalg.norm(quat, axis=-1, keepdims=True)
    pos = rng.normal(size=(n, 1, n_bodies, 3))
    return np.concatenate([pos, quat], -1).astype(np.float32)
