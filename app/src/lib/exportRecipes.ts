// Export recipes (Night 10-28, 229): a named size + format + quality + file
// name pattern that Download All applies to the ZIP. A recipe shapes the
// EXPORT only; the photos in the gallery are never changed by it.
//
// The built-ins live here, in code. Recipes a person saves live in
// Preferences (`exportRecipes`), so they travel with the prefs document:
// local when signed out, synced across devices when signed in (ADR-061).
import type { ExportFormat } from "@/lib/exportImage";

// A local copy, type-checked against ExportFormat: preferences.ts imports this
// module, and exportImage pulls in the engine, so a value import would drag
// the codec into every prefs reader.
const FORMATS: readonly ExportFormat[] = ["png", "jpeg", "webp", "avif"];

export type RecipeSize =
  /** Fill exactly W×H, cropping the overflow from the center. Upscales when
   *  the photo is smaller — "1080×1350" means every file is 1080×1350. */
  | { fit: "exact"; width: number; height: number }
  /** No wider (or no longer on the long edge) than `size`. Never upscales. */
  | { fit: "width" | "long"; size: number }
  | { fit: "keep" };

export interface ExportRecipe {
  id: string;
  name: string;
  size: RecipeSize;
  format: ExportFormat;
  /** 1..100. PNG below 100 reduces colors (v9.40). */
  quality: number;
  /** File name. Tokens: {name} the photo's name, {n} its position (1, 2…),
   *  {w} and {h} the output size. The extension is added. */
  pattern: string;
}

export const BUILT_IN_RECIPES: readonly ExportRecipe[] = [
  {
    id: "builtin:instagram",
    name: "Instagram 1080×1350",
    size: { fit: "exact", width: 1080, height: 1350 },
    format: "jpeg",
    quality: 85,
    pattern: "{name}-instagram",
  },
  {
    id: "builtin:web-1600",
    name: "Web 1600",
    size: { fit: "long", size: 1600 },
    format: "webp",
    quality: 80,
    pattern: "{name}",
  },
  {
    id: "builtin:email-small",
    name: "Email small",
    size: { fit: "long", size: 1024 },
    format: "jpeg",
    quality: 70,
    pattern: "{name}-small",
  },
];

/** Saved recipes kept at most — the prefs document is one small blob. */
export const MAX_SAVED_RECIPES = 20;
const MAX_PX = 16384;

/** What a `w × h` photo becomes: the source rect to take, and the output
 *  size to scale it to. */
export function recipeGeometry(
  w: number,
  h: number,
  size: RecipeSize,
): { crop: { x: number; y: number; width: number; height: number }; width: number; height: number } {
  const whole = { x: 0, y: 0, width: w, height: h };
  switch (size.fit) {
    case "keep":
      return { crop: whole, width: w, height: h };
    case "width":
    case "long": {
      const axis = size.fit === "width" ? w : Math.max(w, h);
      if (axis <= size.size) return { crop: whole, width: w, height: h };
      const s = size.size / axis;
      return { crop: whole, width: Math.max(1, Math.round(w * s)), height: Math.max(1, Math.round(h * s)) };
    }
    case "exact": {
      // Cover: the largest centered rect of the target's shape.
      const target = size.width / size.height;
      let cw = w;
      let ch = Math.round(w / target);
      if (ch > h) {
        ch = h;
        cw = Math.round(h * target);
      }
      cw = Math.min(w, Math.max(1, cw));
      ch = Math.min(h, Math.max(1, ch));
      const x = Math.floor((w - cw) / 2);
      const y = Math.floor((h - ch) / 2);
      return { crop: { x, y, width: cw, height: ch }, width: size.width, height: size.height };
    }
  }
}

/** Fill the pattern. Characters a file system refuses become "-"; an empty
 *  result falls back to the photo's name. No extension — the caller adds it. */
export function recipeFileStem(pattern: string, t: { name: string; n: number; w: number; h: number }): string {
  const tokens: Record<string, string> = { name: t.name, n: String(t.n), w: String(t.w), h: String(t.h) };
  const filled = pattern.replace(/\{(name|n|w|h)\}/g, (_, k: string) => tokens[k] ?? "");
  const safe = [...filled]
    .map((c) => (c.charCodeAt(0) < 32 || '\\/:*?"<>|'.includes(c) ? "-" : c))
    .join("")
    .trim();
  return safe || t.name || "image";
}

/** The recipe for an id, from the built-ins and the saved ones. */
export function findRecipe(id: string | null, saved: readonly ExportRecipe[]): ExportRecipe | null {
  if (!id) return null;
  return BUILT_IN_RECIPES.find((r) => r.id === id) ?? saved.find((r) => r.id === id) ?? null;
}

const px = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) && v >= 1 && v <= MAX_PX ? Math.round(v) : null;

function normalizeSize(v: unknown): RecipeSize | null {
  if (!v || typeof v !== "object") return null;
  const s = v as Record<string, unknown>;
  if (s.fit === "keep") return { fit: "keep" };
  if (s.fit === "width" || s.fit === "long") {
    const size = px(s.size);
    return size === null ? null : { fit: s.fit, size };
  }
  if (s.fit === "exact") {
    const width = px(s.width);
    const height = px(s.height);
    return width === null || height === null ? null : { fit: "exact", width, height };
  }
  return null;
}

/** Validate saved recipes from storage or another device. A bad entry is
 *  dropped rather than clamped into something the person never saved. */
export function normalizeRecipes(v: unknown): ExportRecipe[] {
  if (!Array.isArray(v)) return [];
  const out: ExportRecipe[] = [];
  const ids = new Set<string>();
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const size = normalizeSize(r.size);
    if (
      typeof r.id !== "string" ||
      !r.id ||
      r.id.startsWith("builtin:") ||
      ids.has(r.id) ||
      typeof r.name !== "string" ||
      !r.name.trim() ||
      !size ||
      !FORMATS.includes(r.format as ExportFormat) ||
      typeof r.quality !== "number" ||
      !Number.isFinite(r.quality) ||
      typeof r.pattern !== "string"
    ) {
      continue;
    }
    ids.add(r.id);
    out.push({
      id: r.id,
      name: r.name.trim().slice(0, 60),
      size,
      format: r.format as ExportFormat,
      quality: Math.min(100, Math.max(1, Math.round(r.quality))),
      pattern: r.pattern.slice(0, 120) || "{name}",
    });
    if (out.length === MAX_SAVED_RECIPES) break;
  }
  return out;
}

/** "1080×1350 JPEG" — what a recipe writes, for the dialog's line. */
export function describeRecipe(r: ExportRecipe): string {
  const fmt = r.format.toUpperCase();
  switch (r.size.fit) {
    case "exact":
      return `${r.size.width}×${r.size.height} ${fmt}`;
    case "width":
      return `${r.size.size} px wide ${fmt}`;
    case "long":
      return `${r.size.size} px long edge ${fmt}`;
    case "keep":
      return `same size ${fmt}`;
  }
}
