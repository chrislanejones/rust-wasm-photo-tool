// ===== FILE: app/src/features/tools/toolGroups.ts =====
// THE FIVE-GROUP REGISTRY — the single definition site for the restructured
// toolbar: five top-level groups, each owning an exclusive set of sub-tools.
//
// Everything downstream DERIVES from this file and nothing hand-maintains a
// second copy:
//   • ToolGrid          — draws the five group tiles
//   • SubtoolRow        — draws the active group's sub-tools
//   • features/routing  — #/tool/<group>/<subtool> for all 33
//   • commandPalette    — one entry per group + one per sub-tool
//   • ShortcutModal     — the digits 1-5 table
//   • useEffectiveTool  — the per-group canvas dispatch
// The fourth-copy problem this replaces is real and recent: ShortcutModal used
// to keep its own hand-written tool list and silently omitted Select for three
// releases. Derived-or-nothing is the rule now.
//
// ─────────────────────────────────────────────────────────────────────────────
// LEGACY IDS ARE LOAD-BEARING AND ARE NOT RENAMED HERE.
// A sub-tool is a *view* onto an existing `(ToolType, mode)` pair. `compress`,
// `crop`, `arrow`, `ai`, `stamp` and `emoji` remain exactly what they were —
// persistence keys, `TOOL_BY_KEY`, the inbound route aliases and the whole of
// AppShell still speak them. This file adds a layer ABOVE that axis; it does
// not renumber it. Ids are renamed during a tool's own migration session and
// at no other time (CLAUDE.md).
//
// WHY SUB-TOOL IDENTITY IS ITS OWN FIELD, not derived from (tool, mode):
// 27 of the 33 sub-tools are uniquely identified by their (tool, mode) pair.
// The other six are not — Crop / Transform / Color Picker all resolve to
// `crop` with no mode, and Resize Layer / Canvas Size / Guides all resolve to
// `arrow` with no mode, because those two tools are single-mode tools whose
// panels hold several features apiece. Derive identity and those six tiles
// light up three-at-a-time. So each sub-tool carries its own stable id and the
// store tracks the active one. See docs/toolbar-migration-map.md § Design note.
import type { ToolType } from "@/lib/types";
import {
  ArrowUpRight,
  Bot,
  Brush,
  CircleDashed,
  Crop,
  Droplets,
  Eraser,
  FileArchive,
  FileEdit,
  FlipHorizontal,
  Frame,
  Grid2x2,
  ImagePlus,
  Lasso,
  Layers,
  PackageOpen,
  Palette,
  PenTool,
  Pin,
  Pipette,
  Ruler,
  Scaling,
  Scan,
  ScanEye,
  ScanText,
  Shapes,
  Smile,
  SquareDashed,
  SquareMousePointer,
  SquarePen,
  BadgeCheck,
  Stamp,
  SunDim,
  SwatchBook,
  Type,
  Wand2,
  Zap,
} from "lucide-react";

export type ToolGroupId = "enhance" | "select" | "create" | "edit" | "batch";

/** Controls a sub-tool preselects on activation, beyond its `(tool, mode)`.
 *
 *  Deliberately a tiny closed set rather than a general "run this side effect"
 *  escape hatch — every field here is a control the user could click by hand
 *  today, so activating the sub-tool stays behaviour-preserving rather than
 *  becoming a second, privileged way to drive the app. */
export interface SubToolPreselect {
  /** Edit › Color Picker. Exactly what the panel's existing toggle sets. */
  colorPicker?: boolean;
}

interface SubToolBase {
  /** Stable id, unique WITHIN its group. This is the URL segment:
   *  `#/tool/create/clone-stamp`. Never rename — links and bookmarks. */
  id: string;
  label: string;
  /** Second tooltip line — what this sub-tool actually does. The rail tiles
   *  have carried a description since before the restructure; the sub-tool
   *  tiles showed only their label, which made the widest group (Create, 13
   *  tiles) a wall of icons you had to click to identify. */
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Fuzzy-search terms for the command palette, beyond the label. */
  keywords: string[];
}

/** A sub-tool that resolves to something the app can actually do. */
export interface LiveSubTool extends SubToolBase {
  comingSoon?: false;
  /** Legacy tool id — load-bearing, see the file header. */
  tool: ToolType;
  /** Sub-mode within that tool, when it has one. Absent for single-mode tools
   *  (`effects`, `crop`, `arrow`). */
  mode?: string;
  preselect?: SubToolPreselect;
  /** CSS cursor while this sub-tool is active over the canvas. Omitted means
   *  the default arrow — correct for every sub-tool with NO canvas gesture
   *  (all of Enhance and Batch, plus Transform / Canvas Size / Guides), which
   *  is exactly the set that must also idle in dispatch. The cursor and the
   *  handlers are two views of the same fact, so they live on the same row.
   *
   *  Two cursors stay DYNAMIC and are resolved at the canvas rather than here,
   *  because they depend on live state a static table can't see: Select's
   *  add/subtract badge (Shift/Alt held) and Resize Layer's `move` (only while
   *  the Move toggle is on). */
  cursor?: string;
}

/** A sub-tool that is announced but not built. Renders disabled with a
 *  tooltip and is UNREACHABLE by route or palette — enforced by the type: it
 *  carries no `tool`, so there is nothing for a route or a dispatch case to
 *  resolve to, and the exhaustive checks downstream can't accidentally treat
 *  it as live. */
export interface ComingSoonSubTool extends SubToolBase {
  comingSoon: true;
  /** Shown in the disabled tile's tooltip. */
  note: string;
}

export type SubToolDefinition = LiveSubTool | ComingSoonSubTool;

export interface ToolGroupDefinition {
  id: ToolGroupId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  /** Digits 1-5, in rail order. Sub-tools are palette- and click-reachable
   *  only — there is no second digit axis, and no letter bindings were minted
   *  for them (the brief: "unless a binding is obvious", and none is). */
  shortcutKey: string;
  subTools: readonly SubToolDefinition[];
}

// ── Enhance ──────────────────────────────────────────────────────────────────
// Compress + Resize are the two existing `compress` sub-modes. Adjustments is
// the whole Effects panel. AI is the Replicate half of AISettings — the
// `brush`/`magic` half of that same panel belongs to Create, which is the one
// place a panel's own mode toggle crosses a group boundary (AMBIGUOUS-3).
const enhanceGroup: ToolGroupDefinition = {
  id: "enhance",
  label: "Enhance",
  icon: Zap,
  description: "Shrink it, resize it, adjust the pixels, or hand it to a model",
  shortcutKey: "1",
  subTools: [
    {
      id: "compress",
      label: "Compress",
      description: "Shrink the file size — method, format and quality",
      icon: FileArchive,
      tool: "compress",
      mode: "compress",
      keywords: ["compress", "file size", "quality", "shrink", "optimise"],
    },
    {
      id: "resize",
      label: "Resize",
      description: "Set new pixel dimensions, with or without the aspect lock",
      icon: Scaling,
      tool: "compress",
      mode: "resize",
      keywords: ["resize", "dimensions", "scale", "pixels", "width", "height"],
    },
    {
      id: "adjustments",
      label: "Adjustments",
      description: "Brightness, contrast, saturation, shadows and sharpen",
      icon: SunDim,
      tool: "effects",
      keywords: [
        "brightness", "contrast", "saturation", "shadows", "highlights",
        "sharpen", "effects", "adjust",
      ],
    },
    {
      // ONE sub-tool spanning two eraser modes: `rembg` is the entry, and
      // AISettings' own toggle reaches `inpaint`. The 33-sub-tool count in the
      // brief is what confirms this is one tile and not three.
      id: "ai",
      label: "AI",
      description: "Background removal and object removal, run on a model",
      icon: Bot,
      tool: "ai",
      mode: "rembg",
      keywords: [
        "ai", "background removal", "rembg", "object removal", "inpaint",
        "upscale", "replicate",
      ],
    },
  ],
};

// ── Select ───────────────────────────────────────────────────────────────────
// The existing six, unchanged — already one exclusive set (`SelectionKind`,
// collapsed onto one axis in v7.47 / ADR-022). A straight re-parent: zero
// behaviour change, zero new state.
const selectGroup: ToolGroupDefinition = {
  id: "select",
  label: "Select",
  icon: SquareMousePointer,
  description: "Wand, edge-aware, lasso, colour range or marquee",
  shortcutKey: "2",
  subTools: [
    {
      id: "magic-wand",
      label: "Magic Wand",
      description: "Flood-fill a region within a colour tolerance",
      icon: Wand2,
      tool: "select",
      mode: "wand",
      cursor: "crosshair",
      keywords: ["wand", "flood fill", "tolerance", "magic"],
    },
    {
      id: "edge-aware",
      label: "Edge-aware",
      description: "Same fill, walled in by the edge map so it stops at the outline",
      icon: Scan,
      tool: "select",
      mode: "edge",
      cursor: "crosshair",
      keywords: ["edge", "sobel", "outline", "boundary"],
    },
    {
      id: "magnetic-lasso",
      label: "Magnetic Lasso",
      description: "Click anchors and the wire path-finds along the edges",
      icon: Lasso,
      tool: "select",
      mode: "lasso",
      cursor: "crosshair",
      keywords: ["lasso", "magnetic", "anchors", "path", "trace"],
    },
    {
      id: "color-range",
      label: "Color Range",
      description: "Every pixel near the clicked colour, anywhere in the image",
      icon: SwatchBook,
      tool: "select",
      mode: "colorRange",
      cursor: "crosshair",
      keywords: ["colour range", "color range", "similar", "hue", "sample"],
    },
    {
      id: "rectangle",
      label: "Rectangle",
      description: "Drag out a rectangular marquee",
      icon: SquareDashed,
      tool: "select",
      mode: "rect",
      cursor: "crosshair",
      keywords: ["rectangle", "marquee", "box", "drag"],
    },
    {
      id: "ellipse",
      label: "Ellipse",
      description: "Drag out the ellipse inscribed in that rectangle",
      icon: CircleDashed,
      tool: "select",
      mode: "ellipse",
      cursor: "crosshair",
      keywords: ["ellipse", "circle", "oval", "marquee"],
    },
  ],
};

// ── Create ───────────────────────────────────────────────────────────────────
// The widest group at 12. Absorbs Paint, Stamps, Shapes, the hand Eraser and
// Text, so the panel switch here MUST route on sub-tool rather than on legacy
// tool id — five different `ToolType`s feed this one group.
const createGroup: ToolGroupDefinition = {
  id: "create",
  label: "Create",
  icon: Palette,
  description: "Paint, draw, stamp, annotate and type onto the image",
  shortcutKey: "3",
  subTools: [
    {
      id: "brush",
      label: "Brush",
      description: "Freehand paint straight onto the canvas",
      icon: Brush,
      tool: "brush",
      mode: "paint",
      cursor: "crosshair",
      keywords: ["brush", "paint", "freehand", "draw"],
    },
    {
      id: "pen",
      label: "Pen",
      description: "Bézier paths — click anchors, drag to curve",
      icon: PenTool,
      tool: "brush",
      mode: "pen",
      cursor: "crosshair",
      keywords: ["pen", "bezier", "path", "vector", "curve"],
    },
    {
      id: "clone-stamp",
      label: "Clone Stamp",
      description: "Alt+click a source point, then paint pixels from it",
      icon: Stamp,
      tool: "stamp",
      mode: "clone",
      cursor: "crosshair",
      keywords: ["clone", "heal", "duplicate", "source point"],
    },
    {
      id: "blur-brush",
      label: "Blur Brush",
      description: "Soften whatever you drag across",
      icon: Droplets,
      tool: "brush",
      mode: "blur",
      cursor: "crosshair",
      keywords: ["blur", "soften", "smudge", "brush"],
    },
    {
      // AMBIGUOUS-1. Two live features are called Eraser; this is the one in
      // AISettings, sitting directly beside Magic Eraser exactly as the brief
      // lists them. Paint's `brushMode: "erase"` is the other, and it was
      // ALREADY unreachable before this job (ORPHAN O-1) — it is absent from
      // PAINT_MODES, so it has no tile, no palette entry, and setModeOf
      // refuses it. Left exactly as found: not deleted, not revived.
      id: "eraser",
      label: "Eraser",
      description: "Rub pixels out by hand",
      icon: Eraser,
      tool: "ai",
      mode: "brush",
      cursor: "crosshair",
      keywords: ["eraser", "erase", "rub out", "delete pixels"],
    },
    {
      id: "magic-eraser",
      label: "Magic Eraser",
      description: "Paint over something and let PatchMatch fill it in",
      icon: Wand2,
      tool: "ai",
      mode: "magic",
      cursor: "crosshair",
      keywords: ["magic eraser", "patchmatch", "inpaint", "content aware"],
    },
    {
      // Text's `background` and `ocr` modes stay reachable inside TextSettings'
      // own toggle — ORPHAN O-2/O-3, no sub-tool tile in the brief.
      id: "text",
      label: "Text",
      description: "Add a caption, with an optional plate or bubble behind it",
      icon: Type,
      tool: "text",
      mode: "text",
      cursor: "text",
      keywords: ["text", "type", "caption", "label", "words"],
    },
    {
      // Text's third mode, promoted to a sub-tool of its own so it is reachable
      // from the rail rather than only from inside the Text panel. Reads text
      // out of the image; no canvas gesture, so no cursor and it idles.
      id: "ocr",
      label: "OCR",
      description: "Read the text out of the image",
      icon: ScanText,
      tool: "text",
      mode: "ocr",
      keywords: ["ocr", "read text", "extract", "scan", "recognise"],
    },
    {
      id: "shapes",
      label: "Shapes",
      description: "Rectangles, circles, hand-drawn outlines and lines",
      icon: Shapes,
      tool: "shapes",
      mode: "shapes",
      cursor: "crosshair",
      keywords: ["shape", "rectangle", "circle", "box", "hand-drawn"],
    },
    {
      // `shapesMode: "pens"` is labelled "Pens" in toolModes.ts but carries a
      // MapPin icon and drives PIN_LABELS (Numbers / Letters) — it is the
      // pin-drop feature, not the Bézier pen. The brief separates the two
      // correctly; the stale label is what made them look like one thing.
      id: "pins",
      label: "Pins",
      description: "Drop numbered or lettered markers for callouts",
      icon: Pin,
      tool: "shapes",
      mode: "pens",
      cursor: "crosshair",
      keywords: ["pin", "marker", "numbers", "letters", "annotate", "callout"],
    },
    {
      id: "arrow",
      label: "Arrow",
      description: "Single- or double-headed arrows",
      icon: ArrowUpRight,
      tool: "shapes",
      mode: "arrows",
      cursor: "crosshair",
      keywords: ["arrow", "pointer", "annotate", "single", "double"],
    },
    {
      id: "emoji",
      label: "Emoji",
      description: "Drop an emoji sticker anywhere on the image",
      icon: Smile,
      tool: "stamp",
      mode: "emojis",
      cursor: "crosshair",
      keywords: ["emoji", "sticker", "reaction", "face"],
    },
    {
      id: "stamps",
      label: "Stamps",
      description: "Red marker stamps — approved, rejected, and the rest",
      icon: BadgeCheck,
      tool: "stamp",
      mode: "red",
      cursor: "crosshair",
      keywords: ["stamp", "red", "marker", "batch stamp", "numbered"],
    },
  ],
};

// ── Edit ─────────────────────────────────────────────────────────────────────
// Every live sub-tool here is an EXISTING section card. TransformCropSettings
// already renders Crop / Transform / Color Picker; LayerSettings already
// renders Move-or-Resize Layer / Guides / Background Canvas Size. The brief is
// describing structure the app has, which is why this group needs no invention
// — but it is also why three tiles share `crop` and three share `arrow`, and
// therefore why sub-tool identity is a field rather than a derivation.
const editGroup: ToolGroupDefinition = {
  id: "edit",
  label: "Edit",
  icon: SquarePen,
  description: "Crop, transform, pick colours, and size the layer or canvas",
  shortcutKey: "4",
  subTools: [
    {
      id: "crop",
      label: "Crop",
      description: "Pick a ratio, drag the box, then apply",
      icon: Crop,
      tool: "crop",
      cursor: "crosshair",
      keywords: ["crop", "trim", "ratio", "aspect"],
    },
    {
      id: "transform",
      label: "Transform",
      description: "Flip or rotate the active layer in place",
      icon: FlipHorizontal,
      tool: "crop",
      keywords: ["transform", "flip", "rotate", "mirror"],
    },
    {
      id: "perspective",
      label: "Perspective",
      description: "Correct a keystoned or skewed photo",
      icon: Scan,
      comingSoon: true,
      note: "Perspective correction is not built yet",
      keywords: ["perspective", "keystone", "skew", "warp"],
    },
    {
      // Maps to `crop` PLUS the panel's existing Color Picker toggle — which is
      // exactly what clicking that toggle does today, so this is a shortcut to
      // an existing state rather than a new activation path.
      id: "color-picker",
      label: "Color Picker",
      description: "Eyedropper — sample a pixel into the brush and text colour",
      icon: Pipette,
      tool: "crop",
      preselect: { colorPicker: true },
      cursor: "crosshair",
      keywords: ["colour picker", "color picker", "eyedropper", "sample", "pick"],
    },
    {
      id: "resize-layer",
      label: "Resize Layer",
      description: "Move and scale the active layer",
      icon: Layers,
      tool: "arrow",
      keywords: ["resize layer", "move layer", "scale layer", "reposition"],
    },
    {
      id: "canvas-size",
      label: "Canvas Size",
      description: "Grow or shrink the background canvas without resampling",
      icon: Frame,
      tool: "arrow",
      keywords: ["canvas size", "background", "artboard", "extend", "pad"],
    },
    {
      // Live, not Coming Soon: the guides overlay is built and works. The
      // earlier Ruler ICON was the problem — it read as a measurement tool
      // that doesn't exist. Grid2x2 says "alignment lines" without promising
      // a ruler. No canvas gesture of its own (guides are added from the
      // panel, then dragged on the existing overlay), so no cursor.
      id: "guides",
      label: "Guides",
      description: "Draggable horizontal and vertical alignment lines",
      icon: Grid2x2,
      tool: "arrow",
      keywords: ["guides", "horizontal", "vertical", "snap", "alignment"],
    },
    {
      // Parked next to Guides on purpose — a ruler is the measurement half of
      // the same job, and Chris wants the slot held. Coming Soon carries no
      // `tool`, so it is unreachable by route and palette by TYPE.
      id: "ruler",
      label: "Ruler",
      description: "Measure distances and angles on the image",
      icon: Ruler,
      comingSoon: true,
      note: "Measuring isn't built yet",
      keywords: ["ruler", "measure", "distance", "angle", "dimension"],
    },
  ],
};

// ── Batch ────────────────────────────────────────────────────────────────────
// Legacy id `emoji` — retained, load-bearing for persistence and the existing
// `#/tool/batch` slug. Gated on 2+ photos, same as today.
const batchGroup: ToolGroupDefinition = {
  id: "batch",
  label: "Batch",
  icon: PackageOpen,
  description: "Stamp a logo, add text or rename every loaded photo at once",
  shortcutKey: "5",
  subTools: [
    {
      id: "logo",
      label: "Logo",
      description: "Stamp a logo onto every loaded photo at once",
      icon: ImagePlus,
      tool: "emoji",
      mode: "logo",
      keywords: ["logo", "watermark", "brand", "bulk"],
    },
    {
      id: "text",
      label: "Text",
      description: "Add the same caption to every loaded photo",
      icon: Type,
      tool: "emoji",
      mode: "text",
      keywords: ["text", "caption", "bulk", "overlay"],
    },
    {
      id: "rename",
      label: "Rename",
      description: "Rename the whole gallery from a pattern",
      icon: FileEdit,
      tool: "emoji",
      mode: "rename",
      keywords: ["rename", "filename", "bulk", "sequence"],
    },
    {
      id: "ai-rename",
      label: "AI Rename",
      description: "Name every photo from what the engine sees in it",
      icon: ScanEye,
      tool: "emoji",
      mode: "airename",
      keywords: [
        "ai rename",
        "smart rename",
        "describe",
        "content",
        "auto name",
        "bulk",
      ],
    },
  ],
};

/** The five groups, in rail order. Digits 1-5 follow this order. */
export const TOOL_GROUPS: readonly ToolGroupDefinition[] = [
  enhanceGroup,
  selectGroup,
  createGroup,
  editGroup,
  batchGroup,
];

// ── Derived lookups ──────────────────────────────────────────────────────────
// Built once from TOOL_GROUPS. Nothing below is hand-maintained; if a table
// here disagreed with the groups above, that would be the fourth-copy bug
// again, one level down.

/** Globally-unique key for a sub-tool. Sub-tool ids are unique only WITHIN a
 *  group — Create and Batch both have a `text` — so anything holding a flat
 *  map keys on this. The route form is the same string: `create/text`. */
export function subToolKey(group: ToolGroupId, subToolId: string): string {
  return `${group}/${subToolId}`;
}

export interface ResolvedSubTool {
  group: ToolGroupDefinition;
  subTool: SubToolDefinition;
  key: string;
}

const BY_KEY: ReadonlyMap<string, ResolvedSubTool> = (() => {
  const map = new Map<string, ResolvedSubTool>();
  for (const group of TOOL_GROUPS) {
    for (const subTool of group.subTools) {
      map.set(subToolKey(group.id, subTool.id), { group, subTool, key: subToolKey(group.id, subTool.id) });
    }
  }
  return map;
})();

const GROUP_BY_ID: ReadonlyMap<string, ToolGroupDefinition> = new Map(
  TOOL_GROUPS.map((g) => [g.id, g]),
);

/** Every sub-tool, flattened, in rail order. The palette, the route table and
 *  the contract test all walk this. */
export const ALL_SUB_TOOLS: readonly ResolvedSubTool[] = [...BY_KEY.values()];

/** Only the ones that actually go somewhere. Coming Soon items are excluded by
 *  construction, which is what makes them unreachable by route and palette
 *  rather than merely rendered disabled. */
export const LIVE_SUB_TOOLS: readonly (ResolvedSubTool & { subTool: LiveSubTool })[] =
  ALL_SUB_TOOLS.filter(
    (r): r is ResolvedSubTool & { subTool: LiveSubTool } => !r.subTool.comingSoon,
  );

export function groupById(id: string): ToolGroupDefinition | undefined {
  return GROUP_BY_ID.get(id.toLowerCase());
}

export function resolveSubTool(
  group: string,
  subToolId: string,
): ResolvedSubTool | undefined {
  return BY_KEY.get(subToolKey(group.toLowerCase() as ToolGroupId, subToolId.toLowerCase()));
}

export function subToolByKey(key: string): ResolvedSubTool | undefined {
  return BY_KEY.get(key);
}

/** The sub-tool a group activates when you click its rail tile: its first
 *  live one. (Last-used-per-group would be nicer and is deliberately NOT done
 *  here — it needs persisted state, and this restructure is scoped to stay out
 *  of the persisted store. Parked in the migration map.) */
export function defaultSubToolOf(group: ToolGroupDefinition): LiveSubTool {
  const first = group.subTools.find((s): s is LiveSubTool => !s.comingSoon);
  // Every group ships at least one live sub-tool; a group that didn't would be
  // a rail tile that does nothing, so fail loudly at module load rather than
  // silently rendering a dead tile.
  if (!first) throw new Error(`Tool group "${group.id}" has no live sub-tools`);
  return first;
}

/** Best-effort reverse lookup: which sub-tool does this (tool, mode) pair mean?
 *
 *  Used to re-derive the active sub-tool after a reload, and whenever something
 *  outside the toolbar changes the tool (a legacy route, `TOOL_BY_KEY`, a
 *  panel's own mode toggle). Ambiguous for the six Edit sub-tools that share a
 *  tool — first match wins, which is why the store tracks the active sub-tool
 *  explicitly and only falls back to this. */
export function subToolForToolMode(
  tool: ToolType,
  mode: string | undefined,
): ResolvedSubTool | undefined {
  const live = LIVE_SUB_TOOLS.filter((r) => r.subTool.tool === tool);
  if (!live.length) return undefined;
  if (mode !== undefined) {
    const exact = live.find((r) => r.subTool.mode === mode);
    if (exact) return exact;
  }
  return live.find((r) => r.subTool.mode === undefined) ?? live[0];
}

/** Group digits, for `useKeyboardShortcuts` and ShortcutModal. Derived. */
export const GROUP_BY_KEY: Readonly<Record<string, ToolGroupId>> = Object.freeze(
  Object.fromEntries(
    TOOL_GROUPS.map((g) => [`Digit${g.shortcutKey}`, g.id]),
  ),
);
