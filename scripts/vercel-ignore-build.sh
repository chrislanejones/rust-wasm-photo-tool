#!/usr/bin/env bash
# Vercel "Ignored Build Step" — decides whether a push needs this project built.
#
#   exit 0 = SKIP the build      exit 1 = BUILD
#
# (Vercel's convention, and backwards from what you would guess: 0 means
# "ignore this build". Every branch below prints which way it went and why, so
# the answer is in the deployment log without reading this file.)
#
# usage: vercel-ignore-build.sh <ignorable>...
#
#   <ignorable> ending in "/"   a directory, anchored at the repo root: any file
#                               under it is ignorable ("src/" is the Rust
#                               engine, never marketing/src/)
#   anything else               a ROOT-LEVEL file glob, e.g. '*.md' or
#                               'Cargo.toml' — it never matches below the root
#
# ── why this exists ──────────────────────────────────────────────────────────
# Two Vercel projects are git-linked to this one repo: `image-horse` (the
# editor, repo root) and `image-horse-marketing` (marketing/). Both built on
# every push to every branch, so a marketing-only change also ran the editor's
# ~3 min Rust build — `cargo install wasm-pack` included — and an app-only
# change rebuilt the marketing site. Measured for September 2026:
#
#   942 builds · 1,401 build minutes · 1,731 minutes spent QUEUED
#   09-17: 103 builds in one day — over Hobby's 100-a-day cap
#
# Hobby allows one build at a time, which is where the queue came from.
#
# ── the rule ─────────────────────────────────────────────────────────────────
# SKIP only when every file changed since this branch's last real deployment is
# on the caller's ignorable list. Anything the script cannot establish is a
# BUILD: no previous deployment, a previous SHA outside the shallow clone, a git
# error, a file it does not recognize. The failure mode of a wrong list is
# therefore one wasted build, never a stale site.
#
# The lists are EXCLUSIONS on purpose. The alternative, listing what each
# project reads, fails the other way: forget one input and a change to it ships
# nowhere, silently, with a green deploy in front of it.
set -u

build() { echo "▶ BUILD — $1"; exit 1; }
skip()  { echo "⏭ SKIP — $1"; exit 0; }

# Dependabot branches never deploy (vercel.json's git.deploymentEnabled stops
# them before this runs). This is the second line, for a branch that got in
# some other way — a manual redeploy, a renamed rule.
ref="${VERCEL_GIT_COMMIT_REF:-}"
case "$ref" in
  dependabot/*) skip "dependabot branch ($ref) — updates are reviewed in CI, not previews" ;;
esac

[ "$#" -gt 0 ] || build "no ignorable paths were passed; refusing to guess"

# The last SUCCESSFUL deployment of this project on this branch. A skipped
# deployment is not a successful one, so this stays put across skips and the
# diff below accumulates everything since the last build that actually ran.
base="${VERCEL_GIT_PREVIOUS_SHA:-}"
[ -n "$base" ] || build "no previous deployment on ${ref:-this branch}"

# No `cd` to the repo root: `git diff --name-only` prints root-relative paths
# from any directory, and this runs from marketing/ for that project. (A `cd`
# here was mutation-tested and changed nothing, so it went.)
git rev-parse --git-dir >/dev/null 2>&1 || build "not inside a git checkout"

# Vercel's clone is shallow. A previous deploy further back than its depth is
# not here to diff against, and "cannot compare" has to mean "build".
git cat-file -e "${base}^{commit}" 2>/dev/null ||
  build "previous deployment ${base:0:7} is outside this clone's history"

# --no-renames: a file moved OUT of a watched directory must still count as a
# change there. Rename detection would report only the new path.
changed="$(git diff --name-only --no-renames "$base" HEAD 2>/dev/null)" ||
  build "git diff ${base:0:7}..HEAD failed"

# An empty diff is a deliberate redeploy — the documented way to re-trigger a
# stuck deploy is an empty commit — so it must build, not skip.
[ -n "$changed" ] || build "no files changed since ${base:0:7}, so this is a deliberate redeploy"

n=0
while IFS= read -r f; do
  n=$((n + 1))
  ok=0
  for p in "$@"; do
    case "$p" in
      */) [[ "$f" == "$p"* ]] && ok=1 ;;
      *)  [[ "$f" != */* && "$f" == $p ]] && ok=1 ;;
    esac
    [ "$ok" = 1 ] && break
  done
  [ "$ok" = 1 ] || build "$f changed since ${base:0:7}"
done <<< "$changed"

skip "all $n changed file(s) since ${base:0:7} are outside what this project builds from"
