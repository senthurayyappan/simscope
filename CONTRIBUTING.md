# Maintaining the template

This guide is for changing the template itself. To use the template, see
[README.md](README.md).

Files for every preset live in `.template/common/`. `library` and `app` also
get `.template/packaged/` (docs, releases, commit checks), and each preset adds
its own folder: `.template/library/`, `.template/app/`, or `.template/bare/`.
`configure.py` fills in `{{placeholders}}`, such as project names and
settings. When `library` and `app` differ only slightly, keep one file and
add a placeholder. When `bare` differs a lot, give it its own file.

After editing the template, update its file hashes and run the checks:

```bash
uv sync
uv run ruff check .
uv run ruff format --check .
uv run ty check
uv run --no-project python .template/update_manifest.py
uv run pytest --cov --cov-report=term-missing
```

To create a test project in a separate directory:

```bash
uv run --no-project python configure.py --kind app --name my-cli \
  --owner your-name --output ../my-cli
```

The output directory must be empty. GitHub Actions tests all three presets,
including installation, Git hooks, docs, package builds, and release updates.

Use Conventional Commits for changes to this template. CI uses `uv sync --locked`
to check that the lockfile is up to date. Local commands use uv's defaults.

Action pins live in `.github/workflows/ci.yml`. Dependabot updates that file.
Generated workflows copy those pins, so do not paste action SHAs into
`.template/`.

Tool versions live in the `pyproject.toml.in` files and the hook version in
the `.pre-commit-config.yaml.in` files. Dependabot cannot update these template
files here, although it does update generated projects. Check them now and
then. Add each new Python release to `PYTHONS` in `configure.py`
and to the CI matrix in `.github/workflows/ci.yml`.
