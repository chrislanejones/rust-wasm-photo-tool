# Image Horse v2.1 — Change Specification

All nine feature requests with implementation details, file locations, and Rust/Convex integration strategy.

---

## File Change Map

| # | Feature | Files Modified | Files Created |
|---|---------|---------------|---------------|
| 1 | Convex DB + Rust Bridge | — | `hooks/useConvexHistory.ts`, `.convex/schema.ts` (from Chef) |
| 2 | Spacebar Pan | `AppShell.tsx`, `useKeyboardShortcuts.ts`, `CanvasArea.tsx` | — |
| 3 | Fix Alt+Scroll Zoom | `CanvasArea.tsx` (transform includes panOffset) | — |
| 4 | PgUp/PgDn Gallery | `AppShell.tsx`, `useKeyboardShortcuts.ts` | — |
| 5 | AI Panel Ideas | `ToolsSidebar.tsx` | — |
| 6 | Arrow Peg Circles | `useDrawingTools.ts` (future) | — |
| 7 | Blur→Effects Panel | `toolConfig.ts`, `types.ts`, `defaultToolSettings.ts`, `ToolsSidebar.tsx`, `AppShell.tsx`, `StatusBar.tsx` | `EffectsSettings.tsx` |
| 8 | Architecture New Tab | `App.tsx`, `StatusBar.tsx` | — |
| 9 | Crop Preview→Rust | `stamp_tool.d.ts` | `transform_additions.rs` |

---

## 1. Convex Database Integration

### Schema
The uploaded Chef files define the full schema with 8 application tables (`userProfiles`, `subscriptions`, `projects`, `images`, `layers`, `annotations`, `history`, `ai_jobs`) plus auth tables from `@convex-dev/auth`.

### Rust ↔ Convex Bridge Strategy

**Principle**: WASM processes pixels locally (fast, zero-latency). Convex stores metadata, persistent history, and project state. React hooks bridge both.

**Image Change History**: Every WASM operation that pushes an undo snapshot also records to Convex via `useConvexHistory.recordAction()`. This gives:
- Session-local undo/redo (instant, WASM memory)
- Persistent audit trail (Convex `history` table, queryable)

**Annotations → Convex**: When committing arrows/shapes/text, save annotation metadata to Convex `annotations` table with geometry data. This enables:
- Cross-session annotation recovery
- Collaborative editing (future)
- Export with annotation metadata

**AI Jobs Pipeline**:
1. UI triggers → `api.ai_jobs.create({ type: "rembg", imageId, input: {...} })`
2. Convex action calls Replicate API
3. Replicate webhook → updates `ai_jobs.status` to "done"
4. `useQuery(api.ai_jobs.listByImage)` auto-updates UI → load result into WASM buffer

**File**: `app/src/hooks/useConvexHistory.ts` (stub, ready for Convex connection)

---

## 2. Spacebar Pan (Photoshop-style)

**Behavior**: Hold spacebar → cursor becomes hand → drag to pan canvas → release returns to tool.

**Implementation**:
- `useKeyboardShortcuts.ts`: Tracks `Space` keydown/keyup, fires `onSpaceDown`/`onSpaceUp`
- `AppShell.tsx`: `isPanning` state toggled by spacebar callbacks
- `CanvasArea.tsx`: When `isPanning=true`:
  - Cursor shows `grab` (or `grabbing` while dragging)
  - Mouse drag translates canvas via `panOffset` state
  - Canvas transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`
  - All tool mouse handlers are bypassed during pan

---

## 3. Fix Alt+Scroll Zoom

**Root cause**: The zoom value was stored in WASM but the CSS transform on the canvas didn't properly compose with pan offset.

**Fix**: `CanvasArea.tsx` now applies: `transform: translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`. The `adjust_zoom` in `useCloneStamp.ts` was already correct — the missing piece was the unified transform string.

---

## 4. PgUp/PgDn Gallery Navigation

**Implementation**:
- `useKeyboardShortcuts.ts`: `PageUp` → `onPrevPhoto()`, `PageDown` → `onNextPhoto()`
- `AppShell.tsx`: `handleNextPhoto` and `handlePrevPhoto` cycle through `photos` array with wrapping (last→first, first→last)
- Uses existing `handleSelectPhoto` which loads via WASM

---

## 5. AI Panel Ideas

Six features displayed as cards in the AI tool panel:

| Feature | Tier | Tech | Description |
|---------|------|------|-------------|
| Remove Background | free | rembg via Replicate | One-click BG removal |
| 4× Upscale | pro | Real-ESRGAN | Enhance resolution |
| Object Removal | pro | SD Inpaint | Brush to remove objects |
| Auto Alt Text | free | BLIP | Generate a11y descriptions |
| Smart Crop | pro | Subject detection | AI-suggested crop regions |
| Auto-Enhance | free | WASM histogram | One-click optimization |

Currently displayed as placeholder cards with tier badges. Wire up when Replicate + Convex `ai_jobs` pipeline is ready.

---

## 6. Arrow Peg Circles (Design Notes)

**Goal**: After committing an arrow/shape, show draggable endpoint circles.

**Approach** (future implementation):
1. Store committed shape metadata in React state: `{ id, type, from, to, color, width }`
2. Render SVG overlay circles at endpoints (8px diameter, same color)
3. On peg drag: undo last shape, redraw with new endpoint coordinates
4. On click away or tool switch: finalize position

**Why hybrid**: Preview during drag stays Canvas2D (instant). Peg overlay is React/SVG (interactive). Final commit goes through Rust `draw_arrow`/`draw_shape`.

---

## 7. Blur → Effects Panel

**Changes**:
- `ToolType`: `"blur"` → `"effects"`
- `toolConfig.ts`: Icon `Droplets` → `Wand2`, label "Effects", gradient indigo→violet
- New `EffectsSettings.tsx`: Combines brightness slider, contrast slider, and blur brush settings
- Brightness/contrast use existing Rust `adjust_brightness()` / `adjust_contrast()` — each adjustment creates an undo snapshot
- Blur brush behavior unchanged (drag to blur regions)

---

## 8. Architecture Diagram — New Tab

**Problem**: `/architecture` was an SPA route. Pressing browser "back" destroyed app state.

**Fix**:
- `App.tsx`: Removed `if (window.location.pathname === "/architecture")` conditional
- `StatusBar.tsx`: Link uses `target="_blank" rel="noopener noreferrer"`
- `ArchitectureDiagram.tsx` still exists for the `/architecture` route (served by Vite's static config), but it opens in a separate browser tab

---

## 9. Crop Preview → Rust

**What moves to Rust**:
- The dark overlay compositing outside the crop selection
- The dashed rectangle border drawing

**What stays in JS**:
- The initial mouse drag to define the crop rectangle (needs immediate Canvas2D feedback)
- The "Apply Crop" button click

**New Rust functions** (in `transform.rs`):
- `apply_crop_overlay(data, w, h, crop_x, crop_y, crop_w, crop_h, opacity)` — darkens pixels outside crop rect
- `draw_crop_border(data, w, h, crop_x, crop_y, crop_w, crop_h, color, dash, gap)` — dashed border

**New WASM methods** (in `lib.rs`):
- `preview_crop(x, y, w, h)` — saves snapshot + applies overlay + border
- `cancel_crop_preview()` — undoes the preview snapshot
- `apply_crop_from_preview(x, y, w, h)` — undoes preview, then crops for real

**Flow**:
1. User drags to define rectangle (JS Canvas2D, fast)
2. On mouseup: call `tool.preview_crop(x, y, w, h)` → WASM renders overlay
3. User clicks "Apply Crop" → `tool.apply_crop_from_preview(x, y, w, h)`
4. User clicks elsewhere → `tool.cancel_crop_preview()` to undo overlay

---

## Build Notes

### Rust Changes Required
After adding the `transform_additions.rs` functions to `src/transform.rs` and the new `#[wasm_bindgen]` methods to `src/lib.rs`:

```bash
cd stamp_tool
wasm-pack build --target web
```

### Frontend
No new npm dependencies. The `Wand2` icon is already in `lucide-react@0.577.0`.

```bash
cd app
pnpm dev
```

### Convex (when ready)
```bash
npx convex dev
```
Then uncomment the imports in `useConvexHistory.ts`.
