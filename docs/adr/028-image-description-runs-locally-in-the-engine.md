# ADR-028: Image content description runs locally in the engine, not through a caption model
Date: 2026-07-31 (written after the fact — records v7.61 as shipped)   Status: draft

## Context

v7.61 added Batch → AI Rename, which needs to name every loaded photo from what
is in it. Two ways to know that: analyse the pixels locally, or send each image
to a vision caption model. The Replicate path was already half-built — the `alt`
job type exists in `convex/ai.ts` with no model registered — but Replicate AI is
paid-tier only (`TIERS.replicateAI`), and the project's first invariant is that
every feature works logged-out. A caption model cannot honour that.

## Decision

Description is a local engine concern: `src/describe.rs` plus a `describe_image`
wasm export, returning hue histogram, luma mean/variance, local gradient energy,
palette diversity and skin/foliage/sky ratios as tags plus a ready-made slug.
Sampling is capped at a ~160×160 grid, so a 24MP photo costs the same as a
thumbnail. JSON is hand-rolled rather than serde, because serde is gated behind
the `tiles` feature and this module should not inherit that coupling. The result
**describes** an image and does not recognise objects in it, and the panel says
so rather than implying otherwise.

## Consequences

+ Works signed out, offline, with no per-image cost and no network round trip —
  the only AI-branded feature in the app that does.
+ No new Cargo or npm dependency; the engine grew 753,582 → 758,946 bytes
  (+5,364, +0.71%), and nothing on the flush path changed.
+ The rules are testable without a browser or an account: 12 Rust tests, 21 TS
  tests, all offline.
- **It will never say "golden retriever."** The feature is named AI Rename and
  produces `dark-blue-portrait`. That gap has to be managed in copy forever, and
  copy is a weak defence against an expectation set by the word "AI".
- The heuristics misfire and cannot be threshold-tuned out of it. Measured
  2026-08-01 against the 12 bundled samples: `portrait` fires on warm stone and
  beige stucco, and raising the skin threshold 0.14 → 0.18 plus two guards moved
  exactly one image of twelve — neither of the two it was aimed at.
- A fourth Batch sub-mode adds another entry to the mode union and the tool
  registry, which is the most contended area of the codebase right now
  (`feat/vector-tool` already conflicts there across 29 hunks).

## Alternatives rejected

- **Replicate caption model via the existing `alt` job type** — real object
  recognition, but paid-tier only, so it breaks the demo-mode invariant; also
  unverifiable without a token and a pinned model version hash. Still the
  upgrade path if AI Rename ever becomes a paid tier-two feature.
- **Bundle a small vision model (ONNX/tract) in the wasm** — genuine offline
  recognition, rejected on size: a multi-megabyte model against a 759 KB engine
  is a >5× binary for one sub-tool.

## Pre-mortem

It is six months later and this was a mistake. Most likely reason: the names are
plausible but not *useful*. People reach for a tool called AI Rename expecting
subject nouns, get `bright-white-screenshot` and `orange-portrait` — one of which
is wrong — and go back to `{name}-{n}` within a session. The feature is then a
Rust module, a wasm export and a permanent sub-tool tile carrying a capability
nobody uses, and the honest copy in the lightbulb turns out to have been a
warning we wrote and shipped anyway.

Early warning sign to watch for: the misfire rate on the sample gallery not
improving on the next attempt (it is 2 of 12 mislabelled `portrait` today), or
users clearing the default `{desc}-{n}` pattern before pressing Rename.
