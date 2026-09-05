# Backlog numbering: the audit, and two migrations to choose between

Date: 2026-09-05. Produced by the night run. **Nothing is renumbered here** —
a half-applied renumber is worse than the collision it fixes. This is the
survey plus two ready-to-run plans; the choice is Chris's.

## The problem, stated precisely

This repo has **zero GitHub issues**. Every `#NN` written in the docs is
therefore rendered by GitHub as a link to a **pull request** — a different
object, with a different meaning, that already exists.

The plan for tonight said the namespace is overloaded two ways. It is
overloaded **five**:

| `#NN` means | Example | Where |
|---|---|---|
| a backlog item | `#71` — the emptiness scan | `PARKING_LOT.md` |
| **a GitHub PR** | `#61` — the z-order undo fix | commit subjects, and GitHub's own rendering of every line above |
| **a markdown anchor** | `#0-the-one-rule`, `#2-color--theme-tokens` | `PARKING_LOT.md:416` |
| **a photo fixture** | `#04 white-car-on-beige`, `#06 stone-and-tree` | `PARKING_LOT.md:1471` |
| **an index in another document** | "audit finding #2", "Change-summary #15", "tool #12" | `PARKING_LOT.md:1611`, `:2094`, `:946` |

A reader cannot tell which is meant without opening the line, and GitHub
resolves all of them to a PR regardless.

## Collision table — measured against the real PR list (64 PRs)

| `#NN` | Backlog item | Corroborated in repo? | PR with that number | Verdict |
|---|---|---|---|---|
| #10 | a11y pass (`aria-current` on the active layer) | yes — commit `840be3b` | **#10 CLOSED** dependabot (vite 6→8) | **collision** |
| #21 | op-log dropped-tail / ordering preference | yes — v8.50/v8.51 notes | **#21 CLOSED** dependabot (codeql) | **collision** |
| #29 | "DONE mark with no code behind it" | partial — cited, never defined | **#29 MERGED** dependabot (codeql) | **collision** |
| #56 | Netlify UI holds a stale build command | yes — `PARKING_LOT.md:7` | **#56 MERGED** feat(rulers) | **collision** |
| #62 | shape z-order | yes — ADR-044, shipped | **#62 MERGED** docs(architecture) | **collision** |
| #63 | per-layer annotation counts | yes — `PARKING_LOT.md:41` | **#63 OPEN** — *opened tonight, for #65* | **collision, created tonight** |
| #64 | *(no backlog item)* | — | **#64 OPEN** — *opened tonight, for #63* | — |
| #65 | wasm sentinel band | **only inside a list** until tonight's commit | none yet | undefined-but-used |
| #66 | **nothing — no definition in docs OR git** | **no** | none yet | **orphan number** |
| #68 | op-format bump for shape order | yes — ADR-044 closed it with no code | none yet | ok |
| #70 | remap cargo registry paths | yes — commit `6c4f42a` | none yet | ok |
| #71 | layer emptiness scan | yes — `PARKING_LOT.md:148` | none yet | ok |
| #72 | "paint lands on every layer" | yes — `PARKING_LOT.md:299`, **closed at engine level** | none yet | ok |
| #78 | panel-a11y coverage gap | yes — commit `9fea93e` | none yet | ok |
| #2, #04, #06, #12, #15 | **not backlog items at all** — anchors, photo fixtures, cross-doc indices | n/a | #2/#4/#6/#12/#15 all CLOSED dependabot | **false positives** |

**Six real collisions. One orphan (#66). Five false positives that look like
backlog items and are not.**

⚠️ **Two of the six collisions were created tonight, by this very run.** PR #63
carries the fix for backlog **#65**, and PR #64 carries backlog **#63**. Anyone
reading `fix(#65)` in the log and clicking `#63` lands on the wrong object. The
namespace collides faster than it can be documented, which is the argument for
migrating rather than for being careful.

## Migration A — a `BL-` prefix

Renumber every backlog item `BL-NN`, keeping the existing digits so history
stays greppable.

**Mechanics**

1. `PARKING_LOT.md` — rewrite each real backlog `#NN` to `BL-NN`. The five
   false positives above must be left alone; they are not backlog items. That
   is why this cannot be a blind `sed`.
2. `docs/Change-summary.md` — historical entries are dated records. **Do not
   rewrite them.** Add a one-line note at the top of the file saying `#NN`
   before 2026-09-05 means a backlog item, after it means a PR.
3. Add the convention to `CLAUDE.md` and `AGENTS.md`.
4. Commit subjects going forward: `fix(BL-65): …`.

| | |
|---|---|
| Cost | one docs commit, no tooling, reversible |
| Benefit | collisions gone immediately; GitHub stops auto-linking |
| Weakness | the backlog still lives in a 2,670-line markdown file with no state, no assignee, no search |
| Risk | a blind find-and-replace corrupts the five false positives |

## Migration B — import the backlog as real GitHub issues

The numbers collide because the repo has no issues. Give it issues.

**Mechanics**

1. Create labels: `engine`, `ui`, `a11y`, `docs`, `infra`, `blocked`,
   `needs-decision`.
2. For each open item, `gh issue create --title … --body … --label …`, body
   quoting the `PARKING_LOT.md` section verbatim so nothing is lost in
   summarising.
3. GitHub assigns **new** numbers — they will NOT match the old ones, and that
   is the point: the old digits stop meaning anything the moment they move.
   Record the mapping in `docs/backlog-issue-map.md`.
4. `PARKING_LOT.md` becomes a stub pointing at the issue tracker, and its
   closed items move to `docs/archive/`.

Ready-to-run seeds for the ten confirmed-open items:

| Title | Labels | Body source |
|---|---|---|
| The Netlify UI holds a stale copy of the build command | `infra`, `needs-decision` | `PARKING_LOT.md:7-40` |
| The layer emptiness scan must not live in `get_layers()` | `engine` | `:148-227` |
| No Content-Security-Policy on either site | `infra` | `:271-298` |
| Cut-to-layer produces a full-canvas layer (was "paint lands on every layer") | `ui`, `needs-decision` | `:299-353` |
| Layer rows want listbox semantics and cannot have them cheaply | `a11y` | `:354-377` |
| This repo cannot test a component, so no panel a11y is pinned | `a11y`, `blocked` | `:378-394` |
| Marketing architecture page promises a service worker that does not ship | `docs` | `:395-413` |
| 13 broken in-page anchors in `docs/archive/Refactor-Playbook.md` | `docs` | `:414-425` |
| A fresh text commit with the shadow on is still two undo steps | `ui` | `:426-451` |
| Color Overlay does not survive a reload | `engine`, `blocked` | `:452-477` |

| | |
|---|---|
| Cost | an afternoon; every future reference is a real link with real state |
| Benefit | numbering problem cannot recur — GitHub owns the namespace |
| Weakness | 2,670 lines of hard-won context must survive the move; a lossy import is worse than the status quo |
| Risk | half-migrated is the worst outcome — do it in one sitting or not at all |

## Recommendation (not applied)

**Migration A now, Migration B when there is an afternoon for it.** A is one
commit and stops the bleeding; B is the real fix and deserves to be done
properly rather than at 4am. Doing A first does not make B harder — B replaces
the numbers wholesale either way.

**Whichever is chosen, `#66` should be resolved first**: it is cited in four
places as a member of the engine sitting and defined nowhere. Either it names
real work that was never written down, or it is a typo that has been copied
forward four times. Nobody can migrate a number whose meaning is unknown.
