import type { ToolType } from "@/lib/types";
import {
  Stamp,
  Paintbrush,
  Type,
  ArrowUpRight,
  Shapes,
  Droplets,
  Crop,
  SlidersHorizontal,
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
    id: "stamp",
    label: "Clone Stamp",
    description: "WASM-powered clone stamp",
    icon: Stamp,
    gradient: "from-rose-500 to-red-600",
  },
  {
    id: "transform",
    label: "Transform",
    description: "Flip, rotate, brightness",
    icon: SlidersHorizontal,
    gradient: "from-amber-500 to-orange-600",
  },
  {
    id: "crop",
    label: "Crop",
    description: "Crop & trim images",
    icon: Crop,
    gradient: "from-cyan-500 to-blue-600",
  },
  {
    id: "brush",
    label: "Paint",
    description: "Freehand drawing",
    icon: Paintbrush,
    gradient: "from-blue-500 to-indigo-600",
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
    gradient: "from-emerald-500 to-teal-600",
  },
  {
    id: "shapes",
    label: "Shapes",
    description: "Add geometric shapes",
    icon: Shapes,
    gradient: "from-pink-500 to-rose-600",
  },
  {
    id: "blur",
    label: "Blur",
    description: "Blur sensitive areas",
    icon: Droplets,
    gradient: "from-slate-400 to-slate-600",
  },
];
