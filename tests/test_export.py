"""Tests for simscope.export: single-file HTML and pack export."""

import base64
import gzip
import html.parser
import importlib.util
import json
import pathlib
import re
import shutil
import struct
import subprocess

import mujoco
import numpy as np
import pytest

from simscope import core, export, transforms
from simscope import library as library_mod
from simscope import mujoco as smj
from simscope.io import blockfile, cas, manifest, pack, scene

FIXTURES = pathlib.Path(__file__).parent / "fixtures"
MJCF = """
<mujoco>
  <option timestep="0.01"/>
  <worldbody>
    <geom type="plane" size="3 3 .1" rgba=".7 .7 .7 1"/>
    <body name="arm" pos="0 0 1">
      <joint type="hinge" axis="0 1 0"/>
      <geom type="capsule" size=".05 .3" pos="0 0 -.3"/>
      <body name="hand" pos="0 0 -.6">
        <joint type="hinge" axis="1 0 0"/>
        <geom type="box" size=".1 .1 .05"/>
      </body>
    </body>
    <body name="ball" pos="1 0 1">
      <freejoint/>
      <geom type="sphere" size=".1"/>
    </body>
  </worldbody>
</mujoco>
"""
EVENT = {
    "id": "01J9Z3EEEEEEEEEEEEEEEEEEEE",
    "type": "fall",
    "label": "the fall",
    "t0": 0.1,
    "t1": 0.2,
}


class _Page(html.parser.HTMLParser):
    """Collects tags, attributes, script bodies and comments of a page."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.tags: list[tuple[str, dict[str, str | None]]] = []
        self.scripts: dict[str, str] = {}
        self.comments: list[str] = []
        self.title = ""
        self._script: str | None = None
        self._in_title = False

    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))
        if tag == "script":
            self._script = dict(attrs).get("id") or f"#{len(self.scripts)}"
            self.scripts[self._script] = ""
        self._in_title = tag == "title"

    def handle_endtag(self, tag):
        if tag == "script":
            self._script = None
        self._in_title = False

    def handle_data(self, data):
        if self._script is not None:
            self.scripts[self._script] += data
        elif self._in_title:
            self.title += data

    def handle_comment(self, data):
        self.comments.append(data)

    def find(self, tag):
        return [attrs for name, attrs in self.tags if name == tag]


def _parse(path: pathlib.Path) -> _Page:
    page = _Page()
    page.feed(path.read_text(encoding="utf-8"))
    page.close()
    return page


def _parse_text(text: str) -> _Page:
    page = _Page()
    page.feed(text)
    page.close()
    return page


def _embedded(page: _Page, script_id: str) -> bytes:
    return base64.b64decode(page.scripts[script_id])


def _load_fixtures():
    spec = importlib.util.spec_from_file_location(
        "make_format_fixtures", FIXTURES / "make_format_fixtures.py"
    )
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope="module")
def library(tmp_path_factory):
    """A two-run library sharing one mesh (run_a: 2 envs, run_b: 1 env)."""
    root = tmp_path_factory.mktemp("export") / "lib"
    names = _load_fixtures().build_library(root)
    return root, list(names)


@pytest.fixture
def lib(library, tmp_path):
    """A private copy of the library that a test may modify."""
    root, names = library
    copy = tmp_path / "lib"
    shutil.copytree(root, copy)
    return copy, names


def _add_annotations(root: pathlib.Path, run: str) -> None:
    doc = {"format": "simscope-annotations/1", "events": [EVENT]}
    (root / "runs" / run / "annotations.json").write_text(json.dumps(doc))


# ---------------------------------------------------------------- structure


def test_html_parses_and_has_expected_structure(library, tmp_path):
    root, names = library
    out = export.export_html(root, names, tmp_path / "x.html")
    assert out == tmp_path / "x.html"
    page = _parse(out)
    assert page.title == "simscope export"
    tags = {name for name, _ in page.tags}
    assert "style" in tags
    assert not tags & {"main", "h1", "h2", "header", "nav", "span", "button"}
    players = page.find("simscope-player")
    assert [p["run"] for p in players] == names
    assert all(p["src"] == "#simscope-pack" for p in players)
    assert set(page.scripts) >= {"simscope-runtime", "simscope-pack"}
    types = {
        a.get("id"): a.get("type") for a in page.find("script") if a.get("id")
    }
    assert types["simscope-runtime"] == types["simscope-pack"] == "text/plain"
    text = out.read_text(encoding="utf-8")
    assert text.startswith("<!doctype html>")
    assert 'name="viewport"' in text
    assert "prefers-color-scheme:dark" in text
    assert "color-scheme:light dark" in text


def test_pack_roundtrips_from_page(library, tmp_path):
    root, names = library
    out = export.export_html(root, names, tmp_path / "x.html")
    data = _embedded(_parse(out), "simscope-pack")
    assert data == export.build_pack(root, names, with_highlights=False)
    with pack.PackReader(data) as reader:
        assert reader.runs() == sorted(names)
        for name in names:
            man = reader.manifest(name)
            with reader.stream(name, "body_pose") as stream:
                frames = stream.read(0, man.n_frames)
            assert frames.shape == (man.n_frames, man.n_envs, 3, 7)
            assert np.isfinite(frames).all()
            assert reader.scene(man.scene).bodies


def test_runtime_decodes_to_bundle_bytes(library, tmp_path):
    root, names = library
    out = export.export_html(root, names[:1], tmp_path / "x.html")
    runtime = gzip.decompress(_embedded(_parse(out), "simscope-runtime"))
    assert runtime == export.read_asset("simscope-player.js")
    assert b"var SimscopePlayer=" in runtime[:64]


def test_bootstrap_uses_documented_decode_path(library, tmp_path):
    root, names = library
    page = _parse(export.export_html(root, names, tmp_path / "x.html"))
    boot = next(
        body
        for key, body in page.scripts.items()
        if "DecompressionStream" in body
    )
    for needle in ("fromBase64", "atob", 'DecompressionStream("gzip")'):
        assert needle in boot
    assert "createObjectURL" in boot
    assert "fetch" not in boot


def test_license_comment_is_last_and_complete(library, tmp_path):
    root, names = library
    text = export.export_html(root, names, tmp_path / "x.html").read_text()
    licenses = export.read_asset("simscope-web.LICENSES.txt").decode()
    tail = text[text.rindex("<!--") :]
    assert tail.rstrip().endswith("-->")
    assert licenses.strip() in tail
    assert "The MIT License" in tail
    assert text.count("<!--") == 1


@pytest.mark.skipif(shutil.which("node") is None, reason="node not installed")
def test_inline_scripts_are_valid_javascript(library, tmp_path):
    root, names = library
    out = export.export_html(root, names, tmp_path / "x.html", layout="compare")
    page = _parse(out)
    n = 0
    for key, body in page.scripts.items():
        if key.startswith("simscope-"):
            continue
        js = tmp_path / f"s{n}.js"
        js.write_text(body)
        n += 1
        done = subprocess.run(
            ["node", "--check", str(js)], capture_output=True, text=True
        )
        assert done.returncode == 0, done.stderr
    assert n == 2


# ------------------------------------------------------------------ options


def test_annotations_included_by_default_and_excludable(lib, tmp_path):
    root, names = lib
    _add_annotations(root, names[0])
    on = export.export_html(root, names, tmp_path / "on.html")
    off = export.export_html(
        root, names, tmp_path / "off.html", annotations=False
    )
    path = f"runs/{names[0]}/annotations.json"
    with pack.PackReader(_embedded(_parse(on), "simscope-pack")) as reader:
        assert json.loads(bytes(reader.read(path)))["events"] == [EVENT]
        assert f"runs/{names[1]}/annotations.json" not in reader
    with pack.PackReader(_embedded(_parse(off), "simscope-pack")) as reader:
        assert not [p for p in reader.paths() if p.endswith("annotations.json")]
        assert reader.runs() == sorted(names)
    assert off.stat().st_size < on.stat().st_size


def test_export_pack_matches_embedded_pack(lib, tmp_path):
    root, names = lib
    _add_annotations(root, names[0])
    for annotations in (True, False):
        p = export.export_pack(
            root,
            names,
            tmp_path / f"a{annotations}.simscope",
            annotations=annotations,
        )
        page = _parse(
            export.export_html(
                root,
                names,
                tmp_path / "x.html",
                annotations=annotations,
                ui="full",
            )
        )
        assert p.read_bytes() == _embedded(page, "simscope-pack")


def test_poster_is_added_to_the_pack(lib, tmp_path):
    root, names = lib
    png = b"\x89PNG\r\n\x1a\nnot-really-a-png"
    (root / "runs" / names[1] / "poster.png").write_bytes(png)
    data = export.build_pack(root, names)
    with pack.PackReader(data) as reader:
        assert bytes(reader.read(f"runs/{names[1]}/poster.png")) == png
        assert f"runs/{names[0]}/poster.png" not in reader
    assert data == export.build_pack(root, names)


def test_transcode_shrinks_and_uses_q16d(library, tmp_path):
    root, names = library
    small = export.export_pack(root, names, tmp_path / "s.simscope")
    big = export.export_pack(
        root, names, tmp_path / "b.simscope", transcode=False
    )
    assert small.stat().st_size < big.stat().st_size
    for path, codec in ((small, 2), (big, 1)):
        with (
            pack.PackReader(path) as reader,
            reader.stream(names[0], "body_pose") as s,
        ):
            assert set(s.directory["codec"]) == {codec}


def test_shared_mesh_is_stored_once(library, tmp_path):
    root, names = library
    with pack.PackReader(export.build_pack(root, names)) as reader:
        assets = [p for p in reader.paths() if p.startswith("assets/")]
        scenes = [p for p in reader.paths() if p.startswith("scenes/")]
    assert len(assets) == 1
    assert len(scenes) == 2


def test_title_and_escaping(library, tmp_path):
    root, names = library
    out = export.export_html(
        root, names, tmp_path / "x.html", title='Walk <b> & "run"'
    )
    page = _parse(out)
    assert page.title == 'Walk <b> & "run"'
    assert "<title>Walk &lt;b&gt; &amp; &quot;run&quot;</title>" in (
        out.read_text()
    )
    assert "<h1" not in out.read_text()  # the page has no heading of its own


# ------------------------------------------------------------------ layouts


def test_single_layout(library, tmp_path):
    root, names = library
    out = export.export_html(
        root, names[:1], tmp_path / "x.html", layout="single"
    )
    page = _parse(out)
    assert page.title == names[0]
    (player,) = page.find("simscope-player")
    assert {"autoplay", "loop"} <= set(player)
    assert "nocontrols" not in player and "sync" not in player
    # One bare player: no heading, caption, figure or wrapper around it.
    assert not {"figure", "figcaption", "h1", "main", "div"} & {
        t for t, _ in page.tags
    }
    assert "ss-master" not in out.read_text()


def test_single_rejects_several_runs(library, tmp_path):
    root, names = library
    with pytest.raises(ValueError, match="exactly one run"):
        export.export_html(root, names, tmp_path / "x.html", layout="single")
    assert not (tmp_path / "x.html").exists()


def test_grid_layout_flags(library, tmp_path):
    root, names = library
    page = _parse(
        export.export_html(
            root, names, tmp_path / "x.html", autoplay=False, loop=False
        )
    )
    for player in page.find("simscope-player"):
        assert "autoplay" not in player and "loop" not in player
    assert "ss-master" not in (tmp_path / "x.html").read_text()


def _compare_html(names, **kwargs):
    return export.build_html(b"pack", names, layout="compare", **kwargs).decode(
        "utf-8"
    )


def _compare_box(text):
    """The markup of the ``ss-master`` div, between its tags."""
    return text[text.index('<div id="ss-master"') : text.index("</div>") + 6]


def test_compare_markup_is_the_contract(library, tmp_path):
    root, names = library
    out = export.export_html(root, names, tmp_path / "x.html", layout="compare")
    text = out.read_text()
    assert _compare_box(text) == (
        '<div id="ss-master" data-arrange="side" data-autoplay="1" '
        'data-loop="1">\n'
        f"<figure><figcaption>{names[0]}</figcaption><simscope-player "
        f'src="#simscope-pack" run="{names[0]}" sync="compare">'
        "</simscope-player></figure>\n"
        f"<figure><figcaption>{names[1]}</figcaption><simscope-player "
        f'src="#simscope-pack" run="{names[1]}" sync="compare">'
        "</simscope-player></figure>\n</div>"
    )
    page = _parse(out)
    players = page.find("simscope-player")
    assert [p["run"] for p in players] == names
    assert {p["sync"] for p in players} == {"compare"}
    for player in players:
        assert not {"color", "nocontrols", "autoplay", "loop"} & set(player)


def test_compare_page_has_no_chrome_of_its_own(library, tmp_path):
    root, names = library
    out = export.export_html(root, names, tmp_path / "x.html", layout="compare")
    text = out.read_text()
    page = _parse(out)
    tags = {t for t, _ in page.tags}
    # The runtime builds the bar, the titles' look and the arrangement.
    assert not tags & {"button", "input", "select", "span", "main", "h1"}
    ids = {a.get("id") for _, a in page.tags if a.get("id")}
    assert ids == {
        "simscope-error",
        "ss-master",
        "simscope-runtime",
        "simscope-pack",
    }
    for old in ("slot", "#2282fb", "ss-play", "ss-scrub", "ss-marks", "color="):
        assert old not in _visible_text(text), old
    # The only page CSS: margins, height, a neutral background, colour scheme.
    (style,) = re.findall(r"<style>(.*?)</style>", text, flags=re.S)
    assert "html,body{margin:0;height:100%;background:#f5f5f5}" in style
    assert (
        "@media (prefers-color-scheme:dark){html,body{background:#121212}}"
        in style
    )
    assert "color-scheme:light dark" in style
    assert "figure" not in style and "simscope-player" not in style
    # The page script only starts the control that the runtime brings.
    inline = [b for k, b in page.scripts.items() if "whenDefined" in b]
    assert len(inline) == 1
    assert "SimscopePlayer.attachMaster(" in inline[0]
    assert '"ss-master"' in inline[0] and '"compare"' in inline[0]
    for old in ("timeupdate", "seek(", "setSpeed(", "ss-scrub", "DRIFT"):
        assert old not in inline[0], old
    assert len(inline[0]) < 300


@pytest.mark.parametrize(
    ("count", "default"), [(1, "side"), (2, "side"), (3, "grid"), (4, "grid")]
)
@pytest.mark.parametrize("arrange", [None, "side", "stack", "grid"])
def test_compare_arrangements(count, default, arrange):
    names = ["a", "b", "c", "d"][:count]
    text = _compare_html(names, arrange=arrange)
    want = arrange or default
    assert f'<div id="ss-master" data-arrange="{want}"' in text
    page = _Page()
    page.feed(text)
    assert [p["run"] for p in page.find("simscope-player")] == names
    assert text.count("<figure>") == count
    assert text.count("<figcaption>") == count
    for name in names:  # one title per pane: the full run name
        assert f"<figcaption>{name}</figcaption>" in text


def test_compare_title_is_the_whole_run_name():
    name = "a_long_run_name-" + "x" * 100
    text = _compare_html([name])
    assert f"<figcaption>{name}</figcaption>" in text
    assert f'run="{name}"' in text


def test_compare_takes_four_runs_and_no_more(library, tmp_path):
    names = ["a", "b", "c", "d"]
    page = _Page()
    page.feed(_compare_html(names))
    assert [p["run"] for p in page.find("simscope-player")] == names
    root, _ = library
    with pytest.raises(ValueError, match="up to 4 runs"):
        export.build_html(b"pack", [*names, "e"], layout="compare")
    out = tmp_path / "x.html"
    with pytest.raises(ValueError, match="up to 4 runs"):
        export.export_html(root, [*names, "e"], out, layout="compare")
    assert not out.exists()  # refused before anything was packed


def test_compare_autoplay_and_loop_are_flags_of_the_box():
    text = _compare_html(["a", "b"], autoplay=False, loop=False)
    assert 'data-autoplay="0" data-loop="0"' in text


def test_arrange_is_validated(library, tmp_path):
    root, names = library
    out = tmp_path / "x.html"
    with pytest.raises(ValueError, match="arrange must be one of"):
        export.export_html(
            root,
            names,
            out,
            layout="compare",
            arrange="wall",  # ty: ignore[invalid-argument-type]
        )
    with pytest.raises(ValueError, match="arrange"):
        export.build_html(b"pack", ["a"], layout="compare", arrange="")  # ty: ignore[invalid-argument-type]
    for layout in ("grid", "single"):
        use = names[:1] if layout == "single" else names
        with pytest.raises(ValueError, match='needs layout="compare"'):
            export.export_html(root, use, out, layout=layout, arrange="side")
    assert not out.exists()  # refused before anything was packed


def test_other_layouts_have_no_clock_colours_or_letters(library, tmp_path):
    root, names = library
    for layout in ("grid", "single"):
        use = names[:1] if layout == "single" else names
        out = export.export_html(root, use, tmp_path / "x.html", layout=layout)
        text = out.read_text()
        for player in _parse(out).find("simscope-player"):
            assert not {"sync", "color", "nocontrols"} & set(player)
        assert 'class="slot"' not in text and "data-arrange" not in text
        assert "<style>" in text and "figure{" not in text
    grid = _parse(
        export.export_html(root, names, tmp_path / "g.html", layout="grid")
    )
    assert len(grid.find("figure")) == len(grid.find("figcaption")) == 2


def test_bad_arguments(library, tmp_path):
    root, names = library
    out = tmp_path / "x.html"
    with pytest.raises(ValueError, match="layout"):
        export.export_html(root, names, out, layout="wall")  # ty: ignore[invalid-argument-type]
    with pytest.raises(ValueError, match="at least one"):
        export.export_html(root, [], out)
    with pytest.raises(ValueError, match="duplicate"):
        export.export_html(root, [names[0], names[0]], out)
    with pytest.raises(TypeError):
        export.export_html(root, names[0], out)
    with pytest.raises(ValueError):
        export.export_html(root, ["../evil"], out)
    with pytest.raises(FileNotFoundError):
        export.export_html(root, ["missing"], out)
    assert not out.exists()


def test_recording_run_is_rejected(lib, tmp_path):
    root, names = lib
    run = root / "runs" / names[0]
    (run / "rollout.json").rename(run / "rollout.json.partial")
    with pytest.raises(ValueError, match="still recording"):
        export.export_html(root, names, tmp_path / "x.html")


# ------------------------------------------------------ determinism, offline


def test_export_is_deterministic(library, tmp_path):
    root, names = library
    for layout in ("grid", "compare"):
        a = export.export_html(root, names, tmp_path / "a.html", layout=layout)
        b = export.export_html(
            root, names, tmp_path / "sub" / "b.html", layout=layout
        )
        assert a.read_bytes() == b.read_bytes()
    p1 = export.export_pack(root, names, tmp_path / "1.simscope")
    p2 = export.export_pack(root, names, tmp_path / "2.simscope")
    assert p1.read_bytes() == p2.read_bytes()
    text = a.read_text()
    assert not re.search(r"20\d\d-\d\d-\d\dT", text.split("<!--")[0])
    head = gzip.compress(b"x", compresslevel=export.GZIP_LEVEL, mtime=0)[:10]
    assert head[4:8] == bytes(4)  # gzip mtime field is zero


def _visible_text(text: str) -> str:
    """The page without the base64 blobs and the trailing license comment."""
    text = re.sub(
        r'(<script type="text/plain" id="[^"]+">)[^<]*(</script>)',
        r"\1\2",
        text,
    )
    return text.split("<!--")[0]


def test_no_network_references(library, tmp_path):
    root, names = library
    for layout, arrange in (
        ("grid", None),
        ("compare", None),
        ("compare", "stack"),
        ("single", None),
    ):
        use = names[:1] if layout == "single" else names
        out = export.export_html(
            root, use, tmp_path / "x.html", layout=layout, arrange=arrange
        )
        page = _parse(out)
        text = _visible_text(out.read_text())
        assert not re.search(r"https?://|//[a-z0-9.-]+\.[a-z]{2,}/", text)
        assert all(a["href"] == "data:," for a in page.find("link"))
        assert not page.find("img") and not page.find("iframe")
        assert not any("href" in a for n, a in page.tags if n != "link")
        srcs = {a["src"] for a in page.find("simscope-player")}
        assert srcs == {"#simscope-pack"}
        assert not any("src" in a for a in page.find("script"))
        assert "@import" not in text and "url(" not in text
        for body in (b for k, b in page.scripts.items() if k.startswith("#")):
            assert "fetch(" not in body and "import" not in body
            assert "XMLHttpRequest" not in body and "WebSocket" not in body
        # The runtime: only XML namespace strings, no dynamic import().
        runtime = gzip.decompress(_embedded(page, "simscope-runtime")).decode()
        urls = set(re.findall(r"https?://[^\s\"'`)<>]+", runtime))
        # A citation inside one of three.js's shader comments is text, not a
        # request; everything else must be an XML namespace.
        allowed = {
            "http://www.w3.org/1999/xhtml",
            "https://jcgt.org/published/0007/04/01/",
        }
        assert urls <= allowed
        assert "import(" not in runtime and "importScripts" not in runtime


# ---------------------------------------------------------------- real MuJoCo


def _record_mujoco(root: pathlib.Path, name: str, n: int = 120) -> None:
    model = mujoco.MjModel.from_xml_string(  # ty: ignore[unresolved-attribute]
        MJCF
    )
    data = mujoco.MjData(model)  # ty: ignore[unresolved-attribute]
    store = cas.ContentStore(root)
    ref = scene.put_scene(store, smj.scene_from_model(model))
    frames = np.empty((n, 1, model.nbody, 7), np.float32)
    for i in range(n):
        mujoco.mj_step(model, data)  # ty: ignore[unresolved-attribute]
        frames[i] = smj.poses(data)
    frames = transforms.enforce_sign_continuity(frames)
    run_dir = root / "runs" / name
    run_dir.mkdir(parents=True)
    with blockfile.BlockWriter(
        run_dir / "body_pose.blk",
        item_shape=(model.nbody, 7),
        n_envs=1,
        kind="pose",
        block_frames=50,
    ) as writer:
        writer.append(frames)
    manifest.write_manifest(
        run_dir,
        manifest.RolloutManifest(
            id="01J9Z3MMMMMMMMMMMMMMMMMMMM",
            name=name,
            created="2026-09-30T12:00:00Z",
            dt=float(model.opt.timestep),
            n_frames=n,
            n_envs=1,
            n_bodies=model.nbody,
            scene=ref,
            streams={
                "body_pose": manifest.StreamInfo(
                    "body_pose.blk", "pose", (model.nbody, 7)
                )
            },
            env_origins=((0.0, 0.0, 0.0),),
            source=smj.source_info(),
        ),
        partial=False,
    )
    np.save(root / f"{name}-frames.npy", frames)


def test_real_mujoco_run_exports_and_decodes(tmp_path):
    root = tmp_path / "lib"
    _record_mujoco(root, "pendulum")
    out = export.export_html(root, ["pendulum"], tmp_path / "m.html")
    assert out.stat().st_size < 400_000
    with pack.PackReader(_embedded(_parse(out), "simscope-pack")) as reader:
        man = reader.manifest("pendulum")
        with reader.stream("pendulum", "body_pose") as stream:
            got = stream.read(0, man.n_frames)
        sc = reader.scene(man.scene)
    want = np.load(root / "pendulum-frames.npy")
    assert got.shape == want.shape
    assert np.abs(got[..., :3] - want[..., :3]).max() < 1e-3
    assert np.abs(got[..., 3:] - want[..., 3:]).max() < 1e-3
    assert [b.name for b in sc.bodies][:3] == ["world", "arm", "hand"]


# ------------------------------------------------ derived data, envs, full UI


def _record_spiky(
    root: pathlib.Path, name: str, *, envs: int = 4, frames: int = 120
) -> None:
    """Records a run whose env ``e`` has a contact spike at frame 20 + 10 e."""
    lib = library_mod.Library(root)
    poses = np.zeros((frames, envs, 3, 7), np.float32)
    poses[..., 6] = 1.0
    poses[:, :, 1, 2] = 1.0
    contacts = np.zeros((frames, envs, 2, 6), np.float32)
    for e in range(envs):
        contacts[(20 + 10 * e) % frames, e, 0, 5] = 500.0 + e
    scene_ = core.Scene(
        bodies=tuple(
            core.Body(n, -1 if i == 0 else 0)
            for i, n in enumerate(("world", "torso", "foot"))
        )
    )
    with lib.record(name, scene=scene_, dt=0.02, n_envs=envs) as rec:
        rec.add_stream("contacts", "arrows", (2, 6), units="N")
        rec.log_frames(poses, contacts=contacts)
    lib.close()


def _pack_minor(data: bytes) -> int:
    return struct.unpack_from("<4sHH", data)[2]


def test_pack_carries_highlights(tmp_path):
    root = tmp_path / "lib"
    _record_spiky(root, "spiky")
    data = export.build_pack(root, ["spiky"])
    assert _pack_minor(data) == 1
    with pack.PackReader(data) as reader:
        doc = json.loads(bytes(reader.read("derived/spiky/highlights.json")))
        assert reader.runs() == ["spiky"]
    assert doc["format"] == "simscope-highlights/2"
    assert [(h["env"], h["frame"], h["kind"]) for h in doc["highlights"]] == [
        (e, 20 + 10 * e, "contact") for e in range(4)
    ]
    assert doc["kinds"] == [{"key": "contact", "label": "Contact force"}]
    assert doc["run_id"] == manifest.read_manifest(root / "runs" / "spiky").id
    off = export.build_pack(root, ["spiky"], derived=False)
    assert _pack_minor(off) == 0
    with pack.PackReader(off) as reader:
        assert not [p for p in reader.paths() if p.startswith("derived/")]
    assert export.build_pack(root, ["spiky"]) == data  # deterministic


def test_highlights_follow_the_env_subset(tmp_path):
    root = tmp_path / "lib"
    _record_spiky(root, "spiky")
    data = export.build_pack(root, ["spiky"], envs=[3, 1])
    with pack.PackReader(data) as reader:
        doc = json.loads(bytes(reader.read("derived/spiky/highlights.json")))
        man = reader.manifest("spiky")
        with reader.stream("spiky", "contacts") as stream:
            assert stream.n_envs == 2
            frames = stream.read(0, 120)
    assert man.n_envs == 2
    # Env 3 became env 0 and env 1 became env 1; envs 0 and 2 are gone.
    assert [(h["env"], h["frame"]) for h in doc["highlights"]] == [
        (1, 30),
        (0, 50),
    ]
    assert [k["key"] for k in doc["kinds"]] == ["contact"]
    assert frames[50, 0, 0, 5] == 503.0 and frames[30, 1, 0, 5] == 501.0


def test_uncomputable_highlights_are_left_out(tmp_path, monkeypatch, caplog):
    root = tmp_path / "lib"
    _record_spiky(root, "spiky")

    def boom(*args, **kwargs):
        raise RuntimeError("no detector today")

    monkeypatch.setattr(export.highlights, "load_or_compute", boom)
    monkeypatch.setattr(export, "_derived_module", lambda: None)
    with caplog.at_level("WARNING", logger="simscope.export"):
        data = export.build_pack(root, ["spiky"])
    assert "no highlights for spiky" in caplog.text
    with pack.PackReader(data) as reader:
        assert not [p for p in reader.paths() if p.startswith("derived/")]
    assert _pack_minor(data) == 0


def test_crowd_runs_carry_root_pose_and_summaries(tmp_path):
    root = tmp_path / "lib"
    _record_spiky(root, "crowd", envs=70, frames=30)
    data = export.build_pack(root, ["crowd"])
    with pack.PackReader(data) as reader:
        paths = set(reader.paths())
        assert {
            "derived/crowd/highlights.json",
            "derived/crowd/root_pose.blk",
            "derived/crowd/summaries.json",
        } <= paths
        summaries = json.loads(
            bytes(reader.read("derived/crowd/summaries.json"))
        )
        with blockfile.BlockReader(
            bytes(reader.read("derived/crowd/root_pose.blk")), kind="pose"
        ) as rp:
            assert (rp.n_envs, rp.n_frames, rp.item_shape) == (70, 30, (1, 7))
    assert len(summaries["values"]["min_height"]) == 70

    few = export.build_pack(root, ["crowd"], envs=list(range(8)))
    with pack.PackReader(few) as reader:
        assert "derived/crowd/root_pose.blk" not in reader  # 8 envs: no crowd
        assert "derived/crowd/highlights.json" in reader

    many = export.build_pack(root, ["crowd"], envs=list(range(69, 4, -1)))
    with pack.PackReader(many) as reader:
        summaries = json.loads(
            bytes(reader.read("derived/crowd/summaries.json"))
        )
        with blockfile.BlockReader(
            bytes(reader.read("derived/crowd/root_pose.blk")), kind="pose"
        ) as rp:
            assert rp.n_envs == 65
    assert len(summaries["values"]["min_height"]) == 65
    assert all(len(v) == 65 for v in summaries["values"].values())


def test_envs_subset_in_html_export(tmp_path):
    root = tmp_path / "lib"
    _record_spiky(root, "spiky")
    out = export.export_html(root, ["spiky"], tmp_path / "x.html", envs=[2])
    data = _embedded(_parse(out), "simscope-pack")
    with pack.PackReader(data) as reader:
        assert reader.manifest("spiky").n_envs == 1
    with pytest.raises(ValueError, match="4 envs"):
        export.export_html(root, ["spiky"], tmp_path / "y.html", envs=[9])
    assert not (tmp_path / "y.html").exists()


def _full(library, tmp_path, **kwargs):
    root, names = library
    out = export.export_html(
        root, names[:1], tmp_path / "f.html", ui="full", **kwargs
    )
    return out, _parse(out), names[:1]


def test_full_export_structure(library, tmp_path):
    out, page, names = _full(library, tmp_path, layout="single")
    assert not page.find("simscope-player")
    assert [a.get("id") for a in page.find("div")] == ["app"]
    boot = json.loads(page.scripts["simscope-boot"])
    assert boot == {
        "mode": "pack",
        "pack": "#simscope-pack",
        "runs": names,
        "layout": "single",
        "writable": False,
    }
    types = {
        a.get("id"): a.get("type") for a in page.find("script") if a.get("id")
    }
    assert types["simscope-boot"] == "application/json"
    assert types["simscope-runtime"] == types["simscope-pack"] == "text/plain"
    # The runtime is the app bundle, the style is the app stylesheet.
    runtime = gzip.decompress(_embedded(page, "simscope-runtime"))
    assert runtime == export.read_asset("simscope-app.js")
    css = export.read_asset("simscope-app.css").decode().strip()
    assert css in out.read_text(encoding="utf-8")
    assert _embedded(page, "simscope-pack") == export.build_pack(
        library[0], names
    )
    assert page.title == names[0]


def test_full_export_licence_and_offline(library, tmp_path):
    out, page, _ = _full(library, tmp_path)
    text = out.read_text(encoding="utf-8")
    assert text.count("<!--") == 1
    licenses = export.read_asset("simscope-web.LICENSES.txt").decode()
    assert licenses.strip() in text[text.rindex("<!--") :]
    # Comments name their project's home page; they are text, not requests.
    visible = re.sub(r"/\*.*?\*/", "", _visible_text(text), flags=re.S)
    assert not re.search(r"https?://|//[a-z0-9.-]+\.[a-z]{2,}/", visible)
    assert "@import" not in visible and "url(http" not in visible
    assert not page.find("img") and not page.find("iframe")
    assert not any("src" in a for a in page.find("script"))
    assert all(a["href"] == "data:," for a in page.find("link"))
    body = next(
        b for k, b in page.scripts.items() if "DecompressionStream" in b
    )
    assert "fetch" not in body


def test_full_export_is_deterministic_and_validates(library, tmp_path):
    root, names = library
    a = export.export_html(root, names, tmp_path / "a.html", ui="full")
    b = export.export_html(root, names, tmp_path / "sub" / "b.html", ui="full")
    assert a.read_bytes() == b.read_bytes()
    boot = json.loads(_parse(a).scripts["simscope-boot"])
    assert boot["runs"] == names and boot["layout"] == "grid"
    with pytest.raises(ValueError, match="ui"):
        export.export_html(
            root,
            names,
            tmp_path / "x.html",
            ui="wide",  # ty: ignore[invalid-argument-type]
        )
    with pytest.raises(ValueError, match="exactly one run"):
        export.export_html(
            root, names, tmp_path / "x.html", ui="full", layout="single"
        )


def test_boot_block_cannot_break_out_of_its_script():
    page = export._boot_block(['a"</script><!--'], "grid")
    assert "</script><!--" not in page[len("<script") :].replace(
        "</script>", "", 1
    )
    assert json.loads(page.split(">", 1)[1].rsplit("</script>", 1)[0])[
        "runs"
    ] == ['a"</script><!--']


def _pack_paths(out):
    with pack.PackReader(_embedded(_parse(out), "simscope-pack")) as reader:
        return set(reader.paths())


def test_lean_packs_leave_highlights_out_and_full_packs_keep_them(tmp_path):
    root = tmp_path / "lib"
    _record_spiky(root, "spiky")
    _record_spiky(root, "crowd", envs=70, frames=30)
    lean = export.export_html(root, ["spiky"], tmp_path / "lean.html")
    full = export.export_html(
        root, ["spiky"], tmp_path / "full.html", ui="full"
    )
    key = "derived/spiky/highlights.json"
    assert key not in _pack_paths(lean)
    assert not [p for p in _pack_paths(lean) if p.startswith("derived/")]
    assert key in _pack_paths(full)
    assert len(_embedded(_parse(lean), "simscope-pack")) < len(
        _embedded(_parse(full), "simscope-pack")
    )
    # Crowd data is not about highlights: a lean export still carries it.
    crowd = export.export_html(root, ["crowd"], tmp_path / "c.html")
    paths = _pack_paths(crowd)
    assert "derived/crowd/root_pose.blk" in paths
    assert "derived/crowd/summaries.json" in paths
    assert "derived/crowd/highlights.json" not in paths
    # The same holds for a subset and for compare layouts.
    sub = export.export_html(
        root, ["spiky"], tmp_path / "s.html", envs=[3, 1], layout="single"
    )
    assert not [p for p in _pack_paths(sub) if p.startswith("derived/")]
    fsub = export.export_html(
        root, ["spiky"], tmp_path / "fs.html", envs=[3, 1], ui="full"
    )
    assert key in _pack_paths(fsub)
    with pack.PackReader(_embedded(_parse(fsub), "simscope-pack")) as reader:
        doc = json.loads(bytes(reader.read(key)))
    assert [(h["env"], h["frame"]) for h in doc["highlights"]] == [
        (1, 30),
        (0, 50),
    ]


def test_build_pack_can_skip_highlights(tmp_path):
    root = tmp_path / "lib"
    _record_spiky(root, "spiky")
    data = export.build_pack(root, ["spiky"], with_highlights=False)
    assert _pack_minor(data) == 0
    assert export.build_pack(root, ["spiky"]) != data


def test_full_export_boot_block_carries_the_arrangement(library, tmp_path):
    root, names = library
    for arrange, want in (
        (None, "side"),
        ("stack", "stack"),
        ("grid", "grid"),
    ):
        out = export.export_html(
            root,
            names,
            tmp_path / "x.html",
            ui="full",
            layout="compare",
            arrange=arrange,
        )
        boot = json.loads(_parse(out).scripts["simscope-boot"])
        assert boot["layout"] == "compare" and boot["arrange"] == want
    four = export.build_html(
        b"pack", ["a", "b", "c", "d"], layout="compare", ui="full"
    )
    boot = json.loads(_parse_text(four.decode()).scripts["simscope-boot"])
    assert boot["arrange"] == "grid"
    grid = export.export_html(
        root, names, tmp_path / "g.html", ui="full", layout="grid"
    )
    assert "arrange" not in json.loads(_parse(grid).scripts["simscope-boot"])
    with pytest.raises(ValueError, match="arrange"):
        export.export_html(
            root, names, tmp_path / "y.html", ui="full", arrange="stack"
        )


def test_runtime_size_budgets():
    def gz(name):
        return len(export.gzip_runtime(export.read_asset(name)))

    assert gz("simscope-player.js") <= 250 * 1024
    assert gz("simscope-app.js") + gz("simscope-app.css") <= 450 * 1024


# ---------------------------------------------------------------------- CLI


def test_cli_export_ui_and_envs(tmp_path, capsys):
    from simscope import cli

    root = tmp_path / "lib"
    _record_spiky(root, "spiky")
    lean, full = tmp_path / "lean.html", tmp_path / "full.html"
    argv = ["export", str(root), "spiky", "--envs", "0,2", "-o"]
    assert cli.main([*argv, str(lean)]) == 0
    assert cli.main([*argv, str(full), "--ui", "full"]) == 0
    capsys.readouterr()
    assert "<simscope-player" in lean.read_text()
    assert 'id="simscope-boot"' in full.read_text()
    for out in (lean, full):
        with pack.PackReader(_embedded(_parse(out), "simscope-pack")) as r:
            assert r.manifest("spiky").n_envs == 2


def test_cli_export_rejects_bad_envs(tmp_path, capsys):
    from simscope import cli

    root = tmp_path / "lib"
    _record_spiky(root, "spiky")
    out = tmp_path / "x.html"
    assert (
        cli.main(["export", str(root), "spiky", "--envs", "9", "-o", str(out)])
        == 1
    )
    assert "4 envs" in capsys.readouterr().err
    assert not out.exists()
    bad = ["export", str(root), "spiky", "--envs", "a,b", "-o", str(out)]
    assert cli.main(bad) == 2  # argparse usage error
    assert "comma-separated" in capsys.readouterr().err


def test_cli_export_arrange(tmp_path, capsys):
    from simscope import cli

    root = tmp_path / "lib"
    _record_spiky(root, "a")
    _record_spiky(root, "b")
    out = tmp_path / "x.html"
    argv = [
        "export",
        str(root),
        "a",
        "b",
        "--layout",
        "compare",
        "-o",
        str(out),
    ]
    assert cli.main(argv) == 0
    assert 'data-arrange="side"' in out.read_text()
    assert cli.main([*argv, "--arrange", "stack"]) == 0
    assert 'data-arrange="stack"' in out.read_text()
    capsys.readouterr()
    other = tmp_path / "y.html"
    code = cli.main(
        ["export", str(root), "a", "b", "--arrange", "grid", "-o", str(other)]
    )
    assert code == 1
    assert "--layout compare" in capsys.readouterr().err
    assert not other.exists()
    bad = [*argv, "--arrange", "wall"]
    assert cli.main(bad) == 2  # argparse usage error
    assert "invalid choice" in capsys.readouterr().err
