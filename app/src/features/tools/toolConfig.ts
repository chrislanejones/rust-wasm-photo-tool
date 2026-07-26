// ===== FILE: app/src/features/tools/toolConfig.ts =====
import type { ToolType } from "@/lib/types";
import {
  Shrink,
  VectorSquare,
  SquareDashedMousePointer,
  Paintbrush,
  Type,
  Layers,
  Eraser,
  Shapes,
  Sparkles,
  Stamp,
  Images,
} from "lucide-react";

export interface ToolDefinition {
  id: ToolType;
  label: string;
  /** Optional tooltip-title override for when the visible tooltip should say
   *  more than the short `label` (e.g. Resize → "Compress & Resize"). */
  tooltipTitle?: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Key that switches to this tool (mirrors TOOL_BY_KEY in
   *  useKeyboardShortcuts.ts). Keys run in GRID READING ORDER across the
   *  4-column rail: 1-9, then 0 for the tenth, then `-` for the eleventh —
   *  the number row continues past 0, so the eleventh tool keeps a key
   *  instead of going bare. Optional: a tool may ship with no key at all, in
   *  which case it must not appear in TOOL_BY_KEY, the sidebar tooltip, or
   *  ShortcutModal. Every tool is keyed today. */
  shortcutKey?: string;
}

export const TOOLS: ToolDefinition[] = [
  {
    id: "compress",
    label: "Resize",
    tooltipTitle: "Compress & Resize",
    description: "Shrink the file or change the pixel dimensions",
    icon: Shrink,
    shortcutKey: "1",
  },
  {
    // Display label only — the id stays `crop` (load-bearing: shortcuts,
    // persistence, the tool registry). "Adjust & Select" until the Select
    // sub-mode split into its own tool; now just the crop/transform half.
    id: "crop",
    label: "Adjust",
    description: "Crop, flip, rotate and pick a colour off the image",
    icon: VectorSquare,
    shortcutKey: "2",
  },
  {
    // Selection, split out of "Adjust & Select" — the first tool whose id
    // matches its label from birth. Click = the active SelectionKind
    // (wand/edge/color/lasso); drag = rect/ellipse marquee.
    id: "select",
    label: "Select",
    description: "Wand, edge-aware, lasso, colour range or marquee",
    icon: SquareDashedMousePointer,
    // The promised digit, delivered: `S` was removed in v7.44 pending this
    // renumbering, and Select sits third in the rail, so it takes `3`. Do NOT
    // revive `S` — the digit IS the key now.
    shortcutKey: "3",
  },
  {
    id: "brush",
    label: "Paint",
    description: "Brush, blur and pen strokes straight onto the canvas",
    icon: Paintbrush,
    shortcutKey: "4",
  },
  {
    id: "text",
    label: "Text",
    description: "Add a caption, put a plate behind it, or read text out",
    icon: Type,
    shortcutKey: "5",
  },
  {
    // NB: the `arrow` id is legacy — this slot is now the Layer Settings tool:
    // a Move-layer toggle (Ctrl+M) plus the Selection Marker (magic-wand).
    // Arrow-drawing lives under Shapes → Arrows.
    id: "arrow",
    label: "Layer Settings",
    tooltipTitle: "Layer Settings",
    description: "Move the active layer and resize the canvas around it",
    icon: Layers,
    shortcutKey: "6",
  },
  {
    // DISPLAY label only — id stays "ai" (shortcut 6, persistence, routing
    // are load-bearing; renamed here the same way "crop"→"Adjust & Select"
    // and "compress"→"Resize" were). Was the AI tool; OCR moved to Text,
    // 4x Upscale moved to Effects, and this slot is now Eraser: PatchMatch/
    // Magic Eraser + Background Removal + Object Removal (AISettings.tsx).
    id: "ai",
    label: "Eraser",
    description: "Rub out by hand, or lift an object or background away",
    icon: Eraser,
    shortcutKey: "7",
  },
  {
    id: "shapes",
    label: "Shapes",
    description: "Boxes, ellipses, pen paths and arrows",
    icon: Shapes,
    shortcutKey: "8",
  },
  {
    id: "effects",
    label: "Effects",
    description: "Brightness, contrast, saturation, shadows and sharpen",
    icon: Sparkles,
    shortcutKey: "9",
  },
  {
    id: "stamp",
    // DISPLAY label only — the tool does clone + red/batch stamps + emojis.
    // The "stamp" id (shortcut, persistence, routing) is intentionally
    // untouched; ids are renamed during the registry migration only.
    label: "Stamps",
    description: "Clone from a source point, or drop markers and emoji",
    icon: Stamp,
    shortcutKey: "0",
  },
  {
    id: "emoji",
    label: "Batch Image Editor",
    description: "Stamp a logo, add text or rename every loaded photo at once",
    icon: Images,
    // Eleventh in the rail, so it continues past `0` onto `-`. Bare `-` is
    // free: the zoom-out binding on the same key is Alt+`-`.
    shortcutKey: "-",
  },
];
