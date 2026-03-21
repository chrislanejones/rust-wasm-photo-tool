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
  | "effects" // was "blur" — now includes brightness, contrast, blur
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

  // Effects (was Blur)
  blurSize: number;
  blurIntensity: number;
  effectBrightness: number; // -100 to +100, applied on commit
  effectContrast: number; // 0 to 300, applied on commit (100 = neutral)

  // Emoji
  emoji: string;
  emojiSize: number;
}
