import json
import os
import pathlib
import subprocess
import sys

import numpy as np
import pytest

from simscope import cli, core, library
from simscope.io import manifest, pack

SRC = pathlib.Path(cli.__file__).parents[1]


def make_scene(n_bodies=3):
    bodies = tuple(
        core.Body(f"b{i}", -1 if i == 0 else 0) for i in range(n_bodies)
    )
    return core.Scene(bodies=bodies)


def make_poses(n, seed=0):
    rng = np.random.default_rng(seed)
    quat = rng.normal(scale=0.1, size=(n, 1, 3, 4))
    quat[..., 3] += 1.0
    quat /= np.linalg.norm(quat, axis=-1, keepdims=True)
    pos = rng.normal(size=(n, 1, 3, 3))
    return np.concatenate([pos, quat], -1).astype(np.float32)


def record(lib, name, n=30, **kwargs):
    with lib.record(name, scene=make_scene(), dt=0.02, **kwargs) as rec:
        rec.add_stream("reward", "scalar")
        rec.log_frames(make_poses(n), reward=np.arange(n, dtype=np.float32))


@pytest.fixture
def root(tmp_path):
    root = tmp_path / "lib"
    lib = library.Library(root)
    record(lib, "walk_a", n=30, tags=["walk"])
    record(lib, "run_b", n=50, tags=["run", "walk"])
    record(lib, "walk_c", n=80)
    with lib.open("walk_c") as run:
        run.annotations.set_favorite()
        run.annotations.rate(4, author="ada")
        run.annotations.save()
    lib.close()
    return root


def run(capsys, *argv):
    code = cli.main([str(a) for a in argv])
    out = capsys.readouterr()
    return code, out.out, out.err


# -- ls --


def test_ls_prints_an_aligned_table(root, capsys):
    code, out, err = run(capsys, "ls", root, "--sort", "name")
    assert code == 0 and err == ""
    lines = out.splitlines()
    assert [ln.split()[0] for ln in lines] == [
        "NAME", "run_b", "walk_a", "walk_c",
    ]  # fmt: skip
    assert lines[0].split()[:6] == [
        "NAME", "STATUS", "FRAMES", "ENVS", "SECONDS", "CREATED",
    ]  # fmt: skip
    col = lines[0].index("FRAMES") + len("FRAMES")
    for line, frames in zip(lines[1:], ("50", "30", "80"), strict=True):
        assert line[:col].rstrip().endswith(frames)  # right-aligned
    assert "walk_c" in lines[3] and "*" in lines[3] and "4.0" in lines[3]
    assert "run,walk" in lines[1]


def test_ls_filters_sort_and_limit(root, capsys):
    _, out, _ = run(capsys, "ls", root, "--tag", "walk", "--tag", "run")
    assert [ln.split()[0] for ln in out.splitlines()[1:]] == ["run_b"]
    _, out, _ = run(capsys, "ls", root, "--favorite")
    assert [ln.split()[0] for ln in out.splitlines()[1:]] == ["walk_c"]
    _, out, _ = run(capsys, "ls", root, "--sort", "n_frames", "--limit", "2")
    assert [ln.split()[0] for ln in out.splitlines()[1:]] == [
        "walk_c", "run_b",
    ]  # fmt: skip
    _, out, _ = run(capsys, "ls", root, "--status", "recording")
    assert out == ""


def test_ls_json_is_one_object_per_line(root, capsys):
    code, out, _ = run(capsys, "ls", root, "--json", "--sort", "name")
    assert code == 0
    rows = [json.loads(line) for line in out.splitlines()]
    assert [r["name"] for r in rows] == ["run_b", "walk_a", "walk_c"]
    assert rows[0]["n_frames"] == 50 and rows[0]["tags"] == ["run", "walk"]
    assert rows[2]["favorite"] is True and rows[2]["rating"] == 4


def test_ls_empty_library_and_missing_folder(tmp_path, capsys):
    empty = tmp_path / "empty"
    empty.mkdir()
    code, out, err = run(capsys, "ls", empty)
    assert (code, out, err.strip()) == (0, "", "no runs")
    code, out, err = run(capsys, "ls", tmp_path / "nope")
    assert code == 1 and out == ""
    assert err.startswith("simscope: error: no library folder")
    assert err.count("\n") == 1 and "Traceback" not in err


def test_ls_does_not_import_the_server(root):
    code = (
        "import sys\n"
        "from simscope import cli\n"
        f"assert cli.main(['ls', {str(root)!r}]) == 0\n"
        "names = ('starlette', 'uvicorn', 'watchfiles')\n"
        "bad = [m for m in names if m in sys.modules]\n"
        "assert not bad, bad\n"
    )
    env = dict(os.environ, PYTHONPATH=str(SRC))
    res = subprocess.run(
        [sys.executable, "-c", code],
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    assert res.returncode == 0, res.stderr


def test_python_dash_m_simscope(root):
    env = dict(os.environ, PYTHONPATH=str(SRC))
    res = subprocess.run(
        [sys.executable, "-m", "simscope", "ls", str(root), "--json"],
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    assert res.returncode == 0, res.stderr
    assert len(res.stdout.splitlines()) == 3


# -- export and pack --


def test_export_writes_one_html(root, capsys, tmp_path):
    out = tmp_path / "out" / "a.html"
    code, stdout, err = run(capsys, "export", root, "walk_a", "-o", out)
    assert code == 0 and err == ""
    assert stdout.startswith(f"wrote {out}")
    page = out.read_text(encoding="utf-8")
    assert "<simscope-player" in page and "walk_a" in page


def test_export_layout_title_and_flags(root, capsys, tmp_path):
    big = tmp_path / "big.html"
    small = tmp_path / "small.html"
    args = [
        "export", root, "walk_a", "run_b", "--layout", "compare",
        "--title", "My sweep",
    ]  # fmt: skip
    assert run(capsys, *args, "-o", big)[0] == 0
    assert run(capsys, *args, "-o", small, "--no-transcode")[0] == 0
    assert "My sweep" in big.read_text(encoding="utf-8")
    assert small.stat().st_size > big.stat().st_size


def test_export_defaults_layout_from_run_count(root, capsys, tmp_path):
    out = tmp_path / "a.html"
    assert run(capsys, "export", root, "walk_a", "run_b", "-o", out)[0] == 0
    code, _, err = run(
        capsys, "export", root, "walk_a", "run_b", "-o", out,
        "--layout", "single",
    )  # fmt: skip
    assert code == 1 and "single" in err


def test_pack_writes_a_readable_pack(root, capsys, tmp_path):
    out = tmp_path / "x.simscope"
    code, stdout, _ = run(capsys, "pack", root, "walk_a", "run_b", "-o", out)
    assert code == 0 and stdout.startswith("wrote")
    with pack.PackReader(out) as reader:
        assert sorted(reader.runs()) == ["run_b", "walk_a"]
        assert "runs/walk_a/annotations.json" not in reader
    bare = tmp_path / "bare.simscope"
    args = ["pack", root, "walk_c", "-o", bare]
    assert run(capsys, *args, "--no-annotations")[0] == 0
    with pack.PackReader(bare) as reader:
        assert "runs/walk_c/annotations.json" not in reader
    assert run(capsys, *args)[0] == 0
    with pack.PackReader(bare) as reader:
        assert "runs/walk_c/annotations.json" in reader


@pytest.mark.parametrize("cmd", ["export", "pack"])
def test_export_and_pack_user_errors(root, capsys, tmp_path, cmd):
    out = tmp_path / "o.out"
    code, _, err = run(capsys, cmd, root, "ghost", "-o", out)
    assert code == 1 and "no run 'ghost'" in err and err.count("\n") == 1
    code, _, err = run(capsys, cmd, root, "../etc", "-o", out)
    assert code == 1 and "invalid run name" in err
    code, _, err = run(capsys, cmd, root, "walk_a", "walk_a", "-o", out)
    assert code == 1 and "duplicate" in err
    assert not out.exists()


@pytest.mark.parametrize("cmd", ["export", "pack"])
def test_export_and_pack_refuse_a_recording_run(tmp_path, capsys, cmd):
    lib = library.Library(tmp_path / "lib")
    rec = lib.record("live", scene=make_scene(), dt=0.02)
    rec.log_frames(make_poses(5))
    code, _, err = run(
        capsys, cmd, tmp_path / "lib", "live", "-o", tmp_path / "o.out"
    )
    assert code == 1 and "recording" in err and "Traceback" not in err
    rec.close()
    lib.close()


# -- recover --


def crash(root, name, n=25):
    lib = library.Library(root)
    rec = lib.record(name, scene=make_scene(), dt=0.02, block_frames=10)
    rec.log_frames(make_poses(n))
    rec.abort()
    lib.close()


def test_recover_a_crashed_run(root, capsys):
    crash(root, "boom")
    _, out, _ = run(capsys, "ls", root, "--status", "recording")
    assert "boom" in out
    code, out, err = run(capsys, "recover", root, "boom")
    assert code == 0 and err == ""
    assert "boom: recovered 25 frames" in out
    _, out, _ = run(capsys, "ls", root, "--status", "recording")
    assert out == ""
    code, out, _ = run(capsys, "recover", root, "boom")
    assert code == 0 and "already complete, 25 frames" in out
    assert manifest.read_manifest(root / "runs" / "boom").status == "complete"


def test_recover_user_errors(root, capsys):
    code, _, err = run(capsys, "recover", root, "ghost")
    assert code == 1 and "no run 'ghost'" in err
    code, _, err = run(capsys, "recover", root, "bad/name")
    assert code == 1 and "invalid run name" in err


# -- info --


def test_info_summarizes_a_run(root, capsys):
    code, out, err = run(capsys, "info", root, "run_b")
    assert code == 0 and err == ""
    fields = {
        ln.split(None, 1)[0]: ln.split(None, 1)[1]
        for ln in out.splitlines()[:13]
        if ln and not ln.startswith(" ")
    }
    assert fields["name"] == "run_b" and fields["status"] == "complete"
    assert fields["frames"] == "50" and fields["envs"] == "1"
    assert fields["bodies"] == "3" and fields["tags"] == "run, walk"
    assert fields["dt"].startswith("0.02 s") and fields["duration"] == "1.00 s"
    assert "on" in fields  # "on disk"
    stream_lines = out.split("\n\n")[1].splitlines()
    assert stream_lines[0].split() == [
        "STREAM",
        "KIND",
        "SHAPE",
        "FILE",
        "SIZE",
    ]
    by_name = {ln.split()[0]: ln.split() for ln in stream_lines[1:]}
    assert by_name["body_pose"][1:4] == ["pose", "3x7", "body_pose.blk"]
    assert by_name["reward"][1:4] == ["scalar", "scalar", "reward.blk"]
    size = (root / "runs" / "run_b" / "body_pose.blk").stat().st_size
    assert by_name["body_pose"][4:] == [cli._human(size)][0].split()


def test_info_on_a_recording_run_counts_written_frames(tmp_path, capsys):
    lib = library.Library(tmp_path / "lib")
    rec = lib.record("live", scene=make_scene(), dt=0.02, block_frames=10)
    rec.log_frames(make_poses(25))
    rec.flush()
    code, out, _ = run(capsys, "info", tmp_path / "lib", "live")
    assert code == 0
    assert "recording (20 frames written so far)" in out
    rec.close()
    lib.close()


def test_info_user_errors(root, capsys):
    code, _, err = run(capsys, "info", root, "ghost")
    assert code == 1 and "no run 'ghost'" in err
    code, _, err = run(capsys, "info", root / "nowhere", "walk_a")
    assert code == 1 and "no library folder" in err


def test_corrupt_manifest_is_a_one_line_error(root, capsys):
    (root / "runs" / "walk_a" / "rollout.json").write_text(
        "{not json", encoding="utf-8"
    )
    code, _, err = run(capsys, "info", root, "walk_a")
    assert code == 1 and err.count("\n") == 1 and "Traceback" not in err


# -- serve --


def test_serve_runs_the_web_server_by_default(root, monkeypatch, capsys):
    from simscope import server

    calls = []
    monkeypatch.setattr(
        server, "serve", lambda *a, **kw: calls.append((a, kw)) or None
    )
    code, out, _ = run(
        capsys, "serve", root, "--host", "0.0.0.0", "--port", "9001",
        "--author", "ada",
    )  # fmt: skip
    assert code == 0 and "http://0.0.0.0:9001" in out
    assert calls == [
        ((root,), {"host": "0.0.0.0", "port": 9001, "author": "ada"})
    ]
    calls.clear()
    assert run(capsys, "serve", root)[0] == 0
    assert calls == [
        ((root,), {"host": "127.0.0.1", "port": 8080, "author": None})
    ]


@pytest.mark.parametrize("missing", ["starlette", "uvicorn", "watchfiles"])
def test_serve_without_viewer_extra_prints_a_hint(
    root, monkeypatch, capsys, missing
):
    real = cli.importlib.import_module

    def fake(name, *args):
        if name == "simscope.server":
            raise ModuleNotFoundError(
                f"No module named {missing!r}", name=missing
            )
        return real(name, *args)

    monkeypatch.setattr(cli.importlib, "import_module", fake)
    code, out, err = run(capsys, "serve", root)
    assert code == 1 and out == ""
    assert err.count("\n") == 1 and "pip install 'simscope[viewer]'" in err


def test_serve_has_no_ui_switch(root, capsys):
    assert run(capsys, "serve", root, "--ui", "viser")[0] == 2


def test_serve_missing_folder(tmp_path, capsys):
    code, _, err = run(capsys, "serve", tmp_path / "nope")
    assert code == 1 and "no library folder" in err


# -- argument handling --


def test_usage_errors_return_2(root, capsys):
    assert cli.main([]) == 2
    assert cli.main(["ls"]) == 2
    assert cli.main(["ls", str(root), "--sort", "bogus"]) == 2
    assert cli.main(["serve", str(root), "--port", "99999"]) == 2
    assert cli.main(["export", str(root), "walk_a"]) == 2  # no -o
    assert cli.main(["ls", str(root), "--limit", "0"]) == 2
    capsys.readouterr()
    assert cli.main(["--help"]) == 0
    assert "serve" in capsys.readouterr().out


# -- import --


def write_brax_page(path, n_frames=4, n_links=2):
    import base64
    import zlib

    rng = np.random.default_rng(n_frames)
    quat = rng.normal(size=(n_frames, n_links, 4))
    quat /= np.linalg.norm(quat, axis=-1, keepdims=True)
    cube = {
        "vert": rng.normal(size=(8, 3)).round(3).tolist(),
        "face": [[0, 1, 2], [2, 3, 4], [4, 5, 6]],
    }
    system = {
        "opt": {"timestep": 0.02},
        "link_names": [f"l{i}" for i in range(n_links)],
        "name": "sys",
        "geoms": {
            "world": [
                {
                    "name": "Plane", "link_idx": -1, "pos": [0, 0, 0],
                    "rot": [1, 0, 0, 0], "rgba": [1, 1, 1, 1],
                    "size": [0, 0, 0.05],
                }
            ],
            "l0": [
                {
                    "name": "Mesh", "link_idx": 0, "pos": [0, 0, 0],
                    "rot": [1, 0, 0, 0], "rgba": [1, 0, 0, 1],
                    "size": [1, 1, 1], **cube,
                }
            ],
        },
        "states": {
            "x": [
                {
                    "pos": rng.normal(size=(n_links, 3)).tolist(),
                    "rot": quat[t].tolist(),
                }
                for t in range(n_frames)
            ]
        },
    }  # fmt: skip
    blob = base64.b64encode(zlib.compress(json.dumps(system).encode()))
    path.write_bytes(b'<title>t</title>var system = "' + blob + b'"')


def test_import_files_and_folders(tmp_path, capsys):
    src = tmp_path / "src"
    (src / "deep").mkdir(parents=True)
    write_brax_page(src / "a.html", 4)
    write_brax_page(src / "deep" / "b.html", 6)
    (src / "deep" / "junk.html").write_text("<p>nothing</p>", encoding="utf-8")
    lib_dir = tmp_path / "lib"
    code, out, err = run(
        capsys, "import", lib_dir, src, "--tag", "x", "--jobs", "2"
    )
    assert code == 0 and err == ""
    lines = out.splitlines()
    assert lines[0].startswith("a  4 frames") and "a.html" in lines[0]
    assert lines[1].startswith("b  6 frames")
    assert "imported 2 runs" in lines[-1] and "library grew by" in lines[-1]
    code, out, _ = run(capsys, "ls", lib_dir, "--sort", "name", "--json")
    rows = [json.loads(ln) for ln in out.splitlines()]
    assert [r["name"] for r in rows] == ["a", "b"]
    assert set(rows[0]["tags"]) == {"x", "source:brax"}
    code, out, _ = run(capsys, "import", lib_dir, src / "a.html")
    assert code == 0 and out.startswith("a-2  4 frames")
    code, out, _ = run(capsys, "import", lib_dir, src / "a.html", "--overwrite")
    assert code == 0 and out.startswith("a  4 frames")


def test_import_nothing_is_an_error(tmp_path, capsys):
    (tmp_path / "x.txt").write_text("hi", encoding="utf-8")
    code, out, err = run(capsys, "import", tmp_path / "lib", tmp_path)
    assert code == 1 and out == "" and "nothing to import" in err
    code, _, err = run(capsys, "import", tmp_path / "lib", tmp_path / "nope")
    assert code == 1 and "no such file" in err


def test_import_reports_bad_files_and_continues(tmp_path, capsys):
    good = tmp_path / "good.html"
    write_brax_page(good)
    bad = tmp_path / "bad.html"
    bad.write_bytes(b'var system = "!!!not-base64-zlib"')
    code, out, err = run(capsys, "import", tmp_path / "lib", good, bad)
    assert code == 0 and "good  4 frames" in out
    assert "skipped" in err and "bad.html" in err
    assert "skipped 1" in out.splitlines()[-1]
