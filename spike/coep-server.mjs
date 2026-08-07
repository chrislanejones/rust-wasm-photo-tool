// Phase 1 — serve the PRODUCTION build with cross-origin isolation on, so we
// can enumerate what breaks under COOP/COEP before anyone commits to needing
// SharedArrayBuffer. Local only; nothing here goes near netlify.toml.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const ROOT = process.argv[2] || ".";
const PORT = Number(process.argv[3] || 5402);

const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css", ".wasm": "application/wasm", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp",
  ".jpg": "image/jpeg", ".ico": "image/x-icon", ".woff2": "font/woff2",
};

createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  let p = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  if (p === "/" || !extname(p)) p = "/index.html"; // SPA fallback
  try {
    const body = await readFile(join(ROOT, p));
    res.writeHead(200, {
      "Content-Type": TYPES[extname(p)] || "application/octet-stream",
      // The two headers under test.
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
      // Own assets must be embeddable under require-corp.
      "Cross-Origin-Resource-Policy": "same-origin",
    });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
}).listen(PORT, "127.0.0.1", () => {
  console.log(`COEP preview on http://127.0.0.1:${PORT} (root: ${ROOT})`);
});
