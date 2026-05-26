Image Horse

![Image Horse](public/Rust-WASM-Photo-App.jpg)

**Live:** [rust-wasm-photo-tool.netlify.app](https://rust-wasm-photo-tool.netlify.app/) &nbsp;·&nbsp; [Architecture](Architecture.md)

A browser-based image annotation and editing tool powered by **Rust/WASM** for pixel-level operations, **React + TypeScript** for the UI, and **Convex** for persistent storage.

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
- **Tool Grid** — 10 tools with gradient icons: Clone Stamp, Resize, Crop, Paint, Text, Arrows (FileText — coming soon), Shapes, Effects (Sparkles), Images (batch icon stamper, coming soon), AI (Brain)
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

## License

MIT
