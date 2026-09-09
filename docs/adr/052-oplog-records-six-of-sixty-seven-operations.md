# ADR-052: The op log records six of the engine's operation families, and the rest break it
Date: 2026-09-09   Status: draft

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

Record nothing new yet. Write down that the log's real coverage is six families
out of sixty-seven sites, that the gap degrades undo depth rather than
corrupting data, and that closing it is a per-operation cost.

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
  12 MP photo and moves one slider drops to ~10 undo steps and is not told.
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
