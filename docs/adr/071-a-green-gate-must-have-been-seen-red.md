# ADR-071: A gate counts as green only if it captured its own exit code and has been seen red
Date: 2026-09-19   Status: accepted (09-24-2026)

## Context
The catalog this repo kept of the problem counted **sixteen** checks that were
green because they were incapable of being red — and that file,
`docs/vacuous-checks.md`, was itself swept out of the repo in #169 and now
exists only in git history. Six of the sixteen are not separate accidents but
one mechanical failure repeated: **the status of the thing being checked was
discarded before anyone read it.** Each was found by hand, months apart, and no
rule was ever written that the next gate has to satisfy.

## The six (nine, as of 09-24-2026)

| # | Gate | Why it could not fail | Verdict | Where it stands |
|---|---|---|---|---|
| 1 | Convex deploy job, `ci.yml` (#165, 09-17-2026) | all three real steps carried `if: env.CONVEX_DEPLOY_KEY != ''`, and the secret was unset | **3 runs green, 0 modules deployed** | closed by #171 — a step that fails when the key is missing |
| 2 | `gh pr checks <N> \| tail -15` | the failing job was line **1 of 19** | **a red PR reported green** | rule in CLAUDE.md: count the column, never tail |
| 3 | `rg … \| wc -l` in `guardrails.sh` | `rg` exits ≥2 on **error**; the pipe hands back `wc`'s 0 | **an erroring query reads as zero violations** | `rg_count()` is defined at line 61 and called **0 times**; all **9** counts still pipe |
| 4 | waiting on CI by "nothing is pending" | a PR can get **zero** Actions runs and still show 8 green-ish checks | **zero runs read as finished** | rule: assert the check count (~17 Actions), not the absence of pending |
| 5 | release push loop, v8.74 (09-10-2026) | it matched a remote named `codeberg`; this repo's is spelled **`codeburg`** | **pushed nowhere, reported success — Codeberg sat 12 commits behind** | `scripts/push-all-remotes.sh` (#120) enumerates remotes and reads the sha back |
| 6 | `deploy-sentinel.sh` tier 2 | skips whenever there is no CI commit to expect — every hand run, every scheduled run | **`SENTINEL PASS` printed 09-19-2026 with tier 2 skipped** | unchanged; tier 1 and the size floor carry it alone |
| 7 | v8.95's deploy-wait loop (09-24-2026) | it polled the live site for a string that had **already shipped in v8.94** | **the loop exited at once and reported a still-QUEUED deploy as live** | rule: poll only for something the NEW build alone contains (memory `feedback_deploy_check_must_test_new_string`) |
| 8 | v8.98's deploy-wait loop (09-24-2026) — the mirror image | `curl -s …/trail-log/` got a **14-byte redirect** (trailing slash), so the grep could never match | **never green, spun until killed** — same root: the check never looked at the page it named | `curl -sL`, and print the byte count before trusting a grep on it |
| 9 | a mutation check on QC F1's e2e spec (09-24-2026) | the mutant's find-string used the OLD indentation, the `assert` failed, and the spec ran on UNMODIFIED code | **"1 passed" read as "survived"** — a mutation that was never applied | assert the mutant applied and print it before running; a compile error or a no-op is not a kill (memory `feedback_mutation_harness_scope`) |

None of those is a bug in the *subject* of the check; every one is a bug in the
*reporting*. That is what makes the class invisible by construction: a gate
speaks in one bit, and a gate that has lost its evidence emits the same bit as a
gate that looked and found nothing wrong. Green is a claim about the check, not
about the code — and the check is the one thing nobody re-reads while it is
passing. Row 6 is that shape at its purest: downstream, a skip and a pass are
the same green, so a condition written against tier 2's record has nothing to
read for as long as it keeps skipping.

Found while verifying row 5: `push-all-remotes.sh` compares the **branch** sha
read back from each remote against local, but the **tag** check only asserts the
tag exists — a remote tag pointing at the wrong commit still prints `ok`.

## Decision
A check does not count as a gate here until all four hold:

1. **Capture the status before printing it.** `out="$(cmd)"; status=$?` — never
   read a status through a pipe, a `tail`, or a `$( )` whose last command is a
   formatter.
2. **A printed failure must be a non-zero exit.** If the words FAIL, missing or
   INCOMPLETE reach the output, the process ends non-zero.
3. **Say which path ran.** A gate that skipped itself must print that and must
   not be counted as a pass; where a skip has no legitimate cause (row 1), it is
   a failure.
4. **Prove it red once.** Break the subject on purpose, watch the gate fail, and
   land that evidence with the gate.

Rules 1–3 belong in one sourced shell helper rather than in each script's own
hand-rolled version; that helper, with a test that proves it goes red, is the
companion PR on `chore/gate-run-helper`.

## Consequences
+ A false green costs hours and has twice shipped (rows 1 and 5); the four rules
  are checkable by reading a diff, which no amount of catalog was.
+ The prove-red step is minutes and runs exactly once per gate.
- **Every existing gate is now out of compliance until retrofitted.**
  `guardrails.sh` alone is 9 raw counts against a safe helper nobody calls.
- Rule 4 cannot be enforced by CI — it is a habit, and habit is precisely what
  failed six times.
- A sourced helper is a new dependency for every gate script: a script that
  fails to source it must itself fail, which is one more failure mode to get
  right.

## Alternatives rejected
1. **Keep cataloging.** `docs/vacuous-checks.md` named all sixteen, with rules,
   and was deleted as a finished working document — a record that is not a rule
   changed nothing.
2. **Just set `-euo pipefail` everywhere.** `guardrails.sh`, `deploy-sentinel.sh`
   and `push-all-remotes.sh` already run `set -uo pipefail` and it caught none
   of these: `$(rg … | wc -l)` is a *successful* pipeline reporting a wrong
   number, and rows 1, 4 and 6 had no failing command to trap.

## Pre-mortem
It is six months later and this was a mistake, because rule 4 aged out
silently: the prove-red evidence is taken once, at birth, then the gate is
edited — a glob narrows, a baseline moves, a step gains an `if:` — and nothing
re-runs the proof, so every gate wears a badge earned by a version of itself
that no longer exists. Meanwhile rules 1–3 make a five-line check feel expensive
enough that the next one is not written, trading six loud false greens for quiet
blind spots.
Early warning sign: a script that sources the helper and still feeds a decision
from a bare `| wc -l`, `| tail` or `| head` — the state `guardrails.sh` is in
today, one file after the safe helper was written into it.
