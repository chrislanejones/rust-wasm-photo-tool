import { useEffect, useRef } from "react";
import type { useCloneStamp } from "@/hooks/useCloneStamp";
import { toast } from "@/components/ui/sonner";

/** Engine surface this hook needs. Both are optional on purpose — see below. */
interface OplogHealthWasm {
  oplog_is_broken?: () => boolean | Promise<boolean>;
}

/**
 * Say it out loud when undo gets shallower (#37, the half of ADR-052 that
 * needs no format change).
 *
 * THE PROBLEM THIS FIXES IS SILENCE, NOT CORRUPTION. The op log records 6 of
 * the engine's 67 snapshotting operations. Everything else — every tonal
 * adjustment, both flips, both rotations, resize, compress — desyncs the log
 * on the next undo. ADR-013's composite-hash check catches that, sets
 * `oplog_broken` and falls back to snapshot undo, so no pixels are ever wrong.
 *
 * What the user loses is DEPTH, and the byte cap is what makes it bite:
 *
 *   1024×1024   4 MB/snapshot   → 50 steps (the count cap binds)
 *   4000×3000  48 MB/snapshot   → ~10 steps
 *   6000×4000  96 MB/snapshot   → ~5 steps
 *
 * So on the photos this app exists to edit, one nudge of the Brightness slider
 * takes undo from the whole op history down to about five steps, with no
 * symptom until you run out. ADR-052's own pre-mortem names that as the way
 * this goes wrong: "a user who lost work on a 24 MP scan because undo only
 * went back five steps and nobody could say why."
 *
 * ONE TOAST PER DOCUMENT. `oplog_broken` is sticky for the session and resets
 * only on load or log restore, so the transition happens at most once per
 * photo — warning on every subsequent edit would be noise about a state that
 * is not changing.
 *
 * ⚠️ FEATURE-DETECTED, NOT ASSUMED. `oplog_is_broken` is `#[cfg(feature =
 * "tiles")]`. The shipped wasm is built with it, but a featureless build has
 * shipped to production before (v7.36–v7.45), and a hook that throws on a
 * missing export would take the editor down with it. Absent ⇒ stay quiet.
 */
export function useOplogHealth(
  stamp: ReturnType<typeof useCloneStamp>,
  /** The document this is about — resets the latch, because the engine resets
   *  `oplog_broken` on load too. */
  activePhotoId: string | null,
  /** Bump on anything that could have desynced the log. `undoCount` is the
   *  right signal: every one of the 67 unrecorded operations snaps. */
  undoCount: number,
) {
  const warnedFor = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tool = stamp.toolRef.current as OplogHealthWasm | null;
    if (!tool?.oplog_is_broken) return;
    // Already said it for this photo.
    if (warnedFor.current === activePhotoId) return;

    void (async () => {
      try {
        // AWAITED: behind the worker proxy this is a Promise, and a Promise is
        // truthy — an un-awaited read would fire the warning on every photo,
        // healthy or not.
        const broken = await tool.oplog_is_broken!();
        if (cancelled || !broken) return;
        warnedFor.current = activePhotoId;
        toast("Undo history is shallower now", {
          description:
            "That edit isn't one the fast log records, so undo falls back to " +
            "full snapshots — fewer steps on a large photo.",
        });
      } catch {
        // A build without the op log answers nothing. Stay quiet.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stamp, activePhotoId, undoCount]);
}
