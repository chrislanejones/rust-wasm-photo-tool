# ADR-038: The Rust toolchain is pinned, so the shipped wasm size stops moving on its own
Date: 2026-08-18   Status: draft

## Context

Nothing pinned Rust. `netlify.toml` curled rustup with `--default-toolchain
stable` **and** set `RUSTUP_TOOLCHAIN = "stable"`; CI used
`dtolnay/rust-toolchain@stable`; a developer had whatever they last installed.
So the shipped binary was compiled by whichever `stable` existed on build day.

That produced a measurement nobody could explain for days: 806,967 B (local,
rustc **1.92.0**) and 813,546 B (live, rustc **1.97.1**) both sat in the record
as "the size of the engine". The 6,579 B gap was five compiler releases, proved
by matching the `/rustc/<hash>/` paths embedded in both binaries. After
updating locally the gap fell to **139 B**, of which 135 is the build machine's
own directory — `/opt/buildhome/` against `/home/clj/`, 5 characters × 27
embedded paths.

ADR-037 had just bounded that size to 780,000–850,000 B. **A band around a
number that moves on its own is a band around nothing.**

## Decision

Pin the toolchain in `rust-toolchain.toml` — `channel = "1.97.1"`, with
`clippy`, `rustfmt` and the `wasm32-unknown-unknown` target declared so rustup
installs a complete toolchain on first use. **Remove `RUSTUP_TOOLCHAIN` from
`netlify.toml`**: the environment variable overrides the file (verified —
`RUSTUP_TOOLCHAIN=stable rustup show` reports *"overridden by environment
variable"*), so leaving it would have made the pin a no-op on the one builder
that ships. Both CI Rust steps become `rustup show`, which installs and selects
whatever the file names and prints it into the log.

## Consequences

+ A Rust upgrade becomes a commit that can be reviewed, correlated with a size
  change, and reverted — instead of a silent size move with no author.
+ ADR-037's band now bounds a number that only changes when someone changes it.
+ The CI log states which compiler built the artifact, every run.
- **The pin will go stale, and staleness is invisible by design.** Nothing now
  tells anyone that 1.97.1 is old; the previous regime at least drifted forward.
  Dependabot does not watch `rust-toolchain.toml`.
- Contributors get a toolchain download on first build in this repo.
- Local still cannot byte-match production — the remaining 139 B is embedded
  build paths, and closing it would need `--remap-path-prefix`. Not attempted.

## Alternatives rejected

1. **Leave it floating and widen the band further.** Every rustc release would
   spend headroom nobody authorised, and the band was already raised once.
2. **Pin only Netlify.** CI and production would compile with different
   compilers — worse than today's problem, because it looks fixed.
3. **`--remap-path-prefix` to make builds byte-reproducible.** Solves a
   different problem (reproducibility, not drift) and touches every build's
   panic messages. Filed, not taken.

## Pre-mortem

It is six months later and this was a mistake. Most likely reason: the pin was
never bumped. Rust moved five or six releases, a contributor hit a dependency
that needed a newer compiler, and rather than bump the channel and re-measure,
someone deleted `rust-toolchain.toml` "temporarily" to unblock a build — which
silently restored floating behaviour, and the next size surprise took just as
long to diagnose as this one did, only now with an ADR claiming it could not
happen.

Early warning sign to watch for: a build failure whose fix is described as
"just use stable", or any diff that deletes this file without an accompanying
release note about the new wasm size.
