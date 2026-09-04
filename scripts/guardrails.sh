#!/usr/bin/env bash
# Static guardrails — BLOCKING, via a baseline ratchet.
#
# These used to run under `continue-on-error: true` on both the job and every
# step, i.e. they reported violations and failed nothing. Advisory theater: a
# check nobody can fail is a check nobody reads.
#
# The obvious fix — flip them to blocking — breaks the build immediately: only
# one of the six is at zero today (112 violations across the other five). The
# other obvious fix — widen the exclude globs until they pass — is the ratchet
# anti-pattern the guardrails doc explicitly forbids, because it silently
# forgives whole files forever.
#
# So: each check has a BASELINE count, and the build fails when the count goes
# UP. New violations are blocked from today; existing ones are visible, counted,
# and can only be paid down. When a baseline reaches 0, change it to 0 and it
# becomes a hard gate for free.
#
# To pay one down: fix violations, run this script, lower the number. It should
# only ever move toward zero — a raised baseline in a diff is a red flag and
# should be challenged in review.
#
# Runnable locally, same as CI:  ./scripts/guardrails.sh
set -uo pipefail

cd "$(dirname "$0")/.."

# HARD PRECONDITION. Without this, a missing ripgrep makes every `rg | wc -l`
# return 0, every check reads as "improved", and the script exits 0 — a
# guardrail reporting all-clear precisely when it cannot see anything. That is
# not hypothetical: it is what this script did on its first run, because `rg` on
# this machine is a shell function Claude Code injects into zsh and is invisible
# to a bash script. CI installs real ripgrep (see the workflow); locally you
# need it on PATH.
if ! command -v rg >/dev/null 2>&1; then
  echo "::error::ripgrep (rg) not found — guardrails cannot run."
  echo "FATAL: rg missing. Refusing to report a pass I cannot substantiate." >&2
  echo "  CI: apt-get install -y ripgrep   local: install ripgrep" >&2
  exit 1
fi

# ...and prove it WORKS, not merely that something named rg is on PATH. The
# existence check above is not enough: a wrapper that errors on every real
# query still satisfies `command -v`, and then every count comes back 0 and the
# whole suite reports "improved". Caught exactly that during development with a
# shim that only implemented --version. Search a file we just wrote for a token
# we just put in it; if rg cannot find that, it cannot be trusted for anything.
_selftest="$(mktemp)"
printf 'guardrails-selftest-token\n' > "$_selftest"
if [ "$(rg -c 'guardrails-selftest-token' "$_selftest" 2>/dev/null)" != "1" ]; then
  rm -f "$_selftest"
  echo "::error::ripgrep is present but not functioning — guardrails cannot run."
  echo "FATAL: rg self-test failed. Refusing to report a pass I cannot substantiate." >&2
  exit 1
fi
rm -f "$_selftest"

# Run one guardrail query. rg exits 0 on match, 1 on NO match, >=2 on ERROR —
# and `rg | wc -l` swallows all three, which is how an erroring rg reads as
# "zero violations". Anything >=2 is fatal rather than silently zero.
rg_count() {
  local out status
  out="$(rg "$@" 2>/dev/null)"; status=$?
  if [ "$status" -ge 2 ]; then
    echo "::error::ripgrep errored (exit $status) on: rg $*"
    echo "FATAL: a guardrail query failed to execute." >&2
    exit 1
  fi
  [ -z "$out" ] && { echo 0; return; }
  printf '%s\n' "$out" | wc -l
}

# Lower these as violations are fixed. NEVER raise one to make CI pass.
fail=0

check() {
  local name="$1" baseline="$2" desc="$3" count="$4"
  if [ "$count" -gt "$baseline" ]; then
    echo "::error::$name — $count violations, baseline $baseline. $desc"
    echo "  FAIL $name: $count > $baseline (NEW violations — fix them, do not raise the baseline)"
    fail=1
  elif [ "$count" -lt "$baseline" ]; then
    echo "  IMPROVED $name: $count < $baseline — lower the baseline in scripts/guardrails.sh to lock it in"
  else
    echo "  ok $name: $count (baseline)"
  fi
}

n_raw_color=$(rg -n '\b(bg|text|border|ring)-(zinc|neutral|gray|slate|stone)-[0-9]{2,3}\b|\btext-white\b|\bbg-white\b' \
    app/src -g '*.tsx' -g '*.ts' \
    -g '!**/CanvasArea.tsx' -g '!**/PenOverlay.tsx' -g '!**/CompareSlider.tsx' \
    -g '!**/MagnifierOverlay.tsx' -g '!**/GalleryBar.tsx' -g '!**/colors.ts' -g '!**/toolConfig.ts' \
  | rg -v 'allow: raw-color' | wc -l)
check "raw-colors" 26 "use design tokens (docs/ci-guardrails.md §2)" "$n_raw_color"

n_type=$(rg -n 'text-\[[0-9.]+px\]|font-medium|font-black' app/src -g '*.tsx' | wc -l)
check "type-scale" 9 "off-scale type / faux weights (§4)" "$n_type"

n_z=$(rg -n '\bz-(10|20|30|40|50|60|100)\b|z-\[[0-9]' app/src -g '*.tsx' \
      -g '!**/GalleryBar.tsx' -g '!**/AppShell.tsx' | wc -l)
check "z-index" 4 "use z-[var(--z-*)] (§3)" "$n_z"

# Already at zero — a true hard gate. Any reintroduction fails the build.
#
# ⚠️ `\bas any\b` also matches ENGLISH, and did. The one hit that turned this
# check red was `useCanvasActions.ts`'s note — "…corrected itself as soon as
# any other dependency moved" — a comment explaining a real export bug, counted
# as a cast. There was no `as any` cast anywhere in app/src; the gate had been
# failing on prose. Comment lines are dropped before counting: `//`, `/*` or a
# jsdoc `*` at the START of the matched line is prose, not code.
#
# A cast with a trailing comment (`foo as any // why`) is still counted — that
# is the case worth catching, and it is not at the start of the line. A cast
# buried inside a block comment is missed, which is fine: commented-out code
# does not ship.
#
# The baseline stays 0. This fixes a FALSE POSITIVE; it does not soften the
# gate. Verified by planting a real cast and watching the count go to 1.
n_any=$(rg -n '\bas any\b' app/src -g '*.ts' -g '*.tsx' -g '!*.d.ts' \
  | rg -v '^[^:]+:[0-9]+:[[:space:]]*(//|/\*|\*)' | wc -l)
check "as-any" 0 "import real types (R7)" "$n_any"

# SIMD unsafe is expected here; the count keeps it from growing unnoticed.
#
# `// allow: rust-panic` skips a reviewed site. The docs have promised this
# escape hatch since the check was written, but only raw-colors ever
# implemented one — so the only ways to go green were to delete the code or
# raise the baseline, and this script exists to forbid the second. Added
# 2026-08-04, mirroring the raw-colors filter above.
#
# ⚠️ The annotation MUST be on the SAME LINE as the violation — `rg -v` drops the
# matching line, so a comment on the line above filters nothing and the count
# does not move. (Cost twenty minutes the day it was added.)
#
# It earns its keep on the inline `#[cfg(test)]` modules in src/: a test that
# asserts with `.expect(...)` is CORRECT — panicking is how a test fails — but
# ripgrep cannot tell engine code from test code, so every new engine test
# pushes this count up for no reason. Annotate those; never annotate a real
# panic on a pixel path.
n_rust=$(rg -n '\.unwrap\(\)|\.expect\(|panic!|unsafe ' src -g '*.rs' \
  | rg -v 'allow: rust-panic' | wc -l)
# LOWERED 67 -> 47 on 2026-08-18, by ANNOTATING, never by raising. 61 lines
# inside `#[cfg(test)]` modules (plus `ops_engine_parity.rs`, whose whole file
# is gated `#[cfg(all(test, feature = "tiles"))]` at its `mod` declaration in
# lib.rs — easy to miss, it carries no inner `cfg(test)`) took
# `// allow: rust-panic`. Count went 108 -> 47.
#
# ⚠️ `src/paint.rs` hides the same shape MID-FILE: a second test module gated
# `#[cfg(all(test, feature = "patchmatch"))]` at line ~1100, which a scan for
# the literal string `cfg(test)` does not match. Between it and
# ops_engine_parity that is 7 lines a naive pass misfiles as production code.
# Match `cfg(all(test` too, and check the `mod` declaration, not just the file.
#
# What 47 now means: 45 genuine production sites — 35 of them SIMD `unsafe`,
# which is expected and unchanged since v7.72 — plus exactly 2 test panics that
# CANNOT carry a same-line annotation:
#   src/ops_engine_parity.rs  the multi-line `panic!(` in assert_flat_identical
#   src/ops.rs                the `.unwrap()` in a let-else scrutinee
# rustfmt relocates a trailing comment out of a multi-line macro call and out of
# a let-else head, onto its own line — where `rg -v` no longer drops the
# violation, so the annotation silently does nothing. Leaving the orphan would
# be a comment lying about its code, so those two are honestly uncounted-for.
# ⚠️ Do not "fix" them by contorting the code to satisfy a grep.
#
# One more rustfmt hazard, found the same day: annotating a line IMMEDIATELY
# followed by a standalone `//` comment makes rustfmt align that comment to the
# annotation column, shoving unrelated prose out to column ~70. A blank line
# between them prevents it.
check "rust-panics" 47 "panic/unsafe in the engine (§6)" "$n_rust"

n_aria=$(rg -n 'role="button"' app/src -g '*.tsx' | rg -v 'aria-label' | wc -l)
check "aria-button" 5 "role=button needs aria-label (§8)" "$n_aria"

# ── src/lib.rs SIZE RATCHET (the Rust twin of eslint's max-lines) ──
#
# The TS side got `max-lines` with per-file baselines on 2026-08-27; this is the
# same idea for the one Rust file with the same problem. lib.rs is 5,213 lines
# and holds the whole wasm_bindgen surface, so it cannot simply be split — but
# it can be stopped from growing, and its stateless free functions and op-log
# persistence surface are already coherent chunks ready for the
# `annotations.rs` / `capture.rs` extraction treatment.
#
# Same rule as every other baseline here: this number only goes DOWN. When an
# extraction lands, lower it in the same commit.
#
# Deliberately NOT rustc's `dead_code` lint, which was the obvious candidate
# and does not work in this crate — an unused private fn added to lib.rs,
# history.rs or edges.rs produces no diagnostic at all under
# `cargo check --all-features` (verified 2026-08-27 with --message-format=json:
# zero compiler-message entries), while the identical probe warns in a minimal
# crate on the same pinned 1.97.1 toolchain. Cause not identified; do not
# re-derive it as "pub items are exempt" — the probe was private, and cdylib
# and wasm-bindgen were both ruled out by isolation.
# 5213 -> 5183 (layer Color Overlay, 2026-08-28): `Layer::from_snapshot_pixels`
# moved the two hand-built snapshot layers out to layer.rs, and the Color
# Overlay engine tests were written into layer.rs's own test module rather than
# here. Lowered in the same commit as the extraction, per the rule above.
n_librs=$(wc -l < src/lib.rs)
check "librs-lines" 5183 "src/lib.rs is growing (Entropy plan Phase 3)" "$n_librs"

# ── DEAD EXPORTS ──
# See scripts/dead-exports-audit.mjs for why this is a scan and not a compiler
# flag (short version: rustc's dead_code lint emits nothing in this crate, and
# tsc has no unused-export diagnostic at all).
#
# Baseline 2 on 2026-08-27, both same-file-only and both safe to pay down:
#   app/src/lib/exportImage.ts     formatCarriesAlpha
#   app/src/lib/webgpu/selfTest.ts gpuBlurSelfTest
n_deadexp=$(node scripts/dead-exports-audit.mjs | sed -n 's/^TOTAL: //p')
if [ -z "$n_deadexp" ]; then
  echo "FATAL: dead-exports-audit printed no TOTAL — treat as broken, not as zero." >&2
  exit 1
fi
check "dead-exports" 1 "exported and never used (scripts/dead-exports-audit.mjs)" "$n_deadexp"

if [ "$fail" -ne 0 ]; then
  echo
  echo "Guardrails FAILED: a count went up. Fix the new violations — raising a"
  echo "baseline to go green is the one move this script exists to prevent."
  exit 1
fi
echo "Guardrails OK (no count above baseline)."
