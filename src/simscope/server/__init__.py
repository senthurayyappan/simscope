"""The simscope viewer server: Starlette over a library directory.

``create_app(root, author=...)`` builds the ASGI app and ``serve`` runs it
with uvicorn. The HTTP API is specified in the viewer v3 contracts (section
2); the files behind it are the library layout of the format spec.
"""

from simscope.server.app import create_app, serve

__all__ = ["create_app", "serve"]
