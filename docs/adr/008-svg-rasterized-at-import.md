# ADR-008: SVG imports are rasterized to PNG at the import boundary
Date: 2026-07-07   Status: draft

## Context
SVG imports failed twice over: Chrome's `createImageBitmap()` (both
decode funnels) cannot decode SVG blobs, and the security stance
(`lib/security/imageFirewall.ts`) rejects raw SVG outright because it
can carry `<script>`/`onload`/`foreignObject`. Users still drop SVGs
(icons, maps, logos) and expect them to open.

## Decision
Convert SVG → PNG at the two import funnels (`openImportDialog`,
`handleAddPhotos`) via `lib/rasterizeSvg.ts`: load into an `<img>`
(scripts never execute in that context), draw to a canvas, keep only
the pixels. Raster size = intrinsic size clamped to a 1024–4096 long
side (2048 fallback via viewBox aspect). The SVG bytes are discarded
— the gallery "original" in IndexedDB is the PNG.

## Consequences
+ SVGs work in every entry path (drop, paste, browse) with zero new
  dependencies, and the "never store/render live SVG" rule holds.
- Vector fidelity is lost at import: re-rasterizing at a bigger size
  later is impossible; a 959×593 map is forever ≤4096px.
- The stored "original" is not the user's original file — EXIF-style
  fidelity expectations don't apply, and re-export returns a PNG.

## Alternatives rejected
- Store the SVG and rasterize on every load — keeps vector fidelity
  but persists untrusted markup, exactly what the firewall forbids.
- SVG sanitizer (DOMPurify) + live rendering — new dependency, large
  attack surface for one format, and the engine is raster-only anyway.

## Pre-mortem
It is six months later and this decision was a mistake. Most likely
reason: users import logo/icon SVGs expecting crisp scaling on large
canvases, and the fixed-size rasterization makes Image Horse look
blurry next to tools that keep vectors live; support asks "why is my
logo fuzzy" keep coming.
Early warning sign to watch for: feature requests to "re-import at
higher resolution" or complaints about blurry SVG exports.
