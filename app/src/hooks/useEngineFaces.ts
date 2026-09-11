import { useEffect, useState } from "react";
import type { MutableRefObject } from "react";
import type { ImageHorseTool } from "stamp_tool";
import { ENGINE_FACES, resolveFacesWhenReady, type EngineFace } from "@/lib/engineFonts";

/**
 * The typefaces the ENGINE can actually render, for a font `<select>`.
 *
 * ⚠️ Use this rather than rendering `ENGINE_FACES` directly, in every panel,
 * always. Two rules ride on it and both are easy to break by accident:
 *
 *   1. **A face is only offered once its bytes are registered.** Measuring an
 *      unregistered face answers in the FALLBACK, and `textMetricsCache` would
 *      keep that wrong answer against the real id for the life of the page —
 *      text committing a few pixels off its own preview, with nothing to
 *      invalidate. `availableFaces` awaits registration before it reports.
 *   2. **There is one list.** #113 cut the Text tool's twelve-entry font
 *      dropdown to a single entry, because the engine took no font parameter
 *      and every choice was inert — and MISSED THE IDENTICAL COPY IN
 *      `BatchSettings`, which went on offering Georgia, Impact and Comic Sans
 *      for another eleven releases while every batch render came out in
 *      Liberation Sans. Two tables is how that happens. This is one.
 *
 * All the waiting logic is in `resolveFacesWhenReady`, deliberately — a ref is
 * not a dependency, and getting that wrong once already shipped a dropdown
 * stuck at a single entry. Read its comment before changing this.
 */
export function useEngineFaces(
  toolRef: MutableRefObject<ImageHorseTool | null> | undefined,
): EngineFace[] {
  const [faces, setFaces] = useState<EngineFace[]>([ENGINE_FACES[0]]);
  useEffect(
    () => resolveFacesWhenReady(() => toolRef?.current, setFaces),
    [toolRef],
  );
  return faces;
}
