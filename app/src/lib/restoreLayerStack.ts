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
import type { PersistedAnnotation, PersistedLayer, SavedEdit, SnapEntry } from "@/lib/editPersistence";
import { ensureEngineFontsForRestore } from "@/lib/engineFonts";

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
  /** ADR-112, the v7 restore: `keepHistory` rebuilds the stack without
   *  clearing the steps already stashed (`begin_layer_restore_keep_history`),
   *  `keepTextIds` gives each text its saved id back. Both off = today. */
  opts: { keepHistory?: boolean; keepTextIds?: boolean } = {},
): Promise<boolean> {
  if (!layers || layers.length === 0) return false;

  // REGISTER BEFORE YOU RESTORE. `restore_text_annotation` rasterizes on the
  // spot, and a `font_id` the engine has no bytes for is drawn in the embedded
  // Sans — so a Mono or Serif text came back proportional after every reload,
  // and in every batch/ZIP export, while its `font_id` stayed correct. Only
  // waited on when a saved text actually names a runtime face: a document with
  // no text, or only the embedded face, pays nothing. See
  // `ensureEngineFontsForRestore`.
  if (layers.some((l) => l.annotations?.some((a) => Boolean(a.font_id)))) {
    await ensureEngineFontsForRestore(tool);
  }

  if (opts.keepHistory) tool.begin_layer_restore_keep_history();
  else tool.begin_layer_restore();
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
      restoreStoredText(tool, a, { keepId: opts.keepTextIds });
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
          s.sloppiness ?? 0,
          // Absent on every save before triangle/rotation shipped: 0 is the
          // classic 5-point star and an upright shape, which is what they meant.
          s.starPoints ?? 0,
          s.rotation ?? 0,
          // Absent before corner radius shipped: square corners.
          Uint16Array.from(s.cornerRadii ?? []),
        );
      }
    }
  }
  const activeIdx = layers.findIndex((l) => l.id === activeLayerId);
  tool.finish_layer_restore(activeIdx >= 0 ? activeIdx : layers.length - 1);
  return true;
}

/** THE one place a stored text becomes an engine call (33a, ADR-024-F7).
 *
 *  Every way a saved text comes back goes through here: the layer stack on a
 *  resume (`restoreLayerStack`), the undo and redo snapshots re-injected after
 *  it (useEngineCore, with `set_text_restore_target`), the legacy flat archive
 *  and the batch export's throwaway engine. It used to be four argument lists:
 *  the history re-injection and the two legacy paths stopped at `font_id`, so
 *  each lost the box, the perspective, the shadow and the outline, and the
 *  first undo after an archive resume put a wrapped text back on one line.
 *  A field added below now reaches every path at once. */
export function restoreStoredText(
  tool: Pick<ImageHorseTool, "restore_text_annotation"> & Partial<Pick<ImageHorseTool, "set_text_restore_id">>,
  a: PersistedAnnotation,
  /** ADR-112: give the text its saved id back (a v7 restore). Off = a fresh
   *  id, today's behavior, which every older record keeps. */
  opts: { keepId?: boolean } = {},
): void {
  if (opts.keepId && a.id > 0) tool.set_text_restore_id?.(a.id);
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
    a.font_id ?? "",
    // ── The box and the quad — ADR-060 ─────────────────────────────────
    //
    // These three arguments are new in v8.81, and the reason they were not
    // here before is a premise that was measured FALSE. `layer.rs` carried
    // three comments saying the gap was fine because "the op-log path
    // (which DOES carry it, via Op::TextWrap) is the one the resume
    // actually uses". On production, 2026-09-20: in every run where the
    // user dragged the text box before the first save, NO op log was
    // persisted at all — so the resume landed here, on the path that
    // carried none of it, and the text came back unwrapped on one line.
    // (Why no log, found 11-09: the replay drew a wrapped text unwrapped,
    // so its pixels didn't match and the save retired the log. Fixed in
    // ops.rs `build_text_tile`; this path still has to carry the box.)
    //
    // Absent on every archive written before v8.81, which is what the
    // `?? 0` and the empty array mean: 0 is "size the box to the text" and
    // a wrong-length quad is "no perspective recorded". Both are exactly
    // what those documents meant, so an old archive restores unchanged.
    a.wrap_width ?? 0,
    a.box_height ?? 0,
    // Flat [x0,y0,x1,y1,x2,y2,x3,y3] — `annotations_to_json`'s own layout,
    // so the persisted array rides straight through. The engine reads any
    // length but 8 as the identity.
    new Float32Array(a.perspective ?? []),
    // The text outline. Absent on every archive written before it
    // existed: width 0 is "no outline", exactly what those meant.
    a.stroke_width ?? 0,
    a.stroke_r ?? 0,
    a.stroke_g ?? 0,
    a.stroke_b ?? 0,
    a.stroke_a ?? 0,
    // Line alignment (v16, ADR-104). Absent before it: 0, left.
    a.align ?? 0,
    // The box border (v17, ADR-109). Absent before it: width 0, none.
    a.border_width ?? 0,
    a.border_r ?? 0,
    a.border_g ?? 0,
    a.border_b ?? 0,
    a.border_a ?? 0,
  );
}

/** Whether `saved` takes the v7 restore (ADR-112): it was written with step
 *  layers in mind and has a live layer stack to build last. Anything else
 *  takes today's path, unchanged. */
export function isV7Saved(saved: SavedEdit): boolean {
  return saved.archiveVersion === 7 && (saved.layers?.length ?? 0) > 0;
}

/**
 * The v7 history restore (ADR-112): rebuild every saved undo and redo step as
 * a real document and stash it, oldest first, so an undo after the reload
 * gives back its shapes, layers and text ids instead of a flattened picture.
 *
 * Runs BEFORE the live document is built: each step is built live (keeping
 * the history so far), then moved into history with `stash_live_as_snapshot`.
 * The caller then builds the live document with `keepHistory`.
 *
 * A step without layers (written before v7 inside a v7 record, which a
 * reader can't rule out) is injected the old way: one layer from its PNG,
 * then its texts, so it is no worse than today. The undo stack is trimmed to
 * the budget as steps go in, so the texts go to the step's real index, not
 * its position in `saved`.
 */
export async function restoreSavedSteps(
  tool: ImageHorseTool,
  saved: SavedEdit,
  decodePng: PngDecoder,
): Promise<void> {
  const one = async (snap: SnapEntry, stack: 1 | 2) => {
    await tool.set_export_quality(snap.exportQuality ?? 75);
    if (snap.layers && snap.layers.length > 0) {
      await restoreLayerStack(tool, snap.layers, snap.activeLayerId, decodePng, { keepHistory: true, keepTextIds: true });
      await tool.stash_live_as_snapshot(stack, snap.label);
      return;
    }
    const { rgba, w, h } = await decodePng(snap.png);
    const px = new Uint8Array(rgba.buffer as ArrayBuffer);
    if (stack === 1) tool.inject_undo_snapshot(px, w, h, snap.label);
    else tool.inject_redo_snapshot(px, w, h, snap.label);
    if (snap.annotations) {
      const at = (stack === 1 ? await tool.undo_snapshot_count() : await tool.redo_snapshot_count()) - 1;
      tool.set_text_restore_target(stack, at);
      for (const a of snap.annotations) restoreStoredText(tool, a);
      tool.set_text_restore_target(0, 0);
    }
  };
  for (const snap of saved.undoStack) await one(snap, 1);
  for (const snap of saved.redoStack) await one(snap, 2);
}
