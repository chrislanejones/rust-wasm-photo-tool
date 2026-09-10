#!/usr/bin/env python3
"""Static preview server that a browser cannot cache.

`vite preview` sends normal caching headers, so index.html can come back from
the browser's cache and load a bundle from a build you already replaced — the
stale-bundle trap. Content-hashed assets are safe on their own, but index.html
is the file that names them, so caching IT is what serves an old app.

Serving from a NEW PORT each rebuild also avoids the cache, but a new port is a
new ORIGIN: IndexedDB, localStorage and the whole gallery start empty. This
keeps one port (so the photos stay) and sends `no-store` on everything instead.

    python3 scripts/preview-nocache.py <dir> [port]
"""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, *args):  # quiet
        pass


def main() -> None:
    directory = sys.argv[1] if len(sys.argv) > 1 else "preview-dist"
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 4830
    handler = partial(NoCacheHandler, directory=directory)
    with ThreadingHTTPServer(("0.0.0.0", port), handler) as httpd:
        print(f"serving {directory} on http://localhost:{port}/  (no-store)", flush=True)
        httpd.serve_forever()


if __name__ == "__main__":
    main()
