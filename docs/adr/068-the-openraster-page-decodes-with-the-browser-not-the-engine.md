# ADR-068: The /openraster page decodes layer PNGs with the browser, not the engine, and reads the ZIP by hand
Date: 2026-09-24   Status: draft

## Context

The marketing site gains `/openraster` (`marketing/src/pages/OpenRaster.tsx`,
`components/OraViewer.tsx`, `lib/ora.ts`): an in-tab viewer that opens a
`.ora`, draws each layer and the composite, and sends nothing anywhere. A
`.ora` is a ZIP of layer PNGs plus `stack.xml`. The editor's importer
(`app/src/lib/openraster/import.ts:26-28`) decodes those PNGs with the engine's
wasm `decode_png_to_rgba` on purpose, so that import and export share one
codec. CLAUDE.md's invariant "the engine owns pixels" governs that app. The
question was whether the marketing page should inherit the same path.

Measured 09-24-2026, headless Chromium, 8 layers of 3000×2000 (60.4 MB of PNG):

| Decode path | Time |
|---|---|
| `createImageBitmap`, all layers in parallel | **377 ms** |
| `createImageBitmap`, one at a time | 1,477 ms |
| wasm `decode_png_to_rgba` | 1,977 ms, after a 354 KB gzipped download (init 20 ms) |

## Decision

- Layer PNGs are decoded by the browser's own `createImageBitmap`, all layers
  under one `Promise.all` (`ora.ts:264-272`), and composited with canvas 2D,
  mapping each OpenRaster `composite-op` to a `globalCompositeOperation`
  (`ora.ts:OPS`). Unknown ops draw as `source-over`.
- The ZIP reader is hand-written: stored entries plus deflate via
  `DecompressionStream("deflate-raw")` (`ora.ts:160`). The writer only stores.
  No `jszip`; the marketing package gains no dependency.
- This is a **conscious carve-out** from "the engine owns pixels." That
  invariant protects the editor, where pixels round-trip through the engine
  and the op log. The marketing site already draws with canvas 2D and three.js
  (CubeLetters, blog scenes) and shares no pixel data with the editor. The
  page's own chunk is 8.5 KB gzipped.

## Consequences

+ Layers appear in 377 ms instead of 1,977 ms, with no 354 KB download first.
+ The page stays in the marketing bundle's shape: no wasm, no `pkg/` import, no dependency added.
- **Two OpenRaster readers now exist** (`app/src/lib/openraster/import.ts` and `marketing/src/lib/ora.ts`). A quirk fixed in one is not fixed in the other, and the viewer can render a file the editor then refuses, or the reverse.
- The browser's compositor is not the engine's. Blend results on the page may differ by a rounding step from what the editor shows after import, and nothing checks this.
- A hand-written ZIP reader handles exactly two entry kinds. A `.ora` written with ZIP64, encryption, or a data-descriptor-only layout fails here where `jszip` would not.

## Alternatives rejected

1. **Ship `stamp_tool` to the marketing site.** 354 KB gzipped before a byte decodes, then 5.2× slower than the parallel browser path. The codec-sharing argument belongs to the editor, which writes the files; a viewer only reads them.
2. **Add `jszip`.** A `.ora` needs stored + deflate, which is ~100 lines and one platform API. A dependency for that is weight without a feature.

## Pre-mortem

It is six months later and this was a mistake. Most likely reason: the
editor's importer grows an OpenRaster rule (a `stack.xml` attribute, a
composite-op alias, a clipped-layer offset) and the page never learns it, so
the site's own viewer shows a file differently than the app it advertises.
Early warning sign to watch for: a bug report or QC note that a `.ora` "looks
right on /openraster but wrong after import," or the reverse. Grep
`OPS` in `marketing/src/lib/ora.ts` against the op names the engine's importer
accepts; the day they differ is the day this is owed.
