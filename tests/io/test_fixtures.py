import json
import pathlib
import struct

import numpy as np

from simscope.io import blockfile, codecs, pack

FORMAT_DIR = pathlib.Path(__file__).parent.parent / "fixtures" / "format"


def _expected():
    return json.loads(
        (FORMAT_DIR / "expected.json").read_text(encoding="utf-8")
    )


def test_fixtures_are_small():
    total = sum(p.stat().st_size for p in FORMAT_DIR.iterdir())
    assert total < 200_000


def test_fixture_script_is_deterministic(tmp_path, fixtures_module):
    fixtures_module.OUT_DIR = tmp_path / "format"
    fixtures_module.main()
    for p in FORMAT_DIR.iterdir():
        assert (tmp_path / "format" / p.name).read_bytes() == p.read_bytes()


def test_f32s_fixture():
    e = _expected()["f32s"]
    raw = (FORMAT_DIR / e["file"]).read_bytes()
    assert raw[:4] == b"SSBK"
    assert struct.unpack_from("<I", raw, 36)[0] == e["n_frames"] == 25
    with blockfile.BlockReader(FORMAT_DIR / e["file"]) as r:
        out = r.read(0, r.n_frames)
    assert out.view(np.uint32).reshape(-1).tolist() == e["bits"]
    assert e["codecs"] == [1] * 6  # 3 windows x 2 envs


def test_q16d_fixture():
    e = _expected()["q16d"]
    with blockfile.BlockReader(FORMAT_DIR / e["file"]) as r:
        assert e["codecs"] == r.directory["codec"].tolist() == [2] * 9
        raw = r.read(0, r.n_frames)
    assert raw.reshape(-1).tolist() == e["values_raw"]
    with blockfile.BlockReader(FORMAT_DIR / e["file"], kind="pose") as r:
        norm = r.read(0, r.n_frames)
    assert norm.reshape(-1).tolist() == e["values_renormalized"]
    assert np.abs(norm - raw).max() < 1e-3


def test_mesh_fixtures():
    ex = _expected()
    for key in ("mesh_raw", "mesh_q16"):
        e = ex[key]
        mesh = codecs.decode_mesh((FORMAT_DIR / e["file"]).read_bytes())
        assert mesh.vertices.reshape(-1).tolist() == e["vertices"]
        assert mesh.faces.reshape(-1).tolist() == e["faces"]
        assert mesh.uvs is not None
        assert mesh.uvs.reshape(-1).tolist() == e["uvs"]
    assert mesh.normals is None
    raw = codecs.decode_mesh((FORMAT_DIR / "mesh_raw.ssmh").read_bytes())
    assert raw.normals is not None
    assert raw.normals.reshape(-1).tolist() == ex["mesh_raw"]["normals"]


def test_pack_fixture():
    e = _expected()["pack"]
    with pack.PackReader(FORMAT_DIR / e["file"]) as pr:
        assert pr.paths() == e["paths"]
        assert len(e["shared_mesh_entries"]) == 1
        for name, run in e["runs"].items():
            assert pr.manifest(name).to_json() == run["manifest"]
            assert run["scene_path"] in pr
            for sname, s in run["streams"].items():
                with pr.stream(name, sname) as r:
                    assert (
                        r.read(0, r.n_frames).reshape(-1).tolist()
                        == s["values"]
                    )
