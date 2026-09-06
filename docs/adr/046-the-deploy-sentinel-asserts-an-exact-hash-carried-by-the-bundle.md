# ADR-046: The deploy sentinel asserts an exact hash, and the bundle carries its own expectation
Date: 2026-09-05   Status: draft
Successor to ADR-045, which named this as its recommended next step. Depends on the optimizer pin (ADR-038's correction).

## Context

ADR-045 established that the wasm build is reproducible — pin rustc, wasm-pack
and binaryen and local, CI and Netlify produce byte-identical output — and
narrowed the sentinel band to 800,000–840,000 B on the strength of it. It also
said what the band really is: a 40,000 B window that catches catastrophe and
cannot see drift. Its own recommendation was to replace it with an exact hash
"once there is CI plumbing for it".

Two things learned since make the design non-obvious, and both were learned by
being wrong first.

**1. The expectation cannot be a stored constant.** A seven-line COMMENT in
`src/ops.rs` changed the binary (#69): panic `Location`s embed `file:line:col`,
and that file has 166 potential panic sites below the edit. Size unchanged,
**5 bytes different**, different sha256. So "reproducible" means *per commit*.
Any scheme where a human updates an expected hash in a file is a scheme where
the hash is wrong on the first docs commit and gets bypassed by the second.

**2. A deploy and a CI run are not looking at the same thing.** CI builds
`github.sha` the moment a push lands; the live site may still be serving the
previous commit for a minute. An assertion that compares CI's hash to whatever
is live will go red on deploy lag, which is the fastest way to teach everyone
to ignore it.

## Decision

**The deployed bundle carries its own expectation.** `scripts/write-build-info.sh`
runs at the end of the Netlify build and writes `www-dist/build-info.json`:
the commit, the sha256 and byte count of the **published** asset (the hashed
file in `assets/`, the one a browser actually fetches), and the toolchain that
produced it. The sentinel then makes two assertions, weakest first:

| Tier | Question | Compares | Catches |
|---|---|---|---|
| **1** | Is the site serving the wasm its own build produced? | live asset sha256 ↔ `build-info.json` | stale CDN object, partial deploy, hand-edited asset |
| **2** | Did an independent builder get the same bytes? | `build-info.json` ↔ CI's build of the **same commit** | optimizer / compiler / feature drift between builders |

Tier 1 cannot suffer deploy lag: the file and the asset were written by the
same build, so they cannot disagree about which commit they are. Tier 2 is
compared **only when the commits match**, and reports itself skipped otherwise
— lag is stated, not failed.

**The size floor stays**, as an independent check. ADR-045 found the export
check had been vacuous for its entire life and the floor was the only thing
that ever caught a featureless deploy. Do not remove the survivor.

**Failures name their causes in order.** "Hash mismatch" with no next step gets
ignored. Tier 2's failure lists wasm-opt version, then rustc, then feature
flags, then env `RUSTFLAGS`, then a genuine source difference — the order they
actually occur in this repo, each with the file that pins it.

**Toolchain provenance is recorded by the build, never re-derived.**
`scripts/build-wasm.sh` writes `pkg/.build-wasm.env` naming the wasm-opt it
actually used, and `write-build-info.sh` reads that. The wrapper's PATH swap is
local to its own process, so asking `command -v wasm-opt` afterwards reports
the *shadowed* copy — which it did, writing `binaryen: 116` into a file
describing a build made with 117.

## Consequences

+ Drift of any size is now caught, not just drift bigger than 23 KB of
  remaining band headroom.
+ The check states what built the live site — commit, rustc, wasm-pack,
  binaryen — which no previous check could answer.
+ Tier 1 is a genuine deploy check the repo did not have: it catches a stale or
  partial publish, which no amount of source-side testing can.
- **Two wasm builds in CI now** (feature-free, then shipped) — about a minute.
  That is the price of proving two machines agree; the feature-free build is
  deliberate and predates this (`ci.yml`), so neither can be dropped.
- `build-info.json` is a public file naming the commit and toolchain. It says
  nothing that `git log` and the binary itself do not already say.
- **Currently fail-OPEN when `build-info.json` is absent**, so the first deploy
  after this merges is not blocked by a file the previous deploy never wrote.
  That is a hole, and it is deliberate and temporary — flip to `fail()` once a
  post-merge deploy is confirmed live. Left as the one follow-up.
- ⚠️ **A 200 is not proof a file exists.** Netlify's SPA fallback serves
  `index.html` for any unknown path, so `curl -f` on a missing
  `build-info.json` succeeds and returns HTML. Verified against the real site:
  an earlier version of this check read that as "present but malformed" and
  failed a healthy deploy. The body must actually be JSON before it is
  believed. Anything else added to this script must make the same check.

## Alternatives rejected

1. **Expected hash committed to the repo.** The obvious design, and #69 kills
   it: a comment-only commit changes the hash, so the file is stale on the next
   docs PR and the check becomes a chore to silence.
2. **CI's hash compared directly to the live site.** Goes red on every deploy
   lag. Tier 2 keeps the comparison and gates it on matching commits instead.
3. **Drop the size band now that hashes are exact.** The band answers a
   different question — "is this plausibly the engine at all" — and needs no
   `build-info.json`, so it still works on a bundle from before this change.
   Keeping both costs one `stat`.
4. **Sign the artifact.** Solves tampering, which is not the failure this repo
   has had. Five stale-or-featureless deploys, zero malicious ones.

## Pre-mortem

It is three months later and this was a mistake. Most likely reason: the
fail-open hole above was never closed, `write-build-info.sh` silently stopped
running, and the sentinel spent months reporting "build-info : ABSENT" while
everyone read the green tick. **The warning sign is that line appearing in a CI
log for a deploy that is not from before 2026-09-05.**

Second most likely: someone adds a build step after `write-build-info.sh` that
rewrites or re-optimizes the published wasm, so tier 1 fails on every deploy
and gets disabled rather than reordered. `write-build-info.sh` must stay last.
