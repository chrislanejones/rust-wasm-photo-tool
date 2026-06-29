#!/usr/bin/env bash
# Local mirror of the CI build/quality gates — run before pushing to catch what
# GitHub Actions (.github/workflows/ci.yml) would fail on. Mirrors the rust, web,
# and marketing jobs. The security / CodeQL / Convex jobs need Docker or secrets
# and are NOT mirrored here (see docs/CI-Guardrails.md). Bypass a push with
# `git push --no-verify`.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

step() { printf '\n\033[1;34m▶ %s\033[0m\n' "$1"; }

step "rust · fmt";        cargo fmt --all --check
step "rust · clippy";     cargo clippy --all-targets -- -D warnings
step "rust · test";       cargo test
step "rust · wasm-pack";  wasm-pack build --target web --out-dir pkg
step "web · install";     pnpm install --frozen-lockfile
step "web · typecheck";   pnpm --filter stamp-tool exec tsc -b --noEmit
step "web · build:all";   pnpm run build:all
step "marketing · build"; ( cd marketing && pnpm build )

printf '\n\033[1;32m✅ local CI mirror passed — safe to push\033[0m\n'
