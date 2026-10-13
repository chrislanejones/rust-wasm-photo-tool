# ADR-088: An undo is a gesture, and the op log marks which ops share one
Date: 2026-10-13   Status: draft   Relates to: ADR-052, ADR-059, ADR-070, ADR-082

## Context

One gesture takes one snapshot but can record several ops. A rounded
rectangle is `ShapeAdd` + `ShapeCornerRadii`. A star with other than 5 points
adds `ShapeStarPoints`, a sketchy shape adds `ShapeSloppiness`, a rotated one
`ShapeRotation`, and Duplicate Shape does the same. Op-log undo
(`try_oplog_undo`, `src/lib.rs`) rewound one op per press. So the first Ctrl+Z
after a rounded rectangle changed nothing on screen, and every undo after it
landed one gesture late. PARKING_LOT has carried this since 09-15 and 09-18.

#351 turns op-log undo on in every engine. Before, the replay switch only
reached the engine with Diagnostics open. Now everyone hits the bug.

The night plan offered (a) store the log cursor on each snapshot, no format
change, or (b) a marker op in the log, format v12, and said to use (b) only if
(a) can't survive a reload. It can't: `oplog_restore` clears the snapshot
stack, and undo then runs from the log alone. The same is true past the
snapshot cap.

## Decision

Both, and each checks the other.

1. **`Op::SameGesture`**, a unit variant appended at **index 22**,
   `OP_FORMAT_VERSION` **11 → 12**. `oplog_record`, the one function every op
   enters through, writes it in front of the second and every later op of a
   gesture. `snap()` resets the counter (`oplog_gesture_ops`). `apply` ignores
   it.
2. **`Snapshot.oplog_cursor: Option<usize>`**, the cursor when the snapshot
   was taken. In-session undo and redo seek to the popped snapshot's cursor.
   It is exact, and it is the only source that knows a gesture recorded
   nothing, so a gesture with no ops never moves the log or eats an undo.
3. **The markers take over when there is no snapshot** (after a reload, past
   the cap) or the snapshot came from a session restore (cursor `None`):
   `OpLog::gesture_undo_target` / `gesture_redo_target`.
4. **The lockstep guard stays, and gets stricter.** In `oplog_step_target`, if
   the snapshot's cursor is neither the current cursor (an empty step) nor the
   marker target, the log is marked broken and snapshot undo takes over, as
   before. The composite-hash sync check is unchanged.
5. `undo_count`, `redo_count` and `history_labels` count and label gestures
   (`gestures_before_cursor`, `gesture_labels`), not ops.

**Why a continuation marker, not the plan's GestureEnd or a GestureBegin:**

- A one-op gesture writes no marker. A stroke or a Levels apply is byte for
  byte what v11 wrote, and #351's two e2e specs, which assert exactly 1 op
  recorded, pass unedited. A marker on every gesture would have broken them.
- The marker and its op go in during the same call, so a log saved between
  any two calls is already grouped right. An end marker would be missing until
  the next gesture began, and a log saved mid-session would undo in pieces
  after a reload.
- An old v11 log continued in a new build reads one way only: unmarked ops are
  one step each, wherever they sit. A begin-only or end-only scheme can't tell
  where the old prefix ends.

**Compatibility.** Decode still accepts `2..=OP_FORMAT_VERSION`. No variant
moved or changed, no payload changed. A v11-or-older log has no markers and
undoes one op per press, exactly as before
(`a_v11_log_without_markers_undoes_one_op_per_press`). The captured fixture
tests (`oplog_v7_v8_fixture_resume.rs`, `oplog_v8_text_settings_replay.rs`,
`oplog_v3_resume.rs`) pass unedited.

**Evidence.** On #351's head (`f361fea9`), 8 Rust gesture tests and the
un-ignored star test were red, and `e2e/oplog-undo-shapes.spec.ts` was 5/5 red
(a rounded rectangle took 2 undos, a sloppy one 3). All green now; #351's
specs plus the new one are 21/21 at 4× CPU, 3 repeats. Mutations: no marker
written → 7 tests red; snapshot cursor ignored → 1 (the no-op gesture);
markers ignored → 6. Engine 892,897 → 893,494 B (+597).

## Consequences

+ One Ctrl+Z takes back one gesture, in-session and after a reload.
+ Recorded undo is now sound for multi-op gestures. ADR-052 left the six
  tonal sliders unrecorded (ADR-055 left presets the same way) partly because
  it wasn't; that blocker is gone.
- An older build can't read a v12 frame, same as every bump before it.
- Two sources of truth for one step. When they disagree the log goes broken
  and undo falls back to whole-image snapshots for the rest of the session.
- Index 22 was where ADR-082 said the tonal ops would start. They now start at
  23, and ADR-070 is amended to say so.
- Canvas recolor is metadata, not an op. Undoing it on the op-log path pops
  its snapshot without moving the log. That was true before; this doesn't fix
  it.

**Follow-ups, not done here.** `move_shape_annotation` and `reroute_connector`
(`src/annotations.rs`) send undo down the snapshot path on purpose because
they record several ops under one snapshot. They could stay on the op-log path
now. Tonal ops can ride this v12 bump if they land in the same release.

## Alternatives rejected

1. **Snapshot cursor only (plan option a).** No format change, but the
   snapshot stack is gone after `oplog_restore` and past the cap, so a reload
   brings the bug back.
2. **A GestureEnd or GestureBegin marker on every gesture.** Changes every
   one-op gesture's bytes, leaves an unclosed gesture in any log saved
   mid-session, and can't place the boundary in an old v11 prefix.

## Pre-mortem

It is six months later and this was a mistake. Most likely reason: a new
recording path appends to the log directly instead of going through
`oplog_record`, so its ops never get a marker. In-session undo still looks
right, because the snapshot cursor carries it, and the bug only shows after a
reload, where nobody tests. Early warning sign: a `log.append(` in `src/lib.rs`
other than `oplog_record` and `oplog_restore`, or an undo that is correct
before a reload and one step off after.
