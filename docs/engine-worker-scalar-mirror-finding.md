# Phase 1a — the scalar mirror: a finding, not a mirror

**Status: STOPPED DELIBERATELY. No mirror was built. No call site was changed.**
Measured 2026-08-05 against `v7.67` (`a599e1a`).

The brief asked for a synchronous mirror of ~25 cheap scalars, so that the
value-consumed-synchronously count would drop from 117 to something that makes
the engine-in-worker migration worth starting. It set the bar itself: *"117 → ~90
is a different project than 117 → 112."*

**The achievable number is 117 → 109.** Eight sites. That is the finding, and it
lands on the wrong side of the bar the brief drew.

---

## 1. The mirror already exists, and it already has one publisher

The brief's central worry — *"the mirror must have exactly one publisher… a
JS-side copy of engine truth that drifts because nothing owns it"* — turns out
to be already solved, and it did not need solving.

`useEngineCore.ts` contains exactly **two** `setState` calls:

| line | call | role |
| --- | --- | --- |
| 191 | `setState(INITIAL_STATE)` | reset |
| 216 | `setState({ … })` inside `syncState()` | **the sole publisher** |

`syncState()` already publishes `width`, `height`, `layers`, `activeLayerId`,
`undoCount`, `redoCount`, `zoom`, `hasTransparency` and the history list. The
mirror is not missing. It is load-bearing for the entire UI today — if it
drifted, the layer panel and the canvas size readouts would already be wrong.

So Phase 1a is not "build a mirror". It is "point call sites at the mirror that
is already there". That should have made this cheap. It does not, for the reason
below.

## 2. The consumers cannot reach it

Of the 38 value-consumed scalar call sites (`width`, `height`, `layer_count`,
`active_layer_id`, `content_layer_count`):

| class | count | why it cannot be repointed |
| --- | ---: | --- |
| **plain-module** | 14 | Not React. No hook context, no state. They receive the engine handle as a parameter. |
| **publisher-internal** | 7 | `useEngineCore` itself. It cannot read its own mirror — that is the definition of a cycle. |
| **save path** | 3 | `useEditPersistence`. Off-limits this run; five commits landed there hours ago and it needs to settle. |
| **mutation-adjacent** | 6 | `useTransforms`. Reads dimensions inside flip/rotate math, in the same breath as changing them. |
| **genuinely repointable** | **8** | AppShell ×2, BatchSettings ×4, ExportPane ×1, useMaskActions ×1 |

The 14 plain-module sites are the heart of it. `lib/exportImage.ts`,
`lib/openraster/export.ts`, `lib/oplogPersistence.ts`, `lib/tilesFlush.ts` and
`lib/editPersistence.ts` are ordinary modules that take a `tool` or a
`RefObject<ImageHorseTool>` and do a job. There is no React state in scope and
no honest way to put any there. Making them read a mirror means changing their
signatures to accept one — threading engine state through every caller.

That is restructuring, and it is the same *shape* of work as the async migration
it was supposed to avoid. If we are going to change those signatures anyway, we
should change them to `async` once rather than to `(tool, mirror)` now and
`async` later.

**A note on `lib/editPersistence.ts`:** it imports `type { RefObject } from
"react"`. A first pass counted it as React-reachable on that basis. It is a
type-only import — the module has no React runtime at all. The classifier in
`scripts/scalar-mirror-classify.mjs` was corrected; the corrected rule is that
only a value import of `react` counts. Worth knowing because the naive grep
inflates the repointable set by three.

## 3. Why the six `useTransforms` sites are not free either

They read `t.width()` and `t.height()` inside the transform math itself:

```ts
const cx = t.width() / 2;
const cy = t.height() / 2;
const r  = Math.max(t.width(), t.height());
```

Freshness here is load-bearing. The mirror is only as current as the last
`syncState()`, and `syncState()` is invoked by **71 hand-placed calls across 12
files** — a discipline, not a structure. Repointing a mutation-adjacent read
moves it from "always correct" to "correct if someone remembered". That is a
behaviour change wearing a refactor's clothes, and the brief required
behaviour-preserving throughout.

This is the honest version of the drift worry. The publisher is single; the
*invocation* of the publisher is not structural. That distinction is what makes
a blind repoint unsafe, and it is worth carrying into whatever #2 becomes.

## 4. What this means for #2

- The scalar class is **not** where the 117 lives. It is 38 sites, and only 8
  are addressable without restructuring.
- The real weight is elsewhere: `export_png` (7), `get_shape_annotations` (6),
  `get_text_annotations` (6), `get_image_data` (3) — buffer-returning calls that
  a mirror can never serve, because the whole point is the bytes.
- **A worker migration's cost is dominated by plain modules, not components.**
  Every one of those 14 sites needs an async signature regardless. Phase 1a
  cannot shrink that; it can only relabel a little of it.

The number that decides #2 is therefore **109, not 90**, and the composition
matters more than the count: the residue is buffer transfers and non-React
modules, both of which the mirror strategy was never able to touch.

## 5. What was not done, and why

No mirror, no repoint, no test — deliberately. Eight sites is not worth a
behaviour-change risk taken at 4am on top of a night that included archive
corruption and a disabled Convex account. The brief anticipated exactly this and
asked for a written finding and a clean stop; this is it.

Committed here: the two measurement scripts, so the count is reproducible rather
than asserted, and this document.

```bash
node scripts/engine-call-audit.mjs .        # 206 = 77 / 117 / 12
node scripts/scalar-mirror-classify.mjs .   # 38 scalars = 14 / 7 / 17
```

## 6. Open

- **The 8 repointable sites remain available** if someone wants them. They are
  listed by file and line in the classifier output. They are safe *individually*
  — none is mutation-adjacent — but they buy 117 → 109.
- **`syncState`'s 71 manual call sites are the real latent drift risk**, and
  they are a live correctness question today, not only for #2. Nothing enforces
  that a mutation is followed by a sync. That deserves its own look, and it is
  cheaper than the migration.
- **`loaded_photo_id` does not exist.** The brief cites it, and the generation
  counter, as last night's precedent for "engine-owned truth, exposed, not
  inferred". Neither is in the crate: `grep` finds nothing on master, on
  `spike/engine-worker`, or in any commit message across all refs. What landed
  last night is `app/src/lib/engineDocument.ts` — a *JS-side* ownership marker
  with a single publisher, which is the opposite pattern. The precedent is real;
  the name is wrong. `oplog_generation()` exists but is op-log persistence
  state, unrelated.
