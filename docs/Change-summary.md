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
| 6   | **Docs** — `Architecture-Roadmap.md` (document-based-editor direction, prioritized, mapped onto the real repo — noting Rust already owns the document model), `docs/internal/Security-Hardening.md` (audit → repo), `OpenRaster-Export-Import.md` (grounded `.ora` plan) | Complete |

## v5.8 Change Summary — 2026-06-29

The Zustand migration's payoff: `AppShell` now reads its UI / tool / gallery state
from the stores instead of ~38 local `useState`s — plus a logged-in photo-switch
speedup and a CI clippy fix. **Behaviour-preserving** (the app works exactly as
before); verified by `tsc -b` + `vite build` and in-browser including persist
hydration on refresh. fallow's unused-files count dropped 10 → 5 (the 5 store files
are now reachable). This is the groundwork for splitting the 3k-line `AppShell` into
per-feature modules (see [Architecture Roadmap](archive/Architecture-Roadmap.md)).

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

## v7.34 Change Summary — 2026-07-16

| #   | Change                                                        | Status                                  |
| --- | ------------------------------------------------------------- | --------------------------------------- |
| 1   | `marketing-two/` — five-page static site, no build step        | Complete, not deployed                  |
| 2   | Honest headline: "nothing leaves your tab **by accident**"     | Complete — claim sits above its table   |
| 3   | Home — spec table of what runs where + local/server filter     | Complete                                |
| 4   | Architecture — two-plane map, severable seam, Convex schema    | Complete — 6 tables, 58 fields          |
| 5   | Architecture — tier filter dims what a tier never touches      | Complete — all/demo/free/pro            |
| 6   | Features — sticky rail + 40 features from `docs/Features.md`   | Complete — 25 engine, 15 UI             |
| 7   | Pricing — $0 stat hero, 3 tiers, access matrix + tier filter   | Complete                                |
| 8   | Trail Log — month filter, achievement cards, commit graph      | Complete — 82 releases, 211 commits     |
| 9   | ⌘K command palette with the full keyboard model                | Complete                                |
| 10  | `system-architecture.mermaid` shipped as a download            | Complete — mermaid can't parse OKLCH    |
| 11  | Zero external JS; webfont is the only third-party request      | Complete                                |

**The headline was the point.** "Your pixels never leave the tab" was true in demo mode and false everywhere else — sign-in syncs edits to Convex, AI passes reach Replicate, Pro originals go to UploadThing. It's now "nothing leaves your tab by accident," which is defensible with what already ships: the padlock, the tier gating, and a table that names every operation and where it runs. The one hard claim the site makes now arrives attached to its evidence.

**Every number is generated, not written.** Releases from `Trail.tsx` (82), commits from `git log` (211 across 42 active days), features from `docs/Features.md` (40 — a list the old site never carried), tiers from `Pricing.tsx`, schema from the old `Architecture.tsx`. Regenerate from source rather than hand-editing.

**Still open.** The nav measures ~830px against the ~720px ceiling a content-sized floating pill wants — it should either drop the Home link or become a full-width bar during the React port. `docs/Change-summary.md` lists 87 distinct versions; the trail log knows 82.

**Not deployed.** `marketing/` is untouched and still the live site. The port plan is `~/claude-runs/MARKETING_TWO_TO_REACT.md`.

---

## v7.35 — 2026-07-16

**The new site is now the site.** The five-page build that shipped last version as
`marketing-two/` is ported to React and has replaced `marketing/`. The staging
copy is deleted. Live at [image-horse.vercel.app](https://image-horse.vercel.app/).

| #   | Change                                                          | Status                                  |
| --- | --------------------------------------------------------------- | --------------------------------------- |
| 1   | Ported to Vite + React 19 + react-router — 5 routes              | Complete — `/` `/architecture` `/features` `/pricing` `/trail-log` |
| 2   | `marketing/` replaced; `marketing-two/` deleted                  | Complete                                |
| 3   | Tailwind dropped from the marketing app entirely                 | Complete — plain CSS off `tokens.css`   |
| 4   | Old Tailwind sections/pages/components removed                   | Complete — 12 files                     |
| 5   | Data → typed modules (`src/data/*.ts`)                           | Complete — releases, commits, features, schema |
| 6   | `scripts/gen-trail-data.mjs` regenerates commits + features      | Complete — part of the release routine  |
| 7   | **Fix:** `--z-modal` was undefined → nav painted over the ⌘K palette | Complete — token added at 400        |
| 8   | **Fix:** features rail marked the wrong entry, 17 of 18 positions | Complete — topmost-in-band, not latest  |
| 9   | **Fix:** one class did duty as both features container + paragraph | Complete — `.fx__text` split out       |
| 10  | ⌘K now routes client-side instead of reloading the document      | Complete — verified no full reload      |
| 11  | Hash targets clear the fixed nav                                 | Complete — `[id] { scroll-margin-top }` |

**Three real bugs, found by measuring rather than looking.** The ⌘K palette set
`z-index: var(--z-modal)` and nothing ever defined that token, so it computed to
`auto` and the nav — a positioned element at `z-index: 300` — painted straight
over the open modal. The features rail was worse: instrumenting it showed the
highlight was wrong at 17 of 18 scroll positions, always one item ahead, because
it marked whichever item had most recently entered the observer's band. The next
item's top edge would peek in and steal the highlight while the item you were
actually reading still filled the screen. It now marks the topmost item in the
band. Both bugs existed in the static site and neither was visible without a probe.

**Numbers can't go stale.** `src/data/commits.ts` (the trail-log squares) and
`src/data/features.ts` are generated from `git log` and `docs/Features.md` by
`marketing/scripts/gen-trail-data.mjs`. It runs as part of the release routine —
first run already picked up a day the hand-written copy had missed (212 commits
across 43 days, not 211/42). `releases.ts` stays hand-written, because it's the
changelog.

**Verified against the production build**, not the dev server: all 5 routes 200;
⌘K opens, focuses, filters, routes client-side and restores scroll; trail-log
filters (Jun→36, Feb→1, All→82) with all 6 achievement cards at an equal 400px;
pricing tiers equal at 376px and the tier filter dims the right columns; zero
horizontal overflow at 320 / 375 / 414 / 768 / 1280 / 1440; the mobile burger sits
at x=308 on a 375px screen.

**Still open.** The nav measures ~830px against the ~720px a content-sized pill
wants — drop Home or go full-width. `docs/Change-summary.md` lists 88 distinct
versions; the trail log knows 82.

---

## v7.36 — 2026-07-17

**The op log is on by default.** The four-check A/B passed and the three
switches (`ih_tiles_flush`, `ih_oplog_undo`, `ih_oplog_persist`) flipped from
opt-in to kill switches — `"0"` in localStorage disables each per profile;
`USE_OPLOG_PERSISTENCE` in `app/src/lib/dexie/flags.ts` is the build-time
revert.

| #   | Change                                                              | Status                                     |
| --- | ------------------------------------------------------------------- | ------------------------------------------ |
| 1   | Op-log recording, replay undo, and persistence default ON            | Complete — flags now opt-OUT (`"0"` kills) |
| 2   | Four-check A/B on the production build                              | Passed — dims parity, stroke + AI round trips |
| 3   | **Fix:** checkerboard backdrop desynced from the CSS-fit canvas      | Complete — pattern moved onto the `<canvas>` element itself |
| 4   | New engine parity test: the app's exact import flow + stroke + restore | Complete — `app_flow_stroke_persist_restore_keeps_the_canvas` |
| 5   | ADRs 003 / 004 / 006 / 012 / 013 / 016 / 017 → Accepted             | Complete — INDEX updated                   |
| 6   | `docs/Architecture.md` documents the live op-log pipeline            | Complete — supersedes the "Planned" entry  |

**What check 3 actually found.** The stroke round-trip looked like it destroyed
the artboard Canvas. It didn't: the write path had persisted the correct
post-artboard base keyframe (verified in IndexedDB — 2068×1243, canvas metadata
in the annotations blob), and the restore came back byte-exact, "2 layers ·
1 content · restored" in the diagnostics. What was actually wrong: the
transparency checkerboard was a separate backdrop div sized in raw document
pixels, while `.main-canvas` is CSS-shrunk to fit the window (`max-width`/
`max-height`, styles.css). On any document larger than the viewport the two
drifted — measured 450px of horizontal mismatch — showing up as a phantom
checkerboard strip beside the photo in one session and a "vanished" Canvas
after reload in another. Same bug, both times. The checkerboard is now the
canvas element's own background and shares every scaling mechanism by
construction.

**Verified on the shipped defaults** (all localStorage keys cleared): import →
stroke → "recording · 1/1 ops · PERSISTED 1 chunk" → reload → "restored", full
2068×1243 with the Canvas layer intact → Ctrl+Z moves the op cursor to 0/1.
Engine gates: fmt, clippy `-D warnings`, 169 tests incl. the new parity pin.

## v7.37 — 2026-07-18

**The Features page sidebar got redesigned.** The rail listing all 40 features
was flat text with no icons, sitting flush against the page edge, and its two
groups were hardcoded open — so a 375px phone opened straight onto a stack of
40 items before any real content. It's now an inset panel with a `lucide-react`
icon per group and per feature, a badge-style count, and a filled active row.

| #   | Change                                                                       | Status                                                        |
| --- | ------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| 1   | Rail rebuilt as an inset panel — icon rows, badge count, filled active state | Complete — shadcn/ui sidebar pattern                          |
| 2   | All 40 features + both groups mapped to a named icon                        | Complete — `src/data/featureIcons.ts`, hand-maintained (`features.ts` is generated) |
| 3   | **Fix:** mobile accordions were hardcoded open                              | Complete — now tied to the same breakpoint `Nav.tsx` uses, closed on mobile / open on desktop |
| 4   | Body headings carry the same icon as their rail entry                       | Complete — rail and content read as one list                 |

**Verified against the production build**: `tsc -b` clean, `pnpm run build`
succeeds, manual pass in Chrome at desktop width plus 320/375/414/768px — no
horizontal overflow, scrollspy and the collapse both hold up.

## v7.38 — 2026-07-18

**PatchMatch object removal merges to master, still off by default.** Day
one of a multi-day arc: a scalar PatchMatch nearest-neighbor-field kernel
(Barnes et al.) reconstructs a masked region from the rest of the image —
free, local, no sign-in. Single-resolution only; parallel search (day 2)
and a multi-resolution pyramid (day 3) are next.

| #   | Change                                                                | Status                                                             |
| --- | ------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| 1   | Scalar PatchMatch NNF core + inpaint fill (`src/patchmatch.rs`)       | Complete — 19 unit tests, seeded/deterministic                    |
| 2   | Remove Object wired into Adjust & Select's Select mode                | Complete — behind `patchmatch` cargo feature + `ih_patchmatch` flag, both OFF |
| 3   | Result recorded as a history keyframe, not a replayable op-log entry  | Complete — matches the `rotate_90_cw` / `resize_canvas` precedent  |
| 4   | ADR-018 accepted                                                      | Complete — confirmed the fill on a real canvas before merging      |

**Verified**: full gate suite green across every feature-flag combination
(fmt, clippy, `cargo test` — 88/107/188 passing depending on config), `tsc`,
`vitest`, production build. Default (flag-off) wasm is byte-count-identical
to the pre-merge baseline; flag-on grows the binary by 6,585 bytes (+0.90%).

## v7.39 — 2026-07-18

**The AI tool is relabeled Eraser, and its panel is consolidated.** Tool id
stays `ai` internally (shortcuts, persistence, routing untouched) — only
the label and icon change. Brush Eraser moves here from Paint; Magic Eraser
(v7.38's PatchMatch kernel), Background Removal, and Object Removal join it
in one panel.

| #   | Change                                                                 | Status                                                       |
| --- | ------------------------------------------------------------------------ | --------------------------------------------------------------|
| 1   | AI tool relabeled Eraser (brain icon → eraser icon)                    | Complete — tool id `ai` unchanged                            |
| 2   | Brush Eraser moved from Paint into this panel                          | Complete — same local/free/no-sign-in eraser                 |
| 3   | Magic Eraser slot added for the local PatchMatch kernel                | Complete — labeled Coming Soon, not yet wired to this panel   |
| 4   | 4× Upscale placeholder moved to Effects; text extraction moved to Text | Complete                                                     |
| 5   | Smart Crop and Auto-Enhance placeholders removed                       | Complete — never wired to anything                           |

**Verified**: `tsc --noEmit` clean, `cargo fmt`/`clippy -D warnings` clean,
`cargo test` 96/96 passing (app-side `vitest` 164/164), production build
succeeds against the default wasm.

## v7.40 — 2026-07-18

**The three persisted Zustand stores stopped trusting IndexedDB blindly.**
An audit of `useToolStore` / `useUIStore` / `useGalleryStore` found that
`persist`'s default hydration merges whatever comes back from storage
verbatim — but that storage is same-origin-writable (another tab, a stale
cached build, a future rename or narrowing of one of the sub-mode unions),
and nothing re-checked it against the running code's current types.

| #   | Change                                                                    | Status                                                                    |
| --- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1   | Each store's `persist` config gained a `merge` that validates every partialized field against its current allowed values | Complete — falls back to the in-code default for anything stale/corrupted; runs every rehydrate, not just on a version bump |
| 2   | New `validated` / `validatedStringArray` / `validatedNumberRecord` / `validatedRecord` helpers in `stores/_shared.ts` | Complete                                                                  |
| 3   | Eraser panel's mode (Eraser / Magic Eraser / Background Removal / Object Removal) lifted from `AISettings.tsx` local state into `useToolStore.eraserMode` | Complete — matches `brushMode`/`stampSubMode`/`shapesMode`; pure relocation, routing unchanged |
| 4   | `stores/persistence.test.ts` — partialize key-set + fallback-behavior tests for all three stores | Complete — 12 new tests                                                   |
| 5   | `docs/State-Management.md` §6 corrected (it had drifted — claimed `useGalleryStore` wasn't persisted at all, and listed a `useUIStore` partialize set missing `recentCommands`/`commandUsage`) and a new §6.1 documents the guard | Complete |

**Verified**: `tsc --noEmit` clean, 176/176 vitest passing (12 new),
production build succeeds. Live-checked in Chrome: `eraserMode` round-trips
through a real page reload via IndexedDB, and canvas routing
(`useEffectiveTool`) keeps sending the brush eraser regardless of which
panel tile is selected.

## v7.41 — 2026-07-19

**The app shell gets a precache-only service worker, merged dark.** Every
visit re-downloaded the full shell — ~3.6 MB across 9 assets, including the
734 KB WASM engine — and a network drop mid-session made the next boot fail
entirely, despite every original and edit already living in IndexedDB. The
service worker that landed caches the build's own hashed assets and nothing
else: zero `runtimeCaching`, so Clerk, Convex, share URLs and every API call
pass through untouched, and IndexedDB is not involved at any point.

It is opt-in at build time and ships off. `VITE_ENABLE_SW` unset — the
default — emits no `sw.js`, no workbox chunk, no `version.json`, and no
registration code; `setupServiceWorker()` in `main.tsx` is statically
eliminated. Decision recorded in
[ADR-019](adr/019-opt-in-precache-service-worker.md).

| #   | Change                                                                    | Status                                                                    |
| --- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1   | `vite-plugin-pwa` (generateSW) wired into `app/vite.config.ts` behind a three-state `SW_MODE` — `off` (default) / `on` / `kill` | Complete — precache-only, `registerType: 'prompt'`, zero `runtimeCaching` |
| 2   | `lib/pwa/swBoot.ts` + `updateToast.ts` — registration, hourly `registration.update()`, and an update prompt that never calls `skipWaiting` under an active edit | Complete — a new build waits for an explicit Reload |
| 3   | `lib/pwa/skew.ts` + `skewVerdict.ts` — per-build hash in both the bundle and a never-precached `version.json`; a mismatch means a stale cache is serving old JS/WASM | Complete — raises the update toast plus one `console.error`, re-checked on every engine init rather than boot only |
| 4   | `VITE_ENABLE_SW=kill` emits a self-destructing `sw.js` | Complete — the only correct way off once an ON build has shipped; unsetting the flag strands installed workers with no code left to evict them |
| 5   | `e2e/no-sw-default.spec.ts` — asserts a default build registers nothing | Complete |
| 6   | `e2e/sw/sw-lifecycle.spec.ts` + `playwright.sw.config.ts` — second harness covering install, precache, offline boot, update prompt and the kill build | Complete — the e2e stage now runs two configs |
| 7   | `lib/pwa/skewVerdict.test.ts` — unit coverage for the skew verdict | Complete — 8 new tests |

**Verified**: ship-dark re-checked on the production build at merge — no
`sw.js`, no workbox chunk, no `version.json`, and zero occurrences of
`serviceWorker` in the emitted bundle. `tsc --noEmit` clean, 184/184 vitest
passing, production build succeeds.

## v7.42 — 2026-07-22

**The lint gate becomes real.** The definition of done in `CLAUDE.md` has
listed `npx eslint app/src --max-warnings 0` for months. There was no
`eslint.config.*` anywhere in the repo — master or any worktree — and ESLint
was not a dependency in either `package.json`, so every invocation had `npx`
fetch ESLint from the registry and then exit on config-not-found. The gate
had never once run. It was worse than having no gate, because the checklist
implied it had.

A flat config now lives at the workspace root: `@eslint/js` recommended,
`typescript-eslint` recommended, and the two classic React hook rules, plus
`react-refresh/only-export-components` for Vite HMR. Correctness only — no
formatting or style rules. The gate is **errors-only**: `pnpm lint` exits
non-zero on any error, and warnings stay visible as a tracked backlog rather
than being silenced.

First honest run over 207 files: **90 problems, 26 errors and 64 warnings,
with 182 files completely clean.** All 26 errors are fixed in this release.

| #   | Change                                                                    | Status                                                                    |
| --- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1   | `eslint.config.mjs` at the workspace root — flat config, ESLint 10 (`.mjs` because the root `package.json` is CJS) | Complete — `pnpm lint` and `npx eslint app/src` both work |
| 2   | ESLint 10.7 + `typescript-eslint` 8.65 + `eslint-plugin-react-hooks` 7.1 + `eslint-plugin-react-refresh` 0.5 added as root devDependencies | Complete — none of them were installed before |
| 3   | 11 `no-useless-assignment` dead stores removed — initializers overwritten on every path before any read | Complete — `tsc` definite-assignment verified each one |
| 4   | 3 `no-explicit-any` casts replaced — two `storageId as any` become `Id<"_storage">`, one Convex row field gets a narrow inline type | Complete |
| 5   | 2 `no-unused-expressions` — `cond ? a() : b()` used as a statement became `if/else` | Complete — behaviour identical |
| 6   | 3 empty `catch {}` blocks documented; 2 dead test helpers deleted; 2 `prefer-const` | Complete |
| 7   | 2 stale `eslint-disable` comments removed — written for a linter that had never run | Complete |
| 8   | `no-unused-vars` configured to honour the existing `^_` convention (`_settings`, `_onChange`, `_dropped`) | Complete — the code already marked intent; the rule now reads it |
| 9   | `CLAUDE.md` definition of done corrected — `--max-warnings 0` replaced with `pnpm lint`, with a note on why it must not come back | Complete |

**Deliberately deferred**, each its own decision rather than a side effect of
wiring a linter:

- **`max-lines` and the entropy/drift rules.** The tripwire that would catch
  the next AppShell, but enabling it the same day as the config buries the
  signal under the current one. Needs a ratchet baseline first.
- **The React Compiler rule set.** `eslint-plugin-react-hooks` v7's
  `recommended` is no longer the two classic rules — it now carries 17,
  14 of them `error`. Measured against this codebase it reports **123
  react-hooks problems (66 errors)** versus 57 warnings for the classic
  pair: `refs` 35, `set-state-in-effect` 18, `purity` 10,
  `static-components` 2, `preserve-manual-memoization` 1. Real correctness
  rules and worth a session of their own; enabling them here would have made
  the gate red on day one.
- **Type-aware linting** (`recommendedTypeChecked`) — needs a TS program per
  run and produces a much larger initial wave.

**Test files had no static analysis before this.** `app/tsconfig.json`
excludes `src/**/*.test.ts(x)` from the `noEmit` pass, so `tsc` — including
`noUnusedLocals` and `noUnusedParameters` — has never seen the 13 spec files.
ESLint is the first checker to read them; 3 of the 26 errors were there.

**Verified**: `pnpm lint` reports 0 errors / 62 warnings, `tsc --noEmit`
clean, 184/184 vitest passing, app and marketing production builds succeed.

## v7.43 — 2026-07-23

**The Selection tool overhaul — magnetic lasso, "place on a new layer", and a
panel that matches Paint.** The magnetic lasso (live-wire, shortest-path over
the Sobel edge map — the same edges the edge-aware wand uses) is enabled by
default. It was fully built and wired for weeks behind the `ih_smart_edge`
flag; the only thing left was a human confirming the feel, which is now done.
Its flag was decoupled from the Paint "Smart Brush", which stays gated on its
own.

The four selection kinds (Wand, Edge-aware, Color Range, Magnetic) moved onto
the shared multi-mode panel template the Paint tool uses — icon tiles on top,
the active kind's description in a lightbulb tooltip, no permanent paragraph.
The old "Coming soon" stub is gone.

New: **Selection → new layer**, Copy (`Ctrl+J`) or Cut (`Ctrl+Shift+J`),
Photoshop's Layer-via-Copy / Layer-via-Cut. The masked pixel copy runs through
a new WebAssembly SIMD128 kernel (`mask_clear_rgba`) with a bit-identical
scalar fallback.

| #   | Change                                                                    | Status                                                                    |
| --- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1   | Magnetic lasso enabled by default; decoupled from `ih_smart_edge` (Paint Smart Brush stays gated) | Complete — always-present 4th selection kind |
| 2   | Selection sub-modes migrated to the shared `ToolModeToggle` (Paint's pattern); per-kind lightbulb; "Coming soon" stub removed; All/None/Delete restyled as tiles | Complete |
| 3   | `selection_to_new_layer(cut)` engine method + `simd::color::mask_clear_rgba` (wasm128 + scalar fallback) | Complete — Copy `Ctrl+J` / Cut `Ctrl+Shift+J`, 4 engine tests + 3 kernel tests |
| 4   | `copy_region_composited` — selection copy samples the VISIBLE composite (text/shapes/all layers), honors the canvas-background-on-export pref | Complete — Ctrl+C over a caption no longer pastes a blank rect |
| 5   | Rulers & draggable H/V guides no longer flash full-canvas entering the Batch editor, nor lag leaving it (overlay re-reads the canvas rect post-layout) | Complete |
| 6   | Text drop shadow: "Box" with Background = None casts from the text silhouette instead of nothing | Complete — engine-side, regression-tested |
| 7   | Settings copy: "Canvas on import" → "Importing: …"; "Canvas background on export and copy to clipboard" → "Exporting: …" | Complete |
| 8   | React Compiler lint rules adopted (`static-components` + `purity`, at zero violations); 6 render-phase fixes; ADR-020 | Complete — see ADR-020 |

**Verified**: `cargo fmt --check` clean, clippy `-D warnings` clean on default /
tiles / patchmatch, engine tests pass; `tsc --noEmit` clean, eslint 0 errors /
62 warnings, 195/195 vitest, app + marketing production builds succeed. Shipped
WASM 735,865 B (+1,192 over the v7.42 baseline — the new `selection_to_new_layer`
export, the mask-clear SIMD kernel, and the text-shadow fallback branch).

## v7.44 — 2026-07-23

**Select becomes a real tool — its own button, canvas-first, every step
undoable.** Selection had lived inside "Adjust & Select" behind a
Click-to-select toggle: three flags deep before a canvas click did anything,
and every selection drag spawned the crop box, because the only rectangle
gesture in the app belonged to crop. Select is now tool #11 (press `S` — the
first letter shortcut; the digit row filled up at ten). Pick it and the canvas
just works: click fires the active kind, drag sweeps a marquee. Adjust is
just Adjust again.

The marching-ants display bug: the selection overlay hard-coded its CSS size
to the image's natural pixels while the canvas is fit-scaled to the window —
on any photo larger than the viewport the ants drew 2–3× bigger than the
selection they described. All four kinds looked broken; the engine mask was
right the whole time. Both overlays (ants + lasso wire) now render into the
canvas's measured layout box.

| #   | Change | Status |
| --- | -------- | -------- |
| 1   | Select split out of `crop` as tool id `select` (first id born matching its label); Adjust/Select sub-mode, `selectionMode` flag and the Click-to-select toggle deleted | Complete — one gate: being on the tool IS the arming |
| 2   | Drag = marquee: `rect_select` / `ellipse_select` engine producers riding the shared combine pipeline; Rect/Ellipse shape control; 4px click-vs-drag threshold; dashed preview | Complete — 13 engine tests |
| 3   | Overlay fit-scale fix: SelectionOverlay + LassoOverlay take the canvas's ResizeObserver-measured CSS box instead of the natural size | Complete — pre-existing on master, first seen on large photos |
| 4   | Shift = add / Alt = subtract ON by default; `ih_selection_bool` becomes a `"0"` kill switch; Select-tool cursor badges the intent (+/−) | Complete |
| 5   | Every selection change is one undo step with a History name (Magic Wand, Edge Select, Color Range, Magnetic Lasso, Marquee, Add/Subtract Selection, Select All, Deselect); no-op clicks push nothing | Complete — 8 engine tests |
| 6   | Selection-only steps are transparent to the op log (never seek or break it); undoing Delete Selection / Layer-via-Cut restores the mask along with the pixels | Complete — lockstep pinned by test |
| 7   | Select panel: one "Selection" header + lightbulb over five actions (All / Deselect / Delete / Copy / Cut in two 3-column rows); "New Layer" sub-header gone; "None" renamed Deselect | Complete |
| 8   | Legacy links (`#/tool/adjust/select`, `?tool=adjust&mode=select`) land on the Select tool; palette kinds are real routes (`#/tool/select/wand`) | Complete |

**Verified**: `cargo fmt --check` clean, clippy `-D warnings` clean, engine
tests pass (incl. 13 marquee + 8 history); `tsc --noEmit` clean, eslint 0
errors / 61 warnings, 198/198 vitest, production build succeeds. Shipped WASM
743,834 B (+7,969 over v7.43 — marquee producers, selection-carrying
snapshots, history labels).

## v7.45 — 2026-07-24

**See what a selection will grab before you commit to it.** Pick the Select
tool, hover over the image, and hold a modifier: the region a click *would*
select lights up as a filled zone — green while you hold Shift (what you'd
add), red while you hold Alt (what you'd subtract). It re-floods live from
the pixel under the cursor as you move. Click and it commits; the zone
becomes the real marching ants. Let go of the key or move off the image and
it clears. It changes nothing on its own — it's there so you can aim.

Works for the Wand, Edge-aware, and Color Range kinds (the magnetic lasso is
anchor-based, so it has no hover preview). The preview runs the *same* flood
the actual click runs — computed in the engine, read-only, so it can't drift
from what you'll get and never touches your selection or your undo history.

| #   | Change | Status |
| --- | -------- | -------- |
| 1   | Hover "possible future region" preview — green (Shift/add) / red (Alt/subtract) filled zone of what a click would select, live under the cursor | Complete — Wand / Edge / Color Range |
| 2   | New engine `selection_preview` (read-only, non-committing) on a shared `selection_mask_for` core the committing producers now share — preview and click can't diverge | Complete — 6 engine tests |
| 3   | Recompute throttled to one flood per frame, gated on a held modifier, skipped when the cursor hasn't crossed into a new pixel | Complete |
| 4   | Enforcement: the trail-log commit squares (`marketing/src/data/commits.ts`) are now a required, gated part of the release routine so they can't go stale | Complete — tooling |

**Verified**: `cargo fmt --check` clean, clippy `-D warnings` clean, engine
tests pass (incl. 6 preview); `tsc --noEmit` clean, eslint 0 errors / 61
warnings, 198/198 vitest, app + marketing production builds succeed. Shipped
WASM 745,691 B (+1,857 over v7.44 — the preview export and its shared mask
core).

## v7.46 — 2026-07-24

**The Magic Eraser launches — and so, it turns out, does the engine.** Brush
over an unwanted object with the Eraser tool's Magic mode (or select it and
hit Remove Object in the Select panel) and it's erased and rebuilt from the
surrounding image, entirely on your device. Single-resolution kernel, so big
holes come out soft — the honest state of it — but full-coverage strokes on a
real object work, and undo brings everything back. Coverage is the whole
game: brush all of the object, not an X through it.

The launch surfaced a production bug worth recording plainly: Netlify's build
command ran `wasm-pack build` with no feature flags, overwriting the
committed engine with a featureless one. Production has been serving a wasm
without the tiles/op-log machinery since v7.36 — every "shipped ON" op-log
flag was silently disabled in prod by the runtime feature-detects (which is
also why nothing ever crashed). Fixed: the deploy now builds
`--features tiles,patchmatch`, so the op-log actually reaches users for the
first time, alongside the eraser.

| #   | Change | Status |
| --- | -------- | -------- |
| 1   | Magic Eraser brush (Eraser → Magic): brush-to-mask, size ring, Ctrl+[/] sizing, one-per-frame overlay, remove-on-release | Complete — merged from the eraser line, caught up to v7.45 first |
| 2   | Remove Object in the Select panel — same engine call, selection-driven | Complete |
| 3   | `ih_patchmatch` flips from opt-in to a `"0"` kill switch; panel copy de-caveated; wasm-export feature-detect stays as the skew guard | Complete |
| 4   | Netlify deploy bug: featureless `wasm-pack build` overwrote the committed pkg — prod never had tiles/op-log. Build now passes `tiles,patchmatch` (netlify.toml + `build:wasm`) | Fixed — prod wasm goes 679,875 → ~753,713 B |
| 5   | `remove_object` hardened in the merge: guard-without-mutating + snap-before-take (undo restores the mask) + warm-a-cold-cache-and-continue | Complete — pinned by both test suites |

**Verified**: fmt/clippy `-D warnings` clean on `tiles,patchmatch` combined,
cargo tests green on tiles, patchmatch, and combined; tsc clean, eslint 0
errors / 61 warnings, 201/201 vitest; app + marketing production builds
succeed. Shipped WASM 753,713 B (+7,995 over v7.45 — the PatchMatch kernel,
in the binary users download for the first time).

## v7.47 — 2026-07-25

The Select tool's six modes become one mutually-exclusive list. Rectangle and
Ellipse used to be a separate "drag shape" setting living beside the four click
modes, both live at once: a drag swept a marquee whatever mode was lit, and the
panel drew the two axes as unrelated groups under a header carrying the *click*
mode's name. It read as though Rectangle were a sub-option of the Wand. Now the
mode picks the gesture as well as the algorithm — click for wand, edge-aware
and color range, a click session for the magnetic lasso, drag for Rectangle and
Ellipse. Clicks are inert in the two drag modes, and drags are inert everywhere
else.

This reverses ADR-021, which rejected exactly this arrangement to avoid a mode
switch before the commonest gesture. The switch is a real cost and it is being
paid on purpose: a panel nobody can read is worse than a click.

| #   | Change | Status |
| --- | -------- | -------- |
| 1   | `SelectionKind` absorbs `rect`/`ellipse` — one exclusive union of six; `selectionShape` state and setter deleted (transient, never persisted, so no migration) | Complete |
| 2   | `isMarqueeKind()` is the single predicate — gates the marquee, the click bail-out, and whether Tolerance is shown | Complete |
| 3   | Per-mode routes: `#/tool/select/rect` and `/ellipse` join the four that existed. No routing change needed — `modesFor("select")` already derived panel, palette and routes from one list | Complete |
| 4   | Rect → Rectangle, Magnetic → Magnetic Lasso (new icon); mode grid goes 2-up → 3-up to match the Selection grid beneath it | Complete |
| 5   | Select is keyless — `S` removed from `TOOL_BY_KEY`; `shortcutKey` is now optional on `ToolDefinition`, and neither the sidebar tooltip nor the status bar advertises a key that does nothing | Complete — a digit arrives with the next UI pass |
| 6   | `selectModes.test.ts` pins mode ids, order and `isMarqueeKind` agreement | New — the drift guard the two-list arrangement lacked |

**Verified**: tsc clean, eslint 0 errors / 61 warnings, 205/205 vitest, app
production build succeeds. Smoked on the production build with all six routes
resolving: Rectangle and Ellipse drags commit a selection and their clicks are
inert; wand clicks still select. Engine unchanged at 753,713 B — this release
is entirely app-side.

**Also recorded**: imagehorse-qc for v7.44–7.46 completed (sections 1–5 pass;
Export confirmed by hand). Three findings parked, of which one — `ShortcutModal`
listing ten tools and omitting Select — is resolved by Select going keyless.

## v7.48 — 2026-07-25

A repair-only pass: no features, nothing user-visible changes. Two of the four
items turned out to be different problems than the brief described, and both are
recorded here rather than quietly "fixed".

| #   | Change | Status |
| --- | -------- | -------- |
| 1   | Six `oplog.as_ref()/.as_mut().unwrap()` in `oplog_sync_annotations`, `oplog_sync_canvas`, `try_oplog_undo`, `try_oplog_redo` → guarded re-acquisition falling back to snapshot undo | Complete — **but they were never live crashes**: all six already sat behind a `None` guard in the same function. A borrow-checker artifact (the guard's borrow dies at the intervening `&mut self` calls), fixed as defence in depth |
| 2   | Deploy sentinel — `scripts/deploy-sentinel.sh` + CI job fetching the LIVE site's glue and wasm; fails on a size outside 700–800 KB or a missing `oplog_` / `remove_object` / `rect_select` | New — the manual check that caught the five-week featureless-prod bug, automated. Kept a script so it stays runnable by hand |
| 3a  | `ih_selection_bool` kill switch verified intact after the v7.47 six-mode rework; pinned by `selectionBool.test.ts` (6 tests) | Complete — every `set_selection_combine` write is fed by `selectionCombineMode`, which reads the flag itself |
| 3b  | `importOra` made module-private instead of deleted | **Brief was wrong**: it is called twice inside `importOraAsNewPhoto`, which is live in `ExportPane.tsx`. Deleting it breaks `.ora` import, and the parser stays reachable regardless, so deletion shed zero attack surface |
| 4   | `pnpm lint` + vitest now blocking in CI; guardrails converted from `continue-on-error` to a baseline ratchet (`scripts/guardrails.sh`) | Complete — only 1 of 6 checks is at zero (112 violations across the rest), so the build now fails when a count goes **up**. New violations blocked from today; existing ones payable-down only |

**Reverted before merge:** an item-3(c) unexport of the four `useToolStore` mode
constants. Correct against master as it stood, wrong against the in-flight
toolbar work, which adds `TEXT_MODES`/`BATCH_MODES` as exported constants in the
same block for `toolModes.ts` to consume.

**Verified**: fmt clean; clippy `-D warnings` and cargo test green on tiles,
patchmatch and combined; tsc clean; eslint 0 errors / 61 warnings; 211/211
vitest (6 new); production build succeeds. Deploy sentinel and the guardrails
ratchet were each tested in BOTH directions — passing at baseline and failing
when they should. Engine **753,713 → 753,582 B (−131)**: the panic machinery the
six unwraps were emitting.

## v7.49 — 2026-07-25

The clonestamp-split: `useCloneStamp.ts` (1,467 LOC, ~62 returned callbacks,
17 importers, fallow's #3 refactoring target) decomposed into domain hooks.
Behavior-preserving — no logic changes, no features, one domain per commit
with all gates green between commits.

| #   | Change | Status |
| --- | -------- | -------- |
| 1   | `useEngineCore` — engine lifecycle, refs, state mirror, zero-copy flush, all four load/restore paths, brush params. `loadFromSaved` moved VERBATIM (111 cyclomatic — its own session) | Complete |
| 2   | `useHistory` — undo/redo/jump/delete/clear + the Ctrl+Z binding | Complete |
| 3   | `useLayers` — full stack surface incl. non-destructive masks | Complete |
| 4   | `useExport` — png/lossy exports + Rust-scaled thumbnails | Complete |
| 5   | `useTransforms` — geometry, adjustments, cross-photo copy/paste | Complete |
| 6   | `useCloneStamp` becomes a 229-line facade: composes the five, returns the identical 62-key surface — **zero importer churn** | Complete |

**Proofs, not vibes**: fallow — useCloneStamp off the target list entirely
(was #3), useEngineCore not in the top 10 (the debt is quarantined in
loadFromSaved); dupes unchanged at 60 (verbatim moves relocate clones, they
don't dissolve them). Artifact smoke from a fresh profile against the
production build: 12-sample load, paint, undo/redo **byte-exact both
directions** (checksums 1550871 ⇄ 1549238 ⇄ 1550203), layer add + visibility
toggle exact, Flip-H involution exact, export produced a real 383,297-byte
JPG on disk, reload + Resume restored **checksum-identical** pixels. Zero
console errors. Gates on every commit: tsc, eslint 0 errors (61→59
warnings), 211/211 vitest, build:all.

**Deferred** (PARKING_LOT): step 2 — the zustand engine store + CanvasArea
memoization with a render-count proof. Bigger than all five extractions
combined and touches the files the toolbar arc is reshaping.

## v7.50 — 2026-07-26

| #   | Change | Status |
| --- | -------- | -------- |
| 1   | **Paid accounts were gated to the free tier.** `AuthModeWatcher` called `useStoreUser()` — creating the very Convex row the tier lives in — then reported `loggedIn` for every signed-in user. `useRealTier` existed, was documented as the fix, and was never called (found by the fallow dead-export pass). | **FIXED** — new `userModeForTier()` maps Convex `free\|pro\|team` → UI `demo\|loggedIn\|paid`; wired into the watcher and reactive, so a grant/upgrade flips live |
| 2   | What a `$10/mo` subscriber was actually getting: gallery 24 (not 100), storage 100 MB (not 5 GB), 3 layers (not unlimited), and **Replicate AI off** — the paid headline. Server-side enforcement was always correct; only the client lied. | Quantified from `lib/tiers.ts` |
| 3   | `tiers.test.ts` — 7 tests pinning the mapping, the fail-closed `null`/unknown cases, and that only `paid` unlocks AI | New — the bug shipped because nothing tested the seam between two vocabularies |
| 4   | **CI was red for 12 hours and it was our own step order.** v7.48 added `pnpm -C app test` *before* `pnpm run build:all`; the suite transitively imports `lib/photoLimits.ts`, which does `await import("stamp_tool")` — a package that only exists once `build:wasm` has produced `pkg/`. | Fixed — test step moved after `build:all`. Reproduced locally by moving `pkg/` aside, then verified from that same clean state |
| 5   | Toolbar: sub-tools hoisted out of the settings panels into a `SubtoolRow` under the tool rail, same tile shape/size, `grid-cols-4` on both so the header steps in whole tiles | Complete |
| 6   | All eleven tools keyed in grid reading order — `1`–`9`, `0`, then `-` (Minus). Select gets `3`, the digit promised when `S` was dropped in v7.47. `TEXT_MODES`/`BATCH_MODES` lifted out of component state into `useToolStore` so the palette, routing and the new row share one definition | Complete |
| 7   | Guardrail ratchet: raw-colors baseline lowered 27 → 26 (the toolbar work removed one) | Locked in |

**Verified**: tsc clean; eslint 0 errors / 59 warnings; **224/224 vitest** (17
files, 7 new); `build:all` succeeds; guardrails ratchet passes with no count
above baseline. The CI fix was verified the honest way — `pkg/` moved aside to
reproduce the red, then `build:all` → `test` from that same state: 217 → 224
passing.

## v7.51 Change Summary — 2026-07-26

| #   | Change | Status |
| --- | -------- | -------- |
| 1   | **Toolbar restructured: 11 tools → 5 groups** (Enhance / Select / Create / Edit / Batch) owning **33 sub-tools**. New `features/tools/toolGroups.ts` is the single definition site; the rail, sub-tool row, shortcuts and dispatch all derive from it | Complete |
| 2   | **No legacy tool id renamed.** `compress`, `crop`, `arrow`, `ai`, `stamp`, `emoji` stay exactly what persistence and the inbound route aliases expect — a sub-tool is a *view* onto an existing `(ToolType, mode)` pair | Held |
| 3   | Sub-tool identity is a store field (`activeSubTool`), not derived. 27 of 33 are unique by `(tool, mode)`; the six Edit ones are not — Crop/Transform/Color Picker are all `crop`, Resize Layer/Canvas Size/Guides all `arrow` — so derivation lit three tiles at once | Complete |
| 4   | `activeSubTool` and `pickedColorHistory` are **deliberately outside `partialize`** — no IndexedDB schema change, so the `dexie-migration` gate is not tripped. Both re-derive or reset on reload | By design |
| 5   | **Canvas dispatch switches on sub-tool.** `useEffectiveTool`'s unmatched-tool fallthrough returned the raw clone-stamp handlers — the near-miss where a marquee drag almost clone-stamped. Default is now `idle`, every group has an explicit case, every Create/Edit sub-tool is named | **FIXED** |
| 6   | Cursor declared per sub-tool in the registry, on the same row as dispatch — a sub-tool with no gesture carries no cursor *and* idles, so the two can't drift. Select's Shift/Alt badge and Resize Layer's `move` stay dynamic | Complete |
| 7   | Edit panels split: `TransformCropSettings` and `LayerSettings` each gained a `section` prop. All six live Edit sub-tools render their own section alone | Complete |
| 8   | Colour-picker history — newest-first, case-insensitively de-duplicated, capped at 12. Built from `ReselectBar` in a `.history-list`, the same primitives as the Guides list, so the two can't drift apart visually | New |
| 9   | Digits `1`–`5` select groups. Hand-written `TOOL_BY_KEY` (11 entries) deleted for `GROUP_BY_KEY`, derived from the registry. `6`–`0`/`-` now inert — test-pinned, so muscle memory does nothing rather than something | Complete |
| 10  | `ShortcutModal` re-pointed at the group registry. Worth recording: it already derived from `toolConfig.ts` — the "fourth hand-maintained copy" that lost Select for three releases was fixed before this arc, not by it | Corrected |
| 11  | Registry edits from review: **Line removed** (`line` stays a shape kind in the Shapes panel), **OCR promoted** to a Create sub-tool, **Guides** kept live but re-iconed off `Ruler` (it read as a measurement tool that doesn't exist), **Perspective** Coming Soon | Complete |
| 12  | Coming Soon is a discriminated-union member carrying no `tool`, so it is unreachable by route and palette **by type** rather than by a runtime check somebody can forget | Complete |
| 13  | Text panel: background/bubble/shadow controls now render in the Text mode too, directly after the colour swatch | Complete |
| 14  | Sub-tile border width matched to the rail (`border-2`); hover ring no longer clipped by the height-animating wrapper's `overflow-hidden`; toolbar icons 50% → 55%, scoped to the tile components rather than the global `h-1/2` utilities | Complete |
| 15  | All 33 sub-tools gained a tooltip description — Create is 13 tiles and was a wall of icons | Complete |

**Verified** against the served production build (bundle hash checked against
the build output, not just HTTP 200), fresh profile, zero console errors: all
five groups render; every one of the 33 sub-tools activates, lights its own
tile and its group's, and shows the right panel; Perspective renders disabled
and is not clickable; per-sub-tool cursors confirmed (Brush → crosshair, Text →
text, Compress → default, where the whole Paint tool previously shared one);
Edit's six sections each render alone; three real eyedropper clicks produced
`#2D2319` / `#565547` / `#A1B1C0` in the history, newest first.

Gates on every commit: `tsc --noEmit` clean, eslint **0 errors / 59 warnings**,
**225/225 vitest** (17 files), production build succeeds.

**Deferred**: routes are still the old `#/tool/<tool>/<mode>` grammar — the new
`#/tool/<group>/<subtool>` form and its legacy redirects are not built yet, so
the three Edit sub-tools sharing `crop` still share one URL. The registry ↔
routes ↔ palette ↔ dispatch contract test is likewise unwritten. Both are the
next session's work, and both are logged in `docs/toolbar-migration-map.md`
alongside the ORPHAN/AMBIGUOUS list.

## v7.52 Change Summary — 2026-07-26

| #   | Change | Status |
| --- | -------- | -------- |
| 1   | **Route grammar is now `#/<group>/<subtool>`** — `#/create/brush`, `#/edit/color-picker`. The old `#/tool/<tool>/<mode>` described the pre-v7.51 structure, so the three Edit sub-tools sharing the `crop` id collapsed onto ONE url and a link couldn't say which it meant | Complete |
| 2   | **35 legacy URL shapes redirected**, one assertion each — tool slugs (`#/tool/paint/blur`), raw `ToolType` ids (`#/tool/brush/blur`), the v7.44 Adjust-&-Select link, singular mode aliases, the `?tool=`/`?mode=` query form, and `#/tool/<group>/<sub>` for anyone who guesses it | Complete |
| 3   | **Ambiguity fixed while writing the redirect table**: `select` is BOTH a group id and a legacy tool slug, so `#/tool/select/edge` was resolving as a group, failing to match `edge` as a sub-tool *id*, and silently dropping onto the group default (Magic Wand) — the wrong selection mode with nothing to say so. Under the `tool/` prefix the legacy reading now wins | **FIXED** |
| 4   | Coming Soon sub-tools are unreachable by URL: a route naming one collapses to the group default. They carry no `tool`, so `applyRoute` would have nothing to activate | Complete |
| 5   | `applyRoute` now goes through `activateSubTool` — the same call the rail and the palette make — so a link and a click leave the app in identical state, including preselects (the Color Picker toggle arms and disarms) | Complete |
| 6   | **Command palette rebuilt on the group registry.** It emitted "Paint › Paint": the old loop walked `TOOLS` + the sub-mode table, so it spoke legacy tool names and doubled the label whenever a tool's first mode shared its name. Now one entry per group + one per live sub-tool, labelled "Create › Brush" | **FIXED** |
| 7   | Palette Batch gating matches the rail and the router (2+ photos), pinned in all three places | Complete |
| 8   | **Ruler** added to Edit beside Guides as a disabled placeholder, like Perspective — slot held, measuring unbuilt. 34 sub-tools, 32 live | New |
| 9   | Three test suites rewritten against the new contract: `routes.test.ts` (74 tests incl. the redirect table), `commands.test.ts`, `routeState.test.ts` — round-trip identity is asserted over **every live sub-tool**, not a sample | Complete |

**Verified** against the served production build (bundle hash checked), fresh
profile: every group and sub-tool writes its own URL — `#/create/brush`,
`#/create/clone-stamp`, `#/edit/transform`, `#/edit/color-picker`,
`#/enhance/adjustments`, `#/select/ellipse`, `#/batch/rename`. Palette shows
`Enhance › Compress` … `Create › Brush`, 37 tool rows (5 groups + 32 live
sub-tools), and **zero** doubled `X › X` labels. Ruler and Perspective render
disabled. The only console errors are Clerk's third-party telemetry endpoint
failing CORS — not app code.

Gates: `tsc --noEmit` clean, eslint **0 errors / 59 warnings**, **233/233
vitest** (17 files, +8), production build succeeds.

**Deferred**: ADR-023, and the approved `Ctrl+K`-then-letter chord for
sub-tools (letter scoped to the active group).

## v7.53 Change Summary — 2026-07-26

| #   | Change | Status |
| --- | -------- | -------- |
| 1   | **Object Removal was unreachable.** `AISettings` used to pick between its four modes with its own tile row; that row moved into the sub-tool header in the new-ui-toolbar arc, and the five-group restructure then filled that header with the GROUP's sub-tools. Enhance › AI pins `eraserMode` to `rembg`, Create owns `brush`/`magic`, and nothing was left that could set `inpaint` | **FIXED** — both Replicate actions render together under one "AI" header; they were never exclusive, they are two buttons |
| 2   | Correction to my own migration map: it claimed "AISettings' own toggle reaches inpaint" (AMBIGUOUS-3). It doesn't — that picker had already been removed before this arc began | Recorded |
| 3   | Marketing `<title>` now leads with the hero line instead of "local-first image editing in the browser" | Complete |
| 4   | **⌘K indexes all 45 features**, each deep-linked to its own `/features#<slug>` anchor. DERIVED from `features.ts` — the same generated data the page renders — so the palette and the page cannot disagree. The full body text stays searchable while only the first clause is shown | New |
| 5   | `featureSlug` moved into `featureIcons.ts` (hand-written) and shared by the page and the palette. It was inline in `Features.tsx`; a second copy in the palette would have been how a deep link silently rots. NOT in `features.ts` — that file is regenerated and would wipe it | Complete |
| 6   | **8 stale feature entries corrected.** They still described the eleven-tool layout: "Effects → Color Picker tab", "the Arrows sub-tab inside the Shapes tool", "tab-switched with Blur Brush and Pen", "the Stamp tool's Emojis tab", "Text → Background → Drop Shadow". None of those places exist now | Complete |
| 7   | **5 new feature entries**: the five-group toolbar, sub-tool routing, sub-tool canvas dispatch, colour-picker history, OCR. Features 40 → 45 (UI 15 → 20) | Complete |
| 8   | Top bar icon buttons (Undo / Redo / both Zooms / Settings / signed-out user) take the tool-rail vocabulary — border for state, hover ring, icon at 55% — at 36px so the glyph matches the rail's within a pixel. `standalone` variant carries its own fill for the two that sit outside a group pill | Complete |
| 9   | Every `ToggleButtonGroup` button gets the hover ring and one 18px glyph, labelled or not. The top bar's four and the Review panel's four were already the same component; they now look it. Reaches the settings panes too, deliberately | Complete |

**Verified**: marketing and app both build; the served marketing bundle carries
the new title, the feature entries and the `/features#` deep links. App gates:
`tsc --noEmit` clean, eslint **0 errors / 59 warnings**, **233/233 vitest**.

**NOT done — the nav underline.** Chris reports the menu's hover/current-page
rule is off kilter. The `.nav-pill__glide` span is the only underline in the nav
(there is no `::after` rule fighting it) and the geometry reads correctly on
paper — `offsetLeft`/`offsetWidth` against a `position: relative` list with no
border or padding to offset them. Diagnosing it needs a measurement I couldn't
take this session, and guessing at a CSS fix for something the reporter can see
and I can't is how you ship a second bug. Carried to the next session.

**Deferred**: ADR-023, and the approved `Ctrl+K`-then-letter chord for sub-tools.

## v7.54 Change Summary — 2026-07-27

| #   | Change | Status |
| --- | -------- | -------- |
| 1   | **Hero headline rewritten.** It led with "That's `Rust`, compiled to `WASM`" — the implementation, sold to an audience that doesn't know the words. Now "Crop it, compress it, annotate it, gallop. **Free** in your browser. **No account**." Both highlighter bands moved with it | Complete |
| 2   | The local-machine claim deliberately did NOT go in the headline. "Runs on your machine" is a precision statement, not a selling one: a reader who has never met local-first doesn't know the alternative is uploading, so it reads as a shrug. It stays below, beside the operations table that proves it row by row | Recorded |
| 3   | Every word of the new headline is copy the site already shipped — Demo tier is `$0 / forever` with `No signup` (Pricing), and the closing CTA already said "No account, no upload" | Complete |
| 4   | **Top-of-page spacing unified across all five pages.** `.hero` cleared the fixed nav by 56px, `.page-head` by 66px, and `.stat-hero` — a third header surface only Pricing uses — by 18px. All three now share `calc(var(--banner-height) + var(--space-2xl))`, so they clear by 80px and cannot drift apart | Complete |
| 5   | **The mobile spacing rule rested on a false premise.** Its comment said "nav is shorter on a phone, so less top clearance is needed". Measured: the pill is **62px tall at 390px wide, identical to 1440px** — it drops its wordmark and source icons but keeps its height. Headings sat 18px under the bar; now 40px | **FIXED** |
| 6   | **The wordmark is back in the phone pill.** It had been moved to the sheet because at 20px it made the mark 170px and shoved the burger to x=374 — off a 375px screen, so the menu could not be opened at all. At 16px, with a shorter CTA, the burger sits inside the pill with 9px of slack at 375px | Complete |
| 7   | The nav CTA is **"Demo"** at every width, not "Open the demo". The short label was what paid for the wordmark on a phone, but it is not a mobile compromise — the button sits next to a horse and the words "Image Horse" on a page whose whole job is the demo. The long form stays on the hero CTA, the Pricing CTA and the ⌘K palette entry | Complete |
| 8   | The scroll-morph no longer collapses the wordmark on a phone. Condensing exists to buy width for the link row, and the link row is already hidden there — on mobile the collapse cost the brand and bought nothing | Complete |
| 9   | **The nav underline was measured in whole pixels.** `offsetLeft`/`offsetWidth` round to integers; the links sit on fractions (Pricing 41.25px wide, Trail Log 49.84px, Features at x=139.89). The glide landed up to 0.25px off — by a different amount and in a different direction on each link, which is what the eye reads as crooked. Home hid it entirely, being at offsetLeft 0. Now measured with `getBoundingClientRect()` against the list's own rect: **0.000px on both edges in every state** | **FIXED** |
| 10  | Ruled out by measurement rather than by reading: no competing underline exists. Every link's `text-decoration`, `border-bottom`, `box-shadow`, `::before` and `::after` are empty — `.nav-pill__glide` is the only rule in the nav. Zoom is not a factor either (error held at ~0.2px from 100% to 150%) | Recorded |
| 11  | Rect maths is safe here because `.nav-pill`'s only transform is a **translate**, not a scale, and the `<ul>` carries no padding or border — so `rect.left - listRect.left` is exactly what `offsetLeft` meant | Recorded |
| 12  | **The Ctrl+`\` celebration was a month out of date** — counting July at the 22nd through v0.9.85: 42 releases, 109 entries, 400 all-time, 27%. Re-derived from `releases.ts` as its own comment instructs: **54 releases, 159 entries, 450 all-time, 35%**, and 31 features / 49 fixes | **FIXED** |
| 13  | Its feature chips missed the entire five-group toolbar arc. Refreshed newest-first, and kept app-facing only — the site's ⌘K feature search is the obvious trap, since the editor's own palette is `Alt+,` and a chip pointing at ⌘K would name something the user cannot find | Complete |
| 14  | **Ctrl+`\` added to the shortcut modal.** It was bound in `useKeyboardShortcuts` and listed nowhere — a key combination nothing in the app admitted existed | Complete |

| 15  | **The contribution squares are generated after the release commit, not before it.** `gen-trail-data.mjs` reads `git log`, so running it during doc-prep always leaves the shipping day blank — normally invisible, but 2026-07-27 was a Monday opening a fresh week column (`Trail.tsx` starts each column on the Sunday on or before), so the whole column read as a dead week. Regenerated post-commit: 277 commits, 52 active days, through 2026-07-27 | **FIXED** |
| 16  | Consequence worth knowing: the celebration counts are derived from `releases.ts`, so any entry added at release time shifts them. July closed at **160 entries / 451 all-time** once this row's own trail entry landed | Recorded |

**Verified**: marketing `tsc -b` clean and build succeeds; app `tsc --noEmit`
clean, eslint **0 errors / 59 warnings**, production build succeeds. Nav glide
measured at 0.000px on both edges at rest, on hover of all five links, and
condensed; page clearances measured at 80px desktop across all five pages and
40px at 390px; the 375px pill measured with the burger inside it.

**Parked**: `Ctrl/Cmd + M` (Move-layer) is bound at `useKeyboardShortcuts.ts:246`
and also missing from the shortcut modal. Left out deliberately — worth auditing
every `Ctrl`-chord at once rather than hand-adding rows one at a time.

**Deferred**: ADR-023, and the approved `Ctrl+K`-then-letter chord for sub-tools.

## v7.55 Change Summary — 2026-07-27

| #   | Change | Status |
| --- | -------- | -------- |
| 1   | **A pen path deselected the moment you clicked the panel.** `PenOverlay`'s "click off the canvas → finish" listener works on raw coordinates, so every click on the tool panel counted as off-canvas — including the colour swatch you opened the panel to reach. The path was finished and deselected before the picker rendered, which is what made the Reselect list feel mandatory for something as ordinary as recolouring a path | **FIXED** — panels marked `data-pen-keep-selection` operate ON the selection and no longer end it; the workspace around the canvas still does |
| 2   | **A finished path now stays selected.** `add_bezier_annotation` already returned the new id — nothing was reading it, so a committed path went straight back to nothing selected. The overlay keeps it, re-takes the engine's editing lock, and the panel's Stroke and Background then restyle the path you just drew | New |
| 3   | Live preview needed no new plumbing: the overlay already drew with the panel's current `color`/`fillColor`, so a selected path recolours as you click swatches and bakes on finish | Recorded |
| 4   | **Escape used to CANCEL whenever a path was selected** — correct when the only way to be selected was deliberately re-opening a committed path, but with (2) it threw away every restyle: pick a colour, press Escape, and the path snapped back to the colour it was drawn in. Escape now commits and deselects; `Ctrl+Z` is how you take back a reshape | **FIXED** (introduced by (2), caught in browser before it shipped) |
| 5   | The close gesture that actually fires lives in `startDrag`, not `onCanvasDown`: the 8×8 first-anchor handle sits on top of the capture rect and stops propagation. Adding keep-selection to the `onCanvasDown` twin alone did nothing — clicking the first anchor still deselected | **FIXED** |
| 6   | **Leaving the pen could have made a path vanish.** Because a finished path now holds `editing_shape_id`, unmounting the overlay would hide the baked path with nothing left drawing it. A teardown handler commits what's in flight (or releases the lock). Deliberately not `finish` — its `setState` calls have nothing to update during teardown | Complete |
| 7   | **You could not tell whether the ends were joined.** An open path finishing near its start looked identical to a closed loop, and nothing hinted that clicking the first anchor would connect them. The first point now carries a ring: dashed (open), solid blue + filled (a click here joins them, or they already are). Static by choice — an animated dash would be one more moving thing over the photo and would need a reduced-motion escape | New |
| 8   | The ring's radius **is** the click radius (`CLOSE_RADIUS`), shared by the hit test and the render. A ring promising a close the click doesn't perform is worse than no ring | Recorded |
| 9   | The proximity listener sits on the SVG root, not the capture rect. On the rect the pointer went quiet at exactly the moment that matters — hovering the first anchor — because the anchor handles take `pointerEvents: all` and are siblings, not children, of the rect | **FIXED** |

**Verified in-browser** (not inferred): draw → path stays selected → stroke
`#ef4444` → `#22c55e` live → Background Solid fills → Esc bakes both onto the
committed annotation → Ctrl+Z reverts the restyle, again removes the path.
Switching tools mid-draw commits rather than losing it. All three ring states
confirmed distinct, with the closed case checked by the path's `Z` terminator
rather than by eye. Gates: `tsc --noEmit` clean, **233/233 vitest** across 17
files, eslint **0 errors / 59 warnings**.

**Checked, not changed — the status bar rotates correctly but mislabels
sub-tools.** Slots 1–2 are tool-specific, slot 3 cycles the generic pool every
3 minutes, `Alt+/` is pinned last on all ten routes sampled. The digit is right
(it selects the GROUP) but the label names one sub-tool and keeps saying it for
the rest: Resize and Adjustments both read "1 compress", Pen reads "3 brush",
Crop reads "2 adjust". Select shows no tool hint at all — it is still keyless
since `S` was removed. Parked, not fixed: the label should derive from
`activeSubTool` rather than the group.

**QC owed.** This release touched canvas and tool code (`PenOverlay`,
`ToolsSidebar`, `AppShell`), so `imagehorse-qc` is required before the next
release per the project's definition of done — and it was already outstanding.

**Deferred**: ADR-023, and the approved `Ctrl+K`-then-letter chord for sub-tools.

## v7.56 Change Summary — 2026-07-27

| #   | Change | Status |
| --- | -------- | -------- |
| 1   | **Share links told signed-in users to sign in.** The live site signs in with Clerk `amazed-akita-72`; `convex/auth.config.ts` trusted only `grateful-dingo-89`. Clerk minted a valid `convex` token, Convex rejected the issuer, and `useConvexAuth().isAuthenticated` never flipped — while Clerk's own `isSignedIn` stayed true, so nothing looked broken | **FIXED** (stopgap) — both instances are now trusted; a provider entry only declares an acceptable issuer, so adding one cannot invalidate working sessions |
| 2   | Measured, not inferred: `window.Clerk.frontendApi` is `grateful-dingo-89` on localhost and `amazed-akita-72` on the live site; the deployed bundle points at `brave-ant-608.convex.cloud` — the **development** Convex deployment; `convex status` shows production `pastel-alligator-180` is not used by the deployed app at all. The prod console warns "Clerk has been loaded with development keys" of its own accord | Recorded |
| 3   | Locally, signed in, the whole chain is healthy: `getToken({ template: "convex" })` issues a token with `iss: grateful-dingo-89` / `aud: convex` matching the config, and clicking Share produced a real link. **Share links were never broken in development** — only against the live environment | Recorded |
| 4   | **The button was guessing.** "Sign in to create share links" was shown for three distinct states, one of which was a signed-in user. `useShare` now reports `connecting` / `signed-out` / `backend-rejected` and `ShareButton` says which | **FIXED** |
| 5   | The Clerk check reads the global rather than `useAuth()` on purpose: `ShareButton` renders in demo mode, where `ConvexClerkProvider` mounts no `ClerkProvider` and Clerk's hooks throw. Demo mode is a project invariant | Recorded |
| 6   | `useRecentTexts:23` had already documented this exact failure mode — "Clerk's `isSignedIn` stays true even when the Convex auth provider rejects the token (e.g. dev keys vs prod deployment)". The comment was right and nothing acted on it | Recorded |

**Not just share links.** Every `useConvexAuth()` consumer fails the same silent
way for a signed-in user on the live site: `useEditPersistence` (cloud
persistence), `lib/preferences` (sync), `useRecentTexts`, and `useStoreUser` —
which is where the **tier** is read from. That is the same shape as the v7.50
paid-tier bug. **OPEN-1**: whether paid accounts are being served free-tier caps
in production is unverified and needs a paid account on the live site.

**OPEN-2 — not decided here.** The live site runs on a development Convex
deployment and development Clerk keys while a production Convex deployment sits
unused. Trusting both issuers stops the bleeding; it does not make that right.
Options A (point the live site at production), B (consolidate on one dev
instance), C (what shipped) are written up with tradeoffs in
`docs/internal/share-links-auth-mismatch.md`. A is the real fix.

**Not live until deployed.** The auth config only takes effect once `npx convex
deploy` pushes it to `brave-ant-608`. Deliberately not run here — it changes
auth behaviour for the backend production depends on, which is a morning
decision, not a 2am one.

**Gates**: app `tsc --noEmit` clean, eslint **0 errors / 59 warnings**,
**233/233 vitest** across 17 files; marketing `tsc -b` clean + build.

## v7.57 Change Summary — 2026-07-27

| #   | Change | Status |
| --- | -------- | -------- |
| 1   | **The gallery could wedge permanently.** Reported as "I wasn't able to change photos till I deleted the shared photo". `savePhotoEdit`'s cloud branch had three unbounded awaits — `generateUploadUrl()`, the archive `fetch`, and `saveEdit()`. `useImageSession` awaits the whole call before switching photos, so one hung Convex mutation stopped photo switching for good | **FIXED** — each cloud round-trip bounded at 8s (`withTimeout`), which fixes all three `savePhotoEdit` callers, not just the gallery |
| 2   | The file's own comment already named the hazard: *"the cloud path can HANG — `generateUploadUrl()` is a Convex mutation that neither resolves nor rejects if the deployment is unreachable — and a hang never reaches a catch."* The **data-loss** half had been fixed (local IndexedDB write first); the **hang** half was still live, sitting inside a `try` a hang can never reach | Recorded |
| 3   | **v7.56 is what exposed it.** The cloud branch is gated on `isAuthenticated`, which was false in production for as long as the Clerk issuer mismatch existed — so it had never run there. Fixing share links made signed-in production users execute it for the first time, straight into a latent hang | Recorded |
| 4   | Racing does not cancel the request, it frees the caller — and the local IndexedDB copy is already on disk before any of it runs, so a timeout costs freshness and nothing else. Failures still land in the Diagnostics Window rather than vanishing | Recorded |
| 5   | Verified against a deliberately wedged deployment (Convex HTTP routed to never respond): the gallery recovers at ~10s instead of never. Two 8s ceilings plus the local write, bounded either way | Verified |
| 6   | **Single editing tab, Messages-style.** Every tab shares one set of IndexedDB databases and one engine document per photo, so two open at once silently overwrite each other with no warning. `useTabClaim` (BroadcastChannel) claims the session; other tabs park behind `MultiTabScreen` until "Use here". Last claim wins, and a newly-opened tab takes the session — handing control to the window the user isn't looking at would be the wrong default | New |
| 7   | Reuses `IdleScreen`'s exact shape — chrome-less `Dialog`, card body, `--z-idle` — because both screens mean the same thing to the user (this tab is parked, press the button to resume) and shouldn't look like two features. Not dismissable: Esc and click-outside do nothing, so a parked tab cannot be edited into conflict | Complete |
| 8   | BroadcastChannel deliberately, not a window CustomEvent (forbidden here) and not a store — neither crosses a tab boundary. Guarded with a `typeof` check so a browser without it gets no detection rather than a failed boot, and the tab id is minted once per tab so React StrictMode's double-mount can't make a tab park itself | Recorded |
| 9   | **Clicking a photo now acknowledges the click.** `useImageSession` set its loading flag *after* two awaits, despite its own comment saying "flag loading synchronously, before any await" — so the indicator landed after the slow part it existed to cover. Moved above the save, and seeded `loadProgress` because the bar's width IS `loadProgress`: raising the flag alone renders a zero-width bar, present in the DOM and invisible on screen | **FIXED** |

**Verified in-browser, not inferred**: one tab shows no dialog; opening a second
parks the first; "Use here" in the first parks the second. Gallery recovery
measured against a wedged Convex. Feedback measured from none-at-all to ~1.1s.

**Parked, not fixed** (`docs/PARKING_LOT.md`): Dexie registers no `blocked` /
`versionchange` handler, so the next schema bump can wedge a user with a stale
tab open — `db.open()` never settles and every IndexedDB call hangs, including
the local save this release deliberately does NOT time out (it is the only copy
of the user's work). Two tabs on the same version were verified not to wedge, so
it is latent until a version bump — which makes it work to land BEFORE the next
Dexie migration. It belongs to the `dexie-migration` skill, not to this fix.

**Still open**: "I don't see changes" after sharing was never reproduced and is
not addressed here — it is unclear whether the shared link's image lacks the
edits or the canvas stopped showing them.

**Gates**: app `tsc --noEmit` clean, eslint **0 errors / 59 warnings**,
**233/233 vitest** across 17 files; marketing `tsc -b` clean + build.

## v7.58 Change Summary — 2026-07-28

| #   | Change | Status |
| --- | -------- | -------- |
| 1   | **Two tiles claimed to be the current tool.** Click the Enhance tile, press `3`: Enhance goes `aria-pressed=false` — it is not the active group — yet keeps painting `solid 2px rgb(252,223,194) off:2px` because it matches `:focus-visible`, while Create paints the same colour as a `border-color`. Same hue, same width, one just outside the box and one on the edge | **FIXED** — focus is now `2px dashed var(--focus-ring)`, a neutral ink token (`#2a2622` light / `#eeeeee` dark) |
| 2   | Diagnosed before anything was styled, in a real browser against computed styles. `:hover` was ruled out by re-reading with the pointer parked on the canvas — the ring survived it. `:active` and `aria-pressed` were never involved | Verified |
| 3   | **"Switch to `focus-visible:`" was already done, and was not the fix.** A mouse click leaves DOM focus on the tile but measures `:focus-visible` **false**. Chrome re-evaluates that heuristic when keyboard input arrives, so the very shortcut that moves the active state to another tile is what lights a focus ring on the old one. Both tiles then legitimately match two different selectors that happened to look identical | Recorded |
| 4   | **The gallery was worse than the toolbar.** `.photo-thumb.selected` declared `outline: 2px solid var(--accent); outline-offset: 2px` — byte-identical to the global focus rule. A keyboard-focused thumbnail was indistinguishable from a multi-selected one, not merely confusable. Focus now wins the `outline` channel (source-ordered after `.selected`, equal specificity) and selection keeps a `border-color` so it survives being focused | **FIXED** |
| 5   | Found while verifying #4: `.photo-thumb:hover:not(.active)` and `.photo-thumb.active` each reset `border-color: transparent`. Both were no-ops against the base rule's transparent border — until selection started using that channel, at which point hover (0,3,0) outranked `.selected` (0,2,0) and erased the marker. Caught by measurement, not by reading | **FIXED** |
| 6   | The value chips (Opacity, Hardness, Brush Size presets) mark the selected value with `ring-2 ring-theme-ring` — the accent again, at a 1px-different offset from the focus ring. Same collision, third surface. Fixed by the same one-token change | **FIXED** |
| 7   | `components/ui/tool-button.tsx` carried its own `focus-visible:ring-2 ring-theme-ring`, which lost twice: `--ring` **is** the accent, so focus looked like its own active state, and a `ring-*` focus ring writes the same `box-shadow` as the shared `HOVER_RING`, so on a hovered button the two silently replaced each other. Removed — it now takes the global outline, on a channel nothing else uses | **FIXED** |
| 8   | Not an accessibility trade. The focus indicator went from 2.67:1 to **14.3:1** on light and 15.3:1 on dark, both measured against the sidebar. Dashed as well as neutral because the dark accent is a light cream (`#fcdfc2`) and the ink is near-white (`#eeeeee`) — the stroke pattern carries the distinction where the values sit close. `--accent`'s own 2.67:1 shortfall on light surfaces is a token-level issue and is **not** fixed here | Verified |
| 9   | Verified after the fix on all five surfaces — tool rail, sub-tool row, gallery thumbnails, value chips, toggle groups — in both themes, and across the four-state matrix (idle / selected / focused / selected-and-focused) | Verified |
| 10  | **The status bar's tool hint was a stale copy of the pre-restructure digit table.** `TOOL_SHORTCUT` in AppShell hand-maintained `1-9, 0` per legacy tool; the five-group restructure cut the digit axis to the groups and freed 6-0, and this copy never heard. Slot 1 now derives from `TOOL_GROUPS` — group digit + **sub-tool** label | **FIXED** |
| 11  | Measured across ten routes before the change: `#/enhance/adjustments` read "8 effects" (8 is unbound — pressed it, the route did not move), `#/create/shapes` "7 shapes" and `#/batch/logo` "0 batch" likewise dead | Verified |
| 12  | **Worse than dead on one route.** `#/edit/crop` read "2 adjust" — 2 is the **Select** group. Pressed 2 from Edit and landed on `#/select/magic-wand`. The hint that exists to tell you which key holds your tool was advertising the key that leaves it | **FIXED** |
| 13  | The parked note for this bug said "the digit is correct (it selects the group); only the label is wrong." That was too kind and is corrected here: **five of ten routes** named a digit that either did nothing or jumped to another group. Only `enhance/*` and `create/brush` had a right digit, and only by coincidence of the old numbering | Recorded |
| 14  | Select had no hint at all, on the theory that it is keyless. That stopped being true at the restructure — Select is group **2** and the digit works (that is how the `#/edit/crop` test above landed there). Deriving from the registry gave it back for free: `#/select/marquee` now reads "2 Magic Wand" | **FIXED** |
| 15  | Labels come through in the registry's Title Case rather than being lower-cased to match the surrounding hints, because they are tool names — lower-casing turns "OCR" into "ocr" | Recorded |
| 16  | Verified after: all eleven routes name the sub-tool actually in front of you, with the digit that reaches its group — `1 Resize`, `1 Adjustments`, `3 Pen`, `3 Text`, `4 Crop`, `4 Transform`, `2 Magic Wand`, `5 Logo` | Verified |
| 17  | **"Update to the latest version?" is a dialog now, not a toast.** Yes / No on the same `ui/dialog` primitive as the delete confirms, because both are the app asking permission for something that changes what is in front of you. Copy says what Yes does: reloads the tab, photos and edits stay put | **New** |
| 18  | `updateToast.ts` → `updatePrompt.ts` + `components/UpdatePrompt.tsx`, one-for-one. State is module-level with `subscribe` / `useSyncExternalStore`, deliberately **not** a store and **not** a window CustomEvent (forbidden here) — the two triggers are plain modules running outside React, and the PWA surface stays inside `lib/pwa` exactly as the toast did | Complete |
| 19  | Both existing triggers keep working untouched: a WAITING service worker (Yes posts `SKIP_WAITING`, then reloads on `controllerchange`) and a `version.json` hash disagreement (Yes is a plain reload). No means no — Esc and click-outside count as No, the callback does not run, and the latch clears so the next `updatefound` or hourly poll can offer again. Verified all four paths in-browser | Verified |
| 20  | **It cannot appear in production yet, and that is pre-existing.** Both triggers sit behind `__IH_SW_MODE__`, which ships "off", so the toast could never fire either. Arming it is a service-worker rollout decision under ADR-019, not a UI change — logged in PARKING_LOT. The SW-off build gate still holds: **zero** `serviceWorker` strings in `www-dist`, no `sw.js`, no `version.json` | Recorded |
| 21  | `e2e/sw/sw-lifecycle.spec.ts` updated to the new copy rather than left to fail — it asserted the toast's "Update available" text and its Reload button | Complete |
| 22  | **Confirm buttons take a white label on a solid fill.** "Delete image" was `text-destructive` on `bg-destructive/15`: measured **3.99:1**, under the 4.5:1 WCAG 1.4.3 asks of body text. On the light theme that tint blends to a pale pink where a white label would have been 1.09:1, which is why the fill had to go solid rather than just the text going white | **FIXED** |
| 23  | First attempt used `bg-destructive` + `--destructive-foreground`, the palette's own pairing. **Measured 3.80:1 on the dark theme — worse than the 3.99:1 it replaced**, because dark `--destructive` is the lighter #e55032. Caught by measuring after the change instead of shipping the tempting one-liner; new `--confirm-danger` token pins #dc2626 for both themes, where white is **4.83:1** | **FIXED** |
| 24  | New `--confirm` / `--confirm-foreground` pair for the affirmative button: white on the deep warm ink #3a3128 at **12.73:1**, one value in both themes. Not `--primary` — white on the warm accent is 2.81:1. Both live in `lib/styles.ts` as `CONFIRM_DESTRUCTIVE` / `CONFIRM_AFFIRMATIVE` so the dialogs cannot drift apart | Complete |
| 25  | Applied to all three gallery delete confirms (all images / this image / selected), which are the same button in three places. `CanvasResize`'s inline "Remove canvas" deliberately left alone — a panel action beside "Resize canvas", not a dialog confirm; logged in PARKING_LOT as a consistency question rather than changed unasked | Complete |
| 26  | **Content-addressed GC: the AUDIT half only, nothing deleted.** `lib/contentAudit.ts` walks every IndexedDB store and reports what a collector would find — orphan count and bytes per store — to `docs/internal/content-addressed-gc-audit.md`. Read-only by construction: `readonly` transactions, `indexedDB.open()` with **no version** (so it can never upgrade), and it only opens databases `indexedDB.databases()` already reports, because opening an absent name would CREATE it | **New** |
| 27  | Raw IndexedDB on purpose, importing nothing from `originalsStore` / `galleryManifest` / `editPersistence` / `dexie` — those open with explicit versions and carry write paths, and an audit that borrows a write path is one refactor away from being a collector | Recorded |
| 28  | Measured run, one real 12-photo profile: **0 orphaned rows, 0 B**. `storage.estimate()` 54.8 MB against 54.1 MB of measured blobs, so essentially all usage is image bytes | Verified |
| 29  | That zero is a measurement, not an absence of evidence: the reachability rule is unit-tested against synthetic stores (**17 new tests**, 233 → 250) because a detector reporting zero *because it is broken* looks exactly like a clean store. With an empty root set the same code calls all 12 originals orphans, catches an `edit-<deleted-photo>` row, and finds orphaned op-log chunks through their compound key | Verified |
| 30  | **Named source 1 — Auto Compress: CONFIRMED, but narrower than parked.** Three of the four repoint sites DO collect (`persistActiveCanvas` and both `BatchSettings` batches call `deleteOriginal(oldKey)` guarded against the baseline). The leak is specifically `handleAutoCompress`, whose per-photo callback repoints with no `deleteOriginal` in the path — one stranded blob per run per already-compressed photo | Recorded |
| 31  | **Named source 2 — deleted photos: CONFIRMED.** `handleRemovePhoto` deletes the edit archive and drops the entry, and never touches the content store, so deleting a photo strands up to TWO originals (`originalKey` + `uploadKey`) — ~4.5 MB per photo on this gallery | Recorded |
| 32  | **Not asked for and more serious: `deleteOriginal` is not refcounted.** Unconditional `db.originals.delete(key)`, where `db.ts:285` guards the same op with `if (refs === 0)`. Originals are shared by design (`handleDuplicateSelected` reuses `originalKey` for zero-copy duplicates) and the `oldKey !== entry.uploadKey` guard only knows about that photo's own baseline. Compress → duplicate → compress the duplicate deletes a blob the FIRST photo still points at: data loss, not garbage. Found by reading the four paths, not run — reproducing it destroys an original | Recorded |
| 33  | Which is why a collector must not be bolted on next: a mark-and-sweep would fix the leak while leaving the sharp edge. The audit computes the mark phase already, so the doc lays out the bounded decision (sweep vs refcount, fix the eager deletes first, whether `uploadKey` is a root) | Recorded |
| 34  | Also surfaced by the run: the legacy `image-horse-originals` database **does not exist** on this profile — originals live in `image-horse-dexie/originals`, so `db.ts`'s "NEW, parallel database … does NOT touch the three live hand-rolled stores" header is now stale for originals (`photos`/`workingCopies` really are still empty). No UI surface added: `DiagnosticLogOverlay.tsx` is mid-change for the Dexie upgrade guard and this had no business touching it | Recorded |

## v7.59 Change Summary — 2026-07-29

| #   | Change | Status |
| --- | -------- | -------- |
| 1   | **Compressing a photo could delete a different photo's original — the only known data-loss bug in the repo.** Originals are content-addressed, so identical bytes are ONE blob with many referrers, and `handleDuplicateSelected` leans on that deliberately (a duplicate reuses its source's `originalKey` for a zero-pixel copy). Every compress path guarded its delete with `oldKey !== entry.uploadKey`, which knows only about the photo being compressed | **FIXED** |
| 2   | The sequence: import P (`originalKey = K`, `uploadKey = K`) → compress P (new blob N, K kept because it is the baseline) → duplicate P to C (C shares `originalKey = N` **and** `uploadKey = K`) → compress C, where `N !== C.uploadKey`, so the old guard deleted N **while P still pointed at it**. P's bytes gone, P's entry still referencing them | Recorded |
| 3   | Fixed in `lib/originalRefs.ts`: all four repoint sites now call `deleteReplacedOriginal`, which derives the reachable set fresh and deletes only when nothing points at the blob. No call site owns a delete decision any more | **FIXED** |
| 4   | **Reachable set, not a stored refcount.** A stored count must be retrofitted onto every write site, needs a schema change on data with no backup, and can drift — at which point it needs a repair path of its own. The set is derived per call, stores nothing, and is the same mark phase the GC audit already computes. (`db.ts`'s `deletePhoto` does hold a refcount, but it counts rows in the Dexie `photos` table, measured EMPTY in production, and that path is called only from tests — a count that is always zero is not a guard) | Recorded |
| 5   | **Reproduced under fixtures before being fixed**, in `lib/originalRefs.test.ts`: node + fake-indexeddb, through the real adapter. One test deliberately performs the OLD unguarded delete and asserts P's bytes are destroyed, so the fixture is known to reproduce the bug rather than merely describe it; the next asserts the guard keeps them. **14 tests** | Verified |
| 6   | The gallery is read fresh (`useGalleryStore.getState().photos`), never a render-time snapshot: batch passes repoint many photos in a loop and a stale array can miss a reference added part-way through — invisible to the guard means deleted. Reading fresh also makes the batch case correct, since with two duplicates sharing a blob the first pass keeps it and the second collects it | Recorded |
| 7   | **A root exists that is in no manifest.** `BatchSettings` keeps each photo's pre-logo / pre-text baseline in a React ref so re-applying replaces rather than stacks; that key appears in no `PhotoEntry` and no manifest. Writing the guard as "check the gallery" would have introduced a NEW data-loss path by collecting those baselines, so batch call sites declare them via `extraRoots`. Any future collector inherits the same obligation | Recorded |
| 8   | **Auto Compress now collects too.** It was the one repoint path with no delete at all, stranding a blob per run over an already-compressed photo (the "pile" the GC audit predicted). It goes through the same guard as the other three | **FIXED** |
| 9   | The bias is one-directional and deliberate: when in doubt, KEEP. Over-keeping leaves garbage the audit can measure and a collector can sweep; over-deleting destroys a photo. A failing delete is swallowed for the same reason — garbage is recoverable, a thrown error mid-edit is not | Recorded |
| 10  | Deleting a photo still strands its originals (audit finding #2) and is deliberately NOT fixed here: collecting on delete is the first step of the collector, it needed this guard to exist first, and it carries its own decision (does deleting a photo also drop its `uploadKey` A/B baseline?) | Recorded |
| 11  | **The next schema bump could have wedged the app, and the guard for it had never been run.** IndexedDB refuses to upgrade while an older connection is live; with nobody listening, `db.open()` never settles and every Dexie call waits forever — including the local save in `savePhotoEdit`, which deliberately has NO timeout because it writes the only copy of the user's work | **FIXED + VERIFIED** |
| 12  | `versionchange` (the half that actually fixes it) closes this tab's connection so another tab's upgrade proceeds; `blocked` surfaces the reverse case. Both were written days ago and committed only now, because an unverified deadlock guard is worse than none — it is believed | Recorded |
| 13  | Verified under fixtures in `lib/dexie/upgradeGuard.test.ts` (**4 tests**), driving the REAL `db` singleton rather than a replica: the upgrade completes instead of hanging, this connection closes, and both messages reach the Diagnostics Window. A control test proves the fixture is real — **without** the guard, the same upgrade IS blocked and nothing is logged | Verified |
| 14  | **Gotcha, found the hard way: Dexie stores `.version(n)` as IndexedDB version `n * 10`.** db.ts's `.version(2)` is IDB **20**, so the first attempt to fabricate a "version 3" opened at 3 and failed as a DOWNgrade. A fabricated v3 is IDB 30, and the stale-tab fixture has to build IDB 10 by hand. Anything reasoning about these numbers from outside Dexie needs to know this | Recorded |
| 15  | The version bump is supplied by the TEST, never by editing `db.ts` — a fabricated `.version(3)` in the source would be a real schema change under the `dexie-migration` skill and must not be committed to make a test pass. Raw IndexedDB at a higher version produces identical upgrade pressure | Recorded |
| 16  | Confirmed in-browser that both messages render in the Diagnostics Window with the teal `INDEXEDDB` badge — by calling `logDiagnostic` directly, NOT by bumping a real database. Opening the live database at version 30 would leave it permanently unopenable by the shipped Dexie v2 | Verified |
| 17  | **Spec drift resolved as a decision, not a drift.** PARKING_LOT asked for a "close your other tabs" prompt; the code logs to Diagnostics. The quiet version stands: `MultiTabScreen` (v7.57) already claims a single editing tab with a visible screen, `blocked` is a wait that clears itself rather than a failure, and with `versionchange` in place only a pre-guard tab or another browser profile can reach it. Reasoning now lives beside the handler in `db.ts`; the parking-lot entry says so | Complete |
| 18  | Residual gap, accepted and parked: if a block persists, the app still waits with only a Diagnostics entry the user has no reason to open. The fix is a timeout raising MultiTabScreen's shape, not a new modal — its own change | Recorded |
| 19  | **OPEN-1 answered, diagnosis only — no `convex deploy` run.** The v7.56 issuer fix **did** reach production: probed the running `brave-ant-608` with an unsigned JWT, which needs no credentials, and read which failure came back. An unconfigured issuer returns `NoAuthProvider` **and enumerates the configured providers**; both `grateful-dingo-89` and `amazed-akita-72` are listed. Share links are fixed in prod | **VERIFIED** |
| 20  | **The tier is still broken, for an unrelated reason.** `users.upsert` keys rows on `identity.subject`, the per-instance Clerk user id — so one human across two Clerk instances is two Convex rows. The live deployment holds a `pro` row under the local-dev subject and a `free` row under the production subject, same person, same address. The live site authenticates as the `free` one | **STILL BROKEN** |
| 21  | So paid accounts ARE served free-tier caps in production (gallery 24 not 100, Replicate AI off) — not because the lookup fails but because it succeeds against the wrong row. No client gating bug remains; v7.50's `useRealTier` wiring is what makes this visible rather than silent. Both rows were last written 2026-07-27, which is itself evidence the issuer fix works | Recorded |
| 22  | **Also found: the real production deployment (`pastel-alligator-180`) has no auth providers configured at all** — same probe returns the short form with no provider list. That is a live trap for "point the live site at production": doing so without deploying `auth.config.ts` there first would go from "wrong user row" to "not authenticated at all", looking exactly like the original bug returning | Recorded |
| 23  | Findings written to `docs/internal/share-links-auth-mismatch.md` under a dated heading, with the credential-free re-check command. Identifiers truncated and email addresses omitted deliberately — this repository is public | Complete |
| 24  | **#14 — `exportFormat` and `quality` are remembered.** They were `useState` in AppShell, so every reload silently reset them to JPEG at 75 and the user re-picked their format on every visit. Now persisted in `useToolStore` beside the sub-mode prefs — same "remember what I picked" contract, no engine coupling, so nothing to sync into WASM on rehydrate | **FIXED** |
| 25  | **Additive only: no version bump, no migration, no `dexie-migration` trigger.** The `partialize` allowlist grew by two keys; the schema did not change. A blob written before these keys existed rehydrates them as `undefined`, which fails validation and falls back to the in-code default — i.e. exactly the pre-#14 behaviour. Verified against a real pre-#14 blob in the browser, not only in tests | Verified |
| 26  | `ExportFormat` is now derived from an `EXPORT_FORMATS` tuple (same shape as `BRUSH_MODES` et al.) so the persisted value can be range-checked against **this build's** list on rehydrate. New `validatedNumberInRange` guard in `stores/_shared.ts` for `quality` — the union-based `validated` cannot express a 1..100 range. The existing validators were not touched | Complete |
| 27  | The "partializes exactly the six sub-mode prefs" assertion is a deliberate DRIFT PIN, and it failed on this change exactly as designed — widening persistence has to break it on purpose rather than slip through. Updated consciously, plus three new tests: tolerance of a pre-#14 blob, rejection of an unknown format, and range-checking of quality (0, 101, -5, NaN, Infinity, "75", null all fall back) | Verified |
| 28  | Round-tripped through the real UI, not just the store: picked WebP in the Compress dropdown, did a full page reload, and the dropdown still read WebP. Preferences were restored to the JPEG/75 defaults afterwards | Verified |
| 29  | **`app/tsconfig.tsbuildinfo` untracked.** A TypeScript incremental build cache that was tracked, so every `tsc` run produced a diff and every worktree ff-merge hit a conflict on a file nobody edits. `git rm --cached` + `*.tsbuildinfo` in `.gitignore`; the local file stays on disk, it just stops being git's business | Complete |
| 30  | **The July shipping popper (Ctrl+\\) had drifted two releases behind its own changelog** — its stats still read "through v7.57". Re-derived from `marketing/src/data/releases.ts` by the recipe its own comment documents (parse each release block, keep `2026-07`, count `tag:` occurrences) rather than typed in: **186 entries across 59 July releases, 477 all-time, 39% of everything ever shipped**; July split fix 60, ui 43, feature 33, infra 25, rust 24, perf 1 | **FIXED** |
| 31  | Two of those numbers ("32 features and 54 fixes") were hard-coded in the JSX while the rest lived in `STATS`, which is exactly how they drifted independently. They read from `STATS.features` / `STATS.fixes` now, so one refresh moves all of them together | **FIXED** |
| 32  | Counted in the order the file's comment requires — the release being cut has to be IN `releases.ts` before the count runs, or the popper ships a release behind its own changelog. The trail entry for this refresh was added first, then the numbers re-derived to include it | Recorded |
| 33  | The eight feature chips were left as they are: they are a curated list of July's headline **app-facing features**, and v7.58/v7.59 were mostly fixes and a data-loss repair. "Export format and quality are remembered" is the one plausible new chip — a curation call, not a derived number, so it is flagged rather than slipped in | Recorded |

## v7.60 Change Summary — 2026-07-30

| #   | Change | Status |
| --- | -------- | -------- |
| 1   | **#21 — op-log saves were DROPPED, not queued.** `saveOplogNow` opened with `if (!hasPersistExports(tool) \|\| saving) return;` — a silent no-op with no retry and no signal to the caller. Two ways in: a photo switch whose `flushPendingOplogSave` fires while a debounced save is mid-flight (it clears the pending timer, so nothing is left to retry), and no switch at all — at a backlog of `OPS_PER_FORCED_SAVE` the debounce delay is 0, so a timer can fire straight into an in-flight save | **FIXED** |
| 2   | **Data loss, not a leak.** `restoreFromOplog` runs FIRST in `useImageSession` and a `"restored"` result short-circuits the working-copy path — but `savePhotoEdit` ran after the dropped flush, so the working copy was fresher. Restore handed back a valid, internally consistent, OLDER document. The same shape as every other bug this month | Recorded |
| 3   | **Reproduced under fixtures before being fixed** (`lib/oplogSaveDrop.test.ts`, 4 tests, node + fake-indexeddb through real Dexie transactions). All four failed first: the manifest reported 10 ops where 13 had been made, and 3 where 6 had | Verified |
| 4   | Fixed with a **promise chain**, not a `pendingRerun` boolean. With a flag, a caller that awaits `saveOplogNow` still gets control back before the rerun has written anything — so `flushPendingOplogSave` would resolve with the tail still in memory, and being awaited before a photo switch is its entire job. Chaining makes the await mean what every call site already assumed | Complete |
| 5   | Deliberately NOT collapsed into a single "one queued save is enough" slot: consecutive calls can carry different `photoId`s (a flush-on-switch immediately followed by the new photo's first save), and collapsing those would drop one — the same bug in a new place. The chain's tail never rejects, so a failed save cannot poison every save behind it | Recorded |
| 6   | The 23 existing op-log write/restore tests pass unchanged — the fix is to WHETHER a save runs, never to what it writes. No persisted format was touched | Verified |
| 7   | **Parked, not decided (OPEN):** when the op log and the working copy disagree, which wins? Restore currently prefers the log unconditionally rather than comparing. #21 broke that assumption once; the ordering itself is unchanged, so any future way for the log to fall behind reproduces the same silent regression. Three options written up in PARKING_LOT; this is an architecture call | Recorded |
| 8   | **#22 — the cloud archive stripped `shadow_*` off live text.** Two copies of the same tile-stripping allowlist had diverged: the local save (`editPersistence.savePhotoEdit`) kept `shadow_box` … `shadow_blur`; the cloud path (`hooks/useEditPersistence`) stopped at `bg_tail` and dropped all **nine** shadow fields. Local restore kept drop shadows, cross-device restore lost them, no error on either side | **FIXED** |
| 9   | Fixed by deleting the duplicate: one exported `stripLiveAnnotations()` in `lib/editPersistence.ts`, called by both paths, so identity is structural rather than coincidental | Complete |
| 10  | **The test is the actual fix.** With one shared function, "do the two agree?" has no teeth — of course they do. The assertion with teeth is *does the stripper carry every field the engine emits except `tile_*`?*, checked against a `Required<PersistedAnnotation>` fixture, so a field added to the interface and forgotten in the map fails. Plus a FIXTURE CHECK that runs the pre-#22 cloud map verbatim and asserts it would have been caught — a guard that cannot fail proves nothing. **8 tests** | Verified |
| 11  | The persisted format did not change. The local path writes exactly the bytes it wrote before (optional fields still come back `undefined` and are still dropped by `JSON.stringify`); the cloud path now writes the same documented shape it always should have | Recorded |
| 12  | Invisible until v7.56 because the cloud path never ran in production — the same reason the v7.57 gallery hang stayed latent | Recorded |
| 13  | **#23 — a rejected IndexedDB open was cached forever.** `originalsStore`, `galleryManifest` and `idbStorage` all did `if (dbPromise) return dbPromise`, so one transient failure (private-mode quota refusal, an eviction landing mid-open) handed the same rejected promise to every later caller and wedged that store for the whole session. Cleared on rejection; the next call retries | **FIXED** |
| 14  | **None of the four hand-rolled stores handled `db.onclose`.** Browsers close idle IndexedDB connections on their own, and a cached CLOSED connection throws `InvalidStateError` on every transaction after — for `editPersistence` that is every edit save for the rest of the session. All four drop the cache on close and reopen. Both guards compare identity before clearing, so a late event from an old connection cannot discard a newer one | **FIXED** |
| 15  | **The archive upload never checked `resp.ok`.** A non-2xx still parses as JSON — an error body with no `storageId` — so `undefined` was handed to `saveEdit` as an `Id<"_storage">`, persisting a pointer to nothing while the catch logged a misleading "cloud save failed" for a request this code thought had succeeded. Now throws on a non-2xx and on a missing `storageId`, so the existing catch reports it truthfully | **FIXED** |
| 16  | **`decodeArchive` failure masked corruption.** Any decode error fell through to "it must be a legacy single-PNG blob" and handed the raw bytes back AS pixels, so real corruption surfaced later as an unrelated image-decode error with the cause long gone. Only bytes actually starting with the PNG signature take that path now; anything else logs loudly to console and the Diagnostics Window and returns null, so the caller falls back to the local copy — a real document instead of bad bytes | **FIXED** |
| 17  | **5 tests** (`lib/idbResilience.test.ts`) driving the real store modules against fake-indexeddb with `indexedDB.open` faulted, rather than a re-implementation that would prove nothing. The closed-connection guard was teeth-checked by neutering the handler and confirming the test fails with the exact `InvalidStateError` it exists to prevent | Verified |
| 18  | **Entropy report — `docs/internal/entropy-2026-07-30.md`.** Ten releases and two decompositions since the last audit; the question was whether they paid off. Report only, nothing acted on | **New** |
| 19  | **The split held; the file it came out of did not stop growing.** `useCloneStamp` went 1,467 → 229 LOC at v7.49 and is **still 229** ten releases later — no re-accretion, which is the usual failure mode. But AppShell went **3,220 → 3,314 LOC** and fan-out **82 → 89**, i.e. it grew 94 lines *while being actively dismantled*. Extraction is slower than accretion | Recorded |
| 20  | The mass that left `useCloneStamp` did not disappear — `useEngineCore` is now 797 LOC, a risk file, and the site of five clone groups (three internal). The five domain hooks share an 89-line triplicate across `useMagicEraserTool` / `useMoveLayerTool` / `usePaintTool`. Total duplication unchanged at 4.0% | Recorded |
| 21  | **CanvasArea is the finding nobody was looking for**: 2,493 LOC with a single **2,102-line** function, marked accelerating. It was not the target of either decomposition and is now close to what AppShell looked like when the dismantle plan was written | Recorded |
| 22  | **35 of the 59 lint warnings are in AppShell** (59%), and another 24% are in the three session hooks extracted from it — 83% inside the dismantle's blast radius. Whether they are the *same* 59 is unanswerable: no per-warning baseline was ever stored. Today's exact breakdown (55 `exhaustive-deps` + 4 `only-export-components`, by file) is recorded in the report so the next one can diff properly | Recorded |
| 23  | Flagged, not acted on: fallow's **top refactoring target is a false positive** — the six "unused exports" in `useToolStore` are the runtime union tuples the persist `merge` validates against, and last month's paid-tier bug was exactly a zero-reference export that turned out to be a missing wire. The report says to teach `.fallow` rather than re-derive this next quarter | Recorded |
| 24  | **Stripe linkage, diagnostic only — verdict: option B is safe and the question is largely moot.** Nothing written, no Stripe call, no user row touched, no `convex deploy`. All four questions read off `brave-ant-608` (the deployment the live site uses) and the source | **VERIFIED** |
| 25  | **The `subscriptions` table is EMPTY** — not "one pointing at the wrong row", none at all. So there is no `stripeCustomerId` anywhere to be attached to the wrong identity, and nothing to migrate. It also answers the open question about how the tier was acquired: **it was never a purchase**. The `pro` tier is a manual grant via `devGrantTier` (by email) or the admin-gated `setMyTier` | Recorded |
| 26  | Premise corrected: `stripeCustomerId` is not a field on `users` at all — it lives on a separate `subscriptions` table keyed by `userId: v.id("users")`, so the linkage is a row reference rather than a column on the identity | Recorded |
| 27  | **The crux, and the answer is the good one.** The webhook resolves on `obj.metadata.userId` — a Convex `Id<"users">` stamped at checkout from `users.upsert` on the LIVE session — **not** a `stripeCustomerId → user` lookup. So a subscription binds to whichever row the person is signed in as when they click Upgrade, which is why **option B fixes tomorrow as well as today**: after repointing, a prod checkout stamps the row that already holds `pro`. The dangerous design (resolve by customer id, pinning future payments to the first row) is not in use | Recorded |
| 28  | No third instance of the pattern: `subscriptions.fulfill` patches **both** the `subscriptions` row and `users.tier`, and the UI (`useRealTier` → `users.me`; `SubscriptionButton` → `users.me` + `subscriptions.getByUser`) reads exactly that field. Panel and server enforcement come from one place | Verified |
| 29  | Also checked because it would have outranked the investigation: `setMyTier` is **properly gated** on the `ADMIN_EMAIL` env var and throws for everyone else *and* when the var is unset. Not a self-serve tier setter | Verified |
| 30  | Not verified, and stated as such: the unused production deployment was not read (the Convex MCP marks it read-only and refuses `data`), and the **Clerk user count in `amazed-akita-72` is Chris's to check** — the verdict covers billing, not accounts, and switching instances does not migrate Clerk users | Recorded |
| 31  | **Documentation audit — all 15 linked docs reviewed.** Six had gone untouched since 2026-06-28/29, i.e. roughly 25 releases. **Nothing was deleted**: every one still has a live purpose. Four were actively wrong and are fixed; one was missing the most urgent item in the repo | **FIXED** |
| 32  | **`Keyboard-Shortcuts.md` was actively misleading** — it still documented the pre-restructure ten-tool digit row (`1`–`0`, "Resize→…→Clone→Emoji") when digits have selected the five GROUPS since the toolbar restructure and 6–0 are unbound. Three more rows were wrong: `Alt + U` (now `Alt + N`), `Alt + [` / `Alt + ]` (now `Ctrl + [` / `Ctrl + ]`), and `Alt + S` (now Open Settings, not Rotate). Rewritten against the real bindings, with the in-app modal named as the source of truth and the missing entries added (`Alt + ,`, `Ctrl + C`, `Ctrl + \`) | **FIXED** |
| 33  | **`OpenRaster-Export-Import.md` said "planning only — not implemented ... the serializer does not exist yet".** It shipped: `lib/openraster/{export,import,stackXml,types}.ts`, wired into the Export tab via `exportOra` / `importOraAsNewPhoto`. Re-headed as SHIPPED, with the plan text kept because the reasoning is still the design | **FIXED** |
| 34  | **`State-Management.md` §6 listed four persisted `useToolStore` keys.** It is eight — `textMode`/`batchMode` joined at the restructure and `exportFormat`/`quality` in #14. Corrected, with a pointer to the drift test that pins the set | **FIXED** |
| 35  | **`IndexedDB-Investigation.md` described `image-horse-originals` as a live store.** The GC audit measured that database as **not present** — originals live in `image-horse-dexie/originals` because `USE_DEXIE_ORIGINALS` is on. Correction note added; the rest of the page holds (`photos`/`workingCopies` really are empty and the gallery list really is still the hand-rolled manifest) | **FIXED** |
| 36  | **`Architecture-Roadmap.md` cited AppShell at ~3,245 lines.** Now 3,314, and the number is more interesting than the drift — it grew while being dismantled. Updated with a pointer to the entropy report | **FIXED** |
| 37  | **🔴 URGENT, and it was not in the security doc at all: the Convex JWT signing key still needs rotating.** Exposed by `npx convex env list` on 2026-06-26 and tracked only in session notes since — the wrong place for the most urgent item on the list. Added as `docs/internal/Security-Hardening.md` 🔴 #0, with the "never run that command again, use `convex env get <NAME>`" warning and a pointer to fold it into the Clerk/Convex consolidation decision | **FIXED (documented)** |
| 38  | Re-checked rather than assumed: `validateUpload` and `sanitizeFilename` are both still **unwired**, so those security items remain open exactly as written. The README doc index gained the three investigation docs written this week (entropy, GC audit, auth mismatch), which existed but were unreachable from it | Verified |
| 39  | **ADR backlog cleared — four records, no decisions.** ADR-023 (the toolbar is five groups), ADR-025 (focus is its own visual channel), ADR-026 (non-React module state reaches React via `useSyncExternalStore`), ADR-027 (collecting originals uses a derived reachable set, not a stored refcount). All written after the fact for calls already made and shipped; all land as **Draft** for a human to accept | **New** |
| 40  | **024 was deliberately skipped, not missed** — it is claimed by the engine-in-a-worker draft on `spike/engine-worker`, which is not on master. Numbering it here would have collided on merge. The INDEX carries a reserved row saying so | Recorded |
| 41  | The July shipping popper was refreshed **as part of this release rather than after it** — 195 entries across 60 July releases, 486 all-time, 40%, split fix 64 / ui 43 / feature 33 / infra 30 / rust 24 / perf 1. Counted after this release's own entries were in `releases.ts`, which is the order the file's comment requires and the exact failure fixed in v7.59 | Complete |
| 42  | **The "89-line triplicate" was twelve lines.** fallow's `dup:1002f0a8` — 89 lines, 3 instances, the largest clone group in the codebase — matched `usePaintTool` / `useMoveLayerTool` / `useMagicEraserTool`. Reading all three first: the only byte-identical code is the 12-line `coords` callback mapping a mouse event to image-space pixels. The rest of the matched window is structural rhyme, `useCallback` shapes that normalise to the same token stream. **A fallow line count is the matched window, not the shared code** | Recorded |
| 43  | Extracted `hooks/useCanvasCoords.ts` and nothing else. Behaviour-preserving by construction: same `useCallback` with the same `[canvasRef]` dependency, so callback identity and every downstream dependency array are unchanged | **FIXED** |
| 44  | **The pointer-gesture lifecycle the group appears to share is not shared.** Down: Move sets refs and calls nothing, Paint pushes smart-brush config then branches three ways with different arg lists, Magic Eraser feature-detects patchmatch exports and never flushes. Move: Move dedupes to whole pixels, Paint flushes only when the engine reports changed pixels, Magic Eraser coalesces its overlay to one rAF (`selection_overlay()` is O(image size) and froze a 1385×2068 image). Up: Move commits, Paint always flushes behind a 20-line comment recording the bug that gating it caused, Magic Eraser conditionally removes and always clears the mask. Unifying that needs a flag per difference — three honest copies beat it, so it was not built | Recorded |
| 45  | Proof it was removed rather than relocated, which was last night's failure mode: duplication **2,116 → 1,990 lines, 4.0% → 3.8%**, files 46 → 44, clone groups 62 → 60, and `dup:1002f0a8` absent. No group in the after-report names the new helper or any of the three hooks; two files left the duplicate set entirely | Verified |
| 46  | **`ShortcutModal` rebuilt on the `ui/dialog` primitive.** It was a bespoke `motion.div` with no `role="dialog"`, no `aria-modal`, no Escape and no focus trap. The layout did not fight it — `.shortcut-modal` was `max-width: 760px` by hand and `size="xl"` is `max-w-[760px]`, so the two-column table is untouched at 9 groups and 33 rows, still derived from the registry. The old look is kept with the two props `SmallWindowNotice` already uses for it | **FIXED** |
| 47  | **What the primitive gave for free, measured rather than assumed: Escape, scroll lock and `aria-labelledby`. Not free: the focus trap, focus restore, and `aria-modal`.** `DialogContent` prevents `onOpenAutoFocus` and its comment claims focus "moves into the dialog container instead" — it does not, focus stays on whatever opened the dialog, outside Radix's focus scope, so the trap never engages. With the modal open, **Tab went Tools → Gallery, both behind the backdrop** | **FIXED** |
| 48  | Radix's modal content restores focus to `DialogTrigger`; this dialog has none (`Alt` + `/` flips a UI-store flag), so the restore resolved to null and focus fell to `<body>` and stayed there — checked at 2.1s, with the origin button verifiably still mounted. `aria-modal` is absent because Radix signals modality by aria-hiding siblings, and `#root` measurably does not get aria-hidden. Both now handled at the call site | **FIXED** |
| 49  | **All three gaps reproduce on the untouched Diagnostics Window**, so they are primitive-wide and pre-existing rather than introduced here. Fixed at this one call site on purpose: changing `ui/dialog` changes every dialog in the app and is its own session. Logged in PARKING_LOT | Recorded |
| 50  | Verified in a browser against the production build, on a fresh port per rebuild so no cached bundle could answer for the new one: Escape closes · Tab stays inside across three Tabs and a Shift+Tab and never reaches `#root` · focus returns to the opener on both the Escape and × paths · `Alt` + `/` toggles both ways · × closes · backdrop click closes with the hit target confirmed · `role="dialog"`, `aria-modal="true"`, `aria-labelledby` → "Keyboard Shortcuts" | Verified |
| 51  | **OPEN — the same canvas coordinate mapping is still hand-written in eight more places** (`useColorPicker`, `useTextTool`, `useEngineCore`, `useEmojiTool`, `useDrawingTools`, `useRedStampTool`, `CanvasArea`, `useSelectionActions`). They vary just enough — `Math.floor`, `rect` vs `r` — to fall under fallow's clone threshold, which is why it only ever flagged three of eleven. One target per session; each is a one-line swap now | Recorded |
| 52  | **OPEN — `npx tsc --noEmit` from the repo root checks nothing.** CLAUDE.md's Commands block and the Definition of Done both name it, but there is no root `tsconfig.json` — tsc finds no inputs and prints its help banner. The same shape as the dead eslint gate CLAUDE.md warns about at length. Not urgent: `.githooks/pre-push` runs `pnpm --filter stamp-tool exec tsc -b`, so the repo is guarded and only the documented command is wrong | Recorded |

## v7.61 Change Summary — 2026-07-31

| #   | Feature                                                   | Status                                   |
| --- | --------------------------------------------------------- | ---------------------------------------- |
| 1   | **Batch → AI Rename.** A fourth Batch sub-tool that names every loaded photo from what the engine sees in it. Scan once, then edit the name pattern and the whole list re-previews with no re-decode | **NEW** |
| 2   | New engine module `src/describe.rs` + `describe_image` export. Measures hue histogram, luma mean/variance, local gradient energy, palette diversity, and skin/foliage/sky ratios, returning tags plus a ready-made slug as JSON | **NEW** |
| 3   | Sampling is capped at a ~160×160 grid, so a 24MP photo costs the same to read as a thumbnail. Off the flush path; the only allocation is the output `String` | Complete |
| 4   | Hand-rolled JSON rather than serde — serde is gated behind the `tiles` feature, and this module should not inherit that coupling | Recorded |
| 5   | **It describes an image; it does not recognise objects in it.** `dark-blue-portrait`, never `golden-retriever`. Stated in the panel's lightbulb rather than hidden. A caption model was the alternative and was rejected: demo mode is sacred and captioning cannot run offline. The `alt` job type in `convex/ai.ts` still has no model registered and remains the upgrade path | Recorded |
| 6   | `lib/describeImage.ts` owns name-building: token expansion (`{desc} {color} {subject} {kind} {tone} {orientation} {detail} {name} {n}`), slugging, and collision resolution. Split from the panel because the collision rules are the part worth testing | **NEW** |
| 7   | Dedup is case-insensitive (APFS and NTFS agree) and steps around names that already look like suffixes — `["beach", "beach-2", "beach"]` → `beach-3`, not a second `beach-2` | Complete |
| 8   | The ZIP export is **not** the reason dedup exists — it runs its own `usedNames` pass and would suffix duplicates itself. The reason is that identical names are unusable in the gallery before any export, and letting the archive invent suffixes hands the user an ordering they never chose. An earlier comment claiming data loss here was wrong and was corrected | Recorded |
| 9   | **A stack of images never asks.** Two or more dropped or pasted images go straight to the gallery, empty gallery or not; `handleAddPhotos` takes as many as the tier cap allows and toasts when it trimmed. A single image keeps the three-way choice dialog | **NEW** |
| 10  | **This closed a silent data-loss path.** The drop handler used `.find()`, so a multi-file drop kept file #1 and discarded the rest with no indication. The clipboard path had the same hole. Hence `>= 2` rather than the `> 2` originally asked for: the dialog is single-image by construction, so at `> 2` a two-file drop still loses one | **FIXED** |
| 11  | **Two hue-binning bugs, caught by the tests before release.** The 12 bin names were off by one against the 30° centres — "gold" had been slipped in at index 2, rotating the whole wheel — so pure blue came out `sky` and foliage came out `lime`. Fixed the table, not the tests | **FIXED** |
| 12  | `subject == color` is reachable (a blue sky scores both the `sky` hue bin and the `sky` subject); the slug drops the duplicate rather than emitting `sky-sky` | Complete |
| 13  | **The `portrait` subject over-fires on warm scenes.** Kovac's skin rule fires on any warm mid-tone, so beige stucco and sunlit stone read as skin — a white car against a beige wall came out `orange-portrait`. Guards added (`kind == "photo"`, `detail != "smooth"`, threshold 0.14 → 0.18) with a regression test pinning the flat-warm-wall case | Partial |
| 14  | ~~OPEN — those tightened thresholds were never re-measured.~~ **RE-MEASURED 2026-08-01 against the same 12 bundled sample photos, and the tightening is very nearly inert.** Exactly ONE of the 12 changed: #10 `orange-portrait` → `orange-smooth`. Neither of the two images it was aimed at moved — #04 (white car / beige wall) and #06 (stone and tree) are still `orange-portrait`. The one true positive, #01, kept its tag, so the change does no harm; it just does almost nothing | **MEASURED** |
| 14a | Why, from a diagnostic pass (pattern `{n}-kind-{kind}-subj-{subject}-det-{detail}` applied to the whole gallery so every classification is readable): **all 12 samples are `kind == "photo"`**, so that guard excluded nothing, and **`detail` is empty for 10 of the 12** — only #10 and #12 read `smooth`. So `detail != "smooth"` could only ever have affected #10, and it did. The 0.14 → 0.18 threshold raise moved **nothing at all**: #04, #06 and #09 all still clear 0.18 | Recorded |
| 14b | **STOPPED HERE deliberately.** The instruction was to tune from evidence or not at all, and the evidence says a threshold is the wrong instrument: warm stone and beige stucco genuinely occupy the same RGB region as skin, so no scalar cut separates them. The next attempt should use a different signal — spatial clustering (is the skin-classified region contiguous and face-sized, or spread across the frame?) — not another number | Recorded |
| 14c | **OPEN — `describe_image` exposes no raw ratios**, so diagnosing this needed a full rename pass to read tags indirectly. Returning `skin_frac` / `green_frac` / `sky_frac` / `edge` in the JSON (or behind a debug flag) would make the next measurement a single call instead of a gallery rewrite | Recorded |
| 15  | ~~OPEN — the clipboard paste path was never exercised in a browser.~~ **VERIFIED 2026-08-01 against a real OS clipboard, 3 of 4 branches.** Chrome runs on Windows here, so `powershell.exe Set-Clipboard -Path` over a `\\wsl.localhost\…` UNC path put genuine CF_HDROP file lists on the real clipboard (confirmed each time with `Get-Clipboard -Format FileDropList`), and a CDP `ctrl+v` delivered real paste events carrying real `File` objects. No synthetic `ClipboardEvent` was used — that would test the mock, not the browser | **VERIFIED** |
| 15a | One image → one paste event, `files: 1` → "Add this image" opens with all three tiles, gallery unchanged | **PASS** |
| 15b | Three image FILES → one paste event, `files: 3`, gallery +3, no dialog, no "Add this image" in the DOM. Repeated in the same page session: +3 again, one event per press — the eager `getAsFile()` map holds and the handler does not accumulate listeners. (An earlier run appeared to add 6 for one press; that was a probe installed twice by a timed-out call, not the app. Re-run clean twice to be sure) | **PASS** |
| 15c | Focus in a text `INPUT` with an **image** on the clipboard — the real hijack risk — paste fired and nothing happened: gallery unchanged, no dialog. With **text** on the clipboard it typed normally and the rename preview updated live | **PASS** |
| 15d | **OPEN — the start-screen "Paste (Ctrl+V)" button is still unverified, and cannot be verified unattended.** It calls `navigator.clipboard.read()`, which requires a VISIBLE document; with a backgrounded window the promise **never settles** — it sat `pending` indefinitely rather than rejecting, so the button did nothing with no feedback at all. Needs a foreground window and a human to answer the `clipboard-read` permission prompt | Recorded |
| 15e | **OPEN — both failure modes of that path are silent.** A rejected read is swallowed by a bare `catch {}` then `if (!source) return` with no toast; a never-settling read hangs the function. Found by attempting 15d rather than by reading | Recorded |
| 15f | **OPEN (PRE-EXISTING, not from v7.61) — `NewActions.tsx:260-276` paste handler has no text-field guard**, unlike AppShell's. Landed `f1cbc7e` 2026-06-26, 193 commits earlier; v7.61 never touched the file. Only reachable via the old `Modal` primitive's missing focus trap, since the New dialog has no text inputs of its own | Recorded |
| 16  | Engine size 753,582 → 758,946 bytes (+5,364, +0.71%) — the new module. No hot-path change, so no bench required | Verified |
| 17  | Gates: `cargo fmt --check` clean · clippy `-D warnings` clean · 154 Rust tests (12 new) · `tsc --noEmit` clean · lint 0 errors (59 warnings, none new) · 309 vitest across 24 files (21 new) · production build succeeds | Verified |
| 18  | Verified in a browser against the production build, on a fresh port per rebuild so no cached bundle could answer for the new one: a 3-image drop took the gallery 12 → 15 with no dialog and no prompt in the DOM · a single drop still opens the dialog with all three tiles · scan + rename of 15 photos produced correct names, with the synthetic controls landing as `red-graphic`, `blue-graphic` and `bright-white-screenshot` | Verified |
| 19  | **The Export section of `imagehorse-qc`, blocked since 2026-07-24 because it writes real files to disk, is finally closed.** Run by hand against the current build as AI Rename → `Alt`+`Shift`+`E` → inspect the archive, so it doubled as proof that the rename → export filename chain holds. That QC run is now fully complete | Verified |
| 20  | The July shipping popper refreshed **as part of this release rather than after it** — 205 entries across 61 July releases, 496 all-time, 41%, split fix 66 / ui 45 / feature 35 / infra 33 / rust 25 / perf 1. Counted after this release's own entries were in `releases.ts`, which is the order the file's comment requires | Complete |
| 21  | **OPEN — a fresh `imagehorse-qc` is owed before the next release.** This touched both the engine and the tools | Recorded |
| 22  | **OPEN — an ADR is owed** for the describer, the new wasm export, the fourth Batch sub-mode, and the local-describer-over-caption-model decision | Recorded |
| 23  | **OPEN (pre-existing, not from this release) — a placed shape's colour cannot be changed.** Two independent blockers in `commitEdit`: the reselect style snapshot outranks the live panel (`es.style?.strokeColor ?? s.strokeColor`), and `editDirtyRef` is only set by a handle drag, so a colour-only edit early-returns without calling `update_shape_annotation`. Landed in `b6813b7` (2026-06-13) with reselect itself | Recorded |

## v7.62 Change Summary — 2026-08-01

| #   | Feature                                                   | Status                                   |
| --- | --------------------------------------------------------- | ---------------------------------------- |
| 1   | **Live overlays no longer drift when the image is resampled.** Reported as "add a shape, then text, then use the resize tool, shrink a little, and the vector items move to the side instead of anchoring in the same spot." They were never moving — the image was moving out from under them | **FIXED** |
| 2   | Root cause: a layer owns three things measured in canvas coordinates — its pixel buffer, its optional mask, and its live text/shape overlays — and `resize_with_filter` resampled only the first. Measured before the fix: a rect centred on a 200×200 canvas (`x0=90`) was still at `x0=90` after resizing to 100×100, i.e. **90% across a canvas it used to be centred on** | Recorded |
| 3   | `crop` and `resize_canvas` have translated overlays with their layer for months, with tests asserting it. `resize_with_filter` was the sibling that never did | Recorded |
| 4   | X and Y scale **independently** — anchoring to image content is the whole point. Magnitudes with no axis (font size, stroke width, background padding, corner radius, shadow blur) scale by the **geometric mean** of the two: exact for a uniform resize, area-preserving for a non-uniform one | Complete |
| 5   | Text tiles are **rebuilt** via `build_text_annotation`, not repositioned. The tile is a cached glyph bitmap; moving it without rebuilding would draw the old bitmap at the new size | Complete |
| 6   | Floors so a downscale cannot erase geometry: font size ≥ 1, stroke width ≥ 0.5 | Complete |
| 7   | The zero guard moved **above** the snapshot, so a degenerate resize no longer pushes a useless undo step on its way to doing nothing | **FIXED** |
| 8   | **The layer mask had the same bug, quieter.** It is one byte per canvas pixel and was not resampled either; `render_layer` skips a mask whose length no longer matches the canvas, so a resize **silently switched masking off** — no crash, no warning, the layer just stopped being masked | **FIXED** |
| 9   | The mask goes through the **same kernel** as its layer (widened to gray RGBA, resampled, narrowed) rather than a bespoke single-channel sampler. A mask that resampled differently from the pixels it gates would drift at the edges — the exact bug class this change exists to remove | Complete |
| 10  | A mask that was ALREADY the wrong size is dropped rather than rescaled: it was inert before the call, and rescaling it would silently switch masking back on with stale coverage | Complete |
| 11  | **The engine fix does not work alone.** `syncState` reports canvas dimensions and history, NOT overlay geometry, so it never bumps the annotation revision — the engine would hold corrected coordinates while React kept drawing the overlay from its pre-transform cache, invisible until an undo or tool switch happened to refresh it. Found by reading, not by running | **FIXED** |
| 12  | `commitGeometryChange` (flush + sync + broadcast) now backs the five transforms that move annotations. **Deliberately wider than the report**: crop, resize, canvas size and the canvas border had identical staleness and would show the same symptom by another route. Fixing one and leaving four in the same file was not defensible | Complete |
| 13  | **OPEN — flips and rotates do not move annotations in Rust at all.** Left alone here (they were never routed through the new helper, correctly, since there is nothing to re-read). Rotating an image should almost certainly rotate its overlays; that is its own change | Recorded |
| 14  | Tests: **9 new, 163 total** (was 154). Shape and text coordinates, font size, tile rebuild, stroke-width floor, non-uniform axes, upscale, degenerate no-op, mask resampled to the new size with coverage intact, and pen-path `points` scaling with the bbox rather than being left behind | Verified |
| 15  | Engine size 758,946 → 761,213 bytes (+2,267, **+0.30%**) — scaling arithmetic, the tile rebuild call, the mask resampler. Nothing on the flush path changed; resize is user-initiated, so no bench | Verified |
| 16  | Gates: `cargo fmt --check` clean · clippy `-D warnings` clean · 163 Rust tests · `tsc --noEmit` clean · lint 0 errors (59 warnings, none new) · 309 vitest · production build succeeds | Verified |
| 17  | **OPEN — not verified in a browser.** Automation could not get permission to drive the tab this session. The engine behaviour is pinned by unit tests asserting the exact reported symptom, and the JS staleness was found by reading rather than running, so the end-to-end path deserves a human look | Recorded |

## v7.63 Change Summary — 2026-08-04

| #   | Change | Status |
| --- | ------ | ------ |
| 1   | **A shape you have already placed can be recoloured.** Click a committed square or circle (on canvas or via Review → Reselect), pick a colour, and it changes. It previously did nothing — reported seven weeks running and reproduced on production 2026-08-03 | Complete |
| 2   | Stroke width, arrow style and the four fill controls (mode, colour, second colour, gradient angle, mosaic block) had the identical blocker and are fixed by the same change | Complete |
| 3   | Root cause was entirely React-side, in `useDrawingTools`. `selectShape` snapshots the shape's own style into `editState.style` so reselecting a red square shows it red; that snapshot then outranked the live panel everywhere (`es.style?.strokeColor ?? s.strokeColor`), so a panel colour could never reach the shape | Complete |
| 4   | Second blocker in the same path: `editDirtyRef` was set only by a handle drag, so a colour-only edit hit `commitEdit`'s no-op early exit and never called `update_shape_annotation` at all. Both had to go | Complete |
| 5   | The snapshot is now a DEFAULT rather than an override — new `panelStylePatch` diffs the panel against its own previous value and carries across only the fields just changed, so an untouched field keeps the shape's own value and reselect still renders the shape as itself | Complete |
| 6   | **No new engine export.** The brief called for `set_shape_color(id, r, g, b)`; `update_shape_annotation` already validated the id, snapped "Edit Shape" for undo and wrote into the annotation record, and its own doc comment already said "a drag/resize **or panel restyle** of a selected shape". A second path would have duplicated a subset of it and skipped fill entirely — see ADR-029 | Complete |
| 7   | Engine size unchanged at **761,213 bytes** — nothing was added to the crate. No hot-path change, so no bench | Verified |
| 8   | Verified in a browser against the production build: reselect a committed blue rect, click green, preview turns green; Enter commits green; Ctrl+Z restores blue; Ctrl+Shift+Z re-applies green; a full page reload still shows green | Verified |
| 9   | **Every dialog in the app now traps focus, restores it on close, and reports `aria-modal`.** Previously none did — the delete confirms, Settings, Diagnostics, the command palette, the update prompt and the subscription sheet all inherited the gaps from `ui/dialog` | Complete |
| 10  | The trap never engaged because `DialogContent` prevented open-autofocus while its comment claimed focus "moves into the dialog container instead". It did not — focus stayed on whatever opened the dialog, outside Radix's `FocusScope`, so there was nothing to trap and Tab walked the page behind. The wrong comment is why it survived; it is gone | Complete |
| 11  | No focus restore, because Radix restores to `DialogTrigger` and this app almost never uses one (dialogs open from store flags, shortcuts and the command palette) — the restore resolved to null and focus dropped to `<body>` | Complete |
| 12  | No `aria-modal`: Radix signals modality by aria-hiding the content's siblings, but `#root` measurably does not get `aria-hidden`, so assistive tech could still reach the app behind an open dialog | Complete |
| 13  | `ShortcutModal` fixed all three at its own call site in v7.61 and said so in a comment ending "This is a PRIMITIVE-WIDE bug". The fix moved into `DialogContent`, so ~40 lines came out of `ShortcutModal` and nothing else has to opt in. Caller-supplied `onOpenAutoFocus`/`onCloseAutoFocus` are still invoked; `aria-modal` sits before `{...props}` so it stays overridable | Complete |
| 14  | Verified in a browser on four dialogs — Keyboard Shortcuts, Settings, the "Delete all images?" confirm, and the update prompt. The update prompt cannot fire in a default build (`__IH_SW_MODE__` statically removes both triggers), so it was summoned through a temporary harness that is not in the shipped tree | Verified |
| 15  | Control test, same method, on master's `dialog.tsx` rebuilt: focus stays on the opener outside the dialog · `aria-modal` null · focus escapes to a button behind the backdrop · close drops focus to `BODY`. Fixed build, identical steps: inside · `"true"` · blocked · restored to the opener | Verified |
| 16  | `aria-labelledby` needed no work — every consumer already renders a `DialogTitle` (`IdleScreenDialog` delegates its one to `IdleScreenCard`), and it was present in the control too | Verified |
| 17  | Tests: **17 new.** `tests/shape_recolour.rs` (8) pins undo depth and restore, the annotation data behind reload, and the exported artifact; `useDrawingTools.test.ts` (9) pins the patch decision, including that selecting a shape without touching a control produces no patch and so costs no undo step. Rust 163 → 171, vitest 309 → 318 | Verified |
| 18  | Gates: `cargo fmt --check` clean · clippy `-D warnings` clean · 171 Rust tests · `tsc --noEmit` clean · lint 0 errors (59 warnings, none new) · 318 vitest · production build succeeds | Verified |
| 19  | **OPEN — `?v=` on the app URL is swallowed by the share route.** `http://host/?v=x#/create/shapes` renders "Shared image / This link is no longer available." instead of the editor. Found while cache-busting a rebuild; harmless in normal use, but it makes query params unusable for QC cache-busting | Recorded |
| 20  | Housekeeping: `feat/vector-tool` confirmed already deleted on both remotes and preserved as the annotated tag `abandoned/vector-tool` (so commit `38275af` is not dangling and needs no rescue); the merged `night/job-iv` worktree removed; ADR-029 written | Complete |

## v7.64 Change Summary — 2026-08-04

| #   | Change | Status |
| --- | ------ | ------ |
| 1   | **Fixes a hole in v7.63's shape recolour, found in user testing hours after it shipped.** Reselect a shape and click a colour, and it only registered if that colour differed from the one the panel was already showing. Click an orange shape while the panel still read purple, click purple, and nothing happened — no colour change and no history entry | Complete |
| 2   | Cause: `panelStylePatch` diffs the panel against its OWN previous value, and reselect never synced the panel to the shape. So "the panel value changed" did not reliably mean "the user changed a control" — the assumption the whole diff rested on | Complete |
| 3   | `selectShape` now loads the reselected shape's style into `ToolSettings` and seeds the diff baseline with the same values, so the sync is not itself read as an edit. The assumption is now true by construction | Complete |
| 4   | Two further consequences, both good: the panel stops lying about what is selected (it shows the selected shape's colour and width), and the baseline becomes the SHAPE's style — so changing only the stroke width can no longer drag a stale panel colour along with it, which v7.63 would have done | Complete |
| 5   | Verified in a browser on the production build: panel red / shape orange → reselect → **panel syncs to orange** → click purple → preview turns purple → Enter → **"Edit Shape" appears in History**, undo enabled → Ctrl+Z → shape back to orange | Verified |
| 6   | Tests: 2 regression tests in `useDrawingTools.test.ts` named for the reported symptom — the inert-swatch case, and that a width-only change does not carry the colour with it. vitest 318 → 320 | Verified |
| 7   | ADR-029 carries a same-day follow-up section: the pre-mortem correctly named the diff as the weak point and incorrectly predicted the mechanism (a stale field list). The general lesson recorded: a diff-based "what did the user change" signal is only as good as the guarantee that the thing being diffed starts in sync with the thing being edited | Complete |
| 8   | Engine untouched — wasm still **761,213 bytes**. No Rust change, so the 171 Rust tests are unaffected | Verified |
| 9   | Gates: `tsc --noEmit` clean · lint 0 errors (59 warnings, none new) · 320 vitest · production build succeeds | Verified |

## v7.65 Change Summary — 2026-08-04

| #   | Change | Status |
| --- | ------ | ------ |
| 1   | **The start-screen "Paste (Ctrl+V)" button now reports every way it can fail.** All three modes were silent — you clicked Paste and the app sat there | Complete |
| 2   | **Mode 1: the read never settles.** `navigator.clipboard.read()` needs a VISIBLE, focused document; backgrounded it does not reject, it simply never resolves, so the `await` parked forever and never reached the `catch`. Measured in NIGHT JOB IV and the reason the button sat unverifiable for days. Now raced against a 4s timeout | Complete |
| 3   | **Mode 2: the read is rejected** (permission denied / API unavailable) — was a bare `console.warn`, which no user reads. Now `toast.error` | Complete |
| 4   | **Mode 3: the clipboard holds no image** (text, a non-image file) — `files.length === 0` fell off the end of the function doing nothing. Now `toast.info`, not an error, because it isn't one | Complete |
| 5   | Every message names Ctrl+V, which takes its files from the paste EVENT rather than the async API and therefore works when the button cannot | Complete |
| 6   | **The Ctrl+V handler in AppShell is deliberately left silent** and now says why in a comment. It runs on every paste over the canvas including plain text, which reaches the same "no image" branch — a toast there fires on ordinary text pastes and is noise, not feedback. Opposite call from the button, for a stated reason | Complete |
| 7   | Uses `toast` from `@/components/ui/sonner` (the themed wrapper, which re-exports it) rather than `sonner` directly — the dominant convention, 9 call sites to 3. There is no legacy shadcn `Toast` component in the repo; Sonner is the only notification path | Complete |
| 8   | Verified in a browser, all three branches, in the backgrounded tab that made this untestable before: blocked → error toast; no image → info toast; image present → imports with no toast. The rejection branch fired rather than the timeout because Chrome rejects with "Document is not focused" when `hasFocus()` is false — the timeout covers the parked case NIGHT JOB IV measured with focus true | Verified |
| 9   | Engine untouched — wasm still **761,213 bytes**. Gates: `tsc --noEmit` clean · lint 0 errors (59 warnings, none new) · 320 vitest · app + marketing builds succeed | Verified |

## v7.66 Change Summary — 2026-08-05

| #   | Change | Status |
| --- | ------ | ------ |
| 1   | **Deleting a photo now collects its originals** — audit finding #2. `handleRemovePhoto` deleted the edit archive and the gallery entry and never touched the content store, stranding up to two full-size blobs per delete (`originalKey` + the `uploadKey` A/B baseline) | Complete |
| 2   | Reproduced BEFORE fixing, under fixtures (fake-indexeddb through the real Dexie adapter): Phase 1's tests assert the leak and pass, then Phase 2 inverts the same assertions over the fix — the diff between commits `b24ef0a` and `f667eb7` is the before/after | Verified |
| 3   | Routed through the SAME reachability guard a repoint uses (`collectDeletedPhotoOriginals` → `deleteReplacedOriginal` per distinct key), not a second delete path. Duplicates share blobs; a shared blob survives its sibling's deletion and is collected only when the LAST referrer goes | Complete |
| 4   | **Decision: the `uploadKey` baseline is collected too.** It exists solely to A/B against its own photo; with the photo gone it compares nothing, and it is a full-size original. Still guard-checked, so a baseline shared with a survivor is kept | Complete |
| 5   | Batch pre-logo/pre-text baselines live in React refs and appear in NO manifest — new `lib/extraRoots.ts` provider registry lets BatchSettings publish them and the delete path honour them. A provider (not a store) so the refs' unmount lifetime is preserved exactly | Complete |
| 6   | Failure mode: a failed collect is swallowed, never thrown — garbage is recoverable, a broken gallery is not. Pinned: a rejecting adapter leaves the blob and the verdict says so; one key failing does not stop the other | Verified |
| 7   | **Phase 3 re-measure (read-only, QC profile): ~84 MB stranded against 1 live photo** — 19 originals / 55.3 MB + 22.6 MB edits + 6.1 MB keyframes. Source is NOT the fixed path: `handleDeleteSelected`, `confirmDeleteAll` and `handleStartFresh` all drop entries without collecting. Verdict: extend collect-at-source (2 of 3 are mechanical now), one-shot cleanup for the existing pile, still no resident sweeper. #15 stays open with evidence | Recorded |
| 8   | The reachability audit is now invocable in-app: `await window.__ihContentAudit()` (dev builds or `ih_webgpu`-flagged) returns the report + markdown. It previously had no caller anywhere | Complete |
| 9   | ⚠️ Any cleanup driven off the audit's orphan list MUST use `collectExtraRoots()` — the audit cannot see batch-baseline roots and counts them as orphans | Recorded |
| 10  | Tests: 12 in `deletePhotoOriginals.test.ts` (leak → collect → shared-blob survivor → provider registry → swallowed failures → pre-removal-gallery caller error). vitest 332 → 344 | Verified |
| 11  | Gates: tsc clean · lint 0 errors (59 warnings, none new) · 344 vitest · production build succeeds · engine untouched at **761,213 B** | Verified |

## v7.67 Change Summary — 2026-08-05

| #   | Change | Status |
| --- | ------ | ------ |
| 1   | **`savePhotoEdit` refuses to write one photo's document under another photo's id.** It read whatever the engine held and wrote it under `edit-${photoId}` without checking the engine held THAT photo. A switch that died in `saveOutgoing` left the engine on the outgoing document while the UI moved on, so the next switch stamped it into a different photo's archive | Complete |
| 2   | Measured, not inferred: four `edit-*` archives all decoding to 1445×2128 (the painted car) under four photo ids with four different aspect ratios. Self-sustaining — the victim then owned an archive with one undo entry, so it restored as modified forever | Recorded |
| 3   | Reproduced under fixtures against the SHIPPED code first (3 passing tests proving one document could be written under any id), then inverted. `lib/engineDocument.ts` holds the marker; 8 tests | Verified |
| 4   | **Refusal policy: silent + a Diagnostics line.** No toast, no throw — the work is still in the engine and lands under the right id once the document catches up | Complete |
| 5   | **The bias is one-directional and inverted from the GC collector's.** Refuses ONLY when it positively knows the engine holds a different photo; unknown ownership always allows. A missed ownership site degrades to the shipped behaviour, never to data loss | Complete |
| 6   | Ownership is recorded BEFORE the `isCurrent()` supersession bail — the marker describes the ENGINE, not the UI, and a superseded switch still replaced the document. Recording it after would refuse the next legitimate save | Complete |
| 7   | **Both persistence legs are gated.** The Convex upload in `hooks/useEditPersistence` re-reads the engine and builds its own archive, so a refused local write would still have pushed the wrong pixels to the cloud — the same corruption one layer out, reproducible only when signed in | Complete |
| 8   | **The switch inherits `savingRef`.** `handleSelectPhoto` called `savePhotoEdit` directly, bypassing the overlap guard entirely — one brush stroke, ten concurrent uploads of identical bytes, 238s of network. Routed through `flushEditArchive(outgoing, { detachCloudUpload: true })` | Complete |
| 9   | `flushEditArchive` had to take an explicit photo id: `activeIdRef` is advanced to the INCOMING photo before saveOutgoing runs, so the no-argument call would have asked for the outgoing document under the incoming id — which #1 then correctly refuses. The guard caught the naive version of #8 before it was written | Recorded |
| 10  | **The switch no longer awaits the upload.** Safe only because the capture is synchronous: everything from the engine reads down to `encodeArchive` is await-free, so the bytes are in hand before the switch continues. A detached upload that re-read `toolRef` would upload the INCOMING document under the outgoing key. v7.57's 8s `withTimeout` stays the backstop | Complete |
| 11  | **Redundant uploads skipped by SHA-256 of the encoded archive, not undo depth.** Depth is lossy: paint A (1) → sync → undo (0) → paint B (1, redo cleared) restores both counters over different pixels. `set_artboard_border` and `update_text_annotation` both call `snap()`, so mutators are not the problem — undo-then-edit is | Complete |
| 12  | The skip is on the UPLOAD ONLY; the local IndexedDB write is never skipped. Same bias as #5 — a wrongly-skipped upload costs freshness, a wrongly-skipped local write costs the user's work | Complete |
| 13  | `crypto.subtle` is secure-context only; on a LAN-IP dev server the hash would throw into the catch that reports "cloud save failed" and silently disable sync. Returns null there and the caller uploads | Complete |
| 14  | **The autosave debounce measured render quiet, not idleness.** `flushEditArchive` is a useCallback over `[stamp, …]` and `stamp` is a fresh object on nearly every engine sync, so the 2.5s timer tore down and re-armed on render churn — photo jzfnrd saved at 0s/7s/15.4s/25s at an IDENTICAL undo count. Held through a ref; the pagehide/visibilitychange listeners register once instead of on every render | Complete |
| 15  | **`window.__ihArchiveCorruptionAudit()`** — read-only detector, ungated so it runs against a real production profile. Two signals: COLLISION (photos of different shapes whose archives share one canvas — how this was caught) and ASPECT DRIFT (advisory; crop and the artboard legitimately move a canvas). Detects and reports, NEVER repairs — a wrong repair costs the edits it was aimed at. 6 tests, half of them about not firing | Complete |
| 16  | **`lib/uploadBudget.ts` — a ceiling on cloud uploads.** 10s per-photo interval + 60/hour rolling window. Limits the upload and never the local write; budget spent on success only; checked before the hash so a denied upload pays for no SHA-256. `window.__ihUploadBudget()`. 11 tests with injected time | Complete |
| 17  | **Re-measured in a signed-in browser with the recorder in place: 19 switches, `mismatch=0`, `superseded=0`** (was 10 of 10), median switch 262ms (was ~13,000ms), 5 saves (was 28), `allowedUnknown=0` — the guard is not inert. Included canvas colour and size changes, which snapshot | Verified |
| 18  | Convex audit, read-only: `projects`/`layers`/`annotations`/`history` have 0 client references and 0 rows; `images` is 0/0 but is the landing table for the unbuilt Pro upload pipeline (see `StoragePane.tsx`) and is NOT dead. `ai_jobs.type: "alt"` annotated as registered-but-unimplemented per ADR-028 | Recorded |
| 19  | ⚠️ **The orphan generator is UNFIXED**: the archive uploads before the pointer commits, so any failure between them strands a file permanently, and `crons.ts` is empty. This produced 3,535 MB of orphaned storage, exceeded the Convex free plan, disabled every deployment on the account and took an unrelated production site down with it. `photoEdits.save` is innocent — it deletes the superseded file | Recorded |
| 20  | `docs/internal/convex-deployments.md` — production runs against `brave-ant-608`, the deployment Convex labels *dev*; `pastel-alligator-180` is labelled *production*, has no auth providers and has never held a document. Includes the migration order, because deploying `auth.config.ts` after repointing turns "wrong user row" into "cannot sign in at all" | Complete |
| 21  | Engine untouched — no Rust change. Gates: `tsc --noEmit` clean · lint 0 errors (59 warnings, none new) · **369 vitest** (was 344) · production build succeeds | Verified |
| 22  | ⚠️ `imagehorse-qc` NOT run for this release — flagged and shipped at the maintainer's explicit call. A full pass is owed, and was already owed from the AI-Rename session | Recorded |

## v7.68 Change Summary — 2026-08-06

| #   | Change | Status |
| --- | ------ | ------ |
| 1   | **The stranded-archive hole is closed.** `savePhotoEdit` uploads the archive FIRST and commits the pointer SECOND; any failure between the two left a `_storage` file nothing would ever reference, and `crons.ts` sweeps nothing. That produced 3,535 MB of orphans — 97% of all stored bytes — which exceeded the Convex free plan, disabled every deployment on the account and took an unrelated production site down with it | Complete |
| 2   | The catch did NOT already have the `storageId` — it was a `const` inside the try. Hoisted to a `let`, set on upload success, cleared when the pointer commits. That scoping is why there was nothing to collect with | Complete |
| 3   | **The delete is reference-checked, and that is load-bearing rather than defensive.** The usual way into the catch is v7.57's 8s `withTimeout` around `save`, and a client-side timeout does not mean the mutation failed — it often lands a moment later. Deleting unconditionally would leave a row pointing at nothing: an archive that reads as present and decodes to nothing, strictly worse than the orphan. The scan is also the AUTHORISATION check — a bare storage id has no owner, so the only safe rule is "delete only what nobody references" | Complete |
| 4   | **A denied upload is retried once**, interval-only, supersede-guarded by a per-photo sequence token. Measured during QC: 4 saves, 2 allowed, 2 denied — the 2.5s debounce against a 10s interval denies about half of ordinary editing, and a denied upload was previously dropped, so the LAST edit of a session could never reach the cloud. Kill switch `ih_upload_retry`, shipped lit | Complete |
| 5   | **One definition of dirty, shared by the dot and the save.** The dot was `undoCount > 0`; `dirtyRef` was `undoCount > 0 \|\| hasBeenModified`. A photo could be written to disk while the gallery showed it untouched — the app persisting an edit it said did not exist. Found via "text edits do not light the dot", which was never a text bug | Complete |
| 6   | `handleSelectAll` and `handleDeselect` now sync. `select_all` pushes "Select All" (selection.rs:481) and `clear_selection` pushes "Deselect" (:507); neither call site synced, so `state.undoCount` went stale and a photo whose only change was a selection never autosaved | Complete |
| 7   | **ADR-031: export quality lives on the engine `Snapshot`.** `push_compress_marker(quality)` snaps THEN sets — a step carrying the incoming value would "undo" to the state just requested. `restore_snapshot` APPLIES it. Captured on every snapshot, so undoing a brush stroke restores the quality live at the time | Complete |
| 8   | **The op-log undo path restores it too.** `undo()` returns at lib.rs:2150 before `restore_snapshot` when the log replay path wins, and `try_oplog_undo` discarded the lockstep snapshot wholesale. Quality was dropped in exactly the config production ships (tiles + oplog undo on + single layer). Invisible to unit tests: a bare tool has no started log, so every test fell through to the snapshot path even under `--features tiles` | Complete |
| 9   | **The slider is a DRAFT, not a live engine write.** The first cut set the engine on every drag event, so by Apply the engine already held the new value and the snapshot captured what was being applied rather than what was being replaced. `quality` (store, persisted) is the draft; `stamp.state.exportQuality` is the applied value. ONE effect seeds per photo then follows the engine — two effects raced and destroyed the saved preference on every photo open | Complete |
| 10  | **Quality is undoable without pressing Apply.** `SizeSlider`'s unused `onCommit` (pointer-up) threaded through to `commit_export_quality`; one drag is one step, and a no-op release records nothing | Complete |
| 11  | **Ctrl+Z steps back one pen anchor while drawing.** A capture-phase listener, because both it and `useKeyboardShortcuts` bind keydown on `window` in the bubble phase and AppShell mounts first — bubble-phase interception is impossible, `stopImmediatePropagation` only stops handlers registered later. In-progress anchors are not engine state and cannot be fixed in Rust | Complete |
| 12  | **DECIDED: per-anchor steps do NOT go in the History panel.** `snap()` clones the whole layer stack — ~7.8 MB per step at 1198×814/2 layers, ~96 MB at 4000×3000. Against `DEFAULT_MAX_HISTORY_BYTES` = 512 MB, six anchors on a normal photo would exhaust the budget and evict the user's real edit history | Recorded |
| 13  | Phase 1 audit: the `Snapshot` ALREADY carries every other non-pixel parameter (`Layer.opacity`/`.visible`/`.name`/`.mask`, annotations, dims, selection), all restored. The classifier is 94% false-positive on its top bucket — a static scan cannot see that the RESTORE handles state the OPERATION never wrote. Three setters still never snap: `set_layer_opacity`, `set_layer_visible`, `rename_layer` | Recorded |
| 14   | Engine: **761,213 → 761,838 B, +625 B (+0.082%)** — one `u8` on the struct and Snapshot plus four exported methods. No hot path touched, so no bench. Gates: `cargo fmt` clean · clippy `-D warnings` 0 on default AND tiles,patchmatch · **207 engine tests** (was 171) · tsc clean · **369 vitest** · eslint 0 errors (59 warnings) · production build succeeds | Verified |
| 15  | ⚠️ `imagehorse-qc` sections 1, 2 and 4 passed against this candidate (boot, demo mode logged-out, core loop, close-tab persistence, cross-photo integrity). **Sections 3 and 5 were NOT formally run** — shipped at the maintainer's explicit call, as with v7.67. Still owed, now for two releases | Recorded |

## v7.69 Change Summary — 2026-08-06

| # | Change | Status |
|---|--------|--------|
| 1 | **AVIF exports were PNG files wearing a `.avif` name.** Chrome decodes AVIF but cannot encode it, and the HTML spec makes the fallback silent — `toBlob` returns a PNG typed `image/png`, with no error. Measured before changing anything: requesting `image/avif` returned PNG magic `89 50 4e 47`, byte-identical in size to the PNG export. The filename now derives from `blob.type`, so a fallback can never mislabel a file | **Fixed** |
| 2 | The fix first landed on `useExport.exportAs` — a path the Download button does not use. All three gates passed on code that never ran; a single click found it. The real path is `useCanvasActions.handleExport` | **Fixed** |
| 3 | The Compress panel promised "+83% Web Performance Gain" for AVIF while the note beneath it said the file would be saved as PNG. `formatCode` weights AVIF as the most efficient format, so the panel contradicted itself in one viewport. The figures now model the format that lands | **Fixed** |
| 4 | The dependency array keyed those figures on `exportFormat`, which never changes — so the async encoder probe could never re-fire the effect and the AVIF numbers would have stayed on screen permanently | **Fixed** |
| 5 | The Download dialog is a second format picker and still sold AVIF as "Smallest · modern", with a "Download AVIF" button that handed over a PNG | **Fixed** |
| 6 | **PNG itself was never wrong.** Verified against the shipped engine: after `resize(636,865)` the exported file carries a 636×865 IHDR at bit depth 8, colour type 6. ~0.93 MB is what lossless RGBA costs at 550k pixels — 1.90 bytes/pixel | **No bug** |
| 7 | **Resize Layer read as a dead button.** It never refused: a single-layer document returns `has_paste_preview() === true`, the composite is unchanged during the preview, and the overlay is ungated. The box was seeded at the full canvas, so every handle sat exactly on the image border. Seeds at an 8% inset now — measured 58/59/59/59 px against master's 0/0/0/0 | **Fixed** |
| 8 | `gen-trail-data.mjs` ran `git log` with no ref, so the contribution squares depended on which working tree it ran in — a feature worktree counted unmerged commits as shipped, the main tree mid-release missed the commits being released. Resolves against `master` now, and warns how many commits it is not counting | **Fixed** |
| 9 | The marketing site pinned its content to the left edge on a large display — the gutter capped at 4rem, leaving ~800px of dead space at 2560px wide. One token change centres all 18 sections, with no breakpoint: `max()` hands over from the clamp exactly at 80rem, so narrower widths are unchanged | **Fixed** |
| 10 | New hero capture on the README and the marketing site. The old one was from June and still showed a menu two toolbar revisions out of date — the site was advertising an app that no longer existed. 2048x1219, 66 KB, with `width`/`height` and the CSS `aspect-ratio` all updated together so the box is held before the image decodes | **Done** |

**Not built:** real AVIF encoding. No encoder exists in the browser, in the app, or in the crate; adding one is a dependency decision (`@jsquash/avif` is 7.97 MB unpacked, or a `ravif` feature in the crate). AVIF stays in the format list and is now honest about what it produces.

## v7.70 Change Summary — 2026-08-06

| # | Change | Status |
|---|--------|--------|
| 1 | **New button-set image on the homepage**, replacing a command-palette screenshot that could not be read at the size it renders. Nine controls in a 3×3 grid, each square carrying its own border, background and text colour rather than a small button floating inside a larger tile — so nothing overflows and nothing is decorative. Rendered from the app's own stylesheet and Lucide geometry, not redrawn. 832×1106, **18,888 bytes** lossless WebP | **Done** |
| 2 | Sized backwards from the 414px column it renders in rather than guessed: captions land at **14.9px** on screen, against 4.0px for the first attempt at 16 tiles. Lossless beat quality-88 on both counts — smaller *and* sharper — because the sheet is flat panels and hard edges, which is what lossy WebP wastes bits on | **Done** |
| 3 | **The closing section is two columns**: the wifi-off mark alone on the left, headline, paragraph and both buttons on the right | **Done** |
| 4 | A line about the network being optional once the app has loaded. Deliberately NOT "works offline" — the service worker has never shipped, so a cold load with no connection still fails. What is true is that nothing stops mid-edit, and that is what it says | **Done** |
| 5 | **`.close__line` carried `flex: 1 1 22ch`** from when `.close` was itself the flex row and the headline shared it with the buttons. Moved into a column, that grow factor applied down the main axis and stretched one line of text to **488px tall**, which read as a mysterious gap above the paragraph. A first fix at equal specificity but earlier in the file silently lost the cascade and changed nothing | **Fixed** |
| 6 | **Clone Stamp's icon was `Copy`** — a two-sheets glyph that reads as "duplicate", not as sampling a source point and painting from it. Clone Stamp takes `Stamp`; the red marker presets take `BadgeCheck`, which is what an APPROVED/REJECTED mark looks like. The app and the marketing feature list disagreed on both before this and now agree | **Fixed** |

**Note:** `Architecture.tsx` still claims the browser plane is "fully functional offline". That is not true as shipped and is left alone deliberately — it is a claim to decide on, not a typo to patch.

## v7.71 Change Summary — 2026-08-06

| # | Change | Status |
|---|--------|--------|
| 1 | **The Architecture page claimed the browser plane was "fully functional offline". It is not.** There is no service worker in a shipped build — `VITE_ENABLE_SW` is set nowhere, so the registration code constant-folds out and the served bundle carries zero `serviceWorker` references. A cold load with no network fails. The badge now reads **"no server in the edit path"**, which is both true and the thing that actually distinguishes this plane from the Convex one | **Fixed** |
| 2 | `docs/Architecture.md` described WASM processing as working "offline/logged-out". Logged-out is true; offline was not. Now "no network round trip, works logged out" | **Fixed** |
| 3 | Left alone as already honest: the same file's service-worker entry says "investigated only, nothing wired", and a v6-era changelog line describes a *future* worker that "would cache" the app. Both are accurate about a thing that has not shipped | **No change** |

**How this happened, since it will happen again:** the claim was written when the service worker was designed, and it shipped dark. Nothing in the build fails when a marketing claim outruns the code, so the only guard is checking the served bundle. `VITE_ENABLE_SW=1` is the moment to restore the offline wording, and a comment in `Architecture.tsx` now says so at the point of edit.


## v7.72 Change Summary — 2026-08-06

| # | Change | Status |
|---|--------|--------|
| 1 | **The gallery checkerboard was gated on the source file's mime type** — `png`/`webp`/`svg` got it, everything else did not. That tested the wrong thing: `makeThumbnailFromPixels` re-encodes **every** thumbnail to WebP on import, so the format you opened says nothing about the pixels being drawn. A JPEG that gained transparency from the artboard or the eraser still showed no checker, and a fully opaque PNG always showed one | **Fixed** |
| 2 | The gate is gone rather than replaced. Nothing is needed to hide the checkerboard either — the div sits **behind** the image in paint order, so a thumbnail that fills its tile occludes it outright. The vertical grid is `object-fit: cover`, so there it shows only through real alpha; the horizontal strip is `contain`, so what stays visible is the letterbox bars on non-square photos | **Fixed** |

**Found in the same pass, not fixed here:** the ZIP export ignores Settings →
Layers and Canvas → **Photo only**. `exportPhotosToZip` never reads
`exportCanvasBackground` — it composites through `compositeSavedEdit`, which
loads the flattened `canvasPng` and returns `get_image_data()`, the whole
document including the backing canvas. Share, Copy to clipboard and the single
Download all honour the setting; the archive is the one surface that does not.
`handleExport`'s dependency array also omits the preference, so even the single
Download serves a stale value until some other dependency changes. Both are
open.

## v7.73 Change Summary — 2026-08-07

| # | Change | Status |
|---|--------|--------|
| 1 | **Download All → `.zip` ignored Settings → Layers and Canvas → "Photo only".** Share, Copy to clipboard and the single Download all consulted `exportCanvasBackground`; `exportPhotosToZip` never read it, so a batch export always shipped the padded artboard | **Fixed** |
| 2 | Passing the flag through would not have worked. `compositeSavedEdit` built its throwaway engine from the flattened `canvasPng` as ONE layer and ignored `edit.layers`. With a single Content layer, `canvas_idx()` is `None` and `composite_excluding_background()` falls through to the whole stack — it would have returned identical bytes and **looked** like it honoured the setting. `finish_layer_restore` is what promotes the bottom layer to `LayerKind::Canvas` | **Fixed** |
| 3 | The 78-line restore loop (25 text-annotation parameters, four shape kinds) is now **`lib/restoreLayerStack.ts`**, shared by `useEngineCore.loadFromSaved` and `compositeSavedEdit`. Copying it was the cheaper move and is the mistake this repo already paid for — `stripLiveAnnotations` carries the note about the local and cloud annotation maps drifting until the cloud copy silently dropped all nine `shadow_*` fields (#22) | **Refactor** |
| 4 | `handleExport` read `exportCanvasBackground` without declaring it in its `useCallback` deps. Fixed, and `react-hooks/exhaustive-deps` is now an **error** for that file and `useExport.ts` — scoped, not a step toward `--max-warnings 0` | **Fixed** |

**Measured, not assumed.** Two photos, A edited and B untouched, through Download All, zip parsed byte-wise:

| Setting | A (edited) | B (untouched) |
|---|---|---|
| Include canvas | 1530×1030 | 1500×1125 |
| Photo only | **1500×1000** | 1500×1125 |

A loses exactly the 15px border per side; B is unchanged either way, which is correct — a photo with no edit never had a canvas. The edit survives the crop (saturation 0.366 → 0.463). Legacy pre-v5 archives have no `layers`, so they keep the flat canvas and skip the exclude branch.

**On #4, the honest version:** the missing dependency is real but currently unreachable. A control build with the fix removed produced the *correct* value, because `useCloneStamp` returns a bare object literal with no `useMemo` — `stamp` is a new reference every render, so that dependency array rebuilds the callback every time and can never go stale. It is fixed because memoizing the engine handle is on the roadmap, and the day it lands, every decorative deps array in these files becomes load-bearing at once.

**Two candidate bugs investigated and closed:** an early `URL.revokeObjectURL` after `a.click()` (6 sites) — real pattern, but 10/10 downloads landed on real user clicks, so it is hardening, not a defect; and `<button>` without `type="button"` — cannot fire, the app contains no `<form>` at all.

## v7.74 Change Summary — 2026-08-08

| # | Change | Status |
|---|--------|--------|
| 1 | **Delete All stranded every original.** The bulk path did the `setPhotos([])` half and never the collect half, so each original blob stayed in IndexedDB with nothing referencing it — **+108.6 MiB from one click**, measured on the deployed app. Single-photo delete was always correct | **Fixed** |
| 2 | Gallery tiles stretched to fill their grid row. CSS grid items default to `align-items: stretch`, so a short photo's tile grew to match the tallest in the row and rendered up to **188 px** of bare checkerboard beneath the image. `items-start` on the container | **Fixed** |
| 3 | ADR-024 Stages 0–3 — the engine-in-a-worker arc. A cross-surface contract test, the port seam (`lib/engine/port.ts`) and its ownership guard, the read-modify-write sites 9 → 3, and the worker itself with request ids, FIFO queueing, cancellation and error propagation. **Flag `ih_engine_worker`, default OFF**; nothing imports the worker yet, so the build emits no chunk for it | **Internal** |
| 4 | Two decisions moved from JS into the engine: `flatten_text_annotations` returns whether it flattened (four JS guards deleted) and `blur_whole_image` computes its own geometry | **Rust** |
| 5 | ADR-032 — AI Rename will use an on-device vision model, with a cloud caption model as a paid upgrade. Decision recorded, no code yet | **Docs** |

**On #1, all three of the audit's suspected causes were wrong.** The content-GC
audit had blamed orphan accumulation on three mechanisms; each was checked and
none of them was happening. The leak was in the one path nobody had audited,
and it was not accumulation at all — it was a single missing call on the bulk
delete. Content-addressed storage also means re-importing the same file makes
an existing orphan reachable again, so orphan counts drifting downward is
normal and is not evidence of collection.

**On #2, the v7.72 commit that caused it asserted something untrue.** It
claimed the vertical grid used `object-fit: cover`, so the checkerboard could
only show through real alpha. It did not, and the claim was wrong when it was
written. `content-start` was tried first and measured as doing nothing —
`items-start` is the correct axis. The comment in `GalleryBar.tsx` now records
the false claim rather than quietly replacing it.

**On #3, the ownership guard is the deliverable, not the port module.** Two
ports — or any path reaching the engine outside the queue — breaks op-log
ordering *silently*: not a crash, an undo stack that stops reproducing.
`engineOwnership.contract.test.ts` fails on a second writer to the live handle,
on an undeclared engine instance, or on a bypassed seam. It failed when the
worker was added, which is the guard working: relocating the live engine should
cost somebody a deliberate edit.

**Ordering is safe by construction, and that was checked rather than assumed.**
`OpLog::append` records arrival order and no `Op` carries a sequence number, so
postMessage order *is* append order — but only while every mutation goes
through one port, in order. That is why the queue is written out explicitly
instead of delegated to Comlink, which gives correct results with no ordering
promise between concurrent calls.

**Stage 3.5 was discovered missing.** The stage list went "ship a worker" →
"flip a flag" with nothing owning the ~118 async call-site conversions that
make the flag flippable. Three of them are read *during render* and cannot
become Promises at all; they need a synchronous local answer. Recorded in
ADR-024 rather than found later.

## v7.75 Change Summary — 2026-08-08

| # | Change | Status |
|---|--------|--------|
| 1 | Gallery grid row tracks stretched to fill the panel. v7.74's `items-start` stopped the ITEMS stretching; `align-content` still defaults to `stretch`, so the leftover height moved into the ROW TRACKS instead — QC measured **99px tiles in 215.7px tracks**, ~117px of dead space per row, worst at tablet width. `content-start` on the grid container | **Fixed** |
| 2 | `docs/PARKING_LOT.md` is tracked. It was ignored by `.gitignore`, grouped with genuinely disposable run artifacts (`SESSION_LOG.md`, `NIGHT*_PROMPT.md`) — **98 KB of parked findings living on one machine**, invisible to every clone. The Hard Rules say to park adjacent problems rather than fix them in passing; that only works if the parking lot survives | **Fixed** |
| 3 | `scripts/git-prune-stale.sh` — deletes local branches fully merged into the base whose tip is older than N hours, removing their worktrees first and only when clean. Dry-run by default. Was 4 KB of working tool in `~/bin`, untracked and outside the repo | **Added** |

**On #1, the earlier note in this file was wrong and is now corrected in
place.** `content-start` was tried first, alone, and measured as doing nothing;
the code comment recorded that as "content-start does NOT fix it". The
measurement was accurate and the conclusion was not. While the items still
stretched they filled their own tracks, leaving `align-content` no free space
to distribute — it genuinely had nothing to do until `items-start` shrank the
items. `align-items` and `align-content` are different axes and this needed
both. The comment now carries that reasoning, because "we measured X does
nothing" is exactly the kind of note a later reader trusts without re-testing.

**Not browser-verified.** Gates cannot see layout, and this is the second call
on this grid, the first of which was wrong. `grid-template-rows` at tablet
width should be measured before it is trusted.

## v7.76 Change Summary — 2026-08-08

| # | Change | Status |
|---|--------|--------|
| 1 | The arrow / shapes / crop rubber band drew directly on the main canvas: `getImageData` of the whole canvas on mouse-down, `putImageData` of that snapshot on **every** pointermove to erase the previous frame, and once more on release. It now draws on `DrawPreviewOverlay`, a transparent sibling at image resolution riding the same pan/zoom transform. No snapshot, no restore, and erasing is a `clearRect` | **Changed** |
| 2 | Copy to clipboard no longer calls `flatten_text_annotations()` on the live engine before reading pixels. A read path must not be able to write to the document | **Changed** |
| 3 | `scripts/engine-call-audit.mjs` matched engine calls by receiver name and knew only three literal names, so every aliased call (`const t = toolRef.current; t.width()`) was invisible — **93 of 290 sites, 33%**, including all of `editPersistence.ts`. It now resolves per-file aliases | **Fixed** |
| 4 | ADR-024 Stage 3.5's open question answered; Stage 4's scope corrected; measured finding #5 retired | **Documented** |

**#1 is what unblocks ADR-024 Stage 4.** After `transferControlToOffscreen()`
the main thread cannot get a 2D context on that canvas at all, so a preview
painted there would simply stop working. It was also a standing violation of
the project's own rule that the engine owns pixels and React does not touch
them.

**It retires ADR-024's measured finding #5**, which read *"the main canvas has
exactly one writer (`useEngineCore`)"*. `useDrawingTools` was a second writer
and wrote on every pointermove. That finding is cited in the ADR as the reason
canvas transfer would be "unusually clean here", so that clause is withdrawn
too. The decision to move the engine into a worker still stands — it rested on
the OffscreenCanvas and op-ordering measurements — but Stage 4 costs more than
it looked.

**Verified in a browser, not just by gates.** For each of shapes, arrow and
crop: the main canvas is byte-identical before and during the drag, the band
appears on the overlay, and the overlay is empty again after release. A shape
still commits through Rust on Enter. Gates cannot see a rubber band, so this
was measured rather than assumed.

**On #2, the reason recorded in the code was wrong and is now marked
retracted rather than replaced.** It said the flatten was inert because "the
text generally is not on the active layer". `add_text_annotation` pushes onto
the active layer, so text lands there by default, and QC confirmed it. Why the
flatten was inert in practice is still unexplained.

⚠️ **One case where removing that flatten does change output.** The composite
deliberately skips the annotation being edited, while the flatten baked it in,
so a Copy reached with a text annotation mid-edit would omit it. Both routes
into Copy foreclose that state today — the export dialog commits the text when
clicked, and `Ctrl+Shift+C` returns early while a textarea has focus, both
verified in a browser. That is focus handling, not a guarantee: any new path
into Copy must not be reachable mid-edit.

Two more Stage-4 blockers were found and are **not** fixed here: lossy export
still reads pixels back off the main canvas via `canvas.toBlob()`
(`useExport.ts:58`, `:86` — PNG already goes through the engine), and the
canvas element is re-created on ordinary tool switches, which in worker mode
would leave the worker drawing into a detached surface with nothing thrown and
a blank canvas shown.

## v7.77 Change Summary — 2026-08-08

| # | Change | Status |
|---|--------|--------|
| 1 | The Share button's export dimensions were read in JSX prop position, so `export_width_excluding_background()` and `_height_` ran on **every AppShell render**. Each one calls `composite_excluding_background()` — a whole-document composite plus `tight_bbox` — to return one integer. Moved into `useExportDimensions`, an effect keyed on the document version | **Fixed** |
| 2 | JPEG / WebP / AVIF export read the pixels back off the main canvas with `canvas.toBlob()`. They now read the engine and encode through `encodeRgba`, which hands the work to an encode worker where one is available. `useExport` no longer references the canvas at all | **Changed** |

**#1 only bit the `Photo only` preference.** The default ("Include canvas")
takes the other branch of the ternary, which is why it went unnoticed — and why
the fix changes nothing for most users. Measured on the production build with
`Photo only` set:

| Scenario | Before | After |
|---|---|---|
| Two zoom clicks, export dialog **closed** | **24 composites** | **0** |
| Opening the export dialog | — | 2 |

**It was deliberately not added to `syncState`**, which was the obvious home —
it already publishes `width`/`height` right beside these and both call sites
already fell back to it. But `syncState` runs after every mutation, so hanging
two whole-document composites off it would make every brush dab pay for a
number only the export dialog reads.

**#2 clears ADR-024 Stage-4 blocker #2.** After `transferControlToOffscreen()`
the main thread cannot call `toBlob` on that canvas, so the lossy formats would
have thrown. It also stops coupling the exported bytes to whatever happens to
be painted: the engine is the document, the canvas is a view of it.

Verified on the production build, since gates cannot see either change:

| Check | Result |
|---|---|
| `canvas.toBlob` calls during a JPEG export | **0** |
| Engine `get_image_data()` calls | **1** |
| Blob produced | `image/jpeg`, 384,433 B, magic `ffd8ffe0` |
| Decoded dimensions vs engine | **1395×2078 = 1395×2078** |

⚠️ `exportAs` in `useExport.ts` is a **zero-reference export** — reachable only
through the `useCloneStamp` facade and called nowhere. It was changed to match
but deliberately not deleted: a zero-reference export in this codebase was a
missing wire rather than dead code the last time one was found.

Remaining Stage-4 blocker: **canvas element identity**. The element is
re-created on ordinary tool switches, which in worker mode would leave the
worker drawing into a detached surface — nothing thrown, blank canvas shown.

## v7.78 Change Summary — 2026-08-08

Docs only. No code changed.

| # | Change | Status |
|---|--------|--------|
| 1 | ADR-024's Stage-3.5 measurement section claimed the export-dimension cost "scales several-fold on a large photo", citing a native bench at 12 MP. **A 12 MP document cannot exist in this app** — `makeWorkingCopy` downscales every import to `WORKING_MAX_EDGE = 2048` on the long edge and no caller overrides it, so the engine document tops out near 2048² plus the canvas border, about **4.3 MP** | **Corrected** |

The 2.9–3.0 MP figures measured for v7.77 were therefore already close to the
practical ceiling, not a small sample of a much worse case. The defect was real
and worth fixing; its worst case is roughly **1.5×** what was measured, not
fivefold. The native bench numbers still stand as engine cost per megapixel —
they just describe a document size the app will not hand you.

Found while checking why a 432 MP Wikimedia scan was rejected on import, which
surfaced the 100 MP source ceiling (`MAX_SOURCE_MEGAPIXELS`) and the 2048
working-copy downscale sitting behind it.

## v7.79 Change Summary — 2026-08-08

Tooling only. No app code changed. ADR-024 Stage 3.5, step a1.

| # | Change | Status |
|---|--------|--------|
| 1 | `scripts/engine-call-audit.mjs` counted `await` as a *consuming* context, so converting all 166 value-consumed sites would leave the report reading 166. Added an orthogonal **awaited** axis: the gate is now "how many remain un-converted", 166 → 0 | **Added** |
| 2 | `engineAsyncMigration.contract.test.ts` — a ratchet pinning that count. Fails when it goes **up** (a new synchronous call sneaked in) and when it goes **down** without the budget being lowered (a batch cannot land unrecorded) | **Added** |
| 3 | The audit matched engine calls **inside comments**. Every count it has printed included whatever appeared in prose | **Fixed** |
| 4 | `enclosingIsAsync` was a backward line-scan and mis-bucketed **18 of 166** sites. Replaced with a TypeScript AST parse | **Fixed** |
| 5 | The stale "121 value-consumed reads" figure, in `port.ts`, `featureFlags.ts` and `workerClient.ts` | **Corrected to 166** |

**On #3 — found the honest way.** A comment added to `port.ts` explaining the
alias problem contained the words `const t = toolRef.current; t.width()` as an
*example*. The count went 164 → 165 and the new ratchet failed on its own
author. Stripping comments also stopped nearby prose ("preview", "stroke",
"drag") from classifying sites as hot-path: 6 moved to value-consumed and 3
phantom sites disappeared. This is the failure `engineOwnership.contract.test.ts`
warns about in its own header — a check satisfied by its own documentation.

**On #4 — found by QC, not by me.** The plan asked for five hand-checked sites;
the QC terminal did those, saw a systematic pattern, and swept all 166 against
the TypeScript AST:

| Bucket | Regex scan | AST truth |
|---|---|---|
| un-awaited | 47 | **61** |
| needs-restructure | 95 | **81** |
| truthy-trap | 24 | **24** |
| **gate total** | **166** | **166** |

Two causes, neither fixable by widening the pattern. A multi-line parameter
list — `async (` on one line, `) => {` several lines later — made the scan read
the closing line, find no `async`, and call the function synchronous; that was
sixteen sites, including all nine inside `savePhotoEdit`. And an expired
60-line lookback returned `null`, which fell through to *un-awaited*, so
"couldn't tell" silently became "just add await".

The gate total survived the bug; the split did not. **a3–a10 are scoped off the
split**, and sixteen sites wrongly filed as needing a restructure is a fortnight
of imaginary work. The script now parses with the compiler and matches that
sweep exactly; the split is pinned in the test so it cannot drift back.

**The audit resolves `typescript` where it is declared** (`app/`), not by
trusting pnpm's hoist. A bare import worked only by accident of the current
node-linker, and the failure mode would have been a module-not-found inside the
contract test — the whole suite red for a reason nothing on screen explains.

All three guards were mutation-tested: an un-awaited call, a flag read outside
the port, and a throwaway engine on the live port each turn the suite red with
the message that names the invariant. QC independently re-ran all three.

Suite 400 → **408 tests**, 33 → 34 files.

## v7.80 Change Summary — 2026-08-09

ADR-024 Stage 3.5, step a2. Nothing user-visible.

| # | Change | Status |
|---|--------|--------|
| 1 | `lib/engine/textMetricsCache.ts` — a memo cache in front of `measure_text`, `text_ink_offset` and `text_ink_offset_bg`, keyed on their arguments. All six call sites go through it | **Added** |
| 2 | `textMetricsCache.contract.test.ts` — asserts against the **Rust source** that all three still delegate to free functions and never touch `self` | **Added** |
| 3 | The audit's value-consumed test was single-line, so a call that merely *starts* a line read as a bare statement. Moved to the AST | **Fixed** |

**Why a cache and not the mirror ADR-024 called for.** The two reads that happen
during React's render pass cannot be converted by Stage 3.5 — a render pass
cannot `await`. ADR-024 proposed a mirrored snapshot of engine state and treated
it as substantial work. That rested on a wrong premise: these functions read no
engine state at all. `measure_text` forwards to `crate::text::measure`
(`src/text.rs:220`) and the ink offsets to `crate::layer::annotation_ink_offset`
(`src/layer.rs:649`), both **free functions**. The `&self` is a wasm-bindgen
calling convention; the only other input is a `const` font.

A mirror of engine state must be invalidated whenever the engine changes, and
that is the cost that made this look hard. **A cache of a pure function keyed on
its arguments can never go stale**, so there is nothing to invalidate and
nothing to get wrong. `abandoned/scalar-mirror` is not rehabilitated by this; it
is unnecessary. Entries are valid across engine *instances* too, which is why
`BatchSettings` — a throwaway engine — shares the cache with the live document.

That assumption is the whole basis of the design, so it is tested rather than
remembered. Mutation-tested by making `measure_text` read `self.width`: the
guard goes red with *"measure_text reads engine state — the metrics cache key is
now incomplete."*

**Two places where a default would have been a silent defect.** `useTextTool`
and `BatchSettings` needed a miss branch to satisfy the compiler, and the
obvious `?? [0, 0]` is not a neutral value — a zero ink offset is a *wrong
correction* that lands committed text `bg_padding` + tail-margin px away from
its preview, which is the exact drift that code exists to cancel. No metric now
means no correction in `useTextTool`, and a thrown error in `BatchSettings` so
the enclosing catch skips that photo rather than shipping a batch of misplaced
stamps.

**On #3 — the same bug family as v7.79's, found by writing a2.** A call
formatted as an argument on its own line counted as fire-and-forget:

```
Array.from(
  tool.text_ink_offset_bg(text, size, bold, kind, pad),   // <- read as "bare"
)
```

Five sites had been invisible. Because that lands at the same time as a2's own
reduction, both sides were measured with the same audit against a **git worktree
at HEAD** — the only way to separate a real delta from a measurement change,
having conflated the two twice already:

| | Pre-a2 | Post-a2 |
|---|---|---|
| Value-consumed | **171** | **168** |

So a2's contribution is **−3** (six direct call sites became three inside the
cache), and 166 → 171 was the measurement catching up. The budget history is
recorded in `engineAsyncMigration.contract.test.ts`.

Verified in a browser, since gates cannot see text land 4px off: committed
"ANCHOR" at engine anchor (504, 771) against the mapping's own prediction of
(503, 771) — y exact, x within the rounding of a screen-derived measurement —
with the cached ink offset `[6, 10]` being the value the commit used.

Suite 408 → **417 tests**, 34 → 36 files.

## v7.81 Change Summary — 2026-08-09

| # | Change | Status |
|---|--------|--------|
| 1 | Batch export (`Alt+Shift+E` → `photos.zip`) shipped the **original** files and silently discarded every edit, whenever the page had been reloaded since the edit was made | **Fixed** |

**First reported v7.68 (2026-08-06). Reproduced and diagnosed 2026-08-09.** Two
earlier investigations narrowed it and both stopped at the wrong suspect.

`exportPhotosToZip` decided whether a photo was worth looking up:

```
modifiedPhotos.has(id) || imageSavings[id] != null
  || (id === activePhotoId && (undoCount > 0 || hasBeenModified))
```

Every one of those is **transient React state**, and a page reload clears all of
them. The saved edit lives in IndexedDB and survives; the gate that decides
whether to read it does not. So: edit a photo, reload, choose "Resume editing" —
the stroke is visibly on the canvas, `undoCount` is back to 0, `modifiedPhotos`
is empty, the gate says "untouched", and the archive gets the original.
`loadPhotoEdit` was **never called**.

That is why it read as intermittent for two months: edit-then-export-immediately
is correct, and every quick test does exactly that. Only a reload in between
breaks it.

**The fix is a deletion.** The gate was never load-bearing — both of its "ship
the original" branches were byte-identical, so all it ever decided was whether
to spend one IndexedDB read. The presence of a saved edit is the real question
and `loadPhotoEdit` answers it directly, from storage that outlives the session.
One `get` per photo, against a composite and a re-encode.

**The prime suspect carried since 2026-08-06 was wrong.** It held that
`savePhotoEdit` → `idbSave` returned false when the archive-ownership guard
refused, so no edit existed to load. QC ruled that out on 2026-08-08 — the row
exists, `window.__ihSaveGuard()` reports `refused: 0` while holding that photo's
key, and the edit reliably survives a reload. The save path is healthy end to
end; the export simply never asked it anything.

Verified against the exact repro that had just failed, same conditions both
runs — reload, "Resume editing", Undo disabled, `modifiedPhotos` empty:

| | Before | After |
|---|---|---|
| Edited photo in the zip | **3300×2550**, original bytes | **2068×1603**, 152 KB composite |
| Untouched photo | 3072×864 verbatim | 3072×864 verbatim, unchanged |

⚠️ **No regression test ships with this.** The failure only appears across a
page reload, which vitest cannot stage; it needs Playwright or an extracted
"which photos have edits" helper to unit-test. Recorded here rather than
quietly skipped — the bug survived two months and two investigations, and
nothing in the suite would catch its return.

## v7.82 Change Summary — 2026-08-09

ADR-024 Stage 3.5. Engine addition only; no JS consumes it yet, so nothing
user-visible changes.

| # | Change | Status |
|---|--------|--------|
| 1 | `ImageHorseTool::capture_state()` — one call returning everything the save path reads: canvas PNG + dimensions, every undo/redo snapshot with labels and per-step annotations, live text and shape overlays, the full layer stack, and the active layer id | **Added** |

**Why, and why it is not the obvious conversion.** Stage 3.5's instruction is
"make every value-consuming engine call async". Applied to the save path that
produces a bug. `useEditPersistence.ts` states the invariant outright:

> "Everything above reads the engine, and there is not a single `await` in it.
> That is load-bearing, not incidental. […] If anyone ever adds an `await` above
> this line, detaching stops being safe and this comment is the reason why."

`detachCloudUpload` lets a photo switch return as soon as the local write lands
rather than blocking ~13s on the network, and that is only safe because the
bytes were already captured. A capture that yields midway can have the switch
complete underneath it, so the second half of the archive describes the
**incoming** photo while being stored under the **outgoing** photo's key —
silent cross-photo corruption, in the cloud copy where the local guard cannot
see it.

Today it survives by luck: `await` on a synchronous value yields only to the
microtask queue, so DOM events cannot interleave. Once the engine is behind the
worker every await is a real round trip, and a photo switch, stroke or undo can
land mid-capture. Nothing throws; the archive is simply wrong.

So the sequence is removed rather than guarded. One call is atomic by
construction — `&self` cannot be mutated while it runs — and it deletes roughly
**32 conversions** across `editPersistence.ts` and `useEditPersistence.ts`
instead of turning each into a hazard. ADR-024 does not address multi-read
consistency anywhere; it covers op-log ordering (Stage 1) and read-modify-write
(Stage 2), and this is a third category.

**Two constraints shaped the implementation.**

It returns a **transport frame, not the persisted archive** (magic `IHCS`, not
the archive's `IHST`). ADR-024 says persisted formats are untouched by every
stage, and this repo routes any IndexedDB format change through the
`dexie-migration` skill — "no exceptions, even just adding a field". `encodeArchive`
still owns the bytes that land on disk: same format, same version, same loader,
same tests. The cost is one extra copy in memory; the alternative is the engine
quietly becoming the author of user data with no migration story.

It adds **no dependency and no feature gate**. `postcard` was the natural
encoder — the op log uses it — but it sits behind `tiles`, and a
persistence-critical method that vanishes from a default build is exactly the
shape of the bug that shipped a featureless wasm for ten releases. Hand-rolled
little-endian framing has no such failure mode.

**It is an aggregation, not a reimplementation.** Every field goes through the
same getter the JS used to call, so there is no second definition of "what the
canvas PNG is" to drift from the first.

Three tests: a full round-trip that re-reads the frame the way the consumer
will and asserts every field against its own getter (plus that the frame is
fully consumed, catching a length-maths error), a non-mutation check that two
captures of an unchanged document are byte-identical, and an empty-document
parse.

| Gate | Result |
|---|---|
| Rust tests | **297** (was 294) |
| `cargo fmt` / `clippy -D warnings` | clean |
| wasm size | 762,102 → **766,158 B** (+4,056, +0.53%) |
| `capture_state` in glue + binary | verified present |

⚠️ **No JS calls it yet.** The payoff — rewiring both save paths and dropping
the audit's un-awaited count by ~32 — is the next session. Recorded here so the
method's presence without a consumer reads as deliberate rather than forgotten.

## v7.83 Change Summary — 2026-08-09

Marketing site only. No app or engine code.

| # | Change | Status |
|---|--------|--------|
| 1 | `button-set.webp` recomposed: caption strip removed, **832×1106 → 832×859**, **18,888 → 12,418 bytes (−34%)** | **Changed** |
| 2 | Undo and Layers tiles relabelled — all 9 tiles now carry a name, where 7 did before | **Fixed** |
| 3 | `Home.tsx` height attr + `styles.css` `aspect-ratio` follow the new dimensions, so there is no layout shift | **Changed** |
| 4 | The `alt` text describes the nine controls actually shown, rather than twelve that were not | **Fixed** |
| 5 | Nav hover underline animates **`width`** instead of `scaleX` | **Fixed** |

**On #5 — the underline looked smeared while it moved.** The bar was
`width: 1px` blown up by `scaleX(var(--gw))`, up to 73× for "Architecture", on
the reasoning that transform is cheaper than a layout property. The geometry
was never wrong — measured 0.000px error against all five links, at rest and
hovered. The *rendering* was: an animating transform promotes the bar to its
own compositor layer, which is rasterized at the element's layout size — one
pixel — and then stretched by the GPU. A stretched 1px texture is a smear,
which is exactly why it arrived soft while travelling and snapped crisp once
the animation settled and Chrome re-rastered.

The bar is `position: absolute`, so animating its width lays out one 2px
element and reflows nothing else. Every frame is now rasterized at its true
size.

Ruled out by measurement first, and recorded in PARKING_LOT so they are not
re-litigated: horizontal misalignment (0.000px on all five links), the bar
tracking the text box rather than glyph ink (sub-pixel, ±1px), and the
v7.54-era sub-pixel rounding bug (already fixed, still holding). A separate
finding: `prefers-reduced-motion` was `reduce` on the reporting machine, which
disabled the transition entirely and made an earlier "pixel-exact" reading
meaningless.

**Verification, stated precisely.** The mechanism is confirmed — the bar is now
a real 35px element rather than a 1px one scaled 35×, landing on the "Home"
link exactly (left 674.90 = 674.90, width 35.00 = 35.00, height 2px), and it
renders as a clean solid rule at rest. **The mid-travel frame — the actual
symptom — is still unobserved after the fix**, because Chrome freezes CSS
animations in a backgrounded tab and no session has had the window frontmost.

That same trap is worth knowing: a hidden tab also returns fallback `var()`
substitutions from `getComputedStyle`, which reported the glide's width as
**`0px`** while `--gw` was plainly `"35px"`. It cost one false regression call.
`getBoundingClientRect()` reflects real layout and survives it — that is what
the numbers above come from.

Also noted, not acted on: `docs/Change-summary.md` still describes this image
as "832×1106, 18,888 bytes" with captions in an older entry. That is a
historical record of what shipped then, so it stays; this entry is the
correction.

## v7.84 Change Summary — 2026-08-09

ADR-024 Stage 3.5, step a3 — and it is the first entry in this arc that is
real work rather than the measurement catching up.

| # | Change | Status |
|---|--------|--------|
| 1 | Both save paths read the document through **one** `capture_state()` call instead of ~32 separate engine reads | **Changed** |
| 2 | `decodeCapture()` in `editPersistence.ts` unpacks the engine's transport frame into the shapes both paths were building by hand | **Added** |
| 3 | `collectLayers()` removed — both callers now get the layer stack from the capture | **Removed** |
| 4 | Stage 3.5 gate: **168 → 138** unconverted value-consuming calls | — |

**Why a3 was not the mechanical conversion the plan called for.** The contract
said "convert the 18 value-consumed sites in `editPersistence.ts`". Reading the
code it was about to change stopped that: `useEditPersistence.ts` states the
invariant outright —

> "Everything above reads the engine, and there is not a single `await` in it.
> That is load-bearing, not incidental. […] If anyone ever adds an `await` above
> this line, detaching stops being safe and this comment is the reason why."

`detachCloudUpload` lets a photo switch return as soon as the local write lands
rather than blocking ~13s on the network, and that is only safe because the
bytes were already captured. A capture that yields midway lets the switch
complete underneath it, so the second half of the archive describes the
**incoming** photo while being stored under the **outgoing** photo's key.

Converting those reads one at a time — exactly what the stage instructed —
would have built that. Today it survives by luck: `await` on a synchronous
value yields only to the microtask queue, so DOM events cannot interleave.
Behind the worker every await is a real round trip and a photo switch, stroke
or undo can land mid-capture, with nothing thrown and a wrong archive written.

So the sequence was removed rather than guarded. **ADR-024 does not cover this
category** — it addresses op-log ordering (Stage 1) and read-modify-write
(Stage 2); multi-read *consistency* is a third thing and was not in the plan.

**Atomicity is now structural.** `&self` cannot be mutated while `capture_state`
runs, so the property holds by construction rather than by a comment nobody can
enforce. The frame is transport only — `savePhotoEdit` and `encodeArchive` still
own what lands on disk, so the persisted format, its version and its loader are
untouched, per ADR-024 and the `dexie-migration` rule.

**On #3.** `collectLayers` became unreferenced when both its callers moved to
`decodeCapture`. Deleted rather than kept, because this is supersession with a
known cause — not the zero-reference export that turned out to be a **missing
wire** last time (`useRealTier`, the paid-tier gating bug). Checked repo-wide
before removal, not assumed dead from one grep.

**Verified in a browser, not just by gates**, because this is the save path and
a wrong archive is silent:

| Check | Result |
|---|---|
| Stroke pixels before reload | 925 red px, checksum 19,784,688 |
| After reload + "Resume editing" | **925 red px, checksum 19,784,688 — identical** |
| Batch export after restore | edited photo composited at 2068×1603; untouched photo verbatim at 3072×864 |

The `saveOwnership` test double now encodes a real capture frame from its own
getters rather than a hand-written fixture — if its `width()` and its frame ever
disagreed, the test would be asserting against a fiction.

| Gate | Result |
|---|---|
| Rust tests | 297 |
| JS tests | **417** |
| `cargo fmt` / tsc / eslint | clean, 0 errors |

## v7.85 Change Summary — 2026-08-09

ADR-024 Stage 3.5. Nothing user-visible.

| # | Change | Status |
|---|--------|--------|
| 1 | `useLayers.ts` fully converted — **13 → 0** unconverted sites | **Changed** |
| 2 | ADR-024 gains the category it was missing: **ATOMIC CAPTURE**, plus a triage rule for every remaining file | **Documented** |
| 3 | Stage 3.5 gate: **138 → 125** | — |

**On #2 — the rule that came out of a3.** ADR-024 addresses op-log *ordering*
(Stage 1) and *read-modify-write* (Stage 2). It never addressed multi-read
*consistency*, and Stage 3.5's instruction — "make every value-consuming call
async" — actively builds that bug where a file's reads describe one document
state. v7.84 hit it in the save path, where the code already warned that the
absence of `await` was load-bearing. The ADR now carries the triage question to
ask before converting any file, so the remaining 125 do not repeat it.

It also flags the next file to look at with that lens: `lib/openraster/export.ts`
already interleaves `await import("jszip")` between its engine reads *and*
mutates the live document mid-export (`set_active_layer` + `flatten_text_annotations`).
Pre-existing, not something Stage 3.5 would introduce — but not a routine
sweep either.

**On #1 — why this file was done deliberately rather than swept.** Nine of its
thirteen were truthy-trap guards, `if (t.remove_layer(id))`. Convert the method
to return a Promise and forget the `await`, and the condition is permanently
true: a Promise is a perfectly good `unknown` to tsc, and no existing test
fails. The audit lists those sites individually for exactly this reason.

These are **not** an atomic capture — each call is one independent mutation
whose result gates its own follow-up, so there is no multi-read picture to
tear. That is why the whole file could go at once.

The one call-site ripple was `AppShell`'s `importToNewLayer`, which needs the
new layer's id before it can tell the placement box what to remove on Escape.
It became `async` and awaits `addLayer`; nothing between there and `begin`
reads the engine, so there is no capture to tear.

**Verified by driving every converted operation** against the built app and
reading the layer stack out of the engine after each — the UI's rendering of
layers is not the same thing as the document:

| Operation | Result |
|---|---|
| `addLayer` | returns a **Promise**; layer count 2 → 3, named correctly |
| `setLayerVisible` false → true | visible flag flips and flips back |
| `renameLayer` | name changes in the stack |
| `setActiveLayer` | active id follows |
| `setLayerOpacity` | opacity 0.5 lands on the right layer |
| `removeLayer` | count 3 → 2, correct layer gone |
| Console errors / rejections | **none** |

| Gate | Result |
|---|---|
| JS tests | **417** |
| tsc / eslint | clean, 0 errors |
| Rust tests | 297 |

## v7.86 Change Summary — 2026-08-09

Tooling only. No app or engine code.

| # | Change | Status |
|---|--------|--------|
| 1 | `engine-call-audit.mjs` now counts `useSelectionActions` as a hot-path file | **Fixed** |
| 2 | Stage 3.5 gate: **125 → 121** — a reclassification, **not** work done | — |

**The lasso's live wire runs on every mouse move**, and its own comment says so:

> "recomputed on every mouse-move while a session is open. This is the
> interactive path: the engine bounds its search to a window around the
> segment, which is what keeps it inside a frame budget on a big image."

`handleLassoMove` is bound to `onLassoMove` in `CanvasArea` and calls
`lasso_active()` and `lasso_path_to(x, y)` per event. The audit's `HOT_FILE`
list did not include `useSelectionActions`, so those four sites were filed as
ordinary value-consumed work — and would have been swept into the a5 batch as a
routine conversion.

The contract puts hot-path sites last on purpose: *"an await there is a dropped
frame, not a slower call."* They want their own reasoning, not the same
mechanical treatment. Found by applying v7.85's own triage rule to the next
file rather than starting on it.

**The gate moving 125 → 121 is the measurement getting more honest, not
progress.** Four sites left the value-consumed count and joined the hot-path
count; none were converted. That distinction has been kept explicit in the
budget history in `engineAsyncMigration.contract.test.ts` every time it has
happened, because conflating the two is how the earlier 121/162/166/171 muddle
started.

## v7.87 Change Summary — 2026-08-09

Docs only. No code.

| # | Change | Status |
|---|--------|--------|
| 1 | ADR-024's ATOMIC CAPTURE section gains a **triage table** — every file checked so far and what was found | **Documented** |
| 2 | Two more atomic captures identified in `hooks/useExport.ts` | **Found, not fixed** |

**#2 — found by applying the rule rather than starting the conversion.**
`useExport` has two three-read sequences where the pixels and the dimensions
describing them must come from the same state:

```
exportBlob         get_image_data() + width() + height()
generateThumbnail  thumbnail_width(n) + thumbnail_height(n) + thumbnail_data(n)
```

Convert those individually and a resize landing between the reads encodes one
state's pixels at another state's dimensions — a corrupt or failed encode, from
three lines that look entirely routine. Small enough that the fix is cheap: one
engine call returning data and dimensions together, the same shape as
`capture_state`.

The table is in the ADR rather than a session note because the next person to
open Stage 3.5 needs it before they touch a file, not after.

## v7.88 Change Summary — 2026-08-09

| # | Change | Status |
|---|--------|--------|
| 1 | Exports that exclude the canvas background composite the document **once instead of three times** — 69.1 ms → **20.0 ms** on a 1385×2068 photo | **Fixed** |
| 2 | Three engine capture methods: `capture_composite`, `capture_thumbnail`, `capture_composite_excluding_background` | **Added** |
| 3 | Nine call sites converted — 27 engine reads become 9 calls | **Converted** |
| 4 | ADR-024 Stage 3.5 gate **121 → 103** | **Measured** |
| 5 | `useExport`'s thumbnail half found unreachable; `openraster/export.ts` converted instead | **Traced** |

**#1 — a bug that had been shipping, not a migration side effect.**
`get_image_data_excluding_background()`, `export_width_excluding_background()`
and `export_height_excluding_background()` each call the same private
`composite_excluding_background()` and throw away two thirds of its result.
That helper composites every layer into a full-document RGBA buffer, scans it
for a tight bounding box and crops. Reading all three — which every
exclude-background export did — ran that whole sequence three times to produce
one image and its two dimensions.

`capture_composite_excluding_background()` calls the helper once and keeps all
three values. Measured in the browser against the production build:

| Form | Time |
|---|---|
| three getters | 69.1 ms |
| one capture | **20.0 ms** |
| | **3.45×** |

It affects copy-to-clipboard, single download and batch export. The default
preference is "Include canvas", which takes the other branch, so only users who
had switched to "Photo only" were paying it.

**#2 — why one call rather than three awaits.** These are ADR-024's ATOMIC
CAPTURE category: reads that describe one document state and are then used
together. Splitting them into three awaited calls behind a worker lets a resize
or a stroke land in the middle, pairing one state's pixels with another state's
dimensions. In the download path the dimensions outlive the encode and are
written into the exported file's EXIF, so a mismatch would be recorded in the
file itself.

**#5 — the check that changed the plan.** The handoff named `hooks/useExport.ts`
as the next batch. Its thumbnail half turned out to have no caller at all:
`git log --all -G "\.generateThumbnail"` returns zero commits, so no wire was
ever lost — it is a spec waiting for a consumer, unlike the `useRealTier` case
that looked similar. Every thumbnail a user sees comes from a stored blob made
by `lib/workingCopy.ts`. Converting only the named file would have hardened a
path that never runs, so `lib/openraster/export.ts` — the one place
`capture_thumbnail()` executes in production — was converted too.

**Verified.** Exported JPEG's SOF header reads 1365×2048, the capture's cropped
size rather than the document's 1385×2068, with the old getters recording zero
calls on the export path. Exported `.ora` archive parsed from its central
directory: `Thumbnails/thumbnail.png` is a real PNG at 256×173, matching the
engine exactly. Save, restore and undo unchanged.

**Gates.** `cargo fmt`/`clippy` clean, 190 Rust tests, 417 JS tests, `tsc` clean,
eslint 0 errors, production build clean. Engine grew 1,397 bytes.

## v7.89 Change Summary — 2026-08-09

No user-visible change. Test cover for a data-loss fix that shipped without it.

| # | Change | Status |
|---|--------|--------|
| 1 | Regression test for the v7.81 batch-export data loss — 10 tests | **Added** |
| 2 | The export's source decision extracted to `lib/batchExportPlan.ts` | **Refactored** |
| 3 | Four mutants introduced and caught, including the original bug verbatim | **Verified** |

**Why this was owed.** The v7.81 bug shipped originals instead of edits, lost
user data, and survived two months and two investigations. The fix was correct
and went out with no test, because the failure only appears across a page
reload and vitest cannot stage one. Since then the code underneath it has been
substantially rewritten twice — v7.84 moved both save paths onto
`capture_state()`, v7.88 moved the export paths onto `capture_composite*()` —
so an untested data-loss fix has been sitting under two rounds of change.

**What made it testable.** A reload's only relevant effect is that session
state is empty while storage is populated, and that state is reachable
directly. The decision moved into `resolveExportSource(photoId, loadEdit)`,
whose signature has no session-state parameter — so the post-reload condition
is its only condition, and the old bug is not merely untested there but
unrepresentable.

**Two halves, both load-bearing.** The behavioural tests prove the decision
reads storage. They cannot see a gate re-added upstream of the call, so a
source-level test covers that — same style and reasoning as
`engineOwnership.contract.test.ts`. The structural rule distinguishes two uses
of the same identifiers: `undoCount` and `hasBeenModified` are read
legitimately BEFORE the loop, to flush the active photo INTO storage, and
banned inside it, where reading them decides what to LOAD.

**Deliberately not built: a "which photos have edits" list.** `loadPhotoEdit`
falls back to Convex after IndexedDB, so a list built from local keys would
report "no edit" for a signed-in user on a new device — the same bug,
reintroduced by the refactor meant to test it. It would also hold every photo's
archive in memory at once, which is a known tab-crash.

**Verified against the full repro**, production build: stroke drawn (17,448
red px) → page reload → undo count 0 with the stroke intact at 17,448 →
Download All → the archive entry is 2020x1353, the canvas size rather than the
source, and carries 16,967 red px. The remaining 2.8% is JPEG edge softening.

**Gates.** 427 JS tests (up from 417), `tsc` clean, eslint 0 errors, production
build clean. Engine unchanged.

## v7.90 Change Summary — 2026-08-09

Groundwork plus one measurable win on the share path. Nothing user-visible
changes.

| # | Change | Status |
|---|--------|--------|
| 1 | `syncState`'s eleven engine reads become one `capture_ui_state()` | **Converted** |
| 2 | Share-link dimensions: `export_dims_excluding_background()`, **39.9 ms → 17.4 ms** | **Fixed** |
| 3 | ADR-024 Stage 3.5 gate **103 → 93** | **Measured** |
| 4 | ADR-024's Stage 4 ordering table was three-ways stale | **Corrected** |
| 5 | The audit was under-reporting the gate by 1 — a formatting blind spot | **Found, guarded** |
| 6 | `has_transparency()` costs a full composite on every sync | **Found, parked** |
| 7 | The capture sweep (a6) — every file checked against the ATOMIC CAPTURE rule | **Documented** |

**#1 — the same atomic-capture family as v7.84 and v7.88.** `useEngineCore`'s
`syncState` read eleven values — size, zoom, layer stack, undo/redo counts,
history labels, export quality, transparency, source point — assembled them into
one object and handed it to one `setState`. Split into eleven awaited calls
behind a worker, React would render a snapshot that never existed: a width from
before a resize beside an undo count from after. Nothing throws and it
self-corrects on the next sync, which is the profile of a months-long
intermittent rather than a bug report. `syncState` has 74 call sites, so this is
also eleven boundary crossings per edit reduced to one.

**#2 — two composites to produce two integers.** `export_width_excluding_background()`
and `export_height_excluding_background()` each run a full
`composite_excluding_background()` internally and keep one number, so the pair
did two whole-document composites, two bounding-box scans and two crops. The new
call composites once and skips the crop entirely — the crop exists to build a
pixel buffer, and nothing on this path wants pixels.

| Path | Time (1385×2068) |
|---|---|
| two getters | 39.9 ms |
| `export_dims_excluding_background()` | **17.4 ms** |
| `capture_composite_excluding_background()` + reading `.rgba` | 27.2 ms |

That third row is why the obvious reuse was rejected, measured rather than
argued: the pixel capture already returns these two numbers, but reading it
copies ~11 MB out of wasm memory that this path immediately discards.

**And the framing was wrong, in the source and in the notes.**
`useExportDimensions.ts` said it computed "the export dimensions shown on the
Share button". They are not shown. Its only consumer passes them to
`createShare`, which writes them into the Convex `shares` table. They are
persisted metadata on a public link, which makes the atomicity argument
stronger: a caption that is briefly wrong self-corrects on the next render, but
a wrong width stored against a share is wrong for the life of the link.

**#5 — the audit's third formatting blind spot.** It matches a call's receiver
with a regex, so a call split across lines is invisible to it:

```
const history = t
  .history_labels()      // never counted
```

That is the same failure family as the alias undercount that hid 93 sites and
the multi-line `async (` head that misfiled 16. Scale was measured rather than
assumed: exactly one instance existed in the whole codebase, and this release
removed it. A test now asserts the blind spot stays empty.

**#6 — parked, with numbers.** `has_transparency()` composites the entire
document and scans every pixel; `.any()` short-circuits but the composite it
runs first does not. It costs 61.9 ms against 0.3 ms for the other ten fields
combined, and lands at stroke end — a hitch when you lift the brush, not a
dropped frame. Not introduced here and not worsened here. Details and options in
`docs/PARKING_LOT.md`.

**#7 — the sweep says the compressible part is over.** One pass over every
`.ts`/`.tsx` under `app/src` looking only for the capture shape, written up in
`docs/engine-worker-capture-sweep.md`. a3–a5 removed ~52 sites between them
because each found a large capture; **four captures remain worth converting,
covering ~11 sites.** The other ~82 are genuinely one-at-a-time. Expect the gate
to slow from here and do not read that as stalling.

It also named a second capture family, **hit-test then look up**: an id from
`shape_annotation_at(x, y)` indexed into the list from `get_shape_annotations()`.
An id is only meaningful against the list it was drawn from — delete an
annotation between the two reads and `.find()` returns undefined and the click
silently does nothing. Three instances. That shape would not have been found by
looking for the pixels-at-dimensions one.

And the sweep found a blind spot in itself: optional chaining
(`toolRef.current?.undo()`) did not match its `receiver.method(` pattern, hiding
all five of `useHistory`'s sites. That is the fourth detector on this arc
defeated by formatting, after the alias undercount (93 sites), the multi-line
`async (` head (16) and the multi-line receiver (1). Cross-checking the sweep
against `engine-call-audit.mjs` is what caught it, which is the practice to keep.

**Gates.** `cargo fmt`/`clippy` clean, 138 Rust tests, 428 JS tests, `tsc` clean,
eslint 0 errors, app + marketing builds clean. Engine 767,555 → 772,336 bytes
(+4,781) for two capture methods, one dimensions method and their structs.

## v7.91 Change Summary — 2026-08-09

ADR-024 Stage 4, steps a11.1 and a11.2. No user-visible change. The flag is
still off and the worker is still unimported.

| # | Change | Status |
|---|--------|--------|
| 1 | Canvas element identity — every `<canvas>` gets a generation | **Added** (a11.1) |
| 2 | The staleness rule + protocol slot, and a guard that arms at a12 | **Added** (a11.2) |
| 3 | Two comments describing the remount mechanism wrongly | **Corrected** |
| 4 | a11.2's shipped bytes | **Zero** — bundle hash unchanged from a11.1 |

**Why these ship together.** a11.1 establishes the generation; a11.2 gives it
meaning. Separately, a11.1 is a counter nothing consults.

**#1 — what actually remounts, measured.** Not "an ordinary tool switch". Against
the v7.90 production build the canvas element survives compress → brush → crop →
magic-wand intact. It is re-created when crossing the **Batch** boundary, because
`AppShell` renders `<CanvasArea>` in both arms of its `activeTool === "emoji"`
ternary. Five crossings produced five distinct elements.

Today that self-heals: the component remounts, its effects re-run, and
`flushToCanvas()` repaints. After `transferControlToOffscreen()` it will not —
the worker holds the surface of an element React has discarded, keeps drawing,
and nothing throws. Silent, from an ordinary action, and possibly fixed by the
next remount, which is the profile that let the batch-export bug survive two
months.

**The counter must outlive what it counts, and the first build got that wrong.**
`useCanvasIdentity` was called inside `CanvasArea` — the component that remounts
— so it was destroyed by exactly the event it exists to observe. Every gate was
green: `tsc`, lint, 439 tests, production build. The browser showed **five
distinct canvas elements and a generation still reading 1**. Moved to `AppShell`,
which does not remount; a structural test now pins the ownership.

**#2 — half of a11.2's specification had no subject.** It is written as "transfer
carries it, draws carry it, stale draws are rejected". The worker owns a wasm
engine and a FIFO queue, but **no OffscreenCanvas and no drawing** — that arrives
with a12. So there are no draws to tag.

Rather than invent a draw path to guard, this ships the rule
(`staleCanvasReason`), the protocol field (`canvasGeneration` on requests), the
`canvas` message that a12 will use to carry the transferred surface, and
rejection **before** dispatch with a reply rather than a silent skip. A
structural test then fails the moment `engine.worker.ts` gains `getContext`,
`drawImage` or `transferControlToOffscreen` without routing through the check.

**a11.2's real verification therefore arrives at a12, not here.** That is stated
rather than implied: a guard with no traffic proves nothing by passing.

**#3 — two comments that had shaped the plan.** `CanvasArea.tsx` said the re-blit
effect fires when "the canvas element re-mounts (ref changes)" — `canvasRef` is a
`useRef` created once in `AppShell`, and a ref object's identity never changes,
so that dependency is inert. `AppShell.tsx` said `CanvasArea` is "rendered ONCE
(a stable React subtree)"; it is rendered twice.

**#4 — the acceptance evidence.** a11.2's production build produced a bundle hash
**identical** to a11.1's, because `EngineWorkerClient` has no importer. Zero
shipped bytes, proven rather than argued — which is the right standard for work
touching the live render path. (a11.1 itself does change the bundle: the callback
ref is real shipped code.)

**Mutation-tested: 11 mutants, all caught — after two initially survived.** One
because a windowed source search for `reply(` matched an unrelated later one, so
deleting the stale-reply passed; it now pins the exact statement. The other
because removing the generation-0 branch still produced a rejection — the generic
mismatch arm catches `0 !== 4` anyway — so the verdict was right by accident.
Asserting the message pins the branch.

**Gates.** 453 JS tests (up from 440), `tsc` clean, eslint 0 errors, app +
marketing builds clean. Engine untouched.

## v7.92 Change Summary — 2026-08-09

ADR-024 Stage 4, step a11.3. No user-visible change; the flag is still off.

| # | Change | Status |
|---|--------|--------|
| 1 | The `<canvas>` is keyed on the engine mode, so flipping `ih_engine_worker` remounts it | **Added** |
| 2 | A bug a11.3 itself introduced — blank canvas on every flip | **Found and fixed** |
| 3 | ELEMENT REMOUNT ≠ COMPONENT REMOUNT, written into ADR-024 | **Documented** |

**#1 — what this repairs.** `ih_engine_worker=0` is specified as a RUNTIME kill
switch. After `transferControlToOffscreen()` a canvas can never return its 2D
context, so flipping the flag mid-session could not restore the main-thread path
on the element that was transferred — a kill switch that only works on reload,
which is the guardrail-that-cannot-fire pattern this repo has shipped before.
Keying the element on the mode means the flip remounts it, and the new node was
never transferred.

The key comes from `port.ts` as an **opaque token** (`canvas-local` /
`canvas-worker`), not the flag. `engineAsyncMigration.contract.test.ts` forbids
call sites branching on `ih_engine_worker`, and its own message says "fix the
seam, not the caller" — so the seam gained a function rather than the contract
gaining an exception.

**#2 — the fix introduced a blank canvas, and only the browser saw it.** Keying
the `<canvas>` remounts the ELEMENT but not the COMPONENT, so `CanvasArea`'s
re-blit effect never re-ran: every one of its dependencies was unchanged across
a flip, and `canvasRef` is a `useRef` whose object identity never changes.
Measured before the fix — generation advanced 1 → 2 → 3 on each flip and the
element went blank every time, with `tsc`, eslint, 460 tests and the production
build all green. Fixed by putting the surface key in that effect's dependency
array, computed once per render and shared with the element's `key` so the two
cannot straddle a flip and disagree.

**#3 — the fact behind both bugs.** a11.1's counter died because it lived inside
the component that remounts; a11.3's re-blit never fired because the component
did NOT remount. Same underlying fact from opposite directions, twice in two
days, both invisible to every gate. Now a section in ADR-024 with the three
trigger cases tabulated, flagged for a11.4 — which walks back into the same
mechanism.

**Verified by driving the real app**, since the gates provably cannot see this
class of bug: one flip → generation advances by exactly one, canvas stays
painted; a re-render with no flip → no remount; three ordinary tool switches →
generation unchanged; Batch crossings → still one remount each.

**Two properties worth knowing.** The flip applies on the NEXT RENDER, not
instantly — for a devtools kill switch that is fine, since any interaction
applies it, but it is a real property rather than an implementation detail. And
reading the flag per render costs **0.86 µs**, measured rather than assumed,
given this repo's history with per-render costs.

**Gates.** 461 JS tests (up from 453), `tsc` clean, eslint 0 errors, app +
marketing builds clean. Engine untouched. Mutation-tested: 4 mutants on the key,
all caught.

## v7.93 Change Summary — 2026-08-10

ADR-024 Stage 4, step a11.0. No product code changed; the flag is still off.

| # | Change | Status |
|---|--------|--------|
| 1 | A real `stamp_tool` measured inside a transferred-canvas worker | **Validated** |
| 2 | The in-worker flush cost — the number Option A rested on | **22.14 ms, no penalty** |
| 3 | Three hard constraints for a12, written into ADR-024 | **Documented** |
| 4 | a11.4 re-scoped and folded into a12 | **Closed** |

**#1 — the gap this closes.** Two earlier spikes each did half the job.
Phase 0 booted wasm in a worker; the OPEN-B spike transferred a canvas to a
worker and drew on it with plain 2D. Nothing had ever held both at once, so
Stage 4's whole approach — the engine and the canvas together, off the main
thread — was still an assumption. `spike/a11-0.html` + `spike/a11-0.worker.js`
run it for real, served under COOP/COEP with `crossOriginIsolated` confirmed
true in-page.

It works. wasm boots in 39.6 ms in a worker that already owns the transferred
canvas, the engine sizes the backing store from inside the worker (2048x1536),
and `resize` driven from the worker lands. `desynchronized` survives with wasm
live in the same worker — previously only verified without it.

The pixel check was made deliberately falsifiable: the engine's test image is
**red** where OPEN-B's plain-2D harness painted **blue**, so reading blue or
empty would have meant the two halves were not actually connected. It read red.

**#2 — the number.** ADR-024 chose Option A (engine and canvas both in the
worker) over Option B (canvas stays on the main thread) on the argument that the
flush stays cheap from inside the worker. That had never been measured, and it
is the one result that could have invalidated the choice.

| Path | Median, 3.1 MP |
|---|---|
| Flush in the worker, straight to the transferred canvas | **22.14 ms** |
| Flush on the main thread, same build, same image | 23.86 ms |

No worker penalty. The slow path (`get_image_data` + `putImageData`) was
measured on purpose rather than the zero-copy `data_ptr`/`data_len` route —
measuring the fast one would have flattered the result. 22 ms is the honest
ceiling, and 12.6 MB moves per flush entirely inside the worker, which is
exactly what Option B would have pushed across a postMessage boundary.

Warm `adjust_sharpen(50)` at 3.1 MP: 392.1 ms in the worker against 418.8 ms on
the main thread — 0.94x, marginally faster, within noise.

**#3 — three constraints a12 now inherits.** Each is a measurement, not a
preference, and each is now in ADR-024 rather than only in the findings doc.

| Constraint | The number behind it |
|---|---|
| Warm the worker before the flip hands it work | cold first op **715 ms** vs 392 ms warm — a lazy flip regresses against the 419 ms it replaced |
| Terminate the losing instance | wasm linear memory only grows; a flip holds ~75 MB twice and never gives it back unless the worker is torn down |
| Do not model the flush as free | 22 ms exceeds a 60 fps frame budget of 16.7 ms |

**Two traps caught by cross-checking, both of which would have shipped a
confident wrong headline.** The first run reported 786 ms and looked like a 1.9x
worker regression — it was a cold first call compared against a warm median.
The memory reading was taken on a page that had already run the engine and read
134 MB before allocating anything; wasm memory never shrinks, so the baseline
was meaningless. Neither was visible from the worker numbers alone. Both were
caught against a same-conditions main-thread baseline.

**#4 — a11.4 is smaller than it was scoped.** Its trigger half is already done:
a11.3 put `surfaceKey` in the re-blit effect's dependency array, so the effect
re-runs on both remount causes. What remains is the destination —
`flushToCanvas` calls `getContext("2d")` and assigns `canvas.width`, both of
which throw after transfer, so the re-blit has to become a message to the
worker. That is the `flushToCanvas` dissolution ADR-024 already assigns to
Stage 4. Folded into a12: it cannot be built or verified before the transfer
exists, and would otherwise be a third guard with no traffic.

**Stage 4's prerequisites are now 1, 2 and 3 all done.** The transfer is gated
on Stage 3.5 alone. Full record in
[docs/engine-worker-a11-0-finding.md](engine-worker-a11-0-finding.md).

**Gates.** 461 JS tests, `tsc` clean, eslint 0 errors, app + marketing builds
clean. Stage 3.5 gate holds at 93. Engine untouched — no product code in this
release.

## v7.94 Change Summary — 2026-08-10

ADR-024 Stage 3.5, batch a7 — the hit-test capture. No user-visible change.

| # | Change | Status |
|---|--------|--------|
| 1 | `capture_pen_hit(x, y)` — hit-test and lookup in one engine call | **Added** |
| 2 | `AppShell.handlePenHitTest` converted, 2 reads → 1 | **Converted** |
| 3 | Stage 3.5 gate | **93 → 92** |
| 4 | The text half of a7, which is NOT this pattern | **Found, not converted** |
| 5 | The sweep doc's reading of that site | **Corrected** |

**#1/#2 — the pattern.** `docs/engine-worker-capture-sweep.md` calls it HIT-TEST
THEN LOOK UP:

```ts
const id     = tool.shape_annotation_at(ix, iy);            // which one?
const shapes = JSON.parse(tool.get_shape_annotations());    // all of them
const path   = shapes.find((s) => s.id === id && s.kind === 7);
```

An id is only meaningful against the list it was drawn from. The two reads
cannot be separated today. Behind the worker they can, and a shape deleted in
between makes `find` return `undefined`, `handlePenHitTest` return `null`, and
clicking a pen path do nothing at all — no throw, nothing in the console, the
pen simply does not enter re-edit. Same silent-failure family as the rest of
this arc.

**TOPMOST-THEN-CHECK, not find-a-bezier.** `capture_pen_hit` calls
`shape_annotation_at` — which returns the newest shape of ANY kind — and only
then asks whether that shape is a pen path. Filtering to kind 7 inside the
hit-test loop would have been a different function: it would reach THROUGH a
rectangle lying over a pen path and re-edit the path underneath, where today the
rectangle means "no pen path here". That is why the method is not called
`bezier_annotation_at`, and it is pinned by a test.

**#4 — the other site named in the sweep is not this pattern, and was left
alone.** `useTextTool.ts:461` looks identical — `text_annotation_at` then
`get_text_annotations` then `find` — and the plan for this batch called the two
"the same problem twice". They are not. `commitText()` sits **between** the two
reads:

```ts
const hitId = tool.text_annotation_at(x, y);
if (hitId >= 0) {
  if (textInputRef.current) commitText();   // <- mutates: can remove_text_annotation
  list = JSON.parse(tool.get_text_annotations());
  const ann = list.find((a) => a.id === hitId);
```

The freshness is deliberate — the code says so: *"Parse fresh list so we pick up
the latest geometry."* The id is read from the pre-commit state and the geometry
from the post-commit state, on purpose. And `find` returning `undefined` is a
**handled** case, not a silent failure: it falls through to opening a fresh text
input, which is the right thing when you empty a text and click where it was.

So collapsing it into one atomic call would change behaviour whichever side of
`commitText` the call landed on. That site needs ordinary await-restructuring,
not a capture. Building a mirrored `capture_text_hit` "for symmetry" would have
been two conventions for one problem — the exact failure this batch was warned
about, arriving from the other direction.

**#5** — the sweep doc quoted that same comment and read it as "the freshness is
deliberate, but the pairing is assumed". The pairing is not assumed; there is a
mutation between the reads. The doc is corrected.

**Verification.** Five Rust tests, every field driven off its default (the id is
never 0 or -1; the control points are asymmetric in x, y and order). Mutation
tested: 8 mutants, **7 killed**. The 8th — weakening the `id < 0` early return —
is an equivalent mutant, since `shape_annotation_at` only ever returns -1 or a
real id and the match's `_` arm is the actual backstop; that is now a comment in
the code rather than an untested branch.

One mutant survived the first version of the tests: swapping the hit-test's `x`
and `y`. The probe point sat inside the path's bounding box **both ways round**,
so the test could not see the swap. The probe is now asymmetric on purpose and
the mutant dies.

Gates cannot see a click that stops working, so this was also driven in the
browser against the production build: the engine reached through the React fiber
tree, `capture_pen_hit` compared against the old two-read path across five
probes (all agreeing, including a rectangle-over-path miss), then a real click on
a rendered path — pen overlay 0 → 3 anchor handles, baked path hidden, no console
errors.

**Gates.** 461 JS tests, 143 Rust tests (up from 138), `tsc` clean, eslint 0
errors, `cargo fmt --check` + `clippy -D warnings` clean, app + marketing builds
clean. `build:wasm` run before the app build; wasm 753,713 → 773,763 B.

## v7.95 Change Summary — 2026-08-10

ADR-024 Stage 3.5, batch a7 continued — the OpenRaster captures. No
user-visible change.

| # | Change | Status |
|---|--------|--------|
| 1 | `capture_layer_stack()` — the layer stack and its canvas, no pixels touched | **Added** |
| 2 | `openraster/export.ts`'s two captures, 7 reads → 2 calls | **Converted** |
| 3 | Stage 3.5 gate | **92 → 87** |
| 4 | `capture_ui_state()` composites the whole document to answer one field | **Found** |
| 5 | `exportOra`'s `await`-in-the-middle | **Still open, deliberately** |

**#1/#2 — the two captures.**

| Site | Reads | Becomes |
|---|---|---|
| `exportOra` | `layer_count` + `width` + `height` + `get_layers` | one `capture_layer_stack()` |
| `flattenAllLayersInPlace` | `active_layer_id` + `layer_count` + `get_layers` | one `capture_layer_stack()` |

The first four become one `stack.xml`, so they have to describe one document.
Converted individually behind the worker, a resize landing between them writes a
canvas size from before it beside a layer list from after — into a file the user
keeps on disk, with nothing thrown at the time. The second three pick the layers
to visit and the layer to restore afterwards; split, the "original" active layer
could be one the list no longer contains, and the restore would leave the
document on the wrong layer silently.

**#4 — why this is not `capture_ui_state()`, which would have needed no new
engine code at all.** Every field both sites want is already on
`UiStateCapture`. The reason to add a method rather than reuse it is cost, not
naming:

```rust
pub fn has_transparency(&self) -> bool {
    self.get_image_data().chunks_exact(4).any(|px| px[3] < 255)
}
```

`get_image_data()` is `composite_layers(...)` — a **full composite of the
document, built from scratch and allocated**, then scanned pixel by pixel. That
is the correct price for the call that feeds React's render. It is pure waste for
a caller that wants five scalars and a metadata string, and an `.ora` export
already encodes every layer separately. `capture_layer_stack()` touches no pixels
at all: every field is a struct read or a small string build.

Worth noting on its own: this means **every `syncState()` composites the whole
document and scans it** to answer `has_transparency`. That is pre-existing —
`syncState` read the same getter before a5 folded it into the capture — so it is
not a regression, but it is a real per-edit cost hiding behind a boolean, and it
is now written down.

**#5 — what this deliberately does NOT fix.** `exportOra` still separates these
reads from `get_layer_png(i)` and `export_png()` with a real `await
import("jszip")`, and `flattenAllLayersInPlace` still mutates the live document
mid-export. Both are pre-existing, both are already triaged in ADR-024, and both
remain open. Closing them needs a single capture that carries the layer PNGs too
— a design decision about what the engine owns, not a conversion. The boundary
is the same discipline as v7.88, where the thumbnail triple was converted and the
rest of the file deliberately was not.

**Verification.** Five Rust tests. Mutation tested: **6 mutants, all 6 killed**,
including `layer_count` → `content_layer_count`, which is the one that matters —
`content_layer_count` excludes the artboard Canvas (ADR-016), so an `.ora` built
on it would silently drop a layer from the archive.

That mutant survived the first run, and so did three others, but **the survivors
were a broken harness rather than weak tests**: the anchors being patched
(`width: self.width(),` and friends) appear in `capture_composite` and
`capture_ui_state` earlier in the file, so a first-occurrence replace was
mutating a different method than the one under test. Scoped to the function body,
5 of 6 died immediately. `content_layer_count` was the one real gap — the fixture
had no Canvas layer, so the two counts were equal and nothing could tell them
apart. The test now builds an artboard document where they genuinely differ.

Driven in the browser against the production build, on a real Canvas + Photo
document (`layer_count` 2, `content_layer_count` 1 — the exact case the mutant
covers): `capture_layer_stack` agreed with all five getters it replaces, a real
`.ora` export produced a valid archive — ZIP magic, `mimetype` first and stored
as `image/openraster`, `stack.xml` carrying `w="1445" h="2128"` matching the
engine, **both** `data/layer0.png` and `data/layer1.png` present, `mergedimage.png`
and the thumbnail — and the document was byte-identical afterwards (layers,
active layer and undo count all unchanged). No console errors.

**Gates.** 461 JS tests, 148 Rust tests (up from 143), `tsc` clean, eslint 0
errors, `cargo fmt --check` + `clippy -D warnings` clean, app + marketing builds
clean. `build:wasm` run before the app build; wasm 773,763 → 775,209 B.

## v7.96 Change Summary — 2026-08-10

The first user-facing win found by the ADR-024 migration that is not itself a
migration step — same family as the 3.45x exclude-background fix (v7.88).

| # | Change | Status |
|---|--------|--------|
| 1 | `has_transparency` removed from `UiStateCapture` | **Removed** |
| 2 | `syncState()` on a 1385x2068 document | **30.9 ms → 0.0 ms** |
| 3 | `has_transparency()` as an `ImageHorseTool` method | **Kept** |
| 4 | Stage 3.5 gate | **87, unchanged** |
| 5 | `LayerStackCapture`'s v7.95 justification | **Revised — it was made stale by this** |

**#1/#2 — what it cost and why.**

```rust
pub fn has_transparency(&self) -> bool {
    self.get_image_data().chunks_exact(4).any(|px| px[3] < 255)
}
```

`get_image_data()` is `composite_layers(...)`, so it builds a full-document RGBA
buffer from scratch before the scan starts — `.any()`'s early exit saves nothing,
because the composite already happened. `capture_ui_state()` called it, and
`syncState` calls `capture_ui_state()` after essentially every mutation.

Measured in the browser against the production build, same document both sides:

| Call | Before | After |
|---|---|---|
| `syncState()` | 30.9 ms | **0.0 ms** |
| `capture_ui_state()` | 29.1 ms | **0.0 ms** |
| `has_transparency()` alone | 29.8 ms | (unchanged — still callable) |
| The other ten fields combined | 0.0 ms | 0.0 ms |

It is not per-frame — `usePaintTool` syncs at stroke END — so this was a ~30 ms
hitch when you lifted the brush, finished a layer operation or hit undo.

**Nothing consumed it.** `CanvasArea` was its only reader and stopped gating on
it in `5e46921` (2026-06-27), when the transparency checkerboard became
unconditional CSS. The reader was deleted; this producer was left computing a
discarded boolean for six weeks. Confirmed three ways: no reference anywhere in
`app/src`, zero call sites in `scripts/engine-call-audit.mjs`, and a control test
that removed the React field outright and passed `tsc`, 461 tests, eslint and the
production build untouched.

**#3 — removed from the capture, not from the engine.** `has_transparency()` is
still a public method and is now documented as expensive. The capability was
never the problem; paying for it on every sync was. A future consumer calls it
deliberately — and if it ever needs to be cheap, that is the moment to design a
cached-and-invalidated flag, with a real consumer to define what correct means.
Designing that cache now would have been inventing an invalidation contract for
nobody.

**#5 — a justification this release made false, and did not leave standing.**
v7.95 added `capture_layer_stack()` one day earlier, and its stated reason was
that `capture_ui_state()` composited. That is no longer true. The doc comment now
says so explicitly and gives the weaker reasons that survive — `capture_ui_state`
still builds `history_labels` over the whole undo stack, `layer_count` is not on
it, and the export path should not be shaped by the render capture — plus an
explicit note that folding the two together later is a defensible call, provided
it is made deliberately. A rationale that has stopped being true is worse than no
rationale, because the next reader trusts it.

**Gates.** 461 JS tests, 148 Rust tests, `tsc` clean, eslint 0 errors,
`cargo fmt --check` + `clippy -D warnings` clean, app + marketing builds clean.
Stage 3.5 gate unchanged at 87 — `has_transparency` was never a JS call site.
wasm 775,209 → 774,688 B.

**Verified in the browser** on the production build: `capture_ui_state()` returns
exactly ten fields with `has_transparency` absent, `has_transparency()` is still
callable, the canvas renders, the checkerboard is intact, and the
syncState → React loop still drives the UI (zoom click → engine 1.1 → React 1.1
→ label "110%"). No console errors.

## v7.97 Change Summary — 2026-08-10

ADR-024 Stage 3.5, a8 scoping. **No product code changed** — this corrects the
instrument, not the app. Gate 87 → 81, and none of that is work done.

| # | Change | Status |
|---|--------|--------|
| 1 | Six live per-mouse-move sites were queued as ordinary a8 work | **Reclassified** |
| 2 | Hot-path detection now uses the enclosing function name | **Fixed** |
| 3 | The ordinary/hot split, pinned in both directions | **2 tests added** |
| 4 | The hot bucket's own false positives | **Found, NOT fixed — needs a scoping call** |

**#1/#2 — three failures at once.** Hot-path detection was
`HOT_FILE && HOT_CTX`: a hand-maintained file allowlist AND a keyword inside a
±6-line text window. Every one of these was a live per-move site sitting where
the next a8 batch would have added an `await` to it:

| Site | Handler | Why it was missed |
|---|---|---|
| `AppShell.tsx:1374` `effect_move` | `blurMove()` | `AppShell` is not on the file allowlist — even though the line itself calls `flushToCanvas`, which the keyword list matches |
| `useColorPicker.ts:70` `get_pixel_region` | `onMouseMove()` | the keyword list knows `pointermove`, not `mousemove` |
| `useTextTool.ts:704` `text_annotation_at` | `onCanvasHover()` | same |
| `useSelectionActions.ts:130` `lasso_active` | `handleLassoMove()` | the window cannot see the handler it is inside |
| `usePaintTool.ts:138` `mask_paint_move` | `onMouseMove()` | same |
| `usePaintTool.ts:140` `erase_move` | `onMouseMove()` | same |

The third cause is the interesting one, because it split **one function across
two categories, twice**. In `handleLassoMove`, `lasso_active` (line 130) was
ordinary and `lasso_path_to` (line 132) was hot — two lines apart, same handler.
The only thing that made 132 hot is the substring **"preview"** inside
`setLassoPreview`. `usePaintTool.onMouseMove` does it again: one ternary,
three engine calls, and only `paint_move` (line 141) was classified hot.

Meanwhile the comment three lines above `handleLassoMove` reads *"recomputed on
every mouse-move … inside a frame budget"* — the one definitive piece of
evidence, and unreadable by that test because comments are blanked first.

The fix classifies by the **enclosing function's name**, taken from the AST the
audit already parses for the async/consumed axes. It matches the **trailing**
camelCase segment only, and both narrower choices were forced by a false
positive rather than guessed:

| Rule tried | Rejected because |
|---|---|
| substring `/move/i` | matches `removeLayer`, `removeShape`, `remove_layer` |
| any segment | pulls in `moveLayer` — a discrete layers-panel reorder, already converted, where `move` is the leading VERB |
| **trailing segment** | kept: hot handlers end in the event noun (`blurMove`, `onMouseMove`, `onCanvasHover`) |

The keyword-window test is kept as a second, independent signal — neither is a
superset of the other, and an inline or oddly-named handler still needs it.

**#3 — pinned in both directions.** Two contract tests: no remaining site sits
in a handler whose name ends in a hot word, and no discrete action (`moveLayer`
as the canary) is dragged into the hot queue by a loose match. Mutation tested:
**4 mutants, all 4 killed** — reverting to the old classifier, loosening to
any-segment, disabling the name test, and switching to substring matching.

**#4 — the mirror problem, reported rather than fixed.** The same window-based
rule produced false positives in the other direction, and they were already
there:

| Hot bucket (32 sites) | Count |
|---|---|
| Genuinely per-move/hover by name | **11** |
| Discrete actions inherited from `HOT_FILE && HOT_CTX` | **21** |

`onMouseDown`, `onMouseUp`, `commit`, `cancel`, `applyCrop`, `dropPin`,
`handleDeleteSelection`, `selectShape` are once-per-gesture, not frame paths.
So a10 is much smaller than its headline and a8's real ordinary work is larger
than 81. Not corrected here on purpose: that direction moves sites **into** the
gate, raising the number, and each needs a per-site judgment rather than a
regex. It is a scoping decision, not a bug fix.

**Gates.** 463 JS tests (up from 461), 148 Rust tests, `tsc` clean, eslint 0
errors, app + marketing builds clean. Engine untouched, no `build:wasm` needed —
no Rust changed and no product code changed.
