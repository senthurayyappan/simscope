import json
import time
from typing import Any

import pytest

from simscope.io import FormatError, cas, manifest


def make_manifest(**kw):
    base: dict[str, Any] = {
        "id": manifest.new_ulid(),
        "name": "walk_seed17",
        "created": "2026-09-30T12:00:00Z",
        "dt": 0.02,
        "n_frames": 1000,
        "n_envs": 2,
        "n_bodies": 31,
        "scene": cas.Ref("ab" * 32, 123),
        "streams": {
            "body_pose": manifest.StreamInfo(
                "body_pose.blk", "pose", (31, 7), units="m"
            ),
            "reward": manifest.StreamInfo("reward.blk", "scalar", ()),
            "q": manifest.StreamInfo(
                "q.blk", "vector", (2,), labels=("a", "b")
            ),
        },
        "status": "complete",
        "source": {"simulator": "mujoco", "version": "3.14.0"},
        "tags": ("sweep_07",),
    }
    base.update(kw)
    return manifest.RolloutManifest(**base)


def test_round_trip_and_pretty_printing(tmp_path):
    m = make_manifest(
        env_origins=((0.0, 0.0, 0.0), (1.0, 2.0, 0.0)),
        env_scenes=(cas.Ref("cd" * 32, 5), cas.Ref("ef" * 32, 6)),
    )
    path = manifest.write_manifest(tmp_path / "runs" / m.name, m, partial=False)
    text = path.read_text()
    assert text.startswith('{\n  "created"')  # indent=2, sorted keys
    obj = json.loads(text)
    assert obj["format"] == "simscope-rollout/1"
    assert obj["scene"] == {"sha256": "ab" * 32, "size": 123}
    assert obj["streams"]["q"]["labels"] == ["a", "b"]
    assert "labels" not in obj["streams"]["reward"]
    assert manifest.read_manifest(path.parent) == m


def test_defaults_zero_origins():
    obj = make_manifest().to_json()
    assert obj["env_origins"] == [[0.0, 0.0, 0.0]] * 2
    assert obj["env_scenes"] is None


def test_partial_handling(tmp_path):
    run = tmp_path / "r"
    m = make_manifest(status="recording")
    p = manifest.write_manifest(run, m, partial=True)
    assert p.name == "rollout.json.partial"
    assert not (run / "rollout.json").exists()
    assert manifest.read_manifest(run).status == "recording"
    m.status = "complete"
    p = manifest.write_manifest(run, m, partial=False)
    assert p.name == "rollout.json"
    assert not (run / "rollout.json.partial").exists()
    assert not [f for f in run.iterdir() if f.name.startswith(".tmp")]
    with pytest.raises(ValueError, match="status"):
        manifest.write_manifest(run, m, partial=True)


def test_read_missing(tmp_path):
    with pytest.raises(FileNotFoundError):
        manifest.read_manifest(tmp_path)


def test_validation_errors():
    obj = make_manifest().to_json()

    def parse(**changes):
        o = {**obj, **changes}
        return manifest.RolloutManifest.from_json(o)

    parse()
    with pytest.raises(FormatError, match="not a rollout"):
        parse(format="nope")
    with pytest.raises(FormatError, match="version"):
        parse(format="simscope-rollout/2")
    with pytest.raises(FormatError, match="malformed"):
        parse(dt="fast")
    streams = dict(obj["streams"])
    streams.pop("body_pose")
    with pytest.raises(FormatError, match="body_pose"):
        parse(streams=streams)
    streams = {
        **obj["streams"],
        "body_pose": {"file": "x", "kind": "pose", "item_shape": [30, 7]},
    }
    with pytest.raises(FormatError, match="body_pose"):
        parse(streams=streams)
    streams = {
        **obj["streams"],
        "reward": {"file": "x", "kind": "blob", "item_shape": []},
    }
    with pytest.raises(FormatError, match="stream kind"):
        parse(streams=streams)
    with pytest.raises(FormatError, match="run name"):
        parse(name="../evil")
    with pytest.raises(FormatError, match="env_origins"):
        parse(env_origins=[[0, 0, 0]])
    # Unknown fields are ignored.
    assert parse(future_field=1).name == "walk_seed17"


@pytest.mark.parametrize("name", ["a", "A0._-x", "0run", "x" * 128])
def test_valid_run_names(name):
    assert manifest.validate_run_name(name) == name


@pytest.mark.parametrize(
    "name", ["", ".hidden", "-x", "a/b", "a b", "x" * 129, "é", "a\n"]
)
def test_invalid_run_names(name):
    with pytest.raises(ValueError):
        manifest.validate_run_name(name)


def test_ulid():
    u = manifest.new_ulid(0)
    assert len(u) == 26 and u[:10] == "0" * 10
    assert set(u) <= set("0123456789ABCDEFGHJKMNPQRSTVWXYZ")
    assert manifest.new_ulid(1)[:10] == "0000000001"
    assert manifest.new_ulid(2**48 - 1)[:10] == "7ZZZZZZZZZ"
    with pytest.raises(ValueError):
        manifest.new_ulid(2**48)
    a, b = manifest.new_ulid(), manifest.new_ulid()
    assert a != b
    # Sortable by time.
    assert manifest.new_ulid(1000) < manifest.new_ulid(2000)
    now_ms = int(time.time() * 1000)
    ts = 0
    for ch in manifest.new_ulid()[:10]:
        ts = ts * 32 + manifest._CROCKFORD.index(ch)
    assert abs(ts - now_ms) < 5000


def test_utc_now_format():
    s = manifest.utc_now()
    assert len(s) == 20 and s.endswith("Z") and s[10] == "T"
