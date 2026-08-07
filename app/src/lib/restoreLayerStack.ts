// THE one place a persisted layer stack is replayed into an engine instance.
//
// WHY IT IS SHARED. Two callers need this: `useEngineCore.loadFromSaved`, which
// rehydrates the document you are editing, and `compositeSavedEdit`
// (lib/exportImage.ts), which builds a throwaway engine to render a photo the
// user is NOT looking at during a batch export. Before this module existed only
// the first one restored layers at all; the export path loaded the flattened
// `canvasPng` as a single layer and could therefore never tell the artboard
// Canvas apart from the photo.
//
// It is extracted rather than copied because this codebase has already paid for
// the copy once. `stripLiveAnnotations` in editPersistence.ts carries the same
// note: the local-save and cloud-save annotation maps were duplicated, drifted,
// and the cloud copy silently dropped all nine `shadow_*` fields (#22). A
// cross-device restore lost drop shadows while a local restore kept them. The
// restore direction has 25 text parameters and four shape kinds — strictly more
// surface to drift than the map that already did.
//
// The PNG decoder is injected because there are already three copies of it in
// the tree (useEngineCore.ts:34, openraster/import.ts:23, exportImage.ts's
// `decodeToRgba`) and this module should not become the fourth, nor force an
// import direction between lib/ and hooks/.
import type { ImageHorseTool } from "stamp_tool";
import type { PersistedLayer } from "@/lib/editPersistence";

/** Decode a PNG to raw RGBA. Signature matches the existing local helpers. */
export type PngDecoder = (
  png: Uint8Array,
) => Promise<{ rgba: Uint8ClampedArray; w: number; h: number }>;

/**
 * Replay `layers` (bottom → top, archive v5+) into `tool` and select
 * `activeLayerId`.
 *
 * ORDER MATTERS: `begin_layer_restore` clears history, so this must run before
 * any undo/redo snapshots are injected. Each layer's own text and shape
 * overlays are restored onto it without pushing history entries.
 *
 * `finish_layer_restore` is what promotes the bottom layer to `LayerKind::Canvas`
 * when the persisted document was an artboard — which is the single reason
 * `get_image_data_excluding_background()` can tell backing fill from photo. A
 * caller that skips this function and loads a flat composite gets one Content
 * layer and no way to exclude anything.
 *
 * No-op when `layers` is empty or absent (legacy pre-v5 archives), leaving the
 * caller's already-loaded flat canvas in place.
 */
export async function restoreLayerStack(
  tool: ImageHorseTool,
  layers: PersistedLayer[] | undefined,
  activeLayerId: number | undefined,
  decodePng: PngDecoder,
): Promise<boolean> {
  if (!layers || layers.length === 0) return false;

  tool.begin_layer_restore();
  for (const layer of layers) {
    const { rgba, w, h } = await decodePng(layer.png);
    tool.push_restored_layer(
      new Uint8Array(rgba.buffer as ArrayBuffer),
      w,
      h,
      layer.name,
      layer.visible,
      layer.opacity,
    );
    for (const a of layer.annotations ?? []) {
      tool.restore_text_annotation(
        a.text,
        a.font_size,
        a.r, a.g, a.b,
        a.bold,
        a.x, a.y,
        a.rotation_deg,
        a.background_kind ?? 0,
        a.bg_r ?? 255,
        a.bg_g ?? 255,
        a.bg_b ?? 255,
        a.bg_a ?? 255,
        a.bg_padding ?? 8,
        a.bg_corner_radius ?? 8,
        a.bg_tail ?? 0,
        a.shadow_box ?? false,
        a.shadow_text ?? false,
        a.shadow_r ?? 0,
        a.shadow_g ?? 0,
        a.shadow_b ?? 0,
        a.shadow_a ?? 0,
        a.shadow_dx ?? 0,
        a.shadow_dy ?? 0,
        a.shadow_blur ?? 0,
      );
    }
    for (const s of layer.shapes ?? []) {
      if (s.kind === 5) {
        tool.restore_pin_annotation(
          s.x0, s.y0, s.x1, s.y1,
          s.number ?? 0, s.r, s.g, s.b,
          s.label_kind ?? 0,
        );
      } else if (s.kind === 6) {
        const flat = new Float64Array((s.points ?? []).flat());
        tool.restore_polyline_annotation(flat, s.r, s.g, s.b, s.stroke_width);
      } else if (s.kind === 7) {
        const flat = new Float64Array((s.points ?? []).flat());
        tool.restore_bezier_annotation(
          flat, s.r, s.g, s.b, s.stroke_width,
          s.fill_kind ?? 0,
          s.fill_r ?? 0, s.fill_g ?? 0, s.fill_b ?? 0, s.fill_a ?? 0,
        );
      } else {
        tool.restore_shape_annotation(
          s.kind,
          s.x0, s.y0, s.x1, s.y1,
          s.r, s.g, s.b,
          s.stroke_width,
          s.arrow_style,
          s.fill_kind ?? 0,
          s.fill_r ?? 0, s.fill_g ?? 0, s.fill_b ?? 0, s.fill_a ?? 0,
          s.fill2_r ?? 0, s.fill2_g ?? 0, s.fill2_b ?? 0, s.fill2_a ?? 0,
          s.fill_angle ?? 0,
          s.fill_block ?? 0,
        );
      }
    }
  }
  const activeIdx = layers.findIndex((l) => l.id === activeLayerId);
  tool.finish_layer_restore(activeIdx >= 0 ? activeIdx : layers.length - 1);
  return true;
}
