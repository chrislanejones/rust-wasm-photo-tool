# Vacuous checks: gates that pass because they cannot fail

A **vacuous check** is a gate that is green because it is incapable of being
red. It is worse than no gate: it costs the same to run, it occupies the slot
where a real check would go, and it actively reports safety.

This repo has now produced **fourteen**, in three families. They are collected here
because they keep being found one at a time and re-derived from scratch.

> **Where this lives.** `CLAUDE.md` is gitignored — an edit there is local to one
> machine and survives nothing. This file is tracked; that is the durable copy.
> A short pointer in CLAUDE.md is fine, but the rules live here.

---

## Family 1 — the check matches its own subject

The check's text appears in the thing being checked, so it matches itself.

| # | Check | How it was vacuous |
|---|---|---|
| 1 | `deploy-sentinel.sh` export list | `oplog_` and `remove_object` matched **doc comments naming them**; `rect_select` is not feature-gated at all. A real featureless build **passed** (2026-09-05, ADR-045) |
| 2 | `guardrails.sh` `as-any` | `\bas any\b` matched **English prose** in a comment |
| 3 | `guardrails.sh` `aria-button` | a comment *explaining the rule* spelled `role="button"` and turned the job red on prose |
| 4 | `pgrep -f "http.server 4199"` | matched **the shell command doing the killing**, so cleanup killed its own shell (2026-09-05) |
| 5 | the git commit gate | reads the **command text** for a branch path, so `cd X && git commit` is judged on the wrong branch |

**Rule.** A textual check must match a form that only real code can take.
`NAME(args) {` cannot be written by a comment; the bare name can. Where the
subject is a command line, the checker is part of the haystack — exclude it
explicitly or match on something it does not contain.

---

## Family 2 — the fixture cannot distinguish pass from fail

The assertion is true of the fixture no matter what the code does.

| # | Check | How it was vacuous |
|---|---|---|
| 6 | layer-opacity test asserting `"1"` | the Background layer's opacity **is always 1.0**, so the assertion held whatever the code did |
| 7 | TS-vs-TS "port parity" tests | both sides imported the **same source**, so it compared a function to itself |
| 8 | DOM row assertions by position | positional selectors are **invariant under reorder**, so a reordering bug reads as a pass |

**Rule.** Before trusting a green assertion, ask what value would make it red,
and confirm that value is reachable. If a fixture is built so the expected value
is the only possible value, the test measures the fixture. **Anchor on ids and
on values that differ between the right and wrong answers** — never on a
position, and never on a constant the system cannot vary.

---

## Family 3 — the observation was never taken

The check ran against something other than what it claimed to check.

| # | Situation | How it was vacuous |
|---|---|---|
| 9 | a build that exited **127** | left the previous `pkg/` in place; the stale artifact was read as a passing build (2026-09-05) |
| 10 | a **mutation that did not apply** | rustfmt had reflowed the target line, the patch silently missed, and the suite went green **on unmutated code** (2026-09-05) |
| 11 | vitest in a fresh worktree | no `pkg/` ⇒ 3 suites failed to collect, one reporting **"expected 106 to be 128"** — which reads exactly like a real ratchet conflict (2026-09-06) |
| 12 | a stale-dep check that **navigates between observations** | navigation remounts the component and re-runs the effect on mount, so a wrong dependency array is invisible (2026-09-06, #70) |
| 13 | a green check that had **SKIPPED itself** | the sentinel's tier 2 skips when CI's commit differs from the live one. On a fix PR it did exactly that, the job went green, and the green said nothing about whether the fix worked (2026-09-07) |
| 14 | a merge rehearsal run with the **wrong merge verb** | the dry run used `git merge`; the real script used `gh pr merge --squash`. Equivalent for independent PRs, **not** for a stacked one — see below (2026-09-07) |

**Rule.** Verify the observation happened before believing what it says, and
that it was an observation of **the thing you meant**.

- Assert the **artifact changed** — mtime or hash — after any build used as evidence.
- Assert the **mutation applied** before reading the suite result. A mutation
  test has three outcomes, not two: killed, survived, **and did not apply**.
- Build the wasm before trusting any test run in a fresh worktree; `pkg/` is
  gitignored, and CI does this for you (`build:all`).
- To test staleness, **stay on the surface**. Anything that remounts hides it.
- Assert **which path executed**, not just the exit code. A check that skipped
  itself and a check that ran and passed produce the same green.
- Rehearse with the **verb the real thing uses**. `git merge` and
  `gh pr merge --squash` are not interchangeable (below).

---

## The one-line version

**Green means "the check ran and could have failed." Prove both halves.**

A useful habit when writing any gate: **break the code on purpose once and
watch the gate go red.** Every check above would have been caught in the minute
it took to do that, and each instead cost hours or shipped.

## Related, in `docs/adr/`

- **ADR-045** — the sentinel's export check, measured vacuous against a real
  featureless build; the size floor was doing all the work alone.
- **ADR-046** — why the exact-hash expectation cannot be a stored constant, and
  why a 200 is not proof a file exists (an SPA fallback answers with HTML).
- **ADR-047** — the emptiness predicate, and why a per-frame field and a
  deliberate query are different designs.

---

## Two merge-run gaps, 2026-09-07

Both cost real time landing ten PRs, and neither was in this file.

### `git merge` ≠ `gh pr merge --squash` for a STACKED PR

The stack was rehearsed twice, both times with `git merge` of each branch tip
into a throwaway branch. Both rehearsals said one conflict. The real run used
`gh pr merge --squash`, and **#69 conflicted where the rehearsal said it would
not**.

The reason is squashing, not the code. #69 was branched from #67 and had merged
#63, so its branch carried their original commits. Squash-merging #67 and #63
put the *same changes* on master under *different SHAs*, so git saw two
unrelated sets of edits to the same lines.

For independent PRs the two verbs are equivalent, which is why this hid. For a
stacked one they are not.

**Rule: rehearse a stacked set with `--squash`, or state in the findings that
you did not.** A rehearsal that used a different verb has not tested the thing
that will actually run.

The fix at the time was ordinary: merge master into the branch, resolve, push.
Worth knowing it is expected rather than alarming.

### Do not fire `gh pr merge` back to back

**#66 briefly closed without merging.** Merges were issued in a tight loop;
GitHub had not finished recomputing mergeability after the previous one, the
merge was refused, and the PR ended up closed. Nothing was lost — the branch was
intact and reopening worked — but the recovery cost time and, for a minute,
looked like deleted work.

**Rule: wait for each merge to settle before issuing the next.** Poll
`gh pr view <n> --json mergeable` until it is `MERGEABLE` rather than assuming
the previous merge has landed.