# ADR-058: Fonts arrive at runtime, and dead hinting pays for them
Date: 2026-09-11   Status: Accepted
Resolves the open questions in ADR-051. Reviews the band set by ADR-045 and
leaves it exactly where it found it.

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

⚠️ The "blocked" row is true of a **stock** TTF and was never re-checked
against an unhinted one. A Liberation face with the hinting `ab_glyph` cannot
run stripped out is **~30,000 B, not 61,972** — see the band-review section,
which is where that stopped being a footnote. It does not change the decision
(runtime loading is still right, and three families still do not fit), but the
3× figure this ADR opens with is a measurement of a file, not of a constraint.

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

## Op-log v7 → v8

⚠️ **This was written as v5 → v6 and is not any more.** The branch sat
unmerged from 09-11 to 09-17 while v6 (shape perspective, #130) and v7 (shape
sloppiness, #179) shipped, and both of those claimed the number this step had
taken. Rebasing the step is not cosmetic: `Op::TextFont` had been appended
after `PerspectiveWarp`, and the two shape variants have since landed in front
of it. **`TextFont` moved to the END of the enum on merge**, because postcard
indexes variants positionally and the two shape variants are on users' disks
while `TextFont` never was. The only renumbering that would have cost anything
is the one that did not happen.

The SIXTH application of the prefix-extension recipe documented on
`OP_FORMAT_VERSION`, clause for clause:

| Clause | This time |
|---|---|
| Field is `#[serde(skip)]` | `font_id` on `TextParams` — wire layout still byte-identical to v2 |
| New variant is APPENDED | `Op::TextFont`, after `ShapeSloppiness` — **last**, not where the branch put it |
| Annotation tuple grows at the tail | a **ninth** trailing element on `encode_annotations` |

A v7 document decodes with every `font_id` empty, which is the embedded face,
which is exactly what it meant. Pinned by `v7_blobs_still_decode_under_v8`,
`v7_op_bytes_still_decode_under_v8` and
`text_params_wire_layout_is_unchanged_by_the_font_id_field` — the first two
renamed and re-pointed from the v5/v6 pair they were written as, which collided
by NAME with master's identically-named tests and would not have compiled.

⚠️ **The lesson is about elapsed time, not about postcard.** A format-version
step is a claim on a shared number. A branch that holds one for six days while
two other features ship does not find out until it merges, and the failure mode
is silent for the two that shipped first: they are correct, and the late branch
is the one carrying a stale variant index.

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

## The band review — WITHDRAWN 2026-09-17, the ceiling does not move

⚠️ **This section is why this ADR is not called what it was called.** It was
written as *"…and the sentinel ceiling moves to pay for it"*. The ceiling does
not move, and nothing is paid for by moving it. Retitled 2026-09-18; the number
did not change.

### What this section used to argue

That runtime fonts cost **+17,852 B** (823,503 → 841,355, local builds), which
is one perspective-sized feature, which is the budget ADR-045 wrote down in
advance — so **ceiling 840,000 → 872,000**, floor unchanged, and the move is
a review rather than a baseline unbolted to go green.

The arithmetic was right. The conclusion was avoidable, and two things happened
between 09-11 and 09-17 that retire it.

**First, the ceiling moved anyway, without this ADR.** Chris took it 840,000 →
**860,000** on 09-16, for Enhance › Presets and shape perspective. So the
proposal here was a *second* raise in two releases. A ceiling raised twice in
two releases is not a limit, it is a formality, and the next feature asks for
the same thing with a better precedent than the last one had.

**Second, the bytes were already there.** They did not need buying.

### The bytes were already in the binary, doing nothing

`ab_glyph` has no TrueType bytecode interpreter. It never has. So every
hinting byte in the two embedded faces is carried, shipped, decompressed and
never executed. Measured on the actual files:

| Embedded face | File | `fpgm`+`prep`+`cvt `+`gasp` | glyph instructions | dead total |
|---|---:|---:|---:|---:|
| LiberationSans-Regular | 61,972 | 3,471 | 29,071 | **32,542** (52.5%) |
| LiberationSans-Bold | 61,520 | 3,804 | 27,966 | **31,770** (51.6%) |
| | | | | **64,312** |

Over half of each embedded face is instructions for an interpreter that is not
in the binary. Stripping them — hinting tables deleted, every glyph's
instruction stream emptied, outlines and advance widths and `cmap` untouched —
takes the two faces from **123,492 B to 60,020 B**.

### Measured, three builds, same toolchain

rustc 1.97.1 (8bab26f4f), wasm-pack 0.15.0, binaryen 117, `features=tiles,patchmatch`.

| Build | Bytes | vs ceiling (860,000) |
|---|---:|---:|
| master @ `39ef3adf` | 858,087 | 1,913 under |
| this branch, merged, **hinted** faces | **877,311** | **17,311 OVER — red** |
| this branch, merged, **unhinted** faces | **814,202** | **45,798 under** |

The middle row is the one that matters for the decision. **Merged and hinted,
this branch does not fit under the ceiling at all** — not "is tight", does not
fit, by 17,311 B. Raising the ceiling to 872,000 as this ADR proposed would not
even have covered it; 877,311 needs 880,000. The proposal was already stale
when it was written, because it was sized against a 823,503 B baseline that
master left behind 56 commits ago.

The third row is the whole finding: **−63,109 B against this branch's own
hinted build, and −43,885 B against master.** Runtime fonts land and the binary
comes out *smaller than master*, under a ceiling nobody touched.

### The pixel check, which is the only thing that licenses any of it

Stripping hinting is safe *because it changes no pixel*, and that is measured,
not argued. Both faces were rendered through the shipped `text::render_text`
path in one binary — embedded unhinted face against the original hinted bytes
registered through `fonts::register`, so same `ab_glyph`, same rasterizer, same
code path, one variable.

| | |
|---|---|
| Cases | 572 (11 glyph samples × 26 sizes, 6–200 px incl. fractional × regular/bold) |
| Pixels compared | 40,913,342 |
| Tile-size mismatches | **0** |
| **Differing pixels** | **0** |

And the result is not vacuous, which took its own control: registering a
genuinely different face (Liberation Serif) through the same path renders
409×44 against the embedded 438×44, and an unregistered id falls back to the
embedded face. The harness can tell faces apart; it reports zero because there
is nothing to report.

`fonts::the_embedded_faces_carry_no_hinting` keeps it that way — it parses the
embedded bytes and fails on any hinting table or any non-zero glyph instruction
stream, so a stock TTF dropped in here as a routine "font update" goes red
instead of quietly spending 63 KB. Mutation-tested: restoring the original
Regular fails it on `fpgm`.

### Decision

**The ceiling stays at 860,000. The floor stays at 800,000.** Neither is
touched by this ADR, and the sections above that proposed 872,000 are withdrawn
rather than deleted, because the reasoning is the record of how a band gets
raised by a branch that is measuring against a stale baseline.

⚠️ **Do not apply this swap to master on its own.** Master is 858,087, so the
same −63,109 would put it near **794,978** — **under the 800,000 floor**, and
the floor is the featureless-build detector. On this branch the swap lands at
814,202, which is 14,202 clear of the floor. The swap is safe *with* the fonts
feature and breaks the sentinel *without* it. That coupling is not obvious and
is the single most important line in this section.

One scoping note: the served faces in `app/public/fonts/` were already subset
and unhinted. Only the two `include_bytes!` faces carried this.

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
- **The saving is coupled to the feature and cannot be lifted out of it.**
  Applied to master alone the same −63,109 B lands near **794,978** — under the
  800,000 floor, which is the featureless-build detector. It is safe only
  carried *with* the fonts, which is what puts it at 814,202. Nothing in the
  repo enforces that pairing; it is written down here and nowhere else.
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

Second candidate: the 45,798 B this leaves under the ceiling get read as
permanent headroom rather than as a one-time refund, and the next features spend
it without re-measuring — which is how ADR-037's band got wide in the first
place. The sharper version is the coupling above: somebody lifts the unhinted
faces onto a branch that does not carry the fonts feature, the floor fires, and
the cheapest-looking fix is lowering the floor.

Early warning sign: **any change to `fonts::register` that removes the
already-registered short-circuit**, any new call site that measures text without
awaiting registration first, or any diff that touches `src/fonts/*.ttf` without
touching the fonts feature.

ADR-051 offered its own early warning — *"a font-related PR that changes no file
under `src/`"* — on the grounds that such a PR is definitionally cosmetic. This
change does the opposite: `src/fonts.rs`, `src/text.rs`, `src/ops.rs`,
`src/annotations.rs`. That sign stays valid for whatever comes next.
