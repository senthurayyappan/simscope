"""What the server will and will not answer (contracts 1 and 2).

Three independent guards, all of which exist because ``simscope serve``
exposes a slice of the filesystem to whatever page the browser has open:

* :class:`HostGuard` rejects requests whose ``Host`` is not one of ours, so
  a DNS-rebinding page cannot read the library through the user's browser.
* :func:`check_write` gates mutations on the boot token and on a same-host
  ``Origin`` (the token alone would leak through a cross-site form; the
  origin alone would be spoofable by any local process).
* :func:`parse_path` maps a URL path onto the closed set of library paths of
  contracts 1 (no directory listing, no ``..``, no symlinks out of the
  root): anything that is not one of the shapes below is a 404.
"""

import dataclasses
import hmac
import os
import pathlib
import re
from collections.abc import Sequence
from typing import Literal

from starlette.datastructures import Headers
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

LOOPBACK_HOSTS = ("localhost", "127.0.0.1", "::1")
TOKEN_HEADER = "x-simscope-token"

_NAME = r"[A-Za-z0-9][A-Za-z0-9._-]{0,127}"
_RUN_FILE = re.compile(
    rf"^runs/(?P<run>{_NAME})/"
    rf"(?P<file>rollout\.json|annotations\.json|{_NAME}\.blk)$"
)
_CAS = re.compile(
    r"^(?P<kind>scenes|assets)/(?P<ab>[0-9a-f]{2})/"
    r"(?P<sha>[0-9a-f]{64})(?P<ext>\.json)?$"
)
_DERIVED = re.compile(
    rf"^derived/(?P<run>{_NAME})/"
    rf"(?P<what>root_pose\.blk|summaries\.json|highlights\.json"
    rf"|envelopes/{_NAME}\.json)$"
)

Kind = Literal["run", "cas", "derived"]


@dataclasses.dataclass(frozen=True)
class Target:
    """A parsed library path.

    Attributes:
        kind: ``"run"`` (under ``runs/``), ``"cas"`` (``scenes/`` and
            ``assets/``) or ``"derived"`` (computed on demand).
        path: The path as asked, relative to the library root.
        run: The run name, for ``run`` and ``derived`` paths.
        file: The file inside the run (``run``), or the derived file relative
            to ``derived/<run>/`` (``derived``).
    """

    kind: Kind
    path: str
    run: str = ""
    file: str = ""

    @property
    def immutable(self) -> bool:
        """True for content-addressed files, which never change."""
        return self.kind == "cas"


def parse_path(path: str) -> Target | None:
    """Classifies a URL path against the closed set of contracts 1 shapes.

    Args:
        path: The path after ``/files/`` (or a ``path=`` query value).

    Returns:
        The target, or ``None`` if the path is not a library path. Nothing
        touches the filesystem here.
    """
    if not path or len(path) > 400 or "\\" in path or "\0" in path:
        return None
    m = _RUN_FILE.match(path)
    if m:
        return Target("run", path, m["run"], m["file"])
    m = _DERIVED.match(path)
    if m:
        return Target("derived", path, m["run"], m["what"])
    m = _CAS.match(path)
    # Scenes are JSON; assets are raw blobs with no extension.
    if (
        m
        and m["sha"].startswith(m["ab"])
        and (m["kind"] == "scenes") == (m["ext"] == ".json")
    ):
        return Target("cas", path)
    return None


def confine(root_real: str, candidate: pathlib.Path) -> pathlib.Path | None:
    """Returns ``candidate`` if it really lies inside the library.

    Args:
        root_real: ``os.path.realpath`` of the library root.
        candidate: A path built from a validated :class:`Target`.

    Returns:
        The path, or ``None`` if following symlinks leaves the root.
    """
    real = os.path.realpath(candidate)
    if real == root_real or not real.startswith(root_real + os.sep):
        return None
    return candidate


def host_of(header: str | None) -> str | None:
    """Extracts the host name from a ``Host`` header, without the port.

    Args:
        header: The header value, such as ``localhost:8080`` or ``[::1]:80``.

    Returns:
        The lowercase host (IPv6 without brackets), or ``None`` if the
        header is missing or malformed.
    """
    if not header:
        return None
    header = header.strip().lower()
    if header.startswith("["):
        end = header.find("]")
        if end < 0:
            return None
        rest = header[end + 1 :]
        if rest and not re.fullmatch(r":\d{1,5}", rest):
            return None
        return header[1:end]
    host, sep, port = header.partition(":")
    if sep and not port.isdigit():
        return None
    return host or None


def allowed_hosts_for(bind_host: str) -> tuple[str, ...]:
    """Chooses the ``Host`` values a server bound to ``bind_host`` accepts.

    A loopback bind accepts only loopback names, which is what stops DNS
    rebinding. A wildcard bind (``0.0.0.0``, ``::``) means the user chose
    to be reachable by name or address, so every host is accepted (writes
    still need the token). Any other bind accepts that address plus
    loopback.

    Args:
        bind_host: The address passed to ``--host``.

    Returns:
        Allowed host names, or ``("*",)`` for any.
    """
    bind = bind_host.strip("[]").lower()
    if bind in ("0.0.0.0", "::", ""):
        return ("*",)
    if bind in LOOPBACK_HOSTS:
        return LOOPBACK_HOSTS
    return (*LOOPBACK_HOSTS, bind)


class HostGuard:
    """ASGI middleware that answers 400 to a ``Host`` we do not serve."""

    def __init__(self, app: ASGIApp, allowed: Sequence[str]) -> None:
        """Wraps an app.

        Args:
            app: The inner ASGI app.
            allowed: Accepted host names, or ``("*",)`` for any.
        """
        self.app = app
        self.allowed = frozenset(a.lower() for a in allowed)
        self.any = "*" in self.allowed

    async def __call__(
        self, scope: Scope, receive: Receive, send: Send
    ) -> None:
        """Forwards the request if its ``Host`` is allowed."""
        if scope["type"] not in ("http", "websocket") or self.any:
            await self.app(scope, receive, send)
            return
        host = host_of(Headers(scope=scope).get("host"))
        if host is None or host not in self.allowed:
            response = JSONResponse({"error": "invalid host"}, status_code=400)
            await response(scope, receive, send)
            return
        await self.app(scope, receive, send)


def check_write(headers: Headers, token: str) -> str | None:
    """Checks the token and origin of a mutating request.

    Args:
        headers: The request headers.
        token: The per-process token from the boot block.

    Returns:
        ``None`` if the request may write, else the reason it may not.
    """
    given = headers.get(TOKEN_HEADER, "")
    if not hmac.compare_digest(given.encode(), token.encode()):
        return "missing or wrong token"
    origin = headers.get("origin")
    if not origin:
        return "missing Origin"
    scheme, sep, netloc = origin.partition("://")
    if not sep or scheme not in ("http", "https"):
        return "Origin does not match the host"
    if netloc.lower() != (headers.get("host") or "").lower():
        return "Origin does not match the host"
    return None
