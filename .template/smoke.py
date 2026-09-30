"""Create a project and test its files, tools, and installed package."""

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _run(*command: str, cwd: Path) -> None:
    print(f"+ {' '.join(command)}", flush=True)
    subprocess.run(command, cwd=cwd, check=True)


def _copy_template(project: Path) -> None:
    manifest = json.loads((ROOT / ".template/manifest.json").read_text())
    for relative in [*manifest, ".template/manifest.json"]:
        target = project / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / relative, target)


def _configure(project: Path, args: argparse.Namespace) -> None:
    command = [
        sys.executable,
        "configure.py",
        "--kind",
        args.kind,
        "--name",
        "sample-project",
        "--python",
        args.python,
    ]
    if args.no_ci:
        command.append("--no-ci")
    _run(*command, cwd=project)
    if (project / "configure.py").exists() or (project / ".template").exists():
        raise RuntimeError("Setup left template scaffolding behind")


def _check_hooks(
    project: Path, scratch: Path, args: argparse.Namespace
) -> None:
    packaged = args.kind != "bare"
    hook_types = ["pre-commit", "commit-msg"] if packaged else ["pre-commit"]
    groups = ["--group", "docs"] if packaged else []
    _run("uv", "sync", "--locked", *groups, cwd=project)
    _run(
        "uv",
        "run",
        "pre-commit",
        "install",
        *(f"--hook-type={hook}" for hook in hook_types),
        cwd=project,
    )
    _run("uv", "run", "pre-commit", "run", "--all-files", cwd=project)
    _run("git", "diff", "--exit-code", cwd=project)
    if not packaged:
        return
    message = scratch / "commit-message"
    message.write_text(
        "feat(cli)!: change behavior\n\nBREAKING CHANGE: new API\n"
    )
    _run(
        "uv",
        "run",
        "pre-commit",
        "run",
        "--hook-stage",
        "commit-msg",
        "--commit-msg-filename",
        str(message),
        cwd=project,
    )
    message.write_text("updated stuff\n")
    result = subprocess.run(
        [
            "uv",
            "run",
            "pre-commit",
            "run",
            "--hook-stage",
            "commit-msg",
            "--commit-msg-filename",
            str(message),
        ],
        cwd=project,
        check=False,
    )
    if result.returncode == 0:
        raise RuntimeError("Commit hook accepted an invalid message")


def _check_project(
    project: Path,
    scratch: Path,
    args: argparse.Namespace,
) -> None:
    if args.kind == "bare":
        _run("uv", "run", "pytest", cwd=project)
        _run("uv", "run", "python", "experiments/example.py", cwd=project)
        return
    test_args = ["--cov", "--cov-report=term-missing", "--cov-fail-under=100"]
    _run("uv", "run", "pytest", *test_args, cwd=project)
    _run(
        "uv",
        "run",
        "--group",
        "docs",
        "mkdocs",
        "build",
        "--strict",
        cwd=project,
    )
    remote = scratch / "docs-remote.git"
    _run("git", "init", "--bare", str(remote), cwd=project)
    _run("git", "remote", "set-url", "origin", str(remote), cwd=project)
    os.environ["GIT_COMMITTER_NAME"] = "github-actions[bot]"
    os.environ["GIT_COMMITTER_EMAIL"] = (
        "41898282+github-actions[bot]@users.noreply.github.com"
    )
    _run(
        "uv",
        "run",
        "--group",
        "docs",
        "mkdocs",
        "gh-deploy",
        "--strict",
        cwd=project,
    )
    _run(
        "git",
        "--git-dir",
        str(remote),
        "cat-file",
        "-e",
        "gh-pages:index.html",
        cwd=project,
    )
    _run("uv", "build", "--no-sources", cwd=project)
    wheel = next((project / "dist").glob("*.whl"))
    _run(
        "uv",
        "run",
        "--no-project",
        "--isolated",
        "--python",
        args.python,
        "--with",
        str(wheel),
        "--with",
        "pytest",
        "python",
        "-m",
        "pytest",
        str(project / "tests"),
        cwd=scratch,
    )
    if args.kind != "app":
        return
    commands = (
        ("sample-project", "hello", "Ada"),
        ("python", "-m", "sample_project", "hello", "Ada"),
    )
    for command in commands:
        _run(
            "uv",
            "run",
            "--no-project",
            "--isolated",
            "--python",
            args.python,
            "--with",
            str(wheel),
            *command,
            cwd=scratch,
        )


def main() -> None:
    """Build one preset and run its hooks, tests, docs, and package."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("kind", choices=("library", "app", "bare"))
    parser.add_argument("--python", default="3.12")
    parser.add_argument("--no-ci", action="store_true")
    args = parser.parse_args()
    prefix = f"template-{args.kind}-"
    with tempfile.TemporaryDirectory(prefix=prefix) as scratch_dir:
        scratch = Path(scratch_dir)
        project = scratch / "project"
        _copy_template(project)
        _run("git", "init", "-b", "main", cwd=project)
        _run("git", "config", "user.name", "Template CI", cwd=project)
        _run(
            "git",
            "config",
            "user.email",
            "template@example.invalid",
            cwd=project,
        )
        _run(
            "git",
            "remote",
            "add",
            "origin",
            "https://github.com/template/sample-project.git",
            cwd=project,
        )
        _run("git", "add", ".", cwd=project)
        _run("git", "commit", "-m", "chore: copy template", cwd=project)
        _configure(project, args)
        _run("git", "add", "-A", cwd=project)
        _run(
            "git",
            "commit",
            "-m",
            "chore: initialize test project",
            cwd=project,
        )
        _check_hooks(project, scratch, args)
        _check_project(project, scratch, args)
        _run("git", "diff", "--exit-code", cwd=project)
    print(f"PASS: {args.kind}, Python {args.python}")


if __name__ == "__main__":
    os.environ.pop("VIRTUAL_ENV", None)
    main()
