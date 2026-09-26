#!/usr/bin/env bash
# Proof for scripts/gate-run.sh.  Run it:  ./scripts/gate-run.test.sh
#
# A helper written to catch checks that cannot fail has exactly one obligation:
# be watched failing. So this suite does two things.
#
#   1. It asserts the helper goes RED on each of the six shapes that got past
#      this repo's real gates — including the ones that exit 0 while saying so.
#   2. `./scripts/gate-run.test.sh --prove-red` SABOTAGES A COPY of the helper
#      (one stubbed function per run), re-runs this same suite against the
#      sabotaged copy, and requires the suite to go red. If a suite can pass
#      against a helper with its detection removed, the suite proves nothing —
#      and the mutation itself is checked for having landed, because a
#      sabotage that silently no-ops is the same joke one level up.
#
# Needs nothing but bash, grep, sed and coreutils. No network, no pnpm, no rg.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SELF="$HERE/$(basename "${BASH_SOURCE[0]}")"
LIB="${GATE_RUN_LIB:-$HERE/gate-run.sh}"

# ── mutation mode ──────────────────────────────────────────────────────────
if [ "${1:-}" = "--prove-red" ]; then
  stubs=(
    '_gate_forbidden_hit() { return 0; }'
    '_gate_expect_missing() { return 1; }'
  )
  why=(
    "printed-failure scan removed"
    "proof-of-run (--expect) check removed"
  )
  caught=0
  for i in 0 1; do
    fname="${stubs[$i]%%(*}"
    if ! grep -q "^${fname}() {" "$LIB"; then
      echo "FATAL: $LIB has no ${fname}() to sabotage — this mutation would be theatre." >&2
      exit 1
    fi
    mutant="$(mktemp)"
    cat "$LIB" > "$mutant"
    printf '\n%s\n' "${stubs[$i]}" >> "$mutant"
    if ! grep -q "^${fname}() { ret" "$mutant"; then
      echo "FATAL: the stub did not land in the mutant copy." >&2
      rm -f "$mutant"; exit 1
    fi

    echo "=============================================================="
    echo "MUTANT $((i + 1))/2 — ${why[$i]}"
    echo "  appended to a copy of gate-run.sh:  ${stubs[$i]}"
    echo "=============================================================="
    GATE_RUN_LIB="$mutant" bash "$SELF"
    rc=$?
    rm -f "$mutant"
    echo
    if [ "$rc" -ne 0 ]; then
      echo ">> mutant $((i + 1)) CAUGHT: the suite exited $rc against the sabotaged helper."
      caught=$((caught + 1))
    else
      echo ">> mutant $((i + 1)) SURVIVED: the suite passed against a helper that cannot detect."
      echo "   The suite is the thing that is broken. Fix it before trusting a green run."
    fi
    echo
  done
  if [ "$caught" -eq 2 ]; then
    echo "PROOF OK: 2/2 mutants caught — this suite can go red, so its green means something."
    exit 0
  fi
  echo "PROOF BROKEN: only ${caught}/2 mutants caught."
  exit 1
fi

# shellcheck source=/dev/null
source "$LIB"

# Expected reds are the point of this file, so no CI annotations from here:
# a passing run must not decorate itself with error markers.
GATE_ANNOTATE=0

TRACE="$(mktemp)"
trap 'rm -f "$TRACE"' EXIT
checks=0
broken=0
rc=0

good() { checks=$((checks + 1)); printf '  ok       %s\n' "$1"; }
bust() {
  checks=$((checks + 1)); broken=$((broken + 1))
  printf '  BROKEN   %s\n' "$1"
  printf '           %s\n' "$2"
  sed 's/^/           | /' "$TRACE"
}

# Runs the helper in THIS shell (no subshell) so GATE_STATUS and friends
# survive, with its output parked in $TRACE.
attempt() { gate_run "$@" >"$TRACE" 2>&1; rc=$?; }

want_red()   { if [ "$rc" -ne 0 ]; then good "$1"; else bust "$1" "the helper called this green; it must be red"; fi; }
want_green() { if [ "$rc" -eq 0 ]; then good "$1"; else bust "$1" "the helper called this red; it must be green"; fi; }

echo "gate-run.sh proof  (lib: $LIB)"
echo

# ── 1. the baseline: an honest pass and an honest fail ─────────────────────
attempt --label true -- true
want_green "a command that succeeds is green"

attempt --label false -- sh -c 'exit 1'
want_red "a command that exits 1 is red"

# ── 2. the exit code is the gate's own, not a pipe's ───────────────────────
# The failure: a gate's status handed to a formatter, so the formatter
# answers. The control below is the shape GitHub Actions runs (`bash -e {0}`
# — errexit, and NO pipefail), which is where this still bites today. pipefail
# narrows the hole but does not close it: `n=$(gate | sed …)` throws the
# status away in any shell, which is how guardrails.sh reads its audit.
naive="$(bash -e -c 'sh -c "echo boom; exit 7" | tail -1 >/dev/null; echo $?')"
attempt --quiet --no-scan --label 'exit 7' -- sh -c 'echo boom; exit 7'
if [ "$naive" = "0" ] && [ "$GATE_STATUS" = "7" ]; then
  good "status survives: the naive pipe reported 0, the helper reported 7"
else
  checks=$((checks + 1)); broken=$((broken + 1))
  printf '  BROKEN   status capture: naive=%s (want 0), helper=%s (want 7)\n' "$naive" "$GATE_STATUS"
fi

# ── 3. a gate that exits 0 and announces its own failure ───────────────────
attempt --label 'push loop' -- sh -c 'echo "PUSH INCOMPLETE — at least one remote does not match local."; exit 0'
want_red "exit 0 plus INCOMPLETE is red"

attempt --label 'annotated' -- sh -c 'echo "::error::CONVEX_DEPLOY_KEY is not set, so nothing was deployed."; exit 0'
want_red "exit 0 plus a ::error:: annotation is red"

attempt --label 'git chatter' -- sh -c 'echo "fatal: not a git repository"; exit 0'
want_red "exit 0 plus a tool error prefix is red"

attempt --label 'node crash' -- sh -c 'echo "Error: ENOENT no such file"; exit 0'
want_red "exit 0 plus a thrown Error is red"

# ── 4. green on an echo: the Convex deploy job ─────────────────────────────
# Three steps skipped for a missing secret, a job that printed one line and
# succeeded three times, and nothing deployed. --expect is the answer: a gate
# that cannot show its working does not get to pass.
attempt --label 'deploy' --expect 'every repo module is live' -- \
  sh -c 'echo "Skipping Convex checks — add the CONVEX_DEPLOY_KEY repo secret to enable."'
want_red "a job green on its own echo is red when asked for proof"

attempt --quiet --label 'silent' --expect '^TOTAL: [0-9]+' -- true
want_red "exit 0 with no output at all is red when asked for proof"

# ── 5. the wait loop that read absence as done ─────────────────────────────
attempt --label 'wait' --expect 'run [0-9]+ completed' -- sh -c 'echo "no pending runs"; exit 0'
want_red "absence of pending is not evidence of finished"

# ── 6. the tier that has been skipped since it was written ─────────────────
attempt --label 'sentinel tier 2' --forbid 'skipped' -- \
  sh -c 'echo "  tier 1     : served wasm == build s own record  ok"; echo "  tier 2     : skipped — no CI expectation in the environment"; exit 0'
want_red "a tier reporting skipped is red when the caller forbids it"

# ── 7. NO FALSE REDS. A scanner that cannot tell a verdict from prose is the
#      failure this repo has already paid for, so these must stay green. ────
attempt --label 'guardrails-shaped output' -- sh -c '
  echo "  ok raw-colors: 22 (baseline)"
  echo "  IMPROVED rust-panics: 46 < 47 — lower the baseline to lock it in"
  echo "0 errors, 62 warnings"
  echo "no errors found; error handling unchanged"
  echo "Guardrails OK (no count above baseline)."'
want_green "ordinary gate output with lowercase prose stays green"

attempt --label 'vitest' --allow '0 FAILED' -- sh -c 'echo "711 passed, 0 FAILED"; exit 0'
want_green "--allow exempts one known-benign line"

attempt --label 'lenient' --no-scan -- sh -c 'echo "FAILED"; exit 0'
want_green "--no-scan drops the built-in word list"

attempt --label 'lenient+forbid' --no-scan --forbid 'nothing to do' -- sh -c 'echo "nothing to do"; exit 0'
want_red "--no-scan keeps an explicit --forbid working"

# ── 8. the captured output is available for parsing ────────────────────────
attempt --quiet --label 'capture' --expect '^TOTAL: [0-9]+' -- sh -c 'echo; echo "TOTAL: 0"'
if [ "$rc" -eq 0 ] && [ "$(printf '%s\n' "$GATE_OUT" | sed -n 's/^TOTAL: //p')" = "0" ]; then
  good "GATE_OUT carries the output, so a caller parses a saved copy"
else
  checks=$((checks + 1)); broken=$((broken + 1))
  printf '  BROKEN   GATE_OUT did not carry the parsed value (rc=%s)\n' "$rc"
fi

if [ -s "$TRACE" ]; then
  good "--quiet keeps the gate out of the log but still captures it"
else
  checks=$((checks + 1)); broken=$((broken + 1))
  printf '  BROKEN   --quiet printed nothing at all, not even a verdict line\n'
fi

# ── 9. the red must survive a `tail` ───────────────────────────────────────
# 19 jobs, the red one first, and the PR reported green off the last 15 lines.
gate_reset
attempt --quiet --label 'job 1 of 19' -- sh -c 'exit 1'
for n in $(seq 2 19); do attempt --quiet --label "job $n of 19" -- true; done
summary="$(gate_summary)"; srv=$?
if [ "$srv" -ne 0 ] \
   && printf '%s\n' "$summary" | tail -5 | grep -q 'job 1 of 19' \
   && printf '%s\n' "$summary" | grep -q '19 run, 1 red'; then
  good "gate_summary re-lists the first red at the END and is the exit code"
else
  checks=$((checks + 1)); broken=$((broken + 1))
  printf '  BROKEN   gate_summary lost the red (exit %s):\n' "$srv"
  printf '%s\n' "$summary" | sed 's/^/           | /'
fi
gate_reset

# ── 10. a mistyped call is an error, never a quiet pass ────────────────────
attempt --nonsense -- true
if [ "$rc" -eq 2 ]; then good "an unknown option exits 2 rather than passing"
else bust "an unknown option exits 2 rather than passing" "got rc=$rc"; fi

echo
if [ "$broken" -eq 0 ]; then
  echo "gate-run proof: ${checks}/${checks} green."
  echo "Run './scripts/gate-run.test.sh --prove-red' to watch this suite fail on purpose."
  exit 0
fi
echo "gate-run proof: ${broken} of ${checks} checks BROKEN."
exit 1
