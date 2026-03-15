import type { ToolSettings } from "./types";

export const defaultToolSettings: ToolSettings = {
  // Stamp (Rust/WASM)
  brushSize: 20,
  hardness: 0.8,
  opacity: 1.0,

  // Annotation (future JS)
  strokeWidth: 3,
  strokeColor: "#e94560",
  arrowStyle: "single",
  brushColor: "#e94560",
  brushOpacity: 100,
  fontSize: 24,
  fontWeight: "normal",
  textColor: "#ffffff",
  blurSize: 32,
  blurIntensity: 8,
};
