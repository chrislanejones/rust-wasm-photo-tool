Rust WASM Photo Tool

![Rust WASM Photo Tool](public/Rust-WASM-Photo-App.jpg)

**Live:** [rust-wasm-photo-tool.netlify.app](https://rust-wasm-photo-tool.netlify.app/) &nbsp;·&nbsp; [Architecture](Architecture.md)

A browser-based image annotation and editing tool powered by **Rust/WASM** for pixel-level operations and **React + TypeScript** for the UI.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser                                                        │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  React UI Shell (Framer Motion, Tailwind CSS)            │   │
│  │                                                          │   │
│  │  TopBar · ToolsSidebar · GalleryBar · HistoryPanel        │   │
│  │  UploadDialog · StatusBar · ShortcutModal                │   │
│  └────────────────────┬─────────────────────────────────────┘   │
│                       │ useCloneStamp hook                      │
│                       ▼                                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  stamp_tool.wasm  (single binary, ~80KB gzipped)         │   │
│  │                                                          │   │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────┐   │   │
│  │  │  core    │ │  stamp   │ │ transform │ │ filters  │   │   │
│  │  │ ImageBuf │ │ Brush    │ │ Flip/Rot  │ │ Bright   │   │   │
│  │  │ Bilinear │ │ Dab/Strk │ │ Copy/Pste │ │ Contrast │   │   │
│  │  └──────────┘ └──────────┘ └───────────┘ └──────────┘   │   │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────┐                │   │
│  │  │  codec   │ │ history  │ │ drawing   │ All share one  │   │
│  │  │ PNG enc  │ │ Undo/Redo│ │ Arrows    │ pixel buffer   │   │
│  │  │ Thumbnail│ │ Snapshot │ │ Shapes    │ in WASM linear │   │
│  │  └──────────┘ └──────────┘ └───────────┘ memory.        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  JPEG/WebP/AVIF export → browser canvas.toBlob()                │
│  PNG export → Rust `png` crate (lossless, no canvas needed)     │
└─────────────────────────────────────────────────────────────────┘
```

### Why one WASM binary?

Separate `.wasm` modules (image-core.wasm, filters.wasm, etc.) would require copying the full pixel buffer across WASM memory boundaries on every operation — a 3.2MB copy for a 896×896 image, per handoff. A single binary with Rust modules shares one `Vec<u8>` in linear memory. Zero-copy, zero overhead.

### Why browser codecs for JPEG/WebP/AVIF?

The `image` crate with all codec features adds ~800KB to the WASM binary. The browser's `canvas.toBlob()` already has hardware-accelerated JPEG, WebP, and AVIF encoders built in. Rust handles PNG encoding (lossless, needed for pixel-perfect export), and JS delegates the rest to the browser. Best of both worlds.

## Rust Module Map

```
stamp_tool/src/
├── lib.rs          #[wasm_bindgen] glue — CloneStampTool struct, delegates to modules
├── core.rs         ImageBuffer — width, height, data, load, bilinear sampling
├── history.rs      Snapshot, undo/redo stacks, push, jump, delete, labels
├── stamp.rs        Clone stamp engine — source, offset, stroke lifecycle, dab kernel
├── transform.rs    Flip H/V, rotate 90° CW/CCW, resize (bilinear), copy_region, paste_region
├── filters.rs      Brightness, contrast, blur (box-blur region, stroke-based)
├── drawing.rs      Arrow rendering (anti-aliased, arrowhead), geometric shapes (rect, circle, line)
└── codec.rs        PNG encoding, thumbnail generation with bilinear scaling
```

## Frontend Structure

```
app/src/
├── main.tsx                          Entry point
├── styles.css                        Design tokens + component styles
├── app/
│   ├── App.tsx                       Root
│   ├── AppShell.tsx                  Master orchestrator — state, panels, WASM bridge
│   └── useKeyboardShortcuts.ts       Centralized keyboard handler
├── hooks/
│   ├── useCloneStamp.ts              React hook wrapping the WASM CloneStampTool
│   ├── useBrushPreview.ts            Cursor preview overlay
│   ├── useDrawingTools.ts            Arrow and shape drawing via WASM drawing.rs
│   ├── useEmojiTool.ts               Emoji stamp — OffscreenCanvas → WASM stamp_pixels
│   ├── usePaintTool.ts               Freehand paint/brush — WASM paint_dab + paint_stroke_to
│   ├── useTextTool.ts                Text overlay — browser canvas renders font → WASM stamp_pixels
│   ├── useAutoCompress.ts            Auto-compress hook for resize workflow
│   └── stamp_tool.d.ts               TypeScript declarations for WASM interface
├── components/
│   ├── TopBar/                       Zoom, panel toggles, export dropdown, delete all
│   ├── StatusBar/                    Source status, shortcuts, dimensions, zoom %
│   └── ShortcutModal.tsx             Alt+/ keyboard reference overlay
├── features/
│   ├── canvas/
│   │   ├── CanvasArea.tsx            WASM canvas + brush cursor + source marker
│   │   ├── CompareSlider.tsx         Squoosh-style A/B before/after comparison slider
│   │   └── HistoryPanel.tsx          Animated right-side undo/redo timeline
│   ├── gallery/
│   │   ├── GalleryBar.tsx            Bottom photo strip with thumbnails
│   │   └── PhotoThumb.tsx            Individual thumbnail component
│   ├── tools/
│   │   ├── ToolsSidebar.tsx          Animated left sidebar with tool grid
│   │   ├── ToolGrid.tsx              Gradient icon buttons
│   │   ├── ToolButton.tsx            Individual tool button
│   │   ├── toolConfig.ts             Tool definitions (10 tools)
│   │   └── settings/
│   │       ├── StampSettings.tsx     Brush size, hardness, opacity, source indicator
│   │       ├── TransformSettings.tsx Flip, rotate, brightness, contrast
│   │       ├── ResizeSettings.tsx    Width/height, aspect lock, format, quality
│   │       ├── BlurSettings.tsx      Blur radius, brush size for region blur
│   │       ├── ArrowSettings.tsx     Arrow color, stroke width, head size
│   │       ├── ShapeSettings.tsx     Shape type, fill/stroke color, line width
│   │       ├── EmojiSettings.tsx     Emoji picker (@emoji-mart), size presets
│   │       ├── PaintSettings.tsx     Brush size presets, color palette, opacity
│   │       └── TextSettings.tsx      Font size presets, weight, color, recent-text memory
│   └── upload/
│       └── UploadDialog.tsx          Drag-and-drop + paste-from-clipboard upload modal
└── lib/
    ├── types.ts                      Shared type definitions
    ├── animations.ts                 Framer Motion spring variants
    ├── defaultToolSettings.ts        Default tool settings
    └── utils.ts                      cn() utility
```

## Keyboard Shortcuts

| Shortcut           | Action              |
| ------------------ | ------------------- |
| `Alt + U`          | Toggle Upload       |
| `Alt + S`          | Toggle Tools        |
| `Alt + G`          | Toggle Gallery      |
| `Alt + H`          | Toggle History      |
| `Alt + /`          | Show Shortcut Modal |
| `Ctrl + Z`         | Undo                |
| `Ctrl + Shift + Z` | Redo                |
| `Alt + E`          | Export              |
| `Alt + D`          | Delete All Images   |
| `Alt + [`          | Decrease Brush Size |
| `Alt + ]`          | Increase Brush Size |
| `Alt + Click`      | Set Clone Source    |
| `Alt + Scroll`     | Zoom In / Out       |

## Features

### Image Processing (Rust/WASM)

- **Clone Stamp** — Alt+Click source, paint to clone with adjustable size, hardness, opacity, spacing
- **Transforms** — Flip horizontal/vertical, rotate 90° CW/CCW
- **Resize** — Bilinear-scaled resize fully in WASM; no canvas round-trip
- **Filters** — Brightness (−100% to +100%), contrast (0% to 400%), box-blur with stroke-based region masking
- **Arrows** — Anti-aliased arrows with arrowhead, drawn directly on the pixel buffer via `drawing.rs`
- **Shapes** — Rectangles, circles, and lines rendered in WASM with configurable fill/stroke
- **Paint / Brush** — Freehand painting via WASM `paint_dab` + `paint_stroke_to`; configurable brush size, color, and opacity with interpolated strokes
- **Text** — Click-to-place text with configurable font size, weight, and color; browser renders the font, pixels composited into the buffer via `stamp_pixels()`; recent-text memory in sidebar
- **Emoji Stamp** — Browser renders emoji to `OffscreenCanvas`, pixels sent to WASM `stamp_pixels()` for alpha compositing
- **Export** — Lossless PNG via Rust encoder, JPEG/WebP/AVIF via browser
- **Thumbnails** — Bilinear-scaled thumbnails generated in WASM
- **Copy/Paste Regions** — Cross-photo pixel compositing with alpha blending; paste from clipboard supported
- **History** — 50-step undo/redo with labeled snapshots, jump-to, delete entry

### UI (React)

- **Animated Panels** — Staggered entrance: TopBar → Sidebar → Gallery (Framer Motion springs)
- **Tool Grid** — 10 tools with gradient icons: Clone Stamp, Resize, Crop, Paint, Text, Arrows, Shapes, Blur, Emoji, AI
- **A/B Compare Slider** — Squoosh-style draggable divider to compare before/after edits
- **Multi-photo Gallery** — Bottom strip with thumbnails, add/remove/switch
- **History Timeline** — Right-side panel with clickable undo/redo entries
- **Upload** — Drag-and-drop modal with file browser and paste-from-clipboard (Ctrl+V / paste button)
- **Export Dropdown** — PNG, JPEG, WebP, AVIF format selector in the top bar
- **Keyboard Hints** — Alt+/ shows badges on all buttons + shortcut reference modal
- **Dark Theme** — JetBrains Mono + DM Sans, dark palette with accent highlights

## Tech Stack

- **Rust** — WASM processing layer (`wasm-bindgen`, `png` crate)
- **React 19** — UI framework
- **TypeScript** — Type safety
- **Vite** — Build tool with WASM support
- **Tailwind CSS** — Utility styling
- **Framer Motion** — Panel animations
- **Lucide React** — Icons

## Getting Started

```bash
# Build the WASM module
cd stamp_tool
wasm-pack build --target web

# Install frontend dependencies
cd ../app
pnpm install

# Start development server
pnpm dev
```

## License

MIT
