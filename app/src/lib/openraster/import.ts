// Rebuild the engine's layer stack from a .ora archive. See
// docs/OpenRaster-Export-Import.md for the format. v1 scope: name/opacity/
// visibility/active-layer survive; text/shape annotations were flattened at
// export time and are not restored as live objects (Phase 3).
import type { ImageHorseTool } from "stamp_tool";
import { parseStackXml } from "./stackXml";

/** A gallery-add function shaped like useImageSession's `handleAddPhotos` —
 *  kept as a narrow interface here so this module doesn't import the hook. */
type AddPhotosFn = (
  files: File[],
  opts?: { skipArtboard?: boolean },
) => Promise<void>;

const ORA_MIMETYPE = "image/openraster";

/** Decode a PNG Uint8Array → raw RGBA via the engine's own `png`-crate-backed
 *  decoder (`decode_png_to_rgba`), not the browser's OffscreenCanvas/2D-canvas
 *  path — export already goes through Rust (`get_layer_png`/`export_png`), so
 *  this keeps encode and decode on the same codec instead of round-tripping
 *  through two different ones that could disagree on alpha handling. Throws
 *  if `png` isn't a valid/decodable PNG. */
async function decodePngToRgba(
  png: Uint8Array,
): Promise<{ rgba: Uint8Array; w: number; h: number }> {
  const { default: init, decode_png_to_rgba } = await import("stamp_tool");
  await init(); // idempotent: returns the already-initialized wasm
  const decoded = decode_png_to_rgba(png);
  const { width: w, height: h, rgba } = decoded;
  decoded.free();
  return { rgba, w, h };
}

export async function importOra(
  file: File | Blob,
  tool: ImageHorseTool,
): Promise<void> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(file);

  const mimetypeEntry = zip.file("mimetype");
  if (!mimetypeEntry) {
    throw new Error("Not a valid .ora file — missing the mimetype entry.");
  }
  const mimetype = (await mimetypeEntry.async("string")).trim();
  if (mimetype !== ORA_MIMETYPE) {
    throw new Error(`Not a valid .ora file — mimetype was "${mimetype}".`);
  }

  const stackEntry = zip.file("stack.xml");
  if (!stackEntry) {
    throw new Error("Not a valid .ora file — missing stack.xml.");
  }
  const stack = parseStackXml(await stackEntry.async("string"));
  if (stack.layers.length === 0) {
    throw new Error("This .ora file's stack.xml has no layers to restore.");
  }

  // stack.xml is top-first; push_restored_layer expects bottom-first (the
  // engine's own convention — see docs/OpenRaster-Export-Import.md).
  const bottomFirst = [...stack.layers].reverse();
  const activeIndexBottomFirst =
    stack.activeIndex === null
      ? null
      : bottomFirst.length - 1 - stack.activeIndex;

  tool.begin_layer_restore();

  let restoredCount = 0;
  let firstDims: { w: number; h: number } | null = null;
  for (const layer of bottomFirst) {
    const entry = zip.file(layer.src);
    if (!entry) {
      console.warn(
        `[openraster] Skipping layer "${layer.name}" — "${layer.src}" is missing from the archive.`,
      );
      continue;
    }
    const png = await entry.async("uint8array");
    const { rgba, w, h } = await decodePngToRgba(png);
    if (firstDims === null) {
      firstDims = { w, h };
    } else if (w !== firstDims.w || h !== firstDims.h) {
      // push_restored_layer sizes the canvas from the FIRST pushed layer and
      // silently drops any later layer whose pixel count doesn't match — flag
      // it rather than let it fail silently.
      console.warn(
        `[openraster] Layer "${layer.name}" is ${w}x${h}, but the canvas is ` +
          `${firstDims.w}x${firstDims.h} — per-layer offsets/sizes aren't ` +
          `supported in this version; it may come in blank.`,
      );
    }
    tool.push_restored_layer(
      rgba,
      w,
      h,
      layer.name,
      layer.visible,
      layer.opacity,
    );
    restoredCount++;
  }

  if (restoredCount === 0) {
    console.warn(
      "[openraster] No layers could be restored from this .ora file — finishing with a blank Background layer.",
    );
  }

  // Fall back to the topmost (last-pushed) layer when no active marker was
  // present — matches the same fallback used for the session archive's
  // layer restore (useCloneStamp.loadFromSaved).
  const fallbackActive = Math.max(0, restoredCount - 1);
  tool.finish_layer_restore(activeIndexBottomFirst ?? fallbackActive);
}

/**
 * Import a .ora as a brand-new gallery item — never overwrites whatever
 * photo is currently active. Matches every other import funnel (Browse
 * Files, Paste, Sample Images, drag-drop), all of which add rather than
 * replace, and avoids silently discarding unsaved work in the current photo.
 *
 * Two-step: (1) add `mergedimage.png` — the .ora's own flattened composite —
 * as a normal new photo via `addPhotos`, explicitly skipping the "canvas
 * artboard" auto-padding preference. Skipping it is required, not optional:
 * `push_restored_layer` has no per-layer x/y offset, so the restored layers
 * must land on a canvas whose dimensions exactly match the .ora's own
 * `<image w h>` — any padding added in step 1 would silently misalign every
 * layer restored in step 2. (2) once that new photo is active, restore the
 * .ora's real per-layer stack over the single flattened layer step 1
 * produced, via the existing `importOra`.
 *
 * Takes the tool REF, not a resolved tool: the WASM instance may not exist
 * yet (an empty gallery hasn't initialized it) and `addPhotos` is what
 * creates/loads it — reading `.current` only after that await resolves is
 * what makes both the empty-gallery case and same-instance-reuse safe.
 */
export async function importOraAsNewPhoto(
  file: File,
  toolRef: { current: ImageHorseTool | null },
  addPhotos: AddPhotosFn,
): Promise<void> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(file);

  const mergedEntry = zip.file("mergedimage.png");
  if (!mergedEntry) {
    throw new Error("Not a valid .ora file — missing mergedimage.png.");
  }
  const mergedBlob = await mergedEntry.async("blob");
  const baseName = file.name.replace(/\.ora$/i, "") || "Imported project";
  const mergedFile = new File([mergedBlob], `${baseName}.png`, {
    type: "image/png",
  });

  await addPhotos([mergedFile], { skipArtboard: true });
  const tool = toolRef.current;
  if (!tool) {
    throw new Error(
      "Import succeeded in adding the photo, but the engine wasn't ready to restore its layers.",
    );
  }
  await importOra(file, tool);

  // Race guard: AppShell's "auto-select first photo when none is active"
  // effect can fire between `setPhotos` and `setActivePhotoId` inside
  // `addPhotos` (there's a real await gap between them), redundantly
  // reloading this same photo and replacing `toolRef.current` with a fresh,
  // un-restored `Tool` instance — discarding the restore above on an object
  // nothing renders. Detect it and redo the restore against whichever
  // instance is actually current. `importOra` fully rebuilds the stack from
  // the archive each time, so re-running it is safe, not incremental.
  if (toolRef.current && toolRef.current !== tool) {
    await importOra(file, toolRef.current);
  }
}
