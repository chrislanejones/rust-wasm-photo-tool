// Edits a panel is holding as a PREVIEW that must land before a photo switch
// (10-08). Enhance › Adjustments previews over an untouched copy and only
// bakes on Apply; without this, dragging Brightness and pressing PgDn an
// instant later dropped the edit (e2e photo-switch-state §0.6 / §0.7). The
// switch awaits `commitPendingEdits()` before it reads the undo count and
// saves the outgoing photo, so the save includes it.
type Committer = () => Promise<void>;

const committers = new Set<Committer>();

/** Register a panel's "bake what you are previewing" step. Returns the
 *  unregister function — pass it straight back from a useEffect. */
export function registerPendingCommit(fn: Committer): () => void {
  committers.add(fn);
  return () => {
    committers.delete(fn);
  };
}

/** Bake every registered preview, in order. Never throws: a failed commit
 *  must not strand the switch. */
export async function commitPendingEdits(): Promise<void> {
  for (const fn of [...committers]) {
    try {
      await fn();
    } catch (e) {
      console.warn("[pending-edits] commit before switch failed", e);
    }
  }
}
