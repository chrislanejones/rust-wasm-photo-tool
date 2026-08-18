# ADR-037: The wasm sentinel band moves to 780,000–850,000 B, and what it bounds is a toolchain-dependent number
Date: 2026-08-18   Status: draft

## Context

`scripts/deploy-sentinel.sh` fails any deploy whose live wasm falls outside
700,000–800,000 B. It has failed on every release since v8.43, when perspective
added 16,788 B (measured v8.42 790,179 → v8.43 806,967, local). CI was red for
eleven days and nobody read the badge.

Two numbers were in the record and they are not the same size measured twice:

| Build | rustc | Bytes |
|---|---|---|
| Local `build:wasm` | **1.92.0** (`ded5c06cf`, 2025-12-08) | 806,967 |
| Live / CI, `stable` | **1.97.1** (`8bab26f4f`, 2026-07-14) | **813,546** |

The 6,579 B gap is five rustc releases, confirmed by matching the `/rustc/<hash>/`
paths inside both binaries against `rustup check`. Both carry the identical engine
surface — `perspective_warp` 1, `oplog_` 18, `remove_object` 1, `rect_select` 1.
Nothing pins the toolchain: netlify.toml curls rustup `--default-toolchain stable`,
CI uses `dtolnay/rust-toolchain@stable`, and there is no `rust-toolchain.toml`.

Separately, **the floor is already vacuous**: a featureless build today is
723,755 B, above the 700,000 B floor that exists to catch exactly that. The
script's "a featureless build is ~680KB" was true when written and is not now.

## Decision

Raise the band to **780,000–850,000 B**. The ceiling gives 36,454 B of headroom
over the live size — close to the 39 KB ADR-030 assumed — because the number it
bounds moves without any commit: a rustc release alone moved it 6,579 B. The
floor rises above a present-day featureless build (723,755 local, ~730,000 under
1.97.1) so it can catch the failure it was written for. The toolchain stays
unpinned; this ADR records that the band, not the build, absorbs that variance.

## Consequences

+ CI can go green, so the badge is readable again — the failure mode that let
  25 releases ship red was nobody reading it.
+ The floor catches a featureless build again instead of waving it through.
+ The size the band bounds is now stated as toolchain-dependent, so a future
  size claim measured locally is known not to be the shipped number.
- **Raising a ceiling because it was hit is how ceilings stop meaning anything.**
  This is the second raise-the-band conversation (ADR-030 was the first) and the
  mitigation is only that it is written down.
- Neither `ravif` nor `wgpu` fits under 850,000 either. The band was never a
  budget those could be funded from; raising it does not create room, it stops
  pretending there was room. Both need their own size work regardless.
- Local `build:wasm` output still does not predict the sentinel. Anyone quoting a
  size must say which toolchain produced it.

## Alternatives rejected

1. **Trim under 800,000.** Real engineering, and nothing identified is obviously
   removable; deferring a green badge for it repeats the unread-badge failure.
2. **Pin the toolchain** (`rust-toolchain.toml`) so sizes are reproducible.
   Genuinely attractive and not rejected on merit — it fixes the measurement
   rather than the bound. Deferred because pinning changes what every build in
   the project compiles with, which is a larger decision than the band, and
   holding CI red while deciding it is the wrong trade. **Filed, not dismissed.**
3. **Ceiling at 820,000.** ~6 KB of headroom: hit by the next feature or the next
   rustc, and re-raised reflexively.

## Pre-mortem

It is six months later and this was a mistake. Most likely reason: 850,000 was
absorbed within weeks — a feature took 20 KB and a rustc release took another 7 —
and the band was raised again to 900,000 with this ADR cited as precedent that
raising is normal. The real problem was never the number: it is that the crate
has no size budget anyone owns, and the sentinel was doing duty as one. A bound
that only ever moves up is a logging statement with a failure exit code.

Early warning sign to watch for: a fourth band conversation, or any PR whose
description explains a size increase by pointing at the headroom rather than at
what the feature is worth.
