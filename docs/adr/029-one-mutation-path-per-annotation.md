# ADR-029: A committed annotation has ONE mutation path, and a stale UI snapshot is fixed in the UI
Date: 2026-08-04   Status: draft

## Context

"Draw a square, click it again, change the colour — nothing happens" survived
seven weeks and was reproduced on production. The brief for the fix specified a
new engine export, `set_shape_color(id, r, g, b)`, on the premise that "the
mutation path for the reselected shape doesn't exist."

It does. `update_shape_annotation(id, …)` in `src/annotations.rs` has existed
throughout: it rejects unknown ids, calls `snap("Edit Shape")` so the change is
one undo step, and writes r/g/b into the annotation record, which is what
persistence, op-log restore and `render_with_annotations` (the export buffer)
all read. Its own doc comment already says it is for "a drag/resize **or panel
restyle** of a selected shape." Both blockers were in React: `selectShape`
snapshots the shape's style into `editState.style`, that snapshot outranked the
live panel (`es.style?.strokeColor ?? s.strokeColor`), and `editDirtyRef` was
set only by a handle drag, so a colour-only edit took `commitEdit`'s no-op early
exit and never reached the engine at all.

## Decision

No new engine export. The panel's change is routed to the call that already
exists, by treating the reselect snapshot as a **default rather than an
override**: `panelStylePatch` diffs the panel against its own previous value and
copies across only the fields the user just changed, marking the edit dirty so
`commitEdit` reaches `update_shape_annotation`. The general rule this records:
**one mutation path per annotation kind.** A second, thinner engine entry point
is not how a stale UI snapshot gets fixed.

## Consequences

+ Undo, reload and export work with no new engine code, because they were never
  broken — the one path already snaps history and writes annotation data. Pinned
  by `tests/shape_recolour.rs` (8) and `useDrawingTools.test.ts` (9).
+ wasm is unchanged at 761,213 B. A `set_shape_color` would have added an export
  and its glue for capability the binary already shipped.
+ Stroke width, arrow style and the four fill controls are fixed by the same
  diff, because they had the identical blocker.
- The fix is a `useEffect` watching `settings`, so the restyle lands on the
  render after the panel click rather than synchronously in the click handler.
- `panelStylePatch` must be kept in step with the fields in `DrawEditState`
  `style`. A newly added style control that is not listed there will silently
  fail to reach a reselected shape — the original bug, one field wide.
- `shape`/`kindByte` is deliberately excluded, so retyping a committed shape
  (square → circle) is still not possible from the panel. Unchanged, not fixed.

## Alternatives rejected

1. **Add `set_shape_color(id, r, g, b)` as briefed.** It would duplicate a
   strict subset of `update_shape_annotation`, need its own `snap()` to keep
   undo, and cover neither fill nor gradient — so recolouring a filled rect
   would still need the other call, leaving two paths that must agree.
2. **Have the settings panel hold the selected shape's id and write to the
   engine directly.** The panel has no id today and does not need one:
   `onPlace(cell)` is the existing precedent for "act on the selection" without
   it, and AppShell already owns `editState.editId`. Pushing engine calls into a
   settings component also crosses the boundary that keeps pixel work behind the
   commit path.
3. **Drop the reselect snapshot so the panel always wins.** Simplest, and wrong:
   clicking a red square would instantly repaint it with the panel's current
   colour. The snapshot is exactly what stops that.

## Pre-mortem

It is six months later and this decision was a mistake. Most likely reason: the
list of style fields in `panelStylePatch` is a hand-maintained mirror of
`DrawEditState["style"]`, and nothing enforces it. Someone adds a shadow or a
dash pattern to the Shapes panel, wires it through `ToolSettings` and the
snapshot, and never touches the patch function — so the new control works on
fresh shapes and silently does nothing on reselected ones. That is this exact
bug returning one field at a time, and it will be reported the same way: "the
colour works but the dashes don't." The honest case for the rejected
`set_shape_color` is that a narrow, explicit `(id, value)` call is harder to
forget than an entry in a diff table.

Early warning sign to watch for: a new field in `DrawEditState["style"]` whose
name does not also appear in `panelStylePatch`. That is mechanically checkable —
if a third field is ever added without it, replace the hand-written diff with
one derived from a single field list rather than adding a fourth.

## Follow-up — the pre-mortem was right that the diff was the weak point, and wrong about how (2026-08-04, same day)

Found in user testing within hours of v7.63 shipping: *"the colour changes of
shapes are not in history."*

The pre-mortem predicted the diff table going stale as fields were added. The
actual failure needed no new field at all. `panelStylePatch` diffs the panel
against **its own previous value**, and reselect did not sync the panel to the
shape — so the panel kept whatever was last used. Reselect an orange shape while
the panel still reads purple, click purple because purple is what you want, and
the panel's value does not change. The diff returned `null`, the edit was never
marked dirty, the shape stayed orange, and nothing reached history. Reproduced
in a browser: panel showing purple as selected, shape still drawn orange.

The decision above still holds — one mutation path, fixed in the UI — but it
rested on an unstated assumption: *a panel value change means the user changed a
control*. That was false while the panel could disagree with the selection.

`selectShape` now loads the reselected shape's style into `ToolSettings` (via
`useToolStore.getState().setToolSettings`) and seeds the diff baseline with the
same values, so the sync is not itself read as an edit. That makes the
assumption true by construction, and has two further consequences worth stating:
the panel stops lying about what is selected, and the baseline becomes the
SHAPE's style — so changing only the stroke width can no longer drag a stale
panel colour along with it, which the original diff would have done.

Pinned by two regression tests in `useDrawingTools.test.ts` named for the
symptom. The lesson generalises past this bug: **a diff-based "what did the user
change" signal is only as good as the guarantee that the thing being diffed
starts in sync with the thing being edited.** Seed the baseline at selection
time, or do not diff.
