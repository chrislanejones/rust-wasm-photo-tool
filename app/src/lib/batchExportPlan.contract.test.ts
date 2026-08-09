// Regression cover for the v7.81 batch-export data-loss bug.
//
// THE BUG. `Alt+Shift+E` → photos.zip shipped the ORIGINAL files and silently
// discarded every edit, but only when the page had been reloaded since the edit
// was made. Reported v7.68 (2026-08-06), fixed v7.81 (2026-08-09), two months
// and two investigations in between. It read as intermittent because
// edit-then-export-immediately is correct — which is exactly what every quick
// manual check does.
//
// WHY IT SHIPPED UNTESTED. The failure only appears ACROSS A PAGE RELOAD:
// transient React state (`modifiedPhotos`, `imageSavings`, `undoCount`,
// `hasBeenModified`) is cleared while the saved edit survives in IndexedDB.
// vitest cannot stage a reload, so the fix was verified by a manual browser run
// that will never run again. Since then the code underneath it has been
// substantially rewritten twice — v7.84 moved both save paths onto
// `capture_state()`, v7.88 moved the export paths onto `capture_composite*()`.
// The suite would not have noticed the bug coming back.
//
// WHAT IS TESTABLE WITHOUT A RELOAD. A reload's only relevant effect is that
// session state is empty while storage is populated. That state is reachable
// directly: call the decision with a populated store and no session state at
// all. Which is the whole point of `resolveExportSource` taking no session
// state — the post-reload condition is its ONLY condition.
//
// TWO HALVES, AND BOTH ARE LOAD-BEARING. The behavioural tests prove the
// decision reads storage. They cannot see a gate re-added UPSTREAM of the
// call — `if (!modifiedPhotos.has(id)) continue;` in AppShell would restore the
// bug with every test here still green. The source-level test covers that, in
// the same style and for the same reason as `engineOwnership.contract.test.ts`:
// the failure is silent, and by the time behaviour can see it the archives are
// already wrong.
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveExportSource } from "./batchExportPlan";

/** Stand-in for a stored archive. The real `SavedEdit` carries canvas PNG plus
 *  every undo/redo snapshot; nothing here depends on its shape. */
interface FakeEdit {
  canvasW: number;
  canvasH: number;
}

/** A store that outlives the session, the way IndexedDB does. */
function storeWith(entries: Record<string, FakeEdit>) {
  const loadEdit = vi.fn(
    async (photoId: string): Promise<FakeEdit | null> => entries[photoId] ?? null,
  );
  return loadEdit;
}

describe("batch export decides from storage, not session state", () => {
  it("finds an edit that only storage knows about — the post-reload case", async () => {
    // THE EXACT CONDITION THAT FAILED. After a reload and "Resume editing":
    // the stroke is visibly on the canvas, `undoCount` is back to 0 and
    // `modifiedPhotos` is empty — but the archive is in IndexedDB. The old gate
    // consulted the empty session state and never asked storage anything.
    const loadEdit = storeWith({ "photo-a": { canvasW: 2068, canvasH: 1603 } });

    const decision = await resolveExportSource("photo-a", loadEdit);

    expect(decision.source).toBe("edit");
    expect(decision.edit).toEqual({ canvasW: 2068, canvasH: 1603 });
    // Storage was actually consulted. Without this the test passes for a
    // function that guesses "edit" unconditionally.
    expect(loadEdit).toHaveBeenCalledWith("photo-a");
  });

  it("ships the original when storage has no edit", async () => {
    const loadEdit = storeWith({ "photo-a": { canvasW: 2068, canvasH: 1603 } });

    const decision = await resolveExportSource("photo-b", loadEdit);

    expect(decision.source).toBe("original");
    expect(decision.edit).toBeNull();
  });

  it("decides each photo independently across a mixed batch", async () => {
    // The shipped repro: two photos, one stroked. The bug produced originals
    // for BOTH; a decision that ignores the photo id would produce edits for
    // both and pass a single-photo test.
    const loadEdit = storeWith({
      "photo-a": { canvasW: 2068, canvasH: 1603 },
      "photo-c": { canvasW: 800, canvasH: 600 },
    });

    const plan = [];
    for (const id of ["photo-a", "photo-b", "photo-c"]) {
      plan.push(await resolveExportSource(id, loadEdit));
    }

    expect(plan.map((p) => p.source)).toEqual(["edit", "original", "edit"]);
    expect(plan.map((p) => p.photoId)).toEqual(["photo-a", "photo-b", "photo-c"]);
  });

  it("treats a cloud-only edit as an edit", async () => {
    // `loadPhotoEdit` reads IndexedDB and then falls back to Convex when signed
    // in. On a new device or after a cleared cache the edit exists ONLY in the
    // cloud, and the local edit store's keys would say "untouched". The
    // decision must follow whatever the loader returns, not a local index —
    // this is why there is no "which photos have edits" list helper.
    const cloudOnly = vi.fn(async (id: string) =>
      id === "photo-a" ? { canvasW: 100, canvasH: 100 } : null,
    );

    expect((await resolveExportSource("photo-a", cloudOnly)).source).toBe("edit");
  });

  it("lets a storage failure surface instead of silently shipping originals", async () => {
    // The bug's signature was silence: a wrong archive, no error. If storage
    // throws, that must not be swallowed into "no edit" — that would recreate
    // the exact failure mode with a different cause.
    const broken = vi.fn(async () => {
      throw new Error("IndexedDB unavailable");
    });

    await expect(resolveExportSource("photo-a", broken)).rejects.toThrow(
      "IndexedDB unavailable",
    );
  });
});

describe("no session-state gate has been re-added upstream", () => {
  // Comments stripped: this file and AppShell both DISCUSS the old gate by
  // name, and a guard satisfied by its own documentation guards nothing.
  const source = readFileSync(join(process.cwd(), "src/app/AppShell.tsx"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

  /** `exportPhotosToZip`'s whole body. Scoped to the function deliberately:
   *  `modifiedPhotos` is legitimate elsewhere in AppShell, so a whole-file scan
   *  would be permanently red. */
  function exportBody(): string {
    const start = source.indexOf("const exportPhotosToZip");
    expect(start, "exportPhotosToZip not found — did it move or get renamed?").toBeGreaterThan(-1);
    const end = source.indexOf("const handleExportAll", start);
    expect(end, "could not find the end of exportPhotosToZip").toBeGreaterThan(start);
    return source.slice(start, end);
  }

  /** Just the per-photo loop — where the bug lived.
   *
   *  The distinction this draws is the whole point, and the first version of
   *  this test missed it. `undoCount` and `hasBeenModified` ARE read by this
   *  function, legitimately, in the few lines BEFORE the loop:
   *
   *    const activeChanged = !!activePhotoId && (undoCount > 0 || hasBeenModified);
   *    if (activeChanged …) await savePhotoEdit(activePhotoId, …);
   *
   *  That is the opposite of the bug. It pushes the active photo's in-progress
   *  work INTO storage so the loop can read every photo uniformly. Reading
   *  session state to decide what to SAVE is fine; reading it to decide what to
   *  LOAD is what shipped originals. So those two are banned inside the loop
   *  only, while `modifiedPhotos` and `imageSavings` — which have no legitimate
   *  use anywhere here — are banned across the whole function. */
  function exportLoopBody(): string {
    const body = exportBody();
    const loop = body.indexOf("for (const photo of list)");
    expect(loop, "the per-photo export loop was not found").toBeGreaterThan(-1);
    // Stop before the useCallback dependency array. It lists `hasBeenModified`
    // and `stamp` because the PRE-loop flush genuinely depends on them, and
    // React requires that — a dep entry is bookkeeping, not a decision. Left
    // in, this test would be permanently red for the one reason that is
    // correct.
    const deps = body.lastIndexOf("\n    },\n    [");
    expect(deps, "could not find the useCallback dependency array").toBeGreaterThan(loop);
    return body.slice(loop, deps);
  }

  it("still routes the decision through resolveExportSource", () => {
    // The helper being imported is not enough — an unused export is exactly
    // the trap `useExport.generateThumbnail` turned out to be (v7.88). This
    // asserts the ZIP path actually calls it.
    expect(
      exportBody(),
      "exportPhotosToZip no longer calls resolveExportSource — the tested decision is bypassed",
    ).toContain("resolveExportSource(");
  });

  const WHY =
    "That is how the v7.81 data-loss bug worked: the saved edit survived the " +
    "reload and the gate deciding whether to read it did not, so the archive " +
    "shipped the ORIGINAL. Decide from storage — see lib/batchExportPlan.ts.";

  it.each([
    ["modifiedPhotos", "only written when you LEAVE a photo, and cleared by a reload"],
    ["imageSavings", "compression bookkeeping, cleared by a reload"],
  ])("never consults %s anywhere in the export (%s)", (identifier) => {
    expect(
      exportBody(),
      `exportPhotosToZip reads \`${identifier}\`, which a page reload clears. ${WHY}`,
    ).not.toContain(identifier);
  });

  it.each([
    ["undoCount", "reset by a reload"],
    ["hasBeenModified", "cleared by a reload"],
  ])("does not consult %s inside the per-photo loop (%s)", (identifier) => {
    expect(
      exportLoopBody(),
      `The per-photo export loop reads \`${identifier}\`, which a page reload ` +
        `clears. Using it BEFORE the loop to flush the active photo into ` +
        `storage is fine and expected; using it to decide what to load is the ` +
        `bug. ${WHY}`,
    ).not.toContain(identifier);
  });
});
