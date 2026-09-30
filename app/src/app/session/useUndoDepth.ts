import { useEffect, useState } from "react";
import type { useCloneStamp } from "@/hooks/useCloneStamp";
import { isOplogUndoEnabled } from "@/lib/tilesFlush";
import { estimateUndoDepth, getHistoryMaxBytes, type UndoDepth } from "@/lib/undoDepth";

/** Engine surface this hook needs. Optional on purpose — see below. */
interface UndoDepthWasm {
  oplog_active?: () => boolean | Promise<boolean>;
  has_selection?: () => boolean | Promise<boolean>;
}

/**
 * How deep undo can go right now — the status bar's "Undo NN%" (#37, ADR-052
 * part 2).
 *
 * THIS USED TO BE A TOAST. `useOplogHealth` fired "Fewer undo steps from
 * here" once per photo when the op log broke. The warning was right and the
 * medium was wrong: a popup on the first slider nudge reads as the app telling
 * you off. The readout carries the same news without interrupting — it drops
 * from 100% the moment undo falls back to whole-image copies, and stays there
 * to be read whenever you look.
 *
 * WHY IT DROPS. The op log records 6 of the engine's 67 snapshotting
 * operations. Everything else desyncs it, the hash check sets `oplog_broken`,
 * and undo falls back to whole-image copies capped at 512 MB. A default
 * document is Canvas + Photo — two full buffers per copy — so a 12 MP photo
 * gets ~5 steps and a 24 MP photo ~2, whatever the History depth setting says.
 *
 * `history_max_bytes` is the engine's own budget, read rather than copied:
 * it was exported for exactly this estimate in #127 and never called until
 * now (PARKING_LOT, 2026-09-12).
 *
 * ⚠️ FEATURE-DETECTED, NOT ASSUMED. `oplog_active` is `#[cfg(feature =
 * "tiles")]`. A featureless build has shipped to production before
 * (v7.36–v7.45); without the export the log cannot be driving undo, so the
 * estimate is the snapshot one — which is what that build really does.
 */
export function useUndoDepth(
  stamp: ReturnType<typeof useCloneStamp>,
  /** The History depth setting — the 100% mark. */
  maxHistory: number,
  /** The document this is about: the engine resets the log on load. */
  activePhotoId: string | null,
): UndoDepth | null {
  const [maxBytes, setMaxBytes] = useState<number | null>(null);
  const [depth, setDepth] = useState<UndoDepth | null>(null);

  useEffect(() => {
    let alive = true;
    void getHistoryMaxBytes()
      .then((n) => {
        if (alive) setMaxBytes(n);
      })
      .catch(() => {
        // No wasm, no budget to measure against — show nothing rather than
        // a number built on a guess.
      });
    return () => {
      alive = false;
    };
  }, []);

  const { ready, width, height, layers, undoCount } = stamp.state;
  const layerCount = layers.length;

  useEffect(() => {
    if (!ready || maxBytes == null || width <= 0 || height <= 0) return;
    let cancelled = false;
    const tool = stamp.toolRef.current as UndoDepthWasm | null;

    void (async () => {
      let logDriven = false;
      let hasSelection = false;
      try {
        // AWAITED: behind the worker proxy this is a Promise, and a Promise
        // is truthy — an un-awaited read would call every document healthy.
        logDriven = isOplogUndoEnabled() && !!(await tool?.oplog_active?.());
        // Every copy carries the selection mask too. Selecting and deselecting
        // are undo steps of their own, so `undoCount` re-runs this for them.
        hasSelection = !!(await tool?.has_selection?.());
      } catch {
        // A build without the op log answers nothing: snapshot undo it is.
      }
      if (cancelled) return;
      setDepth(
        estimateUndoDepth({ width, height, layerCount, hasSelection, maxHistory, maxBytes, logDriven }),
      );
    })();
    return () => {
      cancelled = true;
    };
    // `undoCount` is the trigger, not an input: every one of the 67
    // unrecorded operations snaps, so it moves on exactly the edits that can
    // break the log.
  }, [stamp, ready, maxBytes, width, height, layerCount, maxHistory, activePhotoId, undoCount]);

  return ready ? depth : null;
}
