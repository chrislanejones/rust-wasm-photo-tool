# OpenRaster (.ora) Export / Import — Plan

> Part of the [Image Horse](../README.md) docs. See also: [Architecture](Architecture.md) · [File Map](File-Map.md).
>
> **Status: planning only — not implemented.** Today there is a disabled **"Export as .ora"** button in the Settings → Export tab (`app/src/components/ExportPane.tsx`); the serializer does not exist yet. This note is the actionable plan, grounded in the *real* Rust layer API.

## Why .ora

[OpenRaster](https://www.openraster.org/) (`.ora`) is an open, layered-image interchange format (a ZIP of PNGs + an XML manifest) read/written by Krita, GIMP, MyPaint, and others. Exporting it lets users round-trip Image Horse's **layer stack** into a desktop editor and back — far more useful than a flattened PNG/JPEG.

## The Rust building blocks (already exist)

The WASM engine already exposes everything export needs, and the restore path import needs:

| Need | Method | Where |
| --- | --- | --- |
| Layer count | `layer_count() -> usize` | `src/layer.rs:556` |
| Layer metadata (JSON) | `get_layers() -> String` → `[{id,name,visible,opacity,active,hasMask}]` | `src/layer.rs:562` |
| One layer's pixels as PNG | `get_layer_png(index) -> Vec<u8>` | `src/layer.rs:911` |
| Per-layer live annotations (JSON) | `get_layer_text_annotations(i)` / `get_layer_shape_annotations(i)` | `src/layer.rs:919,927` |
| Flatten text annotations into pixels | `flatten_text_annotations()` | `src/annotations.rs:1388` |
| Full flattened composite | `export_png() -> Vec<u8>` | `src/lib.rs:981` |
| Begin a rebuild | `begin_layer_restore()` | `src/layer.rs:937` |
| Push one restored layer | `push_restored_layer(pixels: &[u8], w: u32, h: u32, name: &str, visible: bool, opacity: f64) -> u32` | `src/layer.rs:951` |
| Commit the rebuilt stack | `finish_layer_restore(active_index: usize)` | `src/layer.rs:1061` |

`JSZip` is already a dependency (used for batch ZIP export), so no new dep is needed.

## The .ora archive layout

```
mimetype                 // first entry, STORED (uncompressed): "image/openraster"
stack.xml                // the layer manifest (bottom-to-top)
data/layer0.png          // one PNG per layer
data/layer1.png
…
mergedimage.png          // full-canvas flattened composite (spec-required for viewers)
Thumbnails/thumbnail.png // ≤256×256 preview (optional but expected)
```

`stack.xml` (bottom layer first):

```xml
<?xml version='1.0' encoding='UTF-8'?>
<image w="1920" h="1080" version="0.0.3">
  <stack>
    <layer name="Background" src="data/layer0.png" x="0" y="0" opacity="1.0" visibility="visible"/>
    <layer name="Logo"       src="data/layer1.png" x="0" y="0" opacity="0.8" visibility="visible"/>
  </stack>
</image>
```

> **Order gotcha:** `get_layers()` returns the stack in the engine's order; `.ora` `<stack>` lists **top layer first** in the XML but PNG indices are conventionally numbered bottom-up. Pick one convention and keep export/import symmetric — round-trip a 3-layer file as the test.

## Phase 1 — Export (start here, easier)

1. New module `app/src/lib/openraster/export.ts`.
2. `const n = tool.layer_count();` then for `i in 0..n`: `tool.get_layer_png(i)` → `data/layer{i}.png`.
3. Parse `tool.get_layers()` JSON for each layer's `name` / `opacity` / `visible`; build `stack.xml` (with `w`/`h` from the tool dimensions).
4. `tool.export_png()` → `mergedimage.png`; downscale it for `Thumbnails/thumbnail.png`.
5. Assemble with JSZip — **`mimetype` must be the first entry and STORED (`{ compression: "STORE" }`)**, the rest `DEFLATE`. Trigger the download.
6. **Annotations (v1):** call `tool.flatten_text_annotations()` (and the shape equivalent when it lands) **before** step 2 so live text/shapes bake into the layer pixels. Simple, lossy, correct-looking.

## Phase 2 — Import

1. New module `app/src/lib/openraster/import.ts`.
2. JSZip-load the file; **validate `mimetype` === `image/openraster`**.
3. Parse `stack.xml` → ordered list of `{ name, src, opacity, visibility }`.
4. `tool.begin_layer_restore();` then for each layer **in bottom-to-top order**: decode its PNG to RGBA pixels (canvas or WASM), then `tool.push_restored_layer(pixels, w, h, name, visible, opacity)`.
5. `tool.finish_layer_restore(activeIndex)` (the layer marked active, else the top).
6. Refresh the React layer panel + canvas from `get_layers()` / the composite. (v1: ignore any annotation namespace; show a notice if unknown extensions are present.)

## Phase 3 — Advanced (later)

- **Layer masks** — `<layer>` supports a `mask` attribute / `<mask>` element; pair with the engine's `has_layer_mask` / mask add-remove-apply API (`src/layer.rs`).
- **Lossless annotations** — instead of flattening, write the `get_layer_text_annotations(i)` / `get_layer_shape_annotations(i)` JSON into a custom namespaced element in `stack.xml` (e.g. `<imagehorse:annotations>`); other apps ignore it, we round-trip it. Re-inject on import via the existing annotation restore path.
- **Nested groups** — `<stack>` inside `<stack>`. Defer until the engine models layer groups.

## File structure

```
app/src/lib/openraster/
├── index.ts      // exportOra(tool) / importOra(file, tool)
├── export.ts     // build the archive
├── import.ts     // read + rebuild the stack
├── stackXml.ts   // build + parse stack.xml
└── types.ts      // OraLayer metadata
```

## Challenges & solutions

| Challenge | Solution |
| --- | --- |
| Text & shape annotations | Flatten on export for v1; custom namespace round-trip later |
| Layer masks | `<mask>` element ↔ engine mask API (Phase 3) |
| Many layers | Pixel work already in Rust (`get_layer_png` / `push_restored_layer`) — JS only zips |
| `mimetype` handling | Must be first + STORED, or viewers reject the file |
| Stack order | Round-trip a 3-layer file as the regression test |
| Round-trip fidelity | Start flat + simple; add masks/annotations iteratively |

## v1 recommendation

**Export:** all layers as PNG + `stack.xml` (name/opacity/visibility) + `mergedimage.png` + thumbnail; flatten annotations first.
**Import:** rebuild via `begin/push_restored_layer/finish_layer_restore`, restoring name/opacity/visibility; ignore unknown extensions (with a notice).

Ships a genuinely useful interop feature without over-engineering. This is a **supervised build** (user-facing, touches the layer system) — verify a 3-layer round-trip in-browser before enabling the `ExportPane` button.
