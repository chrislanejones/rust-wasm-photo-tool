// ===== FILE: app/src/features/tools/toolConfig.ts =====
import type { ToolType } from "@/lib/types";
import {
  Shrink,
  SquareMousePointer,
  Paintbrush,
  Type,
  Layers,
  Brain,
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
}

export const TOOLS: ToolDefinition[] = [
  {
    id: "compress",
    label: "Resize",
    tooltipTitle: "Compress & Resize",
    description: "Compress & resize images",
    icon: Shrink,
    gradient: "from-orange-500 to-red-500",
  },
  {
    id: "crop",
    label: "Edit and Transform",
    description: "Crop, transform & erase",
    icon: SquareMousePointer,
    gradient: "from-cyan-500 to-blue-500",
  },
  {
    id: "brush",
    label: "Paint",
    description: "Paint, blur, pen & erase",
    icon: Paintbrush,
    gradient: "from-blue-500 to-indigo-500",
  },
  {
    id: "text",
    label: "Text",
    description: "Text & speech bubbles",
    icon: Type,
    gradient: "from-amber-400 to-orange-500",
  },
  {
    // NB: the `arrow` id is legacy — this slot is now the Layer Settings tool:
    // a Move-layer toggle (Ctrl+M) plus the Selection Marker (magic-wand).
    // Arrow-drawing lives under Shapes → Arrows.
    id: "arrow",
    label: "Layer Settings",
    tooltipTitle: "Layer Settings (Move · Select)",
    description: "Move the active layer & select regions",
    icon: Layers,
    gradient: "from-emerald-500 to-teal-500",
  },
  {
    id: "ai",
    label: "AI",
    description: "AI-powered tools (coming soon)",
    icon: Brain,
    gradient: "from-violet-500 to-purple-600",
  },
  {
    id: "shapes",
    label: "Shapes",
    description: "Shapes & arrows",
    icon: Shapes,
    gradient: "from-pink-500 to-rose-500",
  },
  {
    id: "effects",
    label: "Effects",
    description: "Levels & color picker",
    icon: Sparkles,
    gradient: "from-indigo-400 to-violet-600",
  },
  {
    id: "stamp",
    label: "Clone Stamp",
    description: "Clone stamp, red stamps & emojis",
    icon: Stamp,
    gradient: "from-rose-500 to-red-600",
  },
  {
    id: "emoji",
    label: "Batch Image Editor",
    description: "Apply logo or text to all loaded images at once",
    icon: Images,
    gradient: "from-yellow-400 to-orange-400",
  },
];
