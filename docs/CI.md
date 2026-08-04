# CI

> Part of the [Image Horse](../README.md) docs. See also: [Architecture](Architecture.md) · [File Map](File-Map.md) · [Getting Started](Getting-Started.md) · [Change Summary](Change-summary.md).

[![CI](https://github.com/chrislanejones/rust-wasm-photo-tool/actions/workflows/ci.yml/badge.svg)](https://github.com/chrislanejones/rust-wasm-photo-tool/actions/workflows/ci.yml)

Everything runs from one workflow, [`.github/workflows/ci.yml`](../.github/workflows/ci.yml), plus a Dependabot config at [`.github/dependabot.yml`](../.github/dependabot.yml). It runs on every push to `master`, every pull request, and on a weekly Monday cron so newly-disclosed CVEs are caught even when nothing has changed. Free and unlimited on a public repo.

Deploys are **not** driven by Actions — the hosts build on push themselves. CI mirrors those builds so a break fails here first.

## Jobs

### Build & quality

| Job | What it does | Mirrors |
| --- | --- | --- |
| `rust` | `cargo fmt --check`, `cargo clippy -D warnings`, `cargo test`, then `wasm-pack build` | Netlify's Rust build |
| `web` | Typecheck (`tsc -b`) + `pnpm build:all` (WASM + editor app) | Netlify's app build |
| `marketing` | Builds the marketing site from `marketing/` | Vercel's `/marketing` root |
| `convex` | `convex codegen` + a `_generated` drift check | — |
| `deploy-sentinel` | Fetches the **live** site's glue and `.wasm` and fails on a size outside 700–800 KB or a missing `oplog_` / `remove_object` / `rect_select` export | The manual check that caught the five-week featureless-prod bug |

Build/quality jobs are skipped on the weekly cron (`if: github.event_name != 'schedule'`) — no point rebuilding when nothing changed.

`deploy-sentinel` exists because a green build is not a good deploy: v7.36–v7.45 shipped a **featureless** WASM to production for five weeks. Feature-detects hid it, and an HTTP 200 proved nothing because the SPA fallback returns 200 for everything. It also runs by hand as [`scripts/deploy-sentinel.sh`](../scripts/deploy-sentinel.sh).

### Security

| Job | What it does |
| --- | --- |
| `cargo-audit` | Checks `Cargo.lock` against the RustSec advisory DB |
| `pnpm-audit` | `pnpm audit` on npm deps — non-blocking; transitive advisories are often unfixable noise |
| `secrets` | `gitleaks` scans full git history for committed secrets |
| `codeql` | GitHub CodeQL static analysis of the TypeScript/React code |
| `uploadthing-leak-guard` | Fails if client source bundles the server-only UploadThing secret |

### Dependabot

Weekly PRs for outdated/vulnerable **cargo**, **npm** and **github-actions** dependencies. Security fixes are filed immediately regardless of schedule.

### Where findings show up

Nothing here opens GitHub **Issues**. Results surface as a red ✗ check on the commit/PR (plus email), alerts in the repo's **Security** tab (CodeQL + Dependabot), and Dependabot **pull requests**.

## Guardrails

The `guardrails` job runs static checks over the source with ripgrep, from
[`scripts/guardrails.sh`](../scripts/guardrails.sh). **It blocks the build.**

It is not a pass/fail gate on zero, though — it is a **baseline ratchet**. Each
check carries a recorded count and the build fails when that count goes **up**.
New violations are blocked from today; the existing ones are counted and can
only be paid down. Only one of the six checks is actually at zero.

That design exists because the two obvious options were both wrong. Leaving the
job `continue-on-error` — which is how it started — meant it reported violations
and failed nothing, which is advisory theater. Flipping it straight to blocking
was impossible with 112 pre-existing violations, and widening the exclude globs
to go green is the ratchet anti-pattern the playbook forbids.

| Check | Pattern (scope) | Escape hatch | Baseline |
| --- | --- | --- | --- |
| Raw colors | `(bg\|text\|border\|ring)-(zinc\|neutral\|gray\|slate\|stone)-NNN`, `text-white`, `bg-white` in `app/src` | `// allow: raw-color` | 26 |
| Off-scale type / faux weights | `text-[NNpx]`, `font-medium`, `font-black` | — | 9 |
| Raw z-index | `z-10..z-100`, `z-[N…]` | — | 4 |
| `as any` | `\bas any\b` (excl. `*.d.ts`) | import real types | **0 — a true hard gate** |
| Rust panics / unsafe | `.unwrap()`, `.expect(`, `panic!`, `unsafe ` in `src/*.rs` | `// allow: rust-panic` | 67 |
| a11y | `role="button"` without `aria-label` | add `aria-label` | 5 |

**A baseline raised in a diff is the one thing to challenge in review.** Raising
it to go green is precisely the move the script exists to prevent, and it says so
when it fails.

### Escape hatches

Two checks support a per-site annotation: `// allow: raw-color` and
`// allow: rust-panic`. **The comment must be on the SAME LINE as the
violation** — the filter is `rg -v`, which drops the matching line, so an
annotation on the line above filters nothing and the count does not move.

The Rust hatch earns its keep on the inline `#[cfg(test)]` modules in `src/`: a
test asserting with `.expect(...)` is *correct*, because panicking is how a test
fails, but ripgrep cannot tell engine code from test code. Annotate those. Never
annotate a real panic on a pixel path — the check flags `unsafe` in `src/simd/`
on purpose, and those are legitimate but reviewed, not waved through.

### Making a check blocking on zero

Once a check's baseline reaches 0 it is already a hard gate — any reintroduction
fails, which is what `as any` does today. Nothing else needs configuring.

### Running it locally

```bash
./scripts/guardrails.sh
```

It refuses to run without a real `ripgrep` binary rather than reporting a pass it
cannot substantiate. Note that a shell alias or function named `rg` will not
satisfy it — `command -v rg` has to find an executable.

## Local git hooks

Installed as **native git hooks** in [`.githooks/`](../.githooks), enabled through `core.hooksPath`. No dependency, no package manager.

- **`pre-commit`** — `cargo fmt --check` on staged Rust.
- **`pre-push`** — mirrors the blocking CI jobs: `cargo fmt --check`, `cargo clippy -D warnings`, `tsc -b`, and the UploadThing secret-leak guard. Uses only local tools, no ripgrep.

`core.hooksPath` is per-clone local config and is not committed, so enable it once on a fresh clone:

```bash
git config core.hooksPath .githooks
```

Bypass a single run with `git commit --no-verify` / `git push --no-verify`. Pair every bypass with a TODO in the same branch. In CI there is no clean bypass by design — if a check is wrong, fix the check.

> **Lefthook was evaluated and rejected.** It wants `pnpm add -D -w lefthook`, and this machine's pnpm store version conflicts with `node_modules` badly enough that installing it relinks the whole tree. Native hooks avoid the package manager entirely and do the same job. Don't reintroduce it.

## Branch protection

Once the build jobs are green twice, in **Settings → Branches → `master`**:

- Require status checks before merging — required: `rust`, `web`, `marketing`, `convex`.
- Don't require `guardrails`, `cargo-audit`, `pnpm-audit`, `secrets` or `codeql` until their baselines are clean.
- Require branches to be up to date before merging.

## Setup notes

- **`CONVEX_DEPLOY_KEY` secret** — the `convex` job's codegen/drift step only runs when this repo secret is set (Settings → Secrets and variables → Actions). Use a Convex **preview/CI** deploy key, never prod. Without it the job prints "skipped" and stays green.
- **Native secret scanning + push protection** — enable under **Settings → Code security**; free for public repos, and it blocks secrets *before* they are pushed, complementing the `gitleaks` history scan.

## Troubleshooting

**"ripgrep: command not found".** The `guardrails` job installs it — `rg` is not preinstalled on `ubuntu-latest`.

**`pnpm install --frozen-lockfile` fails on a PR.** The branch added a dependency without committing the updated lockfile. Locally: `pnpm install`, then commit `pnpm-lock.yaml`.

**A guardrail fails on a legitimate exception.** Add an `# allow: <tag>` comment at the use site. Don't expand the exclude globs.

**The `convex` job is skipped.** It needs `CONVEX_DEPLOY_KEY` — see Setup notes.

**`deploy-sentinel` fails after a green build.** The build was fine and the *deploy* is wrong — usually a Cargo feature set in `netlify.toml` that doesn't match `build:wasm`. Check the served wasm's size and exports, not the local one.

## Deploy hosts

- **Netlify** — git root → installs Rust + `wasm-pack` → builds the editor app → `www-dist`
- **Vercel** — `marketing/` root → `marketing/vercel.json` → builds the marketing site → `dist`
