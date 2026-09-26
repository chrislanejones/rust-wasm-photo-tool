#!/usr/bin/env bash
# Run a gate, and believe only what the run can prove.  SOURCE THIS FILE.
#
#   source "$(dirname "${BASH_SOURCE[0]}")/gate-run.sh"
#
# ── WHY ────────────────────────────────────────────────────────────────────
# Six checks in this repo have reported success while proving nothing. They are
# the same bug six times, so they get one answer:
#
#   1. A Convex deploy job went green on its own echo. The secret was unset,
#      every real step was skipped, the job succeeded three times running and
#      deployed nothing.
#   2. `gh pr checks` piped into `tail` on a 19-job PR. The red job was line 1.
#      The PR was reported green.
#   3. A gate's exit status handed to a pipe, so the verdict came from the
#      formatter on the right-hand side instead of the gate on the left.
#   4. A wait loop that read "nothing pending" as "the run finished".
#   5. push-all-remotes.sh printing its own INCOMPLETE line while the loop
#      above it had already thrown every push status away.
#   6. deploy-sentinel.sh's tier 2 answering "skipped" for so long that a
#      retirement condition written against it was never once testable.
#
# ── WHAT THIS DOES ─────────────────────────────────────────────────────────
#   1. CAPTURES THE STATUS FIRST. The status is read on the line immediately
#      after the command, out of PIPESTATUS[0], before anything else can
#      overwrite $?. Indenting, prefixing, parsing and printing all happen
#      afterwards, against a saved copy of the output. A formatter can never
#      become the verdict.
#   2. READS WHAT THE GATE PRINTED. A command can exit 0 and announce its own
#      failure in the same breath. A verdict word in the output is red no
#      matter what the status said.
#   3. WILL ASK A GATE FOR PROOF. `--expect` makes a pattern mandatory, so
#      "printed nothing at all", "skipped", and "green on an echo" are red
#      rather than quietly fine.
#
# ── WHAT IT DOES NOT DO ────────────────────────────────────────────────────
# It does not soften anything. A gate wrapped in this can go red where it used
# to pass; that is the whole point, and the fix is the gate, never the wrapper.
#
# ── ESCAPE HATCH ───────────────────────────────────────────────────────────
# A text scan cannot tell a verdict from prose — the lesson guardrails.sh
# learned the day a source comment turned it red. So `--allow <ere>` drops
# matching lines before the scan (same spirit as that script's `allow:`
# annotations), and `--no-scan` drops the built-in word list entirely while
# keeping any explicit `--forbid`. Reach for --allow first: it exempts one
# known line and leaves the rest of the gate watched.
#
# ── USAGE ──────────────────────────────────────────────────────────────────
#   gate_run [--label NAME] [--expect ERE] [--forbid ERE] [--allow ERE]
#            [--indent N] [--quiet] [--no-scan] -- command [args...]
#
#   gate_run --label typecheck -- pnpm -C app exec tsc --noEmit
#   gate_run --label sentinel --expect 'tier 1' --forbid 'skipped' -- ./scripts/deploy-sentinel.sh
#   gate_run --quiet --expect '^TOTAL: [0-9]+' -- node scripts/dead-exports-audit.mjs
#   gate_summary   # re-lists every red AT THE END, and is the exit code
#
# After each call:  $GATE_OUT (captured output), $GATE_STATUS (the real exit
# code, never a pipe's), $GATE_REASON (why it was called red).
#
# ── PROOF ──────────────────────────────────────────────────────────────────
# scripts/gate-run.test.sh, including `--prove-red`, which sabotages a COPY of
# this file and shows the suite catching it. A gate-checker that was never
# watched to fail would be this file's own punchline.

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  echo "gate-run.sh is a library, not a command — source it:" >&2
  echo "  source \"\$(dirname \"\${BASH_SOURCE[0]}\")/gate-run.sh\"" >&2
  exit 2
fi

# ── the built-in verdict vocabulary ────────────────────────────────────────
# Deliberately narrow, and uppercase where the word also exists in English.
# "fail" is prose; "FAIL" is a verdict. Everything here is either an ALL-CAPS
# verdict token, a GitHub annotation, or a standard tool error prefix
# (`error:`, `fatal:`, a Node/Python trace, a segfault, a missing command).
# Lowercase bare words are NOT matched: a gate that prints "0 errors" is
# passing, and a scanner that cannot tell those apart is the false-red problem
# this repo has already paid for once.
GATE_VERDICT_WORDS='FAIL|FAILED|FAILURE|FATAL|INCOMPLETE|ABORTED|PANIC'
GATE_DEFAULT_FORBID="(^|[^[:alnum:]_])(${GATE_VERDICT_WORDS})([^[:alnum:]_]|\$)"
GATE_DEFAULT_FORBID="${GATE_DEFAULT_FORBID}|::error::|(^|[[:space:]])(error|ERROR|Error|fatal):"
GATE_DEFAULT_FORBID="${GATE_DEFAULT_FORBID}|panicked at|Traceback \(most recent call last\)"
GATE_DEFAULT_FORBID="${GATE_DEFAULT_FORBID}|Segmentation fault|command not found"

GATE_OUT=""
GATE_STATUS=0
GATE_REASON=""
GATE_PASS_COUNT=0
GATE_FAIL_COUNT=0
GATE_FAILED_LABELS=()
# Annotations are for CI, where they pin a red to the job summary. Off locally
# so a hand run does not print machine noise, and settable to 0 by a test that
# EXPECTS reds (see gate-run.test.sh) so it cannot annotate its way to a
# confusing green job.
GATE_ANNOTATE="${GATE_ANNOTATE:-${GITHUB_ACTIONS:+1}}"
GATE_ANNOTATE="${GATE_ANNOTATE:-0}"

# Does the output carry a forbidden pattern? Prints the offending lines.
# NAMED, and kept to one job, so gate-run.test.sh --prove-red can replace it
# with a stub and watch the suite go red.
_gate_forbidden_hit() { # <logfile> <ere>
  grep -En -- "$2" "$1" 2>/dev/null | head -3
}

# Is the required proof ABSENT? Returns 0 when it is missing, i.e. when the
# gate failed to show its working. Also replaceable by --prove-red.
_gate_expect_missing() { # <logfile> <ere>
  ! grep -Eq -- "$2" "$1" 2>/dev/null
}

gate_reset() {
  GATE_PASS_COUNT=0
  GATE_FAIL_COUNT=0
  GATE_FAILED_LABELS=()
}

gate_run() {
  local label="" expect="" forbid="" allow="" indent=0 quiet=0 scan=1

  while [ $# -gt 0 ]; do
    case "$1" in
      --label)   label="${2:-}";  shift 2 ;;
      --expect)  expect="${2:-}"; shift 2 ;;
      --forbid)  forbid="${2:-}"; shift 2 ;;
      --allow)   allow="${2:-}";  shift 2 ;;
      --indent)  indent="${2:-0}"; shift 2 ;;
      --quiet)   quiet=1; shift ;;
      --no-scan) scan=0;  shift ;;
      --)        shift; break ;;
      *) echo "gate_run: unknown option '$1' (did you forget the -- before the command?)" >&2
         return 2 ;;
    esac
  done

  if [ $# -eq 0 ]; then
    echo "gate_run: no command given" >&2
    return 2
  fi
  [ -n "$label" ] || label="$*"

  local log
  log="$(mktemp)" || { echo "gate_run: mktemp refused" >&2; return 2; }

  # errexit would abort the caller the instant the gate failed, which is the
  # one moment this helper exists for. Turned off around the run and restored
  # exactly as it was found.
  local had_errexit=0
  case $- in *e*) had_errexit=1; set +e ;; esac

  local pad=""
  if [ "$indent" -gt 0 ] 2>/dev/null; then
    pad="$(printf "%${indent}s" "")"
  fi

  # ── THE WHOLE POINT IS THE NEXT FOUR LINES ──────────────────────────────
  # The command's status is read on the line that follows it, from
  # PIPESTATUS[0] — the LEFT-HAND end of the pipeline, the gate itself. `tee`
  # and the indenting sed are downstream formatting and their statuses are
  # discarded on purpose. Do not insert anything between the run and the
  # capture; every line added there is a chance to overwrite $?.
  if [ "$quiet" -eq 1 ]; then
    "$@" >"$log" 2>&1
    GATE_STATUS=$?
  else
    "$@" 2>&1 | tee "$log" | sed "s/^/${pad}/"
    GATE_STATUS=${PIPESTATUS[0]}
  fi
  # ────────────────────────────────────────────────────────────────────────

  GATE_OUT="$(cat "$log")"
  GATE_REASON=""

  # --allow drops exempted lines before the scan, never before the status
  # check: no annotation can talk a non-zero exit into a pass.
  local scanfile="$log"
  if [ -n "$allow" ]; then
    scanfile="${log}.scan"
    grep -Ev -- "$allow" "$log" > "$scanfile" 2>/dev/null || true
  fi

  local pattern=""
  if [ "$scan" -eq 1 ]; then pattern="$GATE_DEFAULT_FORBID"; fi
  if [ -n "$forbid" ]; then
    if [ -n "$pattern" ]; then pattern="${pattern}|${forbid}"; else pattern="$forbid"; fi
  fi

  local hit=""
  if [ "$GATE_STATUS" -ne 0 ]; then
    GATE_REASON="exit ${GATE_STATUS}"
  else
    if [ -n "$pattern" ]; then
      hit="$(_gate_forbidden_hit "$scanfile" "$pattern")"
      if [ -n "$hit" ]; then
        GATE_REASON="exit 0, but the gate printed its own failure"
      fi
    fi
    if [ -z "$GATE_REASON" ] && [ -n "$expect" ]; then
      if _gate_expect_missing "$log" "$expect"; then
        GATE_REASON="exit 0 with no proof it ran — expected output matching /${expect}/"
      fi
    fi
  fi

  rm -f "$log" "${log}.scan"
  if [ "$had_errexit" -eq 1 ]; then set -e; fi

  if [ -z "$GATE_REASON" ]; then
    GATE_PASS_COUNT=$((GATE_PASS_COUNT + 1))
    printf 'gate ok   %s\n' "$label"
    return 0
  fi

  GATE_FAIL_COUNT=$((GATE_FAIL_COUNT + 1))
  GATE_FAILED_LABELS+=("${label} — ${GATE_REASON}")
  printf 'gate RED  %s — %s\n' "$label" "$GATE_REASON"
  if [ -n "$hit" ]; then
    printf '%s\n' "$hit" | sed 's/^/          printed: /'
  fi
  if [ "$GATE_ANNOTATE" = "1" ]; then
    printf '::error::gate %s: %s\n' "$label" "$GATE_REASON"
  fi
  return 1
}

# Every red, listed again AT THE END, with a count.
#
# This is the answer to the 19-job PR whose only red was line 1: a verdict you
# have to scroll back for is a verdict that gets lost, and `| tail` is what
# people actually type. Print the tally last, make the count the headline, and
# make this function's own exit status the build's.
gate_summary() {
  local total=$((GATE_PASS_COUNT + GATE_FAIL_COUNT))
  printf '\n-- gates: %d run, %d red --\n' "$total" "$GATE_FAIL_COUNT"
  if [ "$GATE_FAIL_COUNT" -eq 0 ]; then
    printf 'all %d green\n' "$total"
    return 0
  fi
  local entry
  for entry in "${GATE_FAILED_LABELS[@]}"; do
    printf '  RED %s\n' "$entry"
  done
  printf '%d of %d gates RED.\n' "$GATE_FAIL_COUNT" "$total"
  return 1
}
