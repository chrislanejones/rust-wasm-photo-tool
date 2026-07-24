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
  gradient: string;
  /** Key that switches to this tool (mirrors TOOL_BY_KEY in
   *  useKeyboardShortcuts.ts — keys 1-9, 0, then letters once the digit row
   *  filled: S = Select). */
  shortcutKey: string;
}

export const TOOLS: ToolDefinition[] = [
  {
    id: "compress",
    label: "Resize",
    tooltipTitle: "Compress & Resize",
    description: "Compress & resize images",
    icon: Shrink,
    gradient: "from-orange-500 to-red-500",
    shortcutKey: "1",
  },
  {
    // Display label only — the id stays `crop` (load-bearing: shortcuts,
    // persistence, the tool registry). "Adjust & Select" until the Select
    // sub-mode split into its own tool; now just the crop/transform half.
    id: "crop",
    label: "Adjust",
    description: "Crop & transform",
    icon: VectorSquare,
    gradient: "from-cyan-500 to-blue-500",
    shortcutKey: "2",
  },
  {
    // Selection, split out of "Adjust & Select" — the first tool whose id
    // matches its label from birth. Click = the active SelectionKind
    // (wand/edge/color/lasso); drag = rect/ellipse marquee.
    id: "select",
    label: "Select",
    description: "Select by click or marquee",
    icon: SquareDashedMousePointer,
    gradient: "from-teal-500 to-cyan-500",
    shortcutKey: "S",
  },
  {
    id: "brush",
    label: "Paint",
    description: "Paint, blur & pen",
    icon: Paintbrush,
    gradient: "from-blue-500 to-indigo-500",
    shortcutKey: "3",
  },
  {
    id: "text",
    label: "Text",
    description: "Text & speech bubbles",
    icon: Type,
    gradient: "from-amber-400 to-orange-500",
    shortcutKey: "4",
  },
  {
    // NB: the `arrow` id is legacy — this slot is now the Layer Settings tool:
    // a Move-layer toggle (Ctrl+M) plus the Selection Marker (magic-wand).
    // Arrow-drawing lives under Shapes → Arrows.
    id: "arrow",
    label: "Layer Settings",
    tooltipTitle: "Layer Settings",
    description: "Move the active layer & select regions",
    icon: Layers,
    gradient: "from-emerald-500 to-teal-500",
    shortcutKey: "5",
  },
  {
    // DISPLAY label only — id stays "ai" (shortcut 6, persistence, routing
    // are load-bearing; renamed here the same way "crop"→"Adjust & Select"
    // and "compress"→"Resize" were). Was the AI tool; OCR moved to Text,
    // 4x Upscale moved to Effects, and this slot is now Eraser: PatchMatch/
    // Magic Eraser + Background Removal + Object Removal (AISettings.tsx).
    id: "ai",
    label: "Eraser",
    description: "Remove objects & backgrounds",
    icon: Eraser,
    gradient: "from-violet-500 to-purple-600",
    shortcutKey: "6",
  },
  {
    id: "shapes",
    label: "Shapes",
    description: "Shapes & arrows",
    icon: Shapes,
    gradient: "from-pink-500 to-rose-500",
    shortcutKey: "7",
  },
  {
    id: "effects",
    label: "Effects",
    description: "Levels & color picker",
    icon: Sparkles,
    gradient: "from-indigo-400 to-violet-600",
    shortcutKey: "8",
  },
  {
    id: "stamp",
    // DISPLAY label only — the tool does clone + red/batch stamps + emojis.
    // The "stamp" id (shortcut, persistence, routing) is intentionally
    // untouched; ids are renamed during the registry migration only.
    label: "Stamps",
    description: "Clone stamp, red stamps & emojis",
    icon: Stamp,
    gradient: "from-rose-500 to-red-600",
    shortcutKey: "9",
  },
  {
    id: "emoji",
    label: "Batch Image Editor",
    description: "Apply logo or text to all loaded images at once",
    icon: Images,
    gradient: "from-yellow-400 to-orange-400",
    shortcutKey: "0",
  },
];
