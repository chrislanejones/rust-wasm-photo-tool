/* The /features cards — hand-maintained, keyed by the GENERATED feature name.
 *
 * features.ts is regenerated from docs/Features.md and carries each feature's
 * name and its engineering line. It does not carry what the card grid needs on
 * top: which of eight "what are you trying to do" groups a feature sits in, a
 * shorter display name, a plain-language line for someone who has never heard
 * of WASM, and the engineering line trimmed to fit a card. Those came from the
 * Features v2 design and have no source in the repo docs, so they live here.
 *
 * The page iterates features.ts, not this file. So the count is always the
 * real one: a feature added to docs/Features.md without an entry here still
 * renders, in "Under the hood", with its own name and its full repo line. An
 * entry here whose key no longer matches a generated name renders nothing —
 * `unmatchedCardKeys` lists those so a rename in the docs is easy to spot.
 */

import { FEATURES } from "./features";

export type CardGroupKey =
  | "annotate"
  | "select"
  | "enhance"
  | "edit"
  | "layers"
  | "export"
  | "privacy"
  | "hood";

export interface CardGroup {
  key: CardGroupKey;
  name: string;
  /** The filter-tile label, where the full name is too long for a tile. */
  short: string;
  blurb: string;
}

export const CARD_GROUPS: CardGroup[] = [
  {
    key: "annotate",
    name: "Annotate",
    short: "Annotate",
    blurb:
      "Draw, write and stamp on a photo. Every mark is its own object until you flatten it, so you can move it, recolor it or undo it later.",
  },
  {
    key: "select",
    name: "Select & mask",
    short: "Select & mask",
    blurb:
      "Pick exactly the pixels you mean — by color, by edge, or by hand — and everything you do next stays inside the marching ants.",
  },
  {
    key: "enhance",
    name: "Enhance",
    short: "Enhance",
    blurb:
      "Make the photo look better and weigh less. Sliders, presets and levels preview live on your own picture.",
  },
  {
    key: "edit",
    name: "Edit & layout",
    short: "Edit & layout",
    blurb: "Crop, rotate, line things up, and compare before with after.",
  },
  {
    key: "layers",
    name: "Layers & history",
    short: "Layers & history",
    blurb:
      "Nothing is lost. Every step is in the history, every photo keeps its own session, and layers survive a reload.",
  },
  {
    key: "export",
    name: "Import, export & share",
    short: "Import & export",
    blurb: "Get photos in, get them out in the format you need, and share a link when you want to.",
  },
  {
    key: "privacy",
    name: "Privacy, sync & settings",
    short: "Privacy & sync",
    blurb:
      "Your photos stay in your browser. Only your settings travel — across tabs for everyone, across devices when you sign in.",
  },
  {
    key: "hood",
    name: "Under the hood",
    short: "Under the hood",
    blurb: "The plumbing that keeps the rest fast and consistent.",
  },
];

export interface CardCopy {
  group: CardGroupKey;
  /** Display name; the generated name is often longer. */
  title: string;
  plain: string;
  detail: string;
}

/** Keyed by the exact `name` in features.ts. Order within a group follows this
 *  object, which follows the design. */
export const CARD_COPY: Record<string, CardCopy> = {
  // ── Annotate ─────────────────────────────────────────────────────────
  "Paint / Brush": {
    group: "annotate",
    title: "Paint / Brush",
    plain: "Freehand painting with size, color and opacity.",
    detail: "WASM paint_dab + paint_stroke_to; Create → Brush, with Pen and Blur Brush as sibling sub-tools.",
  },
  "Pen (Vector Paths)": {
    group: "annotate",
    title: "Pen (Vector Paths)",
    plain:
      "Click for corners, drag for curves, and reshape any point afterwards. Optionally fill the inside.",
    detail:
      "Bézier pen; Enter closes, Esc finishes open. Committed paths stay editable and round-trip through history, reload and sync as a kind-7 ShapeAnnotation.",
  },
  Arrows: {
    group: "annotate",
    title: "Arrows",
    plain: "Clean arrows, single- or double-headed.",
    detail: "Anti-aliased, drawn directly on the pixel buffer; Create → Arrow.",
  },
  Shapes: {
    group: "annotate",
    title: "Shapes",
    plain: "Rectangles, circles and lines — firm, or hand-drawn with the Sloppiness slider.",
    detail: "Rendered in WASM; Create → Shapes, with Arrow and Pins as their own sub-tools.",
  },
  Text: {
    group: "annotate",
    title: "Text",
    plain:
      "Click to place text in a real typeface, size, weight and color. Your last 8 texts are one click away.",
    detail:
      "Liberation Sans, Serif and Mono (SIL OFL 1.1), regular and bold, handed to the engine at runtime (register_font).",
  },
  "Text Shadow": {
    group: "annotate",
    title: "Text Shadow",
    plain: "A soft drop shadow behind the words, the box, or both.",
    detail:
      "Shared color / opacity / offset / blur; offset + box-blurred silhouette rendered in Rust, tile grown so Align sees it.",
  },
  "Emoji Stamp": {
    group: "annotate",
    title: "Emoji Stamp",
    plain: "Drop any emoji onto the photo.",
    detail:
      "Browser renders to OffscreenCanvas; pixels sent to WASM stamp_pixels() for alpha compositing.",
  },
  "Red Stamps": {
    group: "annotate",
    title: "Red Stamps",
    plain: "REJECTED, APPROVED, DRAFT, CONFIDENTIAL, UNDER REVIEW — one click each.",
    detail:
      'JS renders the label to OffscreenCanvas; Rust scales to brush size via bilinear resize and composites with a "Red Stamp" history entry.',
  },
  "Clone Stamp": {
    group: "annotate",
    title: "Clone Stamp",
    plain: "Alt-click a source, then paint it somewhere else.",
    detail: "Adjustable size, hardness, opacity, spacing.",
  },
  "Blur Brush": {
    group: "annotate",
    title: "Blur Brush",
    plain: "Blur just the part you paint over.",
    detail: "Box blur with stroke-based region masking; configurable radius and intensity.",
  },
  "Stroke Stabilizer, everywhere": {
    group: "annotate",
    title: "Stroke Stabilizer",
    plain: "Steadies a shaky hand on every brush — Off, Low, Medium or High.",
    detail:
      "One pulled-string leash (src/stabilizer.rs) shared by Paint, Eraser, blur, pixelate, redact and clone stamp; a move inside the leash costs zero recomposites.",
  },
  "Placement grid": {
    group: "annotate",
    title: "Placement grid",
    plain: "Snap a text or shape into any ninth of the canvas.",
    detail:
      "Nine-cell grid in the Text and Shapes panels; Rust centers the bounding box in the cell (align_annotation) as one undo step.",
  },
  "Directional duplicate pad": {
    group: "annotate",
    title: "Directional duplicate pad",
    plain:
      "Lay out repeated boxes: press an arrow and a same-sized copy lands beside the last one.",
    detail:
      "Rectangles and circles only; offsets from the shape's own box (lib/duplicatePadGeometry.ts), engine-side struct clone.",
  },
  "Duplicate from the Reselect row": {
    group: "annotate",
    title: "Duplicate from the Reselect row",
    plain: "Copy any placed text or shape — shadow, rotation and warp come along.",
    detail: "The engine clones the annotation struct; a test walks every field the engine emits.",
  },
  OCR: {
    group: "annotate",
    title: "OCR",
    plain: "Read the text out of an image.",
    detail: "Its own sub-tool, Create → OCR, rather than a mode inside the Text panel.",
  },

  // ── Select & mask ────────────────────────────────────────────────────
  "Select group": {
    group: "select",
    title: "Select group",
    plain:
      "Six ways to pick: magic wand, edge-aware wand, magnetic lasso, color range, rectangle and ellipse.",
    detail:
      "Flood-fill, mask and delete are Rust (magic_wand_select / delete_selection); Alt+A select all, Alt+D deselect.",
  },
  "Erasers and AI removal": {
    group: "select",
    title: "Erasers and AI removal",
    plain:
      "Erase to transparent, or paint over something and have it filled in — locally and free. Pro adds background and object removal.",
    detail:
      "Eraser and Magic Eraser (PatchMatch) run locally; Background Removal (rembg) and Object Removal (LaMa) run on Replicate.",
  },
  "Copy/Paste Regions": {
    group: "select",
    title: "Copy / Paste regions",
    plain: "Copy a region from one photo and paste it into another, or paste from your clipboard.",
    detail: "Cross-photo pixel compositing with alpha blending.",
  },
  "Color Picker": {
    group: "select",
    title: "Color Picker",
    plain: "Hover for a magnified look, click to pick a color for brush and text.",
    detail: "Edit → Color Picker; 11×11 magnifier sourced from Rust get_pixel_region.",
  },
  "Color picker history": {
    group: "select",
    title: "Color picker history",
    plain: "Recent picked colors, one click to reuse.",
    detail: "Per-session list under Edit → Color Picker; same list UI as guides.",
  },

  // ── Enhance ──────────────────────────────────────────────────────────
  Adjustments: {
    group: "enhance",
    title: "Adjustments",
    plain: "Brightness, contrast, saturation, shadows, highlights, blur and sharpen.",
    detail: "Enhance → Adjustments; each adjustment is its own undo snapshot.",
  },
  Levels: {
    group: "enhance",
    title: "Levels",
    plain: "Black point, white point and midtones against a live histogram.",
    detail:
      "Preview from a copy of the layer through a 256-entry LUT so moves never compound; Apply is one undo step (src/levels.rs).",
  },
  Presets: {
    group: "enhance",
    title: "Presets",
    plain: "Twelve one-click looks — hover to preview on your photo, click to keep.",
    detail:
      "Five numbers run through filters the engine already had (apply_stack in src/presets.rs). No hue control, so Warm and Cool are saturation looks.",
  },
  Histogram: {
    group: "enhance",
    title: "Histogram",
    plain: "A live RGB / luma scope while you work.",
    detail:
      "Computed in Rust (calculate_histogram) from the composite buffer — no offscreen-canvas sampling.",
  },
  "Resize & Compress": {
    group: "enhance",
    title: "Resize & Compress",
    plain: "One panel for dimensions, format and quality, with the page-speed scores on top.",
    detail:
      "Resampling fully in WASM; one Apply button named for what is pending. Dimensions-only re-saves in the photo's own format at full quality.",
  },
  "Perspective / Distort / Skew": {
    group: "enhance",
    title: "Perspective / Distort / Skew",
    plain:
      "Drag four corners to warp a shape, text or the photo itself — and the warped object stays editable.",
    detail:
      "Corners stored on the object as fractions of its box; homography and resampler in Rust (src/perspective.rs), drag rules in TypeScript.",
  },

  // ── Edit & layout ────────────────────────────────────────────────────
  "Edit group (Crop · Transform · Perspective · Color Picker · Layers · Canvas Size · Guides · Rulers and Grid)":
    {
      group: "edit",
      title: "Edit group",
      plain:
        "Crop, transform, canvas size, guides, rulers and grid — each its own tool with its own link.",
      detail:
        "Crop: SVG overlay with rule-of-thirds guides and 8 handles, committed through Rust. Transform: flip and rotate 90°.",
    },
  "Rulers & Grids": {
    group: "edit",
    title: "Rulers & Grids",
    plain: "Pixel rulers plus a grid overlay: square spacing, golden ratio, or N×M.",
    detail: "Geometry computed in Rust (grid_lines) as the single source, projected to an SVG overlay.",
  },
  "Blank Canvas": {
    group: "edit",
    title: "Blank Canvas",
    plain: "Start from nothing: a size preset and a white, black, hex or transparent background.",
    detail:
      "FHD / Square / Story / 4×6 / 5×7 / 8×10; the fill is generated in Rust (blank_png → codec::export_png).",
  },
  "Pan (H or Space)": {
    group: "edit",
    title: "Pan",
    plain: "Hold H or Space to move around; tap H to stay in pan mode.",
    detail: "All tool handlers bypassed during a pan; typing h in a text field does nothing.",
  },
  "A/B Compare Slider": {
    group: "edit",
    title: "A/B Compare",
    plain: "Drag a divider across the photo to see original versus edited, over any tool.",
    detail:
      "Overlay positioned exactly over the canvas box (ResizeObserver) so layers stay pixel-aligned; disabled in Batch.",
  },

  // ── Layers & history ─────────────────────────────────────────────────
  Layers: {
    group: "layers",
    title: "Layers",
    plain: "A real layer stack per photo — 8 layers, 16 on Pro. Move, mask, tint, reorder, flatten.",
    detail: "Lives in the Rust engine and is saved with the edit; Review → Layers and Edit → Layers.",
  },
  History: {
    group: "layers",
    title: "History",
    plain: "Undo and redo with labeled steps; jump to any point. 50 steps by default, up to 1000.",
    detail:
      "Snapshots include dimensions for crop/resize/rotate correctness; status bar shows Undo NN%.",
  },
  "Per-photo Edit Persistence": {
    group: "layers",
    title: "Per-photo edit persistence",
    plain: "Switch photos and come back to the exact same session, undo history included.",
    detail: "Full WASM canvas + undo/redo stack saved to IndexedDB, PNG-encoded per snapshot.",
  },
  "OpenRaster export and import": {
    group: "layers",
    title: "OpenRaster import & export",
    plain: "Save the whole project, every layer, to a file Krita and GIMP open.",
    detail: "Settings → Import / Export writes and reads .ora with the layer stack intact.",
  },
  Thumbnails: {
    group: "layers",
    title: "Thumbnails",
    plain: "Fast gallery thumbnails without decoding twice.",
    detail:
      "256px WebP via Rust resize_pixels from the already-decoded pixels; working canvas ≤2048px.",
  },

  // ── Import, export & share ───────────────────────────────────────────
  Upload: {
    group: "export",
    title: "Upload",
    plain: "Drag and drop, browse, or paste from the clipboard.",
    detail: "Modal with file browser and Ctrl+V / paste button.",
  },
  "Multi-photo Gallery": {
    group: "export",
    title: "Multi-photo gallery",
    plain: "Work on many photos at once: add, switch, duplicate, multi-select and export together.",
    detail:
      "Content-addressed, zero-copy duplicates carry edits; originals preserved at full resolution in IndexedDB.",
  },
  Export: {
    group: "export",
    title: "Export",
    plain: "Save the finished photo losslessly or compressed.",
    detail: "Lossless PNG via the Rust encoder; JPEG/WebP/AVIF via the browser.",
  },
  "Export Dropdown": {
    group: "export",
    title: "Export dropdown",
    plain: "Pick PNG, JPEG, WebP or AVIF right from the top bar.",
    detail: "Format selector in the top bar.",
  },
  "Share links, and Settings → Shared": {
    group: "export",
    title: "Share links",
    plain:
      "Share a link anyone can open. See how often it was viewed, and let it switch off after N views or on a date.",
    detail:
      "Export → Share link uploads a flattened PNG; Settings → Shared lists every link. Each opening is stored as a time only.",
  },
  "Security tab": {
    group: "export",
    title: "Security tab",
    plain: "Keep or strip location, time and lens data on every export — your choice, saved once.",
    detail:
      "EXIF keep/strip moved out of Compress into Settings → Security; applies to every export path.",
  },

  // ── Privacy, sync & settings ─────────────────────────────────────────
  "Settings sync — every tab, every signed-in device": {
    group: "privacy",
    title: "Settings sync",
    plain:
      "Change a setting in one tab and the others follow. Sign in and your phone follows too. Photos never travel.",
    detail:
      "BroadcastChannel across tabs; one reactive Convex query across devices; adopt / push / hold / idle as one pure function. See ADR-061.",
  },
  "Beta features": {
    group: "privacy",
    title: "Beta features",
    plain: "Try unfinished things early — or hand a friend a link that turns one on for them.",
    detail:
      "Settings → Beta; choices kept in this browser and never sent anywhere; ?beta=none clears them all.",
  },
  "Light / Dark / System theme": {
    group: "privacy",
    title: "Light / Dark / System theme",
    plain: "Warm dark, warm paper light, or follow the OS.",
    detail:
      "CSS-variable tokens, matchMedia for System, pre-paint guard in index.html (no FOUC).",
  },
  "Keyboard accessibility": {
    group: "privacy",
    title: "Keyboard accessibility",
    plain: "Skip to canvas, labeled landmarks, named tool buttons, Escape closes dialogs.",
    detail: "On top of the tool / number / Alt shortcuts.",
  },
  "Keyboard Shortcut Modal": {
    group: "privacy",
    title: "Keyboard shortcut sheet",
    plain: "Alt+/ shows every shortcut, grouped.",
    detail: "Full reference overlay, two columns per group.",
  },
  "Responsive / snapped windows": {
    group: "privacy",
    title: "Responsive windows",
    plain: "Panels float on narrow screens; phones get a view-and-gallery surface.",
    detail:
      "One useBreakpoint hook: icon-only bar below ~1000px, overlay drawers below ~900px, phone surface below ~600px.",
  },
  "Diagnostics Log": {
    group: "privacy",
    title: "Diagnostics log",
    plain: "A log of what the engine and storage are doing — in memory, never sent.",
    detail: "Alt+Delete; engine, IndexedDB, Convex, AI and console entries, up to 500.",
  },

  // ── Under the hood ───────────────────────────────────────────────────
  "Fast integer compositing": {
    group: "hood",
    title: "Fast integer compositing",
    plain: "Blending without floating point — verified within ±1 of the old result.",
    detail: "blend_pixel / blend_over use integer source-over math.",
  },
  "Five-group toolbar": {
    group: "hood",
    title: "Five-group toolbar",
    plain: "Enhance · Select · Create · Edit · Batch, owning 38 sub-tools from one registry.",
    detail:
      "features/tools/toolGroups.ts drives the rail, sub-tool row, digits 1–5, shortcut sheet, dispatch and cursor.",
  },
  "Sub-tool routing": {
    group: "hood",
    title: "Sub-tool routing",
    plain: "Every tool has its own address, so a link opens the exact tool.",
    detail:
      "#/create/brush, #/edit/color-picker; 35 older URL shapes redirect, each pinned by a test.",
  },
  "Sub-tool canvas dispatch": {
    group: "hood",
    title: "Sub-tool canvas dispatch",
    plain: "The lit sub-tool decides what a drag does and which cursor you get.",
    detail:
      "A sub-tool with no canvas gesture idles instead of inheriting the clone stamp's behavior.",
  },
  "Review Panel": {
    group: "hood",
    title: "Review panel",
    plain: "Up to three stacked sections sharing the right-hand panel.",
    detail: "Alt+R; 1 full / 2 halves / 3 thirds, each scrollable.",
  },
  "Animated Panels": {
    group: "hood",
    title: "Animated panels",
    plain: "Panels slide in on open, in order.",
    detail:
      "TopBar → Sidebar → Gallery, Framer Motion springs; Reduce Motion suppresses them.",
  },
  "State management (Zustand)": {
    group: "hood",
    title: "State management",
    plain: "Seven small stores instead of one big component.",
    detail:
      "Zustand: UI, tool, gallery, annotation, guides, perspective, text box; durable prefs to IndexedDB via a write-deduped adapter.",
  },
};

export interface Card {
  /** The generated name — also what the anchor id is slugged from, so the
   *  ⌘K palette's /features#<slug> deep links keep landing. */
  name: string;
  title: string;
  plain: string;
  detail: string;
}

export interface CardSection extends CardGroup {
  items: Card[];
}

const ORDER = Object.keys(CARD_COPY);

/** Every generated feature, placed in its card group. */
export const CARD_SECTIONS: CardSection[] = (() => {
  const all = FEATURES.flatMap((g) => g.items);
  const byGroup = new Map<CardGroupKey, Card[]>(CARD_GROUPS.map((g) => [g.key, []]));
  for (const f of all) {
    const copy = CARD_COPY[f.name];
    byGroup.get(copy?.group ?? "hood")!.push(
      copy
        ? { name: f.name, title: copy.title, plain: copy.plain, detail: copy.detail }
        : // No card copy yet: the repo line stands in for both.
          { name: f.name, title: f.name, plain: f.body, detail: "" },
    );
  }
  const rank = (n: string) => {
    const i = ORDER.indexOf(n);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return CARD_GROUPS.map((g) => ({
    ...g,
    items: byGroup.get(g.key)!.sort((a, b) => rank(a.name) - rank(b.name)),
  }));
})();

export const CARD_TOTAL = CARD_SECTIONS.reduce((n, g) => n + g.items.length, 0);

/** Card entries whose key no longer matches a generated feature name. */
export const unmatchedCardKeys = (): string[] => {
  const names = new Set(FEATURES.flatMap((g) => g.items.map((f) => f.name)));
  return ORDER.filter((k) => !names.has(k));
};
