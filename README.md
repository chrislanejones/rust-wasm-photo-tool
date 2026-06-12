Image Horse

![Image Horse](public/Rust-WASM-Photo-App.jpg)

**Live:** [rust-wasm-photo-tool.netlify.app](https://rust-wasm-photo-tool.netlify.app/) &nbsp;·&nbsp; [Architecture](Architecture.md)

A browser-based image annotation and editing tool powered by **Rust/WASM** for pixel-level operations, **React + TypeScript** for the UI, and **Convex** for persistent storage. Edits run locally in WebAssembly — your pixels never leave the tab unless you sign in for persistence or AI features. Includes a **Batch Image Editor** for applying a logo to many photos in one pass, with a grid mosaic view of the gallery.

> Previously called **Clone Stamp App** — the app grew well beyond its origins as a single clone stamp tool.

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
│                       │ useCloneStamp / useImageHorse hook      │
│                       ▼                                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  stamp_tool.wasm  (ImageHorseTool, ~80KB gzipped)        │   │
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

### Why one WASM binary?

Separate `.wasm` modules (image-core.wasm, filters.wasm, etc.) would require copying the full pixel buffer across WASM memory boundaries on every operation — a 3.2MB copy for a 896×896 image, per handoff. A single binary with Rust modules shares one `Vec<u8>` in linear memory. Zero-copy, zero overhead.

### Why browser codecs for JPEG/WebP/AVIF?

The `image` crate with all codec features adds ~800KB to the WASM binary. The browser's `canvas.toBlob()` already has hardware-accelerated JPEG, WebP, and AVIF encoders built in. Rust handles PNG encoding (lossless, needed for pixel-perfect export), and JS delegates the rest to the browser. Best of both worlds.

### Rust ↔ Convex Bridge

**Principle**: WASM processes pixels locally (fast, zero-latency). Convex stores metadata, persistent history, and project state. React hooks bridge both.

- **Image Change History** — Every WASM operation that pushes an undo snapshot also records to Convex via `useConvexHistory.recordAction()`. Session-local undo/redo is instant (WASM memory); Convex gives a persistent, queryable audit trail.
- **Annotations** — On committing arrows/shapes/text, annotation metadata (geometry, color, timestamp) is saved to the Convex `annotations` table, enabling cross-session recovery and future collaboration.
- **AI Jobs Pipeline** — UI triggers → `api.ai_jobs.create(...)` → Convex action calls Replicate → webhook updates status → `useQuery` auto-updates UI → result loaded into WASM buffer.

## Rust Module Map

```
src/
├── lib.rs          #[wasm_bindgen] glue — ImageHorseTool struct (was CloneStampTool),
│                   delegates to modules; get_pixel(x,y) and get_pixel_region(cx,cy,radius)
├── core.rs         ImageBuffer — width, height, data, load, bilinear sampling;
│                   zero-size guard: sample_bilinear returns [0,0,0,0] when buffer is empty
├── history.rs      Snapshot (data + dimensions), undo/redo stacks, push, jump, delete, labels;
│                   pub const MAX_HISTORY = 50 (single source of truth)
├── stamp.rs        Clone stamp engine — source, offset, stroke lifecycle, dab kernel;
│                   stroke_src_data frozen buffer prevents feedback artifacts
├── transform.rs    Flip H/V, rotate 90° CW/CCW, resize (bilinear), copy_region, paste_region,
│                   crop overlay compositing, dashed border drawing
├── filters.rs      Brightness, contrast, Gaussian blur (separable 2-pass, bounding-box region)
├── drawing.rs      Arrow rendering (anti-aliased, arrowhead), geometric shapes (rect, circle, line,
│                   hand-drawn circle)
├── text.rs         Liberation Sans font embedded at compile time; renders text → pixel buffer
└── codec.rs        PNG encoding, thumbnail generation with bilinear scaling;
                    history snapshot serialization (get/inject undo/redo PNG blobs)
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
│   ├── useCloneStamp.ts              React hook wrapping the WASM ImageHorseTool; includes
│   │                                 loadImage(), loadImageFromPixels() (pre-decoded, 2048-capped),
│   │                                 and loadFromSaved() for restoring per-photo IDB sessions
│   ├── useBrushPreview.ts            Cursor preview overlay
│   ├── useDrawingTools.ts            Arrow/shape drawing + crop selection (SVG overlay)
│   ├── useEmojiTool.ts               Emoji stamp — OffscreenCanvas → WASM stamp_pixels
│   ├── usePaintTool.ts               Freehand paint/brush — WASM paint_dab + paint_stroke_to
│   ├── useColorPicker.ts             Color picker eyedropper — WASM get_pixel / get_pixel_region;
│   │                                 returns magnifier pixel grid + center hex color on mouse move
│   ├── UseBlurTool.ts                Blur brush — WASM gaussian_blur_region per dab
│   ├── useTextTool.ts                Text overlay — browser canvas renders font → WASM stamp_pixels;
│   │                                 tracks last position for recent-text re-edit
│   ├── useTextExtract.ts             Drag-to-OCR — Tesseract.js reads selected canvas region
│   ├── useRedStampTool.ts            Red stamp presets — OffscreenCanvas renders label →
│   │                                 WASM stamp_red (scales to brush size, "Red Stamp" history)
│   ├── useStoreUser.ts               Syncs Clerk user into Convex users table on sign-in
│   ├── useConvexHistory.ts           Convex history bridge (stub, ready for connection)
│   ├── useAutoCompress.ts            Auto-compress hook for resize workflow
│   └── stamp_tool.d.ts               TypeScript declarations for WASM interface
├── components/
│   ├── TopBar/                       Zoom, panel toggles, export dropdown, delete all
│   ├── StatusBar/                    Source status, shortcuts (incl. Ctrl+Shift+Z redo), dimensions, zoom %
│   ├── TabGroup.tsx                  Reusable tab switcher (Stamp, Effects, Brush, future panels)
│   ├── MagnifierOverlay.tsx          Floating 11×11 pixel magnifier for color picker eyedropper;
│   │                                 pixel grid sourced from WASM get_pixel_region, center hex shown
│   ├── UserMenu.tsx                  Convex/Clerk user menu
│   ├── ConvexClerkProvider.tsx       Auth provider wrapper
│   └── ShortcutModal.tsx             Alt+Shift+? keyboard reference overlay
├── features/
│   ├── canvas/
│   │   ├── CanvasArea.tsx            WASM canvas + brush cursor + SVG crop overlay with
│   │   │                             rule-of-thirds guides and 8 draggable resize handles
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
│   │       ├── StampSettings.tsx     3-tab: Clone Stamp (size/hardness/opacity) +
│   │       │                         Stamps (red-stamp presets) + Emojis (full picker + size)
│   │       ├── TransformCropSettings.tsx  Flip, rotate; crop apply button
│   │       ├── ResizeSettings.tsx    Width/height, aspect lock, format, quality, A/B compare,
│   │       │                         auto-compress, lighthouse score
│   │       ├── EffectsSettings.tsx   Tab-switched: Levels (brightness/contrast sliders) +
│   │       │                         Color Picker (eyedropper, activates magnifier overlay)
│   │       ├── ArrowSettings.tsx     Coming-soon panel (FileText icon); content moved to
│   │       │                         ShapeSettings Arrows tab
│   │       ├── ShapeSettings.tsx     2-tab: Shapes (4 buttons styled like Transform panel,
│   │       │                         lucide icons, stroke/color) + Arrows (stroke, style, color);
│   │       │                         shapesMode lifted to AppShell for correct canvas routing
│   │       ├── BatchSettings.tsx     Coming-soon panel for Images toolbar tool (batch icon stamp)
│   │       ├── PaintSettings.tsx     Tab-switched: Paint (size/color/opacity) +
│   │       │                         Blur Brush (radius, intensity) — both route canvas events
│   │       └── TextSettings.tsx      Font family (12 browser-safe fonts), size, weight, color;
│   │                                 up to 8 recent texts (click to re-open canvas box at last
│   │                                 position, restoring all settings including font)
│   └── upload/
│       └── UploadDialog.tsx          Drag-and-drop + paste-from-clipboard upload modal
└── lib/
    ├── types.ts                      Shared type definitions
    ├── animations.ts                 Framer Motion spring variants
    ├── defaultToolSettings.ts        Default tool settings
    ├── colors.ts                     Color utility helpers
    ├── editPersistence.ts            Per-photo edit persistence via IndexedDB — saves full
    │                                 canvas state + undo/redo history (PNG-encoded) so switching
    │                                 between photos preserves all edits and history steps
    ├── originalsStore.ts             Content-addressed IndexedDB store for original photo bytes;
    │                                 keyed by SHA-256 hex via crypto.subtle; putOriginal /
    │                                 getOriginal / getOriginalAsBlobUrl / deleteOriginal
    ├── workingCopy.ts                makeWorkingCopy() — decodes + downscales to ≤2048px long
    │                                 edge via createImageBitmap (high-quality); makeThumbnail()
    │                                 produces 256px WebP blobs for the gallery strip
    └── utils.ts                      cn() utility
```

## Keyboard Shortcuts

| Shortcut              | Action                              |
| --------------------- | ----------------------------------- |
| `1` – `0`             | Switch tools (Resize→…→Clone→Emoji) |
| `Alt + U`             | Toggle Upload                       |
| `Alt + S`             | Toggle Tools                        |
| `Alt + G`             | Toggle Gallery                      |
| `Alt + H`             | Toggle History                      |
| `Alt + Shift + ?`     | Toggle Shortcut Modal               |
| `Ctrl + Z`            | Undo                                |
| `Ctrl + Shift + Z`    | Redo                                |
| `Alt + E`             | Export current image                |
| `Alt + Shift + E`     | Export all images (ZIP)             |
| `Alt + D`             | Delete All Images                   |
| `Alt + F`             | Flip Horizontal                     |
| `Alt + V`             | Flip Vertical                       |
| `Alt + R`             | Rotate 90° CW                       |
| `Alt + [`             | Decrease Brush Size                 |
| `Alt + ]`             | Increase Brush Size                 |
| `Alt + Click`         | Set Clone Source                    |
| `Alt + Scroll`        | Zoom In / Out                       |
| `Alt + =` / `Alt + -` | Zoom In / Out                       |
| `Alt + 0`             | Reset Zoom (100%)                   |
| `Space` (hold)        | Pan mode (grab to drag canvas)      |
| `PgUp / PgDn`         | Cycle gallery photos                |
| `Ctrl + Shift + C`    | Copy canvas to clipboard            |

## Features

### Image Processing (Rust/WASM)

- **Clone Stamp** — Alt+Click source, paint to clone with adjustable size, hardness, opacity, spacing
- **Red Stamps** — REJECTED / APPROVED / DRAFT / CONFIDENTIAL / UNDER REVIEW presets; JS renders label to OffscreenCanvas, Rust scales to brush size via bilinear resize and composites with "Red Stamp" history entry
- **Transforms** — Flip horizontal/vertical, rotate 90° CW/CCW
- **Crop** — Interactive SVG overlay with rule-of-thirds guides and 8 draggable resize handles; crop committed through Rust
- **Resize** — Bilinear-scaled resize fully in WASM; no canvas round-trip
- **Levels** — Brightness (−100% to +100%), contrast (0% to 300%); each adjustment is a separate undo snapshot
- **Color Picker** — Eyedropper activates on Effects → Color Picker tab; hovering the canvas shows a floating 11×11 magnifier (sourced from Rust `get_pixel_region`); clicking picks the pixel color and sets it as both brush and text color
- **Blur Brush** — Box-blur with stroke-based region masking; configurable radius and intensity; now lives in the Brush tool's "Blur Brush" tab
- **Arrows** — Anti-aliased arrows with arrowhead (single or double), drawn directly on the pixel buffer; accessible from the Arrows sub-tab inside the Shapes tool
- **Shapes** — Rectangles, circles, hand-drawn circles, and lines rendered in WASM; Shapes tool has a Shapes/Arrows tab switcher at the top
- **Paint / Brush** — Freehand painting via WASM `paint_dab` + `paint_stroke_to`; configurable brush size, color, and opacity; tab-switched with Blur Brush in the same panel
- **Text** — Click-to-place text with configurable font family (12 browser-safe options), size, weight, and color; up to 8 recent texts that re-open the canvas text box at the last used position, restoring all text settings
- **Emoji Stamp** — Browser renders emoji to `OffscreenCanvas`, pixels sent to WASM `stamp_pixels()` for alpha compositing; emoji picker lives in the Stamp tool's Emojis tab
- **Export** — Lossless PNG via Rust encoder, JPEG/WebP/AVIF via browser
- **Thumbnails** — 256px WebP thumbnails generated from the original file via `createImageBitmap` on upload; working canvas stays at ≤2048px
- **Copy/Paste Regions** — Cross-photo pixel compositing with alpha blending; paste from clipboard supported
- **History** — 50-step undo/redo with labeled snapshots (including dimensions for crop/resize/rotate correctness), jump-to, delete entry
- **Per-photo Edit Persistence** — Switching photos saves the full WASM canvas + undo/redo stack to IndexedDB (PNG-encoded per snapshot). Switching back restores the exact edit session — same canvas state, same undo history, all redo steps intact

### UI (React)

- **Animated Panels** — Staggered entrance: TopBar → Sidebar → Gallery (Framer Motion springs)
- **Tool Grid** — 10 tools with gradient icons: Clone Stamp, Resize, Crop, Paint, Text, Arrows (FileText — coming soon), Shapes, Effects (Sparkles), **Batch Image Editor** (bulk logo stamp + grid mosaic view), AI (Brain)
- **Tab Switchers** — Stamp (Clone / Stamps / Emojis), Shapes (Shapes / Arrows), Paint (Paint / Blur Brush), Effects (Levels / Color Picker) via shared `TabGroup` component
- **Spacebar Pan** — Hold Space for grab-to-pan; all tool handlers bypassed during pan
- **A/B Compare Slider** — Squoosh-style draggable divider; overlay is positioned exactly over the canvas bounding box (tracks zoom/pan via ResizeObserver) so before/after layers are always pixel-aligned
- **Multi-photo Gallery** — Bottom strip with thumbnails, add/remove/switch; PgUp/PgDn cycling; originals preserved in IndexedDB at full resolution regardless of working-copy downscale
- **History Timeline** — Right-side panel with clickable undo/redo entries
- **Upload** — Drag-and-drop modal with file browser and paste-from-clipboard (Ctrl+V / paste button)
- **Export Dropdown** — PNG, JPEG, WebP, AVIF format selector in the top bar
- **Keyboard Shortcut Modal** — Alt+Shift+? opens a full reference overlay grouped by category
- **AI Panel** — Placeholder cards for: Remove Background (rembg), 4× Upscale (Real-ESRGAN), Object Removal (SD Inpaint), Auto Alt Text (BLIP), Smart Crop, Auto-Enhance — wired to Convex `ai_jobs` + Replicate when ready
- **Dark Theme** — JetBrains Mono + DM Sans, dark palette with accent highlights

## Tech Stack

- **Rust** — WASM processing layer (`wasm-bindgen`, `png` crate)
- **React 19** — UI framework
- **TypeScript** — Type safety
- **Vite** — Build tool with WASM support
- **Tailwind CSS** — Utility styling
- **Framer Motion** — Panel animations
- **Lucide React** — Icons
- **Convex** — Real-time database + auth + serverless functions
- **Clerk** — Authentication (via `@convex-dev/auth`)

## Getting Started

Repo lives in WSL (Debian) at `~/repo/rust-wasm-photo-tool/`:

```bash
cd ~/repo/rust-wasm-photo-tool

# Build the WASM module
wasm-pack build --target web

# Install frontend dependencies
cd app
pnpm install

# Start development server
pnpm dev
```

To run the marketing site:

```bash
cd ~/repo/rust-wasm-photo-tool/marketing
pnpm install
pnpm dev
```

### With Convex

```bash
# In a separate terminal from the app/ directory
npx convex dev
```

Set up `app/.env.local` (never committed — see `.gitignore`):

```
VITE_CONVEX_URL=https://your-deployment.convex.cloud
VITE_CLERK_PUBLISHABLE_KEY=pk_...
```

## v2.1 Change Summary

| # | Feature | Status |
|---|---------|--------|
| 1 | Convex DB + auth schema | Schema defined, bridge stub ready |
| 2 | Spacebar pan | Complete |
| 3 | Alt+Scroll zoom with pan compose | Complete |
| 4 | PgUp/PgDn gallery cycling | Complete |
| 5 | AI panel cards | Placeholder (Replicate pipeline pending) |
| 6 | Arrow peg circles (draggable endpoints) | Design spec, future |
| 7 | Blur → Effects panel (brightness + contrast + blur brush) | Complete |
| 8 | Architecture diagram opens in new tab | Complete |
| 9 | Crop SVG overlay with rule-of-thirds + resize handles | Complete |

## v2.2 Change Summary

| # | Change | Status |
|---|--------|--------|
| 1 | Per-photo edit persistence (IndexedDB) — full canvas + undo/redo history preserved on photo switch | Complete |
| 2 | Clone stamp alpha compositing — Porter-Duff source-over; `stroke_src_data` frozen buffer prevents feedback artifacts | Complete |
| 3 | Paint dab compositing — Porter-Duff fix; squared-distance circle rejection replaces sqrt in hot loop | Complete |
| 4 | History `MAX_HISTORY` — single `pub const` in `history.rs`; `delete_entry` no longer restores canvas on delete | Complete |
| 5 | Crop OOB clamp — boundary guard prevents out-of-bounds read on zero-area crops | Complete |
| 6 | Zero-size buffer safety — `sample_bilinear` returns transparent pixel when width or height is 0 | Complete |
| 7 | Netlify build fix — removed `--out-dir app/pkg` from wasm-pack; `app/pkg` is a symlink | Complete |
| 8 | StatusBar hidden until first photo loaded | Complete |
| 9 | Modified-photo dot — race condition fixed; dot only appears after actual brush/tool edits | Complete |
| 10 | Convex `userProfiles.ts` removed — queried a table not in schema; `users.ts` covers all functionality | Complete |
| 11 | `@emoji-mart` added to `app/package.json` — was only in root; Netlify build now installs it correctly | Complete |
| 12 | Alt+Scroll zoom — listener moved to `window` to fix breakage when `CanvasArea` mounts after hook | Complete |
| 13 | TypeScript — all frontend errors resolved; `vite-env.d.ts` added; WASM type declarations completed | Complete |

## v2.3 Change Summary

| # | Change | Status |
|---|--------|--------|
| 1 | Brush tool split into "Paint \| Blur Brush" tabs — blur brush moved from Effects into Paint panel; canvas mouse routing controlled by sub-mode | Complete |
| 2 | Effects tool tabs renamed "Levels \| Color Picker" — Levels keeps brightness/contrast; Color Picker adds eyedropper mode | Complete |
| 3 | Color picker pixel magnifier — WASM `get_pixel_region(cx, cy, radius)` returns 11×11 RGBA grid; `MagnifierOverlay` renders it as a floating canvas near the cursor | Complete |
| 4 | Color picker pick — WASM `get_pixel(x, y)` samples center pixel on click; sets brush color and text color | Complete |
| 5 | Font family selector — 12 browser-safe fonts in a dropdown in the Text panel; font applied to the canvas text overlay textarea; stored in TextMemory so re-editing restores the font | Complete |
| 6 | Recent text re-edit — clicking a recent text entry restores font family, size, weight, and color, then re-opens the canvas text box at the last used position | Complete |
| 7 | Icon swap — AI tool uses `Brain` icon (lucide), Effects tool uses `Sparkles` icon | Complete |
| 8 | Export All shortcut — `Alt + Shift + E` triggers ZIP export of all photos | Complete |
| 9 | Redo hint in StatusBar — `Ctrl+Shift+Z` always visible in the status bar | Complete |
| 10 | Keyboard shortcuts table expanded — all 24 shortcuts documented including bare-key tool switching, zoom, flip, rotate | Complete |

## v2.4 Change Summary

| # | Change | Status |
|---|--------|--------|
| 1 | Stamp tool: 3-tab panel — Clone / Stamps / Emojis; Emojis tab houses the full `@emoji-mart` picker + size controls; emoji canvas routing activates when stamp tool + Emojis tab selected | Complete |
| 2 | Emoji tool → Images tool — toolbar tool renamed to "Images" with `Images` lucide icon; panel shows BatchSettings (coming-soon batch Lucide icon stamper) | Complete |
| 3 | Shapes tool: Shapes/Arrows tab switcher — Shapes tab has 4 shape buttons styled like the Transform panel (`Button` secondary, `grid-cols-2`, lucide icons); Arrows tab shows full arrow settings (stroke width, single/double style, color grid) | Complete |
| 4 | Arrow tool → coming soon — panel replaced with coming-soon card (FileText icon); toolbar icon changed from `ArrowUpRight` to `FileText` | Complete |
| 5 | Fix: arrows drawn when Arrows sub-tab active — `shapesMode` lifted to AppShell; `effectiveDrawingTool` overrides `activeTool` to `"arrow"` when shapes tool is in Arrows mode, routing preview and commit through `drawArrowPreview` / `tool.draw_arrow` | Complete |
| 6 | Dual persistence — `useEditPersistence` routes canvas saves to Convex file storage (signed in) or IndexedDB (not signed in); `useRecentTexts` routes to Convex `recent_texts` or localStorage; `skipToken` used for conditional Convex queries | Complete |

## v2.5 Change Summary

| # | Change | Status |
|---|--------|--------|
| 1 | Text rotate handle — SVG rotate circle rendered above text box in canvas overlay; drag to rotate text in-place before committing | Complete |
| 2 | ColorSwatchGrid component — shared color swatch grid used in brush, text, arrow, and shape settings | Complete |
| 3 | StatusBar auth mode — shows "Demo" or "Signed In" badge based on Clerk state | Complete |
| 4 | Binary archive format for Convex edit history — canvas + undo/redo stack serialized as a compact binary archive; reduces storage and round-trips vs. per-snapshot Convex file uploads | Complete |
| 5 | `session_edits` Convex table with 3-day expiry cron — edits older than 3 days cleaned up automatically | Complete |

## v2.6 Change Summary

| # | Change | Status |
|---|--------|--------|
| 1 | App renamed **Image Horse** — was *Clone Stamp App*; WASM struct renamed `CloneStampTool` → `ImageHorseTool`; all TS imports updated; WASM rebuilt | Complete |
| 2 | `originalsStore.ts` — content-addressed IndexedDB store for original photo bytes; SHA-256 keyed via `crypto.subtle`; originals survive photo switching and page reload at full resolution | Complete |
| 3 | `workingCopy.ts` — uploads downscaled to ≤2048px long edge via `createImageBitmap` (high-quality); 256px WebP thumbnail generated in parallel | Complete |
| 4 | `PhotoEntry` shape change — `file` and `url` removed; replaced with `originalKey` (IDB key), `thumbBlob`, `mimeType`, `byteSize`, `origWidth/Height`, `workingWidth/Height` | Complete |
| 5 | `loadImageFromPixels()` added to `useCloneStamp` — accepts pre-decoded `Uint8ClampedArray`; skips second decode; used by all photo-load paths | Complete |
| 6 | CompareSlider alignment fix — overlay now tracks the canvas element's bounding box via `ResizeObserver`; "before" layer uses `background-size: 100% 100%` to fill that exact box; both layers share one coordinate space through zoom and pan | Complete |
| 7 | Compare URL on demand — `originalUrl` populated by a `useEffect` that fires when compare activates, fetching from IndexedDB; revoked on cleanup; not stored on `PhotoEntry` | Complete |
| 8 | AutoCompress reads/writes IndexedDB — fetches originals from IDB for compression, stores compressed result back under new key, regenerates thumbnail | Complete |
| 9 | ExportAll reads IndexedDB — ZIP export streams original bytes from IDB instead of `photo.file` | Complete |
| 10 | "Apply Resize and Quality" button — renamed from "Apply Resize"; disabled until width, height, or quality actually changes | Complete |

## v2.7 Change Summary

| # | Change | Status |
|---|--------|--------|
| 1 | **Batch Image Editor** — tool renamed from "Images"; now a real panel with Logo / Text tab toggle and a grid mosaic view of the gallery | Complete |
| 2 | Bulk logo stamp — pick a logo (PNG/JPG/WebP/SVG), choose corner + size + opacity + margin, "Apply Logo to All Images" iterates the gallery and composites every photo via Rust. Active photo gets an undo entry; others are persisted irreversibly to IDB (mirrors AutoCompress behavior) | Complete |
| 3 | SVG logo support — `decodeImageFile()` rasterizes SVGs via `<img>` → OffscreenCanvas → `createImageBitmap`, with a 512×512 fallback when the SVG omits intrinsic dimensions | Complete |
| 4 | Batch Text overlay — mock UI in place (textarea, font family/size, color, position, margin, opacity); "Coming Soon" badge on the apply button | Mock UI |
| 5 | Grid canvas mode — when Batch Image Editor is active, the canvas pane becomes a 5×3 grid mosaic; selected photo occupies a 2×2 hero tile in the top-left; up to 11 thumbnails fill the surrounding tiles. Clicking a thumbnail swaps the selection. Caps at 12 visible tiles total with a `+N more` badge when the gallery exceeds 12 photos | Complete |
| 6 | "Selected" indicator — orange ring + pill badge on the hero tile when a photo is active; "No photos loaded" placeholder overlay otherwise | Complete |
| 7 | Auto-select first photo — `useEffect` calls `handleSelectPhoto(photos[0])` when `activePhotoId === null && photos.length > 0`; keeps the hero populated after session restore | Complete |
| 8 | Canvas survives container resize — `flushToCanvas` re-blits the WASM buffer via a `ResizeObserver` plus a `useEffect` on `state.ready/width/height`; fixes the blank-hero bug when switching tools between the full canvas and the grid hero | Complete |
| 9 | `.checkerboard-dark` CSS variant (`#2a2a2a` / `#1a1a1a`, 14px tiles) used for the grid surround so it recedes behind the lighter checker inside the active photo's canvas | Complete |
| 10 | Rust `composite_pixels(target, tw, th, src, sw, sh, dx, dy, opacity)` — stateless RGBA alpha-compositing exposed as a free `#[wasm_bindgen]` function; delegates to `transform::paste_region` with opacity pre-multiplied into source alpha so `paste_region`'s signature stays untouched | Complete |
| 11 | Rust `resize_pixels(pixels, oldW, oldH, newW, newH)` — stateless bilinear resize free function. Batch logo scaling moves from OffscreenCanvas to Rust | Complete |
| 12 | Rust `encode_png_pixels(pixels, w, h)` — stateless PNG encoding free function; batched photo outputs encoded directly to bytes, skipping the `canvas.convertToBlob` round-trip | Complete |
| 13 | Upload dialog footer link — small `image-horse.vercel.app ↗` link at the bottom of the upload modal (matches the existing helper text styling) | Complete |
| 14 | Tool icon set replaced — emoji-based tool icons in the marketing Hero replaced with inline lucide SVG paths (Shrink, Crop, Paintbrush, Type, FileText, Brain, Shapes, Sparkles, Stamp, Images) on gradient backgrounds; matches the in-app tool grid | Complete |

## v2.8 Change Summary

| # | Change | Status |
|---|--------|--------|
| 1 | **Tiered gallery limits** — the gallery now caps the number of loaded photos by account tier: **Demo (anonymous) 12 · Free (logged in) 24 · Pro 100 (coming soon)**. Enforced centrally in `handleAddPhotos` | Complete |
| 2 | Rust `photo_limit(tier)` — a free `#[wasm_bindgen]` function in `src/lib.rs` is the single source of truth for the caps (`"demo"`→12, `"loggedIn"`→24, `"paid"`→100, unknown→12). The app resolves it via `app/src/lib/photoLimits.ts` after wasm init | Complete |
| 3 | Cap behavior — when a batch would exceed the limit, the app accepts as many as fit then shows a `sonner` toast nudging the next tier (e.g. "Demo galleries hold 12 photos. Sign in to load up to 24.") | Complete |
| 4 | Overflow-aware gallery arrows — the `GalleryBar` scroll chevrons disable when the strip can't scroll that direction (tracked via scroll position + `ResizeObserver`). On desktop where all photos fit, both disable; on narrow/mobile widths that overflow, they re-enable | Complete |
| 5 | Cap surfaced in UI — the `GalleryBar` header and the `StatusBar` show `count / max` (e.g. `3 / 12`); `StatusBar` labels all three tiers (`demo` / `loggedIn` / `paid`) | Complete |
| 6 | Marketing pricing updated — `marketing/src/sections/Pricing.tsx` plan cards + access matrix now read 12 / 24 / 100, replacing the old 3 / 10 / unlimited gallery figures | Complete |

## v2.9 Change Summary

| # | Change | Status |
|---|--------|--------|
| 1 | **Smart Export All** — per photo, exports the *processed* result (edits / compression / resize re-encoded at the chosen format + quality) or the untouched original when unchanged. Live text annotations are composited via a throwaway Rust `ImageHorseTool`; PNG encodes through Rust `encode_png_pixels`, lossy formats via the browser codec (`app/src/lib/exportImage.ts`) | Complete |
| 2 | **Batch Text** — the Batch Image Editor's Text tab is now functional: per photo, Rust `measure_text` + `commit_text` render the embedded Liberation Sans font onto the buffer (active photo gets an undo entry). Replaced the Coming-Soon mock | Complete |
| 3 | **Logo replace-not-stack** — re-applying the batch logo composites onto a tracked pre-logo baseline instead of stacking a second logo on top | Complete |
| 4 | **Byte-aware Lighthouse score** — Rust `web_perf_metrics` (log-normal curve + erfc approximation) drives the Resize panel's "Web Performance Gain / Lighthouse Score" readout | Complete |
| 5 | **Test Free Images** — upload-dialog button that pulls 12 royalty-free Unsplash photos from a public CDN through the normal upload pipeline (respects the tier cap) | Complete |
| 6 | **Clerk dark theme** — `@clerk/themes` `dark` baseTheme applied so the sign-in modal + user-button popover match the dark UI | Complete |
| 7 | **Status-bar file size** — shows the active photo's size (e.g. `80 KB`) next to its dimensions; updated to the compressed size after Auto Compress | Complete |
| 8 | **`LargeButton` / `TinyButton` components** (`app/src/components/ui/`) — shared button primitives. `LargeButton` (elevated surface, white text, border-highlight hover, dark-muted disabled, icon scaled to text) is used across Export / Apply Resize / Auto Compress / Apply Crop / Apply Logo / Apply Text / Delete All / the four upload buttons. `TinyButton` (28×28 `.btn-icon`, matching the zoom controls) is used for the user icon and all panel close / clear-history buttons | Complete |
| 9 | **Status-bar redesign** — the center shows three shortcut hints: the active tool's digit shortcut swapped in, a hint that rotates every 5 minutes, and a pinned `Alt+/`. Removed the beta-version link (and the `/architecture` target), removed the `count / max` image count, and pinned the brand to one line | Complete |
| 10 | **Responsive < 1000px** — the TopBar buttons collapse to icons-only and the zoom `%` hides; the toolbar narrows (296→260px) with smaller tool-grid icons | Complete |
| 11 | **Auto-Compress progress → toast** — compression progress (with a bar) now surfaces in a `sonner` toast rather than an inline toolbar bar | Complete |
| 12 | **UI polish** — Delete All moved into the gallery header (styled like the toolbar buttons); the gallery remove button is a trash-can on a red circle; gallery thumbnails show a shadcn hover tooltip (name · size · dimensions); the ToolsSidebar gained an `[icon] Toolbar … ✕` header mirroring the gallery | Complete |
| 13 | **Removed the Architecture page** — deleted `marketing/src/pages/Architecture.tsx`, its route, and all five links to it (Nav, Footer, CTA, Hero, Shipped) | Complete |

## v3.0 Change Summary

| # | Change | Status |
|---|--------|--------|
| 1 | **Live text annotations** — text is no longer committed to canvas pixels at commit time. Each annotation lives as Rust state on `ImageHorseTool` (`Vec<TextAnnotation>`) with cached pre-rendered + pre-rotated tile pixels. Hit-test on click re-opens the existing text input pre-filled with content / font / color / rotation; submit updates in place; empty submit removes the annotation. Display path: `flushToCanvas` calls `render_with_annotations()` when count > 0 (cheap zero-count guard otherwise). Export paths auto-call `flatten_text_annotations()` so on-screen and exported pixels match. New `#[wasm_bindgen]` exports: `add_text_annotation`, `update_text_annotation`, `remove_text_annotation`, `text_annotation_at`, `text_annotation_count`, `get_text_annotations`, `render_with_annotations`, `flatten_text_annotations` | Complete |
| 2 | **Text Background panel** — new Background tab in TextSettings with three styles: None / Text BG (rounded rectangle) / Speech Bubble (rounded rect + triangle tail, 5 directions: Left / Right / TopLeft / BottomRight / BottomLeft). Background color picker, padding (0–40), corner radius (0–32, Rect only), tail direction (Bubble only), opacity (0–100). `TextAnnotation` gained 8 BG fields (`background_kind`, `bg_r/g/b/a`, `bg_padding`, `bg_corner_radius`, `bg_tail`); add/update annotation signatures expanded to 17/18 args | Complete |
| 3 | Rust `drawing::fill_rounded_rect` — anti-aliased rounded rectangle fill via per-pixel distance test; `drawing::fill_triangle_public` wraps the existing scanline triangle rasterizer for speech-bubble tails. `build_annotation_tile` now expands the tile by padding + tail extent when BG is set, draws the background, composites text on top, then rotates the composed tile (rotation spins the whole bubble together) | Complete |
| 4 | **Line-and-dot move / rotate handles** — replaced V-shaped chevrons with stem + filled-circle "balloon" shapes inside the rotated SVG group. Top handle = move (native `cursor: move`, 4-arrow); bottom handle = rotate (custom data-URI SVG cursor showing a curved arrow with stacked 3.5px black-outer + 2.5px white-inner strokes for visibility on any background, falling back to `grab`) | Complete |
| 5 | **Sticky text input** — the text editing box no longer closes when the user clicks a color swatch, font dropdown, or weight toggle in TextSettings. `onTextBlur` is now a no-op; a document-level `pointerdown` listener mounts while editing and only commits when the click target is outside the textarea, `[data-text-panel]` (TextSettings root), and `[data-text-overlay]` (text overlay block). Live preview updates inside the textarea via existing prop wiring; the Rust tile only re-renders on commit (performance choice) | Complete |
| 6 | **Text Extract removed** — `tesseract.js` dependency dropped from `app/package.json` + lockfile; `useTextExtract.ts` deleted; Rust `extract_region_png` removed (no callers); all `extractMouse{Down,Move,Up}` props pruned from AppShell / CanvasArea / ToolsSidebar; the TextSettings "Text Extract" tab removed | Complete |
| 7 | **AISettings panel** — new `app/src/features/tools/settings/AISettings.tsx` mounted when `activeTool === "ai"`. Four "Coming Soon" cards in priority order: Text Extract (OCR), Background Removal (rembg), 4× Upscale (Real-ESRGAN), Object Removal (SD Inpaint). Wired to the future Replicate / Convex pipeline; UI in place | Complete |
| 8 | **Unified ColorSwatchGrid** — Paint, Shapes (both tabs), Arrows, and the Text Background tab now share the canonical `TEXT_COLORS` palette via the existing `ColorSwatchGrid` component (driven by `useUserColors` with localStorage persistence and cross-component sync via custom events; Rust `parse_color` parses hex / `rgba(...)` from the "+" popover). All inline `<input type="color">` callsites consolidated; the BatchSettings text-batch panel also adopted the shared grid | Complete |
| 9 | **Annotation persistence v2** — `editPersistence.SavedEdit` gained an `annotations` field (text + position + rotation + font + BG fields, no tile pixels); the Convex binary archive bumped to v2 with trailing JSON (v1 still decodes for back-compat). `loadFromSaved` re-creates annotations via `add_text_annotation` so the live overlay survives photo switches and signed-in cross-device sync | Complete |
| 10 | **Gallery multi-select** — checkboxes appear on hover and stay visible for every thumb once at least one is selected. A `Delete N selected` action surfaces in the gallery header. `Set<photoId>` lives in `GalleryBar`; AppShell `handleDeleteSelected` mirrors the single-photo delete path (cleans `imageSavings`, `modifiedPhotos`, picks a new active photo when the active one is in the deletion set) | Complete |

## License

MIT
