// Hand-maintained — features.ts is regenerated from docs/Features.md, this
// isn't. Add an entry here whenever a new feature lands; the sidebar falls
// back to a plain dot for anything unmapped rather than erroring.

import type { ElementType } from "react";
import { CpuIcon } from "../components/Icons";
import {
  AppWindow,
  Stamp,
  FileBadge2,
  Move,
  Layers2,
  ShieldCheck,
  MonitorSmartphone,
  Keyboard,
  Maximize2,
  SlidersHorizontal,
  BarChart3,
  Zap,
  Pipette,
  Droplets,
  ArrowUpRight,
  Shapes,
  Paintbrush,
  PenTool,
  Type,
  SmilePlus,
  Download,
  Square,
  Images,
  ClipboardPaste,
  History,
  Save,
  Sparkles,
  LayoutGrid,
  SquareStack,
  Hand,
  GitCompare,
  GalleryHorizontalEnd,
  PanelRight,
  Upload,
  FileDown,
  Command,
  Wrench,
  Brain,
  SunMoon,
  Ruler,
  Database,
} from "lucide-react";

export const GROUP_ICONS: Record<string, ElementType> = {
  // Same glyph as Home's "Your machine" tab — one meaning, one icon, site-wide.
  "Image Processing (Rust/WASM)": CpuIcon,
  "UI (React)": AppWindow,
};

export const FEATURE_ICONS: Record<string, ElementType> = {
  "Clone Stamp": Stamp,
  "Red Stamps": FileBadge2,
  "Edit & Move (Crop · Transform · Align · Select)": Move,
  "Text Shadow": Layers2,
  "Security tab": ShieldCheck,
  "Responsive / snapped windows": MonitorSmartphone,
  "Keyboard accessibility": Keyboard,
  Resize: Maximize2,
  Levels: SlidersHorizontal,
  Histogram: BarChart3,
  "Fast integer compositing": Zap,
  "Color Picker": Pipette,
  "Blur Brush": Droplets,
  Arrows: ArrowUpRight,
  Shapes: Shapes,
  "Paint / Brush": Paintbrush,
  "Pen (Vector Paths)": PenTool,
  Text: Type,
  "Emoji Stamp": SmilePlus,
  Export: Download,
  "Blank Canvas": Square,
  Thumbnails: Images,
  "Copy/Paste Regions": ClipboardPaste,
  History: History,
  "Per-photo Edit Persistence": Save,

  "Animated Panels": Sparkles,
  "Tool Grid": LayoutGrid,
  "Tab Switchers": SquareStack,
  "Spacebar Pan": Hand,
  "A/B Compare Slider": GitCompare,
  "Multi-photo Gallery": GalleryHorizontalEnd,
  "Review Panel": PanelRight,
  Upload: Upload,
  "Export Dropdown": FileDown,
  "Keyboard Shortcut Modal": Command,
  "Hidden Dev Tools": Wrench,
  "Eraser Panel": Brain,
  "Light / Dark / System theme": SunMoon,
  "Rulers & Grids": Ruler,
  "State management (Zustand)": Database,
};

const FALLBACK_ICON = Square;

export function getFeatureIcon(name: string): ElementType {
  return FEATURE_ICONS[name] ?? FALLBACK_ICON;
}

export function getGroupIcon(name: string): ElementType {
  return GROUP_ICONS[name] ?? AppWindow;
}
