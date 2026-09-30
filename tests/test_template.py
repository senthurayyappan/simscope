"""Check each project type and protect existing files during setup."""

import argparse
import hashlib
import importlib.util
import json
import re
import runpy
import subprocess
import sys
import tomllib
from pathlib import Path
from unittest.mock import patch

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import configure  # noqa: E402


def load_script(relative):
    path = ROOT / relative
    spec = importlib.util.spec_from_file_location(path.stem, path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


smoke = load_script(".template/smoke.py")
update_manifest = load_script(".template/update_manifest.py")


def options(kind="library", **overrides):
    values = {
        "kind": kind,
        "name": "sample-project",
        "owner": "someone",
        "repo": None,
        "description": 'A "quoted" description: with YAML punctuation.',
        "author": 'A "Quoted" Author',
        "python": "3.12",
        "license": "none",
        "output": None,
        "no_ci": False,
    }
    return argparse.Namespace(**(values | overrides))


@pytest.mark.parametrize("kind", ["library", "app", "bare"])
@pytest.mark.parametrize("python", configure.PYTHONS)
def test_rendered_configuration(tmp_path, kind, python):
    args = options(kind, python=python)
    with patch.object(configure, "lock_project"):
        configure.generate(tmp_path, args)
    project = tomllib.loads((tmp_path / "pyproject.toml").read_text())
    assert project["project"]["name"] == "sample-project"
    assert project["project"]["description"] == args.description
    assert project["project"]["requires-python"] == f">={python}"
    assert project["project"]["authors"][0]["name"] == args.author
    assert ("build-system" in project) == (kind != "bare")
    assert project["project"]["dependencies"] == []
    assert ("scripts" in project["project"]) == (kind == "app")
    if kind == "app":
        script = project["project"]["scripts"]["sample-project"]
        assert script == "sample_project.cli:main"
        cli = (tmp_path / "src/sample_project/cli.py").read_text()
        assert "import argparse" in cli
        assert "typer" not in cli
    assert (tmp_path / "src").exists() == (kind != "bare")
    assert not (tmp_path / "LICENSE").exists()
    assert "license" not in project["project"]
    assert not (tmp_path / ".template-project.json").exists()
    assert (tmp_path / ".python-version").read_text() == f"{python}\n"
    ruff = project["tool"]["ruff"]
    assert ruff["target-version"] == "py" + python.replace(".", "")
    ci = yaml.safe_load((tmp_path / ".github/workflows/ci.yml").read_text())
    matrix = ci["jobs"]["tests"]["strategy"]["matrix"]["python"]
    assert matrix == list(configure.PYTHONS[configure.PYTHONS.index(python) :])
    readme = (tmp_path / "README.md").read_text()
    assert "This project has no license yet." in readme
    for path in tmp_path.rglob("*.py"):
        compile(path.read_text(), str(path), "exec")
    for path in tmp_path.rglob("*.yml"):
        yaml.safe_load(path.read_text())
    packaged_files = [
        "mkdocs.yml",
        "docs",
        ".release-please-config.json",
        ".github/scripts/check_commit_message.py",
        ".github/workflows/docs.yml",
        ".github/workflows/release-please.yml",
    ]
    for relative in packaged_files:
        assert (tmp_path / relative).exists() == (kind != "bare")
    if kind != "bare":
        docs = yaml.safe_load((tmp_path / "mkdocs.yml").read_text())
        assert docs["theme"]["name"] == "shadcn"
        assert docs["site_description"] == args.description
        api = "cli" if kind == "app" else "core"
        assert (
            (tmp_path / "docs/api.md")
            .read_text()
            .endswith(f"::: sample_project.{api}\n")
        )
        release_workflow = tmp_path / ".github/workflows/release-please.yml"
        workflow = yaml.safe_load(release_workflow.read_text())
        release_config = tmp_path / ".release-please-config.json"
        release = json.loads(release_config.read_text())
        assert release["packages"]["."]["include-v-in-tag"] is True
        assert release["bump-minor-pre-major"] is True
        commands = [
            step["run"]
            for step in workflow["jobs"]["publish"]["steps"]
            if "run" in step
        ]
        assert "uv run pre-commit run --all-files" in commands
        assert "uv run pytest --cov --cov-report=term-missing" in commands
    generated_ci = (tmp_path / ".github/workflows/ci.yml").read_text()
    assert "${{" in generated_ci
    template_ci = (ROOT / ".github/workflows/ci.yml").read_text()
    pins = configure.pinned_actions(template_ci)
    assert pins["actions/checkout"] in generated_ci
    assert pins["astral-sh/setup-uv"] in generated_ci
    hooks = yaml.safe_load((tmp_path / ".pre-commit-config.yaml").read_text())
    stages = [hook.get("stages") for hook in hooks["repos"][-1]["hooks"]]
    assert (["commit-msg"] in stages) == (kind != "bare")
    assert ("docs" in project["dependency-groups"]) == (kind != "bare")
    assert ("pytest-cov" in str(project["dependency-groups"])) == (
        kind != "bare"
    )


@pytest.mark.parametrize(
    "name",
    [
        *("../oops", "class", "123name", "a;echo bad", "a\nname"),
        *("os", "tests", "docs", "src", "test", "json"),
    ],
)
def test_invalid_name(name):
    with pytest.raises(ValueError):
        configure.context_for(options(name=name))


def test_normalizes_distribution_name():
    result = configure.context_for(options(name="My_Project.Tools"))
    assert result["name"] == "my-project-tools"
    assert result["module"] == "my_project_tools"


def test_existing_output_is_preserved(tmp_path):
    target = tmp_path / "keep.txt"
    target.write_text("keep me")
    with pytest.raises(ValueError, match="empty"):
        configure.generate(tmp_path, options())
    assert target.read_text() == "keep me"


def pristine_copy(tmp_path):
    destination = tmp_path / "copy"
    smoke._copy_template(destination)
    return destination


def snapshot(root):
    return {
        str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest()
        for p in root.rglob("*")
        if p.is_file()
    }


def test_failed_lock_leaves_template_untouched(tmp_path):
    destination = pristine_copy(tmp_path)
    before = snapshot(destination)
    with (
        patch.object(configure, "ROOT", destination),
        patch.object(
            configure,
            "lock_project",
            side_effect=subprocess.CalledProcessError(1, ["uv", "lock"]),
        ),
        pytest.raises(subprocess.CalledProcessError),
    ):
        configure.configure_in_place(options())
    assert snapshot(destination) == before


def test_modified_template_is_preserved(tmp_path):
    destination = pristine_copy(tmp_path)
    (destination / "README.md").write_text("my changes")
    before = snapshot(destination)
    with (
        patch.object(configure, "ROOT", destination),
        pytest.raises(ValueError, match="changed"),
    ):
        configure.configure_in_place(options())
    assert snapshot(destination) == before


def test_in_place_preserves_git_and_unrelated_files(tmp_path):
    destination = pristine_copy(tmp_path)
    (destination / ".git").mkdir()
    (destination / ".git/config").write_text("keep git history")
    cache = destination / ".template/__pycache__"
    cache.mkdir()
    (cache / "smoke.pyc").write_bytes(b"cache")
    (destination / "notes.txt").write_text("my notes")
    with (
        patch.object(configure, "ROOT", destination),
        patch.object(configure, "lock_project"),
    ):
        configure.configure_in_place(options("app"))
    assert (destination / ".git/config").read_text() == "keep git history"
    assert (destination / "notes.txt").read_text() == "my notes"
    assert not (destination / "configure.py").exists()
    assert not (destination / ".template").exists()
    assert not (destination / "LICENSE").exists()
    assert not (destination / "tests/test_template.py").exists()
    assert (destination / "src/sample_project/cli.py").exists()


def test_files_edited_by_dependabot_are_not_checked(tmp_path):
    destination = pristine_copy(tmp_path)
    manifest = json.loads((destination / ".template/manifest.json").read_text())
    assert manifest["uv.lock"] is None
    for name in ("pyproject.toml", "uv.lock", ".github/workflows/ci.yml"):
        with (destination / name).open("a") as file:
            file.write("\n# bumped by Dependabot\n")
    with (
        patch.object(configure, "ROOT", destination),
        patch.object(configure, "lock_project"),
    ):
        configure.configure_in_place(options())
    assert not (destination / ".template").exists()
    assert "bumped" not in (destination / "pyproject.toml").read_text()


def test_colliding_user_file_is_preserved(tmp_path):
    destination = pristine_copy(tmp_path)
    target = destination / "src/sample_project/core.py"
    target.parent.mkdir(parents=True)
    target.write_text("my code")
    before = snapshot(destination)
    with (
        patch.object(configure, "ROOT", destination),
        patch.object(configure, "lock_project"),
        pytest.raises(ValueError, match="overwrite"),
    ):
        configure.configure_in_place(options())
    assert snapshot(destination) == before


@pytest.mark.parametrize(
    "message, expected",
    [
        ("feat: add CLI", True),
        ("fix(core)!: change API\n\nBREAKING CHANGE: changed", True),
        ("chore(deps): update dependencies", True),
        ("docs: explain usage", True),
        ("Merge branch 'main' into feature", True),
        ('Revert "feat: add CLI"', True),
        ("updated stuff", False),
        ("Merged stuff", False),
        ("feat: ", False),
        ("", False),
    ],
)
def test_conventional_commit_checker(tmp_path, message, expected):
    source = (
        ROOT / ".template/packaged/.github/scripts/check_commit_message.py.in"
    )
    target = tmp_path / "checker.py"
    target.write_text(source.read_text())
    assert load_script(target).valid_header(message) == expected


@pytest.mark.parametrize("kind", ["library", "app", "bare"])
@pytest.mark.parametrize("no_ci", [False, True])
def test_workflow_triggers(tmp_path, kind, no_ci):
    with patch.object(configure, "lock_project"):
        configure.generate(tmp_path, options(kind, no_ci=no_ci))
    filenames = ["ci.yml"]
    if kind != "bare":
        filenames += ["docs.yml", "release-please.yml"]
        if not no_ci:
            filenames.append("pr-title.yml")
    workflows = sorted(
        path.name for path in (tmp_path / ".github/workflows").iterdir()
    )
    assert workflows == sorted(filenames)
    for filename in filenames:
        # BaseLoader keeps the YAML key "on" as text.
        workflow = yaml.load(
            (tmp_path / ".github/workflows" / filename).read_text(),
            Loader=yaml.BaseLoader,
        )
        events = workflow["on"]
        if filename == "pr-title.yml":
            assert set(events) == {"pull_request"}
            assert "edited" in events["pull_request"]["types"]
        elif no_ci:
            assert set(events) == {"workflow_dispatch"}
        else:
            expected = {"push", "workflow_dispatch"}
            if filename == "ci.yml":
                expected.add("pull_request")
            assert set(events) == expected
            assert events["push"]["branches"] == ["main"]
            assert "tags" not in events["push"]
        assert workflow["jobs"]
    assert (tmp_path / "tests").is_dir()
    assert (tmp_path / ".pre-commit-config.yaml").is_file()
    assert "make check" in (tmp_path / "README.md").read_text()
    assert ("CI-manual" in (tmp_path / "README.md").read_text()) == no_ci
    contributing = (tmp_path / "CONTRIBUTING.md").read_text()
    assert ("To turn on automatic runs" in contributing) == no_ci
    assert "\n\n\n" not in contributing
    makefile = (tmp_path / "Makefile").read_text()
    if kind == "bare":
        assert "uv run pytest\n" in makefile
        assert "--cov" not in makefile
    else:
        assert "uv run pytest --cov --cov-report=term-missing" in makefile
        assert "coverage.xml" not in makefile


@pytest.mark.parametrize(
    ("overrides", "match"),
    [
        ({"owner": "bad owner"}, "owner"),
        ({"repo": "bad repo"}, "repository"),
        ({"python": "3.10"}, "Python"),
        ({"author": "A\nB"}, "control"),
        ({"description": "line\nbreak"}, "control"),
    ],
)
def test_rejects_unusable_options(overrides, match):
    with pytest.raises(ValueError, match=match):
        configure.context_for(options(**overrides))


def test_default_descriptions_name_no_runtime_library():
    for kind in ("library", "app", "bare"):
        text = configure.context_for(options(kind, description=""))[
            "description"
        ]
        assert "typer" not in text.lower()


def test_missing_action_pin():
    with pytest.raises(ValueError, match="does not pin"):
        configure._pin({}, "actions/checkout")


def test_conflicting_action_pins():
    workflow = (
        "uses: actions/checkout@"
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa # v1.2.3\n"
        "uses: actions/checkout@"
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb # v1.2.4\n"
    )
    with pytest.raises(ValueError, match="Conflicting pin"):
        configure.pinned_actions(workflow)


def test_main_writes_output(tmp_path, monkeypatch, capsys):
    destination = tmp_path / "out"
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "configure.py",
            "--kind",
            "library",
            "--name",
            "sample-project",
            "--output",
            str(destination),
            "--owner",
            "someone",
            "--author",
            "Some One",
        ],
    )
    with patch.object(configure, "lock_project"):
        configure.main()
    assert (destination / "pyproject.toml").is_file()
    output = capsys.readouterr().out
    assert "make install" in output
    assert "This project has no license." in output


def test_main_rejects_output_of_this_copy(monkeypatch):
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "configure.py",
            "--kind",
            "library",
            "--name",
            "sample-project",
            "--output",
            str(ROOT),
            "--owner",
            "someone",
            "--author",
            "Some One",
        ],
    )
    with pytest.raises(SystemExit) as exc:
        configure.main()
    assert exc.value.code == 1


def test_main_rejects_bad_name(monkeypatch):
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "configure.py",
            "--kind",
            "library",
            "--name",
            "123bad",
            "--owner",
            "someone",
            "--author",
            "Some One",
        ],
    )
    with pytest.raises(SystemExit) as exc:
        configure.main()
    assert exc.value.code == 1


def test_main_configures_in_place(tmp_path, monkeypatch):
    destination = pristine_copy(tmp_path)
    monkeypatch.setattr(configure, "ROOT", destination)
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "configure.py",
            "--kind",
            "bare",
            "--name",
            "sample-project",
            "--no-ci",
        ],
    )
    git = {"config": "Some One", "remote": "git@github.com:someone/renamed.git"}
    with (
        patch.object(configure, "_git", side_effect=lambda *c: git[c[0]]),
        patch.object(configure, "lock_project"),
    ):
        configure.main()
    assert not (destination / "configure.py").exists()
    assert (destination / "Makefile").is_file()
    project = tomllib.loads((destination / "pyproject.toml").read_text())
    assert project["project"]["authors"][0]["name"] == "Some One"
    urls = project["project"]["urls"]
    assert urls["Repository"] == "https://github.com/someone/renamed"


def test_file_blocks_generated_directory(tmp_path):
    destination = pristine_copy(tmp_path)
    (destination / "src").write_text("not a directory")
    before = snapshot(destination)
    with (
        patch.object(configure, "ROOT", destination),
        patch.object(configure, "lock_project"),
        pytest.raises(ValueError, match="Invalid destination"),
    ):
        configure.configure_in_place(options())
    assert snapshot(destination) == before


def test_script_entry_point(monkeypatch, capsys):
    monkeypatch.setattr(sys, "argv", ["configure.py", "--help"])
    with pytest.raises(SystemExit) as exc:
        runpy.run_path(str(ROOT / "configure.py"), run_name="__main__")
    assert exc.value.code == 0
    assert "usage" in capsys.readouterr().out.lower()


def run_main(monkeypatch, *argv):
    monkeypatch.setattr(sys, "argv", ["configure.py", *argv])
    with pytest.raises(SystemExit) as exc:
        configure.main()
    return exc.value.code


def test_output_mode_requires_owner(tmp_path, monkeypatch, capsys):
    argv = ["--kind", "library", "--name", "sample-project"]
    argv += ["--output", str(tmp_path / "out"), "--author", "Some One"]
    remote = "https://github.com/someone/template.git"
    with patch.object(configure, "_git", return_value=remote):
        assert run_main(monkeypatch, *argv) == 1
    assert "--owner" in capsys.readouterr().err
    assert not (tmp_path / "out").exists()


def test_missing_git_details_are_reported(monkeypatch, capsys):
    argv = ["--kind", "library", "--name", "sample-project"]
    with patch.object(configure, "_git", return_value=""):
        assert run_main(monkeypatch, *argv) == 1
    assert "--owner and --author" in capsys.readouterr().err


def test_git_helper_reads_output_and_ignores_failure():
    assert configure._git("--version").startswith("git version")
    assert configure._git("no-such-command") == ""
    with patch.object(configure.subprocess, "run", side_effect=OSError):
        assert configure._git("--version") == ""


def test_missing_uv_is_reported(tmp_path, monkeypatch, capsys):
    argv = ["--kind", "library", "--name", "sample-project"]
    argv += ["--output", str(tmp_path / "out")]
    argv += ["--owner", "someone", "--author", "Some One"]
    with patch.object(configure.shutil, "which", return_value=None):
        assert run_main(monkeypatch, *argv) == 1
    assert "uv is required" in capsys.readouterr().err
    assert not (tmp_path / "out").exists()


def test_failed_output_can_be_repeated(tmp_path):
    error = subprocess.CalledProcessError(1, ["uv", "lock"])
    with (
        patch.object(configure, "lock_project", side_effect=error),
        pytest.raises(subprocess.CalledProcessError),
    ):
        configure.generate(tmp_path, options())
    assert list(tmp_path.iterdir()) == []
    with patch.object(configure, "lock_project"):
        configure.generate(tmp_path, options())
    assert (tmp_path / "pyproject.toml").is_file()


def test_mit_license(tmp_path):
    with patch.object(configure, "lock_project"):
        configure.generate(tmp_path, options(license="MIT"))
    project = tomllib.loads((tmp_path / "pyproject.toml").read_text())
    assert project["project"]["license"] == "MIT"
    assert project["project"]["license-files"] == ["LICENSE"]
    license_text = (tmp_path / "LICENSE").read_text()
    assert license_text.startswith("MIT License")
    assert 'A "Quoted" Author' in license_text
    readme = (tmp_path / "README.md").read_text()
    assert "MIT License" in readme
    assert "no license" not in readme


def test_unknown_placeholder_names_the_file(tmp_path):
    template = tmp_path / "copy"
    smoke._copy_template(template)
    (template / ".template/packaged/docs/index.md.in").write_text("{{oops}}")
    with (
        patch.object(configure, "ROOT", template),
        pytest.raises(ValueError, match=r"index\.md\.in: Unknown placeholder"),
    ):
        configure.generate(tmp_path / "out", options())


def test_repo_name_must_not_end_in_git():
    with pytest.raises(ValueError, match="repository"):
        configure.context_for(options(repo="project.git"))


def test_manifest_matches_template_files():
    if not (ROOT / ".git").exists():
        pytest.skip("The manifest is built from Git's file list.")
    saved = json.loads((ROOT / ".template/manifest.json").read_text())
    assert update_manifest.build_manifest() == saved
    assert not any("\\" in path for path in saved)


def test_lock_project_runs_uv_lock(tmp_path):
    with patch.object(configure.subprocess, "run") as run:
        configure.lock_project(tmp_path)
    run.assert_called_once_with(
        ["uv", "lock", "--project", str(tmp_path)], check=True
    )


def test_main_with_license_skips_warning(tmp_path, monkeypatch, capsys):
    argv = ["--kind", "bare", "--name", "sample-project", "--license", "MIT"]
    argv += ["--output", str(tmp_path / "out")]
    argv += ["--owner", "someone", "--author", "Some One"]
    monkeypatch.setattr(sys, "argv", ["configure.py", *argv])
    with patch.object(configure, "lock_project"):
        configure.main()
    assert "no license" not in capsys.readouterr().out
    assert (tmp_path / "out/LICENSE").is_file()


def test_context_has_no_unused_keys():
    context = configure.context_for(options())
    template = ROOT / ".template"
    used = set()
    for path in template.rglob("*.in"):
        text = str(path.relative_to(template)) + path.read_text()
        used.update(re.findall(r"\{\{([a-z_]+)\}\}", text))
    assert set(context) == used


@pytest.mark.parametrize(
    "remote",
    [
        "https://github.com/someone/renamed",
        "https://github.com/someone/renamed.git",
        "https://github.com/someone/renamed/",
        "git@github.com:someone/renamed.git",
        "ssh://git@github.com/someone/renamed",
        "https://user:token@github.com/someone/renamed.git",
    ],
)
def test_github_remote_formats(remote):
    args = options(owner=None, repo=None, author=None)
    with patch.object(
        configure,
        "_git",
        side_effect=lambda *c: {"config": "Some One"}.get(c[0], remote),
    ):
        configure.fill_defaults(args)
    assert (args.owner, args.repo) == ("someone", "renamed")


@pytest.mark.parametrize(
    "remote",
    [
        "https://mygithub.com/someone/renamed",
        "file:///tmp/github.com/someone/renamed",
        "https://gitlab.com/someone/renamed",
        "",
    ],
)
def test_other_remotes_are_not_used(remote):
    args = options(owner=None, repo=None)
    with (
        patch.object(configure, "_git", return_value=remote),
        pytest.raises(ValueError, match="--owner"),
    ):
        configure.fill_defaults(args)


def test_explicit_repo_beats_the_remote():
    args = options(owner=None, repo="chosen")
    remote = "git@github.com:someone/renamed.git"
    with patch.object(configure, "_git", return_value=remote):
        configure.fill_defaults(args)
    assert (args.owner, args.repo) == ("someone", "chosen")


def test_explicit_owner_ignores_the_remote():
    args = options(owner="mine", repo=None)
    remote = "git@github.com:someone/renamed.git"
    with patch.object(configure, "_git", return_value=remote):
        configure.fill_defaults(args)
    assert (args.owner, args.repo) == ("mine", None)
    assert configure.context_for(args)["repo"] == "sample-project"


def test_template_files_do_not_overwrite_each_other(tmp_path):
    template = tmp_path / "copy"
    smoke._copy_template(template)
    (template / ".template/library/README.md.in").write_text("again")
    with (
        patch.object(configure, "ROOT", template),
        pytest.raises(
            ValueError, match=r"Two template files create README\.md"
        ),
    ):
        configure.generate(tmp_path / "out", options())


def test_symlinked_file_is_not_overwritten(tmp_path):
    destination = pristine_copy(tmp_path)
    link = destination / "src/sample_project/cli.py"
    link.parent.mkdir(parents=True)
    link.symlink_to(destination / "README.md")
    with (
        patch.object(configure, "ROOT", destination),
        patch.object(configure, "lock_project"),
        pytest.raises(ValueError, match="overwrite"),
    ):
        configure.configure_in_place(options("app"))
    assert link.is_symlink()


def test_symlinked_directory_is_not_used(tmp_path):
    destination = pristine_copy(tmp_path)
    elsewhere = tmp_path / "elsewhere"
    elsewhere.mkdir()
    (destination / "src").symlink_to(elsewhere)
    with (
        patch.object(configure, "ROOT", destination),
        patch.object(configure, "lock_project"),
        pytest.raises(ValueError, match="Invalid destination"),
    ):
        configure.configure_in_place(options())
    assert list(elsewhere.iterdir()) == []
