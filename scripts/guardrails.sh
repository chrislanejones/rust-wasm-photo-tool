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
    -g '!**/MagnifierOverlay.tsx' -g '!**/GalleryBar.tsx' -g '!**/colors.ts' \
  | rg -v 'allow: raw-color' | wc -l)
check "raw-colors" 22 "use design tokens (docs/ci-guardrails.md §2)" "$n_raw_color"

n_type=$(rg -n 'text-\[[0-9.]+px\]|font-medium|font-black' app/src -g '*.tsx' | wc -l)
check "type-scale" 8 "off-scale type / faux weights (§4)" "$n_type"

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
# 47 -> 46 (2026-09-20). Paid down by #131 (`2d188420`, "fonts arrive at
# runtime"), which annotated two test-only sites `// allow: rust-panic` —
# ⚠️ and then did not record it: that commit touches ZERO lines of this file.
# Measured in a clean clone at both commits rather than inferred from the diff:
#   6a3de6be (the commit before #131)  47
#   2d188420 (#131)                    46
#   5bd73cce (v8.80, master today)     46
# ADR-058 documents the lowering as part of the change; the branch carried it,
# the merge did not. Three CI runs have printed "IMPROVED rust-panics: 46 < 47"
# since, which is this script asking to be told. A ratchet left loose is not a
# ratchet — 46 is the new ceiling and the two annotated sites can no longer be
# un-annotated for free.
check "rust-panics" 46 "panic/unsafe in the engine (§6)" "$n_rust"

n_aria=$(rg -n 'role="button"' app/src -g '*.tsx' | rg -v 'aria-label' | wc -l)
check "aria-button" 4 "role=button needs aria-label (§8)" "$n_aria"

# ── src/lib.rs line count: NOT ratcheted ──
# `librs-lines` (5213 -> 4771 over Aug-Sep 2026) was retired by Chris on
# 09-25-2026. lib.rs is refactored often enough that a blocking line count cost
# more than it caught. Don't reintroduce it without asking.

# ── DEAD EXPORTS ──
# See scripts/dead-exports-audit.mjs for why this is a scan and not a compiler
# flag (short version: rustc's dead_code lint emits nothing in this crate, and
# tsc has no unused-export diagnostic at all).
#
# Baseline 2 on 2026-08-27, both same-file-only and both safe to pay down:
#   app/src/lib/exportImage.ts     formatCarriesAlpha
#   app/src/lib/webgpu/selfTest.ts gpuBlurSelfTest
#
# 1 -> 0 on 2026-09-09: `gpuBlurSelfTest` lost its `export` keyword. Paid down,
# not waved through — and worth reading, because the audit had ALREADY stopped
# flagging it for the wrong reason. A comment in blurReference.ts spells the
# name, and this audit counts an identifier appearing in any other file's TEXT
# as an external reference, comments included (PARKING_LOT). So it reported an
# improvement that a reworded comment would silently undo. The export is now
# genuinely gone, so the zero is real.
n_deadexp=$(node scripts/dead-exports-audit.mjs | sed -n 's/^TOTAL: //p')
if [ -z "$n_deadexp" ]; then
  echo "FATAL: dead-exports-audit printed no TOTAL — treat as broken, not as zero." >&2
  exit 1
fi
check "dead-exports" 0 "exported and never used (scripts/dead-exports-audit.mjs)" "$n_deadexp"

# ── THE BASE COMMIT THE THREE MATCHED PAIRS DIFF AGAINST ──
#
# All three co-change checks below ask one question — did one side of a pair
# move without the other? — and all three need one thing to ask it: a commit to
# diff HEAD against. Resolved ONCE, here, because three copies of the same
# resolution are three chances for them to drift apart.
#
# ⚠️ THIS IS WHERE ALL THREE WERE VACUOUS UNTIL 2026-09-20, AND THE MESSAGE
# THEY PRINTED SAID THE OPPOSITE. It read "no origin/master to diff against
# (runs in CI)", and CI was the one place it did not run: `actions/checkout`
# clones at depth 1 by default, so `origin/master` is absent on the runner, and
# 12 of the 13 checkout steps in ci.yml took that default. Measured on two real
# runs, not inferred:
#   pull_request 35487378044 → skip, skip, skip
#   push master  35456540646 → ok (0 hunks), ok (0 hunks), ok (0 hunks)
# So they never compared a one-sided edit on a PULL REQUEST — the only event
# where one is still catchable before it lands — and on master they reported a
# pass against an empty diff, because there origin/master IS HEAD. Both states
# were empty; only one of them admitted it. The other half of the fix is in
# ci.yml, which now gives this job the history; this half is the part that
# refuses to go quiet again.
#
# Three HONEST states, none of which flatters:
#   compare  a base exists and there is something to diff → the check has teeth
#   n/a      the base IS HEAD and the tree is clean       → nothing to compare,
#            and printing "ok" for that is the exact lie this block removes
#   absent   no origin/master at all                      → a bare local clone,
#            and FATAL in CI, where it means a broken checkout rather than a
#            local convenience. A gate that no-ops on its own misconfiguration
#            is the class of check this repo keeps finding green and empty.
pair_base=$(git merge-base origin/master HEAD 2>/dev/null || true)
pair_head=$(git rev-parse HEAD 2>/dev/null || true)

if [ -z "$pair_base" ] && [ -n "${GITHUB_ACTIONS:-}" ]; then
  echo "::error::matched-pair checks have no base commit — origin/master is missing from this checkout."
  echo "FATAL: the three co-change checks cannot run, so this job cannot substantiate a pass." >&2
  echo "  The guardrails job needs 'fetch-depth: 0' on its checkout (.github/workflows/ci.yml)." >&2
  exit 1
fi

# Returns 0 when a pair check can do real work. When it cannot it PRINTS why
# and returns 1, so the reason always reaches the log and all three call sites
# read the same way.
#
# ⚠️ The `git status` half of the n/a test is load-bearing, not decoration. The
# diffs below are TWO-DOT on purpose so they see the working tree — that is what
# makes this usable as a pre-push guard on uncommitted work. On a local master
# branch the base IS HEAD while the edit sits unstaged, and calling that "n/a"
# would switch the check off in precisely the situation it was written for. So
# n/a needs both: base == HEAD *and* nothing modified. `-uno` keeps a stray
# untracked file (a scratch note, SESSION_LOG.md) from counting as an edit.
pair_can_compare() {
  if [ -z "$pair_base" ]; then
    echo "  skip $1: no origin/master in this checkout — run 'git fetch origin master' first."
    echo "       (Local-only state. On a CI runner this is fatal, not a skip — see above.)"
    return 1
  fi
  if [ "$pair_base" = "$pair_head" ] && [ -z "$(git status --porcelain -uno 2>/dev/null)" ]; then
    echo "  n/a $1: HEAD is origin/master with a clean tree — no one-sided edit to compare."
    echo "       (This check has teeth on a pull request, which is where it now runs.)"
    return 1
  fi
  return 0
}

# ── MATCHED PAIR: the blur oracle (ADR-030) ──
# `src/simd/blur.rs` (what the engine actually runs) and
# `app/src/lib/webgpu/blurReference.ts` (the oracle the GPU shader is checked
# against) must describe the same arithmetic. When they drift, `gpuBlurSelfTest`
# keeps reporting PASS — it compares the shader against the ORACLE, so a wrong
# oracle is invisible to the only check that would notice.
#
# This pair has already cost a night. The oracle was never bit-exact: it
# accumulated at f64 while the crate accumulates at f32, and the disagreement
# only appears above 64x64, which was the harness's largest case.
#
# Same scoping rule as the anchor pair below: match a changed line carrying the
# blur's actual arithmetic, not any edit to the file, so a comment cannot turn
# this red.
if pair_can_compare blur-oracle-pair; then
  rust_blur=$(git diff "$pair_base" -- src/simd/blur.rs \
    | grep -cE '^[+-].*(f32x4_add|f32x4_mul|\.round\(\)|kernel\[)' || true)
  ts_blur=$(git diff "$pair_base" -- app/src/lib/webgpu/blurReference.ts \
    | grep -cE '^[+-].*(F\(|Math\.fround|kernel\[|buildGaussianKernel)' || true)
  if [ "$rust_blur" -gt 0 ] && [ "$ts_blur" -eq 0 ]; then
    echo "FAIL blur-oracle-pair: src/simd/blur.rs changed, blurReference.ts did not."
    echo "     The oracle is what gpuBlurSelfTest compares the shader against, so a"
    echo "     stale oracle makes that harness report PASS while the shader is wrong."
    echo "     Change both, or say why in the commit (ADR-030)."
    fail=1
  else
    echo "  ok blur-oracle-pair (engine hunks: $rust_blur, oracle hunks: $ts_blur)"
  fi
fi

# ── MATCHED PAIR: the rotated-text anchor (ADR-050) ──
# `text::rotated_tile_offset` (Rust, where the commit is anchored) and
# `pivotLocal*` in CanvasArea.tsx (where the PREVIEW is anchored) must describe
# the same pivot. If they disagree the preview and the committed pixels drift
# apart — a worse defect than the one ADR-050 fixed, and invisible to every
# other gate here: both sides compile, both sides pass their own tests, and
# nothing in this repo renders a saved rotated annotation and compares it to a
# stored expectation.
#
# ⚠️ SCOPED TO THE FORMULA, not to the files. Firing on any edit to either file
# would make a comment change go red, which is the failure mode this script has
# already had once (a comment that spelled a violation while explaining it).
# So it looks for a changed line carrying the actual trig, and only then asks
# whether the TS pivot moved with it.
#
# ⚠️ TWO-DOT DIFF, on purpose. `$base...HEAD` compares COMMITS and reported
# "0 hunks" while the change sat uncommitted in the working tree — the check
# would have passed on the very commit it was written for. `git diff $base`
# includes the working tree, which is what a pre-push guard needs to see.
#
# ⚠️ NEEDS A BASE REF, so it cannot run in a bare local checkout. It SAYS so
# rather than passing quietly — a co-change check that silently no-ops is worth
# less than no check, and "verified in one environment" is this repo's most
# expensive recurring mistake. That warning was right and the code under it was
# wrong for months: the message it printed named CI as the place this runs, and
# CI was the one place it did not. See the base-commit block above.
if pair_can_compare rotated-anchor-pair; then
  formula_changed=$(git diff "$pair_base" -- src/text.rs \
    | grep -cE '^[+-].*(hw \* cos|hw \* sin|hh \* cos|hh \* sin)' || true)
  pivot_changed=$(git diff "$pair_base" -- app/src/features/canvas/CanvasArea.tsx \
    | grep -cE '^[+-].*pivotLocal' || true)
  if [ "$formula_changed" -gt 0 ] && [ "$pivot_changed" -eq 0 ]; then
    echo "FAIL rotated-anchor-pair: text::rotated_tile_offset changed, CanvasArea's pivotLocal* did not."
    echo "     The engine anchors the COMMIT and CanvasArea anchors the PREVIEW."
    echo "     Change both, or the preview stops matching what gets baked (ADR-050)."
    fail=1
  else
    echo "  ok rotated-anchor-pair (formula hunks: $formula_changed, pivot hunks: $pivot_changed)"
  fi
fi

# -- MATCHED PAIR: the engine blur and the WGSL shader (ADR-030) --
# The THIRD side of the same triangle. `blur-oracle-pair` above ties the engine
# to the TS oracle; this ties the engine to the shader that actually runs on the
# GPU. Two pairs left the third edge unguarded, and that edge is the one that
# nearly shipped: during the #101 rebase the GPU path was still carrying a
# ported kernel and would have differed from the engine by 1 LSB IN PRODUCTION.
# That is precisely the defect ADR-030 exists to prevent, and nothing checked it.
#
# The shader must agree with `src/simd/blur.rs` on two things: how samples are
# accumulated, and how a float is turned back into a byte. The second is subtle
# on purpose -- the shader floors (x + 0.5) rather than calling the WGSL round(),
# because that one rounds half to even and the engine does not. An edit that
# "tidies" it back to round() is invisible to every other gate here.
#
# Same scoping rule as its two siblings: match a changed line carrying the real
# arithmetic, never any edit to the file, so prose cannot turn this red.
#
# Two-dot diff, so the working tree counts -- a pre-push guard that only sees
# committed work passes on the very change it was written for.
if pair_can_compare blur-shader-pair; then
  rust_arith=$(git diff "$pair_base" -- src/simd/blur.rs \
    | grep -cE '^[+-].*(f32x4_add|f32x4_mul|\.round\(\)|kernel\[)' || true)
  wgsl_arith=$(git diff "$pair_base" -- app/src/lib/webgpu/gpuBlur.ts \
    | grep -cE '^[+-].*(acc = acc \+|kernel\[|floor\(c\.|clamp\(floor)' || true)
  if [ "$rust_arith" -gt 0 ] && [ "$wgsl_arith" -eq 0 ]; then
    echo "FAIL blur-shader-pair: src/simd/blur.rs changed, the WGSL shader did not."
    echo "     The engine and the shader must round and accumulate identically, or"
    echo "     the GPU path differs from the CPU one by a least-significant bit and"
    echo "     only a byte-compare would ever notice. Change both, or say why (ADR-030)."
    fail=1
  else
    echo "  ok blur-shader-pair (engine hunks: $rust_arith, shader hunks: $wgsl_arith)"
  fi
fi

if [ "$fail" -ne 0 ]; then
  echo
  echo "Guardrails FAILED: a count went up. Fix the new violations — raising a"
  echo "baseline to go green is the one move this script exists to prevent."
  exit 1
fi
echo "Guardrails OK (no count above baseline)."
