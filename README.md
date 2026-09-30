# Python template

[![CI](https://github.com/senthurayyappan/python-template/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/senthurayyappan/python-template/actions/workflows/ci.yml)
[![Python](https://img.shields.io/badge/Python-3.12%2B-3776AB?logo=python&logoColor=white)](.python-version)
[![uv](https://img.shields.io/badge/uv-managed-DE5FE9?logo=uv)](https://docs.astral.sh/uv/)
[![Ruff](https://img.shields.io/badge/lint-Ruff-D7FF64?logo=ruff)](https://docs.astral.sh/ruff/)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

A shared starting point for Python libraries, command-line apps, and experiments.
It keeps dependencies, code checks, documentation, and releases consistent across
projects, so you don't have to configure them each time.

The setup uses [uv](https://docs.astral.sh/uv/), [Ruff](https://docs.astral.sh/ruff/),
[ty](https://docs.astral.sh/ty/), [pytest](https://docs.pytest.org/en/stable/),
[pre-commit](https://pre-commit.com/), and [MkDocs](https://www.mkdocs.org/).
[Release Please](https://github.com/googleapis/release-please) turns
[Conventional Commits](https://www.conventionalcommits.org/) into version updates and changelogs.

## Get started

Install [uv](https://docs.astral.sh/uv/getting-started/installation/) and
Git. Click **Use this template**, create a repository, and clone it.
Choose a preset:

| Preset | For | You get |
| --- | --- | --- |
| `library` | A package you can publish to [PyPI](https://pypi.org/) | `src/` layout, `py.typed`, API docs, PyPI publishing |
| `app` | An installable command-line app | `src/` layout, a console script, API docs, PyPI publishing |
| `bare` | Scripts, notebooks, and experiments | `experiments/` and `notebooks/` folders, no packaging, docs, or releases |

Every preset gets pytest, Ruff, [ty](https://docs.astral.sh/ty/), pre-commit
hooks, GitHub Actions, and Dependabot. `library` and `app` also get a MkDocs
site, Conventional Commit checks, and Release Please. `bare` keeps just the
checks and tests.

Before editing any files, run this from your new repository:

```bash
uv run --no-project python configure.py --kind library --name my-project
make install
```

Replace `library` and `my-project` with your preset and project name.
Setup creates your project and lockfile; `make install` installs dependencies
and Git hooks. Without `make` (for example on Windows), run `uv sync` and
`uv run pre-commit install --hook-type pre-commit --hook-type commit-msg`
(just `uv run pre-commit install` for `bare`).
Commit and push the generated files when ready.

Setup reads the GitHub owner and repository name from your `origin` remote
and the author from `git config user.name`. Use `--owner`, `--repo`, and
`--author` to override them. With `--output`, pass `--owner` too.

To run workflows only when you start them from the Actions tab, add
`--no-ci` to the setup command. Local checks and Git hooks stay available.

`--python` sets the oldest Python your project supports (default 3.12).
CI tests that version and every newer one up to 3.14, and 3.11 to 3.14 are
supported. The new project
has no license unless you pass `--license MIT`; for another license, see
[choosealicense.com](https://choosealicense.com/). Run
`uv run --no-project python configure.py --help` for other options.

## Getting later template changes

Setup is one-time. It removes the template files, so a generated project
cannot pull later changes from this template. To adopt an improvement, clone
the latest template, generate a fresh project with the same options into a
scratch directory, and compare it with yours:

```bash
git clone https://github.com/senthurayyappan/python-template /tmp/template
cd /tmp/template
uv run --no-project python configure.py --kind library --name my-project \
  --owner your-name --repo my-repo --author "Your Name" --output /tmp/fresh
diff -ru -x .git -x .venv -x uv.lock /tmp/fresh ~/code/my-project
```

Use the same `--python`, `--license`, and `--no-ci` options as before, then
copy over the changes you want. [ty](https://docs.astral.sh/ty/) is still
pre-1.0, so a new release may report new type errors.

## Everyday commands

```bash
make check    # Lint, format, and type checks
make test     # Unit tests
make docs     # Serve documentation (library and app)
```

[GitHub Actions](https://docs.github.com/en/actions) runs the checks
automatically. In `library` and `app` projects, use commit messages such as
`feat: add export` or `fix: handle empty input` for automated changelogs.
The generated project's `CONTRIBUTING.md` covers release and deployment setup.

[Maintaining this template](CONTRIBUTING.md)
