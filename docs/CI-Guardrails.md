# CI Guardrails

> Companion to [`Refactor-Playbook.md`](Refactor-Playbook.md) and [`GitHub-Actions.md`](GitHub-Actions.md). Section numbers reference the playbook.
> Goal: every static guardrail from the playbook runs automatically on every push/PR.

The guardrails are only as valuable as how often they run. Locally-only means they catch nothing once you forget. They're now wired into CI so they run on every push and PR with no extra effort.

> **Current state (2026-06-28):** the guardrails live in the real workflow [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) as the **`guardrails` job**, and they run **advisory** (report violations, don't fail the build) because the codebase isn't clean against them yet. The separate `scripts/check.sh` + `lefthook.yml` setup described below is an **optional local mirror that is not yet installed** — the `ci.yml` `guardrails` job is the source of truth.

## Contents
1. [What runs in CI](#1-what-runs-in-ci)
2. [The guardrail checks](#2-the-guardrail-checks)
3. [Flipping a check from advisory to blocking](#3-flipping-a-check-from-advisory-to-blocking)
4. [Optional: local pre-commit via lefthook](#4-optional-local-pre-commit-via-lefthook)
5. [Optional: branch protection](#5-optional-branch-protection)
6. [Troubleshooting](#6-troubleshooting)
7. [Bypass](#7-bypass)

---

## 1. What runs in CI

Everything is in a single workflow, [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (full job table in [GitHub-Actions.md](GitHub-Actions.md)). Beyond the build/quality and security jobs, it now includes the **`guardrails`** job:

```
guardrails  (advisory — continue-on-error)
├── Install ripgrep            # rg is not preinstalled on ubuntu-latest
├── Raw Tailwind grays / white
├── Off-scale type / faux weights
├── Raw z-index
├── as any
├── Rust panics / unsafe
└── a11y — role=button needs aria-label
```

The job and each step carry `continue-on-error: true`, so **all** checks run every time and every violation is surfaced in the logs (as a `::error::` annotation), but the workflow stays green. It's skipped on the weekly cron (`if: github.event_name != 'schedule'`).

## 2. The guardrail checks

Each is a ripgrep scan over the source. The right-hand column is the count found when the job was added — that's why they're advisory, not blocking, today.

| Check | Pattern (scope) | Escape hatch | Hits at wire-up |
| --- | --- | --- | --- |
| **Raw colors** | `(bg\|text\|border\|ring)-(zinc\|neutral\|gray\|slate\|stone)-NNN`, `text-white`, `bg-white` in `app/src` `*.tsx`/`*.ts` (excl. CanvasArea, PenOverlay, CompareSlider, MagnifierOverlay, GalleryBar, colors.ts, toolConfig.ts) | `// allow: raw-color` | 38 / 12 files |
| **Off-scale type / faux weights** | `text-[NNpx]`, `font-medium`, `font-black` in `*.tsx` | — | 9 / 7 files |
| **Raw z-index** | `z-10..z-100`, `z-[N…]` in `*.tsx` (excl. GalleryBar, AppShell) | — | 15 / 6 files |
| **`as any`** | `\bas any\b` in `*.ts`/`*.tsx` (excl. `*.d.ts`) | import real types | 3 / 3 files |
| **Rust panics / unsafe** | `.unwrap()`, `.expect(`, `panic!`, `unsafe ` in `src/*.rs` | `// allow:` after review | 28 / 7 files (SIMD `unsafe` is expected) |
| **a11y role=button** | `role="button"` without `aria-label` in `*.tsx` | add `aria-label` | (scanned) |

> The Rust check intentionally flags `unsafe`, which the new `src/simd/` kernels require. Those are legitimate — annotate reviewed sites with `// allow:` rather than removing the check.

## 3. Flipping a check from advisory to blocking

Once a check's baseline is clean (zero real hits, legitimate ones annotated):

1. Remove that step's `continue-on-error: true` in the `guardrails` job — its violations now fail the job.
2. When **all** steps are enforced, remove the **job-level** `continue-on-error: true` so the job blocks the workflow.
3. Optionally add it to branch protection (§5).

Silence a single legitimate site with an `# allow: <tag>` comment at the use site. **Don't** widen the exclude globs — that's the ratchet anti-pattern from the playbook (§13).

---

## 4. Local git hooks

**Installed** as native git hooks (no dependency) in [`.githooks/`](../.githooks), enabled via `core.hooksPath`. Lefthook was skipped because this machine's pnpm store version conflicts with `node_modules` (`pnpm add` wants to relink the whole tree); native hooks avoid pnpm entirely.

- **`pre-commit`** — `cargo fmt --check` on staged Rust (fast, auto-fixable with `cargo fmt`).
- **`pre-push`** — mirrors the *blocking* CI jobs: `cargo fmt --check`, `cargo clippy -D warnings`, `tsc -b` typecheck, and the UploadThing secret-leak guard. Uses only local tools (cargo, pnpm/tsc, grep) — no ripgrep.

`core.hooksPath` is per-clone local config (not committed), so on a fresh clone enable it once:

```bash
git config core.hooksPath .githooks
```

Bypass a single run with `git commit --no-verify` / `git push --no-verify`.

### Alternative: lefthook

If you later reconcile the pnpm store (run `pnpm install` to relink `node_modules`), you can switch to lefthook for parallel, file-scoped hooks:

```bash
pnpm add -D -w lefthook
pnpm exec lefthook install
```

### `lefthook.yml` (repo root)

```yaml
pre-commit:
  parallel: true
  commands:
    raw-colors:
      glob: "app/src/**/*.{tsx,ts}"
      run: |
        echo "{staged_files}" | tr ' ' '\n' \
          | rg -v 'CanvasArea|PenOverlay|CompareSlider|MagnifierOverlay|GalleryBar|lib/colors|toolConfig' \
          | xargs -r rg -n '\b(bg|text|border|ring)-(zinc|neutral|gray|slate|stone)-[0-9]{2,3}\b|\btext-white\b|\bbg-white\b' \
          | rg -v 'allow: raw-color' \
          | (grep . && { echo "✗ raw colors — see §2"; exit 1; } || exit 0)
    as-any:
      glob: "app/src/**/*.{ts,tsx}"
      exclude: "\\.d\\.ts$"
      run: echo "{staged_files}" | tr ' ' '\n' | xargs -r rg -n '\bas any\b' | (grep . && exit 1 || exit 0)
    rust-panics:
      glob: "src/**/*.rs"
      run: echo "{staged_files}" | tr ' ' '\n' | xargs -r rg -n '\.unwrap\(\)|\.expect\(|panic!|unsafe ' | (grep . && exit 1 || exit 0)
    # ...mirror the remaining ci.yml guardrail checks (type-scale, z-index, a11y)
```

Commit-time runs only the checks relevant to staged files (fast); CI runs the full bundle on every push regardless.

---

## 5. Optional: branch protection

Once the build jobs are green twice, in **Settings → Branches → `master` → Branch protection rule**:

- ✅ Require status checks to pass before merging
  - Required: `rust`, `web`, `marketing`, `convex`
  - Don't require `guardrails` (advisory), `cargo-audit`, `pnpm-audit`, `secrets`, or `codeql` until their baselines are clean.
- ✅ Require branches to be up to date before merging

Add `guardrails` to the required set only after §3 (all its checks enforced).

---

## 6. Troubleshooting

**"ripgrep: command not found" in CI.** The `guardrails` job installs it (`apt-get install ripgrep`) — `rg` is not preinstalled on `ubuntu-latest`.

**`pnpm install --frozen-lockfile` fails on a PR.** The branch added a dep without committing the updated lockfile. Locally: `pnpm install`, then commit `pnpm-lock.yaml`.

**A guardrail fails on a legitimate exception.** Add an `# allow: <tag>` comment at the use site (playbook §13). Don't expand the exclude globs.

**The `convex` job is skipped.** It needs the `CONVEX_DEPLOY_KEY` repo secret — see [GitHub-Actions.md](GitHub-Actions.md).

---

## 7. Bypass

Guardrails are advisory infrastructure, not theology. Real reasons to bypass locally (once lefthook is installed):

```bash
git commit --no-verify    # skips lefthook pre-commit
```

In CI there's no clean bypass by design — if a check is wrong, fix the check. Since the `guardrails` job is `continue-on-error`, it never blocks a merge today anyway; that changes only as you enforce checks per §3. Every `--no-verify` should be paired with a TODO in the same branch.
