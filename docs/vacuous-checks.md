# Vacuous checks: gates that pass because they cannot fail

A **vacuous check** is a gate that is green because it is incapable of being
red. It is worse than no gate: it costs the same to run, it occupies the slot
where a real check would go, and it actively reports safety.

This repo has now produced **eight**, in three families. They are collected here
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

**Rule.** Verify the observation happened before believing what it says.

- Assert the **artifact changed** — mtime or hash — after any build used as evidence.
- Assert the **mutation applied** before reading the suite result. A mutation
  test has three outcomes, not two: killed, survived, **and did not apply**.
- Build the wasm before trusting any test run in a fresh worktree; `pkg/` is
  gitignored, and CI does this for you (`build:all`).
- To test staleness, **stay on the surface**. Anything that remounts hides it.

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
