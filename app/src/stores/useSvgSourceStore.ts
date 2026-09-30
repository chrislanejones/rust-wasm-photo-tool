import { create } from "zustand";
import type { ImageHorseTool } from "stamp_tool";
import { recordCrop, type SvgSource } from "@/lib/svgPassthrough";
import { useGalleryStore } from "./useGalleryStore";

// Each SVG image's own markup and crop frames, for SVG → SVG export
// (lib/svgPassthrough.ts).
//
// The text here is NEVER rendered, decoded or put in the DOM — the editor only
// ever sees the rasterized PNG (lib/rasterizeSvg.ts). It is kept as a string
// and handed back to the user as a downloaded file, which is the same bytes
// they uploaded.
//
// NOT PERSISTED. A reload keeps the image (as its PNG) but drops this, and the
// SVG tile goes back to disabled for it. No IndexedDB change.

interface SvgSourceState {
  /** photo id → its SVG source. A photo with no entry is not an SVG. */
  sources: Record<string, SvgSource>;
  setSource: (photoId: string, src: SvgSource) => void;
  removeSource: (photoId: string) => void;
}

export const useSvgSourceStore = create<SvgSourceState>((set) => ({
  sources: {},
  setSource: (photoId, src) =>
    set((s) => {
      // Photos removed since are pruned on every write — cheap, and it keeps a
      // deleted image's markup from living on for the session.
      const live = new Set(useGalleryStore.getState().photos.map((p) => p.id));
      live.add(photoId);
      const next: Record<string, SvgSource> = {};
      for (const [id, v] of Object.entries(s.sources)) if (live.has(id)) next[id] = v;
      next[photoId] = src;
      return { sources: next };
    }),
  removeSource: (photoId) =>
    set((s) => {
      if (!(photoId in s.sources)) return s;
      const { [photoId]: _gone, ...rest } = s.sources;
      return { sources: rest };
    }),
}));

/**
 * Crop the live document and, when the active photo is an SVG, record the crop
 * so SVG export can frame the vector the same way. Every crop of the live
 * document goes through here — a crop that bypasses it is one the SVG export
 * cannot see, and the export then refuses the image rather than guess.
 */
export async function cropTracked(
  tool: ImageHorseTool,
  x: number,
  y: number,
  w: number,
  h: number,
): Promise<void> {
  const photoId = useGalleryStore.getState().activePhotoId;
  const src = photoId ? useSvgSourceStore.getState().sources[photoId] : undefined;
  if (!photoId || !src) {
    tool.crop(x, y, w, h);
    return;
  }
  const before = {
    undoCount: await tool.undo_count(),
    w: await tool.width(),
    h: await tool.height(),
  };
  tool.crop(x, y, w, h);
  const after = {
    undoCount: await tool.undo_count(),
    w: await tool.width(),
    h: await tool.height(),
  };
  useSvgSourceStore
    .getState()
    .setSource(photoId, recordCrop(src, before, { x, y, w, h }, after));
}
