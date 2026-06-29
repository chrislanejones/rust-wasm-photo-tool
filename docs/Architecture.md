# Architecture

> Part of the [Image Horse](../README.md) docs. See also: [File Map](File-Map.md) · [Change Summary](Change-summary.md).

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser                                                        │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  React UI Shell (Framer Motion, Tailwind CSS)            │   │
│  │                                                          │   │
│  │  TopBar · ToolsSidebar · GalleryBar · ReviewPanel         │   │
│  │  UploadDialog · StatusBar · ShortcutModal                │   │
│  └────────────────────┬─────────────────────────────────────┘   │
│                       │ useCloneStamp / useImageHorse hook      │
│                       ▼                                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  stamp_tool.wasm  (ImageHorseTool, ~80KB gzipped)        │   │
│  │                                                          │   │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────┐   │   │
│  │  │  core    │ │  layer   │ │   paint   │ │ effects  │   │   │
│  │  │ ImageBuf │ │ Stack &  │ │ Brush/Era │ │ Blur/Pix │   │   │
│  │  │ Bilinear │ │ Composit │ │ Mask/Stab │ │ Redact   │   │   │
│  │  └──────────┘ └──────────┘ └───────────┘ └──────────┘   │   │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────┐   │   │
│  │  │  annot   │ │  select  │ │   stamp   │ │ transfrm │   │   │
│  │  │ Text &   │ │ Magic-   │ │ Clone Br  │ │ Flip/Rot │   │   │
│  │  │ Shapes   │ │ Wand     │ │ Dab/Strok │ │ Resize   │   │   │
│  │  └──────────┘ └──────────┘ └───────────┘ └──────────┘   │   │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────┐   │   │
│  │  │ filters  │ │ drawing  │ │   text    │ │ codec/   │   │   │
│  │  │ Bright/  │ │ Arrows/  │ │ Fonts/    │ │ history  │   │   │
│  │  │ Contrast │ │ Shapes   │ │ Bezier    │ │ Undo/PNG │   │   │
│  │  └──────────┘ └──────────┘ └───────────┘ └──────────┘   │   │
│  │  utils · shared leaf helpers — all share one pixel buffer│   │
│  └──────────────────────────────────────────────────────────┘   │
│                       │                                         │
│                       ▼                                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Convex (persistent layer)                               │   │
│  │                                                          │   │
│  │  userProfiles · projects · images · layers               │   │
│  │  annotations · history · ai_jobs · subscriptions         │   │
│  │                                                          │   │
│  │  Auth via @convex-dev/auth (Clerk)                       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Originals → IndexedDB (SHA-256 keyed, content-addressed)       │
│  Working copies downscaled to ≤2048px long edge on upload       │
│  JPEG/WebP/AVIF export → browser canvas.toBlob()                │
│  PNG export → Rust `png` crate (lossless, no canvas needed)     │
└─────────────────────────────────────────────────────────────────┘
```

### Layers & compositing

As of v3.5 the WASM core is no longer a single pixel buffer — `ImageHorseTool` holds a **stack of layers** (`Vec<Layer>`) plus an active-layer index. Each `Layer` owns its own RGBA buffer **and** its own live text + shape annotations, so every canvas tool (paint, clone stamp, blur, brightness/contrast, text, shapes, emoji, paste) edits the **active layer**. The on-screen canvas is the **composite** of all visible layers, blended bottom→top source-over and scaled by each layer's opacity (normal blending; v3.5 is opacity + visibility only).

A reusable `composite_cache` is rebuilt by `recomposite()` and exposed through `data_ptr()/data_len()` for the zero-copy blit; a fast path copies straight through when there's a single fully-opaque layer with no overlays (so simple single-layer edits stay allocation-free). `export_png`, `get_image_data`, and the thumbnail path all composite the full stack, so export always matches what's on screen. History snapshots capture the **entire stack** (layers + active index + dimensions), making add / delete / reorder / merge undoable alongside pixel edits.

### Why one WASM binary?

Separate `.wasm` modules (image-core.wasm, filters.wasm, etc.) would require copying the full pixel buffer across WASM memory boundaries on every operation — a 3.2MB copy for a 896×896 image, per handoff. A single binary with Rust modules shares one `Vec<u8>` in linear memory. Zero-copy, zero overhead.

### Why browser codecs for JPEG/WebP/AVIF?

The `image` crate with all codec features adds ~800KB to the WASM binary. The browser's `canvas.toBlob()` already has hardware-accelerated JPEG, WebP, and AVIF encoders built in. Rust handles PNG encoding (lossless, needed for pixel-perfect export), and JS delegates the rest to the browser. Best of both worlds.

### Rust ↔ Convex Bridge

**Principle**: WASM processes pixels locally (fast, zero-latency). Convex stores metadata, persistent history, and project state. React hooks bridge both.

- **Image Change History** — Every WASM operation that pushes an undo snapshot also records to Convex via `useConvexHistory.recordAction()`. Session-local undo/redo is instant (WASM memory); Convex gives a persistent, queryable audit trail.
- **Annotations** — On committing arrows/shapes/text, annotation metadata (geometry, color, timestamp) is saved to the Convex `annotations` table, enabling cross-session recovery and future collaboration.
- **AI Jobs Pipeline** — UI triggers → `api.ai_jobs.create(...)` → Convex action calls Replicate → webhook updates status → `useQuery` auto-updates UI → result loaded into WASM buffer.
