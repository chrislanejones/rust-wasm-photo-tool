# Change Summary

> Full dated release history for [Image Horse](../README.md). The README shows only the latest release.

## v2.1 Change Summary — 2026-04-11

| #   | Feature                                                   | Status                                   |
| --- | --------------------------------------------------------- | ---------------------------------------- |
| 1   | Convex DB + auth schema                                   | Schema defined, bridge stub ready        |
| 2   | Spacebar pan                                              | Complete                                 |
| 3   | Alt+Scroll zoom with pan compose                          | Complete                                 |
| 4   | PgUp/PgDn gallery cycling                                 | Complete                                 |
| 5   | AI panel cards                                            | Placeholder (Replicate pipeline pending) |
| 6   | Arrow peg circles (draggable endpoints)                   | Design spec, future                      |
| 7   | Blur → Effects panel (brightness + contrast + blur brush) | Complete                                 |
| 8   | Architecture diagram opens in new tab                     | Complete                                 |
| 9   | Crop SVG overlay with rule-of-thirds + resize handles     | Complete                                 |

## v2.2 Change Summary — 2026-04-23

| #   | Change                                                                                                               | Status   |
| --- | -------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | Per-photo edit persistence (IndexedDB) — full canvas + undo/redo history preserved on photo switch                   | Complete |
| 2   | Clone stamp alpha compositing — Porter-Duff source-over; `stroke_src_data` frozen buffer prevents feedback artifacts | Complete |
| 3   | Paint dab compositing — Porter-Duff fix; squared-distance circle rejection replaces sqrt in hot loop                 | Complete |
| 4   | History `MAX_HISTORY` — single `pub const` in `history.rs`; `delete_entry` no longer restores canvas on delete       | Complete |
| 5   | Crop OOB clamp — boundary guard prevents out-of-bounds read on zero-area crops                                       | Complete |
| 6   | Zero-size buffer safety — `sample_bilinear` returns transparent pixel when width or height is 0                      | Complete |
| 7   | Netlify build fix — removed `--out-dir app/pkg` from wasm-pack; `app/pkg` is a symlink                               | Complete |
| 8   | StatusBar hidden until first photo loaded                                                                            | Complete |
| 9   | Modified-photo dot — race condition fixed; dot only appears after actual brush/tool edits                            | Complete |
| 10  | Convex `userProfiles.ts` removed — queried a table not in schema; `users.ts` covers all functionality                | Complete |
| 11  | `@emoji-mart` added to `app/package.json` — was only in root; Netlify build now installs it correctly                | Complete |
| 12  | Alt+Scroll zoom — listener moved to `window` to fix breakage when `CanvasArea` mounts after hook                     | Complete |
| 13  | TypeScript — all frontend errors resolved; `vite-env.d.ts` added; WASM type declarations completed                   | Complete |

## v2.3 Change Summary — 2026-04-23

| #   | Change                                                                                                                                                                               | Status   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| 1   | Brush tool split into "Paint \| Blur Brush" tabs — blur brush moved from Effects into Paint panel; canvas mouse routing controlled by sub-mode                                       | Complete |
| 2   | Effects tool tabs renamed "Levels \| Color Picker" — Levels keeps brightness/contrast; Color Picker adds eyedropper mode                                                             | Complete |
| 3   | Color picker pixel magnifier — WASM `get_pixel_region(cx, cy, radius)` returns 11×11 RGBA grid; `MagnifierOverlay` renders it as a floating canvas near the cursor                   | Complete |
| 4   | Color picker pick — WASM `get_pixel(x, y)` samples center pixel on click; sets brush color and text color                                                                            | Complete |
| 5   | Font family selector — 12 browser-safe fonts in a dropdown in the Text panel; font applied to the canvas text overlay textarea; stored in TextMemory so re-editing restores the font | Complete |
| 6   | Recent text re-edit — clicking a recent text entry restores font family, size, weight, and color, then re-opens the canvas text box at the last used position                        | Complete |
| 7   | Icon swap — AI tool uses `Brain` icon (lucide), Effects tool uses `Sparkles` icon                                                                                                    | Complete |
| 8   | Export All shortcut — `Alt + Shift + E` triggers ZIP export of all photos                                                                                                            | Complete |
| 9   | Redo hint in StatusBar — `Ctrl+Shift+Z` always visible in the status bar                                                                                                             | Complete |
| 10  | Keyboard shortcuts table expanded — all 24 shortcuts documented including bare-key tool switching, zoom, flip, rotate                                                                | Complete |

## v2.4 Change Summary — 2026-04-23

| #   | Change                                                                                                                                                                                                                                                   | Status   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | Stamp tool: 3-tab panel — Clone / Stamps / Emojis; Emojis tab houses the full `@emoji-mart` picker + size controls; emoji canvas routing activates when stamp tool + Emojis tab selected                                                                 | Complete |
| 2   | Emoji tool → Images tool — toolbar tool renamed to "Images" with `Images` lucide icon; panel shows BatchSettings (coming-soon batch Lucide icon stamper)                                                                                                 | Complete |
| 3   | Shapes tool: Shapes/Arrows tab switcher — Shapes tab has 4 shape buttons styled like the Transform panel (`Button` secondary, `grid-cols-2`, lucide icons); Arrows tab shows full arrow settings (stroke width, single/double style, color grid)         | Complete |
| 4   | Arrow tool → coming soon — panel replaced with coming-soon card (FileText icon); toolbar icon changed from `ArrowUpRight` to `FileText`                                                                                                                  | Complete |
| 5   | Fix: arrows drawn when Arrows sub-tab active — `shapesMode` lifted to AppShell; `effectiveDrawingTool` overrides `activeTool` to `"arrow"` when shapes tool is in Arrows mode, routing preview and commit through `drawArrowPreview` / `tool.draw_arrow` | Complete |
| 6   | Dual persistence — `useEditPersistence` routes canvas saves to Convex file storage (signed in) or IndexedDB (not signed in); `useRecentTexts` routes to Convex `recent_texts` or localStorage; `skipToken` used for conditional Convex queries           | Complete |

## v2.5 Change Summary — 2026-05-15

| #   | Change                                                                                                                                                                                | Status   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | Text rotate handle — SVG rotate circle rendered above text box in canvas overlay; drag to rotate text in-place before committing                                                      | Complete |
| 2   | ColorSwatchGrid component — shared color swatch grid used in brush, text, arrow, and shape settings                                                                                   | Complete |
| 3   | StatusBar auth mode — shows "Demo" or "Signed In" badge based on Clerk state                                                                                                          | Complete |
| 4   | Binary archive format for Convex edit history — canvas + undo/redo stack serialized as a compact binary archive; reduces storage and round-trips vs. per-snapshot Convex file uploads | Complete |
| 5   | `session_edits` Convex table with 3-day expiry cron — edits older than 3 days cleaned up automatically                                                                                | Complete |

## v2.6 Change Summary — 2026-05-15

| #   | Change                                                                                                                                                                                                                                        | Status   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | App renamed **Image Horse** — was _Clone Stamp App_; WASM struct renamed `CloneStampTool` → `ImageHorseTool`; all TS imports updated; WASM rebuilt                                                                                            | Complete |
| 2   | `originalsStore.ts` — content-addressed IndexedDB store for original photo bytes; SHA-256 keyed via `crypto.subtle`; originals survive photo switching and page reload at full resolution                                                     | Complete |
| 3   | `workingCopy.ts` — uploads downscaled to ≤2048px long edge via `createImageBitmap` (high-quality); 256px WebP thumbnail generated in parallel                                                                                                 | Complete |
| 4   | `PhotoEntry` shape change — `file` and `url` removed; replaced with `originalKey` (IDB key), `thumbBlob`, `mimeType`, `byteSize`, `origWidth/Height`, `workingWidth/Height`                                                                   | Complete |
| 5   | `loadImageFromPixels()` added to `useCloneStamp` — accepts pre-decoded `Uint8ClampedArray`; skips second decode; used by all photo-load paths                                                                                                 | Complete |
| 6   | CompareSlider alignment fix — overlay now tracks the canvas element's bounding box via `ResizeObserver`; "before" layer uses `background-size: 100% 100%` to fill that exact box; both layers share one coordinate space through zoom and pan | Complete |
| 7   | Compare URL on demand — `originalUrl` populated by a `useEffect` that fires when compare activates, fetching from IndexedDB; revoked on cleanup; not stored on `PhotoEntry`                                                                   | Complete |
| 8   | AutoCompress reads/writes IndexedDB — fetches originals from IDB for compression, stores compressed result back under new key, regenerates thumbnail                                                                                          | Complete |
| 9   | ExportAll reads IndexedDB — ZIP export streams original bytes from IDB instead of `photo.file`                                                                                                                                                | Complete |
| 10  | "Apply Resize and Quality" button — renamed from "Apply Resize"; disabled until width, height, or quality actually changes                                                                                                                    | Complete |

## v2.7 Change Summary — 2026-05-27

| #   | Change                                                                                                                                                                                                                                                                                                                                       | Status   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | **Batch Image Editor** — tool renamed from "Images"; now a real panel with Logo / Text tab toggle and a grid mosaic view of the gallery                                                                                                                                                                                                      | Complete |
| 2   | Bulk logo stamp — pick a logo (PNG/JPG/WebP/SVG), choose corner + size + opacity + margin, "Apply Logo to All Images" iterates the gallery and composites every photo via Rust. Active photo gets an undo entry; others are persisted irreversibly to IDB (mirrors AutoCompress behavior)                                                    | Complete |
| 3   | SVG logo support — `decodeImageFile()` rasterizes SVGs via `<img>` → OffscreenCanvas → `createImageBitmap`, with a 512×512 fallback when the SVG omits intrinsic dimensions                                                                                                                                                                  | Complete |
| 4   | Batch Text overlay — mock UI in place (textarea, font family/size, color, position, margin, opacity); "Coming Soon" badge on the apply button                                                                                                                                                                                                | Mock UI  |
| 5   | Grid canvas mode — when Batch Image Editor is active, the canvas pane becomes a 5×3 grid mosaic; selected photo occupies a 2×2 hero tile in the top-left; up to 11 thumbnails fill the surrounding tiles. Clicking a thumbnail swaps the selection. Caps at 12 visible tiles total with a `+N more` badge when the gallery exceeds 12 photos | Complete |
| 6   | "Selected" indicator — orange ring + pill badge on the hero tile when a photo is active; "No photos loaded" placeholder overlay otherwise                                                                                                                                                                                                    | Complete |
| 7   | Auto-select first photo — `useEffect` calls `handleSelectPhoto(photos[0])` when `activePhotoId === null && photos.length > 0`; keeps the hero populated after session restore                                                                                                                                                                | Complete |
| 8   | Canvas survives container resize — `flushToCanvas` re-blits the WASM buffer via a `ResizeObserver` plus a `useEffect` on `state.ready/width/height`; fixes the blank-hero bug when switching tools between the full canvas and the grid hero                                                                                                 | Complete |
| 9   | `.checkerboard-dark` CSS variant (`#2a2a2a` / `#1a1a1a`, 14px tiles) used for the grid surround so it recedes behind the lighter checker inside the active photo's canvas                                                                                                                                                                    | Complete |
| 10  | Rust `composite_pixels(target, tw, th, src, sw, sh, dx, dy, opacity)` — stateless RGBA alpha-compositing exposed as a free `#[wasm_bindgen]` function; delegates to `transform::paste_region` with opacity pre-multiplied into source alpha so `paste_region`'s signature stays untouched                                                    | Complete |
| 11  | Rust `resize_pixels(pixels, oldW, oldH, newW, newH)` — stateless bilinear resize free function. Batch logo scaling moves from OffscreenCanvas to Rust                                                                                                                                                                                        | Complete |
| 12  | Rust `encode_png_pixels(pixels, w, h)` — stateless PNG encoding free function; batched photo outputs encoded directly to bytes, skipping the `canvas.convertToBlob` round-trip                                                                                                                                                               | Complete |
| 13  | Upload dialog footer link — small `image-horse.vercel.app ↗` link at the bottom of the upload modal (matches the existing helper text styling)                                                                                                                                                                                               | Complete |
| 14  | Tool icon set replaced — emoji-based tool icons in the marketing Hero replaced with inline lucide SVG paths (Shrink, Crop, Paintbrush, Type, FileText, Brain, Shapes, Sparkles, Stamp, Images) on gradient backgrounds; matches the in-app tool grid                                                                                         | Complete |

## v2.8 Change Summary — 2026-06-06

| #   | Change                                                                                                                                                                                                                                                                     | Status   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | **Tiered gallery limits** — the gallery now caps the number of loaded photos by account tier: **Demo (anonymous) 12 · Free (logged in) 24 · Pro 100 (coming soon)**. Enforced centrally in `handleAddPhotos`                                                               | Complete |
| 2   | Rust `photo_limit(tier)` — a free `#[wasm_bindgen]` function in `src/lib.rs` is the single source of truth for the caps (`"demo"`→12, `"loggedIn"`→24, `"paid"`→100, unknown→12). The app resolves it via `app/src/lib/photoLimits.ts` after wasm init                     | Complete |
| 3   | Cap behavior — when a batch would exceed the limit, the app accepts as many as fit then shows a `sonner` toast nudging the next tier (e.g. "Demo galleries hold 12 photos. Sign in to load up to 24.")                                                                     | Complete |
| 4   | Overflow-aware gallery arrows — the `GalleryBar` scroll chevrons disable when the strip can't scroll that direction (tracked via scroll position + `ResizeObserver`). On desktop where all photos fit, both disable; on narrow/mobile widths that overflow, they re-enable | Complete |
| 5   | Cap surfaced in UI — the `GalleryBar` header and the `StatusBar` show `count / max` (e.g. `3 / 12`); `StatusBar` labels all three tiers (`demo` / `loggedIn` / `paid`)                                                                                                     | Complete |
| 6   | Marketing pricing updated — `marketing/src/sections/Pricing.tsx` plan cards + access matrix now read 12 / 24 / 100, replacing the old 3 / 10 / unlimited gallery figures                                                                                                   | Complete |

## v2.9 Change Summary — 2026-06-12

| #   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Status   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | **Smart Export All** — per photo, exports the _processed_ result (edits / compression / resize re-encoded at the chosen format + quality) or the untouched original when unchanged. Live text annotations are composited via a throwaway Rust `ImageHorseTool`; PNG encodes through Rust `encode_png_pixels`, lossy formats via the browser codec (`app/src/lib/exportImage.ts`)                                                                                                         | Complete |
| 2   | **Batch Text** — the Batch Image Editor's Text tab is now functional: per photo, Rust `measure_text` + `commit_text` render the embedded Liberation Sans font onto the buffer (active photo gets an undo entry). Replaced the Coming-Soon mock                                                                                                                                                                                                                                           | Complete |
| 3   | **Logo replace-not-stack** — re-applying the batch logo composites onto a tracked pre-logo baseline instead of stacking a second logo on top                                                                                                                                                                                                                                                                                                                                             | Complete |
| 4   | **Byte-aware Lighthouse score** — Rust `web_perf_metrics` (log-normal curve + erfc approximation) drives the Resize panel's "Web Performance Gain / Lighthouse Score" readout                                                                                                                                                                                                                                                                                                            | Complete |
| 5   | **Test Free Images** — upload-dialog button that pulls 12 royalty-free Unsplash photos from a public CDN through the normal upload pipeline (respects the tier cap)                                                                                                                                                                                                                                                                                                                      | Complete |
| 6   | **Clerk dark theme** — `@clerk/themes` `dark` baseTheme applied so the sign-in modal + user-button popover match the dark UI                                                                                                                                                                                                                                                                                                                                                             | Complete |
| 7   | **Status-bar file size** — shows the active photo's size (e.g. `80 KB`) next to its dimensions; updated to the compressed size after Auto Compress                                                                                                                                                                                                                                                                                                                                       | Complete |
| 8   | **`LargeButton` / `TinyButton` components** (`app/src/components/ui/`) — shared button primitives. `LargeButton` (elevated surface, white text, border-highlight hover, dark-muted disabled, icon scaled to text) is used across Export / Apply Resize / Auto Compress / Apply Crop / Apply Logo / Apply Text / Delete All / the four upload buttons. `TinyButton` (28×28 `.btn-icon`, matching the zoom controls) is used for the user icon and all panel close / clear-history buttons | Complete |
| 9   | **Status-bar redesign** — the center shows three shortcut hints: the active tool's digit shortcut swapped in, a hint that rotates every 5 minutes, and a pinned `Alt+/`. Removed the beta-version link (and the `/architecture` target), removed the `count / max` image count, and pinned the brand to one line                                                                                                                                                                         | Complete |
| 10  | **Responsive < 1000px** — the TopBar buttons collapse to icons-only and the zoom `%` hides; the toolbar narrows (296→260px) with smaller tool-grid icons                                                                                                                                                                                                                                                                                                                                 | Complete |
| 11  | **Auto-Compress progress → toast** — compression progress (with a bar) now surfaces in a `sonner` toast rather than an inline toolbar bar                                                                                                                                                                                                                                                                                                                                                | Complete |
| 12  | **UI polish** — Delete All moved into the gallery header (styled like the toolbar buttons); the gallery remove button is a trash-can on a red circle; gallery thumbnails show a shadcn hover tooltip (name · size · dimensions); the ToolsSidebar gained an `[icon] Toolbar … ✕` header mirroring the gallery                                                                                                                                                                            | Complete |
| 13  | **Removed the Architecture page** — deleted `marketing/src/pages/Architecture.tsx`, its route, and all five links to it (Nav, Footer, CTA, Hero, Shipped)                                                                                                                                                                                                                                                                                                                                | Complete |

## v3.0 Change Summary — 2026-06-12

| #   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Status   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| 1   | **Live text annotations** — text is no longer committed to canvas pixels at commit time. Each annotation lives as Rust state on `ImageHorseTool` (`Vec<TextAnnotation>`) with cached pre-rendered + pre-rotated tile pixels. Hit-test on click re-opens the existing text input pre-filled with content / font / color / rotation; submit updates in place; empty submit removes the annotation. Display path: `flushToCanvas` calls `render_with_annotations()` when count > 0 (cheap zero-count guard otherwise). Export paths auto-call `flatten_text_annotations()` so on-screen and exported pixels match. New `#[wasm_bindgen]` exports: `add_text_annotation`, `update_text_annotation`, `remove_text_annotation`, `text_annotation_at`, `text_annotation_count`, `get_text_annotations`, `render_with_annotations`, `flatten_text_annotations` | Complete |
| 2   | **Text Background panel** — new Background tab in TextSettings with three styles: None / Text BG (rounded rectangle) / Speech Bubble (rounded rect + triangle tail, 5 directions: Left / Right / TopLeft / BottomRight / BottomLeft). Background color picker, padding (0–40), corner radius (0–32, Rect only), tail direction (Bubble only), opacity (0–100). `TextAnnotation` gained 8 BG fields (`background_kind`, `bg_r/g/b/a`, `bg_padding`, `bg_corner_radius`, `bg_tail`); add/update annotation signatures expanded to 17/18 args                                                                                                                                                                                                                                                                                                             | Complete |
| 3   | Rust `drawing::fill_rounded_rect` — anti-aliased rounded rectangle fill via per-pixel distance test; `drawing::fill_triangle_public` wraps the existing scanline triangle rasterizer for speech-bubble tails. `build_annotation_tile` now expands the tile by padding + tail extent when BG is set, draws the background, composites text on top, then rotates the composed tile (rotation spins the whole bubble together)                                                                                                                                                                                                                                                                                                                                                                                                                            | Complete |
| 4   | **Line-and-dot move / rotate handles** — replaced V-shaped chevrons with stem + filled-circle "balloon" shapes inside the rotated SVG group. Top handle = move (native `cursor: move`, 4-arrow); bottom handle = rotate (custom data-URI SVG cursor showing a curved arrow with stacked 3.5px black-outer + 2.5px white-inner strokes for visibility on any background, falling back to `grab`)                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Complete |
| 5   | **Sticky text input** — the text editing box no longer closes when the user clicks a color swatch, font dropdown, or weight toggle in TextSettings. `onTextBlur` is now a no-op; a document-level `pointerdown` listener mounts while editing and only commits when the click target is outside the textarea, `[data-text-panel]` (TextSettings root), and `[data-text-overlay]` (text overlay block). Live preview updates inside the textarea via existing prop wiring; the Rust tile only re-renders on commit (performance choice)                                                                                                                                                                                                                                                                                                                 | Complete |
| 6   | **Text Extract removed** — `tesseract.js` dependency dropped from `app/package.json` + lockfile; `useTextExtract.ts` deleted; Rust `extract_region_png` removed (no callers); all `extractMouse{Down,Move,Up}` props pruned from AppShell / CanvasArea / ToolsSidebar; the TextSettings "Text Extract" tab removed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Complete |
| 7   | **AISettings panel** — new `app/src/features/tools/settings/AISettings.tsx` mounted when `activeTool === "ai"`. Four "Coming Soon" cards in priority order: Text Extract (OCR), Background Removal (rembg), 4× Upscale (Real-ESRGAN), Object Removal (SD Inpaint). Wired to the future Replicate / Convex pipeline; UI in place                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Complete |
| 8   | **Unified ColorSwatchGrid** — Paint, Shapes (both tabs), Arrows, and the Text Background tab now share the canonical `TEXT_COLORS` palette via the existing `ColorSwatchGrid` component (driven by `useUserColors` with localStorage persistence and cross-component sync via custom events; Rust `parse_color` parses hex / `rgba(...)` from the "+" popover). All inline `<input type="color">` callsites consolidated; the BatchSettings text-batch panel also adopted the shared grid                                                                                                                                                                                                                                                                                                                                                              | Complete |
| 9   | **Annotation persistence v2** — `editPersistence.SavedEdit` gained an `annotations` field (text + position + rotation + font + BG fields, no tile pixels); the Convex binary archive bumped to v2 with trailing JSON (v1 still decodes for back-compat). `loadFromSaved` re-creates annotations via `add_text_annotation` so the live overlay survives photo switches and signed-in cross-device sync                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Complete |
| 10  | **Gallery multi-select** — checkboxes appear on hover and stay visible for every thumb once at least one is selected. A `Delete N selected` action surfaces in the gallery header. `Set<photoId>` lives in `GalleryBar`; AppShell `handleDeleteSelected` mirrors the single-photo delete path (cleans `imageSavings`, `modifiedPhotos`, picks a new active photo when the active one is in the deletion set)                                                                                                                                                                                                                                                                                                                                                                                                                                           | Complete |

## v3.1 Change Summary — 2026-06-12

| #   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Status   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | **June Rust optimization pass** — `Arc<Vec<u8>>` for annotation `tile_pixels` (history snapshots no longer deep-clone megabytes of pre-rendered glyph buffers per stroke); `paste_region` opaque-source fast path (memcpy when `src alpha == 255`) + f32 channel blend; `paint_dab` / `apply_dab` f32 with `inv_radius` / `hard_r_sq` hoisted and sqrt skipped inside the hard zone; `resize_bilinear` f64 → f32; Gaussian kernel cached on `ImageHorseTool` (was rebuilt per blur dab at 60 Hz); `undo_stack` switched to `VecDeque` (`pop_front` instead of O(n) `remove(0)`); flips swap whole 4-byte pixels | Complete |
| 2   | **WASM binary 1.10 MB → 443 KB (−60%)** — Liberation Sans Regular + Bold subset via `pyftsubset` to Latin-1 + Extended-A + common punctuation (each .ttf 411 KB → 62 KB). The fonts were 65% of the binary                                                                                                                                                                                                                                                                                                                                                                                                      | Complete |
| 3   | **Zero-copy `flushToCanvas`** — the display blit constructs a `Uint8ClampedArray` view over WASM linear memory via `data_ptr()` / `data_len()` instead of cloning through `get_image_data()`; the view is rebuilt every flush (WASM memory growth invalidates old views). Falls back to `render_with_annotations()` only when live text annotations exist. `desynchronized: true` set on the 2D context                                                                                                                                                                                                         | Complete |
| 4   | **Rust resampling filters** — `resize_nearest`, `resize_catmull_rom` (B=0, C=0.5), `resize_lanczos3` (a=3) in `src/transform.rs`; separable two-pass with per-axis precomputed weight windows that widen on minification (Squoosh-style) to avoid aliasing. `ImageHorseTool::resize_with_filter(w, h, 0\|1\|2\|3)` pushes the same "Resize" snapshot; `resize()` delegates to bilinear                                                                                                                                                                                                                          | Complete |
| 5   | **Squoosh-style Resize panel** — new order: Resize → Scale % slider (proportional, derives from the width field) → Dimensions + Lock Aspect → hr → Compress → Method dropdown (Lanczos3 default) → Format dropdown (relocated from the TopBar; TopBar export button removed) → Quality → hr → Web Performance Gain → PageSpeed Insights Score → A/B Compare. Dropdowns match the Text tool's Font Family styling                                                                                                                                                                                                | Complete |
| 6   | **Apply Compression & Resize** (renamed from "Apply Resize and Quality") — resamples via the chosen Rust filter, re-encodes at the chosen format + quality (PNG via Rust `encode_png_pixels`, lossy via browser codec), writes the new file to IDB, deletes the replaced version, and updates the `PhotoEntry` (byteSize / mimeType / dims / thumbnail via `makeThumbnailFromPixels`) — so the StatusBar `size \| dims` readout and the gallery hover tooltip update in place. Enables on any width / height / quality / format / method change                                                                 | Complete |
| 7   | **PageSpeed Insights score** (renamed from Lighthouse) — `web_perf_metrics` now models PSI's three image audits: "Serve images in next-gen formats" via codec weight ratios folded into the byte projection (PNG 2.6× / JPEG 1.0× / WebP 0.8× / AVIF 0.6×), "Properly size images" via a linear score-only penalty for output wider than 1920 px, and "Efficiently encode images" via the existing quality scaling. Format dropdown changes move the score live                                                                                                                                                 | Complete |
| 8   | **A/B Compare fixed** — unlocks on any pending panel change (not only applied edits); compares against the immutable upload original via new `PhotoEntry.uploadKey` (never deleted by Apply); and the overlay now tracks zoom / pan: the box sync is rAF-deduped and driven by a `MutationObserver` on the canvas `style`/`width`/`height` attributes (CSS transforms never fire `ResizeObserver`) plus observers on the canvas and its offsetParent                                                                                                                                                            | Complete |
| 9   | **Responsive export buttons** — sidebar `Export {format}` / `Export All` drop their download icons under 1000 px                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Complete |
| 10  | **Test Images via UploadThing** — the upload dialog's Test Images set (12 royalty-free photos) is hosted on UploadThing, the same storage layer used for signed-in persistence                                                                                                                                                                                                                                                                                                                                                                                                                                  | Complete |
| 11  | **Marketing: Architecture page restored** — `marketing/src/pages/Architecture.tsx` rebuilt (typed) from the v2.0 backend diagram: client → single-binary WASM layer → Clerk auth tiers → API → UploadThing / Convex schema / Replicate → webhooks. The old Tier Strategy & Access Matrix section was intentionally left out — the live Pricing section is the canonical pricing sheet. Re-linked in Nav + Footer                                                                                                                                                                                                | Complete |
| 12  | **Marketing: GitHub + Codeberg buttons** — icon buttons beside "Beta Version →" in the nav linking to both forges; Codeberg also added to the footer                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Complete |
| 13  | Dead code removed per fallow — `TransformSettings.tsx`, `Uploaddropzone.tsx`, `UseBlurTool.ts`, `useConvexHistory.ts`, `useStoreUser.ts`, stale exports (`PALETTE`, `ARROW_COLORS`, `PAINT_COLORS`, `buttonVariants`, unused dialog/context-menu re-exports), the `ExportFormat` duplicate export, and the unused `autoprefixer` devDependency                                                                                                                                                                                                                                                                  | Complete |

## v3.2 Change Summary — 2026-06-13

| #   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Status   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | **Live shape & arrow annotations** — every shape (rect, circle, hand-drawn circle, line) and both arrow styles now commit as a `ShapeAnnotation` instead of rasterizing immediately. A `Vec<ShapeAnnotation>` lives on `ImageHorseTool` alongside the existing text annotations; `render_with_annotations` composites both layers on display; export paths flatten both. New `#[wasm_bindgen]` exports: `add_shape_annotation`, `update_shape_annotation`, `remove_shape_annotation`, `restore_shape_annotation` (history restore path), `shape_annotation_at` (hit-test), `shape_annotation_count`, `set_editing_shape`, `get_shape_annotations` (JSON) | Complete |
| 2   | **Reselect on click + move/resize/delete** — clicking a committed shape with the Shapes or Arrows tool active selects it (the SVG overlay re-renders around it); drag the body to move, drag corner squares to resize, drag endpoint circles to re-angle lines/arrows; clicking the trash button in the panel removes it. Commit lifecycle in `useDrawingTools.ts` includes select / remove / dirty-tracking and re-pushes the snapshot when the geometry changes                                                                                                                                                                                        | Complete |
| 3   | **Reselect list in HistoryPanel** — the right-side panel grew a Reselect section that lists every live text and shape annotation as a clickable row; clicking jumps the canvas selection to it; the trash icon removes it. The old TextSettings "Recent texts" list moved here so all live overlays share one home. The Reselect list is sourced from `get_text_annotations` + `get_shape_annotations` and updates on every annotation change                                                                                                                                                                                                            | Complete |
| 4   | **History threads shape annotations through undo/redo** — `Snapshot` in `src/history.rs` now carries `(data, width, height, text_annotations, shape_annotations)`. `undo()` and `redo()` take the current shape vec, swap it with the snapshot's, and return the restored one; every annotation-mutating call site in `lib.rs` pushes a snapshot with the current shape vec attached. A committed shape is undoable / redoable as one entry; reselecting and editing it pushes a new snapshot too                                                                                                                                                        | Complete |
| 5   | **Persistence v4** — `editPersistence.SavedEdit` and the Convex binary archive bumped to v4: the schema now serializes the shape annotation vec alongside the existing text annotations + raw pixels. `loadFromSaved` re-creates both lists via the Rust `restore_shape_annotation` + `add_text_annotation` paths so reopening a photo restores every live overlay. v1–v3 still decode for back-compat                                                                                                                                                                                                                                                   | Complete |
| 6   | **Fix: text rotate handle** — the rotate handle's drag math used a stale center reference when the text box was already rotated, drifting the angle on each adjustment. Recomputed from the current rotated transform every drag so dragging the rotate dot now produces a smooth rotation that holds                                                                                                                                                                                                                                                                                                                                                    | Complete |
| 7   | **Stamp dab f32 polish** — small follow-up in `src/stamp.rs` extending the June f32 / hoisted-sqrt pass to the dab kernel's edge case, removing a residual `f64 → f32` cast in the inner loop                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Complete |

## v3.3 Change Summary — 2026-06-16

| #   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Status   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | **History panel → Review panel** — `HistoryPanel.tsx` renamed to `ReviewPanel.tsx`; the top-bar toggle (and Alt+H) now reads **Review**. The panel header is `Review` (left) + ✕ close (right), then a toggle group, then the body                                                                                                                                                                                                                                                                                                                      | Complete |
| 2   | **Three toggleable sections** — a header toggle group opens **History**, **Reselect**, and **Layers** independently. The body splits its height evenly among the open sections — 1 open = full, 2 = halves, 3 = thirds — each with its own top divider, header (name left; count box + controls right), and scroll area. All three open on load                                                                                                                                                                                                         | Complete |
| 3   | **History section** — the undo/redo timeline, with an inline **Undo** button plus the step-count box in its header (no clear-all; ✕ on the other sections closes them instead)                                                                                                                                                                                                                                                                                                                                                                          | Complete |
| 4   | **Reselect section** — the live text + shape annotation list (unchanged behavior): click a row to re-select on canvas, hover the ✕ to delete                                                                                                                                                                                                                                                                                                                                                                                                            | Complete |
| 5   | **Layers section** — **Coming soon** placeholder, centered. Count box pinned to `0`; disabled **+** (add) and **trash** (delete) buttons sit beside it as a preview of the future layer controls                                                                                                                                                                                                                                                                                                                                                        | Complete |
| 6   | **Shared `ToggleButtonGroup`** — new `app/src/components/ui/toggle-button-group.tsx` multi-select button group (independent on/off per button). The top bar's Upload / Tools / Gallery / Review cluster and the Review panel's History / Reselect / Layers cluster both render through it. Props: `compact` (icon-only), `noIcons` (label-only — used in the narrow panel so "Layers" isn't clipped), `fill` (stretch evenly), optional per-item tooltip. The active state uses the neutral `bg-accent` (`#2b2b2b`), not the cream `--accent` highlight | Complete |

## v3.4 Change Summary — 2026-06-16

| #   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Status   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | **Compress is the first tab in the Resize tool** — the panel's `TabGroup` order flipped from `Resize \| Compress` to `Compress \| Resize`, and the default tab on open is now `compress`. Toolbar hover tooltip + description renamed `Resize & Compress` → `Compress & Resize` to match. The label under the icon stays "Resize" (short label)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Complete |
| 2   | **360° speech-bubble tail** — `bg_tail` upgraded from a `u8` enum (0–5 discrete directions) to a `u32` **angle in degrees** (0–359) across the whole stack. `build_annotation_tile` reserves a uniform tail margin on all four sides and projects a ray from the bubble center onto the rect's edge (`t = min(hw/\|cos\|, hh/\|sin\|)`), placing the tail base at that exit point with the apex `TAIL_LEN` further along; perpendicular `TAIL_HALF` spread for the base. Updated everywhere: `TextAnnotation` field, `build_text_annotation`, the two history-push helpers, `add`/`update_text_annotation`, plus `CanvasArea.tsx` live preview using identical math so preview and committed pixels match. `ToolButtonGroup` swapped for a `SizeSlider`; default 135° (down-left)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Complete |
| 3   | **Background tab rename** — TextSettings second tab labeled `Background` (was `Text Background`); the "Background Color" / "Padding" / etc. labels carry the rest of the context. Corner Radius hardened into 3 presets (`Square` / `Rounded` / `Circle`) so the bubble tail geometry stays flush at any radius                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Complete |
| 4   | **Centralized tier config** — new `app/src/lib/tiers.ts` is the one place per-tier capabilities live (`galleryLimit`, `storageQuotaBytes`, `layersPerImage`, `aiDailyRuns`, etc.), keyed by `UserMode`. Mirrors the public Pricing matrix on the marketing site; the Rust `photo_limit` export is kept in sync as the WASM-layer source of truth. Components now read from `TIERS[userMode]` instead of hardcoding numbers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Complete |
| 5   | **Dev tier switcher (Alt+L)** — new `DevTierDialog.tsx` lets the developer flip between `No Login` / `Free` / `Paid` tier modes for testing. Triggered by **Alt+L** (added as `onToggleDevTier` in `useKeyboardShortcuts`), shown only in dev builds. Includes UX iteration on the trigger — previously discussed Alt+P was changed to Alt+L to avoid conflict with the existing print shortcut                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Complete |
| 6   | **Gallery Unselect button** — when any photos are selected, a new `Unselect` button (SquareX icon) appears in the gallery header after Delete All, alongside Export Selected / Delete Selected. Threads new optional prop `onClearSelection` through to AppShell's existing `clearSelection` callback. Selection state lives in React (`selectedIds` set in AppShell) — selection is pure UI, no Rust round-trip                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Complete |
| 7   | **Modified-dot race fix** — clicking an unedited photo no longer briefly flashes the white "modified" dot on it. Root cause: `setActivePhotoId(new)` ran synchronously before the awaited `loadPhotoEdit`, leaving the _outgoing_ photo's `undoCount > 0` while `activePhotoId` already pointed at the _incoming_ one — the dot-marking effect attributed that count to the new photo. Fix: `setIsImageLoading(true)` moved _before_ the first await in `handleSelectPhoto`, and the dot effect bails with `if (isImageLoading) return;` (with `isImageLoading` added to its deps)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Complete |
| 8   | **Transform spacing fix** — the "Transform" heading in the Crop tool's panel moved closer to its Flip H / Flip V / Rotate buttons (`gap-5` → `gap-2`), so the label-to-buttons spacing matches the "Ratio" → ratio-button rhythm used elsewhere in the same panel                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Complete |
| 9   | **Marketing: Trail → Trail Log** — the changelog page (formerly Shipped, then Trail) now reads **Trail Log**. Route `/trail` → `/trail-log`; Nav and Footer labels + page eyebrow all updated. Component/file internally still `Trail` (purely internal — the public URL and labels are what change)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Complete |
| 10  | **Drawing coverage helpers** — `src/drawing.rs` gains three public coverage helpers: `rounded_rect_coverage` (per-pixel α for an AA rounded rect), `triangle_coverage` (per-pixel α for an AA triangle), and `blend_coverage` (Porter-Duff source-over given coverage). Foundation work for the bubble-tail flushness fix and future shape-edge AA improvements                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Complete |
| 11  | **New Pens tab — Pins + Freehand** — the Shapes tool grew a third tab between `Shapes` and `Arrows`. **Pins** mode drops auto-numbered callout discs (1, 2, 3…) on click, with a `Pin Size` slider (16–72 px) and a click-to-move on existing pins. **Freehand** mode draws a thick, round-capped polyline pen stroke on drag, with a `Stroke Width` slider. Both share the colour swatch. Rust gains two new shape kinds (`5 = pin`, `6 = polyline`) with `add_pin_annotation` / `restore_pin_annotation` and `add_polyline_annotation` / `restore_polyline_annotation` APIs, plus `render_pin` (filled disc + centred ab_glyph number) and `drawing::draw_polyline` (round-capped segment loop) / `drawing::fill_circle`. `ShapeAnnotation` extended with `number: u32` (pin label) and `points: Vec<(f64, f64)>` (polyline vertices); `get_shape_annotations` JSON, `PersistedShape`, and the persistence restore path all extended to round-trip them. The live freehand preview is drawn in JS during the drag and committed to Rust on mouseup. Hit-testing extended: polylines test against each segment; pins fall under the existing padded-bbox path. Pins reselect as a circle handle but keep their `kind=5` on commit via a new `kindByte` override in `DrawEditState.style`; polylines are delete-only (no bbox handle) via the Reselect panel                                                                                 | Complete |
| 12  | **AI Tools: Background Removal goes live (Replicate + Convex pipeline)** — the AI panel's first model is no longer a placeholder. New `useAIJob` hook drives a single end-to-end job: export current canvas to PNG → `generateUploadUrl` → POST to Convex storage with `Content-Type: image/png` → call `api.ai.dispatch({ photoKey, type: "rembg", inputStorageId })` → subscribe to `api.aiJobs.getJob(jobId)` via `useQuery` → when the webhook flips status to `done`, fetch `outputUrl`, decode via `createImageBitmap` → 2D canvas → ImageData, and hand RGBA pixels back. AppShell's new `handleAIResult` calls `loadImageFromPixels` to swap the working image and marks the photo modified. Phase state machine (`idle` / `uploading` / `running` / `done` / `error`) drives button copy ("Uploading…" / "Removing background…" / "Remove Background"). A `consumedRef` guard prevents a re-render from decoding the same finished job twice. Gating: the panel is gated by `hasReplicateAI(effectiveUserMode)` from `lib/tiers.ts` — non-Paid users see a Lock notice ("AI tools run on Replicate and are a Paid feature"); the button is disabled when `!aiEnabled` or no active photo. ToolsSidebar threads a new `aiEnabled` prop through to `<AISettings>`. The remaining models (Text Extract / 4× Upscale / Object Removal / Alt Text) keep their `COMING_SOON` placeholder cards until the same plumbing is cloned for each | Complete |
| 13  | **Auto Compress split into Selected / All buttons** — the Resize panel's bottom section was reorganised: a centred `⚡ Auto Compress` label sits over a 2-button grid (`Selected Image` / `All Images`), then an `<hr>`, then `Apply Compression & Resize` and `Show A/B Compare` below. The `onAutoCompress` callback gained a `scope: "selected" \| "all"` arg threaded through `ResizeSettings` → `ToolsSidebar` → `AppShell`. `AppShell.handleAutoCompress(scope)` resolves the target set as: `scope === "all"` → every photo; `scope === "selected"` → the checkbox multi-selection when one exists, otherwise just the active photo in the ring (so "Selected Image" is meaningful even with zero checkboxes). Button label pluralises to `Selected Images` when `selectedCount > 1`. `Selected Image` only disables on `isCompressing` / `disabled`, not on `selectedCount === 0`. `activePhotoId` added to the `useCallback` deps so the ring-fallback path stays current                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Complete |

## v3.5 Change Summary — 2026-06-17

| #   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Status   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | **Photoshop-style layers** — `ImageHorseTool` now holds a `Vec<Layer>` stack + active index instead of a single buffer. Each `Layer` (`id, name, visible, opacity, buf, text_annotations, shape_annotations`) owns its pixels **and** its own live overlays, so every canvas tool (paint, clone stamp, blur, brightness/contrast, text, shapes, emoji, paste) edits the active layer. The canvas shows the composite of all visible layers, blended bottom→top source-over by opacity. v3.5 ships opacity + visibility only (normal blend)                                                                                                                                        | Complete |
| 2   | **Layer-management API** — `add_layer` / `duplicate_layer` / `remove_layer` / `set_active_layer` / `move_layer` / `merge_down` / `flatten_all` / `set_layer_visible` / `set_layer_opacity` / `rename_layer` / `get_layers` / `layer_count` / `active_layer_id`, plus `composite_layers(_into)` + `recomposite()` (reused cache + single-opaque-layer fast path) and a `set_editing_text` suppressor mirroring `set_editing_shape`. `export_png` / `get_image_data` / thumbnails composite the whole stack so export == screen                                                                                                                                                     | Complete |
| 3   | **Full-stack undo/redo** — `history.rs` `Snapshot` now stores the entire layer stack (`layers` + `active` + dims), making add / delete / reorder / merge undoable alongside pixel edits. `jump_to` reimplemented in `lib.rs` as an undo/redo loop; the clone-stamp engine takes a pre-built snapshot. `ImageBuffer` is now `#[derive(Clone)]`                                                                                                                                                                                                                                                                                                                                     | Complete |
| 4   | **Layers panel** — the Review sidebar's "Coming soon" Layers placeholder is now a working stack list (top→bottom): visibility eye, inline rename (double-click), reorder, duplicate, merge-down, delete, and a per-layer opacity slider; tier-gated via `TIERS[userMode].layersPerImage` (locked for demo). `useCloneStamp` mirrors `get_layers()` into hook state and exposes layer wrappers                                                                                                                                                                                                                                                                                     | Complete |
| 5   | **Paste into the active layer** — `Ctrl/Cmd+V` reads a clipboard image, decodes it to RGBA, and composites it into the active layer (centered) as one undoable "Paste". Guarded against the UploadDialog's paste-as-new-photo path (and against text inputs)                                                                                                                                                                                                                                                                                                                                                                                                                      | Complete |
| 6   | **Persistence v5** — `SavedEdit` gained `layers[] + activeLayerId`; `collectLayers()` reads the stack out of WASM for both the IDB and Convex paths. The Convex binary archive bumped v4→v5 (per-layer block: id, name, visible, opacity, pixel PNG, text+shape JSON, + active id). Rust serialize (`get_layer_png` / `get_layer_*_annotations`) + history-free restore (`begin_layer_restore` → `push_restored_layer` → `restore_text_annotation`/`restore_shape*` → `finish_layer_restore`). v1–v4 archives still decode, collapsing to a single layer. Known limitation: history snapshots persist composited single-layer, so undoing past a reload shows the flattened image | Complete |
| 7   | **Extra-small button variant** — `TinyButton` gained `size="xs"` (`.btn-icon-xs`, 20×20 / 12px icon) reusing all `.btn-icon` surface/hover/disabled rules. Drives the dense layer-row controls (always-visible bg, hover ring, light icon); the eye keeps its open/closed icon swap in the panel rather than as a button variant                                                                                                                                                                                                                                                                                                                                                  | Complete |
| 8   | **Layer count fix** — the Layers header number box showed the tier _limit_ (`layersShort`, e.g. "3") regardless of how many layers existed; it now shows the live `layers.length` (consistent with the History/Reselect counts), with the per-tier allowance moved into the tooltip                                                                                                                                                                                                                                                                                                                                                                                               | Complete |
| 9   | **Keyboard activation (a11y)** — Tab-focusing a button and pressing **Space/Enter** now activates it. The global spacebar-pan handler was `preventDefault`-ing Space for every focused element; it now bails for buttons, links, and ARIA widgets (`isActivatable`), and only consumes Space on keyup if pan actually started. Also covers `contentEditable`                                                                                                                                                                                                                                                                                                                      | Complete |
| 10  | **Text edit double-box fix** — selecting/reselecting a text annotation no longer shows a doubled copy of the baked tile under the textarea overlay. New `editing_text_id` + `set_editing_text` suppress the in-edit annotation from the composite (mirroring `editing_shape_id`); wired through `useTextTool` on edit-open / commit / Escape-cancel / stale-drop                                                                                                                                                                                                                                                                                                                  | Complete |
| 11  | **Text rotation fix** — two bugs: (a) the overlay rotated around the JS box center while Rust baked around the text center → the editing box now rotates around the Rust tile's pivot (measured via `measure_text`; uniform BG padding keeps the padded-tile center coincident with the text center); (b) `build_annotation_tile` negated the angle into `rotate_pixels`, which is actually clockwise in screen coords like the CSS preview — so a +90° rotate baked as −90°. Removed the negation. Committed text now matches the preview in direction and position                                                                                                              | Complete |
| 12  | **Shortcut modal** — the `Alt+/` reference now lays each section out in **two columns** under its header (modal widened 520→760px) and lists **Alt+Delete → Toggle Diagnostics Log**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Complete |

## v3.6 Change Summary — 2026-06-18

| #   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Status   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | **Blank Canvas → Rust "New Document" panel** — clicking **Blank Canvas** in the upload dialog swaps the action buttons for a Photoshop-style setup panel (animated in via a new `panelSwap` variant under `<AnimatePresence mode="wait">`, with a stable modal `min-h` so the swap doesn't jerk): width/height fields (default 1500×1000), page-size presets (FHD / Square / Story / 4×6 / 5×7 / 8×10) through the shared `ToolButtonGroup`, and a background chooser — White / Black / any hex via `ColorSwatchGrid`, plus a **Transparent** toggle. The image is generated entirely in Rust: new `#[wasm_bindgen] blank_png(w, h, r, g, b, a)` fills a solid (or transparent, `a = 0`) RGBA buffer and PNG-encodes it via `codec::export_png` — no JS `<canvas>`/`toBlob` round-trip — and the color is parsed in Rust (`parse_color`) | Complete |
| 2   | **Gallery: Duplicate selected** — when photos are selected, a **Duplicate** button (Copy icon) joins Export / Delete Selected. Originals are content-addressed (SHA-256), so the copies reuse the same `originalKey`/`thumbBlob` (zero pixel copy) and each lands right after its source. The source's persisted edit archive is cloned to the new photo id via new `copyPhotoEdit` (`editPersistence.ts`), exposed as `duplicatePhotoEdit` from `useEditPersistence`, so duplicates carry their edits; respects the tier cap                                                                                                                                                                                                                                                                                                            | Complete |
| 3   | **Shortcut remap** — **Tools → `Alt+T`** (was `Alt+S`), **Review panel → `Alt+R`** (was `Alt+H`), **Rotate 90° CW → `Alt+S`** (was `Alt+R`). The `Alt+/` modal and the TopBar hover tooltips were updated to match                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Complete |
| 4   | **Spacebar-pan fix (v3.5 keyboard-activation regression)** — clicking a tool button left it DOM-focused, and the new activation guard then swallowed Space (re-firing the tool) instead of panning. The guard now defers Space to a focused control only when it's `:focus-visible` (keyboard/Tab focus); a mouse click focuses a button but not focus-visible, so Space falls through to pan. Enter still always activates                                                                                                                                                                                                                                                                                                                                                                                                              | Complete |
| 5   | **Hidden Dev Tools unlock** — a blank, unlabeled `TinyButton` tucked into the status bar; three clicks unlock the **Diagnostics Log** (`Alt+Delete`) and the **user/tier selector** (`Alt+L`) in production builds (previously dev-only) and reveal a **Dev Tools** section at the bottom of the `Alt+/` modal. Gated via `devToolsEnabled = import.meta.env.DEV \|\| devToolsUnlocked`                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Complete |
| 6   | **Perf: one decode per upload** — `handleAddPhotos` built the gallery thumbnail with a second full-res `createImageBitmap(file)`. It now derives the thumbnail from the already-decoded working-copy pixels via `makeThumbnailFromPixels` + Rust `resize_pixels`, so every upload decodes once instead of twice and the downscale runs in Rust                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Complete |
| 7   | **Delete All dialog + theme fix** — the confirm dialog's buttons now use the app's `LargeButton` (dark elevated; destructive action red-tinted) instead of the shadcn primary. Root-caused the invisible-on-hover Cancel text: `--color-accent-foreground` was defined twice in `styles.css` and the later (dark `#3a3128`) value won, so `hover:text-accent-foreground` painted dark-on-dark on the dark `bg-accent`. Removed the duplicate — fixes every outline/ghost button hover                                                                                                                                                                                                                                                                                                                                                    | Complete |
| 8   | **Gallery count + tier tooltip** — the header count reads `3 of 3 — 12 max` (idle) and `Selected: 2 of 3` (selecting) instead of the cluttered `1 of 2 / 12`. An `(i)` next to the cap shows the per-tier session limits (Logged out 12 · Logged in 24 · Paid 100), read live from `TIERS`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Complete |
| 9   | **Sonner compress toast — full width** — the Auto-Compress progress toast's content shrank to ~70% because sonner's `[data-content]/[data-title]` wrappers size to content in `unstyled` mode. Added `content: flex-1 min-w-0` + `title: w-full` to the Toaster classNames so the node fills the toast; the bar bleeds edge-to-edge (`-mx-4` over the toast padding) and the count sits true space-between                                                                                                                                                                                                                                                                                                                                                                                                                               | Complete |
| 10  | **Upload dialog redesign** — actions reordered (Browse / Paste, then Sample Images / Blank Canvas); the disabled "Log In" tile replaced by Blank Canvas and the sign-in icon moved to the top-left corner (mirroring the close ✕, via `UserMenu`); the drag hint, upload circle, and supported-formats line wrapped in a **dotted drop zone** that highlights + nudges on drag. **"Test Images" → "Sample Images."** The default view's bottom footer now holds three links — **Website / GitHub / Codeberg** (the latter two as `LargeButton`s, with an inline `CodebergIcon`) — hidden on the Blank Canvas panel                                                                                                                                                                                                                       | Complete |
| 11  | **TopBar centering + Review header** — the four panel toggles are now truly centered on the bar via `grid-cols-[1fr_auto_1fr]` (the old `flex-1 justify-center` centered them only within leftover space, pushing them right). The Review panel header was restyled to match the Toolbar/Gallery headers (a `History` icon + the shared `text-xs font-semibold` heading)                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Complete |

## v3.7 Change Summary — 2026-06-18

| #   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Status   |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | **AI tools live on Replicate** — `convex/ai.ts` holds a model registry and the `dispatch` action uploads the current frame to Convex storage, POSTs a prediction to Replicate with a completion webhook (`/replicate-webhook` in `http.ts`), pulls the output back into storage, and streams it to the canvas via `useAIJob`. **Background Removal** (`cjwbw/rembg`) and **Text Extract / OCR** (`abiruyt/text-extract-ocr`) are live; the webhook branches on `job.type` so text models persist their string output instead of being fetched as an image                                       | Complete |
| 2   | **Object Removal (LaMa inpaint)** — `zylim0702/remove-object` wired with mask support: `dispatch` → `startJob` thread an optional `maskStorageId` (resolved to a signed URL and stored on the job row), and a self-contained `ObjectRemovalModal` lets the user brush over an object, binarizes the strokes into a black/white mask at native resolution, and uploads image + mask together. `useAIJob.run` gained an optional mask PNG arg                                                                                                                                                     | Complete |
| 3   | **Stripe billing (Pro, $10/mo)** — `convex/stripe.ts` exposes `createCheckoutSession` + `createPortalSession` actions (raw Stripe REST, no SDK). A signature-verified `/stripe-webhook` route (Web Crypto HMAC) maps `checkout.session.completed` and `customer.subscription.*` events back to the Convex user via session metadata and calls `subscriptions.fulfill` (internalMutation) to upsert the subscription row and flip `users.tier`. A **Settings gear** beside the avatar opens a **Plan & Billing** modal (`SubscriptionButton`) with Upgrade (Checkout) / Manage (Customer Portal) | Complete |
| 4   | **Sign-in creates the user row** — new `useStoreUser` hook upserts the Convex `users` row once `useConvexAuth` reports authenticated. Previously nothing ever called `users.upsert`, so logging in created no row and tier / subscription / AI-gating had nothing to read                                                                                                                                                                                                                                                                                                                       | Complete |
| 5   | **Oversized-upload guard** — `makeWorkingCopy` / `makeThumbnail` reject images above 100 MP (typed `ImageTooLargeError`) right after the `createImageBitmap` probe, before the full-res decode can OOM the tab; `handleAddPhotos` surfaces it as a toast                                                                                                                                                                                                                                                                                                                                        | Complete |
| 6   | **Anonymous-edit cleanup cron hardened** — `expireSessionEdits` switched from a non-indexed `.filter().collect()` (a full table scan that silently fails past Convex's per-mutation read limit) to an indexed `by_updatedAt` range scan bounded by `.take(2000)`, so it keeps reclaiming abandoned storage blobs as the table grows                                                                                                                                                                                                                                                             | Complete |

## v3.8 Change Summary — 2026-06-18

| #   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Status   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | **Shape fill + linear gradient** — rect/circle shapes gain an interior fill in the Shapes panel: **None / Solid / Gradient**, reusing `ToolButtonGroup` + `ColorSwatchGrid`/`TEXT_COLORS` (one swatch for solid; From/To swatches + a →↓↘↙ direction picker for gradient). `ToolSettings` grew `fillMode`/`fillColor`/`fillColor2`/`gradientAngle`. Fill is committed only for rect (0) / circle (1). The live `CanvasArea` drag preview renders the fill / gradient via an SVG `<linearGradient>`                                                                    | Complete |
| 2   | **Fill rendering + persistence in Rust** — `ShapeAnnotation` gained `fill_kind` (0 none / 1 solid / 2 linear gradient), fill + stop-2 RGBA, and `fill_angle`; `render_shape_into` paints the fill **before** the stroke and new `drawing::fill_shape` does solid + per-pixel linear gradient (source-over). Threaded through `add_/update_/restore_shape_annotation`, the `get_shape_annotations` JSON, and `PersistedShape` (old saves restore as no-fill), so fills round-trip through save and undo/redo. +3 Rust unit tests (solid / none / gradient-across-axis) | Complete |
| 3   | **Reselect preserves fill** — `selectShape` now captures a shape's fill into `DrawEditState.style` and `commitEdit` prefers it (`es.style?.fill… ?? settings`), exactly like `strokeColor`, so moving/resizing a reselected rect/circle no longer swaps its fill to the panel's current setting; the overlay previews a reselected shape's fill too                                                                                                                                                                                                                   | Complete |
| 4   | **Distinct Review icon** — the TopBar **Review** toggle uses a magnifying-glass (`Search`) icon instead of `History`, removing the collision with the History section's icon                                                                                                                                                                                                                                                                                                                                                                                          | Complete |
| 5   | **Thumbnail sampling: gamma + premultiplied alpha** — `ImageBuffer::sample_bilinear` now interpolates in linear light (sRGB transfer removed) with premultiplied alpha, then un-premultiplies and re-encodes, fixing midtone darkening on downscale and transparent-edge color fringing. Scoped to thumbnails (its only caller). +3 unit tests                                                                                                                                                                                                                        | Complete |
| 6   | **Configurable red-stamp angle** — the `−5°` rubber-stamp tilt is now an `angle_deg` parameter threaded through `render_stamp_label` → `commit_red_stamp` (JS passes `STAMP_ANGLE_DEG`, unchanged default), ready for a future UI control                                                                                                                                                                                                                                                                                                                             | Complete |
| 7   | **Safe crop returns** — `constrain_crop_to_ratio` / `compute_aspect_crop` now return `Option<Vec<u32>>` (→ `undefined` in JS) instead of a silent empty array on invalid input; both JS callers guard explicitly so a malformed call can't quietly destructure a zero-size crop                                                                                                                                                                                                                                                                                       | Complete |

## v3.9 Change Summary — 2026-06-23

| #   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Status   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | **Blur-brush modes — Gaussian / Pixelate / Solid** — the Effects blur brush gains a mode control. Keeps Gaussian; adds **Pixelate** (grid-aligned mosaic, adjustable block size) and **Solid** (opaque redaction color). New Rust `filters::pixelate_region` / `redact_region` + `pixelate_region` / `redact_region` / `begin_pixelate_stroke` / `begin_redact_stroke` bindings; `ToolSettings` grew `blurMode` / `pixelSize` / `redactColor`; `AppShell` blur-brush handlers dispatch on `blurMode`                                                                                                      | Complete |
| 2   | **Redaction boxes — drag-rectangle, re-selectable** — modeled as a rect-shape fill rather than a new shape kind: `fill_kind` gains `3 = pixelate` and a `fill_block` field, so a redaction box inherits History, Reselect, Layers, and resize/move handles like any other bounding box. Solid redaction = rect + solid fill + `stroke_width 0`; pixelate mosaics the layer pixels beneath it in `render_shape_into` / `fill_shape`. Threaded through `add_/update_/restore_shape_annotation`, the shapes JSON, `PersistedShape`, and `selectShape`/`commitEdit` (so the mode/block size survive reselect) | Complete |
| 3   | **Diagnostics Window (Alt+Delete) — Telemetry + Resources tabs** — the dev overlay is retitled **Diagnostics Window** (header + `ShortcutModal`) and split into **System Telemetry** (the existing event log) and a new **Resources** tab. Backdrop lightened to `bg-black/40` with the blur removed so the editor stays legible behind it                                                                                                                                                                                                                                                                | Complete |
| 4   | **htop-style Resources monitor** — `ResourceMonitor.tsx` + `lib/resourceMonitor.ts`: live CPU/main-thread load + FPS (via `requestAnimationFrame`), JS heap (`performance.memory`), the WASM engine's live linear-memory size, and a per-subsystem process list (WASM_ENGINE / UI_THREAD / CONVEX_DB / REPLICATE_AI / CONSOLE) derived from the diagnostics ring buffer. `useCloneStamp` calls `registerWasmMemory(...)` at each engine (re)init so the monitor reads real memory without a second WASM instance; sampling halts when the tab isn't visible                                               | Complete |
| 5   | **Review panel header icon** — the Review panel header now uses the `Search` magnifying glass, matching the TopBar Review toggle (was the `History` clock); `History` stays imported for the History sub-section toggle                                                                                                                                                                                                                                                                                                                                                                                   | Complete |
| 6   | **Security hardening** — the Replicate webhook verifies its signature (Web Crypto HMAC) and fails closed, and allowlists the result host (SSRF guard); `generateUploadUrl` is gated behind `requireUser`; `subscriptions.upsert` is now an `internalMutation`; dead anonymous-session endpoints were removed; Clerk/convex bumped                                                                                                                                                                                                                                                                         | Complete |
| 7   | **Stopped tracking build output** — `www-dist/` is now gitignored (was committed), so the deployed bundle is rebuilt by CI instead of living in git history                                                                                                                                                                                                                                                                                                                                                                                                                                               | Complete |

## v4.0 Change Summary — 2026-06-23

| #   | Change                                                                                                                                                                                                                                                                                                                                    | Status   |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | **Diagnostics Window polish** — the overlay is now centered and a fixed `h-[80vh]` tall, so **System Telemetry** and **Resources** are the same height; a light `backdrop-blur-[3px]` sits behind it; System Telemetry scrolls within the fixed height; and the tab's `(count)` badge uses higher-contrast colors (`text-zinc-300`/`400`) | Complete |
| 2   | **Alt+Delete always available** — the Diagnostics Window is no longer gated behind the dev-tools unlock: `setShowDiagnostics` is always wired in `useKeyboardShortcuts` and `<DiagnosticLogOverlay>` always mounts, so the shortcut works on every boot                                                                                   | Complete |
| 3   | **Shortcut-menu sections** — "Toggle Diagnostics Window" now lives in an always-shown **Dev Tools** group; the **Secret Menu** group (the `Alt+L` User / Tier Selector) only appears — and only works — after the status-bar triple-click unlock                                                                                          | Complete |

## v4.1 Change Summary — 2026-06-23

| #   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Status   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | **Current Image Meta tab (Diagnostics Window)** — a third tab beside System Telemetry / Resources (`ImageMetaPanel.tsx`). Shows a live **canvas SHA-256** (recomputed on open, with copy + refresh), the **original SHA-256** content key, name / MIME / photo key, original vs current dimensions and byte sizes (with a compression delta), canvas-PNG size, and undo/redo + modified state. The canvas hash fingerprints the exact pixels inside the archive uploaded to Convex storage     | Complete |
| 2   | **EXIF readout in Current Image Meta** — a dependency-free TIFF/EXIF parser (`lib/exif.ts` → `parseExifFromImage`) reads the _true_ original (`uploadKey`, not the possibly re-encoded `originalKey`) and surfaces camera make/model, lens, capture time, exposure (shutter · aperture · ISO · focal length), orientation, software, and GPS as a clickable map link — with an amber nudge when location is embedded                                                                           | Complete |
| 3   | **EXIF padlock on export** — a lock toggle below Quality in the Compress panel (reuses the aspect-lock button + Clone Stamp badge). **Locked = EXIF intact** (verbatim originals pass through; re-encoded JPEG/WebP get their original EXIF transplanted back); **Unlocked = EXIF stripped** (GPS / time / camera removed). Governs Export, Export All, and Export Selected, closing the gotcha where untouched originals shipped their GPS verbatim in the ZIP                                | Complete |
| 4   | **EXIF muxer (`lib/exif.ts`)** — dependency-free, fail-safe metadata handling: JPEG (strip APP1/APP13 + inject EXIF after SOI), PNG (strip text / eXIf / tIME chunks), and WebP (strip / inject the EXIF chunk, upgrading simple files to VP8X and reading the VP8L alpha bit). PNG/AVIF stay clean since they can't carry standard EXIF; every op falls back to the input rather than emit a corrupt image. `useCloneStamp` gained `exportBlob()` so AppShell applies the policy pre-download | Complete |

## v4.2 Change Summary — 2026-06-23

| #   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                       | Status   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | **Firefox draw-stability fix** — `flushToCanvas` no longer hands `putImageData` an `ImageData` backed by live WASM linear memory. A later `memory.grow()` (undo snapshots accumulating ≈ stroke 5-8) detached that shared `ArrayBuffer`, and Firefox's desynchronized present read it stale → garbage. It now copies the composite into a reused, JS-owned backbuffer first                                                                  | Complete |
| 2   | **Pins tool (renamed from Pens)** — dropped the freehand sub-mode and its top toggle; the panel is now Stroke-Width → label-style → colour. New **Numbers / Letters** toggle (Rust `ShapeAnnotation.label_kind`, spreadsheet-style A…Z, AA…); labels are **centred by visual ink-bounds** in `render_pin` (not the padded glyph box); pin diameter follows the Stroke Width slider. Old freehand saves still load                            | Complete |
| 3   | **Paint stroke stabilizer** — pulled-string "lazy mouse" smoothing with an **Off / Low / Med / High** strength toggle (leash 0/12/22/36 px). The trailing-tip math + state live in Rust (`paint_stab_begin` / `paint_stab_to` / `paint_stab_flush`); `usePaintTool` maps strength → leash and catches up to the cursor on mouse-up                                                                                                           | Complete |
| 4   | **"New" panel + Alt+N** — the top-bar **Upload** toggle is now **New** (it also creates blank canvases), and its shortcut moved from Alt+U to **Alt+N** (`useKeyboardShortcuts`, `TopBar`, `ShortcutModal`)                                                                                                                                                                                                                                  | Complete |
| 5   | **Download chooser** — the two export buttons collapsed into one **`Download {FORMAT}`** button (pluralized when the gallery has >1 photo) that opens a **Selected / All / Cancel** dialog noting multi-image exports come as a `.zip`                                                                                                                                                                                                       | Complete |
| 6   | **Unified dialog system (`ui/dialog.tsx`)** — app surface (`bg-bg-secondary`, `border-border`, `rounded-xl`), the close control is now a `TinyButton`, the accent focus ring is gone (X ring removed + `onOpenAutoFocus` prevented), and `DevTierDialog` switched to `LargeButton`. Hits Delete-All, the new Download chooser, and DevTier                                                                                                   | Complete |
| 7   | **Toolbar redesign** — `ToolsSidebar` is **260px** (matches the Review panel); the ten tool tiles are fully spatial (`aspect-square w-full` in `1fr` columns, %-sized icons), neutral/monochrome with **only the active tool coloured**, plus the warm-accent hover ring restored                                                                                                                                                            | Complete |
| 8   | **Settings-panel consistency** — smaller dropdown font (`text-xs`); halved the gap below each panel's tab switch and pulled the switch up to the divider (`-mt-2`); `SizeSlider` dots variant compacted; **Opacity** sliders gained matching preset dots; every N-button picker (`ToolButtonGroup` + the Quick-Adjust / Transform action grids) uses `grid-auto-rows:1fr` so all buttons equalize to the tallest (i18n-safe for long labels) | Complete |
| 9   | **Panel-gutter single source of truth (`lib/layout.ts`)** — TopBar padding, canvas `main-content` margin, and the gallery margin all read `PANEL_OPEN_GUTTER` (= 284), fixing a stale `320` (the old 296px toolbar) that left the canvas/checkerboard and gallery mis-aligned on the toolbar side when panels were open                                                                                                                      | Complete |
| 10  | **Marketing** — hero image fixed (`June-2.webp` copied into `marketing/public`); Features cards updated (stabilizer, Pins numbers/letters, redaction, EXIF privacy); Trail Log gained a **sticky month-filter** pill toggle                                                                                                                                                                                                                  | Complete |

## v4.3 Change Summary — 2026-06-24

| #   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Status   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| 1   | **Settings menu + shared `Modal`** — new `ui/Modal.tsx` is portaled to `<body>` (so it escapes the transformed framer-motion TopBar), at the keyboard-shortcut sheet's size on the app surface, with a `TinyButton` close and optional toolbar/footer. The Diagnostics Window moved onto it, and the cog now opens a **GNOME-style Settings modal** — a left category rail (**General** / **Plan & Billing** / admin-only **Super User**) with a content pane                                                                                    | Complete |
| 2   | **General → runtime undo depth (Rust)** — new `src/settings.rs` owns the policy (default 50, bounds 50–1000, clamp); `History` gained a live `max_history` field + `set_max_history` (clamp + trim), exposed as the engine `set_max_history(n)` wasm-bindgen method. A **Max History** slider (50–1000) with **Apply & Save** applies it to the WASM engine and persists; it's re-applied to each freshly-created engine on load                                                                                                                 | Complete |
| 3   | **General → idle screen** — `useIdleTimeout` + `IdleOverlay`: after a configurable timeout (15 / 30 / 60 min or Never; default 30) the page dims to a black **"Continue with Image Horse"** screen so the browser can throttle the tab. Saves CPU/battery; it does **not** reclaim WASM memory (only a reload does) — which is what the Max History knob is for                                                                                                                                                                                  | Complete |
| 4   | **Super User tab (admin-gated)** — the old Alt+L tier override (No Login / Logged In / Paid + tier matrix) moved into a Super User tab shown only for `ADMIN_EMAIL` (`lib/superuser.ts`; a client-side **visibility** gate — the real tier stays enforced server-side by Convex). Removed the Alt+L dialog (`DevTierDialog` deleted) + shortcut, the status-bar triple-click unlock, and the "Secret Menu" group in `ShortcutModal`                                                                                                              | Complete |
| 5   | **Preferences store** — `lib/preferences.ts` / `usePreferences`: app-wide prefs (`maxHistory`, `idleTimeoutMin`) persisted to `localStorage` (`image-horse-prefs`), mirroring the `useUserColors` pattern. `GeneralPane.tsx` carries the roadmap for the next General settings (export defaults, accent colour, reduce-motion, clear-local-data)                                                                                                                                                                                                 | Complete |
| 6   | **Download dialog format picker** — new dependency-free `ui/radio-cards.tsx` (native radios → real radiogroup semantics + arrow-key nav) renders a 2×2 format grid (JPEG / PNG / WebP / AVIF + hints) inside the Download dialog, so anyone who missed the Compress dropdown gets a second shot; it's two-way synced with `exportFormat`. The title is count-aware (`Download JPEG` / `JPEGs`), **"All" hides when there's a single image**, and the gallery **Export Selected** button now opens the same dialog (defaulting to "Selected (n)") | Complete |
| 7   | **Dialog header / body / footer (`ui/dialog.tsx`)** — restructured to a title-left + boxed-`X` header bar (with a divider), a padded `DialogBody`, and a bordered footer; `DialogContent` went to `p-0` so each section pads itself. Applies to the Download and Delete-All dialogs                                                                                                                                                                                                                                                              | Complete |
| 8   | **Hardening / quality** — surfaced previously-silent failures to the Diagnostics log via `logDiagnostic("CONVEX_DB", …)` for cloud-edit save (`useEditPersistence`) and `users.upsert` (`useStoreUser`); fixed an `<img src="">` (empty string → full-page re-request) per gallery thumbnail in `GalleryBar`; removed debug `console.log`s from the `redo` path; replaced a triple `as any` namespace-dig in `ToolsSidebar` with a typed `StampSettingsPanel` import                                                                             | Complete |
| 9   | **Marketing** — Features cards refreshed (pick-format-at-download, tunable undo history); Trail Log **v0.9.21**                                                                                                                                                                                                                                                                                                                                                                                                                                  | Complete |

## v4.4 Change Summary — 2026-06-24

| #   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Status   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | **Light / Dark / System theme** — the app was dark-only; now `styles.css` splits the palette into a default light `:root` and a `.dark` block (the original earth-tone, verbatim) with `@custom-variant dark (&:where(.dark, .dark *))`. New `lib/useTheme.ts` (`useTheme` applies the class + tracks the OS for "System"; `useResolvedTheme` exposes the live theme via a `<html>`-class MutationObserver). A pre-paint inline script in `index.html` sets the class before React mounts (no FOUC) and updates `<meta name="theme-color">` + `color-scheme`. The toggle lives in **Settings → Appearance** (`AppearancePane`), persisted via the existing `usePreferences` (localStorage + Convex) | Complete |
| 2   | **Semantic-token sweep (~75 utilities)** — hardcoded `zinc/white/black/emerald/red/amber` chrome utilities across ImageMetaPanel, ResourceMonitor, DiagnosticLogOverlay, AISettings, BatchSettings, ObjectRemovalModal, GalleryBar, GridThumbnails, AppShell, etc. → semantic tokens (`text-text-*`, `bg-card/muted/background`, `border-border`, `text-success/warning/destructive`). Left intentionally static: over-photo overlays (CompareSlider, Magnifier, modal scrims), saturated brand/category accents, brand gradients, the annotation palette                                                                                                                                           | Complete |
| 3   | **Third-party + CSS darks themed** — Clerk (`ConvexClerkProvider`: `baseTheme`/variables by theme + `dark:` element variants), `sonner`, and the emoji-mart picker now follow `useResolvedTheme`. `.checkerboard-canvas`, the canvas vignette, the emoji `--rgb-*` vars, and the GitHub-icon `invert` all flip via `.dark`. Light accent uses a deeper warm tan (`#c98f3f`) so text/rings/slider thumbs read on light; `ToggleButtonGroup` active state → `bg-bg-elevated` (visible in both themes)                                                                                                                                                                                                 | Complete |
| 4   | **Design-token centralization** — `styles.css :root` is now the single source for a **z-index ladder** (`--z-canvas … --z-cursor`, replacing ad-hoc `z-*`), `--shadow-panel` (de-dups the Tools/Review panel shadow), **motion** (`--dur-*` + `--ease-standard`), **radius** (CSS literals → `--radius*`), and **layout heights** (`--statusbar-h` / `--panel-bottom`) — which also fixes a latent status-bar height mismatch (28 / 36 / 48 now derive from one value)                                                                                                                                                                                                                              | Complete |
| 5   | **Docs & marketing** — README feature line + this summary; marketing **Features** gains a "Light, dark, or system" card; Trail Log **v0.9.23**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Complete |

## v4.5 Change Summary — 2026-06-24

| #   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Status   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | **Rulers & Grids (new `Settings → Rulers & Grids` tab)** — `RulersGridsPane.tsx` toggles top/left pixel **rulers** and a non-destructive **grid** overlay, with three layouts: **square** (px spacing), **golden ratio**, and **N×M divisions** (columns × rows), plus grid color + opacity. New `Preferences` fields (`rulers`, `grid`, `gridKind`, `gridSpacing`, `gridCols`, `gridRows`, `gridColor`, `gridOpacity`) persisted via the existing `usePreferences` (localStorage + Convex) | Complete |
| 2   | **Rust grid geometry (`grid_lines` WASM export)** — `src/lib.rs` gains a free `#[wasm_bindgen]` fn that returns the grid line segments `[x1,y1,x2,y2,…]` in image space for all three kinds — the single source of grid-layout math. Wrapped by `lib/gridGeometry.ts` (memoized WASM init + a sync handle, mirroring `colorParser.ts`); the `.d.ts` shadow (`hooks/stamp_tool.d.ts`) was hand-synced                                                                                        | Complete |
| 3   | **Canvas overlay (`CanvasGuidesOverlay.tsx`)** — a fixed SVG that projects the Rust grid segments image-space → screen-space using the canvas `getBoundingClientRect()` + scale (same pattern as the crop / rule-of-thirds overlay), so it tracks zoom + pan. Rulers draw tick marks + zoom-aware px labels along the top and left edges. Wired through `CanvasArea` → the full-size editing canvas in `AppShell` (Batch grid-host intentionally excluded)                                  | Complete |
| 4   | **Alt+S → Open Settings** — the Alt+S shortcut (was Rotate 90° CW) now opens the Settings modal via an `image-horse:open-settings` window event the `SubscriptionButton` listens for; `ShortcutModal` updated. Rotate remains available in the UI. The Settings footer (UserMenu/account on the left, **Restore Settings** + **Apply**→toast on the right) is now consistent across the **General**, **Appearance**, **Rulers & Grids**, and **Super User** tabs                            | Complete |
| 5   | **Docs & marketing** — README feature line + this summary; marketing **Features** card + Trail Log **v0.9.24**                                                                                                                                                                                                                                                                                                                                                                              | Complete |

## v4.6 Change Summary — 2026-06-26

| #   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Status   |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | **Full-page cold-start flow** — the first paint on every load is one branded surface (`BrandRevealScreen`): the horse logo + a spinner settle in while the app inits WASM and checks IndexedDB for a saved session, then — deciding **before** painting (no New→Resume flash) — the logo eases up (framer `layout`) and reveals either the New panel or "Welcome back". `FirstRunScreen` is a thin wrapper that passes the revealed content; `AppShell` gained a `booting` + `firstRun` state machine. The spinner holds a minimum `BOOT_MIN_SPLASH_MS` (≈ one rotation) so a fast load never flashes | Complete |
| 2   | **Shared upload guts (`NewActions`)** — the Browse / Paste / Sample / Blank actions, drop zone, blank-canvas panel, and links were extracted out of `UploadDialog` so the **same** body renders full-page on cold start (`FirstRunScreen`) and as the compact modal mid-session (`UploadDialog`, Alt+N). "Welcome back" is now a full-page `ResumeContent` (two thumbnails + a "+N" tile) sharing the same entrance; the modal `ResumeDialog` is retained for the Dev Tests preview                                                                                                                   | Complete |
| 3   | **Idle screen → same reveal** — the flat black `IdleOverlay` was replaced by `IdleScreen`, which uses the shared `BrandRevealScreen` so the "paused to save power" message + Continue reveal with the same logo-eases-up entrance. Brand logo enlarged across all three surfaces (`h-32 sm:h-36`)                                                                                                                                                                                                                                                                                                     | Complete |
| 4   | **3×3 placement grid (`PlacementGrid`)** — a nine-button grid (corners / edge-centers / center; dot-in-position icons; Numpad 1-9 mapped spatially) replaces the old 6-button single-axis **Align** row. Removed from Edit & Move; added to **Text** and **Shapes** (places the currently-selected object, composing two `align_annotation` calls) and the **Batch editor** (both logo + text position pickers, extended from 5 → 9 positions in `computeOffset`)                                                                                                                                     | Complete |
| 5   | **Bézier pen — live Background fill preview** — `PenOverlay` now renders the fill under the stroke as you draw (SVG auto-closes the path, matching Rust's `fill_polygon` on commit), threaded via new `penFillMode` / `penFillColor` props through `CanvasArea`; previously the fill only appeared after commit. (The commit path was already correct.)                                                                                                                                                                                                                                               | Complete |
| 6   | **Settings → Dev Tests tab** — opens the Idle-screen and Welcome-back dialogs in isolation (black-backed boxes with header/footer; the Idle dialog's ✕ shakes) for design iteration without triggering their real conditions                                                                                                                                                                                                                                                                                                                                                                          | Complete |
| 7   | **Docs & marketing** — README feature line + this summary; Trail Log **v0.9.28**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Complete |

## v4.7 Change Summary — 2026-06-26

| #   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Status   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | **Unified button system + `HOVER_RING` SSOT** — `ui/tool-button.tsx` gained a `stacked` (icon-on-top, bigger icon) variant; new `ui/action-tile.tsx` is the non-toggle stacked tile. The warm-accent ("brown") hover ring lives once in `lib/styles.ts` (`HOVER_RING`) and is imported by the shared `ToolButton`, the tool-rail `ToolButton`, and `RadioCards` (`--color-theme-sidebar === --bg-secondary`, so the offset matches panels + dialogs). Swept across Shapes / Pins / Arrows (stacked + the label toggles moved above Stroke Width), Crop **Ratio** (added lucide orientation icons, stacked), Effects → Quick Adjust, Edit & Move → Transform, and the Download dialog footer | Complete |
| 2   | **Placement grid → cell-center (Rust)** — `align_annotation` gained nine combined modes ("top-left"…"bottom-right") that **center** the bbox in that ninth of the canvas (cell centers w/6,w/2,5w/6 × h/6,h/2,5h/6) as ONE history step ("Place"); `handlePlace(cell)` calls it once (was a 2-call edge-align that jammed objects into corners). `PlacementGrid` is full-width lucide `AlignVerticalJustify*` tiles; Numpad 1-9 mapped. WASM rebuilt (`pkg/` gitignored). Verified in-browser                                                                                                                                                                                               | Complete |
| 3   | **Boot no longer blocks on auth** — the cold-start effect ran only after Clerk resolved (`!authResolved`), hanging the splash ~5s in dev. Now it runs on mount, inits WASM, gives Clerk a **capped 1.2s** window (live `authResolvedRef`/`userModeRef`), then routes (unresolved → anonymous). `BOOT_MIN_SPLASH_MS=900` min hold                                                                                                                                                                                                                                                                                                                                                            | Complete |
| 4   | **Download dialog** — title "Download, Copy, or Share" + share-aware copy; four icon-on-top `ActionTile`s in a row; the format picker is now a checkbox-style single-select (`RadioCards`, radio semantics under checkbox visuals; dark-mode box contrast fixed; carries the tile hover ring)                                                                                                                                                                                                                                                                                                                                                                                               | Complete |
| 5   | **Share links** (merged from a worktree) — `convex/shares.ts` + a `shares` table; `ShareButton` (Download dialog) uploads a read-only PNG snapshot to Convex storage, mints a public URL, copies it; `ShareViewer` + a `?v=<token>` route in `App.tsx` render the read-only view. Sign-in required (`useShare().canShare`)                                                                                                                                                                                                                                                                                                                                                                  | Complete |
| 6   | **AI panel cleanup** — stripped the per-tool paragraphs; the lock notice is one line ("AI tools need sign-in + a Paid plan"). `ObjectRemovalModal` now `createPortal`s to `<body>` so it opens **above** the gallery (it was trapped in the sidebar's stacking context)                                                                                                                                                                                                                                                                                                                                                                                                                     | Complete |
| 7   | **Super User "Apply" grants a real tier** — the tier toggle was client-only, so the footer prefs-Apply was dead on that tab (removed it there). New **public, admin-gated** `users.setMyTier` (gated to the `ADMIN_EMAIL` Convex env var) lets the admin patch their **real** Convex tier from the pane → AI actually unlocks. Also re-deployed the drifted `auth.config` to dev (`convex dev --once`), fixing the `Not authenticated` AI errors for signed-in users                                                                                                                                                                                                                        | Complete |
| 8   | **Docs & marketing** — README this summary; Trail Log **v0.9.29**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Complete |

## v4.8 Change Summary — 2026-06-27

| #   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Status   |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | **Eraser tool + configurable brush hardness (Rust)** — the Paint tool's sub-modes are now **Paint · Blur · Pen · Eraser**. New Rust `erase_down/move/up` reuse the whole paint stroke engine (soft dabs, max-coverage so a stroke holds its true opacity, lazy-mouse stabilizer) but **scrub the active layer's alpha toward transparent** — keeping the base RGB so a partial erase fades out with no colour fringe — via an `erase` branch in `recomposite_stroke_bbox`. The brush dab's edge **Hardness** (0–100%) is now a real control (was a hardcoded 0.7) read by `accumulate_dab`, shared by paint + eraser. New `ToolSettings`: `brushHardness`, `eraserSize/Opacity/Hardness`; `usePaintTool` gained an `erase` flag. WASM rebuilt; `stamp_tool.d.ts` shadow hand-synced | Complete |
| 2   | **Histogram falls down when you cycle photos** — switching to another photo now drops the histogram bars to the baseline and holds them down for as long as the new photo takes to composite, then they rise into its shape; an in-place edit of the same photo keeps the smooth morph (no collapse-per-brush-stroke). Threaded a `photoKey` into `HistogramView` so a photo switch is distinguished from an edit                                                                                                                                                                                                                                                                                                                                                                   | Complete |
| 3   | **Selection marker → Rust + drift fix** — the magic-wand marker is now a Rust-traced **marching-ants–style dashed outline** (2-tone black/white boundary + a faint interior tint) instead of a flat blue fill that buried the pixels (`selection_overlay_rgba`). Fixed the marker drifting away on zoom/pan: it used a one-shot `getBoundingClientRect()` under `position:fixed`; `SelectionOverlay` now rides the same `translate(pan) scale(zoom)` transform as the canvas (mirrors the checkerboard) so it stays pinned to the pixels                                                                                                                                                                                                                                            | Complete |
| 4   | **Transparency checkerboard always behind the image** — the backdrop is no longer gated on `hasTransparency`; it's always rendered behind the canvas (an opaque image fully covers it, so it costs nothing) so eraser strokes, deleted selections, and PNG alpha read as an "empty grid" the instant they appear instead of risking a black flash. Standard editor behaviour: the checkerboard shows ONLY through the image's transparent regions                                                                                                                                                                                                                                                                                                                                   | Complete |
| 5   | **Batch commit** — this commit also lands accumulated in-progress work from prior sessions (Batch-editor settings, the Subscription/Settings theme sweep, Arrow settings, Super-User / User-menu, the move-layer tool, `MediaTile`). Whole tree compiles: `tsc --noEmit` clean, Rust builds, 26 Rust tests pass                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Complete |
| 6   | **Docs & marketing** — README this summary; Trail Log **v0.9.30**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Complete |

## v4.9 Change Summary — 2026-06-27

| #   | Change                                                                                                                                                                                                                                                                                                                                                                                                                              | Status   |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | **Non-destructive layer masks (Rust)** — every `Layer` gained an optional `mask: Option<Vec<u8>>` (grayscale; 255 = reveal, 0 = hide) applied to the layer's alpha inside `render_layer`, so it's honoured by **every** path (live composite, export, thumbnail, flatten) for free. The single-opaque-layer fast path now opts out when a mask is present (`mask.is_none()`) so a masked layer always routes through `render_layer` | Complete |
| 2   | **Mask painting reuses the brush engine** — `mask_paint_down/move/up` drive the same `accumulate_dab` coverage + stabilizer + hardness machinery as the paint brush; a new `paint_mask` branch in `recomposite_stroke_bbox` scrubs coverage×opacity toward the paint value into the active layer's mask (black hides, white reveals), idempotent from a per-stroke snapshot. `usePaintTool` gained a `maskMode`/`maskValue` variant | Complete |
| 3   | **Mask management** — `add_layer_mask` / `remove_layer_mask` / `apply_layer_mask` (bakes into alpha, permanent) / `invert_layer_mask` / `has_layer_mask`, all snapping history; `merge_down` bakes both the upper (via `render_layer`) and lower layers' masks correctly; `get_layers` JSON now reports `hasMask`                                                                                                                   | Complete |
| 4   | **UI** — Layers panel: an Aperture button adds a mask / toggles Edit-mask mode (auto-selects the layer + switches to the Paint brush so strokes hit the mask); a control bar on the active masked layer gives a Hide/Reveal brush-value toggle plus Invert / Apply / Remove. Where a mask hides pixels, the transparency checkerboard shows through (matches the eraser)                                                            | Complete |
| 5   | **Docs** — README this summary; Trail Log **v0.9.31**. Known gap: masks aren't persisted yet — `get_layer_png` serializes raw pixels only and the Convex archive is still single-layer, so masks survive undo/redo but not reload                                                                                                                                                                                                   | Complete |

## v5.0 Change Summary — 2026-06-27

| #   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Status   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | **Tool reorg** — "Edit and Move" → **Edit and Transform**; the **Eraser** moved out of the Paint tabs to the bottom of Edit & Transform as a toggle + Size/Opacity/Hardness sliders (canvas strokes erase the active layer while on). "Move" → **Layer Settings** (Layers icon) with two mutually-exclusive toggles: **Move** (drag the active layer, **Ctrl+M**) and the **Selection Marker** (magic-wand, moved here from Edit & Move). Paint sub-modes are now Paint \| Blur \| Pen | Complete |
| 2   | **Drag & paste image import** — dragging an image anywhere over the app shows a full-window drop affordance (animated gradient ring, à la Claude-in-Chrome); dropping OR pasting (Ctrl+V) opens a Download-style choice dialog — **New layer** (gated login/paid) \| **Onto image** \| **To gallery** — instead of pasting blindly. Window-level drag listeners + a decode-once helper; `usePaintTool` reused for the new-layer paste                                                  | Complete |
| 3   | **Histogram drop/raise — real fix** — `HistogramView` split into two effects: `photoKey` change drops the bars to the baseline (no placeholder data), and `signature` change retries the Rust `calculate_histogram` until it returns real data, then raises. `histogramSignature` now includes `isImageLoading` so the raise fires exactly when the new image is ready (kills the flash / stale-data race)                                                                             | Complete |
| 4   | **Download dialog** — primary button now reads **"Download & Share {FORMAT}"**, tracking the selected format live                                                                                                                                                                                                                                                                                                                                                                      | Complete |
| 5   | **Ctrl+\ easter egg** — a confetti popper dialog celebrating the month's shipped features (67 in June, 90 lifetime, 24 releases) with highlighted feature icons                                                                                                                                                                                                                                                                                                                        | Complete |
| 6   | **Docs** — README this summary; Trail Log **v0.9.32**                                                                                                                                                                                                                                                                                                                                                                                                                                  | Complete |

## v5.1 Change Summary — 2026-06-28

| #   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Status   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | **Compact "master bar" (≤1000px)** — snapping the window narrow (or opening on a tablet) folds the whole UI into one left **master bar**: a **New** action + **Tools / Gallery / Review** tabs that swap its content, with Settings + account in the top row. The horizontal top bar is hidden and the canvas fills the rest. Lives in `components/master-bar/` and is **lazy-loaded** — desktop sessions never download it; the chunk arrives the first time you go narrow. Driven by `useBreakpoint().dock` | Complete |
| 2   | **Vertical gallery** — the Gallery tab is the full `GalleryBar` inverted: **two square thumbnails per row**, **up/down arrows** instead of a scrollbar, all the same select / export / duplicate / delete controls, and the photo-count readout pinned to the bottom. A `vertical` prop flips strip orientation, scroll axis, and positioning; the image is an in-flow `aspect-ratio:1; object-fit:cover` square so rows stay uniform and never overlap                                                       | Complete |
| 3   | **"Use compact version" notice** — a one-time dialog (shared Dialog primitives) greets the narrow layout, re-arming if the window grows wide then snaps narrow again                                                                                                                                                                                                                                                                                                                                          | Complete |
| 4   | **Settings → Import / Export** — the Export tab is renamed **Import / Export** and lists disabled **Import .ora** / **Export .ora** buttons next to the existing options                                                                                                                                                                                                                                                                                                                                      | Complete |
| 5   | **Shared dimension control** — Resize and the new Layer-Settings **Canvas Size** reuse one `DimensionFields` (Scale / W×H / aspect-lock) component, so resizing the image vs the canvas behave identically (canvas resize runs through Rust)                                                                                                                                                                                                                                                                  | Complete |
| 6   | **Fixes** — Selection-marker cursor no longer shows the move icon; the backdrop checkerboard now extends exactly **10px** past the image and follows the theme; added a **WASM panic hook** (`console_error_panic_hook`) so Rust panics print a real message instead of "unreachable"                                                                                                                                                                                                                         | Complete |
| 7   | **Docs** — README this summary; Trail Log **v0.9.33**                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Complete |

## v5.2 Change Summary — 2026-06-28

| #   | Change                                                                                                                                                                                                                                                                                                   | Status   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | **WASM engine modularization** — the ~4,800-line `src/lib.rs` god-object split into focused modules (`annotations.rs` / `effects.rs` / `layer.rs` / `paint.rs` / `selection.rs` / `utils.rs`), shrinking `lib.rs` by ~60%. Behaviour-identical (same tools, same speed); far faster to build and work in | Complete |
| 2   | **Shared `SmallDialog`** — the idle "paused to save power" screen, the small-window notice, and the resume prompt now use one compact card component (mid-size icon + title + body + single button). `IdleScreen` dropped its bespoke BrandReveal entrance for a dimmed backdrop + the shared card       | Complete |
| 3   | **Cursor fix** — the brush-size ring is gated to the brush-family tools (`brush` + `effects`); `compress` (Resize), `arrow` (Layer Settings), and `ai` now keep the standard default arrow on the canvas and over the panels (no stray paint ring, including when the pointer is idle)                   | Complete |
| 4   | **Docs** — README this summary; Trail Log **v0.9.35**                                                                                                                                                                                                                                                    | Complete |

## v5.3 Change Summary — 2026-06-28

| #   | Change                                                                                                                                                                                                                                                                                                                                                                         | Status   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| 1   | **WASM SIMD128 kernels** — explicit `core::arch::wasm32` SIMD (each with a bit-identical scalar fallback) for the hot pixel paths: Gaussian blur, brightness, contrast (`simd/color.rs`), pixelate cell-sums, mask invert, and resize bilinear + Lanczos3 + Catmull-Rom (`simd/resize.rs`). Shared `load_px`/`store_px` in `simd/pixel.rs`; all under a new `src/simd/` module | Complete |
| 2   | **Measured** (Chrome, 2048²→1024², SIMD vs scalar build): resize bilinear **1.60×**, Lanczos3 **3.90×**, Catmull-Rom **3.65×**. Bench harness in `bench.html`                                                                                                                                                                                                                  | Complete |
| 3   | **Deferred (documented):** the alpha-blend kernels (layer composite, brush, eraser, clone stamp) — per-pixel integer divide can't be bit-identical in wasm SIMD, so they stay scalar (`SIMD_PLAN.md`)                                                                                                                                                                          | Complete |
| 4   | **`resize_pixels_filter`** — new stateless WASM export (nearest / bilinear / Catmull / Lanczos); used by the bench + as a general utility                                                                                                                                                                                                                                      | Complete |
| 5   | **Docs** — README this summary; Trail Log **v0.9.36**; `SIMD_PLAN.md` annotated with status + measured speedups                                                                                                                                                                                                                                                                | Complete |

## v5.4 Change Summary — 2026-06-28

| #   | Change | Status |
| --- | ------ | ------ |
| 1   | **Docs restructure** — README split 840→~50 lines (latest version + doc links only); full dated history moved to `docs/Change-summary.md`; new `docs/` set (Architecture, File-Map, Features, Getting-Started, Keyboard-Shortcuts, GitHub-Actions, CI-Guardrails, Refactor-Playbook); retired root `SIMD_PLAN.md` + two stale planning notes (folded into `docs/`) | Complete |
| 2   | **CI workflow** (`.github/workflows/ci.yml`) — `rust` (fmt + clippy `-D warnings` + test + wasm-pack), `web`, `marketing`, `convex`, security (cargo-audit / pnpm-audit / gitleaks / CodeQL), plus an advisory **`guardrails`** job (raw colors, off-scale type, raw z-index, `as any`, Rust `unsafe`, a11y) | Complete |
| 3   | **Native git hooks** (`.githooks/`, via `core.hooksPath`) — `pre-commit` formats staged Rust; `pre-push` mirrors the blocking CI (fmt / clippy / tsc + an UploadThing secret-leak guard). Lefthook dropped (pnpm corepack conflict) | Complete |
| 4   | **Strict-CI lint green-up** — `cargo fmt --all` + `clippy -D warnings` across the modularized + SIMD sources (crate-level `too_many_arguments` allow, `transform.rs` module doc, merged `drawing.rs` branches, `text.rs` `&mut [u8]`) | Complete |
| 5   | **SSOT Refactor Playbook** (`docs/Refactor-Playbook.md`) — color / type / z-index token conventions, React + Rust health backlog, target folder structures, and the reusable guardrail bundle | Complete |
| 6   | **Marketing deploy fix** — a repo-root `vercel.json` pins Vercel to `pnpm run build:marketing` → `marketing/dist`. The root `pnpm build` resolves to the app build (needs a WASM `pkg/` step Vercel doesn't run), so the root config overrides it to build only the marketing site | Complete |
| 7   | **Docs sync** — README Tech Stack expanded (Zustand *coming soon*, Radix UI, Sonner, emoji-mart, JSZip, IndexedDB, Stripe, Replicate); File-Map adds `src/simd/` + `settings.rs`; the git-routine now tracks README + Change-summary + Trail | Complete |

## v5.5 Change Summary — 2026-06-28

| #   | Change | Status |
| --- | ------ | ------ |
| 1   | **Gallery photo-switch race fix** — `handleSelectPhoto` ran three sequential awaits (save → loadPhotoEdit → loadFromSaved) with no concurrency guard, so overlapping selections could blit a stale photo to the canvas while the gallery highlighted another. A `selectSeqRef` latest-wins token, checked after every await (incl. inside `loadPhotoFromEntry`), now lets only the newest selection touch the canvas | Complete |
| 2   | **PgUp/PgDn cycling fix** — `handleNext/PrevPhoto` computed the index from `activePhotoId` (React state, which lags the async image load), so repeated presses recomputed "next" from a stale current and stuck. A synchronous `activeIdRef` (advanced on every selection; kept in sync at select / add / delete / initial-load) now drives cycling | Complete |

## v5.6 Change Summary — 2026-06-29

State-management foundation + storage investigation. All additive — the new
Zustand stores are not yet consumed by AppShell, so this release changes no
runtime behaviour; it lands the plumbing and the docs that the AppShell wiring
builds on.

| #   | Change | Status |
| --- | ------ | ------ |
| 1   | **Zustand stores** — `useUIStore` (panel/dialog flags + master-bar tab), `useToolStore` (active tool + every tool-mode flag/settings blob), `useGalleryStore` (photos / selection / per-photo bookkeeping) extracted from the ~3,245-line `AppShell.tsx`. Types mined from the real AppShell state, not guessed | Foundation complete |
| 2   | **`SetArg` drop-in helper** (`stores/_shared.ts`) — store setters accept React's `value \| (prev => next)` arg so the ~30 functional-updater call sites (`setShowTools(v => !v)`, `setToolSettings(p => …)`) migrate untouched. Setters are stable refs (no extra re-renders); action names mirror AppShell's exact setter names | Complete |
| 3   | **`@stores` path alias** added to `app/tsconfig.json` + `app/vite.config.ts` | Complete |
| 4   | **Zustand → IndexedDB persist adapter** (`stores/storage/idbStorage.ts`) — hand-rolled native-IDB `StateStorage` (no new dependency; matches the existing three stores) in its own `image-horse-zustand` DB. `useUIStore` persists a `partialize`d subset (master-bar tab + notice-dismissed flags); transient dialog flags are never persisted | Complete |
| 5   | **Dexie content layer** (`lib/dexie/db.ts` + `USAGE.md`) — typed declarative schema `originals` / `workingCopies` / `photos` in a parallel `image-horse-dexie` DB. Public API mirrors the legacy `originalsStore` names so a future cutover is an import-path swap; cascade delete + content-address dedupe preserved. The three live hand-rolled stores are untouched | Module landed (not yet wired) |
| 6   | **Docs** — `State-Management.md`, `IndexedDB-Investigation.md`, `Service-Workers-Caching.md` (the SW one is investigation-only; no service worker ships yet). README docs index + Tech Stack updated | Complete |
| 7   | **Deps** — `zustand@5` + `dexie@4` added to the `app` package (via the corepack `pnpm@11.7.0` workaround for the store-v11 lockfile) | Complete |

## v5.7 Change Summary — 2026-06-29

Photo-switch performance fix (the user-reported bug) + a security/perf pass and
planning docs. The performance fix and EXIF/share changes are user-visible; the
Zustand persistence + docs are groundwork.

| #   | Change | Status |
| --- | ------ | ------ |
| 1   | **Faster photo switching** — `loadPhotoFromEntry` re-read the original bytes from IndexedDB and ran two full-res `createImageBitmap` decodes (probe + downscale) on EVERY select, even when revisiting a just-seen photo. New `lib/workingCopyCache.ts` is a byte-budget LRU (≈160 MB) of decoded working copies keyed by the **content hash** — immutable bytes ⇒ a deterministic decode, so the cache is always valid (no invalidation). Cache hit skips the IDB read + both decodes; uploads seed it; "Delete all" clears it. Buffers are read-only (canvas + a WASM `load_image` copy), so one buffer safely backs many selections | Complete |
| 2   | **EXIF privacy-by-default** — `DEFAULT_PREFERENCES.exifKeep` flipped `true → false`; export strips GPS / capture-time / device unless re-enabled in Settings → Security. Existing users keep their stored choice | Complete |
| 3   | **Share-token hardening** — `convex/shares.ts` `makeToken()` used `Math.random()` (~72 bits, non-crypto) to gate the PUBLIC, unauthenticated `get` endpoint (the token IS the access control). Now `crypto.randomUUID()` (122-bit CSPRNG, Convex-seeded/replay-safe). Backward-compatible — existing tokens still resolve via the `by_token` index | Complete |
| 4   | **Image-upload firewall** (`lib/security/imageFirewall.ts`) — magic-byte sniff (never trusts `file.type`/`file.name`), size / pixel-count / dimension caps (decompression-bomb guard), explicit SVG rejection. Plus `lib/security/sanitizeFilename.ts` for ZIP/download names. Utilities landed; wiring into the upload path is a supervised follow-up (format allowlist must be confirmed) | Utilities complete |
| 5   | **Zustand persistence + perf** — `useToolStore` now persists its pure sub-mode prefs (brush/effects/stamp/shapes mode); `useUIStore` persists only the master-bar tab (notice flags are session-scoped by design); the IndexedDB adapter de-dupes identical writes so dialog toggles don't churn the prefs blob. Performance playbook added to State-Management §7 | Complete |
| 6   | **Docs** — `Architecture-Roadmap.md` (document-based-editor direction, prioritized, mapped onto the real repo — noting Rust already owns the document model), `Security-Hardening.md` (audit → repo), `OpenRaster-Export-Import.md` (grounded `.ora` plan) | Complete |

## v5.8 Change Summary — 2026-06-29

The Zustand migration's payoff: `AppShell` now reads its UI / tool / gallery state
from the stores instead of ~38 local `useState`s — plus a logged-in photo-switch
speedup and a CI clippy fix. **Behaviour-preserving** (the app works exactly as
before); verified by `tsc -b` + `vite build` and in-browser including persist
hydration on refresh. fallow's unused-files count dropped 10 → 5 (the 5 store files
are now reachable). This is the groundwork for splitting the 3k-line `AppShell` into
per-feature modules (see [Architecture Roadmap](Architecture-Roadmap.md)).

| #   | Change | Status |
| --- | ------ | ------ |
| 1   | **AppShell wired to Zustand** — every store-bound `useState` (UI panel/dialog flags + master-bar tab; active tool + all tool-mode flags/settings; photos / selection / savings / modified / manifest / cap) replaced with same-name atomic selector bindings from `useUIStore` / `useToolStore` / `useGalleryStore`. `SetArg` keeps the ~30 functional-updater call sites working untouched; setters are stable refs (no extra re-renders). Now-unused imports (`defaultToolSettings`, `DEFAULT_PHOTO_LIMIT`, `GalleryManifest`, `EffectsMode`) pruned | Complete |
| 2   | **Logged-in switch speedup** — `handleSelectPhoto` re-saved the outgoing photo on every switch, and when signed in `savePhotoEdit` uploads the full edit archive to Convex; now it saves only when the photo was actually modified | Complete |
| 3   | **clippy CI fix** — the `if n > 0 { sum / n }` cell-average guards in `drawing.rs` (pixelate) + `filters.rs` (mosaic) tripped Rust 1.96's `manual_checked_ops`; folded into `checked_div` (behaviour-identical, works on the older local clippy too — no `#[allow]`) | Complete |
| 4   | **Docs** — README intro + a "state management" release note; `Architecture.md` "Client state (Zustand)" section; `Features.md` state bullet; `File-Map.md` `stores/` tree + `lib/` additions; marketing Hero copy | Complete |

## v5.9 Change Summary — 2026-06-29

Two improvements to how an image session begins, plus the project's second
committed subagent. The **Blank Canvas / New Document** panel is now organized by
use-case, and an opt-in preference can load photos onto a Photoshop-style two-layer
canvas. Verified by `cargo check`/`cargo test` (28 lib tests incl. two new artboard
tests), `tsc --noEmit`, and `vite build` (all green).

| #   | Change | Status |
| --- | ------ | ------ |
| 1   | **New-Document category tabs** — `NewActions.tsx`'s flat `PAGE_PRESETS` became `PRESET_CATEGORIES` (Social / Web / Video / Paper) with a `PRESET_BY_ID` lookup. A "Canvas type" `ToolButtonGroup` (4-col) swaps which "Page size" presets show; picking one fills width/height as before. Sizes: Instagram/IG-portrait/Story, Facebook + cover, LinkedIn + banner, X, Pinterest; FHD/HD/4K, OG, ad units, favicon; YouTube thumb/banner, 1080p/4K/vertical/square/TikTok; A3/A4/A5, Letter/Legal, 4×6/5×7/8×10 | Complete |
| 2   | **Logo/title hidden in blank mode** — `NewActions` gained an `onBlankModeChange` prop (fired from a `useEffect` on `blankMode`); `UploadDialog` drops its logo + "Image Horse" header while the Blank Canvas panel is open, restoring it on close/reopen. Sign-in + close (X/Escape) unaffected | Complete |
| 3   | **Two-layer "artboard" on import** — new Rust `ImageHorseTool::load_image_artboard(pixels, img_w, img_h, pad, bg_rgba)`: grows the document to `photo + 2·pad`, builds a solid **Background** layer + a transparent **Photo** layer with the image pasted centred at `(pad, pad)`, photo layer active. Mirrors `load_image` otherwise (clears history/overlays). Two unit tests (opaque + transparent canvas) | Complete |
| 4   | **Canvas-on-import preference** — `canvasArtboard` (bool) + `canvasPadding` (px, 0–200, default 10) added to `Preferences` (interface, defaults, `normalize`, `serialize`). Settings → General → *Canvas on import* toggle (Canvas+photo / Photo-only) + a conditional border slider. Default **off** = classic single full-bleed `load_image`. Wired through `useCloneStamp.loadImageFromPixels`'s new optional `artboard` arg; AppShell passes it **only** on fresh import (`handleAddPhotos`), not on photo-switch / restore / AI-result, so an already-loaded photo isn't re-padded | Complete |

> **Known follow-ups (artboard).** The two-layer artboard applies on **fresh import
> only** ("at least initially"): switching away and back reloads the cached working
> copy as a single layer, and the Convex edit archive is still single-layer, so the
> split isn't yet persisted. The backing canvas is opaque white; export includes the
> border. These are acceptable for the opt-in v1 and tracked for a follow-up alongside
> multi-layer persistence.

## v6.0 Change Summary — 2026-06-30

Image guides, a real canvas-size operation, and a UI-polish pass (skeletons + spinner).
Verified by `cargo test` (30 lib tests incl. two new `resize_canvas` tests), `tsc --noEmit`,
and `vite build` (all green). Pixel work stays in Rust (`resize_canvas`); guides are a
non-destructive client-side overlay.

| #   | Change | Status |
| --- | ------ | ------ |
| 1   | **Image guides** — new `useGuidesStore` (Zustand) + `ImageGuidesOverlay`: draggable horizontal/vertical guide lines projected image→screen the same way the grid/ruler overlay is, so they track zoom + pan. Layer Settings gained an "Guides" section — **Add horizontal / Add vertical / Remove lines / Lock** + a selectable list with per-row delete and a panel-scoped Delete/Backspace shortcut (ignored while typing). Guides render with or without rulers. Locked guides select but don't drag | Complete |
| 2   | **Even guide distribution** — `addGuide` appends one guide then redistributes all same-axis guides to equal gaps (`k/(n+1)·size`, k=1..n; size = imgH for horizontal, imgW for vertical) — a CSS-`space-between` feel. Redistributes only on add; removes/drags leave the rest in place | Complete |
| 3   | **Canvas-size resizer fixed + relocated** — new Rust `ImageHorseTool::resize_canvas(new_w, new_h, anchor, bg_rgba)` changes the document **without resampling** (re-blits each layer at a nine-grid anchor, rebuilds the Background fill, crops/pads, shifts masks + annotations; pushes one "Canvas Size" history entry). Two unit tests prove a stamped pixel survives a grow exactly + the shrink/crop case. `onResizeCanvas` was rewired off the resampler (`handleApplyCompression`) onto this. The Canvas Size control **moved from Layer Settings into Settings → Layers and Canvas** | Complete |
| 4   | **Live Canvas border / backing color** — Settings → Layers and Canvas: **Canvas + photo** is now the import default (10px border); a **backing-canvas color palette** (`canvasBgColor`, default `"transparent"` ⇒ checkerboard via `bg_a=0`) drives the Rust Background fill. Changing the border or backing color re-applies live to a freshly-imported artboard doc via `resize_canvas` (non-destructive). Gallery/AI-reloaded docs no-op (baseline unknown) — a tracked follow-up | Complete |
| 5   | **Skeleton loading SSOT** — new `Skeleton` / `SkeletonText` / `SkeletonCircle` primitive (token-driven shimmer, `prefers-reduced-motion` fallback, `SKELETON_BASE` in `lib/styles.ts`, `.skeleton` machinery in `styles.css`); migrated gallery thumbnails, share viewer, and Plan & Billing off ad-hoc loaders. Documented as Refactor-Playbook §5a | Complete |
| 6   | **Spinner refresh** — single `Spinner` primitive (Lucide `Loader` + `.spinner-comet` conic-mask leading edge, reduced-motion aware, standardized spinner↔label gap) replacing 8 scattered `Loader2` sites. The transparent backing-palette swatch now renders the real `.checkerboard-canvas` pattern | Complete |

> **Known follow-ups.** Guides are session-only (reset on photo switch — per-document
> persistence is a follow-up). The live canvas-border re-apply is limited to freshly
> imported artboard docs; on gallery/AI-reloaded docs the border slider no-ops rather
> than risk a stale-delta resize. An artboard-on but single-layer doc has no solid
> backing layer to repaint on a backing-color change.

## v6.1 Change Summary — 2026-06-30

A polish release fixing the **import-canvas "jumbo" bug** from v6.0, plus spinner and
reselect-list cleanups. Verified by `cargo test` (32 lib tests incl. two new
`set_artboard_border` tests), `cargo build --lib`, and `tsc --noEmit` (all green).

| #   | Change | Status |
| --- | ------ | ------ |
| 1   | **Canvas-jumbo fix — absolute, idempotent border** — new Rust `ImageHorseTool::set_artboard_border(pad, bg_rgba)` replaces the old delta-based border that could accumulate into a giant ("jumbo") canvas. It finds the photo's tight non-transparent bounding box, rebuilds the document to **exactly** `photoW + 2·pad × photoH + 2·pad` (re-blitting pixels at the border offset, **no resample**), refills the Background layer solid, grows a Background for single-layer docs, and carries per-layer masks + text/shape annotations along by the same offset. Pushes one "Canvas Border" history entry. Two new unit tests prove "a 44×44 jumbo snaps back to 24×24" and full idempotency (re-apply = no-op) | Complete |
| 2   | **Live border wired off the delta path** — `useCloneStamp` exposes `setArtboardBorder`; AppShell's live-border effect and all three load paths (fresh / gallery / AI) now call the idempotent absolute border instead of the old `borderAppliedRef` delta (fully removed — `tsc` confirms no dangling refs). The hand-synced ambient `app/src/hooks/stamp_tool.d.ts` shadow matches the new wasm-bindgen export | Complete |
| 3   | **Spinner honors size class + sits above Settings panel** — `Spinner` now detects a Tailwind sizing utility (`size-*`/`w-*`/`h-*`) via `hasSizeClass` and drops the inline `width/height` px fallback so `className="size-8"` actually wins (32px); the Lucide `Loader` fills the box. The Settings plan-loading spinner renders centered **above** the panel body. The `.spinner-comet` conic mask gained a ~22%-opacity floor reaching full by 70° so the tail stays visible on the light panel | Complete |
| 4   | **Reusable `ReselectBar` component** — extracted the clickable reselect row (label + hover-revealed ✕, `role="button"` with Enter/Space → select, Delete/Backspace → delete, ✕ stops propagation) into one SSOT component reused by the ReviewPanel reselect list; supporting `.is-selected` / `.is-disabled` styles added to `styles.css` | Complete |
| 5   | **Dead-prop cleanup** — with Canvas Size living in Layer Settings, the unused `canvasWidth` / `canvasHeight` / `onResizeCanvas` props were removed from `SubscriptionButton`, `TopBar`, and `LayersCanvasPane` and threaded through `ToolsSidebar` (`tsc` clean, no orphaned references) | Complete |

> **Known follow-ups.** `load_image_artboard` remains in Rust/`pkg` but is no longer
> called from the app (the artboard load now goes `load_image` + `set_artboard_border`) —
> a harmless dead Rust path, prunable later.

## v7.0 Change Summary — 2026-07-02

The biggest UI pass to date: every tool's settings panel was rebuilt around a shared
`SectionHeader` (title + lightbulb tooltip) pattern, two tools swapped sub-features
(Paint ↔ Eraser, Effects ↔ Color Picker), and a new **Resize Layer** tool reuses the
paste-placement machinery for non-destructive per-layer scale/reposition. Verified by
`cargo test` (39 lib tests incl. 3 new layer-resize tests), `cargo clippy`/`cargo fmt`,
`tsc --noEmit`, and `vite build` (all green) throughout.

| #   | Change | Status |
| --- | ------ | ------ |
| 1   | **"Resize Layer"** — new Rust `ImageHorseTool::begin_layer_resize_preview()` seeds the existing `PastePreview` machinery from the active layer's own pixels (tagged `is_layer_source`); `recomposite()` hides that layer while the preview is live (no ghosting/doubling) and `commit_paste_preview` replaces the buffer outright instead of blending. Exposed via `usePastePlacementTool.beginLayerResize()` (zero pixel marshalling — pure Rust snapshot) and a "Resize Layer" tile in the Layers tab next to Move, reusing the identical drag-handle/commit/cancel overlay built for paste placement | Complete |
| 2   | **Settings-panel redesign** — new `SectionHeader` (title + lightbulb `InfoTooltip`) and `FieldLabel` (compact field-level variant) primitives replace inline paragraphs across every tool panel: Layers (Move/Resize, Selection Marker, Guides, Canvas Size), Paint (Paint/Blur/Pen/Eraser), Edit & Transform (Crop, Transform, Color Picker), Shapes (Shapes/Pins/Arrow), Stamp (Clone/Stamps/Emojis), Effects (Levels/Quick Adjust), and Batch (Logo/Text/Rename) | Complete |
| 3   | **Paint ↔ Eraser swap** — the Eraser (scrub the active layer to transparent) moved from Edit & Transform into Paint as a 4th mode alongside a new 2×2 icon grid (`Brush`/`Droplets`/`PenTool`/`Eraser` from `lucide-react`, via `ToolButtonGroup stacked columns={2}`). Full behavioral rewire, not just UI: canvas drag routing (`useEffectiveTool.ts`), the `Ctrl+]`/`Ctrl+[` brush-size shortcut, and the cursor-preview diameter all moved from `activeTool === "crop" && cropEraserActive` to `activeTool === "brush" && brushMode === "erase"`; `cropEraserActive` deleted from the Zustand store entirely (`BrushMode` gained `"erase"` instead) | Complete |
| 4   | **Effects ↔ Color Picker swap** — Effects lost its Levels/Color-Picker `TabGroup` (now single-mode, just Levels); the Color Picker moved to the bottom of Edit & Transform. Same full-rewire treatment: `useEffectiveTool.ts`'s color-picker branch, the canvas cursor logic, the eyedropper context-menu shortcut, and the tool-switch reset effect all moved from `activeTool === "effects"` to `activeTool === "crop"`; `effectsMode`/`EffectsMode`/`setEffectsMode` deleted entirely from the store, AppShell, and ToolsSidebar | Complete |
| 5   | **Status bar hints redesign** — now cycles 4 slots (`StatusBar.tsx`): two tool-related (`TOOL_SHORTCUT` digit-key + new `TOOL_ACTION_SHORTCUT` per-tool action, e.g. `Ctrl+M` for Layer Settings), one generic interface hint cycling from a trimmed `BASE_HINTS` pool, and `Alt+/` always pinned last. Cycle interval changed 5min → 3min. Top tool-grid tooltips (`ToolGrid.tsx`) now show each tool's digit-key shortcut (`toolConfig.ts` gained `shortcutKey`) | Complete |
| 6   | **Checkerboard unification** — `.canvas-wrapper` (viewport backdrop), `.checkerboard-canvas` (per-image transparency grid), and `.checkerboard` (thumbnails/swatches) now all reference the same `--bg-primary`/`--bg-tertiary` theme tokens, differing only in tile size; the redundant hardcoded `.dark .checkerboard-canvas` override was removed (the shared vars already theme-switch) | Complete |
| 7   | **Shift = 90° angle lock** — new `lockAxisDelta`/`lockPointToAxis` helpers (`app/src/lib/aspectLock.ts`) applied to the shape/arrow edit-overlay and paste-placement drag handlers in `CanvasArea.tsx`: Shift+drag on a bounding-box body snaps to the dominant axis; Shift+drag on a line/arrow endpoint snaps the angle (relative to the fixed endpoint) to the nearest 90° | Complete |
| 8   | **Componentized list rows** — `.large-badge-item` CSS class renamed to `.full-width-badge` everywhere; `ReselectBar` gained optional `type`/`index`/`onDelete` (omit `onDelete` for a no-✕ variant) so History (delete only on undo-type entries, matching prior behavior), Reselect, Guides, and Batch Rename's Preview rows (from→to, non-interactive) all render through the one component | Complete |
| 9   | **`PlacementGrid` self-contained** — extended with its own `label`/`info` (via new `FieldLabel` primitive) instead of callers hand-rolling a separate label `<p>`; every usage (Batch Logo, Batch Text, Shapes/Pins/Arrows, Text tool) standardized to the label "Placement" with a contextual tooltip, trailing paragraphs folded in | Complete |
| 10  | **"Add this image" dialog reworded** — the three-tile choice (previously "New layer" / "Onto image" / "To gallery") renamed to **Stack as layer** / **Merge into layer** / **New gallery image**, each tile and the body copy now spelling out destructive vs. non-destructive vs. separate-photo | Complete |

> **Known follow-ups.** The "Resize Layer" preview always opens at full canvas size
> (no alpha-based content-bounding-box helper exists yet, so it isn't auto-fitted to
> just the layer's visible pixels — the user drags it down manually). A pre-existing,
> unrelated bug was surfaced during verification: creating a "Blank Canvas" with
> "Transparent background" produces an actually-opaque white layer despite the
> gallery thumbnail rendering it as transparent — not touched by this release.

## v7.1 Change Summary — 2026-07-02

A crop bug fix plus the modal/button consolidation pass. Verified by `cargo test`
(40 lib tests incl. the new crop regression test), `cargo clippy`/`cargo fmt`,
`tsc --noEmit`, `vite build`, and in-browser checks of Settings, Diagnostics, the
idle screens, and the migrated buttons (fresh load, zero console errors).

| #   | Change | Status |
| --- | ------ | ------ |
| 1   | **Crop annotation-offset fix** — `ImageHorseTool::crop()` (src/lib.rs) cropped every layer's pixel buffer but never offset `text_annotations`/`shape_annotations` by the crop origin, so any crop not anchored at (0,0) left annotations at stale absolute coordinates ("the text slides over"). Now both annotation kinds (incl. shape `points`) shift by `(-x, -y)`, clamped exactly the way `transform::crop` clamps — the same pattern `translate_active_layer` and `resize_canvas` already used. New test `crop_offsets_text_and_shape_annotations`; verified in-browser (painted dot + text annotation stay glued through an off-origin crop; one-step undo restores) | Complete |
| 2   | **Modal consolidation → `ui/dialog`** — `DialogContent` gained `size="sm"` (notice card: the old SmallDialog look), `"default"`, `"xl"` (the old 760px Modal width) plus `overlayClassName` for z-index/blur overrides. Converted: `SubscriptionButton` (Settings) + `DiagnosticLogOverlay` off `ui/Modal`; `IdleScreen`/`IdleScreenDialog`/`SmallWindowNotice` off `SmallDialog`, with the idle card shared as `IdleScreenCard` so the real idle screen and the Dev-Tests preview stay identical (shake-on-close preserved, idle stays non-dismissable at `--z-idle`). **Deleted:** `ui/Modal.tsx`, `SmallDialog.tsx` | Complete |
| 3   | **Button consolidation → `ui/button` (cva)** — the previously-unused stock-shadcn `button.tsx` rewritten as the app's one Button: `size="xs" \| "tiny" \| "default" \| "large"` (xs/tiny = the 20/28px `.btn-icon` icon-button styles, large = the old LargeButton exactly). All 17 consumers migrated (13 LargeButton files, 4 TinyButton files incl. ReviewPanel's 12 `size="xs"` rows and dialog.tsx's own close X). **Deleted:** `large-button.tsx`, `tiny-button.tsx`. Stale comment/docs references redirected | Complete |

> **Known follow-ups (PARKING_LOT.md).** `ShortcutModal.tsx` still hand-rolls an
> inline framer modal (last non-ui/dialog modal); SubscriptionButton's
> restore-confirm is a hand-rolled portal overlay; Resize Layer's preview opens
> full-canvas (no content-bbox autofit yet); pre-existing: Blank Canvas
> "Transparent background" produces an opaque white layer.

## v7.2 Change Summary — 2026-07-02

A pricing-philosophy change (fundamental editing is free) plus a pen-tool fix.
Verified by `cargo test` (40 lib tests), `cargo clippy`/`cargo fmt`, `tsc --noEmit`,
`vite build` (app + marketing). Pen fill mechanism confirmed in-browser earlier.

| #   | Change | Status |
| --- | ------ | ------ |
| 1   | **Layers un-paywalled (free / no-login)** — layers are a fundamental, purely client-side editing tool (the Rust `Vec<Layer>` stack + recomposite live entirely in memory / IndexedDB, tier-agnostic), so they're no longer gated behind login. `app/src/lib/tiers.ts` demo `layersPerImage: 0 → 3` (matching Logged In) — one value that flows through the existing `layersUnlocked = layerLimit > 0` checks in `ReviewPanel` (the "Log in to unlock layers" badge is now dead code) and `canUseLayers` in the import dialog, no component edits. Cloud layer *persistence* stays `isAuthenticated`-gated (the Convex archive is single-layer anyway), so in-memory layers work in Demo while cloud save stays login-only. Login/paid now differentiate on cloud features (storage, gallery cap, sharing, AI); "unlimited layers" remains the paid perk. The other listed fundamentals (Crop, Blur, Resize, Paint, Histogram) were already Demo-available (gated only by `imageReady`) | Complete |
| 2   | **Pen Background fill applies to an already-drawn path** — the Bézier pen's Background fill was captured only at draw time (`add_bezier_annotation`), so reselecting a committed path and changing the Background did nothing (the fill mechanism itself works — verified: a fresh Solid path fills correctly). `update_bezier_annotation` (src/annotations.rs) extended from `(id, points)` to also take `(color_hex, stroke_width, fill_kind, fill_color_hex)` — mirroring `update_shape_annotation` — and `handlePenEditCommit` (AppShell) now passes the current Paint→Pen panel style on commit. So reselecting a pen path and adjusting the Background/stroke restyles it, including filling one drawn with Background: None. `stamp_tool.d.ts` shadow hand-synced; wasm rebuilt | Complete |
| 3   | **Pricing sheets synced** — `marketing/src/sections/Pricing.tsx`: Demo plan card gains "3 layers / image"; the "Layers" row moved out of the "Projects & data (Convex)" category into "Editing tools (WASM — zero server cost)" as `demo=3 / free=3 / pro=unlimited` (client-side stack), reflecting that layers are free local editing, not a cloud feature | Complete |

## v7.3 Change Summary — 2026-07-02

An internal refactor of the `AppShell` composition root — no user-visible behavior
change. Verified by `tsc --noEmit`, `vite build`, and an in-browser QC pass (boot,
image load, text commit + undo, brightness/blur filters). Landed from the
`refactor/appshell-stages-124` branch.

| #   | Change | Status |
| --- | ------ | ------ |
| 1   | **AppShell → session hooks** — ~600 lines pulled out of `app/src/app/AppShell.tsx` into four focused hooks under `app/src/app/session/`: `useImageSession` (image load / progress / original URL), `useCanvasActions`, `useSelectionActions`, `useMaskActions`. Behavior unchanged | Complete |
| 2   | **Orphan state → Zustand (Stage 1)** — component-local `useState` that belonged in shared stores (loading + progress flags, original URL, compare/modified state) evicted into `useUIStore` / `useGalleryStore` / `useAnnotationStore` | Complete |
| 3   | **Window CustomEvents → store (Stage 4)** — the last two `window` events, `text-committed` and `text-annotations-changed`, replaced with store actions; `useTextTool` / `useDrawingTools` / `useCloneStamp` drive annotation sync through the store now. New `CustomEvent`s stay forbidden | Complete |
| 4   | **Docs + housekeeping** — added `docs/LANGUAGE-TIER-ROADMAP.md` (advisory: which TS↔Rust tier moves are worth doing, and why); removed the standalone `bench.html` SIMD micro-bench (unused by the build; recoverable from git history) | Complete |

## v7.4 Change Summary — 2026-07-02

The loading spinner no longer freezes under Reduced Motion, plus an animation
SSOT tidy-up. Verified by `tsc --noEmit`, `vite build`, and an in-browser check —
the boot spinner's computed animation is `spin` / `running` even with the OS
`prefers-reduced-motion` active.

| #   | Change | Status |
| --- | ------ | ------ |
| 1   | **Spinner never freezes** — `components/ui/spinner.tsx` and the boot/canvas spinner now use a dedicated `.spinner-icon` class that keeps spinning under both OS `prefers-reduced-motion: reduce` and the in-app `.reduce-motion` toggle. Essential loading indicators are exempt from motion-reduction (WCAG 2.3.3) — a frozen spinner reads as a hung app. `ImageMetaPanel`'s pending icon moved onto the same class. *Decorative* `.animate-spin` still respects Reduced Motion | Complete |
| 2   | **Animation SSOT — `settingsPanelMotion`** — the settings sub-panel enter/exit triple (`initial`/`animate`/`exit` with `quickSpring` + a 120 ms fade-up) had drifted into ~9 hand-copied inline copies (Paint ×4, Text ×2, Resize ×2, ImageMetaPanel). Now one `settingsPanelMotion` export in `lib/animations.ts`, spread at each site. Exact same values — no visual change | Complete |

## v7.5 Change Summary — 2026-07-02

Originals storage cut over to a Dexie read-through adapter — invisible to users,
reversible by design. Verified: `tsc --noEmit`, `vite build`, vitest (7/7 in the
migration worktree), and an in-browser legacy round-trip against a real 12-photo
gallery — all load via read-through, only opened photos copy into Dexie, the
legacy DB stays byte-identical.

| #   | Change | Status |
| --- | ------ | ------ |
| 1   | **Originals → Dexie adapter, lazy read-through** — `app/src/lib/dexie/originalsAdapter.ts` presents the legacy `StoredOriginal` signature so the cut-over is a mechanical import swap. `getOriginal` reads Dexie-first, falls through to the legacy store on a miss, and copies the hit into Dexie (best-effort, idempotent). `putOriginal` → Dexie only; `deleteOriginal` → both stores; `listOriginals` → deduped union. No bulk backfill — read-through IS the backfill | Complete |
| 2   | **Five call sites cut** — `useImageSession`, `useCanvasActions`, `AppShell`, `ImageMetaPanel`, `BatchSettings` go through the adapter now; `originalsStore` gains a read-only `listOriginalKeys()` (legacy DB stays byte-identical) | Complete |
| 3   | **Kill switch + tests** — `USE_DEXIE_ORIGINALS` (`flags.ts`) reverts to legacy-only in one flag. vitest harness added (vitest + fake-indexeddb); 7 specs: copy-once, interrupt+retry, delete-both, union-dedupe, fresh-install, legacy-fixture round-trip, kill-switch routing. App `tsc` excludes specs (run via vitest) | Complete |
| 4   | **ADR-001 (Draft)** — `docs/adr/001-originals-lazy-migration-to-dexie.md` with pre-mortem; legacy-DB deletion deferred to a separate future ADR ≥1 release out. `docs/adr/` + INDEX bootstrapped | Complete |

## v7.6 Change Summary — 2026-07-02

CI-only maintenance — no app changes.

| #   | Change | Status |
| --- | ------ | ------ |
| 1   | **Node 22 → 24 in CI** — all four `actions/setup-node@v4` steps bumped to Node 24 (current LTS / runner default). The Node-20 deprecation warning in the logs comes from `rustsec/audit-check`'s own runtime, not our config — GitHub runs it on 24 regardless | Complete |
| 2   | **`cargo-audit` job `checks: write`** — the job inherited the workflow's top-level `contents: read`, so `rustsec/audit-check` failed with "Resource not accessible by integration" when posting its check-run. Added job-level `checks: write` (kept `contents: read`) | Complete |

## v7.7 Change Summary — 2026-07-02

Image encode + thumbnail moved to a Web Worker, with a mandatory main-thread
fallback. Verified: `tsc --noEmit`, `vite build` (emits a `codec.worker` chunk),
and in-browser (boots clean, thumbnails populate, no "codec worker unavailable"
warning, no console errors). The worker's encode path is fallback-protected; a
full export-output check (dimensions/validity) is a follow-up.

| #   | Change | Status |
| --- | ------ | ------ |
| 1   | **Codec worker** — `app/src/workers/codec.worker.ts` (Vite module worker) exposes `encodeImage` + `makeThumbnail` via Comlink, using `OffscreenCanvas` + `convertToBlob`. `codecWorkerClient.ts` is the main-thread facade; pixel buffers cross as transferables only | Complete |
| 2   | **Call sites migrated + fallback** — the WebP/JPEG encode path (`exportImage.ts`, `useAutoCompress.ts`) and the thumbnail path (`workingCopy.ts` `makeThumbnailFromPixels`) route through the worker. **PNG export stays on Rust `encode_png_pixels`.** Every path keeps its main-thread function as a fallback; a warn-once guard logs `"codec worker unavailable, using main thread"` if the worker can't start | Complete |
| 3   | **Safety** — the worker is probed with `ping()` before any pixel transfer (a broken worker never eats a caller's buffer); reuse sites copy-before-transfer; the worker is stateless per call, so concurrent gallery-import calls are safe without an explicit queue | Complete |

## v7.8 Change Summary — 2026-07-08

Paste placement + history, SVG import, Compress panel reorder, ADR system.
Verified: `cargo fmt/clippy/test` (40 passed), `tsc --noEmit`, `vite build`,
and in-browser QC via Playwright against the production preview (placement
box fit-scaling, shift+drag proportional resize, Enter/Escape/click-away
commit paths, undo granularity, real 4200×2800 JPEG + real 959×593 SVG
fixtures). WASM: 552,114 → 553,019 bytes (+905 B — two-step paste commit).

| #   | Change | Status |
| --- | ------ | ------ |
| 1   | **Stack-as-layer paste → placement box** — `importToNewLayer` routes through `usePastePlacementTool` like "Merge into layer": oversized pastes arrive fit-scaled and resizable instead of baked at 1:1 and clipped at the layer edges. `begin()` gained an `onCancel` cleanup; Escape removes the pre-created "Pasted Image" layer via `removeLayer` | Complete |
| 2   | **Paste sizing is real history** — `PastePreview` (Rust) remembers its initial fit rect; `commit_paste_preview` double-snaps when the box was adjusted: "Paste" (baked at the fit rect) then "Resize Layer"/"Move Layer" (final rect, re-baked from the ORIGINAL source — never resample-of-resample). Undo peels the sizing first, then the paste; the History panel shows both. Unadjusted pastes and the Resize Layer tool still single-snap | Complete |
| 3   | **SVG import via rasterization** — new `app/src/lib/rasterizeSvg.ts`: SVGs convert to PNG at both import funnels (`openImportDialog`, `handleAddPhotos`) through an `<img>` element (scripts never execute); the SVG bytes are discarded and the stored gallery original is the PNG. Raster policy: intrinsic size clamped to a 1024–4096 long side, 2048 viewBox-aspect fallback. Root cause: Chrome `createImageBitmap()` can't decode SVG; the firewall's never-render-live-SVG stance holds. Drop/paste/browse filters + start-screen copy updated (`accept="image/*,.svg"`, "Supports … SVG") | Complete |
| 4   | **Compress panel reorder** — bottom stack is now Apply Compression & Resize → Show A/B Compare → divider → Auto Compress (label + Compress Image / Compress All Images) | Complete |
| 5   | **ADRs** — `docs/adr/` gains 002–007 (backfilled drafts imported from the adr-bundle, renumbered past the existing 001; INDEX carries a review note that 003/004/006 describe planned/unmerged architecture) and ADR-008 (SVG rasterize-at-import, with pre-mortem). INDEX.md updated | Complete |

## v7.9 Change Summary — 2026-07-09

Docs-and-groundwork release, no user-visible change. Verified: `cargo
test --all-features` (55 passed, incl. `tiles::`/`ops::` suites),
`cargo build --release` (default feature set unaffected), `tsc
--noEmit` clean. WASM binary unchanged (tile/op-log code is gated
behind an off-by-default `tiles` Cargo feature, not compiled into the
default/wasm32 build).

| #   | Change | Status |
| --- | ------ | ------ |
| 1   | **Tile-buffer + operation-log engine core merged** (`src/tiles.rs`, `src/ops.rs`, `benches/tiles.rs`) — fast-forwarded from `feat/tile-engine-core` (`1703670`) behind an off-by-default Cargo feature. `TileBuffer` (256×256 tiles, flat-buffer compatible round-trip, content-hashed) + a postcard-serialized operation log with keyframed replay (every 50 ops). Not wired into the render path — undo is still full-snapshot-based. Groundwork for ADR-003/004/006, which stay Draft | Complete |
| 2   | **ADR status audit** — every ADR in `docs/adr/` checked against actual v7.8 code (grep-verified, not assumed). ADR-001 (Dexie originals), ADR-005 (codec worker), ADR-007 (worktree runs), ADR-008 (SVG rasterization) confirmed shipped and flipped to **Accepted**. ADR-002 (tool registry) confirmed still not started — AppShell (2,939 lines) still hand-wires 8 tool hooks directly. ADR-003/004/006 confirmed to describe only the just-merged, still-unwired tile/op-log code — stay Draft with an explicit "merged ≠ wired" note. `INDEX.md` rewritten | Complete |
| 3   | **`docs/Architecture.md` reconciled** — full rewrite describing what's actually live at v7.8/v7.9 (session-hook AppShell, Zustand stores, module-split WASM engine, SIMD128 kernels, codec worker + fallback, Dexie originals read-through, snapshot-based undo) with a separate "Planned" section for tiles/op-log, the tool registry, and a service worker. Also fixed a second stale claim: `useConvexHistory.recordAction()` no longer exists; replaced by `useEditPersistence.ts` + `convex/photoEdits.ts` | Complete |
| 4   | **ADR-009 — COOP/COEP vs. Clerk spike** — timeboxed spike testing whether the cross-origin isolation headers needed for `wasm-bindgen-rayon` (parallel image processing) break Clerk sign-in. Empirically verified via live headless Chrome (raw DevTools Protocol, no new dependency) under both `require-corp` and `credentialless`: app boots, WASM loads, `crossOriginIsolated` is true, Clerk's sign-in UI and API calls are unaffected. Verdict: not blocked; recommends `credentialless`. Named gaps not yet tested: OAuth-popup sign-in, full authenticated session, post-auth Convex websocket behavior. `app/vite.config.ts` gained an **opt-in-only** `preview.headers` block gated behind a `SPIKE_COEP` env var — default `vite preview` behavior (the `imagehorse-qc` target) is unchanged unless that var is set | Complete |

## v7.10 Change Summary — 2026-07-09

Four new Rust engine kernels + two real fixes + a marketing-content
correction + one new finding from a full production QC pass. Verified:
`cargo fmt --check`/`clippy -D warnings`/`cargo test` clean (native +
wasm32 simd128), `wasm-pack build` clean, `tsc --noEmit` clean (app +
marketing), `pnpm run build:all` clean, browser QC via Chrome DevTools
Protocol against the production preview (paint/clone-stamp/text/
shapes/effects/compress/export/persistence, pixel-sampled undo
verification, zero console errors across the session), plus a
dedicated headless-browser smoke test asserting exact expected pixel
values for each new Levels kernel.

| #   | Change | Status |
| --- | ------ | ------ |
| 1   | **AI results no longer blank the canvas** — `useAIJob.ts`'s `urlToPixels` called `bitmap.width`/`bitmap.height` *after* `bitmap.close()`; a closed `ImageBitmap` reports 0×0, and that 0×0 size was reaching `loadImageFromPixels`, resizing the canvas to nothing on every AI result. Width/height now captured before `close()` | Complete |
| 2   | **`loadImageFromPixels` hardening** — `useCloneStamp.ts` now rejects any zero-size or undersized pixel buffer (`!width \|\| !height \|\| pixels.length < width*height*4`) before it reaches the WASM engine, logging the rejection instead of silently corrupting canvas state. Defense-in-depth for #1 and any future caller with the same bitmap-lifecycle bug | Complete |
| 3   | **Real paid-tier gating** — new `useRealTier()` in `useStoreUser.ts`: a reactive `useQuery(api.users.me)` read of the signed-in user's actual Convex tier. Wired into `AuthModeWatcher` in `AppShell.tsx` so `onMode` resolves to `"paid"` for real pro/team accounts instead of only ever `"loggedIn"` — previously entitled paying users saw AI/paid features locked in the UI even though the server would have allowed them | Complete |
| 4   | **`convex/testReplicate.ts`** — temporary internal diagnostics module (`internalAction`/`internalMutation`/`internalQuery`) to verify the Replicate token + pinned model versions (`rembg`, `text-extract-ocr`, `remove-object`) without a signed-in user and without exposing the token. Self-documented as safe to delete once no longer needed; `convex/_generated/api.d.ts` picked up its generated typing | Complete |
| 5   | **Marketing Architecture page corrected** — `marketing/src/pages/Architecture.tsx` had drifted well past stale into fabricated: fictional `/api/*` Vercel routes and rate-limit middleware that never existed, false UploadThing/CDN storage claims (uploads actually go to Dexie + Convex File Storage), five dead Convex schema tables in the diagram (`projects`/`images`/`layers`/`history`/`annotations` — zero call sites in the frontend), invented cron jobs (`convex/crons.ts` registers none), and wrong AI model names/pricing badges. Rewritten against `docs/Architecture.md` and grep-verified code; same layout/components, content-only | Complete |
| 6   | **QC finding (not yet fixed): canvas border grows on compress→reload** — full browser QC pass (production preview, logged-out) found that a photo imported at 820×620 (default border) stays 820×620 through Apply Compression & Resize, but reopens at 840×640 with a visible black ring after a reload — a second, larger border baked on top of the first. Reproduces once per save cycle; same family as the v6.1 canvas-jumbo border bug, this time in the persistence/working-copy load path rather than import. Logged for a follow-up engine session; everything else in the QC pass (paint/undo pixel-exact, clone stamp, text, shapes, effects, compress, export, gallery persistence) passed clean with zero console errors | Open |
| 7   | **Four new Levels kernels: Saturation, Shadows, Highlights, Sharpen** — new SIMD128+scalar kernels in `simd/color.rs`, delegated through `filters.rs`, exposed as `adjust_saturation`/`adjust_shadows`/`adjust_highlights`/`adjust_sharpen` on `ImageHorseTool` (each its own `self.snap(...)` undo entry), wired through `useCloneStamp.ts` → `ToolsSidebar.tsx` → `EffectsSettings.tsx`. **Saturation**: grayscale-lerp against pixel luminance (`out = L + (channel - L) * factor`), latching slider 0–300/100=neutral, same UX as Contrast. **Shadows/Highlights**: luminance-masked additive brightness — Shadows peaks at `(1-L)²` (dark tones), Highlights peaks at `L²` (bright tones), each tapering to ~0 outside its range; absolute sliders −100–100/0=neutral, reset-after-apply like Blur. **Sharpen**: standard unsharp mask (`out = original + amount*(original - blur(original))`) built on the existing separable Gaussian blur, fixed 2px radius, 0–100% slider mirroring Blur's UX. Verified via a headless-Chromium smoke test driving real slider input events against the production build and asserting exact pixel output (e.g. Saturation→0 on `(220,20,20)` → `(80,80,80)`); every new slider's undo reverts byte-for-byte and stays in sync after undo/redo. No filter-specific bench harness exists yet (only the gated `tiles` feature has one) — noted, not silently skipped. WASM: 553,016 → 556,102 bytes (+3,086 B / +0.56%) | Complete |

## v7.11 Change Summary — 2026-07-09

OpenRaster (.ora) export/import + a Review-panel accessibility regression
fix. Verified: `cargo fmt`/`clippy -D warnings`/`test` clean (71 tests),
`wasm-pack build` clean, `tsc --noEmit` clean, production build clean.
OpenRaster verified via a real 3-layer round-trip against the production
build (pixel-exact per-layer sampling, both directly and packed/unpacked
through a real `.ora` archive) — independently re-verified twice, once by
each of two separate sessions/agents reaching the same result. Tooltip fix
verified via direct DOM inspection (aria-label, Tooltip wiring, and actual
rendered `[role="tooltip"]` content on hover), not just a visual check.

| #   | Change | Status |
| --- | ------ | ------ |
| 1   | **OpenRaster (.ora) export** — `app/src/lib/openraster/{export,import,stackXml,types,index}.ts`. Every layer as PNG (`tool.get_layer_png(i)`) + `stack.xml` (name/opacity/visibility, top-first per the OpenRaster spec) + `mergedimage.png` + `Thumbnails/thumbnail.png`, zipped with JSZip — `mimetype` first entry, STORED (uncompressed), the rest DEFLATE, exactly per spec. Text/shape annotations flatten into pixels before export (v1 scope; lossless round-trip is a documented Phase 3). Settings → Import/Export → **Export as .ora** | Complete |
| 2   | **OpenRaster (.ora) import — lands as a NEW gallery photo** — `importOraAsNewPhoto` adds the archive's `mergedimage.png` as an ordinary new photo (via the same `handleAddPhotos` funnel as Browse Files/Paste/Sample Images, explicitly skipping the "canvas artboard" auto-padding preference — required, not cosmetic: `push_restored_layer` has no per-layer offset, so the restored layers must land on a canvas whose dimensions exactly match the `.ora`'s own `<image w h>`), then restores the real per-layer stack over that single flattened layer via the existing `importOra`. Never overwrites the currently active photo, unlike the original design (disabled buttons, no confirmation, would have silently destroyed unsaved work) | Complete |
| 3   | **Race condition found and fixed during implementation** — AppShell's "auto-select first photo when none is active" `useEffect` (`!activePhotoId && photos.length > 0`) can fire in the real await gap inside `handleAddPhotos` (`setPhotos` commits before `setActivePhotoId` does), redundantly reloading the just-added photo and replacing `toolRef.current` with a fresh, un-restored `Tool` instance — silently discarding the layer restore onto an object nothing renders. `importOraAsNewPhoto` now detects this (`toolRef.current !== tool` after the restore) and re-runs the restore against whichever instance ends up current; `importOra` fully rebuilds the stack each call, so re-running it is safe. This is very likely the same root cause as the pre-existing "resume sometimes lands on the wrong/import screen" issue — not fixed generally (bigger scope), but the connection is now documented | Complete |
| 4   | **PNG decode moved into Rust** — new `decode_png_to_rgba(png: &[u8]) -> Result<DecodedPng, JsError>` in `src/lib.rs` (logic in `src/codec.rs`'s `decode_png`, using the already-present `png` crate), replacing the browser `OffscreenCanvas`/`createImageBitmap` decode `.ora` import previously used. Normalizes every source PNG color type (RGB/RGBA/Grayscale/GrayscaleAlpha) to straight (non-premultiplied) RGBA8, matching the engine's existing convention; corrupt input returns a catchable JS error, never a WASM trap. Encode (`get_layer_png`/`export_png`) and decode are now the same codec instead of two that could silently disagree on alpha handling. WASM: 556,102 → 639,855 bytes (+83,753 B / +15.1%) — confirmed via an isolated default-features-only rebuild and a `twiggy diff`, genuinely new decode machinery (`fdeflate::decompress`, `png::decoder::stream::StreamingDecoder`, Adam7 interlace expansion), not a features leak or incidental bloat | Complete |
| 5   | **Review panel toggle-row tooltips fixed** — `ReviewPanel.tsx`'s History/Layers/Reselect/Histogram section toggles lost their tooltip data in an earlier icon-only UI pass (commit `81d86f37`, `noIcons` → `compact`) and fell back to a bare native `title` attribute — not compact-view-specific, the same floating desktop Review panel has the identical row. `TOGGLES` now carries `tooltip: { label }` for each entry, correctly wired into `ToggleButtonGroup`'s existing (but previously unused-here) styled-`Tooltip` path | Complete |
| 6   | **`ToggleButtonGroup` accessibility fix** — the shared button never set `aria-label` under any circumstance; in `compact` mode (icon-only, no visible `<span>{label}</span>`) this left every button with **no accessible name at all** for keyboard/screen-reader users, tooltip or not. Now always sets `aria-label={tooltip?.label ?? label}` — fixes every current and future `ToggleButtonGroup` caller, not just the Review panel row | Complete |

## v7.12 Change Summary — 2026-07-09

Remove Canvas button, padlock icons on tier-gated AI buttons, and a merged
Playwright e2e smoke suite. Verified: `tsc --noEmit` clean, production
build clean, 3/3 Playwright smoke tests passing.

| #   | Change | Status |
| --- | ------ | ------ |
| 1   | **Remove Canvas button** — `CanvasResize.tsx`'s single full-width "Resize canvas" button is now a side-by-side pair (no icons): Resize canvas stays as-is, and a new destructive-styled **Remove canvas** button sits next to it. Wired through `LayerSettings` → `ToolsSidebar` → `AppShell.handleRemoveCanvas`, which deletes the artboard's Background layer outright (`stamp.removeLayer(backgroundLayerId)`) — not a resize-to-zero, a real layer removal — then marks the photo modified and persists. Disabled when there's no Background layer to remove | Complete |
| 2   | **Padlock icons on tier-gated AI buttons** — `AISettings.tsx`'s three live-AI buttons (Remove Background, Extract Text, Remove Object) now render a `Lock` icon before the label whenever `!aiEnabled`, matching the padlock already used elsewhere for paid-tier gating. The gate itself (`aiEnabled` = signed-in + Paid, from `lib/tiers.ts`) was already correct — the buttons just went quietly `disabled:opacity-40` with no visual reason why | Complete |
| 3   | **Playwright e2e smoke suite merged** — `e2e/smoke.spec.ts` + `e2e/fixtures/checker.png` + `playwright.config.ts` (self-contained `webServer`: builds and serves `vite preview` on port 4173). Covers boot, image load via file picker, and core tool interaction against the real production build. Brought in from the `test/playwright-smoke` worktree; one trivial `.gitignore` merge conflict (kept both the `*_PROMPT.md`/`runs-status.sh` block and the new Playwright-artifacts block) | Complete |

## v7.13 Change Summary — 2026-07-09

Canvas background on export, relocated + finished: the setting moves from
Settings → General to Settings → Layers and Canvas, and Remove Canvas now
shrinks the document to content so a deleted backdrop can't linger.
Verified: `cargo fmt --check`/`clippy -D warnings`/`test` clean (75 tests),
`wasm-pack build` clean (639,855 → 642,054 B, +2,199 B / +0.3% — the new
compositing/tight-bbox functions), `tsc --noEmit` clean, production build
clean. Live-verified in a real browser: Settings → Layers and Canvas shows
the new "Canvas background on export" section, the toggle switches state
on click, and the General tab no longer shows it (moved, not duplicated).

| #   | Change | Status |
| --- | ------ | ------ |
| 1   | **`exportCanvasBackground` preference relocated** — `GeneralPane.tsx` → `LayersCanvasPane.tsx` (Settings → Layers and Canvas). Same `Preferences` value/onChange contract both panes already share, so this was a clean move: the toggle, its copy, and the `Frame`/`Image` icons went with it; `GeneralPane.tsx` reverted to its pre-existing baseline with no orphaned imports | Complete |
| 2   | **Rust: crop-to-content export excluding the Background layer** — `get_image_data_excluding_background`/`export_width_excluding_background`/`export_height_excluding_background` composite every layer except the artboard's backing "Background" (bottom layer, that exact name), then crop to the tight bounding box of what's left via a new `tight_bbox` scan. A no-op (full untrimmed composite) when there's no backing layer to exclude. Backs the default (off) `exportCanvasBackground` path for clipboard copy and download/share — cropping matters, not just zeroing the fill, or JPEG/other alpha-less formats would still bake in a black border at the padded size | Complete |
| 3   | **`remove_layer` shrinks to content when the Background layer goes** — deleting the artboard's backing layer (bottom of the stack, named "Background") now also crops the document to its remaining content's tight bounding box via a new `shrink_to_content`, so the padded canvas that layer's fill occupied doesn't linger as excess transparent space in every export afterward. Ordinary (non-backing) layer deletions are untouched — verified by a dedicated test. `crop` refactored to share the same `crop_in_place` helper so this compound delete+shrink records as a single undo step | Complete |
| 4   | **JS wiring: clipboard copy, download/export, and Share all read the preference** — `useCanvasActions.ts`'s `handleCopyToClipboard`/`handleExport` and `AppShell.tsx`'s `ShareButton` props all branch on `exportCanvasBackground`, using the new Rust exports' own reported width/height (not `stamp.state.width/height`) when it's off, since the excluded-background composite is a different, usually smaller, size | Complete |

## v7.14 Change Summary — 2026-07-10

Privacy metadata scrubber, a real Diagnostics-window freeze fixed, a
byte-exact replay-parity test harness for the tile engine, and a repo
cleanup (dead Zustand prototype + old Playwright e2e harness removed).
Verified: `tsc --noEmit` clean (app), 19/19 vitest tests passing
(metadata scrubber), `cargo fmt --check`/`clippy -D warnings` clean,
92 cargo tests passing (75 pre-existing + 10 replay-parity + 7
determinism, 3 Stroke/Blur/Text stubs correctly `#[ignore]`d). Fix
verified live in a real browser (dialog renders, closes, underlying
screen interactive again — previously frozen solid).

| #   | Change | Status |
| --- | ------ | ------ |
| 1   | **Metadata scrub: Location-only mode** — `app/src/lib/exif.ts` already had comprehensive JPEG/PNG/WebP EXIF read/strip/keep; extended (not duplicated) with a new `MetadataStripMode = "all" \| "location"`. `'all'` is the pre-existing keep/strip-everything behavior, untouched. `'location'` is new: neutralizes just the GPS sub-IFD (TIFF IFD0 pointer zeroed, GPS sub-IFD entries + external RATIONAL data zeroed in place, same byte length), leaving camera/lens/every other tag intact. Closed a read-side asymmetry along the way (`extractPngExifTiff` — PNG could strip metadata but not read it back for display). Settings → Security shows the mode choice only when Strip is active; new `exifStripMode` preference defaults to `'all'` — zero behavior change for existing users. Export All shows a completion toast naming what was removed. ICC color profiles are kept under `'all'` (matches the pre-existing behavior, now written down in ADR-010 with the fidelity-vs-fingerprint tradeoff explicit). Known gap, logged not fixed: GPS embedded in XMP/RDF (rather than binary TIFF) survives `'location'` mode; `'all'` still drops the whole XMP block regardless | Complete |
| 2   | **Fixed: Diagnostics window (Alt+Delete) could freeze the entire app** — `--z-idle` (200) is deliberately above `--z-dialog` (50) so the real power-save IdleScreen can cover any open dialog. `FirstRunScreen` (the cold-start "New" import screen) shared that same `BrandRevealScreen` component and inherited `z-idle`, even though it isn't the idle-lock screen. Opening the Diagnostics window while no image was loaded rendered it invisibly *underneath* the opaque import screen, while Radix's dialog still engaged its modal `pointer-events: none` body lock — freezing the whole app with the Close button invisible and nothing else clickable. `BrandRevealScreen` now takes a `zIndexClass` prop (defaults to `z-idle` for the real IdleScreen); `FirstRunScreen` passes `z-panel` instead, so dialogs opened over it render correctly on top | Complete |
| 3   | **Replay-parity test harness for the tile engine** — `tests/replay_parity.rs`/`replay_determinism.rs`/`replay_stubs.rs` (native `tiles` feature target, no engine files touched): a `TileBuffer` fixture set + `assert_replay_parity` helper proves op-log replay-from-keyframe produces byte-identical pixels to direct apply, zero tolerance, for every currently-implemented op (`FillRegion`, `Crop`, `Levels`) individually and combined across a keyframe boundary. Plus determinism, keyframe-equivalence, and a format-version-guard test. `#[ignore]`d stubs for `Stroke`/`Blur`/`Text` (still no-op `apply()`s) are structured so a future session un-ignores one line per op as each lands — green harness gates swapping snapshot undo for op-log replay. New criterion bench: keyframed replay of 200 mixed implemented ops is ~1.9ms vs. ~574ms full replay from zero (~290x) — comfortably under a 16ms frame budget | Complete |
| 4   | **Repo cleanup** — removed the unused `zustand/` prototype directory (a 12-file blueprint superseded by the real store wiring already in `app/src/stores/`) and the Playwright e2e harness (`e2e/`, `playwright.config.ts`) along with their `package.json`/`.gitignore` entries and the `criterion`/`[[bench]]` Cargo.toml wiring for the old tile bench (now reinstated with new content by the replay-parity harness above) | Complete |

> **About this release.** Metadata scrubber content and the diagnostics
> fix were built in parallel worktree sessions (`ih-scrub`, and the
> ongoing `ih-diag` diagnostics-overhaul work respectively) and merged
> together once independently verified.

**Merge note.** Item 3 (the replay-parity harness) and item 4 (the
repo cleanup) landed in adjacent commits and directly overlapped on
`benches/tiles.rs` and Cargo.toml's `criterion`/`tiles`-bench wiring —
the cleanup removed both as dead weight moments before the harness
branch, built independently, added new verified content to that exact
file. Resolved in favor of the harness's version; `Cargo.lock`
regenerated (`cargo check --features tiles`) and re-verified clean
post-merge (`fmt`/`clippy -D warnings`/`cargo test --features tiles` =
92 passed, 3 correctly `#[ignore]`d / `cargo test` default = 60
passed).

## v7.15 Change Summary — 2026-07-10

The engine's first parallel kernel: rayon-parallelized Gaussian blur,
composing with the existing SIMD128 row math, behind a new off-by-default
`threads` cargo feature. Zero effect on anything users see today — this is
plumbing + proof, not activation. Verified: `cargo fmt --check`/`clippy -D
warnings` clean for both the default and `--features threads` configs,
`cargo test` 60 passed (default, unchanged) / 63 passed (`--features
threads`, +3 byte-identical parallel-blur tests), `tsc --noEmit` clean,
default `wasm-pack build` byte-identical to the pre-session baseline
(642,054 bytes, `twiggy diff` = 0 across every item).

| #   | Change | Status |
| --- | ------ | ------ |
| 1   | **`wasm-bindgen-rayon` behind a new `threads` feature** — `rayon`/`wasm-bindgen-rayon` added as optional dependencies, fully inert unless `--features threads` is passed. Confirmed the default build's public Rust API surface, wasm byte size, and even `wasm-bindgen`'s own pinned version are all unaffected — the only default-build artifact difference is an unrelated hash shift from panic-infra line numbers moving (0 bytes of actual code/data difference, confirmed via `twiggy diff`) | Complete |
| 2   | **Parallel blur, byte-identical to scalar/SIMD** — new `blur_horizontal_parallel`/`blur_vertical_parallel` in `src/simd/blur.rs` split rows across a rayon thread pool while keeping SIMD128 as the per-row inner loop. The original sequential functions are untouched byte-for-byte — the parallel math is a deliberate *duplicate*, not a shared refactor, because a shared-helper first attempt cost +363 B on the default build (indirection that didn't fully inline) even though the feature never compiles into that build; reverted in favor of a provable guarantee over an optimizer-dependent one. 10+ test cases (down to 1×1 and 1-row images, plus non-power-of-two sizes) assert full byte equality against the sequential output; a `bw == 0` guard prevents a real `rayon::par_chunks_mut` panic on empty input | Complete |
| 3   | **Native benchmark: ~7.85× at 2048² and 4096²** — `benches/blur_threads.rs`, 22 logical cores, radius 8: 429.9 ms → 54.8 ms (2048×2048), 1,752.3 ms → 222.9 ms (4096×4096). The ratio holding essentially flat across a 4× pixel-count jump (rather than improving, as fixed per-call overhead would predict) points to this kernel being memory-bandwidth-bound rather than thread-overhead-bound — logged as a real finding for whichever kernel gets parallelized next, not assumed to generalize. A true three-way scalar/SIMD/SIMD+rayon comparison isn't possible on native (the SIMD128 path is wasm32-only by construction); the real number waits on the diagnostics microbench once headers are on | Complete |
| 4   | **Gated in-browser microbench, wired into Diagnostics → Resources** — checks `crossOriginIsolated` first and fails safe to "threads unavailable" text (never throws) when headers or the threads-feature wasm build aren't present — which is every build this repo ships today. Feature-detects the `threads`-only WASM exports at runtime rather than declaring them in the shared ambient `.d.ts` (which describes what the shipped build actually has), so TypeScript can't be fooled into thinking they're always there | Complete |
| 5   | **ADR-011 (Draft): parallel kernels via rayon, gated on COOP/COEP** — references ADR-009's spike verdict, documents the memory-bandwidth finding and the byte-identical-test requirement for every future parallel kernel, and pre-mortems both the still-open OAuth/header risk and the temptation to assume rayon = free linear speedup elsewhere | Complete |

**Still needs a human, before any of this reaches users:** (1) COOP/COEP
response headers on the actual production deploy target, gated on
finishing ADR-009's live sign-in/OAuth verification — not something an
agent can do, it requires a real authenticated session; (2) a nightly
Rust toolchain + `-Z build-std` for a real wasm32+atomics build; (3)
wiring `initThreadPool` into the app's actual init path once (1) and (2)
exist. None of these three were started this session.

## v7.16 Change Summary — 2026-07-11

The `ih-diag` diagnostics-overhaul worktree (open and referenced as
"ongoing" since v7.14) is merged: the Alt+Delete Resources tab moves off
one flat 800ms poll-everything interval onto three tiers matched to
actual cost. No Rust touched, no engine surface changed — this is a pure
frontend instrumentation refactor. Verified: `tsc --noEmit` clean,
production build succeeds (642.05 kB wasm chunk unchanged, confirms
nothing on the Rust side moved).

| #   | Change | Status |
| --- | ------ | ------ |
| 1   | **`useDiagnostics` tiered polling hook** (`app/src/hooks/useDiagnostics.ts`) replaces `useResourceMonitor` / `ResourceSnapshot` — Tier 0 (on-open / on-demand only: cores, device RAM, whole-tab memory via `measureUserAgentSpecificMemory()`) never polls; Tier 1 (1.5s interval, panel-visible only: JS heap, WASM bytes, canvas bytes) down from the old flat 800ms; Tier 2 (per-`requestAnimationFrame`, only while the panel is visible *and* the user has pointered a canvas within the last ~500ms: fps, frame time) freezes at its last value on idle instead of continuing to sample nothing | Complete |
| 2   | **Manual refresh** — `ResourceMonitor` takes `{diag, onRefresh}` instead of self-polling; a Refresh button drives the one-off Tier-0 read, since whole-tab memory is expensive and browser-throttled and has no business running on a timer | Complete |
| 3   | **Resources is now the default tab** (was System Telemetry) — debugging a slowdown starts at the machine, narrows to the app/engine, then the document; tab order left-to-right documents that flow | Complete |
| 4   | **Reconciled with v7.15's `ThreadedBlurBenchRow`** — that component shipped independently onto the pre-rewrite `ResourceMonitor` while this branch was in flight (its own commit message flagged the eventual merge); carried over unchanged onto the new tiered props, since it never read `snap`/`diag` in the first place | Complete |
| 5   | **`ih-diag`'s own copy of the FirstRunScreen z-index fix dropped as a no-op** — v7.14 had already shipped the identical fix (`BrandRevealScreen`'s `zIndexClass` prop, `FirstRunScreen` passing `z-panel`) to master while this branch was open; the two patches were byte-identical | Complete |

## v7.17 Change Summary — 2026-07-11

The tile-wiring arc lands: the operation log goes from feature-gated
scaffolding to a working undo engine with persistence, all behind
switches that ship OFF. The default wasm build is 641,619 bytes (was
642,054 — the 435-byte drop is the brush kernels moving to shared pure
functions, with byte-parity against the live path proven in tests, not
assumed). One user-facing fix ships live: the gallery resume manifest
can no longer be cleared by anything except an explicit deletion.

| #   | Change | Status |
| --- | ------ | ------ |
| 1   | **Flush path reads through `TileBuffer`** behind the `ih_tiles_flush` DevTools switch (single-layer docs; tiles-feature builds only) — render parity, cross-tile strokes, and undo verified live; dirty-rect counts surface in Diagnostics → Resources | Complete |
| 2   | **`ops::apply()` implemented for every op** — Stroke (paint + erase), Blur brush, Text add/edit/remove, Shape add/edit/remove, LayerMove, joining Fill/Crop/Levels. The op log replays over a *document* (pixel plane + live annotation lists — ADR-012), and pixel ops call the engine's own kernels via shared pure functions. Engine-vs-replay byte parity proven by driving the real `paint_down`/`effect_down`/`add_text_annotation` in `src/ops_engine_parity.rs` | Complete |
| 3   | **Op-log undo/redo** behind `ih_oplog_undo` — `undo()`/`redo()` replay from the nearest keyframe when the engine's composite hashes identical to the log's; any unrecorded edit (clone stamp, filters, masks, pixelate/redact) fails the check and falls back to snapshot undo seamlessly (ADR-013). Cursor-based redo, keyframe pruning (base + last 3 in memory), passive always-on recording, annotation ops captured by an engine-vs-log diff at `recomposite()` | Complete |
| 4   | **Op-log persistence** behind `USE_OPLOG_PERSISTENCE` / `ih_oplog_persist` — Dexie v2 adds `opLogs`/`keyframes`/`oplogManifests` (additive; v1 untouched); ~2s-debounced saves commit chunks + keyframes + manifest in one transaction; generation counter drives append-vs-rewrite on history branches; restore replays from the base keyframe and lands on the persisted cursor, undo history intact. Persist → reload → restore proven byte-identical in Rust and live in-browser (75-byte stroke chunks) | Complete |
| 5   | **Keyframes ride the engine's PNG codec** (`oplog_keyframe_png` / `oplog_restore_png`) — the browser-canvas PNG path corrupts pixels (color-space + premultiply transforms on decode; caught live against a real gallery). The engine codec round-trips byte-exact, transparency included; the JS canvas path survives only as a hardened fallback | Complete |
| 6   | **Resume-manifest hardening (ships live)** — the gallery persist effect only saves; clearing happens solely at explicit user deletions (Delete All, bulk delete emptying, removing the last photo, Start fresh). Previously a non-empty → empty photos transition — reachable by dev-reload churn, not just user intent — deleted the manifest | Complete |
| 7   | **Restored sessions read correctly** — History-panel labels synthesize from the ops after an op-log restore; multi-layer docs report the log as inactive instead of broken; archive-restored photos start their log from a clean lazy-captured base | Complete |
| 8   | **ADR-012 + ADR-013 drafted**, ADR-003/004/006 status notes updated to the shipped state (all remain Draft pending dogfooding) | Complete |

Scope honesty: op-log undo and persistence activate only on
single-layer documents (multi-layer keeps snapshot undo untouched),
and most existing photos load as two-layer artboards — the activation
gap is a known, logged decision for a future release. Full QC pass
still owed before any switch defaults flip.

## v7.18 Change Summary — 2026-07-12

Three tool fixes from the `ih-fixes` overnight run (branch
`fix/bbox-copy-stamp-teardown-rename`, one commit each), all verified
on canvas against the production build before merging. TS-only —
`rust/` and the flush path untouched (verified: all diffs confined to
`app/src`). Gates: `tsc --noEmit` + production build clean between
every commit.

| #   | Change | Status |
| --- | ------ | ------ |
| 1   | **Copy/paste for every bounding-box type** — plain Ctrl+C didn't exist (only Ctrl+Shift+C, whole canvas). New `useCopyRegionAction` session hook copies the *active* bbox — crop box, shape/arrow bounds, magic-wand selection bounds — as PNG via the engine's existing `copy_region`, from Ctrl+C or a new "Copy Selection" context-menu item. Paste needed zero changes: region copies re-enter the v7.8 paste-placement flow (placement box, Enter/Esc). DECISION: copies are active-layer bounding-rect pixels, non-mutating; mask-shaped extraction and shape rasterization would need engine APIs (out of scope, parked for Silas); text boxes copy as text natively; Ctrl+C yields to native DOM text selections | Complete |
| 2   | **Stamp state teardown on tool/sub-mode exit** — the last-selected stamp kept firing on every click after leaving stamp mode. Root cause in three places, worst being `useRedStampTool.pendingStamp`: set by event, never cleared, and routed into clicks even in Clone sub-mode. New `useStampTeardown` hook fires on tool deactivate + sub-mode switch and clears pending stamp, selected emoji, and the clone source (JS-side disarm in `useCloneStamp` — the engine has no `clear_source`; the disarm gates `begin_stroke` and aborts in-flight strokes; Alt+Click re-arms). Within-mode behavior untouched | Complete |
| 3   | **"Clone Stamp" → "Stamps" (display label only)** — one string in `toolConfig.ts` feeds button text, tooltip, `title`, and `aria-label`, plus two ShortcutModal copies. Tool id `stamp`, shortcut 9, and persistence keys untouched. Marketing/docs mentions flagged for a separate pass, not edited | Complete |

## v7.19 Change Summary — 2026-07-12

Session 2.0 of the tool-UI arc (branch `refactor/tool-mode-toggle`,
overnight felix run) plus a marketing home-page truth pass. The
refactor is behavior-preserving and was verified in a real browser
against the worktree's production build before merging: all four Paint
sub-modes toggle by mouse AND keyboard (focus-visible ring present),
each body renders and the brush paints (canvas pixel hash changed),
undo restored the exact prior hash, zero console errors. Evidence
screenshots in `~/ai-repo/ih-toolui/qc-evidence-s20/`.

| #   | Change | Status |
| --- | ------ | ------ |
| 1   | **Shared `ToolModeToggle` component** (`ui/tool-mode-toggle.tsx`) — Paint's icon-row + title-below + body-slot pattern extracted into a generic component (`modes`/`activeMode`/`onModeChange`/`columns`/render-prop body), composed 100% from existing primitives (ToolButtonGroup stacked, HOVER_RING SSOT, SectionHeader, settingsPanelMotion) — zero new styling. Paint is the first consumer; ToolsSidebar/AppShell/stores untouched. One structural delta, verified invisible: four conditional `motion.div`s → one keyed `motion.div` under `AnimatePresence mode="wait"` | Complete |
| 2   | **`ToolModule` type + `TOOL_MODULES` registry** (`features/tools/toolModules.ts`) — the registry shape the whole arc (and the command palette) builds on; Paint registered under its legacy `brush` id. Shape only: no routing rewired, no ids/shortcuts/persistence changed | Complete |
| 3   | **Marketing home-page truth pass** — Hero: stale "v2.0" badge dropped, "No upload for demo" → "Free demo — nothing leaves your device", "~200KB WASM bundle" → real ~310 KB gzipped, "Real-time multi-device sync" → "Cloud edit sync when signed in". Features: AI card now says object removal + text extraction are live (card claimed "queued" for weeks), `.ora` interchange added to Format conversion, location-only GPS scrub added to Privacy. CTA: "no upload" → "nothing uploaded" | Complete |
| 4   | **Engine-Roadmap pairing note** — Smart Brush + Magnetic Selection share one edge-detection core (build the gradient/edge map once in Rust, both features consume it); mirrored into the tool-arc plan (`ih-toolui/TOOL_ARC_PLAN.md`) under the Adjust & Select session | Complete |

## v7.20 Change Summary — 2026-07-12

The command palette (WT3 of the three-worktrees plan, overnight felix
run in `ih-cmd`), verified across multiple tools in a real browser
before merging: Stamps › Emojis and Paint › Paint jumps activate the
right tool AND sub-mode, Show Grid rendered 68 live grid lines from
the palette (and its label flipped to "Hide Grid"), theme switched
dark/light live, "Security & EXIF" opened Settings directly on the
Security pane, palette-Undo restored the exact canvas pixel hash, and
zero console errors all session. Evidence in `ih-cmd/qc-evidence-*`.
One investigation en route: the emoji picker "not showing" in the test
browser turned out to be the WSL2 QC environment lacking any color-
emoji font (`fc-list` = 0 matches) — the picker itself mounts fully
(149 buttons, search, categories) and clicks register; not an app bug.

| #   | Change | Status |
| --- | ------ | ------ |
| 1   | **Palette shell** (`a923d1c`) — shadcn Command / `cmdk` (the only new dependency) composed on the existing `ui/dialog` primitive; Alt+, toggles from anywhere via `useKeyboardShortcuts`, behind the same input/textarea/contentEditable guard every other shortcut uses; Esc closes, focus is trapped and restored | Complete |
| 2   | **Action registry** (`e5ec1c6`) — typed entries `{id, label, group, keywords, run()}` in Tools / Settings / Actions groups; Paint's entries derive from `paintModule.modes` (the v7.19 registry), unmigrated tools fall back to `toolConfig.ts` with a yield-to-registry guard so the palette upgrades itself as each tool migrates; persisted Recent group on empty query; state-aware labels (Show/Hide Grid) | Complete |
| 3   | **Hot-toggle actions** (`313f71b`) — sub-mode jumps, live rulers/grid/theme via a `usePreferences` cross-instance broadcast (`lib/preferences.ts` — apply and the Convex pull now notify all hook instances), Settings-tab targeting via a `useUIStore.settingsRequest` signal, undo/redo through a `paletteActions` bridge registered from `useKeyboardShortcuts`. AppShell: zero lines changed; no new window CustomEvents | Complete |
| 4   | **PARKING_LOT candidate logged** — the grandfathered `image-horse:open-settings` CustomEvent (Alt+S) can migrate to the new store signal | Complete |

## v7.21 Change Summary — 2026-07-12

Stage 0 of the tile-wiring morning plan (paired desk session): the
text-bubble-lands-wrong bug, root-caused by in-browser pixel
measurement rather than code reading. The engine renders glyph ink
`0.25·font_size + ascent-inset` inside the annotation tile while the
typing overlay shows glyphs at its content box (constant 2px/4px CSS
padding) — a commit offset that grows with font size: measured (+5,+8)
at default, **(+12,+23)** at a 54px canvas font. Plain typing, no crop
or zoom needed — which is why it read as "lands in a different spot"
in real use.

Verified live before commit (user + measured): default and large font
commits land sub-pixel on the typed position ((0.1,−0.5) / (0.3,−0.3)),
drag-then-commit exact ((0.4,0)), re-edit→commit round-trip changes
**zero pixels** (the mapping is symmetric, no creep), undo restores
pixel-exact. Rust gates clean (fmt / clippy / 60 tests), wasm
642,054 → 642,699 (+645 B, the new export + bindgen glue), tsc + prod
build clean.

| #   | Change | Status |
| --- | ------ | ------ |
| 1   | **`text_ink_offset(text, font_size, bold)` engine method** — returns `[dx, dy]` where the FIRST line's glyph ink begins inside the annotation tile, from `render_text` + `ink_bounds` (the embedded font's true metrics, no eyeballed constants). Existing annotation rendering untouched — no golden-harness / replay-parity impact | Complete |
| 2   | **Symmetric ink-anchor mapping in `useTextTool`** — commit stores `engine(x,y) = overlayPos + cssPad − inkOffset`; `editAnnotation` applies the exact inverse so re-edit cycles are drift-free. Applied only for `background_kind 0` (plain text) — bubble/rect kinds anchor the tile, parked as a separate WYSIWYG item. Overlay CSS padding now flows from shared `TEXT_OVERLAY_PAD_X/Y` constants (`useTextTool` → CanvasArea) so the mapping can't silently desync from the box's real layout | Complete |
| 3   | **Parked, found en route** — text box lingers (neither commits nor closes) when switching tools with it open; no-change re-edit commits push a redundant undo snapshot; bg-kind overlay WYSIWYG. All in PARKING_LOT.md | Complete |

## v7.22 Change Summary — 2026-07-13

Four parallel changesets landing together: byte-budget compression +
gallery range-select, the Align-grid repair + dark-mode elevation, the
bg-box/bubble text-commit fix (finishing what v7.21 started), and tool-arc
Session 2.1. Every item browser-verified against the production build
before merge. Rust gates clean (fmt / clippy / 62 tests); default wasm
642,054 → 643,088 B (+1,034 B across v7.21's `text_ink_offset` and this
release's bg-aware sibling — both explained below). tsc + prod build clean.

| #   | Change | Status |
| --- | ------ | ------ |
| 1   | **Byte-budget compression loop** (`useAutoCompress`) — replaces the single-pass encode (quality 75, 2200px cap, no size target — routinely 300-400 KB out). New ladder: encode, then step quality down to a 0.5 floor, then step dimensions down 15% at a time (quality reset 0.7) until the file fits `targetBytes` (default 200 KB) or the long edge hits 1280; bounded at 8 passes. Anything over 2500px either side is resized as part of the pass. AppShell stops overriding dims — the hook owns size decisions. Verified: 9.9 MB original → exactly 200 KB | Complete |
| 2   | **"Compressing & resizing…" toast** — `CompressionProgress.resizing` flips when any target exceeds the 2500px threshold; the sonner progress toast wording follows | Complete |
| 3   | **Gallery shift-click range selection** — tick a checkbox, shift-click another: the whole run between them joins the selection (additive, file-manager semantics). Anchor follows the last interaction so chained shift-clicks extend. `GalleryBar` keeps the anchor; AppShell provides the additive `onSelectRange`; the dock-mode vertical gallery gets it free (same component) | Complete |
| 4   | **Align/Placement grid works from every selection path** — it only ever armed from the Reselect list (`selectedObject` was set nowhere else), so canvas-selected objects left all nine cells disabled. Now `selectShape` (canvas + Reselect), a freshly committed shape (capturing `add_shape_annotation`'s returned id), `editAnnotation`, and a freshly committed text all arm it; deletes clear it. `handlePlace` re-syncs an open editor after the move — without which text placement was *invisible* (the open editor suppresses the baked tile via `set_editing_text`) and shapes left a stale ghost overlay. Verified: 9/9 cells enable after a shape or text commit, "Bottom right" is a real move, Numpad 5 centers a committed text | Complete |
| 5   | **Dark-mode elevation, and `.shadow-panel` revived** — TWO bugs. (a) `.shadow-panel` was **inert**: its token lives in plain `:root`, but Tailwind v4 only mints utilities from `@theme`, so the class generated no rule and IdleScreen + the `sm` dialog variant had zero elevation in *either* theme (masked because other consumers reach the token via `style={{ boxShadow: "var(--shadow-panel)" }}`). Now a real rule against the same token. (b) Tailwind's scale bakes `rgb(0 0 0 / 0.1)` into every utility — invisible against #121212–#2b2b2b — so `.dark` restates `--tw-shadow` for sm/md/lg/xl/2xl (+ `focus:shadow-2xl`) with layered black plus the 1px light hairline `--shadow-panel` already used. Light mode untouched; `--shadow-panel` is now theme-scoped (its light value is new — required, or the newly-real class would paint 40% black on warm paper). Constraints documented in the CSS: `--tw-shadow` is `@property inherits: false` (must be set on the element — a `.dark` var flip cannot cascade), the rules are unlayered so they outrank Tailwind's `utilities` layer, and the `var(--tw-shadow-color, …)` wrappers survive so `shadow-black/25` still overrides | Complete |
| 6   | **Text with a background box / speech bubble commits where it's placed** — v7.21's ink-anchor mapping covered plain text only. For rect/bubble the raw textarea top-left was stored, but the engine treats that as the *tile* origin, so the bake landed `bg_padding` (rect, **measured 8.5px**) or `tail_margin + bg_padding` (bubble, **measured 71px** — far worse than the reported ~20px) below-right of the preview, constant at every zoom. New engine helper `annotation_ink_offset` beside `build_annotation_tile` (with hoisted `TAIL_LEN`/`TAIL_HALF` and a shared `tail_margin()` — nothing hardcoded JS-side), exported as `text_ink_offset_bg`; `text_ink_offset` delegates to it. Commit maps **all** background kinds through the helper and `editAnnotation` applies the exact inverse, so re-edit cycles stay drift-free. A unit test proves the helper against the real tile builder across kinds × paddings × font sizes. Measured after: rect 6.3→0.8px, bubble 52.6→0.7px, zoomed rect 7.6→1.1px, moved-then-commit 0.5px, plain text unregressed, re-edit round-trip pixel-identical | Complete |
| 7   | **Tool-arc Session 2.1 — Resize/Compress adopts `ToolModeToggle`** — the second tool onto v7.19's shared component: its Compress/Resize tabs become the icon-top toggle, bodies preserved verbatim, `resizeMode` moves into `useToolStore` (alongside brushMode/stampSubMode/shapesMode), and `resizeModule` registers under the legacy `compress` id (ids/shortcut `1`/persistence untouched). The command palette's sub-mode entries now route through `SUBMODE_SETTERS.compress`, so "Resize › Compress" / "Resize › Resize" actually switch it | Complete |
| 8   | **Command palette listed where users look** — v7.20 shipped Alt+, but never advertised it; now in the Alt+/ modal (Panels group) and the status bar's rotating hint pool | Complete |
| 9   | **Command palette redesigned onto the app's own dialog chrome** — off the stock shadcn Command look and onto the Settings/Diagnostics shell (`ui/dialog` at `size="xl"`, 80vh, mono uppercase header): a bordered search field at the top, an `All \| Tools \| Settings \| Actions` segmented rail beneath it (the Diagnostics tab pattern), a Win10-Start-style **Most Used** grid, and the keystroke-search results filling the rest of the dialog. cmdk still owns fuzzy matching, keyboard nav and listbox a11y — only the shell changed. Two details worth knowing: (a) **Most Used ranks by lifetime run count**, not recency — new persisted `useUIStore.commandUsage`, since v7.20's recency-only "Recent" group would let whatever you touched last shove aside the tool you reach for constantly; ties break toward the more recent, and the grid **backfills to 10 from the registry order** so a new user sees a useful set instead of an empty box. (b) The search field's focus ring lives on the *wrapper* (`.palette-search` in styles.css, unlayered) — the global `input:focus-visible { outline: … }` is unlayered raw CSS and outranks any Tailwind focus utility regardless of specificity, so styling the inner input drew a second rounded box inside the border. The tab rail stretches edge to edge (four equal quarters, aligned to the search field above it) | Complete |
| 10  | **Command Palette in the right-click menu** — top item on the canvas context menu, above Undo, with its `Alt+,` shortcut shown. It's the "do anything" entry point (every tool, sub-mode, setting and action is reachable from it), so it outranks the specific items below | Complete |
| 11  | **Tool-arc plan tracked + brought current** — `docs/Tool-Arc-Plan.md` rewritten as a real doc: a status table (2.0 shipped v7.19, 2.1 shipped v7.22, 2.2 next), what each session does, and the 2.6a/2.6b Adjust & Select split (PatchMatch stub, magnetic selection, and the Smart Brush + Magnetic Selection **shared edge-detection core** — build the Rust edge map once, get both) | Complete |

**Confirmed live, parked not fixed:** every text commit pushes a
redundant *second* undo snapshot (via `set_text_shadow`), so the first
Ctrl+Z after typing is a visual no-op. Small engine fix; in PARKING_LOT.
**ADR candidate flagged for Dara:** the anchor→ink convention (stored
`(x, y) = overlay ink − text_ink_offset_bg`) is now the contract across
plain/rect/bubble text on both the commit and re-edit paths.

## v7.23 Change Summary — 2026-07-13

Tool-arc session 2.6: **Edit and Transform → "Adjust & Select"**, the
selection tools consolidated into it, and a shared Rust edge-detection
core underneath. Verified on canvas: from ONE identical click the three
selection kinds return genuinely different masks — wand 290,224 px,
edge-aware 290,170 px (tighter — the edge map walls it in), colour
range 300,872 px (larger — it takes disconnected pixels the wand can't
reach). Gates: cargo fmt / clippy / **66 tests** (+4 for the edge core),
tsc + prod build clean, zero console errors.

| #   | Change | Status |
| --- | ------ | ------ |
| 1   | **Shared edge-detection core** (`src/edges.rs`, new module) — Sobel gradient magnitude, 0..=255 per pixel. Computed over perceptual luminance **and** the raw channels, taking the max: a red/green boundary at matched luminance is a real edge to a human and invisible to a luma-only operator, and the test suite pins exactly that case. L1 magnitude (`\|gx\| + \|gy\|`) rather than a hypot — a sqrt per channel per pixel buys a difference nobody can see once it's thresholded. Border pixels read 0 (a 3×3 kernel has no valid neighbourhood there, and treating the image frame as an edge would wall in every fill that starts near it). **Built once, deliberately shared**: the magnetic lasso and Smart Brush walk these same edges when they land — a second gradient implementation elsewhere is how those two features drift apart | Complete |
| 2   | **Edge-aware wand** (`magic_wand_select_edges`) — the same flood fill, but it won't cross a pixel whose edge strength exceeds the threshold, so a fill stops at the object outline instead of leaking through a soft gradient. The seed pixel is exempt: clicking directly *on* an outline should still select something rather than silently nothing. An "Edge sensitivity" slider appears only for this kind — hidden, not disabled, for the others, so the panel doesn't grow dead controls | Complete |
| 3   | **Color Range** (`color_range_select`) — every pixel within tolerance of the clicked colour anywhere in the image, not just the connected blob (Photoshop's Select → Color Range) | Complete |
| 4   | **One flood fill, not three** — `magic_wand_select` and `magic_wand_select_edges` differ by a single `Option`, so they share one `flood_select`, and all three entry points share one `seed_index` bounds-check. The copy-pasted second fill cost ~1.2 KB of duplicated wasm and would have been the classic fixed-in-one-place-not-the-other bug | Complete |
| 5   | **"Adjust & Select"** — `TransformCropSettings` adopts the shared `ToolModeToggle` with `[Adjust] \| [Select]`; Adjust holds the original crop/transform body verbatim, Select holds the new panel. Display label only — the tool id stays `crop` (shortcut `2`, persistence, the ToolType union all depend on it). Registered as the **third `ToolModule`** (after Paint and Resize), and the palette's sub-mode entries route through `SUBMODE_SETTERS` | Complete |
| 6   | **The wand moved home** — out of Layer Settings, where it sat next to Move and Resize-Layer despite being a selection tool. Three routing sites had to follow it or click-to-select would silently no-op: the canvas `selectionActive` gate (was hard-coded to the old `arrow` tool), the leave-tool cleanup (which would otherwise switch selection off the moment you opened the tool that owns it), and the click-to-select toggle (now also switches to Adjust & Select → Select, since the routing is gated on the sub-mode) | Complete |
| 7   | **Magnetic Lasso — deliberate stub.** The button is in the panel, disabled, and says why: the edge detection it needs already ships (it powers Edge-aware), the path-finding kernel is the remaining piece. It's a real algorithm (live-wire / shortest-path over the edge map) and belongs in an engine session, not a UI one — per the tool-arc plan's own scope flag | Complete |

**WASM size: 643,088 → 658,851 B (+15,763, +2.4%).** Explained, not
accidental: a whole new module (the Sobel core), two new exported
selection methods and their wasm-bindgen glue. Trimmed 1.2 KB back by
sharing the flood fill rather than duplicating it. The edge core is the
foundation for two more planned features, so the cost is paid once.

**Fix (same release): the compression savings badge survives a reload.**
The green Zap badge ("-95%") on a compressed thumbnail is keyed by photo
id and lived in `useGalleryStore` — which had **no persistence at all**.
Every reload silently dropped it, even though the photo it described was
restored from IndexedDB right alongside it. The store now persists
through the same zustand IDB adapter the UI/tool stores already use,
with `partialize` narrowed to **just** `imageSavings`: the photo list is
rebuilt from the gallery manifest (which carries the thumbnails and
content keys), so persisting it here too would be a second, competing
source of truth; `selectedIds`/`modifiedPhotos` are `Set`s that don't
survive JSON and are per-session anyway. Purely additive — a missing key
rehydrates to `{}`, so no migration is required. Verified: compress 12
photos, badges appear (-93% … -98%), reload, all 12 come back identical.


## v7.24 Change Summary — 2026-07-13

**Persistent undo (`ih_oplog_persist`, still OFF by default): two silent
data-loss paths closed.**

A gap-check against the original persistent-undo spec found five of the seven
pieces already shipped and correct — schema (opLogs + keyframes), the debounced
write path, replay-on-restore, the kill switch, and the hash-parity restore test
that proves a replayed document is byte-identical to the one that was persisted.
Those were left alone. The two remaining gaps were both in the *fallback* path,
and both had the same shape: **the log replays perfectly, into a document the
user no longer has.** Nothing throws, so nothing falls back.

| # | Bug | What you'd have lost |
| --- | --- | --- |
| 1 | **Log identity.** `OpLog::with_base` restarts the counter at 0, so a fresh log on the same photoId (AI result, re-load, failed restore) was indistinguishable from the persisted one. The on-disk manifest therefore justified an **append**: new ops landed on the **old chunks over the old base keyframe**, and a restore replayed a mixture of two histories. With counters that happened to match exactly, it read as "nothing new" and saved nothing at all. | A reload silently returns the **pre-AI image**; or a restored document that is a blend of two edit histories. |
| 2 | **Log retirement.** A broken log (an edit the log never recorded) or a multi-layer document still **replays cleanly — into a single-layer document**. The working-copy fallback is never consulted, because nothing failed. | Photo with a log → add a layer → reload → **layers gone**. |

**The fix.** The append decision no longer consults the manifest. It requires a
**binding**: a WeakMap token proving that *this* `ImageHorseTool` instance is the
one holding the persisted log. Every load path constructs a new engine, so the
binding self-voids — an unbound engine rewrites rather than appends. Logs that
are broken or model a multi-layer document are never written, and any log already
persisted for them is **retired** (marked stale), which routes the restore back
to the working copy.

**Schema.** `stale?: boolean` on the manifest, **non-indexed** — so no version
bump, no upgrade function, and no reshaping of existing records. Records written
by the shipped v2 have no such field and read as not-stale. Fixture round-trips
cover both shipped schema versions (a `dexie-migration` skill requirement).

**Tests.** 7 new (42 total, from 35). Five of them **fail against the pre-fix
module** — verified by reverting it — so they pin the bugs rather than the code.
`cargo test --features tiles`: 132 passed, including the byte-identical parity
test.

**Diagnostics.** New **Persisted** gauge: `ops · keyframes · chunks · restored`,
or `retired → working copy` when a log has been stood down.

**ADR-006 stays Draft.** The code is complete; the dogfooding is not, and the
write path changed in this very release. Accepting the ADR would certify a
premise nobody has verified on a real gallery. It carries a 5-step gallery check
that gates Accepted — the layers-then-reload and AI-then-reload cases are the two
that would have lost real work.

## v7.25 Change Summary — 2026-07-13

Two features, each standing on something built earlier: v7.23's shared edge core,
and v7.19's command-palette action registry.

### Magnetic lasso + Smart Brush (`ih_smart_edge`, default OFF)

The disabled lasso stub shipped in v7.23 is now live. Between them sits one new
shared primitive — an **edge cost map** derived from the Sobel magnitude that
already shipped (strong edge = cheap to travel, flat region = expensive). The
lasso path-finds along it; the brush uses it as a wall. Building the map once is
why the second consumer was nearly free.

| Piece | What it does |
| --- | --- |
| **Edge cost map** (`src/edges.rs`) | Pure function of the existing Sobel output. Shared by both consumers. |
| **Magnetic lasso** (`src/livewire.rs`) | Live-wire: minimum-cost path from the last anchor to the cursor, bounded to a search window. `lasso_begin` / `lasso_path_to` / `lasso_commit` / `lasso_close` / `lasso_cancel`. Closing fills the loop into **the same mask + overlay the wands return** — no second selection representation. |
| **Smart Brush** (`src/paint.rs`) | `set_smart_brush(enabled, strength)`. A stroke is contained by strong edges, so paint doesn't bleed across an outline. Off by default; with it off the brush takes its original code path. |

**Performance (native release, 2048×2048).** Cost map **31 ms**, paid once per
lasso session and at the start of each smart stroke — noticeable on a big image,
but not per-frame. Path search during a drag: **1.0 ms** (64 px), **1.6 ms**
(200 px), **5.6 ms** (400 px) — inside a 16 ms frame. The **bounded search window
is what buys this**; unbounded Dijkstra on a 2048² image is ~100× that. Past a
250k-pixel window the engine returns a straight line rather than lag.

**Size:** 658,851 → **659,367 bytes** (+516 for the whole feature). The lasso
commit in isolation *reduced* the binary by 2,321 bytes, which is not a claim
that a Dijkstra is free — it's `-Oz` shifting inlining decisions. Recorded rather
than dressed up.

**Tests:** 86 Rust (from 66). The headline one drops anchors deliberately 3 px
off a known ring and asserts the mid-path hugs the true edge within 2 px **and**
costs less than a straight line across — the property the whole tool rests on.
Plus determinism (byte-identical paths), closed-loop masks, and no-panic
degenerates. Smart brush: a stroke in one region does not bleed into the other.

**Scalar only.** Rayon stays parked behind the COOP/COEP browser-threading
question (ADR-009); the kernels are shaped so a parallel path can drop in later.

### Hash routing + one navigation path (ADR-015)

App state is now URL-addressable: `#/tool/paint/blur`, `#/settings/security`.
Back/forward work; deep links land on load; a garbage hash falls back safely
instead of crashing.

- **No router dependency.** There are no *pages* here — only a tool/sub-mode/pane
  coordinate — so this is a small hash-sync layer (`app/src/features/routing/`),
  not react-router.
- **One nav path, not two.** Palette actions navigate via `navigateTo()`, so
  Alt+, and a pasted link flow through the same registry. The duplicate sub-mode
  tables collapsed into `features/tools/toolModes.ts`.
- **Params:** `?v=` (the share-doc concept that already existed) outranks the
  hash. Nothing new was invented for sharing.
- **New palette entries:** "Copy link to this view", "Go to route…", plus a
  rotating status-bar tip.
- **Side-effect:** a pane you can't read is a pane you can't link, so
  `settingsOpen`/`settingsTab` moved into `useUIStore` — retiring the
  `image-horse:open-settings` CustomEvent, the last window event in the nav path
  (Stage 3 of the AppShell teardown).
- **A crash caught before a browser saw it:** `#/tool/%%%` threw `URIError` out of
  `decodeURIComponent`. The hash is untrusted input; it's now handled.

### Gates

`cargo fmt --check` · `clippy -D warnings` · **86 Rust tests** · **122 TS tests**
(from 42) · tsc clean · app + marketing builds green. ADR-014 and ADR-015 both
stay **Draft** pending the human canvas checks — lasso feel, and back/forward.

**ADR numbering note:** both features were built in parallel worktrees and both
drafted an ADR-014. Routing was renumbered to **015** on landing.

## v7.26 Change Summary — 2026-07-13

Decisions, not features. Two of them, plus the retirement of the project's
longest-running open question.

### Exports include the Canvas by default (BREAKING for existing users)

`exportCanvasBackground` flips `false` → `true` (app/src/lib/preferences.ts).
The old default cropped exports to just the photo, with the rationale "the
backing canvas is a compositional guide, not real content." Under ADR-016 the
Canvas IS the document's bottom layer, so what you see on screen is what you get
on export. Users who never touched the toggle will see padded, coloured exports
where they previously got a tight crop. Opt out in Settings → "Canvas background
on export", or hide the layer in the Layers panel. This was put to Chris with the
consequence named, and confirmed — it is a deliberate reversal, recorded as such
in the ADR.

### ADR-016 — the Canvas is document metadata, not a logged pixel layer (Draft)

The load-bearing finding of the session, verified in code and worse than it
looked:

| Layer of the problem | Evidence |
| --- | --- |
| Every default import is a **two-layer** document (Canvas fill + Photo) | `canvasArtboard: true` is the default (preferences.ts:100); `set_artboard_border` yields the two-layer structure even at pad 0 (lib.rs:2460-2471) |
| The engine **never records** an op log for a multi-layer doc | `oplog_record` returns early when `layers.len() != 1` — and marks the log **broken** if it had already recorded ops (lib.rs:1119-1136) |
| Persistence **refuses to trust** a multi-layer doc | `isLogTrustworthy` returns false when `layer_count() > 1` (oplogPersistence.ts:105-109) |

**Net: op-log undo and persistence are dark on every default document.** Not
flag-dark — *structurally* dark. Four ADRs' worth of shipped work (003, 006, 012,
013) plus the v7.24 data-loss fixes were unreachable by construction. Flipping
`ih_oplog_persist` ON today would have shipped nothing to anyone.

**The decision:** the Canvas stays layer index 0 and stays visible/toggleable in
the Layers panel, but carries an explicit `LayerKind::Canvas` and the op log
counts only **content** layers. A default document is therefore ONE pixel layer,
and the log activates. No auto-flatten, no multi-layer op-log rewrite.

**In scope as step 1, on the pre-mortem's insistence:** an explicit `LayerKind`
flag on the engine's `Layer` struct. The engine currently identifies the artboard
by `layers[0].name == "Background"` — a **string**, checked at four sites — and
the name already means two opposite things (the *fill* in artboard mode; the
*photo* in `load_image` / `flatten_all` / `finish_layer_restore`). A user
renaming a layer "Background" is one step from a silent wrong-document restore.
A name cannot answer "is this the Canvas?"; a kind can.

**Amends prior ADRs (verified, not assumed):** ADR-012 is consistent as-is (needs
only an additive `canvas` field under its own version-byte rule). ADR-006 and
ADR-013 need real clause amendments — both hardcode "multi-layer" as the
log-retirement trigger, which becomes ">1 **pixel** layer, Canvas excluded."

### ADR-009 — Accepted. Cross-origin isolation is confirmed live.

Run in a real browser against a production build, `SPIKE_COEP=credentialless`:
`crossOriginIsolated === true` **logged out AND logged in**, through a real
sign-in. Clerk loaded clean; zero COEP / CORP / SharedArrayBuffer / WebSocket
errors. Isolation holds *through* the auth transition — precisely the step the
original headless spike could only infer ("the final `POST /v1/client/sign_ins`
is inferred, not observed"). It is now observed.

**Consequence:** ADR-011's gate is **open**. The rayon threading path for the
v7.25 magnetic-lasso and Smart-Brush kernels — built scalar *because* this was
unverified — is unblocked.

**Residual, stated plainly:** the "Continue with Google" OAuth popup path was not
separately exercised (and `COOP: same-origin` is *designed* to sever
`window.opener` from cross-origin popups), nor was the Convex WebSocket under
isolation. Neither blocks local threading work; both want a check before COOP
headers ship to production.

### Naming

The create dialog's **"Blank Canvas" → "New Canvas"**. "Canvas" now means exactly
one thing: the fill layer. Display label only — internal ids (`blankMode`,
`createBlank`) do not churn.

### Gates

tsc clean · 122 tests · app + marketing builds green.

## v7.27 Change Summary — 2026-07-13

**ADR-016 implemented: the op log activates on a DEFAULT document.** The
structural blocker found in v7.26 is gone. Ships behind unchanged OFF flags —
this release makes the feature *reachable*, it does not turn it on.

### What was broken (v7.26 found it; this release fixes it)

Every default import is a two-layer document (Canvas fill + Photo, because
`canvasArtboard: true` is the default). The op log refused multi-layer documents
at both levels — `oplog_record` dropped the op and marked the log broken when
`layers.len() != 1`; `isLogTrustworthy` refused any doc with `layer_count() > 1`.
Net: **op-log undo and persistence were dark on every default document.** ADRs
003/006/012/013 and the v7.24 data-loss fixes were unreachable by construction.

### The change

| Piece | What it does |
| --- | --- |
| **`LayerKind { Canvas, Content }`** (src/layer.rs) | Explicit kind on the `Layer` struct, set at creation, serialized with the layer. **Never inferred from a name.** |
| **Four name checks retired** (src/lib.rs ×3, src/layer.rs ×1) | The engine identified the artboard by `layers[0].name == "Background"` — a string that meant *the fill* in artboard mode and *the photo* in `load_image` / `flatten_all` / `finish_layer_restore`. One overloaded name, four call sites, one rename away from a silent wrong-document restore. |
| **Fill renamed "Background" → "Canvas"** | "Canvas" now means exactly one thing. Content layers keep "Background". |
| **`oplog_record` counts CONTENT layers** | A default doc (Canvas + Photo) = ONE pixel layer ⇒ the log activates. |
| **`isLogTrustworthy` reads the content count** | The persistence gate follows the same rule. |
| **`Document` gains `canvas` metadata** (ADR-012's additive-field clause) | Replay reconstructs the fill, so a restored artboard doesn't come back transparent. Format version byte bumped. |
| **Legacy read** | A persisted layer 0 named "Background" in a >1-layer doc decodes as `kind: Canvas`. Existing documents still open. |

### The proof (the deliverable test)

`default_artboard_document_records_ops_and_undo_replays_byte_identically` — a
default Canvas+Photo document records **2 ops where it recorded 0**; the log's
replayed composite is **byte-identical** to the engine's; undo and redo land
byte-exact; the stack is not flattened (still Canvas + Photo afterwards).

**Two guards, both silent-corruption paths:**

- `a_second_content_layer_still_leaves_oplog_scope` — the Canvas stops counting,
  but a genuine pasted layer still does. Out of scope ⇒ broken ⇒ snapshot undo.
  The log must never claim a document it cannot replay.
- `editing_the_canvas_layer_leaves_scope_instead_of_recording_onto_the_photo` —
  the Canvas is a real, selectable layer. If the user paints **on it**, the log
  cannot represent that edit (its document *is* the content plane), and recording
  it would replay the stroke **onto the photo**. It leaves scope instead. Never
  silently wrong.
- `legacy_restore_does_not_mistake_a_photo_named_background_for_the_canvas` —
  ADR-016's pre-mortem, pinned by a test.

### Gates

`cargo fmt --check` · `clippy -D warnings` · **138 Rust tests** (from 132) ·
**123 TS tests** · tsc clean · app + marketing builds green.
**wasm 659,367 → 659,815 bytes (+448, +0.07%)** — the op-log rework itself costs
zero (the `tiles` feature is off by default); the 448 is the `LayerKind`
plumbing.

### Still OFF

`ih_oplog_undo` and `ih_oplog_persist` are unchanged and still default OFF.
ADR-016 stays **Draft** pending the real-gallery dogfood check — which, for the
first time, will actually exercise the op log on a normal photo.

## v7.28 Change Summary — 2026-07-13

**The op-log/tile engine was never compiled into the shipped WASM.** This release
puts it in the binary (ADR-017) and verifies the whole chain end-to-end in a real
browser. Flags remain OFF.

### The bug (a build-config line, months of dead feature)

The `tiles` cargo feature carries the op log and the tile engine. `build:wasm`
ran `wasm-pack build --target web --out-dir pkg` — **no `--features tiles`** — and
Cargo.toml stated it as an invariant: *"NOT compiled into the wasm build — the
default build must stay byte-for-byte unchanged."*

| check, on the shipped binary | before |
| --- | --- |
| `strings pkg/stamp_tool_bg.wasm \| grep -c oplog` | **0** |
| `grep -c oplog pkg/stamp_tool.d.ts` | **0** |

`hasOplogExports()` (tilesFlush.ts:39-43) probes for `set_oplog_undo`. It wasn't
there, so `syncOplog()` returned null, the diagnostics gauges hid, and nothing
recorded. **The three flags gated JS calls into functions that did not exist in
the binary.** Everything fell back to snapshot undo — silently, no error, no
console warning.

So ADR-003, ADR-004, ADR-006, ADR-012, ADR-013 and the v7.24 data-loss fixes were
all shipped as dead code in a binary that never contained them. And the Rust tests
were green the whole time, because they run under `cargo test --features tiles` —
a configuration the shipped artifact had never been built in. **The tests and the
product were testing different programs.**

### How it was found

By checking the shipped binary for `oplog` symbols *before* starting the planned
multi-day dogfood. The dogfood itself would have "passed": undo would have worked,
reloads would have restored, nothing would have crashed — all of it exercising the
snapshot fallback the release was meant to replace.

### The fix

`build:wasm` now passes `-- --features tiles`. `cargo build` / `cargo test` stay
feature-off by default; both configurations are gated and green. The Cargo.toml
invariant comment is replaced with the new reality rather than left lying.

### Verification (real browser, production build, flags on)

| step | result |
| --- | --- |
| op-log exports in the binary | 17 `oplog` symbols (was 0); `set_oplog_undo` present |
| default 2-layer import + one paint stroke | **OP LOG: 1/1 ops · 1 kf · undo** — the gauge rendered and climbed from 0 |
| persistence | **PERSISTED: 2 ops · 1 kf · 1 chunk** — written to IndexedDB |
| reload | **PERSISTED: … · restored** — restored FROM the op log, not the fallback |
| console | zero errors |

### The cost

**wasm 659,815 → 731,595 bytes (+71,780, +10.9%).** serde + postcard (the op-log
codec) and the tile engine now ship to every visitor. This **supersedes every
earlier size figure**, including v7.27's "+448 bytes" for `LayerKind` — that was
measured against a binary without the feature. `wasm-opt -Oz` reaches 730,234, so
a further squeeze exists if the number ever matters.

### Gates

Feature OFF: fmt · clippy `-D warnings` · 86 tests. Feature ON: clippy · **138
tests**. tsc clean · 123 TS tests · app + marketing builds green.

### Still OFF

`ih_tiles_flush` / `ih_oplog_undo` / `ih_oplog_persist` unchanged, still default
OFF. This release makes them *real* — it does not turn them on. The op-log path
has now executed in a browser exactly once, locally. The Phase-1 dogfood
(`~/claude-runs/DOGFOOD_default-flip.md`) is now meaningful for the first time,
and it is what earns the default.

## v7.29 Change Summary — 2026-07-13

Bug-fix release. Four defects, three of them found by the user dogfooding, one of
them shipped by me four releases ago.

### Pen: a closed path never closed (the headline)

Reported as *"the background never works, even if I made a full circle"*.

**Root cause — a hit-test, not geometry.** Closing a path by clicking the FIRST
anchor is the documented gesture, and `onCanvasDown` implements it. That handler
never ran: the first anchor's 8×8 SVG handle sits ON TOP of the capture rect and
calls `stopPropagation`, so the click started an anchor *drag* instead. The path
never committed — so neither the stroke NOR the fill ever appeared. The close is
now handled where the click actually lands (PenOverlay's anchor pointer-down).

**The engine was innocent, and there are now tests to prove it.** Two new Rust
tests (138 → 140):

- `bezier_near_closed_circle_fills_interior` — a cubic circle whose final anchor
  misses the first by a few px, flagged closed, FILLS. `fill_polygon` wraps the
  contour (`(i + 1) % n`), so closure never had to be exact. The user was never
  required to click pixel-perfectly.
- `bezier_no_fill_leaves_interior_untouched` — `fill_kind 0` on the same geometry
  leaves the interior alone, proving the fill above came from the fill
  instruction and not from a fat stroke.

Verified in a browser: a closed path's interior is now uniform RGB(59,130,246) —
zero variance across a 24×24 patch. (The fill still requires fill mode **Solid**;
it couples with the Shapes fill setting, which defaults to none.)

### Pen: reselect made the path vanish

Kind-7 paths fell through `SHAPE_KIND_NAME[kind] ?? "rect"` into the rectangle
bbox handler, which hid the baked path via `set_editing_shape` and drew a
rectangle in its place. Reselect now routes kind 7 to the PenOverlay, which
reloads the anchors + control points, editable. The one-shot edit request lives in
`useAnnotationStore` — **not** as new AppShell state (CLAUDE.md: nothing new goes
into AppShell; orphan `useState` goes to the stores).

### Routing: the start page advertised a tool (regression, mine, v7.25)

With no image open, the address bar read `#/tool/resize/compress` — the tool
store's default. That describes a tool you cannot see or use, and copying the link
hands someone a URL that lands them on the start screen anyway. Routes describe a
view OF AN IMAGE: `routableHash()` now returns "" when `activePhotoId` is null,
and the gallery store is subscribed so the fragment reappears the moment a photo
becomes active. A deep link still survives an image-less boot — `applyRoute` has
already put the state where the link asked; we simply decline to echo it while
there's nothing to echo.

### Tooltips rendered under the gallery — and it was NOT the z-index

`TooltipContent` carried `z-[var(--z-dialog)]` (50) and the gallery is
`--z-panel` (40), yet the gallery still painted over it. The content was rendered
**inline**, inside the panel that owned the trigger — and a panel is its own
stacking context, so that z-50 only ever competed with the panel's own children.
The missing piece was Radix's `Portal`. Bumping the number would not have fixed
it. Now portalled to `<body>`, where the token means what it says. **Fixes every
tooltip in the app.**

Verified by hit-test, not by eye: `document.elementFromPoint()` at the tooltip's
centre now returns the tooltip, where it previously returned a gallery node.

### "Auto Compress" → "Auto Compress & Resize"

Since v7.22 the button also resizes anything over 2500px on a side. The old name
hid that from the person clicking it. A lightbulb (`InfoTooltip`, the house
pattern) now explains the ~200 KB target, the 2500px trigger, and the 1280px floor
below which it will not shrink a photo chasing the number.

### Gates

`cargo fmt --check` · `clippy -D warnings` · **140 Rust tests** · **123 TS tests**
· tsc clean · wasm 731,595 B (unchanged — the new Rust is tests only) · app +
marketing builds green.

## v7.30 Change Summary — 2026-07-13

The dogfood's first finding, and it was a real one.

### Symptom

With the three op-log flags on, painting a stroke on a normal photo left the
Diagnostics **Op Log gauge at `0/0 ops`**. Indistinguishable from "the feature is
dead" — which, two releases running, it had actually been.

### It wasn't dead. It was unannounced.

`app/src/hooks/usePaintTool.ts`:

```ts
const changed = t?.paint_up();
if (changed) flushToCanvas();     // <-- the bug
```

`paint_up()` returns whether the **stabilizer** had catch-up pixels left to paint
(`paint.rs`: `painted` is only set when `paint_leash > 0.0`). With the stabilizer
off — the default — every ordinary stroke returns **false**, because the pixels
all landed during `paint_move`.

But `paint_up()` is *also* the op log's commit point (`rec_stroke.take()` →
`oplog_record`), and `flushToCanvas()` is what publishes it:

- `registerOplogStats(syncOplog(t))` → the diagnostics gauge
- `onOplogFlush(t)` → the **debounced persistence writer**

So a recorded stroke reached neither. The gauge kept showing the stats from the
last *move*, and — the part that matters — **the op's save was never scheduled**.
Reloading right after your last stroke could drop it. Not cosmetic: a data-loss
window.

**Fix:** always flush at stroke end. Cost is one recomposite+blit per STROKE END,
not per frame; the zero-copy per-frame path is untouched.

**Verified** (clean profile, one stroke): `OP LOG 1/1 ops · 1 kf · undo`,
`PERSISTED 1 op`; after reload, `PERSISTED 1 op · 1 kf · 1 chunk · restored` —
restored from the op log.

### Why no test caught it — the same shape as v7.28

Every op-log test builds its document with **`load_image_artboard`**. **The app
never calls that.** `useCloneStamp.loadImageFromPixels` calls `load_image` and
then borders it with `set_artboard_border`, so that a fresh import, a gallery
switch and an AI result all normalise through one call. Two paths to the same
document shape — and only the untravelled one was under test.

Two new tests pin the app's real path (140 → 142):

- `the_apps_own_import_path_yields_one_content_layer_with_the_photo_active` — the
  Canvas is inserted at index 0 and `active` shifts with it, so the PHOTO stays
  active. If it didn't, `oplog_in_scope()` (`content_idx() == active`) would be
  false forever and nothing would ever record on a real import.
- `the_apps_own_import_path_records_a_paint_stroke` — a stroke on the document the
  app actually creates records.

That is twice in three releases that a green suite was testing a program the
product does not run (v7.28: the feature wasn't compiled into the binary at all).
The lesson is cheap to state and expensive to learn: **test the path the app
takes, not a path that reaches the same state.**

### Diagnostics gotcha (not a bug)

The Diagnostics window overlays the canvas — strokes painted while it is open
never reach the image. Paint with it closed, then open it to read the gauge.

### Gates

`cargo fmt --check` · `clippy -D warnings` · **142 Rust tests** · **123 TS tests**
· tsc clean · app + marketing builds green. Flags unchanged, still OFF.

## v7.31 Change Summary — 2026-07-13

Diagnostics, sharpened by the week's debugging. Three rows in the Alt+Delete panel,
each one paid for in hours.

### 1. "Why" — the engine explains its own silence

New `ImageHorseTool::oplog_status()` returns one phrase:

| status | meaning |
| --- | --- |
| `recording` | ops are being logged |
| `armed — base captured, no ops yet` | the log exists, nothing recordable has happened |
| `out of scope — the Canvas layer is active` | edits go to the Canvas fill; the log's document IS the content plane, so recording one would replay it onto the photo |
| `out of scope — more than one content layer` | a real second layer; snapshot undo takes over |
| `broken — snapshot undo has taken over` | an unrecorded edit desynced the log |

**Why this matters:** a counter reading `0 ops` is ambiguous across all five states.
That ambiguity is what let the op log ship dead for several releases (v7.28: not
compiled into the binary at all) and what stalled a day of dogfooding (v7.30: the
op was recorded but never published). An instrument that cannot distinguish "off"
from "idle" from "broken" is not an instrument.

### 2. "Document" — the shape the log is judging

`2 layers · 1 content · on "Photo"`.

- **content** layers, not raw layers, decide op-log scope — the Canvas isn't
  counted (ADR-016). Showing `layers` alone would reproduce the exact confusion
  ADR-016 existed to end.
- The **active layer name** is the tell: if it reads `"Canvas"`, nothing will
  record, and until now that was invisible.

### 3. "NOT IN THIS BUILD"

`syncOplog()` no longer returns `null` when the wasm has no op-log surface — it
returns `supported: false`, and the panel prints **NOT IN THIS BUILD**. Previously
the row simply vanished, which is indistinguishable from "everything is fine, no
edits yet". That is verbatim the v7.28 bug (ADR-017): `build:wasm` didn't pass
`--features tiles`, so the three flags gated JS calls into engine functions that
were not in the binary, and every path fell back to snapshot undo silently. A day
to find. Now: ten seconds.

### Verified in a browser

Fresh import, flags on:

```
OP LOG    0/0 ops · 1 kf · undo
Why       armed — base captured, no ops yet
Document  2 layers · 1 content · on "Photo"
```

after one paint stroke:

```
OP LOG    1/1 ops · 1 kf · undo
Why       recording
Document  2 layers · 1 content · on "Photo"
```

### Gates

`cargo fmt --check` · `clippy -D warnings` · **142 Rust tests** · **123 TS tests** ·
tsc clean · app + marketing builds green. Flags unchanged, still OFF.

## v7.32 Change Summary — 2026-07-13

**Edits were not being persisted.** The dogfood's real finding — and it is not the
op log, which behaved exactly as designed throughout.

### How it surfaced

Dogfooding the op-log flags: *add a layer → reload → the layer is gone.* The
diagnostics (new in v7.31) told the truth immediately: the log had said
`out of scope — more than one content layer` and `retired → working copy`. That is
CORRECT — a second content layer is beyond the log's model, so it stands down and
defers to the working copy. The handoff was to a fallback nobody was saving.

### Bug 1 — there was no autosave

`savePhotoEdit` was called from exactly two places: a photo **switch**, and a new
**import**. There was no `beforeunload`, no `visibilitychange`, no `pagehide`, no
timer. Edit the active photo, reload the tab, and the app restored the **original**.

Verified logged-out with all flags off (the shipping default): paint a stroke,
reload, and the canvas came back **byte-identical to the untouched original**.
Layers, strokes, everything — silently gone. This was live in production.

### Bug 2 — the local save was unreachable when signed in

```ts
if (isAuthenticated) {
  try   { ...cloud upload...; await idbSave(...); return; }
  catch { logDiagnostic(...) }        // ← the local save's only other route
}
await idbSave(photoId, toolRef);      // ← never reached on a HANG
```

The cloud attempt ran **first**, and the local IndexedDB write lived in the
`catch`. That is only a defence against a **rejection**. `generateUploadUrl()` is a
Convex mutation that, when the deployment does not answer, **hangs** — neither
resolves nor rejects. A hang never reaches a catch.

Observed live: `savePhotoEdit enter { isAuthenticated: true }` logged, and then
**nothing** — no success, no error — and the `image-horse-edits` database was never
created. **Signed in with a stalled cloud, edits were written nowhere at all.**

### The fix

**Local first, unconditionally; cloud after, as a bonus.** IndexedDB is the restore
path; Convex is a nicety. The copy that restores the user's work must never sit
downstream of a network call that can hang.

**A real autosave** (`useImageSession`):
- **Idle debounce, 2.5s** after the last edit. Deliberately not per-mutation: the
  archive re-encodes the whole working copy as PNG, so writing on every stroke
  would thrash a large image. Idle is when it is free.
- **`visibilitychange → hidden` + `pagehide`.** These fire on tab close, reload and
  navigation, and unlike `beforeunload` they survive the bfcache and cost no
  "leave site?" prompt. Best-effort — an async IDB write can be cut short on
  unload, which is exactly why the debounce exists as well. Belt and braces, on
  purpose: this is user data with no backup.

### Verified in a browser (flags OFF, shipping default)

| scenario | before | after |
| --- | --- | --- |
| paint a stroke → reload | canvas restored to the ORIGINAL | **stroke survives** |
| add a layer, paint on it → reload | layer gone | **3 layers back, both strokes intact** |
| `image-horse-edits` database | never created | created, one record |

### A note on the analysis that didn't pan out

A plausible theory said the IndexedDB path lacked layer support (that only the
cloud path built the v5 layered archive). It doesn't hold in this codebase:
`lib/editPersistence.ts:342` already calls `collectLayers(t)` and stores `layers` +
`activeLayerId`. That code was correct all along — it was simply never being
**called**, and when it was, the cloud hang got there first. The lesson is the
week's recurring one: read the file, don't reason from the snippet.

### Gates

tsc clean · **123 TS tests** · **142 Rust tests** · app + marketing builds green.
Op-log flags unchanged, still OFF — this fix is independent of them and helps every
user today.

## v7.33 Change Summary — 2026-07-14

**A second data-loss bug, caught before it shipped.** Before flipping the op-log
undo/persistence flags to default ON, the same build was A/B'd: flags off vs. flags
on, on a clean profile. Import a photo, edit nothing, reload. Flags off: 220×170,
Canvas intact. Flags on: 200×150, Canvas destroyed. Same build, same steps, only
the flag differs — reproduced on demand, not a maybe.

### Root cause

The op log's base snapshot is captured lazily, at `snap()` — and `snap()` runs
**before** the mutation it's guarding. The app's own import path
(`load_image` then `set_artboard_border`) is a "snap-without-record" mutator: it
snapshots, then applies the border, but never records an op for it. So an
edit-free import armed the log against the **pre-border** document — the bare
photo, no Canvas — and left it that way forever, since with zero edits nothing
ever came along to rebase it.

That empty, stale-based log then got persisted (its `opCount` was 0, but nothing
stopped it from being written), and `restoreOplog` reported success on it —
which **short-circuited** the working-copy fallback that would have restored the
full document correctly. ADR-016's own pre-mortem named this exact shape of
failure in advance: "restore then replays confidently into the wrong document
and hands the user back an older image, silently."

Note for the record: ADR-016's canvas-metadata field (pad, size, RGBA on the
keyframe) was **not** missing, as first suspected — it shipped in `df5ee04` on
2026-07-13. The bug was the stale base underneath it, not an absent field.

### The fix

1. **Rebase, not just record.** `recomposite()` now checks, on every frame: is
   the log empty, in scope, and its base dimensions wrong for the live
   document? If so, re-anchor it from the engine before anything else runs.
   O(1) — two integer compares per frame; the rebase itself (which allocates)
   fires only once per unlogged, dimension-changing mutation.
2. **Incomplete restore is not success.** A zero-op log carries nothing a
   normal reload can't already recover from the working copy, so the write
   path no longer persists one, and the restore path no longer restores one —
   at three separate points: `onOplogFlush`, `saveOplogNow`, and
   `restoreOplog`. Zero-op manifests already written to a real user's disk by
   a pre-fix build are covered too: they're read back as "none," not treated
   as valid, and retired (stale flag only — rows kept, reversible) the next
   time that photo is saved.

### Verified

| scenario | flags OFF | flags ON |
| --- | --- | --- |
| edit-free import → reload | 220×170 | **220×170 (was 200×150)** |
| paint stroke → reload | stroke + Canvas survive | **stroke + Canvas survive** |

A Playwright e2e regression (`e2e/oplog-canvas-restore.spec.ts`) pins both rows —
confirmed failing against a wasm built from the pre-fix tree
(`Expected: 276, Received: 256`), passing against the fix. A new engine test,
`the_apps_own_import_path_arms_with_the_post_artboard_base`, pins the same fact
at the Rust level: the log's base must be the post-artboard document, not the
bare photo.

### Gates

cargo fmt/clippy clean, both feature configs · **88 default + 168 `tiles` Rust
tests** · tsc clean · **128 TS tests** · e2e 2/2 (headless chromium) · wasm
733,440 → 733,842 B (+402, the new rebase function) · production build green.

Feature flags — `ih_tiles_flush` / `ih_oplog_undo` / `ih_oplog_persist` — remain
OFF by default. This fix removes one of the two known blockers on flipping them;
the real-gallery check (ADR-016) is still outstanding.
