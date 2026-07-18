# ADR-017: The tiles/op-log feature is compiled into the shipped WASM

Date: 2026-07-13   Status: Accepted (2026-07-17 — the Phase-1 dogfood
happened as the four-check A/B; flags default ON in v7.36 with "0" kill
switches per this ADR's pre-mortem)

## Context

The op log and tile engine live behind the `tiles` cargo feature. The shipped
WASM build never enabled it:

```
build:wasm = wasm-pack build --target web --out-dir pkg     # no --features tiles
```

Cargo.toml said so explicitly, and treated it as an invariant: *"OFF by default
and NOT compiled into the wasm build — the default build must stay byte-for-byte
unchanged."*

**The consequence was quietly fatal.** The op-log code was not in the binary users
run. `hasOplogExports(tool)` (app/src/lib/tilesFlush.ts:39-43) probes for
`set_oplog_undo`; that export did not exist, so `syncOplog()` returned `null`, the
diagnostics gauges hid themselves, and nothing recorded. The three feature flags —
`ih_tiles_flush`, `ih_oplog_undo`, `ih_oplog_persist` — gated JavaScript that
called engine functions **that were not in the binary**. Every path fell back to
snapshot undo, silently, with no error.

Measured on the shipped binary, 2026-07-13, before this change:

| check | result |
| --- | --- |
| `strings pkg/stamp_tool_bg.wasm \| grep -c oplog` | **0** |
| `grep -c oplog pkg/stamp_tool.d.ts` | **0** |

So: ADR-003 (op-log undo), ADR-004 (tile buffer), ADR-006 (render cache
disposable), ADR-012, ADR-013 and the v7.24 data-loss fixes were all shipped as
*dead code in a binary that never contained them*. The Rust tests passed the whole
time — they run under `cargo test --features tiles`, a configuration the shipped
artifact had never been built in. **The tests and the product were testing
different programs.**

This was found by checking the binary for `oplog` symbols before starting a
multi-day dogfood — not by the dogfood, which would have "passed" while
exercising the fallback path it was meant to replace.

## Decision

**Build the shipped WASM with the feature on:**

```
build:wasm = wasm-pack build --target web --out-dir pkg -- --features tiles
```

`cargo build` / `cargo test` stay feature-off by default (both configurations must
keep building — gated). The Cargo.toml comment that asserted the old invariant is
replaced with the new reality and a pointer here.

## Consequences

- **Reverses the "default build stays byte-for-byte unchanged" invariant.** That
  invariant was protecting a binary whose stability had become the reason the
  feature didn't exist. It is not worth keeping at that price.
- **New size baseline: 659,815 → 731,595 bytes (+71,780, +10.9%).** serde +
  postcard (the op-log codec) and the tile engine now ship. This supersedes every
  earlier size figure, including v7.27's "+448 bytes" for `LayerKind`, which was
  measured feature-off. `wasm-opt -Oz` gets it to 730,234 — a further squeeze is
  available if the number becomes a problem.
- **The op-log code path now executes in production for the first time.** It has
  never run outside tests and a local preview. That is the risk this ADR carries,
  and it is why the flags stay OFF and the Phase-1 dogfood still has to happen.
- The flags become *real*: flipping `ih_oplog_undo` now actually changes behaviour
  instead of being inert.

## Verification (real browser, production build, 2026-07-13)

Against the new binary, with the three flags on:

| step | result |
| --- | --- |
| op-log exports in the binary | `set_oplog_undo` present; 17 `oplog` symbols (was 0) |
| default 2-layer import (Canvas + Photo), one paint stroke | **OP LOG: 1/1 ops · 1 kf · undo** — the gauge rendered and climbed from 0 |
| persistence | **PERSISTED: 2 ops · 1 kf · 1 chunk** — written to IndexedDB |
| reload | **PERSISTED: … · restored** — the document came back **from the op log**, not the snapshot fallback |
| console | zero errors |

Before this change the gauges did not render at all, because the functions behind
them did not exist.

## Pre-mortem

It is three months later and this was a mistake. The two plausible reasons:

1. **The size.** +71.8 KB on the WASM is a real cost paid by every visitor,
   including the majority who never undo anything. If the number starts mattering,
   the answer is not to un-ship the feature — it is `wasm-opt -Oz` (already worth
   1.4 KB), trimming postcard's monomorphisation, or splitting the codec into a
   lazily-loaded module. Early warning: bundle-size budget alerts, or a
   Lighthouse/PageSpeed regression on first load.
2. **A serde/postcard panic path in production.** The codec now runs on real user
   documents for the first time. A malformed or truncated persisted log that
   panics across the WASM boundary would be worse than the bug this fixes.
   Early warning: postcard/serde errors in the console, or an op-log restore that
   throws instead of falling back. The kill switch (`ih_oplog_persist` off, and
   `USE_OPLOG_PERSISTENCE`) must stay available until this has real mileage.

Both are why the flags stay OFF in this release.

## Alternatives rejected

1. **Delete the flags and the feature.** Honest, and throws away months of
   correct, tested work over a build-config line.
2. **Keep the feature out and ship the flags anyway.** The status quo. It is
   indistinguishable from lying: the UI offers switches that cannot do anything.
3. **Ship two binaries** (feature-on for opted-in users). Doubles the build matrix
   and the QA surface to protect a size number nobody has complained about.
