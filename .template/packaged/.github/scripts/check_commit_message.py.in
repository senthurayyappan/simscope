"""Check the first line of a commit message or a pull request title."""

import os
import re
import sys
from pathlib import Path

TYPES = "feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert"
HEADER = re.compile(rf"(?:{TYPES})(?:\([^()\r\n]+\))?!?: \S.*")
# Git and GitHub write these headers themselves.
GENERATED = ("Merge ", 'Revert "')


def valid_header(message: str) -> bool:
    """Return True if the first line is a Conventional Commit header.

    Merge and revert headers written by Git and GitHub are also accepted.
    """
    lines = message.splitlines()
    if not lines:
        return False
    return lines[0].startswith(GENERATED) or bool(HEADER.fullmatch(lines[0]))


def main() -> None:
    """Check a commit message file, or read PR_TITLE if no file is given."""
    if len(sys.argv) > 1:
        message = Path(sys.argv[1]).read_text(encoding="utf-8")
    else:
        message = os.environ["PR_TITLE"]
    if not valid_header(message):
        print(
            "Use a Conventional Commit header, "
            "e.g. feat(cli): add export command",
            file=sys.stderr,
        )
        raise SystemExit(1)


if __name__ == "__main__":
    main()
