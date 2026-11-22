// Batch › Redact through the engine (Night 11-21, 230, ADR-108). The SAME
// calls for the open photo (the live engine: one undo step, recorded on the
// op log with existing ops) and for a photo that is not open (a throwaway
// engine over its stored original, baked and freed).
//
// No new engine code and no new op: Pixelate and Solid are the rectangle
// shape with its mosaic / solid fill (ShapeAdd), Blur is the Blur brush's own
// stroke (Op::Blur). See lib/batchRedact.ts for why each is shaped the way it
// is.
import type { ImageHorseTool } from "stamp_tool";
import { blurPath, safeStrength, type Rect, type RedactLook } from "@/lib/batchRedact";

/** The engine calls Redact makes. The live engine answers each with a promise
 *  (it is behind the worker port); a throwaway engine answers synchronously.
 *  Nothing between them is awaited either way. */
type RedactTool = Pick<
  ImageHorseTool,
  "add_shape_annotation" | "effect_down" | "effect_move" | "effect_up" | "continue_step"
>;

const RECT = 0;
const FILL_SOLID = 1;
const FILL_PIXELATE = 3;
const NO_RADII = new Uint16Array(0);

/**
 * Send every box to `tool` as ONE undo step, in this tick: `continue_step`
 * right before each box after the first, and no await anywhere in between,
 * so no recomposite can land between a `continue_step` and the change it
 * joins (the rule `applyLookAsOneStep` follows, lib/look.ts). `rects` are in
 * DOCUMENT pixels of `tool`.
 */
export function sendRedactions(tool: RedactTool, rects: readonly Rect[], look: Pick<RedactLook, "style" | "block" | "blur" | "color">): void {
  const { block, blur } = safeStrength(look);
  rects.forEach((r, i) => {
    if (i > 0) tool.continue_step();
    if (look.style === "blur") {
      const { radius, points } = blurPath(r);
      const [first, ...rest] = points;
      tool.effect_down(first![0], first![1], radius * 2, "blur", blur, 0, "#000000", "off");
      for (const [x, y] of rest) tool.effect_move(x, y);
      tool.effect_up();
      return;
    }
    const solid = look.style === "solid";
    tool.add_shape_annotation(
      RECT,
      r.x,
      r.y,
      r.x + r.w,
      r.y + r.h,
      solid ? look.color : "#000000",
      0, // no outline: the fill is the redaction
      0,
      solid ? FILL_SOLID : FILL_PIXELATE,
      solid ? look.color : "#000000",
      solid ? look.color : "#000000",
      0,
      solid ? 0 : block,
      0,
      0,
      0,
      NO_RADII,
    );
  });
}

/** Redact RGBA `pixels` in a throwaway engine and read the baked result back.
 *  The engine is freed before this returns, whatever happens. */
export async function redactOnPixels(
  mod: typeof import("stamp_tool"),
  pixels: Uint8Array,
  width: number,
  height: number,
  rects: readonly Rect[],
  look: Pick<RedactLook, "style" | "block" | "blur" | "color">,
): Promise<Uint8Array> {
  const tool = new mod.ImageHorseTool(width, height);
  try {
    tool.load_image(pixels);
    // Boxes arrive in PHOTO pixels; the document may pad the photo.
    const b = await tool.photo_bounds();
    const ox = b.length >= 2 ? b[0]! : 0;
    const oy = b.length >= 2 ? b[1]! : 0;
    sendRedactions(
      tool,
      rects.map((r) => ({ ...r, x: r.x + ox, y: r.y + oy })),
      look,
    );
    return new Uint8Array(await tool.get_image_data());
  } finally {
    tool.free();
  }
}
