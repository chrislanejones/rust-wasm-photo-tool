import type { ToolType } from "@/lib/types";
import {
  Shrink,
  Crop,
  Paintbrush,
  Type,
  ArrowUpRight,
  Sparkles,
  Shapes,
  Wand2,
  Stamp,
  Smile,
} from "lucide-react";

export interface ToolDefinition {
  id: ToolType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
}

export const TOOLS: ToolDefinition[] = [
  {
    id: "compress",
    label: "Resize",
    description: "Resize & optimize images",
    icon: Shrink,
    gradient: "from-orange-500 to-red-500",
  },
  {
    id: "crop",
    label: "Crop",
    description: "Crop & trim images",
    icon: Crop,
    gradient: "from-cyan-500 to-blue-500",
  },
  {
    id: "brush",
    label: "Paint",
    description: "Freehand drawing",
    icon: Paintbrush,
    gradient: "from-blue-500 to-indigo-500",
  },
  {
    id: "text",
    label: "Text",
    description: "Add text annotations",
    icon: Type,
    gradient: "from-amber-400 to-orange-500",
  },
  {
    id: "arrow",
    label: "Arrows",
    description: "Point & highlight areas",
    icon: ArrowUpRight,
    gradient: "from-emerald-500 to-teal-500",
  },
  {
    id: "ai",
    label: "AI",
    description: "AI-powered tools",
    icon: Sparkles,
    gradient: "from-violet-500 to-purple-600",
  },
  {
    id: "shapes",
    label: "Shapes",
    description: "Add geometric shapes",
    icon: Shapes,
    gradient: "from-pink-500 to-rose-500",
  },
  {
    id: "effects",
    label: "Effects",
    description: "Blur, brightness & contrast (WASM)",
    icon: Wand2,
    gradient: "from-indigo-400 to-violet-600",
  },
  {
    id: "stamp",
    label: "Stamp Tool",
    description: "Clone stamp & red stamp presets",
    icon: Stamp,
    gradient: "from-rose-500 to-red-600",
  },
  {
    id: "emoji",
    label: "Emoji",
    description: "Stamp emojis on images",
    icon: Smile,
    gradient: "from-yellow-400 to-orange-400",
  },
];
