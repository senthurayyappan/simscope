import json
import struct
import zlib

import numpy as np
import pytest

from simscope.io import FormatError, blockfile, cas, codecs, manifest, pack


def _entries(raw):
    magic, major, minor, n, res, dir_off, dir_len, crc = struct.unpack_from(
        "<4sHHIIQII", raw
    )
    assert (magic, major, minor, res) == (b"SSPK", 1, 0, 0)
    directory = raw[dir_off : dir_off + dir_len]
    assert crc == zlib.crc32(directory)
    assert dir_off % 8 == 0
    entries = json.loads(directory)["entries"]
    assert len(entries) == n
    return entries


def test_pack_layout_and_dedup(library, tmp_path):
    root, names = library
    out = pack.write_pack(root, list(names), tmp_path / "x.simscope")
    raw = out.read_bytes()
    entries = _entries(raw)
    paths = [e["path"] for e in entries]
    assert len(paths) == len(set(paths))
    assert all(e["offset"] % 8 == 0 and e["offset"] >= 32 for e in entries)
    # Two runs share a mesh: exactly one asset, two scenes.
    assert len([p for p in paths if p.startswith("assets/")]) == 1
    assert len([p for p in paths if p.startswith("scenes/")]) == 2
    for run in names:
        for f in ("rollout.json", "body_pose.blk", "reward.blk"):
            assert f"runs/{run}/{f}" in paths
    assert not any(p.endswith(".partial") for p in paths)
    # Entries are stored as-is: the asset bytes hash to their path.
    asset = next(e for e in entries if e["path"].startswith("assets/"))
    blob = raw[asset["offset"] : asset["offset"] + asset["length"]]
    assert asset["path"].endswith(cas.Ref.of(blob).sha256)
    assert blob[:4] == b"SSMH" and blob[20] == codecs.MESH_Q16


def test_transcode_false_keeps_bytes(library, tmp_path):
    root, names = library
    store = cas.ContentStore(root)
    out = pack.write_pack(
        root, list(names), tmp_path / "x.simscope", transcode=False
    )
    with pack.PackReader(out) as pr:
        for run in names:
            man = manifest.read_manifest(root / "runs" / run)
            assert (
                bytes(pr.read(f"runs/{run}/rollout.json"))
                == (root / "runs" / run / "rollout.json").read_bytes()
            )
            assert (
                bytes(pr.read(f"runs/{run}/body_pose.blk"))
                == (root / "runs" / run / "body_pose.blk").read_bytes()
            )
            assert pr.manifest(run).scene == man.scene
            assert bytes(pr.read(pack.scene_path(man.scene))) == store.get(
                man.scene, "scene"
            )
        assets = [p for p in pr.paths() if p.startswith("assets/")]
        assert len(assets) == 1
        assert pr.read(assets[0])[20] == codecs.MESH_RAW


def test_transcode_rewrites_scene_and_streams(library, tmp_path):
    root, names = library
    out = pack.write_pack(root, list(names), tmp_path / "x.simscope")
    store = cas.ContentStore(root)
    with pack.PackReader(out) as pr:
        assert pr.runs() == sorted(names)
        for run in names:
            src = manifest.read_manifest(root / "runs" / run)
            man = pr.manifest(run)
            assert man.scene != src.scene  # meshes changed -> new hash
            assert man.id == src.id and man.name == run
            doc = json.loads(bytes(pr.read(pack.scene_path(man.scene))))
            mesh_ref = cas.Ref.from_json(doc["meshes"][0])
            assert cas.Ref.of(pr.read(pack.asset_path(mesh_ref))) == mesh_ref
            sc = pr.scene(man.scene)
            orig = pack.scene.load_scene(store, src.scene)
            assert sc.meshes[0].normals is None
            assert np.array_equal(sc.meshes[0].faces, orig.meshes[0].faces)
            assert [g.kind for g in sc.geoms] == [g.kind for g in orig.geoms]
            with pr.stream(run, "body_pose") as r:
                assert set(r.directory["codec"].tolist()) == {2}
                got = r.read(0, r.n_frames)
            with blockfile.BlockReader(
                root / "runs" / run / "body_pose.blk"
            ) as r:
                want = r.read(0, r.n_frames)
            assert np.abs(got[..., :3] - want[..., :3]).max() < 1e-3
            assert np.abs(got[..., 3:] - want[..., 3:]).max() < 1e-3
            norms = np.linalg.norm(got[..., 3:], axis=-1)
            assert np.allclose(norms, 1.0, atol=1e-6)  # renormalized
            with pr.stream(run, "reward") as r:  # non-pose: bit-exact copy
                assert set(r.directory["codec"].tolist()) == {1}
    # The library itself is untouched.
    assert cas.ContentStore(root).has(
        manifest.read_manifest(root / "runs" / "run_a").scene, "scene"
    )


def test_pack_smaller_when_transcoded(library, tmp_path):
    root, names = library
    a = pack.write_pack(root, list(names), tmp_path / "a.simscope")
    b = pack.write_pack(
        root, list(names), tmp_path / "b.simscope", transcode=False
    )
    assert a.stat().st_size < b.stat().st_size


def test_pack_includes_annotations_and_is_deterministic(library, tmp_path):
    root, names = library
    (root / "runs" / names[0] / "annotations.json").write_text('{"markers":[]}')
    a = pack.write_pack(root, list(names), tmp_path / "a.simscope")
    b = pack.write_pack(root, list(names), tmp_path / "b.simscope")
    assert a.read_bytes() == b.read_bytes()
    with pack.PackReader(a) as pr:
        assert bytes(pr.read(f"runs/{names[0]}/annotations.json")) == (
            b'{"markers":[]}'
        )
        assert f"runs/{names[1]}/annotations.json" not in pr


def test_single_run_pack_and_bytes_source(library, tmp_path):
    root, names = library
    out = pack.write_pack(root, [names[1]], tmp_path / "one.simscope")
    with pack.PackReader(out.read_bytes()) as pr:
        assert pr.runs() == [names[1]]
        with pr.stream(names[1], "reward") as r:
            assert r.n_frames == 12
        with pytest.raises(KeyError):
            pr.read("runs/nope/rollout.json")


def test_read_is_zero_copy_view(library, tmp_path):
    root, names = library
    out = pack.write_pack(root, list(names), tmp_path / "x.simscope")
    pr = pack.PackReader(out)
    view = pr.read(f"runs/{names[0]}/rollout.json")
    assert isinstance(view, memoryview) and view.readonly
    assert view.obj is not None
    del view
    pr.close()
    with pytest.raises(ValueError, match="closed"):
        pr.read("x")


def test_write_pack_errors(library, tmp_path):
    root, names = library
    with pytest.raises(ValueError, match="duplicate"):
        pack.write_pack(root, [names[0], names[0]], tmp_path / "x")
    with pytest.raises(FileNotFoundError):
        pack.write_pack(root, ["missing"], tmp_path / "x")
    with pytest.raises(ValueError):
        pack.write_pack(root, ["../x"], tmp_path / "x")
    run = root / "runs" / names[0]
    (run / "rollout.json").rename(run / "rollout.json.partial")
    with pytest.raises(ValueError, match="recording"):
        pack.write_pack(root, [names[0]], tmp_path / "x")
    assert not (tmp_path / "x").exists()


def test_pack_reader_errors(library, tmp_path):
    root, names = library
    good = bytearray(
        pack.write_pack(root, list(names), tmp_path / "x").read_bytes()
    )
    bad = bytearray(good)
    bad[:4] = b"NOPE"
    with pytest.raises(FormatError, match="magic"):
        pack.PackReader(bad)
    bad = bytearray(good)
    struct.pack_into("<H", bad, 4, 2)
    with pytest.raises(FormatError, match="major"):
        pack.PackReader(bad)
    dir_off = struct.unpack_from("<Q", good, 16)[0]
    bad = bytearray(good)
    bad[dir_off + 5] ^= 0x01
    with pytest.raises(FormatError, match="CRC"):
        pack.PackReader(bad)
    with pytest.raises(FormatError, match="truncated"):
        pack.PackReader(bytes(good[: dir_off + 3]))


def test_env_subset_rewrites_streams_and_manifest(library, tmp_path):
    root, names = library
    run = names[0]  # two envs
    out = pack.write_pack(
        root, [run], tmp_path / "s.simscope", envs=[1], transcode=False
    )
    with pack.PackReader(out) as pr:
        man = pr.manifest(run)
        assert man.n_envs == 1 and man.env_origins == ((1.0, 0.0, 0.0),)
        for stream in ("body_pose", "reward"):
            with pr.stream(run, stream) as got:
                assert got.n_envs == 1 and got.n_frames == 25
                with blockfile.BlockReader(
                    root / "runs" / run / f"{stream}.blk"
                ) as src:
                    np.testing.assert_array_equal(
                        got.read(0, 25), src.read(0, 25, [1])
                    )


def test_env_subset_order_and_transcode(library, tmp_path):
    root, names = library
    run = names[0]
    out = pack.write_pack(root, [run], tmp_path / "s.simscope", envs=[1, 0])
    with pack.PackReader(out) as pr:
        assert pr.manifest(run).env_origins == (
            (1.0, 0.0, 0.0),
            (0.0, 0.0, 0.0),
        )
        with pr.stream(run, "body_pose") as got:
            assert set(got.directory["codec"].tolist()) == {2}  # q16d
            swapped = got.read(0, 25)
        with blockfile.BlockReader(
            root / "runs" / run / "body_pose.blk", kind="pose"
        ) as src:
            want = src.read(0, 25)[:, [1, 0]]
    np.testing.assert_allclose(swapped, want, atol=1e-3)


def test_env_subset_errors(library, tmp_path):
    root, names = library
    run = names[0]
    for bad, match in (([], "empty"), ([0, 0], "repeat"), ([2], "2 envs")):
        with pytest.raises(ValueError, match=match):
            pack.write_pack(root, [run], tmp_path / "x", envs=bad)
    assert not (tmp_path / "x").exists()
    # The one-env run cannot give env 1.
    with pytest.raises(ValueError, match="1 envs"):
        pack.write_pack(root, list(names), tmp_path / "x", envs=[1])


def test_env_subset_annotations(library, tmp_path):
    root, names = library
    run = names[0]
    doc = {
        "format": "simscope-annotations/1",
        "run_id": "x",
        "future": {"kept": True},
        "events": [
            {"id": "a", "env": 0, "t0": 0.0},
            {"id": "b", "env": 1, "t0": 0.1},
            {"id": "c", "env": None, "t0": 0.2},
        ],
    }
    (root / "runs" / run / "annotations.json").write_text(json.dumps(doc))
    out = pack.write_pack(root, [run], tmp_path / "s.simscope", envs=[1])
    with pack.PackReader(out) as pr:
        got = json.loads(bytes(pr.read(f"runs/{run}/annotations.json")))
    assert got["future"] == {"kept": True}
    assert [(e["id"], e["env"]) for e in got["events"]] == [
        ("b", 0),
        ("c", None),
    ]


def test_derived_entries_and_minor_version(library, tmp_path):
    root, names = library
    plain = pack.write_pack(root, list(names), tmp_path / "a.simscope")
    assert _minor(plain.read_bytes()) == 0
    extra = {
        f"derived/{names[0]}/highlights.json": b'{"highlights":[]}',
        f"derived/{names[0]}/root_pose.blk": tmp_path / "a.simscope",
    }
    out = pack.write_pack(
        root, list(names), tmp_path / "b.simscope", derived=extra
    )
    raw = out.read_bytes()
    assert _minor(raw) == pack.MINOR_DERIVED == 1
    with pack.PackReader(raw) as pr:  # any minor is readable
        assert bytes(pr.read(f"derived/{names[0]}/highlights.json")) == (
            b'{"highlights":[]}'
        )
        assert pr.runs() == sorted(names)
    again = pack.write_pack(
        root, list(names), tmp_path / "c.simscope", derived=extra
    )
    assert again.read_bytes() == raw
    for bad in ("runs/x/y", "derived/../x", "x/derived/y"):
        with pytest.raises(ValueError, match="derived/"):
            pack.write_pack(
                root, list(names), tmp_path / "d", derived={bad: b""}
            )


def _minor(raw):
    return struct.unpack_from("<4sHH", raw)[2]
