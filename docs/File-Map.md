# File Map

> Part of the [Image Horse](../README.md) docs. See also: [Architecture](Architecture.md) · [Change Summary](Change-summary.md).

## Rust Module Map

```
src/
├── lib.rs          #[wasm_bindgen] coordinator (v0.9.34: the former ~4,760-line god-object was
│                   split into the focused modules below — behaviour-identical, identical WASM API).
│                   Holds the ImageHorseTool struct + all fields; constructor/dimensions;
│                   load_image / get_image_data / has_transparency / data_ptr / data_len;
│                   calculate_histogram; zoom; history wrappers (undo/redo/jump, snapshot
│                   inject/labels, make_snapshot/snap/restore_snapshot); clone-stamp setters +
│                   begin/continue/end_stroke; export_png / thumbnail; flip/rotate/crop/copy/paste/
│                   resize_with_filter; adjust_brightness/contrast; stamp_pixels / stamp_red /
│                   commit_text / measure_text / commit_red_stamp; get_pixel / get_pixel_region;
│                   stateless free fns composite_pixels, resize_pixels, resize_pixels_filter
│                   (stateless filtered resize: nearest/bilinear/Catmull/Lanczos), encode_png_pixels,
│                   blank_png (solid/transparent RGBA fill → PNG), parse_color, photo_limit,
│                   grid_lines, web_perf_metrics (PSI-faithful score). A #[wasm_bindgen(start)]
│                   installs console_error_panic_hook; the hot pixel loops delegate to src/simd/
├── layer.rs        Layer type + composite/render pipeline (render_layer, blend_over,
│                   composite_layers(_into) — visible layers source-over by opacity into a reusable
│                   cache, single-opaque-layer fast path — composite_drop_shadow, build_annotation_tile)
│                   and the layer CRUD/mask/merge impl: add / duplicate / remove / set_active / move /
│                   merge_down / flatten_all / visibility / opacity / rename / get_layers / recomposite;
│                   add/remove/apply/invert/has_layer_mask; move_preview + translate_active_layer;
│                   layer persistence get_layer_png / get_layer_*_annotations + begin/push_restored_layer/finish
├── annotations.rs  Live (non-destructive) overlays: TextAnnotation + ShapeAnnotation types,
│                   build_text_annotation, JSON (de)serialise, render_shape_into / render_pin, and the
│                   text + shape CRUD impls (add/update/remove/get/at/restore, draw_arrow / draw_shape,
│                   align_annotation, bézier + polyline + pin, set_editing_*, render_with_annotations,
│                   flatten_text_annotations)
├── paint.rs        Paint / brush engine — the paint / erase / mask / stabiliser stroke state machine
│                   (paint_begin, accumulate_dab, recomposite_stroke_bbox, paint_dab/stroke_to/down/
│                   move/up, erase_*, mask_paint_*, paint_stab_*)
├── effects.rs      Effects brush — Gaussian blur, pixelate, redaction strokes (blur_region,
│                   pixelate_region, redact_region, begin_*_stroke, effect_down/move/up, apply_effect_dab)
├── selection.rs    Magic-wand flood fill + marching-ants overlay (magic_wand_select, select_all,
│                   selection_overlay(_rgba), has/clear/delete_selection)
├── core.rs         ImageBuffer — width, height, data, load, bilinear sampling (now #[derive(Clone)]
│                   so layers + history snapshots clone cheaply); zero-size guard returns [0,0,0,0]
├── history.rs      Snapshot now captures the FULL layer stack (Vec<Layer> + active index + dims),
│                   so add/delete/reorder/merge undo alongside pixel edits; VecDeque undo + redo,
│                   push / undo / redo / delete / labels; pub const MAX_HISTORY = 50 (jump_to is
│                   driven from lib.rs as a undo/redo loop)
├── stamp.rs        Clone stamp engine — source, offset, stroke lifecycle, dab kernel;
│                   begin_stroke takes a pre-built full-stack Snapshot (held until end_stroke);
│                   stroke_src_data frozen buffer prevents feedback artifacts;
│                   apply_dab f32 hot loop with sqrt hoisted out of the hard zone
├── transform.rs    Flip H/V (u32 swap), rotate 90° CW/CCW, resize (bilinear / Catmull-Rom /
│                   Lanczos3 / nearest — separable two-pass, minification-aware kernels);
│                   copy_region, paste_region (opaque-source memcpy fast path + f32 blend),
│                   crop overlay compositing, dashed border drawing
├── filters.rs      Brightness, contrast, Gaussian blur (separable 2-pass, bounding-box region;
│                   cached kernel keyed on intensity + f32 accumulators)
├── drawing.rs      Arrow rendering (anti-aliased, arrowhead), geometric shapes (rect, circle, line,
│                   hand-drawn circle); fill_rounded_rect + fill_triangle_public for speech bubbles;
│                   Bézier pen paths — flatten_cubic_path (de Casteljau) strokes the curve via
│                   draw_polyline, fill_polygon (scanline even-odd) backs the optional path background
├── text.rs         Liberation Sans font embedded at compile time (subset to Latin-1 + Extended-A
│                   for a 60% WASM size cut); renders text → pixel buffer; rotate_pixels for
│                   annotation tiles
├── codec.rs        PNG encoding, thumbnail generation with bilinear scaling;
│                   history snapshot serialization (get/inject undo/redo PNG blobs)
├── utils.rs        Shared leaf helpers — json_escape, flat_to_points, points_bbox,
│                   point_segment_distance, pin_label, ink_bounds
├── settings.rs     Engine-settings policy — defaults, bounds + clamping for runtime knobs the
│                   JS side persists in localStorage. Undo depth (DEFAULT/MIN/MAX_MAX_HISTORY,
│                   clamp_max_history) + the 512 MB undo-history byte ceiling (snapshots are
│                   full-stack deep copies, so a step-count cap alone can balloon to GBs)
└── simd/           Explicit WASM SIMD128 kernels (v0.9.36) — each with a bit-identical scalar
                    fallback, compile-time dispatched via cfg(target_feature="simd128") so the
                    native `cargo test` build exercises the scalar path. Measured vs scalar:
                    resize bilinear 1.60×, Lanczos3 3.90×, Catmull-Rom 3.65×
    ├── mod.rs      Module doc + `pub mod` re-exports; gates the SIMD-only pixel helpers
    ├── pixel.rs    Shared per-pixel load_px / store_px v128 intrinsics (SIMD build only)
    ├── blur.rs     Separable Gaussian blur passes (back filters::gaussian_blur_region)
    ├── color.rs    Brightness, contrast, pixelate cell-sums, mask invert
    └── resize.rs   Bilinear + the separable filtered-resize passes (Lanczos3 / Catmull-Rom)
```

## Frontend Structure

```
app/src/
├── main.tsx                          Entry point
├── styles.css                        Design tokens + component styles
├── app/
│   ├── App.tsx                       Root
│   ├── AppShell.tsx                  Master orchestrator — state, panels, WASM bridge; layer-panel
│   │                                 handlers; Ctrl/Cmd+V pastes a clipboard image into the active
│   │                                 layer (guarded against the upload dialog's paste path)
│   └── useKeyboardShortcuts.ts       Centralized keyboard handler — panel toggles (Alt+U Upload,
│                                     Alt+T Tools, Alt+G Gallery, Alt+R Review), transforms (Alt+F/V
│                                     flip, Alt+S rotate), zoom, export. Enter always activates a
│                                     focused control; Space only defers to one when it's
│                                     :focus-visible (keyboard focus) so a mouse-clicked tool button
│                                     doesn't swallow Space-to-pan
├── hooks/
│   ├── useCloneStamp.ts              React hook wrapping the WASM ImageHorseTool; includes
│   │                                 loadImage(), loadImageFromPixels() (pre-decoded, 2048-capped),
│   │                                 and loadFromSaved() (rebuilds the layer stack before injecting
│   │                                 history). Flush calls recomposite() then a zero-copy blit of
│   │                                 the composite cache. Mirrors get_layers() into hook state and
│   │                                 exposes layer wrappers: addLayer / duplicateLayer / removeLayer /
│   │                                 setActiveLayer / setLayerVisible / setLayerOpacity / renameLayer /
│   │                                 moveLayer / mergeDown / flattenAll
│   ├── useBrushPreview.ts            Cursor preview overlay
│   ├── useDrawingTools.ts            Arrow + shape annotations (live, non-destructive) and the
│   │                                 crop selection (SVG overlay). Shapes/arrows are committed
│   │                                 as ShapeAnnotation records via add_shape_annotation; the
│   │                                 same hook handles select-on-click (shape_annotation_at),
│   │                                 drag-to-move, edge/corner resize handles, and
│   │                                 click-to-delete from the Reselect panel
│   ├── useEmojiTool.ts               Emoji stamp — OffscreenCanvas → WASM stamp_pixels
│   ├── usePaintTool.ts               Freehand paint/brush — WASM paint_dab + paint_stroke_to;
│   │                                 brushColor parsed once per stroke via useMemo + parse_color
│   ├── useColorPicker.ts             Color picker eyedropper — WASM get_pixel / get_pixel_region;
│   │                                 returns magnifier pixel grid + center hex color on mouse move
│   ├── useTextTool.ts                Live text annotations — Rust add/update/remove + hit-test;
│   │                                 click an existing text to re-open the input pre-filled with
│   │                                 its content, font, color, and rotation; sticky-input listener
│   │                                 so the box survives color-swatch / font-dropdown clicks
│   ├── useRedStampTool.ts            Red stamp presets — OffscreenCanvas renders label →
│   │                                 WASM stamp_red (scales to brush size, "Red Stamp" history)
│   ├── useAutoCompress.ts            Auto-compress hook for resize workflow
│   ├── useEditPersistence.ts         Per-photo edit persistence — Convex (signed in) or IDB
│   │                                 (anonymous). Archive v5 serializes the full layer stack
│   │                                 (per layer: pixel PNG, name, visibility, opacity, and its own
│   │                                 text + shape overlays) plus the active layer id; reopening a
│   │                                 photo rebuilds the stack. v1–v4 archives still decode and
│   │                                 collapse to a single layer for back-compat. duplicatePhotoEdit
│   │                                 copies a photo's archive onto a new id (gallery Duplicate)
│   ├── useUserColors.ts              localStorage-persisted custom palette shared by every
│   │                                 ColorSwatchGrid; cross-component sync via custom events
│   └── stamp_tool.d.ts               TypeScript declarations for WASM interface
├── components/
│   ├── TopBar/                       Zoom, panel toggles, export dropdown, delete all
│   ├── StatusBar/                    Source status, rotating shortcut hints, dimensions, zoom %, and a
│   │                                 blank TinyButton whose 3 clicks unlock the Dev Tools (diagnostics
│   │                                 log + tier selector) in production builds
│   ├── TabGroup.tsx                  Reusable tab switcher (Stamp, Effects, Brush, future panels)
│   ├── MagnifierOverlay.tsx          Floating 11×11 pixel magnifier for color picker eyedropper;
│   │                                 pixel grid sourced from WASM get_pixel_region, center hex shown
│   ├── UserMenu.tsx                  Convex/Clerk user menu
│   ├── ConvexClerkProvider.tsx       Auth provider wrapper
│   └── ShortcutModal.tsx             Alt+/ keyboard reference overlay — two columns per header;
│                                     Tools=Alt+T, Review=Alt+R, Rotate=Alt+S; appends a "Dev Tools"
│                                     section (Diagnostics Log, user/tier selector) once unlocked
├── features/
│   ├── canvas/
│   │   ├── CanvasArea.tsx            WASM canvas + brush cursor + SVG overlays — crop selection
│   │   │                             (rule-of-thirds, 8 resize handles), text edit overlay with
│   │   │                             line-and-dot move/rotate handles + corner squares that scale
│   │   │                             fontSize, and shape/arrow edit overlay with corner squares,
│   │   │                             move handle, endpoint circles for lines/arrows. The text
│   │   │                             overlay rotates around the Rust tile's pivot (via measure_text)
│   │   │                             so committed text matches the preview
│   │   ├── PenOverlay.tsx            Bézier pen overlay (Paint→Pen): click to drop corner anchors,
│   │   │                             drag to pull smooth handles, grab any anchor/handle to reshape;
│   │   │                             click a committed path to re-open it for editing. Commits as a
│   │   │                             kind-7 ShapeAnnotation (cubic control sequence) with optional
│   │   │                             solid fill; sits below the chrome (z-29) so panels stay clickable
│   │   ├── CompareSlider.tsx         Squoosh-style A/B before/after slider; rAF-deduped box sync
│   │   │                             driven by ResizeObserver + MutationObserver on canvas style
│   │   │                             so the overlay tracks zoom and pan transforms
│   │   └── ReviewPanel.tsx          Animated right-side "Review" panel (was HistoryPanel).
│   │                                 Header toggle group opens up to three stacked sections —
│   │                                 History, Reselect, Layers — that split the body evenly
│   │                                 (1 full / 2 halves / 3 thirds), each with its own header,
│   │                                 count box, and scroll area. History = undo/redo timeline
│   │                                 with an inline Undo button; Reselect = every live text +
│   │                                 shape annotation as a click-to-select / delete row;
│   │                                 Layers = working stack list (top→bottom): visibility toggle,
│   │                                 inline rename, reorder, duplicate, merge-down, delete, and a
│   │                                 per-layer opacity slider — tier-gated (locked for demo). Count
│   │                                 box shows the live layer count; the per-tier limit is in its
│   │                                 tooltip. Row controls use the xs TinyButton variant
│   ├── gallery/
│   │   ├── GalleryBar.tsx            Bottom photo strip with thumbnails; selection row adds a
│   │   │                             Duplicate button (content-addressed copy) beside Export /
│   │   │                             Delete Selected; header count reads "N of N — cap max" /
│   │   │                             "Selected: n of N" with an (i) tier-limit tooltip from TIERS
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
│   │       │                         Blur Brush (radius, intensity) + Pen (Bézier vector paths:
│   │       │                         stroke width/color + optional solid background fill)
│   │       └── TextSettings.tsx      Font family (12 browser-safe fonts), size, weight, color;
│   │                                 up to 8 recent texts (click to re-open canvas box at last
│   │                                 position, restoring all settings including font)
│   └── upload/
│       └── UploadDialog.tsx          Drag-and-drop + paste-from-clipboard upload modal. Actions:
│                                     Browse / Paste / Sample Images / Blank Canvas, with a dotted
│                                     drop zone that highlights on drag and a top-left sign-in icon.
│                                     Blank Canvas swaps in a New Document panel (size fields, page-size
│                                     presets, White/Black/hex/Transparent bg) → Rust blank_png;
│                                     swap animated via the panelSwap variant
└── lib/
    ├── types.ts                      Shared type definitions
    ├── animations.ts                 Framer Motion variants — springs, slides, fadeIn, and panelSwap
    │                                 (the upload-actions ⇄ Blank Canvas cross-fade)
    ├── defaultToolSettings.ts        Default tool settings
    ├── colors.ts                     Color utility helpers
    ├── editPersistence.ts            Per-photo edit persistence via IndexedDB — saves full canvas
    │                                 state + undo/redo history (PNG-encoded) plus the layer stack
    │                                 (collectLayers reads pixels + per-layer overlays out of WASM;
    │                                 SavedEdit gained layers[] + activeLayerId); copyPhotoEdit clones
    │                                 a photo's archive to a new id (gallery Duplicate)
    ├── originalsStore.ts             Content-addressed IndexedDB store for original photo bytes;
    │                                 keyed by SHA-256 hex via crypto.subtle; putOriginal /
    │                                 getOriginal / getOriginalAsBlobUrl / deleteOriginal
    ├── workingCopy.ts                makeWorkingCopy() — decodes + downscales to ≤2048px long edge
    │                                 via createImageBitmap; makeThumbnailFromPixels() builds the
    │                                 256px WebP thumb from those already-decoded pixels (Rust
    │                                 resize_pixels) so uploads decode once, not twice. makeThumbnail()
    │                                 (file → thumb) stays for the compress / batch paths
    └── utils.ts                      cn() utility
```
