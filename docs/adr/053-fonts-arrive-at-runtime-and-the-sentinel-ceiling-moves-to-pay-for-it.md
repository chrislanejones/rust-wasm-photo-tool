# ADR-053: Fonts arrive at runtime, and the sentinel ceiling moves to pay for it
Date: 2026-09-11   Status: Accepted
Resolves the open questions in ADR-051. Reviews the band set by ADR-045.

## Context

ADR-051 found the Text tool's font dropdown was cosmetic: `render_text` took no
font parameter, three surfaces disagreed by up to **+26.3%**, and the obvious
fix — compile a second family in — missed the sentinel band by more than 3×
(one Liberation TTF **61,972 B** against **22,608 B** of headroom).

That left two ways to build it, and Chris picked from them directly:

| Option | Verdict |
|---|---|
| Embed a second family in the engine | **Blocked.** ADR-037's band, re-measured by ADR-045, does not have the bytes |
| **Ship TTFs, `register_font` at runtime** | **Chosen** |

## Decision

`render_text`, `measure` and `wrap` take a `font_id`. Faces ship as static
assets in `app/public/fonts/` and are handed to the wasm at runtime through
`ImageHorseTool::register_font`. **No font bytes entered the wasm.** The one
embedded face stays exactly where it was, as the fallback and as what an empty
`font_id` means.

## The faces

Liberation Sans / Serif / Mono, v2.1.5, **SIL OFL 1.1** —
`app/public/fonts/LICENSE.txt`. Metric-compatible with Arial, Times New Roman
and Courier New, which is why they read as an ordinary sans/serif/mono set
rather than three arbitrary fonts. Subset with `pyftsubset` to the same **430
codepoints** the embedded face covers, hinting dropped because `ab_glyph` does
not run the TrueType hinting interpreter.

| File | Bytes |
|---|---|
| LiberationSans-Regular / Bold | 29,748 / 30,080 |
| LiberationSerif-Regular / Bold | 31,668 / 31,924 |
| LiberationMono-Regular / Bold | 29,108 / 29,400 |

The served Liberation Sans is **byte-identical in outline and advance width to
the embedded face** — 430/430 codepoints, **0** advance mismatches, **0**
differing decomposed outlines. That is what lets the browser preview and the
engine agree exactly, instead of agreeing to within whatever Arial-alike the
machine happens to have.

## The three surfaces now agree, because they share bytes

ADR-051 named fixing the surface disagreement as the first implementation step.
All three now derive from one `textFontId` in `ToolSettings`, and —
the part that matters — `engineFonts.loadFaces()` fetches each file **once** and
hands the **same `ArrayBuffer`** to both `register_font` (engine) and
`new FontFace(...)` (browser). Not the same font: the same bytes. There is no
version of this where the two drift, because there is only one copy.

Measured in the browser against the production build, same string, same size:

| Face | textarea family | preview box width | exported ink width |
|---|---|---|---|
| Liberation Sans | IH Liberation Sans | 196 | **159 px** |
| Liberation Mono | IH Liberation Mono | 231 | **187 px** |

## A second inert dropdown was sitting next to the first

#113 cut the Text tool's twelve-entry font list to one entry and **missed the
identical copy in `BatchSettings.tsx`**. It went on offering Georgia, Impact and
Comic Sans for another eleven releases while every batch render came out in
Liberation Sans.

Same bug class this repo keeps finding, and the cause is duplication rather than
oversight: two hand-written tables, one fix. Both panels now read one list
through `useEngineFaces`, which is also the only thing allowed to decide that a
face may be offered.

## Op-log v5 → v6

The fourth application of the prefix-extension recipe documented on
`OP_FORMAT_VERSION`, clause for clause:

| Clause | This time |
|---|---|
| Field is `#[serde(skip)]` | `font_id` on `TextParams` — wire layout still byte-identical to v2 |
| New variant is APPENDED | `Op::TextFont`, after `PerspectiveWarp` |
| Annotation tuple grows at the tail | a **seventh** trailing element on `encode_annotations` |

A v5 document decodes with every `font_id` empty, which is the embedded face,
which is exactly what it meant. Pinned by `v5_blobs_still_decode_under_v6`,
`v5_op_bytes_still_decode_under_v6` and
`text_params_wire_layout_is_unchanged_by_the_font_id_field`.

⚠️ **One thing differed from the quad step.** Here the skipped-field default and
the semantic default agree — `String::default()` is `""`, and `""` is defined to
mean the embedded face — so no `default_quad_if_unset`-style promoter was
needed. That is a property to **check** the next time a field is added, not to
assume.

## Dexie: no version bump

`PersistedAnnotation.font_id?` is an optional field inside a JSON blob and is
not indexed, so no `.version()` bump. The precedent is written verbatim on
`stale?` in `app/src/lib/dexie/db.ts`, and this change follows it rather than
inventing a second rule.

## Monotonicity is what keeps the metrics cache sound

`textMetricsCache.ts` caches `measure_text` and `text_ink_offset` on the
argument that they are pure — same arguments, same answer, for the life of the
binary, so there is nothing to invalidate. `font_id` is now one of those
arguments, so purity holds **only while an id always resolves to the same
outlines**. Two things enforce it, and both are load-bearing:

| Enforcer | What it prevents |
|---|---|
| `fonts::register` refuses to overwrite an existing id | A re-pointed id serving the old face's metrics forever. Pinned by a new contract test |
| `ensureEngineFonts` is awaited before a face can be **selected** | Measuring an unregistered face answers in the fallback, and that wrong answer gets cached against the real id for the life of the page |

Neither has a runtime detector. If one goes, nothing goes red — text just starts
landing a few pixels off its own preview.

## The band review

This is the review ADR-045 anticipated, not a baseline being unbolted to go
green. ADR-045 sized its own ceiling as **"23,029 B of growth headroom — ~1.4
perspective-sized features (+16,788 B)"**. That was a budget, written down in
advance, and this is the feature it was written for.

| | Bytes |
|---|---|
| Baseline (master, local build) | 823,503 |
| With runtime fonts (local build) | 841,355 |
| **Delta** | **+17,852** |
| Perspective, for comparison (ADR-045) | +16,788 |

One perspective-sized feature. The headroom is spent exactly as budgeted, and
the distinction matters: raising a limit *because the number hit it* is the one
move this repo's gates exist to prevent, and ADR-037 said so in its own
consequences. Spending a stated budget and then restating the budget is a
different act. A reader will reach for the first reading, so the numbers above
are the answer to it.

**Ceiling: 840,000 → 872,000.** **Floor: unchanged at 800,000.**

The asymmetry is deliberate and was nearly got wrong. ADR-045's own arithmetic
would justify raising the floor too — it set the floor 16,971 B under the
then-current build, and 800,000 now sits 41,355 B under this one, so the
featureless detector is looser than ADR-045 intended it to be. But
`deploy-sentinel.sh` runs against **live production**. A floor above the
currently live pre-fonts binary fails the moment it is pushed and stays red
until the deploy lands, and a gate that is red for the length of a deploy is a
gate people learn to ignore.

**Owed work, on the record: tighten the floor in a later commit, once a build at
the new size is actually live.** Not in this one.

One other size note worth keeping. A `HashMap` for the six-entry registry cost
**5,181 B** of wasm — `RandomState`, SipHash and the `RawTable` machinery, none
of it previously reachable from this crate — and was replaced with a linear
`Vec` scan. Six `&str` comparisons are not the slow part of rasterising a glyph.

## Verification

| Gate | Result |
|---|---|
| `cargo fmt --check`, `clippy --all-targets --features tiles -D warnings` | clean |
| `cargo test --features tiles` | **435 passed, 0 failed** |
| `pnpm -C app test` | **811 passed, 0 failed** |
| `pnpm -C app exec tsc --noEmit` | clean |
| `pnpm lint` | 0 errors, 65 warnings (baseline exactly) |
| `./scripts/guardrails.sh` | green except `dead-exports: 1`, which **master also fails** (`history_max_bytes`, a generated `pkg/` export) |
| Production build + `inert-class-audit` | clean |
| Browser smoke, production build, logged out | 0 console errors |

Two guardrail baselines are edited in this diff, and **both go DOWN**. The
script's own header sets the rule — when an extraction lands, lower that file's
number to its new size in the same commit — so an edited `guardrails.sh` here is
the ratchet working, not a baseline being raised.

| Ratchet | Was | Now | Why |
|---|---|---|---|
| `librs-lines` | 4,912 | **4,831** | `register_font`/`has_font` went into `src/fonts.rs`'s own `#[wasm_bindgen] impl`, and `commit_text`/`measure_text` moved to `src/text.rs` — the pattern `annotations.rs` and `history.rs` already use |
| `rust-panics` | 47 | **46** | two new test-only `expect`s annotated `// allow: rust-panic`; the three production `expect`s on compile-time byte slices are left counted |

Mutation checks, because ADR-051 asked for tests that assert rendered output and
not dropdown contents:

| Mutation | Killed |
|---|---|
| `set_text_font` renders on the default face | **4 of 6** Rust tests |
| `availableFaces` asks before registering | **2 of 11** TS tests |

⚠️ Three preservation tests were **vacuous on the first pass** — they compared
the default face against itself and could not fail. Strengthened with a
`fallback_ink` guard. This is the repo's recurring failure mode and it is
recorded here because it was found by running the mutation, not by reading the
test.

## Consequences

+ The font dropdown does what it says. The face in the textarea, the face the
  box is measured in, and the face in the exported pixels are the same bytes.
+ The second inert list is gone, and one hook now owns which faces exist, so
  there is no third table to miss.
+ **ADR-051's decided design is not superseded — it is unblocked.**
  `register_font` is the exact entry point a user-supplied `.ttf` needs, and the
  shipped faces are simply its first caller. What remains for it is the upload
  UI, Dexie storage for font blobs, and the Convex sync tier.
- **The featureless detector is looser than ADR-045 left it**, and stays that way
  until the floor is tightened in a follow-up. That debt is stated above and is
  the real price of this change.
- Two invariants now hold the metrics cache up and neither is checked at
  runtime: registration is monotone, and registration precedes measurement.
  Break either and the symptom is a few pixels of drift, not an error.
- Every text path in the engine grew a parameter, and any engine instance that
  renders text must have `ensureEngineFonts` run against it — including the
  batch path's throwaway per-photo engine, which has its own registry.
- The 5,181 B above disagreed with a comment in `src/fonts.rs` for the length of
  one session, which said **6,764 B** — a guess written before the measurement
  was taken and never corrected. The ADR was the one that was right, because it
  cited a measurement (846,213 → 841,032, the `HashMap` swapped for the `Vec`
  and nothing else in between). A number in a code comment is read as a measured
  number whether or not it is one; the comment is now fixed.

## Alternatives rejected

1. **Embed a second family.** Blocked on arithmetic before it was blocked on
   taste: ~62,000 B against ~17,000 B of headroom, and every future face asks
   again.
2. **Fetch from Google Fonts.** Cheaper still, and it deepens the privacy claim
   ADR-051 already found to be false. Nothing is fetched from a third party.
3. **Ship WOFF2.** Smaller files, and `ab_glyph` cannot read them — WOFF2 is
   Brotli-compressed. Naming it means moving text rendering back to the browser,
   which reverses the decision `text.rs` exists to make.
4. **Raise the floor in this commit too.** Correct arithmetic, wrong timing: it
   fails against the live pre-fonts binary the moment it is pushed.
5. **A `HashMap` registry.** 5,181 B of wasm for six entries, inside a band this
   change is already spending.

## Pre-mortem

It is six months later and this was a mistake. Most likely reason: a later
feature broke monotonicity — the user-uploaded fonts from ADR-051 landed, and a
user replacing a font under an id they had used before quietly re-pointed it.
`textMetricsCache` has no way to know, so it keeps serving the old face's
metrics, and text starts committing a few pixels off its own preview. That
symptom is indistinguishable from ADR-050's anchor bug, so it gets debugged in
`rotate_pixels` and the engine's text layout for a week before anyone looks at a
cache key. The invariant that prevents it lives in one `if` in `fonts::register`
and in the discipline of awaiting `ensureEngineFonts`, and nothing at runtime
notices when either goes.

Second candidate: the new ceiling gets treated as the new normal, the floor is
never tightened, and the sentinel's featureless half degrades from "measured" to
"historical" — which is how ADR-037's band got wide in the first place.

Early warning sign: **any change to `fonts::register` that removes the
already-registered short-circuit**, or any new call site that measures text
without awaiting registration first.

ADR-051 offered its own early warning — *"a font-related PR that changes no file
under `src/`"* — on the grounds that such a PR is definitionally cosmetic. This
change does the opposite: `src/fonts.rs`, `src/text.rs`, `src/ops.rs`,
`src/annotations.rs`. That sign stays valid for whatever comes next.
