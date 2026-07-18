# ADR-012: The op log replays over a document (pixels + live annotation lists), not the flattened composite
Date: 2026-07-11   Status: Accepted (2026-07-17 — four-check A/B on the
flipped defaults; engine-vs-replay parity green incl. the app's exact
import flow, `app_flow_stroke_persist_restore_keeps_the_canvas`)

## Context
Op replay (ADR-003) needs a definition of "the state ops apply to."
The engine keeps pixels and live text/shape annotations separate
(`Layer.buf` + annotation vecs); a flattened-composite log would bake
text on `TextAdd` and could never replay `TextRemove` (you cannot
unbake pixels), and strokes painted UNDER live annotations would
replay wrong.

## Decision
`ops::Document = { pixels: TileBuffer, texts: Vec<TextParams>, shapes:
Vec<ShapeParams> }` — the same split the engine keeps. Pixel ops call
the engine's own kernels (shared pure functions, not re-derivations);
annotation ops are list mutations with full-fidelity serialized
params. The user-visible canvas is a render of that document through
the engine's own compositor calls. Persisted keyframes store the
pixel plane + encoded annotation lists, never the flattened result.

## Consequences
+ Engine-vs-replay byte parity holds for every implemented op
  (src/ops_engine_parity.rs), and annotations stay re-editable across
  persist→restore.
- TextParams/ShapeParams are now frozen serialization contracts —
  every future annotation field must be added compatibly (format
  version byte guards decode).
- Ops the document model can't express (masks, multi-layer structure)
  stay unrecordable until the model grows.

## Alternatives rejected
Composite-only log — simplest, but TextRemove/TextEdit become
unreplayable and paint-under-annotation diverges; rejected on
correctness.

## Pre-mortem
It is six months later and this decision was a mistake. Most likely
reason: the full-fidelity param mirrors drifted from the engine's
annotation structs as fields were added to one but not the other,
making old logs replay subtly wrong. Early warning sign: an
engine-parity test needing a field it can't find on the params
struct, or a new annotation feature shipping without a params-field
PR touching ops.rs.
