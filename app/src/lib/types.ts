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
  | "blur"
  | "emoji";

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

  // Emoji
  emoji: string;
  emojiSize: number;
}
