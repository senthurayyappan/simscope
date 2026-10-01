"""The Starlette app and the ``serve`` entry point (contracts 2)."""

import contextlib
import logging
import pathlib
import secrets
from collections.abc import AsyncIterator, Sequence

import uvicorn
from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.requests import Request
from starlette.responses import Response
from starlette.routing import Route

from simscope.server import blocks, jobs, routes, security
from simscope.server import state as state_mod

logger = logging.getLogger(__name__)


def create_app(
    root: pathlib.Path | str,
    *,
    author: str | None = None,
    token: str | None = None,
    allowed_hosts: Sequence[str] | None = None,
    watch: bool = True,
    warm: bool = True,
) -> Starlette:
    """Builds the app that serves one library to the browser.

    The library is scanned before this returns. The file watcher and the
    highlight warmer start with the app's lifespan (``uvicorn`` runs it; a
    test client runs it inside ``with``).

    Args:
        root: The library folder.
        author: Author of annotations made through the API; the OS user name
            if ``None``.
        token: The token that writes must send in ``X-Simscope-Token``; a
            random one if ``None``. The page's boot block carries it.
        allowed_hosts: ``Host`` header values to accept (DNS-rebinding
            guard); loopback names by default.
        watch: Watch the folder for changes. Turn off to drive
            ``app.state.services.state.rescan()`` by hand.
        warm: Compute highlights of every run in the background.

    Returns:
        The ASGI app. Its services are on ``app.state.services``.

    Raises:
        FileNotFoundError: If ``root`` is not a directory.
    """
    path = pathlib.Path(root)
    if not path.is_dir():
        raise FileNotFoundError(f"no library folder at {path}")
    state = state_mod.LibraryState(
        path, author=author, token=token or secrets.token_urlsafe(24)
    )
    services = routes.Services(state, jobs.Jobs(state), blocks.BlockStore())

    @contextlib.asynccontextmanager
    async def lifespan(_app: Starlette) -> AsyncIterator[None]:
        state.start(watch=watch)
        if warm:
            services.jobs.start_warmer()
        try:
            yield
        finally:
            services.jobs.stop()
            services.blocks.close()
            state.stop()

    async def not_found(_request: Request, _exc: Exception) -> Response:
        return routes.error(404, "not found")

    async def not_allowed(_request: Request, _exc: Exception) -> Response:
        return routes.error(405, "method not allowed")

    app = Starlette(
        routes=[
            Route("/", routes.index),
            Route("/assets/{name}", routes.asset),
            Route("/api/library", routes.library_info),
            Route("/api/runs", routes.runs),
            Route("/api/changes", routes.changes),
            Route("/api/blk", routes.blk),
            Route("/api/blocks", routes.blocks_route),
            Route("/api/export", routes.export_route),
            Route("/api/groups", routes.groups, methods=["GET"]),
            Route("/api/groups", routes.change_groups, methods=["POST"]),
            Route(
                "/api/runs/{name}/annotations",
                routes.annotate,
                methods=["POST"],
            ),
            Route(
                "/api/runs/{name}/rename",
                routes.rename_run,
                methods=["POST"],
            ),
            Route("/files/{path:path}", routes.files),
        ],
        middleware=[
            Middleware(
                security.HostGuard,
                allowed=allowed_hosts or security.LOOPBACK_HOSTS,
            ),
        ],
        exception_handlers={404: not_found, 405: not_allowed},
        lifespan=lifespan,
    )
    app.state.services = services
    return app


def serve(
    root: pathlib.Path | str,
    host: str = "127.0.0.1",
    port: int = 8080,
    author: str | None = None,
    *,
    token: str | None = None,
) -> None:
    """Serves a library until interrupted.

    Binds ``host`` (loopback by default). A loopback bind answers only
    loopback ``Host`` headers, which stops DNS rebinding; a wildcard bind
    answers any.

    Args:
        root: The library folder.
        host: Address to listen on.
        port: Port to listen on (0 picks a free one).
        author: Author of annotations made through the API.
        token: The write token; random if ``None``.
    """
    app = create_app(
        root,
        author=author,
        token=token,
        allowed_hosts=security.allowed_hosts_for(host),
    )
    config = uvicorn.Config(
        app, host=host, port=port, log_level="warning", access_log=False
    )
    server = uvicorn.Server(config)
    server.run()
