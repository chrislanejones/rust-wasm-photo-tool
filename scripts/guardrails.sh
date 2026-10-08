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

# ⚠️ NO FILE EXEMPTIONS ANY MORE. This used to skip CompareSlider,
# MagnifierOverlay, GalleryBar and Thumb, because each drew white ON TOP OF A
# PHOTO and had nowhere to put it. They have somewhere now — `--on-photo`, one
# value in both themes, because a photo is underneath rather than a theme
# surface. All four were measured at ZERO after the conversion and the baseline
# did not move, so the check simply covers four more files than it did.
n_raw_color=$(rg -n '\b(bg|text|border|ring)-(zinc|neutral|gray|slate|stone)-[0-9]{2,3}\b|\btext-white\b|\bbg-white\b' \
    app/src -g '*.tsx' -g '*.ts' \
  | rg -v 'allow: raw-color' | wc -l)
check "raw-colors" 13 "use design tokens (docs/ci-guardrails.md (git history; moved out of the repo 2026-09-17) §2)" "$n_raw_color"

n_type=$(rg -n 'text-\[[0-9.]+px\]|font-medium|font-black' app/src -g '*.tsx' | wc -l)
check "type-scale" 5 "off-scale type / faux weights (§4)" "$n_type"

# Thumb.tsx carries GalleryBar's exclusion because it carries GalleryBar's
# code: the gallery tile was extracted out of that file, and the 7 raw-colour
# and 7 z-index lines these two checks exempt went with it unchanged (22 + 7 =
# 29 and 4 + 7 = 11 were the counts before the globs followed). Neither count
# grew — a file boundary moved. This is the "it greps TEXT" property CLAUDE.md
# warns about, read from the other direction.
# AppShell's exclusion is gone (UI Night 8, 10-06-2026): its three literals,
# registered for months as "unknown — inherited", were the drawer scrim, the
# Batch grid's empty overlay and its "Selected" pill. They are tokens now
# (--z-scrim, --z-canvas-overlay, --z-compare; same values), so AppShell is
# covered by this check like any other file.
n_z=$(rg -n '\bz-(10|20|30|40|50|60|100)\b|z-\[[0-9]' app/src -g '*.tsx' \
      -g '!**/GalleryBar.tsx' -g '!**/Thumb.tsx' | wc -l)
check "z-index" 4 "use z-[var(--z-*)] (§3)" "$n_z"

# ── UI rules R1, R3 and raw <button> (UI Night 7, docs/UI_CONSISTENCY.md §6) ──
# Counted by scripts/ui-ratchet-counts.mjs from the TypeScript syntax tree, NOT
# by rg: a grep here would go red on a comment explaining the rule, which this
# repo has already done twice. Comments are not syntax nodes, so they cannot
# count; a string only counts when it is a class list. The counter self-tests
# on a planted snippet first, and ANY failure is fatal here — an erroring
# counter must never read as zero violations.
#
# Baselines are the counts on 09-29-2026, reconciled line by line against the
# text inventory (scripts/ui-inventory.mjs): every hit the text finds and this
# does not is a comment, a test, a JS identifier (`rounded: 16`) or a
# directional house radius the text regex truncates (`rounded-r-full`).
#   ui-spacing     R1 — padding/gap/space off the 0·0.5·1·1.5·2·3·4·6·8 scale
#   ui-radius      R3 — bare `rounded`, `rounded-xl/2xl`, arbitrary `rounded-[…]`
#   ui-raw-button  a raw <button> outside components/ui/ (JSX elements, not text)
# Fixing these CHANGES PIXELS (a radius sweep touches ~50 sites), so they are
# frozen here and paid down on purpose, not in a sweep.
ui_counts="$(node scripts/ui-ratchet-counts.mjs)" || {
  echo "::error::scripts/ui-ratchet-counts.mjs failed — see its output above"
  echo "FATAL: a guardrail counter failed to execute." >&2
  exit 1
}
ui_count() { printf '%s\n' "$ui_counts" | awk -v k="$1" '$1==k {print $2}'; }
# ui-radius 50 → 26 (UI Night 8, 10-06-2026): 18 bare `rounded` renamed to
# `rounded-sm` (both 4px — proven 0 px different, element by element, both
# themes), and 6 hits were never radius at all: the Text tool's corner-preset
# VALUES ("rounded" as a type, an `id:` and a ternary result), which the
# counter now reads as values. Its self-test plants all three.
# Then 26 → 22: four `rounded-xl` in files Night 8 was already in (Batch's logo
# drop zone and logo row, New's surface and drop zone) → `rounded-lg`. That one
# DOES change pixels (12px → 10px). The chrome family (Tools/Gallery cards, top
# bar, master bar) and the modal surfaces stay: changing one of a family alone
# splits it, and picking the family's radius is a call for Chris.
check "ui-spacing" 42 "spacing off the scale — docs/UI_CONSISTENCY.md R1" "$(ui_count ui-spacing)"
check "ui-radius" 22 "radius outside rounded-sm/md/lg/full — R3" "$(ui_count ui-radius)"
check "ui-raw-button" 14 "raw <button> outside components/ui/ — use ui/button" "$(ui_count ui-raw-button)"

# ── The exception registry explains every row (UI Night 8, 10-06-2026) ──
# docs/UI_EXCEPTIONS.md is where an escape hatch says WHY. A row reading
# "unknown" is an exclusion nobody can defend; the last one (AppShell's three
# z-index literals) closed on Night 8. Counted case-insensitively as a word,
# so "unknown" anywhere in the file — table or prose — is a violation. Write
# what you found, or what you have not checked yet and when you will.
[ -f docs/UI_EXCEPTIONS.md ] || { echo "FATAL: docs/UI_EXCEPTIONS.md is missing — a missing file must not read as zero." >&2; exit 1; }
n_unknown=$(rg -ciw 'unknown' docs/UI_EXCEPTIONS.md || true)
check "exceptions-unknown" 0 "every row in docs/UI_EXCEPTIONS.md gives a reason (R10)" "${n_unknown:-0}"

# ── Every raw <button> left is a REGISTERED one (UI Night 8) ──
# ui-raw-button counts them; this checks each file that still has one is named
# in docs/UI_EXCEPTIONS.md §5, so the ratchet's floor is a list of reasons and
# not a number. A file missing from the registry is one violation.
n_unreg=0
for f in $(node scripts/ui-ratchet-counts.mjs --list | awk -F'\t' '$1=="button" {split($2,a,":"); print a[1]}' | sort -u); do
  rg -qF "\`${f#app/src/}\`" docs/UI_EXCEPTIONS.md || { echo "  unregistered raw <button>: $f"; n_unreg=$((n_unreg+1)); }
done
check "unregistered-raw-button" 0 "a raw <button> outside components/ui/ needs a row in docs/UI_EXCEPTIONS.md §5" "$n_unreg"

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

# NO GRAY PHOTOS. A thumbnail is a placeholder or the photo, and the
# black-and-white "develop" that used to sit between them is deleted, not
# disabled — `useThumbDevelop`, `thumbDevelop` and their constants are gone.
#
# It was removed because it could not be made to work: its effect reset the
# loaded flag AFTER mount, so a cached blob that decoded first had its load
# erased and the tile stayed gray for good; `loading="lazy"` left off-screen
# tiles gray until scrolled; and one module-level turn queue was shared by the
# strip and the grid. A tile stuck half-developed reads as a broken image, and
# the rule that prevents it is the absence of a gray state, not a better
# scheduler.
#
# Comment lines are excluded the same way as `as-any` above: this very
# paragraph names the filter it greps for, and a gate that goes red on prose
# explaining it is the failure documented in CLAUDE.md.
#
# ⚠️ SCOPE, stated exactly: this bans the CSS FUNCTION form, `grayscale(`, which
# is what the develop used (`filter: "grayscale(1)"` in an animation token). It
# does NOT ban Tailwind's bare `grayscale` utility, which is legitimately in use
# at lib/styles.ts for the DISABLED tile style (`opacity-40 grayscale`) — one
# element in a running app carries it, measured in the browser.
#
# So the gap is real and named: a develop rebuilt with the utility class rather
# than the function would slip past. Banning the utility outright would turn the
# disabled style red, which is the wrong trade; if a gray thumbnail ever comes
# back, the test to add is the one in useThumbImage.test.ts, not a wider grep.
#
# Baseline 0. Verified by planting `filter: "grayscale(1)"` in a tile and
# watching the count go to 1, then removing it and watching it return to 0.
n_gray=$(rg -n 'grayscale\(' app/src -g '*.ts' -g '*.tsx' -g '*.css' \
  | rg -v '^[^:]+:[0-9]+:[[:space:]]*(//|/\*|\*)' | wc -l)
check "no-gray-photos" 0 "a thumbnail is a placeholder or the photo — never a gray photo" "$n_gray"

# DOCUMENT STATE THROUGH THE ACCESSOR (Plan C §3). During a photo switch the
# engine mirror (`stamp.state`) still describes the OUTGOING photo while every
# label already names the incoming one, so a component that reads its
# width/height/undo depth directly shows the wrong photo's numbers.
# Components read it through hooks/useLoadedDocument.ts instead, which is null
# mid-switch. Scope: app/src/components + app/src/features (the session hooks
# own the engine and read it directly by design). Comment lines excluded.
#
# Baseline 8, all in CanvasArea.tsx, which SIZES the canvas to the document
# the engine holds — the one reader for whom the engine's own numbers are
# right even mid-switch. May only go down. StatusBar was migrated when this
# was added (10 → 8).
n_docreads=$(rg -n '\bstate\.(width|height|undoCount|redoCount)\b' app/src/components app/src/features \
  -g '*.ts' -g '*.tsx' -g '!*.test.*' \
  | rg -v '^[^:]+:[0-9]+:[[:space:]]*(//|/\*|\*)' | wc -l)
check "direct-document-reads" 8 "read document state via hooks/useLoadedDocument" "$n_docreads"

# Document readiness belongs to the loader, never a legacy UI completion timer.
n_load_legacy=$(( $( (rg -n '\b(loadProgress|setLoadProgress|startImageLoad|finishImageLoad)\b' app/src/stores/useUIStore.ts || true) | wc -l) ))
check "legacy-photo-loading" 0 "use document readiness; remove obsolete UI loading timers" "$n_load_legacy"

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
# 47 -> 46 on 2026-09-26: measured, not annotated — a production site left.
# The breakdown below is now 44 production + the same 2 test panics.
#
# What 47 meant: 45 genuine production sites — 35 of them SIMD `unsafe`,
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
