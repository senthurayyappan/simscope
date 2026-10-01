"""The app page and its built assets (contracts 2 and 6)."""

import html
import json
import pathlib
from typing import Any

ASSETS_DIR = pathlib.Path(__file__).resolve().parents[1] / "_assets"
ASSET_TYPES = {
    "simscope-app.js": "text/javascript; charset=utf-8",
    "simscope-app.css": "text/css; charset=utf-8",
    "simscope-player.js": "text/javascript; charset=utf-8",
}
"""Files served under ``/assets/``, and nothing else."""

_PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>{title}</title>
<link rel="icon" href="data:,">
<link rel="stylesheet" href="/assets/simscope-app.css">
</head>
<body>
<div id="app"></div>
<noscript>simscope needs JavaScript.</noscript>
<script id="simscope-boot" type="application/json">{boot}</script>
<script src="/assets/simscope-app.js"></script>
</body>
</html>
"""


def boot_block(obj: dict[str, Any]) -> str:
    """Serializes the boot object for a ``<script type="application/json">``.

    ``<``, ``>`` and ``&`` are escaped so no value can end the element or
    open a comment.

    Args:
        obj: The boot object of contracts 6.

    Returns:
        JSON text that is safe inside the script element.
    """
    text = json.dumps(obj, separators=(",", ":"), ensure_ascii=True)
    return (
        text.replace("<", "\\u003c")
        .replace(">", "\\u003e")
        .replace("&", "\\u0026")
    )


def index_page(
    *, token: str, library: str, writable: bool, title: str | None = None
) -> bytes:
    """Renders the page that hosts the app.

    Args:
        token: The write token for the boot block.
        library: Library name shown by the app.
        writable: Whether the library accepts writes.
        title: Page title; defaults to ``simscope`` plus the library name.

    Returns:
        The UTF-8 page.
    """
    boot = {
        "mode": "http",
        "base": "",
        "token": token,
        "library": library,
        "writable": writable,
    }
    page = _PAGE.format(
        title=html.escape(title or f"simscope {library}"),
        boot=boot_block(boot),
    )
    return page.encode()
