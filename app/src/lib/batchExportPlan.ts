// Which source a photo's ZIP entry comes from, for batch export.
//
// WHY THIS FILE EXISTS. v7.81 fixed a data-loss bug by DELETING a gate, and a
// deletion leaves nothing a test can hold onto. The bug: `exportPhotosToZip`
// decided whether a photo was worth looking up using
//
//   modifiedPhotos.has(id) || imageSavings[id] != null
//     || (id === activePhotoId && (undoCount > 0 || hasBeenModified))
//
// Every term there is transient React state. A page reload clears all of them
// while the saved edit sits in IndexedDB, so after "Resume editing" the gate
// said "untouched" and the archive shipped the ORIGINAL. `loadPhotoEdit` was
// never called. Reported v7.68, survived two months and two investigations,
// because edit-then-export-immediately is correct and that is what every quick
// test does — only a reload in between breaks it.
//
// The fix was right and it shipped with no test, because the failure only
// appears across a page reload and vitest cannot stage one. This module is the
// part that CAN be tested: the decision itself, lifted out of a 130-line
// callback inside a 2,800-line component, taking storage and nothing else.
//
// THE SIGNATURE IS THE GUARANTEE. `resolveExportSource` has no parameter for
// session state, so it cannot consult any. The regression is not merely
// untested now, it is unrepresentable here — a reviewer re-adding a gate has to
// do it somewhere this function cannot see, which is what
// `batchExportPlan.contract.test.ts` watches for.
//
// WHY PER-PHOTO AND NOT A "which photos have edits" LIST. Two reasons, both
// found by trying the list first:
//
//  1. `loadPhotoEdit` reads IndexedDB and then falls back to CONVEX for a
//     signed-in user (see `useEditPersistence.ts`). A list built from the local
//     edit store's keys would report "no edit" for someone whose edit lives
//     only in the cloud — new device, cleared cache — and ship them the
//     original. That is the very bug this module exists to pin, reintroduced by
//     the refactor meant to test it.
//  2. A list would have to hold every photo's edit at once. One edit row
//     deserialises every undo/redo snapshot PNG it contains; reading a handful
//     at a time has crashed the tab before. Resolving one photo at a time keeps
//     the memory profile identical to the loop it replaced.

/** Where a photo's exported bytes come from. */
export type ExportSource = "edit" | "original";

export interface ExportDecision<TEdit> {
  photoId: string;
  /** `"edit"` → composite `edit` and re-encode. `"original"` → ship verbatim. */
  source: ExportSource;
  /** The loaded edit when `source` is `"edit"`, otherwise `null`. Handed back
   *  so the caller does not read storage a second time. */
  edit: TEdit | null;
}

/**
 * Decide how one photo is exported, from storage alone.
 *
 * `loadEdit` is the only input that can say a photo was edited. Pass the
 * session's `loadPhotoEdit` (IndexedDB, then Convex when signed in) — anything
 * that outlives a reload. There is deliberately no parameter for
 * `modifiedPhotos`, `imageSavings`, `undoCount`, `hasBeenModified` or
 * `activePhotoId`; those are what made the original bug possible.
 *
 * A photo with no stored edit ships its original bytes, which is correct in
 * both cases that reach it: never edited (the original is the upload) and
 * compressed-only (the original key already holds the processed bytes). Those
 * two branches being byte-identical is why the deleted gate was only ever an
 * optimisation — it decided whether to spend one read, never what to ship.
 */
export async function resolveExportSource<TEdit>(
  photoId: string,
  loadEdit: (photoId: string) => Promise<TEdit | null>,
): Promise<ExportDecision<TEdit>> {
  const edit = await loadEdit(photoId);
  return edit
    ? { photoId, source: "edit", edit }
    : { photoId, source: "original", edit: null };
}
