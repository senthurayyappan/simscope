#!/usr/bin/env python3
"""Set up a new project from a GitHub template copy."""

from __future__ import annotations

import argparse
import hashlib
import json
import keyword
import re
import shutil
import subprocess
import sys
import tempfile
from contextlib import suppress
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PYTHONS = ("3.11", "3.12", "3.13", "3.14")
PIN = re.compile(
    r"uses: (?P<ref>(?P<name>[\w.-]+/[\w.-]+)@"
    r"[0-9a-f]{40} # v\d+\.\d+\.\d+)"
)
RESERVED = {"test", "tests", "docs", "src"}
# This workflow only makes sense when pull requests trigger it.
NEEDS_CI = ".github/workflows/pr-title.yml"
REMOTE = re.compile(
    r"(?:https?://|ssh://)?(?:[^@/]+@)?github\.com[:/]"
    r"(?P<owner>[^/]+)/(?P<repo>[^/]+?)(?:\.git)?/?"
)
KIND_DESCRIPTION = {
    "library": "A Python library.",
    "app": "A command-line app.",
    "bare": "Python scripts and notebooks.",
}
MIT = """MIT License

Copyright (c) {year} {author}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
"""


def render(text: str, context: dict[str, str]) -> str:
    """Fill in template values and keep GitHub Actions expressions unchanged."""

    def value(match: re.Match[str]) -> str:
        try:
            return context[match[1]]
        except KeyError:
            raise ValueError(f"Unknown placeholder {match[0]}.") from None

    return re.sub(r"(?<!\$)\{\{([a-z_]+)\}\}", value, text)


def pinned_actions(workflow: str) -> dict[str, str]:
    """Return each action's ``uses`` value from a workflow file.

    Args:
        workflow: Workflow YAML. An action may appear more than once.
            Every occurrence must use the same commit.

    Returns:
        Action name mapped to ``owner/repo@sha # vX.Y.Z``.

    Raises:
        ValueError: If one action is pinned to two different commits.
    """
    pins: dict[str, str] = {}
    for match in PIN.finditer(workflow):
        name = match.group("name")
        ref = match.group("ref")
        if name in pins and pins[name] != ref:
            raise ValueError(f"Conflicting pin for {name}.")
        pins[name] = ref
    return pins


def _pin(pins: dict[str, str], name: str) -> str:
    try:
        return pins[name]
    except KeyError:
        raise ValueError(f"Template workflow does not pin {name}.") from None


def context_for(args: argparse.Namespace) -> dict[str, str]:
    """Check project options and set the template values.

    Args:
        args: Parsed setup options.

    Returns:
        Placeholder names mapped to the text that replaces them.

    Raises:
        ValueError: If a name, owner, repository, Python version, author,
            or description is not usable in the generated files.
    """
    name = re.sub(r"[-_.]+", "-", args.name).lower()
    if not re.fullmatch(r"[a-z][a-z0-9]*(?:-[a-z0-9]+)*", name):
        raise ValueError(
            "Use a project name starting with a letter, containing "
            "letters, digits or hyphens."
        )
    module = name.replace("-", "_")
    if (
        keyword.iskeyword(module)
        or module in sys.stdlib_module_names
        or module in RESERVED
    ):
        raise ValueError(
            f"The name {module!r} is a Python keyword, a standard library "
            "module, or a project folder. Choose another project name."
        )
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9-]*", args.owner):
        raise ValueError("Invalid GitHub owner.")
    repo = args.repo or name
    if repo.lower().endswith(".git") or not re.fullmatch(
        r"[A-Za-z0-9][A-Za-z0-9_.-]*", repo
    ):
        raise ValueError("Invalid GitHub repository name.")
    if args.python not in PYTHONS:
        raise ValueError(f"Supported Python versions: {', '.join(PYTHONS)}")
    packaged = args.kind != "bare"
    description = args.description or KIND_DESCRIPTION[args.kind]
    if any(ord(char) < 32 for char in args.author + description):
        raise ValueError(
            "Author and description must be single-line text "
            "without control characters."
        )
    matrix = list(PYTHONS[PYTHONS.index(args.python) :])
    workflow = (ROOT / ".github/workflows/ci.yml").read_text(encoding="utf-8")
    pins = pinned_actions(workflow)
    workflow_url = (
        f"https://github.com/{args.owner}/{repo}/actions/workflows/ci.yml"
    )
    if args.no_ci:
        workflow_note = (
            "Automatic workflows are off. To run CI"
            + (", Docs, or Release Please" if packaged else "")
            + ", open the Actions tab, select the workflow, and click "
            "**Run workflow**. Dependabot still opens update pull "
            "requests, so run **CI** on those branches yourself."
        )
        ci_badge = (
            "[![CI: manual]"
            "(https://img.shields.io/badge/CI-manual-lightgrey)]"
            f"({workflow_url})"
        )
    else:
        workflow_note = "CI runs on pushes to main and on pull requests."
        ci_badge = (
            f"[![CI]({workflow_url}/badge.svg?branch=main)]({workflow_url})"
        )
    usage = layout = scripts = ""
    if args.kind == "app":
        usage = f"uv run {name} hello Ada"
        layout = (
            f"Code lives in `src/{module}/`. Add commands in `cli.py` "
            "and subpackages as needed."
        )
        scripts = f'\n[project.scripts]\n{name} = "{module}.cli:main"\n'
    elif args.kind == "library":
        usage = (
            f'uv run python -c "from {module} import greet; '
            "print(greet('Ada'))\""
        )
        layout = (
            f"Library code lives in `src/{module}/`, with tests in `tests/`."
        )
    return {
        "push_trigger": "" if args.no_ci else "  push:\n    branches: [main]\n",
        "pull_request_trigger": "" if args.no_ci else "  pull_request:\n",
        "ci_badge": ci_badge,
        "workflow_note": workflow_note,
        "docs_start": (
            "Run the **Docs** workflow, and run it again to publish later "
            "changes."
            if args.no_ci
            else "Run the **Docs** workflow once, or push to `main`."
        ),
        "release_step_note": (
            "With automatic workflows off, run **Release Please** from the "
            "Actions tab to open the release pull request, and run it again "
            "after you merge that pull request.\n\n"
            if args.no_ci
            else ""
        ),
        "enable_ci_note": (
            "To turn on automatic runs, add `push` to the `on:` section of "
            "each file in `.github/workflows/`:\n\n"
            "```yaml\non:\n  push:\n    branches: [main]\n"
            "  workflow_dispatch:\n```\n\n"
            "In `ci.yml`, also add `pull_request:` so CI checks pull requests."
            + (
                " The pull request title check, `pr-title.yml`, is not "
                "generated with `--no-ci`."
                if packaged
                else ""
            )
            if args.no_ci
            else ""
        ),
        "name": name,
        "name_json": json.dumps(name),
        "module": module,
        "repo": repo,
        "owner": args.owner,
        "description": description,
        "description_json": json.dumps(description),
        "author_json": json.dumps(args.author),
        "python": args.python,
        "python_digits": args.python.replace(".", ""),
        "python_tuple": args.python.replace(".", ", "),
        "python_matrix": json.dumps(matrix),
        "license_field": (
            'license = "MIT"\nlicense-files = ["LICENSE"]\n'
            if args.license == "MIT"
            else ""
        ),
        "license_note": (
            "This project uses the MIT License. See the `LICENSE` file."
            if args.license == "MIT"
            else (
                "This project has no license yet. Add one before you "
                "publish or accept contributions."
            )
        ),
        "project_scripts": scripts,
        "usage": usage,
        "layout_description": layout,
        "action_checkout": _pin(pins, "actions/checkout"),
        "action_setup_uv": _pin(pins, "astral-sh/setup-uv"),
        "action_release_please": _pin(pins, "googleapis/release-please-action"),
    }


def _write(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8", newline="\n")


def lock_project(destination: Path) -> None:
    """Create the lockfile for the generated project."""
    subprocess.run(["uv", "lock", "--project", str(destination)], check=True)


def _write_release_config(destination: Path, name: str) -> None:
    config = {
        "$schema": (
            "https://raw.githubusercontent.com/googleapis/"
            "release-please/main/schemas/config.json"
        ),
        "packages": {
            ".": {
                "release-type": "python",
                "package-name": name,
                "include-component-in-tag": False,
                "include-v-in-tag": True,
                "extra-files": [
                    {
                        "type": "toml",
                        "path": "uv.lock",
                        "jsonpath": (
                            f"$.package[?(@.name.value=='{name}')].version"
                        ),
                    }
                ],
            }
        },
        "bump-minor-pre-major": True,
        "bump-patch-for-minor-pre-major": True,
    }
    _write(
        destination / ".release-please-config.json",
        json.dumps(config, indent=2) + "\n",
    )
    _write(
        destination / ".release-please-manifest.json",
        json.dumps({".": "0.1.0"}) + "\n",
    )


def _write_files(
    destination: Path,
    args: argparse.Namespace,
    context: dict[str, str],
) -> None:
    # Library and app projects share the "packaged" files.
    folders = ["common", args.kind]
    if args.kind != "bare":
        folders = ["common", "packaged", args.kind]
    written: set[str] = set()
    for folder in folders:
        base = ROOT / ".template" / folder
        for source in sorted(base.rglob("*.in")):
            relative = render(source.relative_to(base).as_posix()[:-3], context)
            if args.no_ci and relative == NEEDS_CI:
                continue
            if relative in written:
                raise ValueError(f"Two template files create {relative}.")
            written.add(relative)
            target = destination / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            try:
                text = render(source.read_text(encoding="utf-8"), context)
            except ValueError as exc:
                raise ValueError(f"{source.relative_to(ROOT)}: {exc}") from exc
            if target.suffix == ".md":
                # Empty placeholders leave extra blank lines.
                text = re.sub(r"\n{3,}", "\n\n", text)
            _write(target, text.rstrip() + "\n" if text.strip() else "")
    for filename in (".gitignore", ".editorconfig", ".gitattributes"):
        shutil.copy2(ROOT / filename, destination / filename)
    _write(destination / ".python-version", args.python + "\n")
    if args.license == "MIT":
        text = MIT.format(year=date.today().year, author=args.author)
        _write(destination / "LICENSE", text)
    if args.kind != "bare":
        _write_release_config(destination, context["name"])


def generate(destination: Path, args: argparse.Namespace) -> None:
    """Write the project files to an empty directory and create the lockfile.

    Args:
        destination: Directory that is missing or empty.
        args: Parsed setup options.

    Raises:
        ValueError: If an option is not usable or the directory is not empty.
    """
    context = context_for(args)
    if destination.exists() and any(destination.iterdir()):
        raise ValueError(f"Output directory must be empty: {destination}")
    destination.mkdir(parents=True, exist_ok=True)
    try:
        _write_files(destination, args, context)
        lock_project(destination)
    except BaseException:
        # The directory was empty, so a failed run can be repeated.
        for child in destination.iterdir():
            if child.is_dir() and not child.is_symlink():
                shutil.rmtree(child)
            else:
                child.unlink()
        raise


def configure_in_place(args: argparse.Namespace) -> None:
    """Create the project first, then replace the unchanged template files."""
    manifest_path = ROOT / ".template/manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    for relative, expected in manifest.items():
        path = ROOT / relative
        if (
            path.is_symlink()
            or not path.is_file()
            or (
                expected is not None
                and hashlib.sha256(path.read_bytes()).hexdigest() != expected
            )
        ):
            raise ValueError(
                f"Template file changed: {relative}. "
                "Use --output to preserve your edits."
            )
    # Create the project in a temporary directory so setup failures do not
    # change this copy.
    with tempfile.TemporaryDirectory(prefix="python-template-") as scratch:
        staged = Path(scratch) / "project"
        generate(staged, args)
        generated = [path for path in staged.rglob("*") if path.is_file()]
        for source in generated:
            relative = source.relative_to(staged)
            target = ROOT / relative
            if target.is_symlink() or (
                target.exists() and relative.as_posix() not in manifest
            ):
                raise ValueError(
                    f"Refusing to overwrite existing file: {relative}"
                )
            parent = target.parent
            while parent != ROOT:
                blocked = parent.is_symlink() or (
                    parent.exists() and not parent.is_dir()
                )
                if blocked:
                    raise ValueError(f"Invalid destination directory: {parent}")
                parent = parent.parent
        for relative in manifest:
            (ROOT / relative).unlink()
        manifest_path.unlink()
        for source in generated:
            target = ROOT / source.relative_to(staged)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)
        # Remove empty directories left by the template.
        parents = {
            parent
            for relative in manifest
            for parent in (ROOT / relative).parents
            if parent != ROOT and ROOT in parent.parents
        }
        for directory in sorted(
            parents,
            key=lambda path: len(path.parts),
            reverse=True,
        ):
            shutil.rmtree(directory / "__pycache__", ignore_errors=True)
            with suppress(OSError):
                directory.rmdir()


def _git(*command: str) -> str:
    try:
        result = subprocess.run(
            ["git", *command],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=True,
        )
    except (OSError, subprocess.CalledProcessError):
        return ""
    return result.stdout.strip()


def fill_defaults(args: argparse.Namespace) -> None:
    """Fill the owner, repository and author from git when they are omitted.

    Args:
        args: Parsed setup options. This function updates them.

    Raises:
        ValueError: If the owner or author is still unknown.
    """
    if not args.author:
        args.author = _git("config", "user.name")
    if not args.owner and not args.output:
        # The remote of a fresh template copy is the new repository.
        match = REMOTE.fullmatch(_git("remote", "get-url", "origin"))
        if match:
            args.owner = match["owner"]
            args.repo = args.repo or match["repo"]
    missing = [
        f"--{option}"
        for option in ("owner", "author")
        if not getattr(args, option)
    ]
    if missing:
        raise ValueError(
            f"Pass {' and '.join(missing)}: git cannot supply it here."
        )


def main() -> None:
    """Read the setup options and create the project."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--kind",
        choices=("library", "app", "bare"),
        required=True,
    )
    parser.add_argument(
        "--name",
        required=True,
        help="Distribution name, e.g. robot-tools",
    )
    parser.add_argument(
        "--owner",
        help=(
            "GitHub owner (default: the origin remote; required with --output)"
        ),
    )
    parser.add_argument(
        "--repo",
        help=(
            "GitHub repository name (default: the origin remote when "
            "--owner is also omitted, otherwise the distribution name)"
        ),
    )
    parser.add_argument("--description", default="")
    parser.add_argument("--author", help="Author name (default: git user.name)")
    parser.add_argument("--python", choices=PYTHONS, default="3.12")
    parser.add_argument(
        "--license",
        choices=("none", "MIT"),
        default="none",
        help="Add a LICENSE file (default: none)",
    )
    parser.add_argument(
        "--no-ci",
        action="store_true",
        help=(
            "Run CI, docs, and release workflows manually instead of on "
            "pushes and pull requests"
        ),
    )
    parser.add_argument(
        "--output",
        type=Path,
        help=(
            "Generate into an empty directory instead of configuring this copy"
        ),
    )
    args = parser.parse_args()
    try:
        if not shutil.which("uv"):
            raise ValueError("uv is required. See https://docs.astral.sh/uv/.")
        fill_defaults(args)
        if args.output:
            destination = args.output.resolve()
            if destination == ROOT:
                raise ValueError(
                    "Omit --output to configure the current template copy."
                )
            generate(destination, args)
        else:
            destination = ROOT
            configure_in_place(args)
    except (ValueError, OSError, subprocess.CalledProcessError) as exc:
        parser.exit(1, f"Configuration failed: {exc}\n")
    print(f"Created {args.kind} project in {destination}")
    if args.license == "none":
        print(
            "This project has no license. Add one before you publish "
            "or accept contributions."
        )
    print("Next: make install")
    print(
        "Then review the files and commit: "
        "git add -A && git commit -m 'chore: initialize project'"
    )


if __name__ == "__main__":
    main()
