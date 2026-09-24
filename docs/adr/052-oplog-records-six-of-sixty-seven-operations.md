# ADR-052: The op log records six of the engine's operation families, and the rest break it
Date: 2026-09-09   Status: draft (decision extended 2026-09-11 — part 2 built, part 3 proposed; amended 2026-09-18 — part 2 is a status-bar readout, depth table corrected; amended 2026-09-24 — the #8 guess is half wrong, see the last section)

## Context

Backlog item 37 ("op-log recording") has been marked *ADR needed* without a
survey behind it. This is the survey.

The op log is the source of truth for undo/redo and content-addressed
persistence when it is healthy. `USE_OPLOG_PERSISTENCE` is `true`, so it is on
for every user. But the engine has **67 `snap()` call sites** — 67 distinct
user-visible operations, each taking exactly one undo snapshot — and only
**6 recording paths**:

| Recorded | Where |
|---|---|
| `Stroke` | `paint.rs:824` |
| `Blur` — the **brush** only | `effects.rs:214` |
| `Crop` | `lib.rs:2734` |
| `LayerMove` | `layer.rs:1078` |
| `PerspectiveWarp` | `layer.rs:1141` |
| Text / shape annotations | the sync diff, `lib.rs:1526` |

Everything else that mutates pixels on an in-scope document is unrecorded. The
tonal adjustments are the clearest case — six public methods, each of which
snapshots and then writes straight into the layer buffer:

```rust
pub fn adjust_saturation(&mut self, factor: f64) {
    self.snap("Saturation");
    filters::adjust_saturation(&mut self.layers[self.active].buf.data, factor);
}
```

`adjust_brightness`, `adjust_contrast`, `adjust_shadows`, `adjust_highlights`
and `adjust_sharpen` are the same shape. So are the whole-image blur, pixelate,
redact, both flips, both rotations, resize, canvas size, canvas border,
compress, quality, emoji and the red stamp.

**What happens then is designed, and that is the point.** ADR-013's
composite-hash check compares the log's replayed composite against the engine's
real one on the next undo or redo. An unrecorded op makes them disagree, the
check fails, `oplog_broken` is set, and snapshot undo takes over. Nothing
corrupts. But `oplog_broken` is reset in exactly three places — `lib.rs:992`,
`1081` and `2088` — and all three are document load or log restore. **Within a
session on one document it is sticky.** One nudge of the Brightness slider ends
op-log undo for that document until it is reloaded.

The fallback is not equivalent. Snapshot history is capped by
`DEFAULT_MAX_HISTORY = 50` *and* `DEFAULT_MAX_HISTORY_BYTES = 512 MB`, and on a
real photo the byte cap binds first:

| Image | One snapshot | Snapshots in 512 MB |
|---|---|---|
| 1024×1024 | 4 MB | 50 (count cap binds) |
| 4000×3000 (12 MP phone) | 48 MB | **~10** |
| 6000×4000 (24 MP) | 96 MB | **~5** |

> **Corrected 09-18-2026: the table above counts one layer, and a default
> document has two.** A photo imports as Canvas + Photo (ADR-016), and
> `Snapshot::bytes` (`src/history.rs`) adds up every layer's full buffer, the
> Canvas included. One step costs twice the column above:
>
> | Image | One step (Canvas + Photo) | Steps in 512 MB |
> |---|---|---|
> | 1024×1024 | 8 MB | 50 (count cap binds) |
> | 4000×3000 (12 MP phone) | 96 MB | **~5** |
> | 6000×4000 (24 MP) | 192 MB | **~2** |
>
> Where this ADR says "five to ten", "~10" or "about five", read ~5 for 12 MP
> and ~2 for 24 MP. Checked in the browser: a 2068×1385 two-layer document with
> the op log off shows "Undo 46%", which is 23 of 50 steps, the same as
> `floor(512 MB ÷ (2068 × 1385 × 4 × 2))`.

So on the images this app exists to edit, breaking the log takes undo depth from
the op history down to about five to ten steps, silently, the first time
somebody touches the Adjust panel.

Two further op variants — `FillRegion` and `Levels` — have full `apply`
implementations, serialization and tests, and **no producer**. `git log --all
-G "oplog_record.*Op::FillRegion"` returns nothing while the same query for
`Op::Crop` returns `a46c919`, so these were never wired rather than unwired.
They are not dormant recorders for the adjustments either: `Levels` is a
per-channel black/white/gamma LUT, which cannot express an additive brightness
shift (a positive delta needs a negative black point, and `black` is a `u8`),
and cannot express saturation at all, which is a cross-channel lerp against the
pixel's own luminance. There is no `pub fn levels` or `pub fn fill_region` for
the UI to call. They are ops for features the engine does not have.

## Decision

Two parts, and the second is now built.

**1. Record nothing new yet** — write down that the log's real coverage is six
families out of sixty-seven sites, that the gap degrades undo depth rather than
corrupting data, and that closing it is a per-operation cost.

**2. Make the degradation visible, which needs no format change** — DONE
(2026-09-11), and the way it shows changed on 09-18-2026 (see the amendment
below). It first shipped as a toast: `session/useOplogHealth.ts` warned once per
document, on the healthy → broken transition, that undo had fallen back to
snapshots. It is now a quiet status-bar readout, "Undo NN%", from
`session/useUndoDepth.ts` and `lib/undoDepth.ts`. This was
already named below as "the cheapest real improvement"; it is correct whichever
way part 3 lands, so it did not wait for it.

**3. PROPOSED, not yet decided: record the six tonal adjustments.** This ADR
originally stopped at "not yet" without saying what the next step should be,
which left item 37 and everything behind it with no direction. The proposal is
to record them, for a reason that is about the backlog rather than about the
log: leaving them unrecorded blocks **AA (macro / batch recording)** outright,
and it is almost certainly why **#8 (Time Machine DAG)** sits under "not doing"
with no ADR and no recorded reason — a branching history needs cheap branches,
and snapshot undo gives about five steps on a 24 MP photo. You cannot build a
DAG on a log that goes permanently stale the first time somebody moves a
slider.

So the choice is not "six ops now or six ops later". It is "six ops, or those
two items stay refused forever and the survey only made the refusal legible".
The cost is unchanged from what "Alternatives rejected" #1 says — six params,
six parity tests, a format bump and a `dexie-migration` question — and that is
a session of its own, not a rider on this one.

Adding an op is not one line. Each new variant needs a `Params` type, an
`apply` that calls the engine's own kernel rather than a re-derivation (the
standing rule in `ops.rs`'s header), a serialization version bump, a parity
test against the live path, and a recorder placed so it fires exactly once per
snapshot — the one-op-one-snapshot lockstep that a stray `snap()` already broke
once (#60/#61). Six adjustments is six of those.

The cheapest real improvement is not a new op at all: make the degradation
visible. Today it is silent, and the user's only symptom is that undo runs out
sooner than it used to.

## Consequences

+ Item 37 has a number behind it: **6 of 67**, not "some ops are missing".
+ The failure is bounded and known — the hash check means an unrecorded op
  costs undo *depth*, never pixels.
+ The two unreachable variants are settled: never wired, and not the fix for
  the adjustments even if they were.
- **The gap is still open, and this ADR does not close it.** A user who edits a
  12 MP photo and moves one slider drops to ~10 undo steps — but as of
  2026-09-11 they ARE told, which was the half of this that needed no format
  change. The depth is still lost; the silence is not.
- `oplog_broken` staying sticky for the session is now a documented choice
  rather than an unexamined one, which makes it harder to revisit casually.
- Writing the survey without the fix risks the survey being mistaken for the
  fix. The number in the title is there to stop that.

## Alternatives rejected

1. **Record all six adjustments now.** The right end state, and too large to
   ride on a survey — six params, six parities, a format bump, and a
   `dexie-migration` question about logs written by older builds.
2. **Reset `oplog_broken` on the next clean snapshot.** Sounds cheap, and would
   let a desynced log silently re-arm against a document it no longer matches.
   The stickiness is what makes the fallback safe.
3. **Wire `Op::Levels` to the adjustments.** Measured above: it cannot express
   them. It would record a different image than the one the user is looking at,
   which is worse than recording nothing.

## Pre-mortem

It is six months later and this was a mistake. Most likely reason: the survey
became the deliverable. "6 of 67" is a satisfying number to have written down,
item 37 gets ticked, and the adjustments still record nothing — so the first
real report is a user who lost work on a 24 MP scan because undo only went back
five steps and nobody could say why. The number made the gap legible without
making it urgent.

Early warning sign: a bug report about undo depth that gets closed as "working
as designed, see ADR-052". That is this ADR being used as a shield rather than
a plan.

## Amendment (09-18-2026): the warning is a readout, not a popup

**What changed.** Chris asked for the toast to go, because popups "make our app
look angry". Part 2 is now "Undo NN%" in the status bar, left of the size
readouts, always on screen. NN is estimated undo depth ÷ the History depth
setting:

- **100%** while the op log drives undo (`isOplogUndoEnabled() && oplog_active()`).
- Otherwise `floor(history_max_bytes ÷ (W × H × 4 × layerCount))` steps,
  clamped to 1..History depth. The floor is 1 because `History::trim` always
  keeps one copy.

The tooltip says it in plain words. It never turns red: a readout that alarms
is just the toast again.

**`history_max_bytes` finally has a caller.** `src/settings.rs` exported it in
#127 for this exact estimate, and nothing ever called it. The readout now reads
the 512 MB budget from Rust instead of keeping a second copy (PARKING_LOT entry
marked resolved).

**Costs.**
- A number in the corner is easier to miss than a toast. Nothing interrupts
  anymore, so the person who most needs to know may never hover it.
- It's an estimate, and it has to count exactly what `Snapshot::bytes` counts
  or it drifts from the eviction it predicts. The first cut left out one term
  — the selection mask, one byte a pixel, cloned into every snapshot — and
  read high with a selection active (the 2068×1385 document above keeps 20
  steps then, not 23). Caught in review and fixed before it shipped: the hook
  asks `has_selection()` and `snapshotBytes` adds W×H for it. Layer masks are
  still left out on both sides, because `Snapshot::bytes` leaves them out.

## Amendment (09-24-2026): #8 was not behind item 37, and half of it shipped

**What this ADR guessed.** The proposal above says leaving the adjustments
unrecorded "is almost certainly why **#8 (Time Machine DAG)** sits under 'not
doing'", and that "you cannot build a DAG on a log that goes permanently stale
the first time somebody moves a slider."

**What was actually true.** The first clause is the reasoning of a survey
looking at its own subject. #8 never needed the op log — it needed *some*
representation of an abandoned timeline, and the snapshot stack is one. What
the log buys is **cheap** branches; what was blocking #8 was the assumption
that expensive ones are unaffordable. They are not, if they are made to lose
every contest for memory against the undo stack, which is what ADR-065 does:
branches share the same 512 MB and are evicted before a single undo step.

**What is still true, and it is the second clause.** A branch made of
snapshots is ~96 MB a step on a 12 MP photo, so the Time Machine holds a few
forks on a small document and **nothing at all** on a 24 MP one — and none of
it survives a reload, because an append-only log that a snapshot restore marks
stale cannot persist a jump between timelines. Recording the six adjustments
(part 3 above) is exactly what turns a branch from document copies into
kilobytes of ops, and item 37 remains the unlock for the half of #8 that did
not ship.

**Why this matters beyond one backlog row.** This ADR's own pre-mortem warns
about being "used as a shield rather than a plan" — a bug closed as "working as
designed, see ADR-052". A feature parked as "blocked by item 37, see ADR-052"
is the same failure with a different name. The guess above was reasonable and
it was still a guess, written with no attempt to build the thing it ruled out;
the ruling then outlived the reasoning for two weeks. Where this ADR says a
backlog item is blocked, read it as a hypothesis with a test attached, not a
finding.
