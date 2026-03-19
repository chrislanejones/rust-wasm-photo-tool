# Architecture

Full system architecture diagram: [`app/src/ArchitectureDiagram.tsx`](app/src/ArchitectureDiagram.tsx)

---

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser                                                        │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  React UI Shell (Framer Motion, Tailwind CSS)            │   │
│  │                                                          │   │
│  │  TopBar · ToolsSidebar · GalleryBar · HistoryPanel       │   │
│  │  UploadDialog · StatusBar · ShortcutModal                │   │
│  └────────────────────┬─────────────────────────────────────┘   │
│                       │ hooks                                   │
│                       ▼                                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  stamp_tool.wasm  (single binary, ~80KB gzipped)         │   │
│  │                                                          │   │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────┐   │   │
│  │  │  core    │ │  stamp   │ │ transform │ │ filters  │   │   │
│  │  │ ImageBuf │ │ Brush    │ │ Flip/Rot  │ │ Bright   │   │   │
│  │  │ Bilinear │ │ Dab/Strk │ │ Copy/Pste │ │ Contrast │   │   │
│  │  └──────────┘ └──────────┘ └───────────┘ └──────────┘   │   │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────┐   │   │
│  │  │  codec   │ │ history  │ │ drawing   │ │  lib.rs  │   │   │
│  │  │ PNG enc  │ │ Undo/Redo│ │ Arrows    │ │  Paint   │   │   │
│  │  │ Thumbnail│ │ Snapshot │ │ Shapes    │ │  Text    │   │   │
│  │  └──────────┘ └──────────┘ └───────────┘ └──────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  JPEG/WebP/AVIF export → browser canvas.toBlob()               │
│  PNG export → Rust `png` crate (lossless, no canvas needed)    │
└─────────────────────────────────────────────────────────────────┘
```

## Rust Module Map

| File | Responsibility |
|------|---------------|
| `lib.rs` | `#[wasm_bindgen]` glue — `CloneStampTool` struct, paint/text entry points |
| `core.rs` | `ImageBuffer` — width, height, data, load, bilinear sampling |
| `history.rs` | Snapshot, undo/redo stacks, push, jump, delete, labels |
| `stamp.rs` | Clone stamp engine — source, offset, stroke lifecycle, dab kernel |
| `transform.rs` | Flip H/V, rotate 90° CW/CCW, resize (bilinear), copy_region, paste_region |
| `filters.rs` | Brightness, contrast, blur (box-blur region, stroke-based) |
| `drawing.rs` | Arrow rendering (anti-aliased, arrowhead), geometric shapes (rect, circle, line) |
| `codec.rs` | PNG encoding, thumbnail generation with bilinear scaling |

## React Hook Map

| Hook | Bridges to |
|------|-----------|
| `useCloneStamp.ts` | WASM `CloneStampTool` — core lifecycle, undo/redo, canvas flush |
| `useDrawingTools.ts` | WASM `drawing.rs` — arrow and shape rendering |
| `usePaintTool.ts` | WASM `paint_dab` + `paint_stroke_to` — freehand brush |
| `useTextTool.ts` | Browser canvas font render → WASM `stamp_pixels` |
| `useEmojiTool.ts` | `OffscreenCanvas` emoji render → WASM `stamp_pixels` |
| `useBrushPreview.ts` | Cursor overlay (pure JS/DOM) |
| `useAutoCompress.ts` | Auto-compress on resize workflow |

## Data Flow

```
User gesture
    │
    ▼
React event handler (hook)
    │
    ├─ JS-only ops (emoji render, text render, preview drawing)
    │       │
    │       └─ browser OffscreenCanvas / 2D context
    │
    └─ WASM ops (stamp, paint, draw, transform, filter)
            │
            └─ Rust mutates Vec<u8> in linear memory (zero-copy)
                    │
                    ▼
            putImageData() → canvas → screen
```

## Single Binary Design

Separate `.wasm` modules would require copying the full pixel buffer across WASM memory boundaries on every operation — a 3.2 MB copy for an 896×896 image, per handoff. A single binary with Rust modules shares one `Vec<u8>` in linear memory: zero-copy, zero overhead.

## Codec Split

The `image` crate with all codec features adds ~800 KB to the WASM binary. The browser's `canvas.toBlob()` already has hardware-accelerated JPEG, WebP, and AVIF encoders. Rust handles PNG (lossless, pixel-perfect), JS delegates the rest to the browser.
