// ── One commit, one undo step ─────────────────────────────────────────────────
//
// Committing a text is one engine call that creates or edits it, then setters
// for what that call can't carry (the face, the box's width and height). Each
// setter that changes something takes its OWN snapshot, so a dragged box
// committed as three undo steps. Worse, the op log records those setters as
// fewer gestures than that, so `undo_count` ran ahead of the log's cursor, the
// save read it as an edit missing from the log, and retired the log: a reload
// then came back from the archive instead (33a, ADR-024-F7).
//
// `joinedSetters` makes every setter after the first change JOIN the step
// that change opened (`continue_step`, ADR-088), so the commit is one step and
// one gesture.
//
// Two rules keep the join from leaking:
//   * Join only once THIS commit has changed something. A setter that changes
//     nothing takes no snapshot and would leave the join armed, so an
//     edit-only resize (the update call a no-op) would otherwise fold into the
//     PREVIOUS, unrelated step. The engine's edit revision says whether a step
//     is open; it moves on every history change, even at the undo cap, where
//     `undo_count` stops moving.
//   * The edit goes out in the same tick the commit starts, right behind the
//     revision read, so nothing the user does next can land in between.
//   * `continue_step` and the setter it joins go out in the same tick, with no
//     await between them, so no recomposite (which clears the join) can land
//     in between. The engine answers in order, on one queue.
// A join armed before a setter that turns out to be a no-op is cleared by the
// recomposite the commit ends with.

export interface StepTool {
  continue_step(): void;
  undo_count(): number | Promise<number>;
  oplog_edit_revision?(): number | Promise<number>;
}

async function revision(tool: StepTool): Promise<number> {
  return typeof tool.oplog_edit_revision === "function"
    ? await tool.oplog_edit_revision()
    : await tool.undo_count();
}

/** Run `first` (the call that creates or edits), then each setter with its
 *  result, as one undo step. Resolves with `first`'s result. */
export async function joinedSetters<T>(
  tool: StepTool,
  first: () => T | Promise<T>,
  setters: ReadonlyArray<(result: T) => unknown>,
): Promise<T> {
  // Both go out in this tick, the read first. Awaiting the read before
  // sending `first` delayed the edit by a round trip, and an Undo click in
  // that gap ran before it: the edit then re-applied what the undo took back
  // (e2e/text-placement-undo 1b). The engine answers in order, so the read
  // still sees the revision from before the edit.
  const beforeRead = revision(tool);
  const firstDone = first();
  const before = await beforeRead;
  const result = await firstDone;
  for (const set of setters) {
    const opened = (await revision(tool)) !== before;
    if (opened) tool.continue_step();
    await set(result);
  }
  return result;
}
