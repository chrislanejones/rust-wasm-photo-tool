# ADR-045: The wasm build is reproducible, so the sentinel band narrows to 800,000–840,000 B — and the export check it shipped with was vacuous
Date: 2026-09-05   Status: draft
Supersedes the band set by ADR-037. Closes the open measurement in ADR-038.

## Context

ADR-037 set the sentinel band to 780,000–850,000 B and said, in its own
consequences, that raising a ceiling because it was hit is how ceilings stop
meaning anything. It was 70,000 B wide around a number it described as
toolchain-dependent, because at the time it *was*: nothing pinned rustc, and a
compiler release alone had moved the size 6,579 B.

Two things have landed since:

- **ADR-038** pinned rustc to 1.97.1, and pinned wasm-pack to 0.15.0 in both
  Netlify and CI. It measured a residual **139 B** local/deployed gap and
  attributed 135 B of it to embedded cargo registry paths, leaving **4 B
  unexplained**.
- **#70** added `--remap-path-prefix` for both builders to `.cargo/config.toml`,
  which should have killed those 135 B. It merged and deployed, so for the first
  time the prediction could be tested against a live artifact.

Everything below is measured, on master `a26b421`, against the live Netlify
build, on 2026-09-05.

## What the measurements say

| Build | wasm-opt | Bytes | sha256 (16) |
|---|---|---|---|
| Local, wasm-opt from `PATH` | **116** | 816,968 | `fb36b21c85f812cb` |
| Local, wasm-pack's own wasm-opt | **117** | **816,971** | `24c103c72ecfe742` |
| **Deployed (Netlify)** | 117 | **816,971** | `24c103c72ecfe742` |
| Featureless (`tiles`/`patchmatch` off) | 117 | **720,904** | — |

**Local and production are byte-identical — 0 differing bytes, not 139, not 4.**
Two consecutive local builds are also bit-identical, so the build is
reproducible in both senses.

The 139 B gap is fully accounted for and fully closed:

| Component | Was | Now | Why |
|---|---|---|---|
| Embedded registry paths | 135 B | **0** | #70's remap; both binaries carry 27 `/cargo-registry` and zero machine paths |
| "4 unexplained bytes" | 4 B | **0** | Never a constant. It was **wasm-opt version drift** |

The residual was never four mystery bytes. `wasm-pack` uses a `wasm-opt` found
on `PATH` if there is one and otherwise downloads its own; this laptop has
binaryen **116** in `~/.cargo/bin`, and wasm-pack 0.15.0 fetches **117**. Two
different optimizers on the same input produced binaries differing in 456,523
byte positions whose totals happened to land 3 B apart. A size delta that small
across an optimizer change is a coincidence, and reading it as "nearly the same
binary" is what kept the number looking like a rounding error for two ADRs.

**Pinning wasm-pack therefore pins wasm-opt too — but only on a machine with no
`wasm-opt` on `PATH`.** CI and Netlify are such machines. A developer's is
typically not.

## The export check was vacuous

While measuring the floor against a real featureless build, the sentinel's other
half turned out not to work at all. It grepped the live glue for three bare
strings, and **all three matched a featureless build**:

| Symbol | Gated? | Featureless glue | Why it matched |
|---|---|---|---|
| `oplog_` | yes (`tiles`) | **1** | a doc comment naming `oplog_engine_in_sync` |
| `remove_object` | yes (`patchmatch`) | **2** | two doc comments that merely name it |
| `rect_select` | **no** | 3 | not feature-gated in any build |

Run with the script's own logic, a featureless build **passes**. The export half
of the sentinel has never been able to detect the failure the sentinel exists
for (`project_netlify_featureless_wasm_bug`); the size floor was doing all of
the work alone. This is the bug class CLAUDE.md already documents for
`guardrails.sh` — a text grep cannot tell code from prose — found a second time
in a second gate.

## Decision

**1. The band becomes 800,000–840,000 B** (was 780,000–850,000; 70,000 → 40,000
wide, −43%).

| Bound | Value | What the distance means |
|---|---|---|
| Floor | 800,000 | **79,096 B above a measured featureless build** (720,904). Also 16,971 B below current — 22× the largest size *reduction* ever recorded here (755 B, v8.56), so honest optimization work does not trip it |
| Ceiling | 840,000 | **23,029 B of growth headroom** — ~24 typical releases at recent rates (816,185 → 816,324 → 816,971), or ~1.4 perspective-sized features (+16,788 B) |

The width is no longer absorbing toolchain variance, because there isn't any
left to absorb: rustc is pinned, wasm-pack is pinned, and the remap removed the
builder's identity from the binary. What the 40,000 B now represents is
**product growth between band reviews**, and nothing else. That is a statement
that can be checked, unlike "toolchain-dependent".

**2. The export check matches declarations, not strings.** `NAME(args) {` —
a name, an argument list, an opening brace. A comment can name a symbol; it
cannot follow it with a signature. Verified against three real artifacts: the
live minified glue and raw `pkg/` glues from featured and featureless builds
(1/1/1, 1/1/1, 0/0/1).

**3. `rect_select` is demoted out of the feature list.** It is not gated, so it
never evidenced anything about features. It stays as a separate
`WIRED_SYMBOLS` entry — it does prove the glue is a real engine glue — listed
apart so it cannot be mistaken for a feature check again.

## Consequences

+ The floor is now justified by a **measured** featureless build (720,904)
  rather than ADR-037's estimate of "~730,000 under 1.97.1".
+ The export check can fail, which is new. It failed-open for its whole life.
+ Local `build:wasm` output finally *does* predict the sentinel, reversing
  ADR-037's last consequence — provided no `wasm-opt` shadows wasm-pack's.
- **A developer with binaryen on `PATH` silently builds a different binary.**
  Nothing warns. It cost this investigation an hour and produced a "3 byte gap"
  that was not a gap. The mitigation here is only that it is written down; see
  Alternatives 2.
- The new export pattern depends on wasm-bindgen emitting `name(args) {`. If
  that changes, the check fails **closed** — a false alarm on a good deploy.
  That is the right direction to be wrong, and the opposite of what it did
  before.
- 40,000 B is still wide enough that it catches catastrophe, not drift. It is
  narrower for a stated reason rather than tight for its own sake.

## Alternatives rejected

1. **Assert an exact sha256 instead of a band.** Now genuinely possible — the
   build is reproducible and CI already builds the wasm, so CI could publish the
   expected digest for the deploy sentinel to compare. This is the correct
   long-term shape and it makes the band redundant. Not done tonight because it
   needs CI plumbing (artifact or job output threaded into a separate workflow),
   which is a bigger change than a bound, and an unattended run is the wrong
   place to redesign a gate. **Recommended as the successor to this ADR.**
   *(Done — **ADR-046**. It does NOT make the band redundant: the band answers
   "is this plausibly the engine at all" without needing `build-info.json`, so
   both are kept. And the expectation could not be a stored digest — see #69.)*
2. **Pin binaryen explicitly**, or make `build:wasm` refuse to run when a
   foreign `wasm-opt` is on `PATH`. Attractive, and the clean fix for the
   local/prod divergence. Deferred with 1: both are "how the build is pinned"
   decisions and belong in one change, not bolted to a band update.
3. **Leave the band at 780,000–850,000.** Its own ADR called it a check that
   bounds a number that moves on its own. That is no longer true, so keeping the
   width would mean keeping a justification that has expired.
4. **Narrow much further** (e.g. ±2,000 B around 816,971). The build is
   reproducible, so this would work — and it would go red on every engine commit
   that ships, turning a deploy gate into a changelog. If an exact check is
   wanted, alternative 1 is the honest version of it.
