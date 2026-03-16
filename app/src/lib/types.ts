// ── Image data for gallery ──────────────────────────────────────────────────
export interface ImageData {
  id: string;
  file: File;
  url: string;
  name: string;
  size: number;
}

// ── Tool types ─────────────────────────────────────────────────────────────
// "stamp" is the Rust/WASM clone stamp tool — the core power feature.
// Others are future JS-canvas-based annotation tools.
export type ToolType =
  | "stamp"
  | "compress" // ← add
  | "transform"
  | "brush"
  | "text"
  | "arrow"
  | "shapes"
  | "blur"
  | "crop";

// ── Stamp-specific settings (Rust/WASM bridge) ────────────────────────────
export interface StampSettings {
  brushSize: number;
  hardness: number;
  opacity: number;
}

// ── Full tool settings bag ────────────────────────────────────────────────
export interface ToolSettings extends StampSettings {
  // Future annotation tool settings go here
  strokeWidth: number;
  strokeColor: string;
  arrowStyle: "single" | "double";
  brushColor: string;
  brushOpacity: number;
  fontSize: number;
  fontWeight: "normal" | "bold";
  textColor: string;
  shape?: "rect" | "circle" | "handCircle" | "line";
  blurSize: number;
  blurIntensity: number;
}
