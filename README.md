Rust WASM Photo Tool

A browser-based image annotation and editing tool powered by **Rust/WASM** for pixel-level operations and **React + TypeScript** for the UI.

## Architecture

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
│  │  ┌──────────┐ ┌──────────┐                               │   │
│  │  │  codec   │ │ history  │  All share one pixel buffer   │   │
│  │  │ PNG enc  │ │ Undo/Redo│  in WASM linear memory.       │   │
│  │  │ Thumbnail│ │ Snapshot │  Zero-copy between modules.   │   │
│  │  └──────────┘ └──────────┘                               │   │
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
├── transform.rs    Flip H/V, rotate 90° CW, copy_region, paste_region
├── filters.rs      Brightness, contrast (future: blur, sharpen, HSL, curves)
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
│   └── stamp_tool.d.ts               TypeScript declarations for WASM interface
├── components/
│   ├── TopBar/                       Zoom, panel toggles, export dropdown, delete all
│   ├── StatusBar/                    Source status, shortcuts, dimensions, zoom %
│   └── ShortcutModal.tsx             Alt+/ keyboard reference overlay
├── features/
│   ├── canvas/
│   │   ├── CanvasArea.tsx            WASM canvas + brush cursor + source marker
│   │   └── HistoryPanel.tsx          Animated right-side undo/redo timeline
│   ├── gallery/
│   │   └── GalleryBar.tsx            Bottom photo strip with thumbnails
│   ├── tools/
│   │   ├── ToolsSidebar.tsx          Animated left sidebar with tool grid
│   │   ├── ToolGrid.tsx              4×2 gradient icon buttons
│   │   ├── ToolButton.tsx            Individual tool button
│   │   ├── toolConfig.ts             Tool definitions (8 tools)
│   │   └── settings/
│   │       ├── StampSettings.tsx     Brush size, hardness, opacity, source indicator
│   │       └── TransformSettings.tsx Flip, rotate, brightness, contrast
│   └── upload/
│       └── UploadDialog.tsx          Drag-and-drop upload modal
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
- **Transforms** — Flip horizontal/vertical, rotate 90° CW
- **Filters** — Brightness adjustment (−100% to +100%), contrast adjustment (0% to 400%)
- **Export** — Lossless PNG via Rust encoder, JPEG/WebP/AVIF via browser
- **Thumbnails** — Bilinear-scaled thumbnails generated in WASM
- **Copy/Paste Regions** — Cross-photo pixel compositing with alpha blending
- **History** — 50-step undo/redo with labeled snapshots, jump-to, delete entry

### UI (React)

- **Animated Panels** — Staggered entrance: TopBar → Sidebar → Gallery (Framer Motion springs)
- **Tool Grid** — 8 tools with gradient icons: Clone Stamp, Transform, Crop, Paint, Text, Arrows, Shapes, Blur
- **Multi-photo Gallery** — Bottom strip with thumbnails, add/remove/switch
- **History Timeline** — Right-side panel with clickable undo/redo entries
- **Upload** — Drag-and-drop modal with file browser
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
