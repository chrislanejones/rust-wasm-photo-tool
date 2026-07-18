// GENERATED — do not edit. Run: node marketing/scripts/gen-trail-data.mjs
//
// The feature list, from docs/Features.md — the repo's own canonical list.
// 40 features across 2 groups.

export interface Feature {
  name: string;
  body: string;
}

export interface FeatureGroup {
  name: string;
  items: Feature[];
}

export const FEATURES: FeatureGroup[] = [
  {
    name: "Image Processing (Rust/WASM)",
    items: [
      { name: "Clone Stamp", body: "Alt+Click source, paint to clone with adjustable size, hardness, opacity, spacing" },
      { name: "Red Stamps", body: "REJECTED / APPROVED / DRAFT / CONFIDENTIAL / UNDER REVIEW presets; JS renders label to OffscreenCanvas, Rust scales to brush size via bilinear resize and composites with \"Red Stamp\" history entry" },
      { name: "Edit & Move (Crop · Transform · Align · Select)", body: "the crop/transform tool, renamed. Crop: interactive SVG overlay with rule-of-thirds guides and 8 draggable resize handles, committed through Rust. Transform: flip horizontal/vertical, rotate 90° CW/CCW. Align: six buttons snap a selected text/shape's bounding box to any canvas edge or center, computed in Rust (align_annotation) as a single undo step. Selection Marker (above Align): a magic-wand flood-select — click a region to select pixels within a colour tolerance and delete them; the flood-fill, mask, and delete are all Rust (magic_wand_select / delete_selection), with Alt+A select-all and Alt+D deselect" },
      { name: "Text Shadow", body: "soft drop shadow on the text glyphs and/or the background box (Text → Background → Drop Shadow): shared colour / opacity / offset / blur, rendered in Rust (offset + box-blurred silhouette, tile grown to fit so Align sees it) and persisted with the edit" },
      { name: "Security tab", body: "EXIF keep/strip moved out of Compress into Settings → Security as a saved preference (applies to every export path); GPS / capture-time / lens stays or goes by your choice" },
      { name: "Responsive / snapped windows", body: "one shared useBreakpoint hook: below ~1000px the top bar goes icon-only, below ~900px the side panels float as overlay drawers (scrim, one at a time) instead of crushing the canvas, below ~600px a \"wider window\" notice. Reduce Motion suppresses the layout slides" },
      { name: "Keyboard accessibility", body: "Skip-to-canvas link, landmark roles + labels (toolbar / panels / canvas), accessible names on the tool buttons, and Escape-to-close + role=\"dialog\" semantics on the modals; on top of the existing tool / number / Alt shortcuts" },
      { name: "Resize", body: "Bilinear-scaled resize fully in WASM; no canvas round-trip" },
      { name: "Levels", body: "Brightness (−100% to +100%), contrast (0% to 300%); each adjustment is a separate undo snapshot" },
      { name: "Histogram", body: "live RGB / Luma scope in the Review panel, computed in Rust (calculate_histogram) straight from the composite buffer — no per-frame offscreen-canvas sampling" },
      { name: "Fast integer compositing", body: "all alpha blending (blend_pixel, blend_over) uses integer source-over math instead of per-pixel float ÷255.0, verified identical to the old result within ±1" },
      { name: "Color Picker", body: "Eyedropper activates on Effects → Color Picker tab; hovering the canvas shows a floating 11×11 magnifier (sourced from Rust get_pixel_region); clicking picks the pixel color and sets it as both brush and text color" },
      { name: "Blur Brush", body: "Box-blur with stroke-based region masking; configurable radius and intensity; now lives in the Brush tool's \"Blur Brush\" tab" },
      { name: "Arrows", body: "Anti-aliased arrows with arrowhead (single or double), drawn directly on the pixel buffer; accessible from the Arrows sub-tab inside the Shapes tool" },
      { name: "Shapes", body: "Rectangles, circles, hand-drawn circles, and lines rendered in WASM; Shapes tool has a Shapes/Arrows tab switcher at the top" },
      { name: "Paint / Brush", body: "Freehand painting via WASM paint_dab + paint_stroke_to; configurable brush size, color, and opacity; tab-switched with Blur Brush and Pen in the same panel" },
      { name: "Pen (Vector Paths)", body: "Photoshop-style Bézier pen (Paint → Pen tab): click to drop corner anchors, click-drag to pull smooth curve handles, and grab any anchor or handle to reshape the path. Enter closes it, Esc finishes it open. An optional solid background fills the closed interior (Rust scanline polygon fill, under the stroke). Committed paths stay re-editable — click one to re-open its anchors/handles — and round-trip through history, photo-switch, reload, and cloud sync as a kind-7 ShapeAnnotation (cubic control sequence flattened with de Casteljau)" },
      { name: "Text", body: "Click-to-place text with configurable font family (12 browser-safe options), size, weight, and color; up to 8 recent texts that re-open the canvas text box at the last used position, restoring all text settings" },
      { name: "Emoji Stamp", body: "Browser renders emoji to OffscreenCanvas, pixels sent to WASM stamp_pixels() for alpha compositing; emoji picker lives in the Stamp tool's Emojis tab" },
      { name: "Export", body: "Lossless PNG via Rust encoder, JPEG/WebP/AVIF via browser" },
      { name: "Blank Canvas", body: "start a new document from the upload dialog: dimensions + a page-size preset (FHD / Square / Story / 4×6 / 5×7 / 8×10) and a White / Black / hex / Transparent background; the fill is generated in Rust (blank_png → codec::export_png) with no canvas round-trip" },
      { name: "Thumbnails", body: "256px WebP thumbnails built from the already-decoded working pixels via Rust resize_pixels (uploads decode once, not twice); working canvas stays at ≤2048px" },
      { name: "Copy/Paste Regions", body: "Cross-photo pixel compositing with alpha blending; paste from clipboard supported" },
      { name: "History", body: "50-step undo/redo with labeled snapshots (including dimensions for crop/resize/rotate correctness), jump-to, delete entry" },
      { name: "Per-photo Edit Persistence", body: "Switching photos saves the full WASM canvas + undo/redo stack to IndexedDB (PNG-encoded per snapshot). Switching back restores the exact edit session — same canvas state, same undo history, all redo steps intact" },
    ],
  },
  {
    name: "UI (React)",
    items: [
      { name: "Animated Panels", body: "Staggered entrance: TopBar → Sidebar → Gallery (Framer Motion springs)" },
      { name: "Tool Grid", body: "10 tools with gradient icons: Clone Stamp, Resize, Crop, Paint, Text, Arrows (FileText — coming soon), Shapes, Effects (Sparkles), Batch Image Editor (bulk logo stamp + grid mosaic view), Eraser (relabeled from AI)" },
      { name: "Tab Switchers", body: "Stamp (Clone / Stamps / Emojis), Shapes (Shapes / Arrows), Paint (Paint / Blur Brush / Pen), Effects (Levels / Color Picker) via shared TabGroup component" },
      { name: "Spacebar Pan", body: "Hold Space for grab-to-pan; all tool handlers bypassed during pan" },
      { name: "A/B Compare Slider", body: "Squoosh-style draggable divider; overlay is positioned exactly over the canvas bounding box (tracks zoom/pan via ResizeObserver) so before/after layers are always pixel-aligned" },
      { name: "Multi-photo Gallery", body: "Bottom strip with thumbnails, add/remove/switch/duplicate (content-addressed, zero-copy; carries edits); PgUp/PgDn cycling; multi-select with Export / Delete / Duplicate / Unselect; header count + per-tier limit (i) tooltip; originals preserved in IndexedDB at full resolution regardless of working-copy downscale" },
      { name: "Review Panel", body: "Right-side panel (Alt+H) with a header toggle group that opens up to three stacked sections sharing the body height (1 full / 2 halves / 3 thirds, each scrollable):" },
      { name: "Upload", body: "Drag-and-drop modal with file browser and paste-from-clipboard (Ctrl+V / paste button)" },
      { name: "Export Dropdown", body: "PNG, JPEG, WebP, AVIF format selector in the top bar" },
      { name: "Keyboard Shortcut Modal", body: "Alt+/ opens a full reference overlay grouped by category (two columns per group)" },
      { name: "Hidden Dev Tools", body: "three clicks on a blank status-bar button unlock the Diagnostics Log (Alt+Delete) and the user/tier selector (Alt+L) in production, and append a Dev Tools section to the Alt+/ modal" },
      { name: "Eraser Panel", body: "the AI tool relabeled (tool id ai unchanged for shortcut/persistence/routing): Brush Eraser (drag on canvas to scrub the active layer to transparent, local, free, no sign-in) plus three removal modes in one panel — Magic Eraser (local PatchMatch object removal, coming soon), Background Removal (rembg) and Object Removal (SD Inpaint), both Replicate-backed and Paid-tier. 4× Upscale moved to the Effects tool; OCR/text extraction moved to the Text tool; the old Smart Crop and Auto-Enhance placeholders were retired" },
      { name: "Light / Dark / System theme", body: "full light & dark palettes (warm earth-tone dark, warm-paper light) driven by CSS-variable tokens in styles.css (:root light, .dark dark, @custom-variant dark); \"System\" follows the OS via matchMedia and updates live. Pre-paint guard in index.html (no FOUC). Set in Settings → Appearance, persisted to localStorage + Convex. JetBrains Mono + DM Sans throughout" },
      { name: "Rulers & Grids", body: "toggleable top/left pixel rulers (tick labels track zoom) + a configurable non-destructive grid overlay: square px spacing, golden-ratio lines, or N×M divisions, with color + opacity. Set in Settings → Rulers & Grids, persisted. The grid-layout geometry is computed in Rust (grid_lines WASM export) as the single source, projected to an SVG overlay on the canvas" },
      { name: "State management (Zustand)", body: "the editor's UI, tool, and gallery state lives in three Zustand stores (useUIStore / useToolStore / useGalleryStore) instead of AppShell local state; components subscribe with atomic selectors for minimal re-renders, and durable prefs (last master-bar tab, tool sub-modes) persist to IndexedDB via a write-deduped StateStorage adapter. Behaviour-preserving groundwork for splitting AppShell into feature modules. See State Management" },
    ],
  },
];
