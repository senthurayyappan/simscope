"""Serve a directory and pass /files and /api through to a simscope server.

The browser benchmark page must be same-origin with the library it reads
(`HttpSource` uses relative URLs), and `simscope serve` only serves its own
app, so this small proxy stands in front of it:

    uv run simscope serve /tmp/lib --port 8772 &
    python3 web/bench/devserver.py 8791 --up http://127.0.0.1:8772 --root .

then open http://127.0.0.1:8791/web/bench/crowd.html?run=big_4096
"""

import argparse
import functools
import http.server
import socketserver
import urllib.error
import urllib.request

_HOP_BY_HOP = ("transfer-encoding", "connection", "content-length")


class Handler(http.server.SimpleHTTPRequestHandler):
    """Static files, plus a pass-through for the simscope routes."""

    up = ""

    def do_GET(self) -> None:
        """Serves a file, or forwards /files and /api to the upstream."""
        if not self.path.startswith(("/files/", "/api/")):
            super().do_GET()
            return
        try:
            res = urllib.request.urlopen(self.up + self.path)
        except urllib.error.HTTPError as err:
            res = err
        body = res.read()
        self.send_response(res.code)
        for key, value in res.headers.items():
            if key.lower() not in _HOP_BY_HOP:
                self.send_header(key, value)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self) -> None:
        """Disables caching so a rebuilt bundle is always picked up."""
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, format: str, *args: object) -> None:  # noqa: A002
        """Keeps the console quiet."""


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    """A threaded HTTP server whose workers die with the process."""

    daemon_threads = True


def main() -> None:
    """Parses the command line and serves until interrupted."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("port", type=int)
    parser.add_argument("--up", required=True, help="the simscope server")
    parser.add_argument("--root", default=".", help="directory to serve")
    args = parser.parse_args()
    Handler.up = args.up
    handler = functools.partial(Handler, directory=args.root)
    Server(("127.0.0.1", args.port), handler).serve_forever()


if __name__ == "__main__":
    main()
