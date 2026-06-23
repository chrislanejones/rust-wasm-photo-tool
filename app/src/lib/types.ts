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
  | "effects"   // was "blur" — now includes brightness, contrast, blur
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
  fontFamily: string;
  fontWeight: "normal" | "bold";
  textColor: string;
  shape?: "rect" | "circle" | "handCircle" | "line";

  // Shape interior fill (rect + circle only). Painted under the stroke.
  /** "none" = outline only, "solid" = fillColor, "gradient" = fillColor→fillColor2,
   *  "pixelate" = mosaic the pixels beneath (a re-selectable redaction box). */
  fillMode: "none" | "solid" | "gradient" | "pixelate";
  fillColor: string;       // solid fill / gradient stop 0 (hex)
  fillColor2: string;      // gradient stop 1 (hex)
  gradientAngle: number;   // degrees: 0 →, 45 ↘, 90 ↓, 135 ↙
  fillBlock: number;       // mosaic block size (px) for fillMode "pixelate"

  // Effects (was Blur) — the Paint tool's Blur Brush + the Levels panel.
  /** Blur-brush effect: "gaussian" softens, "pixelate" mosaics, "solid" redacts. */
  blurMode: "gaussian" | "pixelate" | "solid";
  blurSize: number;          // brush footprint (shared by all blur-brush modes)
  blurIntensity: number;     // gaussian kernel radius (px)
  pixelSize: number;         // mosaic block size (px) for "pixelate"
  redactColor: string;       // opaque fill colour for "solid"
  effectBrightness: number;  // -100 to +100, applied on commit
  effectContrast: number;    // 0 to 300, applied on commit (100 = neutral)

  // Emoji
  emoji: string;
  emojiSize: number;

  // Text Background (renders inside the text annotation tile)
  bgKind: "none" | "rect" | "bubble";
  bgColor: string;
  bgOpacity: number;        // 0-100
  bgPadding: number;        // 0-40 px
  bgCornerRadius: number;   // 0-32 px (rect only)
  /** Speech-bubble tail angle in degrees (0-359), sweeping the tail around
   *  the bubble. Only meaningful when bgKind === "bubble". */
  bgTail: number;

  // Pens (Shapes tool → Pens tab)
  /** Pins drop auto-numbered callout circles; Freehand draws polyline strokes. */
  penMode: "pins" | "freehand";
  /** Diameter (px) of a dropped numbered pin. */
  pinSize: number;
}
