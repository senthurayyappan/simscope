"""The simscope viewer server: Starlette over a library directory.

``create_app(root, author=...)`` builds the ASGI app and ``serve`` runs it
with uvicorn. The routes read the library folder on disk.
"""

from simscope.server.app import create_app, serve

__all__ = ["create_app", "serve"]
