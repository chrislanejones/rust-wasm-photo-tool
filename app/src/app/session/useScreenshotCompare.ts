// Screenshot comparison (Night 10-23): the open photo (B) against another
// gallery photo (A). Loads A's stored original once, asks the engine for the
// diff (`compare_photo`, in the engine's worker) whenever the sensitivity or
// B's pixels change, and marks the changes as ONE undo step
// (`mark_regions`). Lives here and in features/canvas/CompareBar, mounted by
// CanvasArea; AppShell gains nothing.
//
// What is compared is each photo's BASE pixels: A's stored original and B's
// photo layer. Annotations on either never count as changes, so last week's
// callouts on B do not show up as differences.
import { useCallback, useEffect, useRef, useState } from "react";
import type { ImageHorseTool } from "stamp_tool";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { useAnnotationStore } from "@/stores/useAnnotationStore";
import { useScreenshotCompareStore } from "@/stores/useScreenshotCompareStore";
import { compareBaselineKey } from "@/lib/compareBaseline";
import { getOriginal } from "@/lib/dexie/originalsAdapter";
import {
  MERGE_PX,
  MIN_AREA,
  markStyle,
  regionQuads,
  sizesDifferLine,
  toleranceFor,
  unpackDiff,
  type ScreenshotDiff,
} from "@/lib/screenshotDiff";

interface Options {
  toolRef: React.RefObject<ImageHorseTool | null>;
  flushToCanvas: () => void;
  syncState: () => void;
  /** Bumps when B's pixels may have changed (undo count + layer revision). */
  revision: number;
}

/** Photo A, decoded once per compare. */
interface PhotoA {
  id: string;
  url: string;
  w: number;
  h: number;
  px: Uint8Array;
}

export type CompareStatus = "idle" | "loading" | "ready" | "failed";

/** The color marks are drawn in: the Pins tool's default red. */
const MARK_COLOR = "#e03030";

async function decodeA(id: string, key: string): Promise<PhotoA> {
  const stored = await getOriginal(key);
  if (!stored) throw new Error("The other photo's original is missing");
  const blob = new Blob([stored.bytes], { type: stored.mimeType });
  const bmp = await createImageBitmap(blob);
  try {
    const canvas = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("No 2D context");
    ctx.drawImage(bmp, 0, 0);
    const data = ctx.getImageData(0, 0, bmp.width, bmp.height).data;
    return {
      id,
      url: URL.createObjectURL(blob),
      w: bmp.width,
      h: bmp.height,
      px: new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
    };
  } finally {
    bmp.close();
  }
}

export function useScreenshotCompare({ toolRef, flushToCanvas, syncState, revision }: Options) {
  const otherId = useScreenshotCompareStore((s) => s.otherId);
  const sensitivity = useScreenshotCompareStore((s) => s.sensitivity);
  const stop = useScreenshotCompareStore((s) => s.stop);
  const activeId = useGalleryStore((s) => s.activePhotoId);
  const other = useGalleryStore((s) => (otherId ? s.photos.find((p) => p.id === otherId) ?? null : null));
  const otherKey = compareBaselineKey(other);

  const [a, setA] = useState<PhotoA | null>(null);
  const [status, setStatus] = useState<CompareStatus>("idle");
  const [diff, setDiff] = useState<ScreenshotDiff | null>(null);
  /** B's photo inside the document: x, y, w, h. */
  const [bounds, setBounds] = useState<[number, number, number, number] | null>(null);
  const [marking, setMarking] = useState(false);

  // A photo switch ends the comparison (B is "the open photo"), and so does
  // A leaving the gallery or becoming the open photo itself.
  const startedOn = useRef<string | null>(null);
  useEffect(() => {
    if (!otherId) {
      startedOn.current = null;
      return;
    }
    if (startedOn.current === null) startedOn.current = activeId;
    if (activeId !== startedOn.current || activeId === otherId || !other) stop();
  }, [otherId, activeId, other, stop]);

  // Decode A once per comparison.
  useEffect(() => {
    if (!otherId || !otherKey) {
      setA(null);
      setDiff(null);
      setStatus("idle");
      return;
    }
    let live = true;
    let made: PhotoA | null = null;
    setStatus("loading");
    decodeA(otherId, otherKey).then(
      (photo) => {
        made = photo;
        if (live) setA(photo);
        else URL.revokeObjectURL(photo.url);
      },
      () => live && setStatus("failed"),
    );
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made.url);
      setA(null);
      setDiff(null);
    };
  }, [otherId, otherKey]);

  // Diff whenever A, the sensitivity or B's pixels change. A short wait so a
  // slider drag asks once it settles; a newer request makes an older answer
  // stale.
  const ask = useRef(0);
  useEffect(() => {
    const tool = toolRef.current;
    if (!a || !tool) return;
    const n = ++ask.current;
    const t = window.setTimeout(async () => {
      try {
        const b = Array.from(await tool.photo_bounds()) as [number, number, number, number];
        const packed = await tool.compare_photo(a.px, a.w, a.h, toleranceFor(sensitivity), MERGE_PX, MIN_AREA);
        if (n !== ask.current) return;
        setBounds(b);
        setDiff(unpackDiff(packed));
        setStatus("ready");
      } catch {
        if (n === ask.current) setStatus("failed");
      }
    }, 120);
    return () => window.clearTimeout(t);
  }, [a, sensitivity, revision, toolRef]);

  /** Box and pin every change, as one undo step. */
  const mark = useCallback(async () => {
    const tool = toolRef.current;
    if (!tool || !diff?.regions.length || !bounds) return;
    setMarking(true);
    try {
      const { stroke, pad, pin } = markStyle(bounds[2], bounds[3]);
      const ids = await tool.mark_regions(regionQuads(diff.regions), MARK_COLOR, stroke, pad, pin);
      if (!ids.length) return;
      flushToCanvas();
      syncState();
      useAnnotationStore.getState().bumpAnnotations();
    } finally {
      setMarking(false);
    }
  }, [toolRef, diff, bounds, flushToCanvas, syncState]);

  const sizesLine = a && bounds ? sizesDifferLine({ w: a.w, h: a.h }, { w: bounds[2], h: bounds[3] }) : null;

  return {
    active: otherId !== null,
    other,
    a,
    status,
    diff,
    bounds,
    sizesLine,
    marking,
    mark,
    stop,
  };
}

export type ScreenshotCompare = ReturnType<typeof useScreenshotCompare>;
