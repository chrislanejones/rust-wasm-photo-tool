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
n_any=$(rg -n '\bas any\b' app/src -g '*.ts' -g '*.tsx' -g '!*.d.ts' | wc -l)
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
check "rust-panics" 67 "panic/unsafe in the engine (§6)" "$n_rust"

n_aria=$(rg -n 'role="button"' app/src -g '*.tsx' | rg -v 'aria-label' | wc -l)
check "aria-button" 5 "role=button needs aria-label (§8)" "$n_aria"

if [ "$fail" -ne 0 ]; then
  echo
  echo "Guardrails FAILED: a count went up. Fix the new violations — raising a"
  echo "baseline to go green is the one move this script exists to prevent."
  exit 1
fi
echo "Guardrails OK (no count above baseline)."
