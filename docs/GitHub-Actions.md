# GitHub Actions (CI)

> Part of the [Image Horse](../README.md) docs. See also: [Architecture](Architecture.md) · [File Map](File-Map.md) · [Getting Started](Getting-Started.md) · [Change Summary](Change-summary.md).

[![CI](https://github.com/chrislanejones/rust-wasm-photo-tool/actions/workflows/ci.yml/badge.svg)](https://github.com/chrislanejones/rust-wasm-photo-tool/actions/workflows/ci.yml)

All CI lives in a single workflow, [`.github/workflows/ci.yml`](../.github/workflows/ci.yml), plus a Dependabot config at [`.github/dependabot.yml`](../.github/dependabot.yml). It runs on every push to `master`, every pull request, and on a weekly Monday cron (so newly-disclosed CVEs are caught even when nothing has changed). Free + unlimited on a public repo.

## Jobs

### Quality / build

| Job | What it does | Mirrors |
| --- | --- | --- |
| `rust` | `cargo fmt --check`, `cargo clippy -D warnings`, `cargo test`, then `wasm-pack build` | Netlify's Rust build |
| `web` | Typecheck (`tsc -b`) + `pnpm build:all` (WASM + editor app) | Netlify's app build |
| `marketing` | Builds the marketing site **from `marketing/`** (`pnpm build`) | Vercel's `/marketing` root |
| `convex` | `convex codegen` (Convex's own typecheck) + `_generated` drift check | — |

> Build/quality jobs are skipped on the weekly cron (`if: github.event_name != 'schedule'`) — no point rebuilding when nothing changed.

### Security

| Job | What it does |
| --- | --- |
| `cargo-audit` | Checks `Cargo.lock` against the RustSec advisory DB |
| `pnpm-audit` | `pnpm audit` on npm deps (non-blocking — transitive advisories are often unfixable noise) |
| `secrets` | `gitleaks` scans full git history for committed secrets |
| `codeql` | GitHub CodeQL static analysis of the TypeScript/React code |
| `uploadthing-leak-guard` | Fails if client source bundles the server-only UploadThing secret (no `VITE_UPLOADTHING*` / `import.meta.env.*UPLOADTHING`) |

### Static guardrails

| Job | What it does |
| --- | --- |
| `guardrails` | **Advisory** static checks — raw Tailwind colors, off-scale type/faux weights, raw z-index, `as any`, Rust `unwrap`/`expect`/`panic`/`unsafe`, unlabelled `role="button"`. Reports violations without failing the build (`continue-on-error`); see **[CI-Guardrails.md](CI-Guardrails.md)** for each check, current baseline, and how to make them blocking. |

### Dependabot

`.github/dependabot.yml` opens weekly PRs for outdated/vulnerable **cargo**, **npm**, and **github-actions** dependencies. Security fixes are filed immediately regardless of the schedule.

## Where findings show up

Nothing here opens GitHub **Issues**. Results surface as: a red ✗ check on the commit/PR (+ email), alerts in the repo's **Security** tab (CodeQL + Dependabot), and Dependabot **pull requests**.

## Setup notes

- **`CONVEX_DEPLOY_KEY` secret** — the `convex` job's codegen/drift step only runs when this repo secret is set (Settings → Secrets and variables → Actions). Use a Convex **preview/CI** deploy key, not prod. Without it, the job prints "skipped" and stays green.
- **Native secret scanning + push protection** — enable under **Settings → Code security** (free for public repos); it blocks secrets *before* they're pushed, complementing the `gitleaks` history scan.

## Deploy hosts (not driven by Actions)

Deploys are handled by the platforms themselves on push, not by this workflow:

- **Netlify** — git root → installs Rust + `wasm-pack`, builds the editor app → `www-dist`
- **Vercel** — `marketing/` root → `marketing/vercel.json` → builds the marketing site → `dist`

CI's `web` / `rust` / `marketing` jobs mirror those builds so a break fails in CI before it reaches the host.
