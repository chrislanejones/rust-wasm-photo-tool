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
- ~~Local still cannot byte-match production — the remaining 139 B is embedded
  build paths, and closing it would need `--remap-path-prefix`. Not attempted.~~
  **Superseded 2026-09-05 — see the correction below.** The remap landed (#70)
  and local now DOES byte-match production, once the optimizer is held constant.

## Alternatives rejected

1. **Leave it floating and widen the band further.** Every rustc release would
   spend headroom nobody authorised, and the band was already raised once.
2. **Pin only Netlify.** CI and production would compile with different
   compilers — worse than today's problem, because it looks fixed.
3. **`--remap-path-prefix` to make builds byte-reproducible.** Solves a
   different problem (reproducibility, not drift) and touches every build's
   panic messages. Filed, not taken. *(Taken later as #70 — and it worked, see
   the correction below.)*

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

## Correction — 2026-09-05

This ADR measured a **139 B** local/deployed gap and attributed 135 B to
embedded registry paths and 4 B to nothing it could name. Both halves are now
resolved, and the second was not what it looked like.

| Component | This ADR said | Measured 2026-09-05 |
|---|---|---|
| Registry paths | 135 B | **0** — #70's `--remap-path-prefix` removed them from both builds |
| "Unexplained" | 4 B | **never a constant** — it was the OPTIMIZER |

`wasm-pack` runs `wasm-opt` last, and uses whichever `wasm-opt` is on PATH
before falling back to the copy it fetches. This laptop had binaryen **116**
on PATH; wasm-pack 0.15.0 fetches **117**, which is what CI and Netlify — with
no binaryen installed — actually used. Two optimizers on identical input
produced binaries differing in **456,523 byte positions** whose sizes happened
to land 3 B apart. So "4 unexplained bytes" was a size delta between two
entirely different binaries, read as a near-match because the totals were
close.

Hold the optimizer constant and **local == deployed, byte for byte**
(816,971 B, sha256 `24c103c7…`, 0 differing bytes). Two consecutive local
builds are also bit-identical.

**The pin this ADR established was therefore necessary and not sufficient**:
rustc pinned, wasm-pack pinned, and the binary could still differ because the
tool that rewrites every byte of it was not. `scripts/build-wasm.sh` now
refuses to run with any `wasm-opt` other than 117 on PATH, and every build
entry point (package.json, netlify.toml, CI) goes through it. ADR-045 narrows
the sentinel band on the strength of this; its recommended successor is an
exact-hash assertion, which reproducibility makes possible for the first time.

The pre-mortem above stands unchanged — a stale pin is still the likeliest
way this goes wrong — with one addition: **the second-likeliest is a
developer with binaryen on PATH who never sees the wrapper's error because
they typed `wasm-pack build` directly.**
