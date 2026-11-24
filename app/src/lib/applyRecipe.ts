// One image through an export recipe (Night 10-28, 229): crop for an exact
// size, scale with the engine's Lanczos3, encode at the recipe's format and
// quality. Works on a COPY of the pixels — the gallery never changes.
//
// Shared by Download All (useZipExport) and, since Chris 11-24-2026 ("can
// single image have recipe too"), the Selected image download
// (useCanvasActions).
import { encodeRgba } from "@/lib/exportImage";
import { cropRgba } from "@/lib/batchCrop";
import { recipeGeometry, type ExportRecipe } from "@/lib/exportRecipes";

const LANCZOS3 = 3;

export async function applyRecipe(
  pixels: Uint8Array,
  w: number,
  h: number,
  recipe: ExportRecipe,
): Promise<{ blob: Blob; width: number; height: number }> {
  const mod = await import("stamp_tool");
  await mod.default();
  const g = recipeGeometry(w, h, recipe.size);
  const whole = g.crop.width === w && g.crop.height === h;
  let out = whole ? pixels : cropRgba(pixels, w, g.crop);
  if (g.width !== g.crop.width || g.height !== g.crop.height) {
    out = mod.resize_pixels_filter(out, g.crop.width, g.crop.height, g.width, g.height, LANCZOS3);
  }
  const blob =
    recipe.format === "png"
      ? new Blob([new Uint8Array(mod.encode_png_pixels_quality(out, g.width, g.height, recipe.quality))], {
          type: "image/png",
        })
      : await encodeRgba(out === pixels ? out.slice() : out, g.width, g.height, recipe.format, recipe.quality / 100);
  return { blob, width: g.width, height: g.height };
}
