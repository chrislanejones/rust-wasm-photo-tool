#!/usr/bin/env bash
# Tests for scripts/vercel-ignore-build.sh — every branch, in a throwaway repo.
#
#   bash scripts/vercel-ignore-build.test.sh      # exits 1 on any failure
#
# Vercel's exit codes are backwards (0 = SKIP, 1 = BUILD), which is exactly the
# kind of thing that gets flipped by accident, so each case asserts the verdict
# by name rather than by number.
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
SUT="$HERE/vercel-ignore-build.sh"
# Left in the system temp dir for the OS to clear. No `rm -rf` on a variable:
# the repo's own rules forbid it, and a blank $WORK would make it catastrophic.
WORK="$(mktemp -d -t vercel-ignore-test.XXXXXX)"

fails=0
expect() { # expect <SKIP|BUILD> <label> <env...> -- <args...>
  local want="$1" label="$2"; shift 2
  local envs=() reason=""
  while [ "$#" -gt 0 ] && [ "$1" != "--" ]; do
    case "$1" in REASON=*) reason="${1#REASON=}" ;; *) envs+=("$1") ;; esac
    shift
  done
  shift # the --
  local out code got
  out="$(cd "${RUN_DIR:-$WORK/repo}" && env "${envs[@]}" bash "$SUT" "$@" 2>&1)"; code=$?
  case "$code" in 0) got=SKIP ;; 1) got=BUILD ;; *) got="EXIT $code" ;; esac
  if [ "$got" = "$want" ] && { [ -z "$reason" ] || [[ "$out" == *"$reason"* ]]; }; then
    printf '  ok    %-5s %s\n' "$want" "$label"
  else
    printf '  FAIL  wanted %s%s, got %s — %s\n        %s\n' "$want" "${reason:+ ($reason)}" "$got" "$label" "$out"
    fails=$((fails + 1))
  fi
}

# ── a repo shaped like this one ─────────────────────────────────────────────
git init -q "$WORK/repo"
cd "$WORK/repo" || exit 2
git config user.email t@t; git config user.name t
mkdir -p app/src marketing/src src docs
echo a > app/src/a.ts; echo m > marketing/src/m.ts; echo r > src/lib.rs
echo d > docs/d.md; echo readme > README.md; echo c > Cargo.toml
git add -A; git commit -qm base
BASE="$(git rev-parse HEAD)"

commit() { git add -A; git commit -qm "$1" --allow-empty; }

# Ignorable lists as the two projects pass them (subset — enough to exercise).
EDITOR=(marketing/ docs/ '*.md')
MARKETING=(app/ src/ docs/ 'Cargo.toml' '*.md')

echo "── guards"
expect SKIP  "dependabot branch skips before anything else" \
  VERCEL_GIT_COMMIT_REF=dependabot/npm_and_yarn/vite-8.1.5 -- "${EDITOR[@]}"
expect BUILD "no ignorable paths passed → refuse to guess" \
  REASON="no ignorable paths" VERCEL_GIT_PREVIOUS_SHA="$BASE" --
expect BUILD "no previous deployment on the branch" \
  VERCEL_GIT_COMMIT_REF=feat/x -- "${EDITOR[@]}"
expect BUILD "previous SHA not in this clone" \
  REASON="outside this clone" VERCEL_GIT_PREVIOUS_SHA=0123456789abcdef0123456789abcdef01234567 -- "${EDITOR[@]}"

NOT_A_REPO="$(mktemp -d -t vercel-ignore-nogit.XXXXXX)"
RUN_DIR="$NOT_A_REPO" expect BUILD "outside any git checkout → build" \
  REASON="not inside a git checkout" VERCEL_GIT_PREVIOUS_SHA="$BASE" -- "${EDITOR[@]}"

echo "── empty diff"
commit "empty redeploy"
expect BUILD "empty commit = deliberate redeploy, must build" \
  REASON="deliberate redeploy" VERCEL_GIT_PREVIOUS_SHA="$BASE" -- "${EDITOR[@]}"

echo "── marketing-only change"
echo m2 > marketing/src/m.ts; commit mkt
expect SKIP  "editor skips a marketing-only change" \
  VERCEL_GIT_PREVIOUS_SHA="$BASE" -- "${EDITOR[@]}"
expect BUILD "marketing builds its own change" \
  VERCEL_GIT_PREVIOUS_SHA="$BASE" -- "${MARKETING[@]}"

echo "── anchoring"
expect BUILD "'src/' is the ROOT src only — marketing/src/ still counts for marketing" \
  VERCEL_GIT_PREVIOUS_SHA="$BASE" -- src/ app/
M2="$(git rev-parse HEAD)"
echo nested > marketing/src/notes.md; commit nested-md
expect BUILD "'*.md' is root-level only — a nested .md is a real change" \
  VERCEL_GIT_PREVIOUS_SHA="$M2" -- '*.md'
M3="$(git rev-parse HEAD)"
echo r2 > README.md; commit readme
expect SKIP  "root README change is ignorable by '*.md'" \
  VERCEL_GIT_PREVIOUS_SHA="$M3" -- '*.md'

echo "── mixed and accumulated changes"
M4="$(git rev-parse HEAD)"
echo d2 > docs/d.md; commit docs
echo a2 > app/src/a.ts; commit app
echo d3 > docs/d.md; commit docs-again
expect BUILD "an app change two commits back is still a change (diff spans skips)" \
  VERCEL_GIT_PREVIOUS_SHA="$M4" -- "${EDITOR[@]}"
expect SKIP  "…and marketing ignores that whole range" \
  VERCEL_GIT_PREVIOUS_SHA="$M4" -- "${MARKETING[@]}"

echo "── renames"
M5="$(git rev-parse HEAD)"
git mv app/src/a.ts docs/a.ts; commit move-out
expect BUILD "moving a file OUT of app/ is an app change (--no-renames)" \
  VERCEL_GIT_PREVIOUS_SHA="$M5" -- docs/ marketing/

echo "── run from the marketing project's own root"
M6="$(git rev-parse HEAD)"
echo r3 > src/lib.rs; commit engine
RUN_DIR="$WORK/repo/marketing" expect SKIP "cwd=marketing/: paths still resolve from the repo root" \
  VERCEL_GIT_PREVIOUS_SHA="$M6" -- "${MARKETING[@]}"

echo
if [ "$fails" -eq 0 ]; then echo "all passed"; else echo "$fails FAILED"; exit 1; fi
