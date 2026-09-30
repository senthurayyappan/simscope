"""Update file hashes after editing the template.

Run this before tests and commits. The manifest lists every file that Git
tracks or would track, so ignored files never appear in it. Dependabot edits a
few files, so their hash is null: setup deletes them without checking them.
"""

import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / ".template/manifest.json"
DEPENDABOT_EDITS = {"pyproject.toml", "uv.lock", ".github/workflows/ci.yml"}


def build_manifest() -> dict[str, str | None]:
    """Return each template file's path mapped to its SHA-256 hash."""
    listing = subprocess.run(
        ["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
        cwd=ROOT,
        capture_output=True,
        check=True,
    ).stdout.decode()
    paths = sorted(
        relative
        for relative in listing.split("\0")
        if relative
        and (ROOT / relative).is_file()
        and (ROOT / relative) != MANIFEST
    )
    return {
        relative: None
        if relative in DEPENDABOT_EDITS
        else hashlib.sha256((ROOT / relative).read_bytes()).hexdigest()
        for relative in paths
    }


if __name__ == "__main__":
    MANIFEST.write_text(
        json.dumps(build_manifest(), indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
