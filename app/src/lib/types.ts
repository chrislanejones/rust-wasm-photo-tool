// ===== FILE: app/src/lib/types.ts =====

export interface ImageData {
  id: string;
  file: File;
  url: string;
  name: string;
  size: number;
}

export type ToolType =
  | "stamp"
  | "compress"
  | "crop"
  | "brush"
  | "text"
  | "arrow"
  | "ai"
  | "shapes"
  | "blur";

// Export format — JPEG first so it's the default everywhere
export type ExportFormat = "jpeg" | "webp" | "avif" | "png";

export const FORMAT_LABELS: Record<ExportFormat, string> = {
  jpeg: "JPEG",
  webp: "WebP",
  avif: "AVIF",
  png: "PNG",
};

// Ordered array for dropdowns — JPEG first
export const FORMAT_OPTIONS: ExportFormat[] = ["jpeg", "webp", "avif", "png"];

export interface StampSettings {
  brushSize: number;
  hardness: number;
  opacity: number;
}

export interface ToolSettings extends StampSettings {
  strokeWidth: number;
  strokeColor: string;
  arrowStyle: "single" | "double";
  brushColor: string;
  brushOpacity: number;
  fontSize: number;
  fontWeight: "normal" | "bold";
  textColor: string;
  shape?: "rect" | "circle" | "handCircle" | "line";

  // Blur
  blurSize: number;
  blurIntensity: number;
}
