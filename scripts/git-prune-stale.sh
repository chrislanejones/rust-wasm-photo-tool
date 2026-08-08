#!/usr/bin/env bash
# git-prune-stale — delete local branches that are FULLY MERGED into the base
# branch and whose tip is older than N hours. Removes their worktrees first,
# but only when those worktrees are clean.
#
# Dry-run by default. Nothing is deleted without --yes.
#
# NOTE ON "PUSHED N HOURS AGO": git stores no push timestamp — there is no such
# field in a repo. Age here is the tip's COMMITTER DATE. The "fetched" column
# is the remote-tracking ref's reflog time, i.e. when this machine last updated
# its copy of the remote branch. Neither is a push time; committer date is the
# stable one, so it drives the decision.
#
# Usage:
#   git-prune-stale                 # dry run, 8h, base=master
#   git-prune-stale -h 24           # dry run, 24h
#   git-prune-stale -h 8 --yes      # actually delete
#   git-prune-stale -b main --yes
set -uo pipefail

HOURS=8
BASE=""
APPLY=0

while [ $# -gt 0 ]; do
  case "$1" in
    -h|--hours) HOURS="${2:?-h needs a number}"; shift 2 ;;
    -b|--base)  BASE="${2:?-b needs a branch}";  shift 2 ;;
    -y|--yes)   APPLY=1; shift ;;
    --help)     sed -n '2,20p' "$0" | sed 's/^# \?//'; exit 0 ;;
    *) echo "unknown argument: $1  (try --help)" >&2; exit 2 ;;
  esac
done

git rev-parse --git-dir >/dev/null 2>&1 || { echo "not a git repo" >&2; exit 1; }

# Default base: master if it exists, else main, else the current HEAD's upstream.
if [ -z "$BASE" ]; then
  for cand in master main; do
    git show-ref --verify --quiet "refs/heads/$cand" && { BASE="$cand"; break; }
  done
fi
[ -n "$BASE" ] || { echo "no base branch found (pass -b)" >&2; exit 1; }
git show-ref --verify --quiet "refs/heads/$BASE" || { echo "base '$BASE' does not exist" >&2; exit 1; }

CURRENT="$(git rev-parse --abbrev-ref HEAD)"
NOW=$(date +%s)
CUTOFF=$(( NOW - HOURS * 3600 ))

age_str() { # seconds -> "3d 4h"
  local s=$1 d h
  d=$(( s / 86400 )); h=$(( (s % 86400) / 3600 ))
  if [ "$d" -gt 0 ]; then printf '%dd %dh' "$d" "$h"; else printf '%dh' "$h"; fi
}

# Map branch -> worktree path, from porcelain output.
declare -A WT
while read -r key val; do
  case "$key" in
    worktree) wtpath="$val" ;;
    branch)   WT["${val#refs/heads/}"]="$wtpath" ;;
  esac
done < <(git worktree list --porcelain | sed 's/^\([a-z]*\) \?/\1 /')

printf '%-32s %-10s %-12s %-10s %s\n' BRANCH AGE FETCHED MERGED VERDICT
printf '%.0s─' {1..92}; echo

CANDIDATES=()
while read -r br ts; do
  [ "$br" = "$BASE" ] && continue

  age=$(( NOW - ts ))
  merged="no"
  git merge-base --is-ancestor "$br" "$BASE" 2>/dev/null && merged="yes"

  # Reflog time of the remote-tracking ref, if this branch has one.
  fetched="—"
  for rem in $(git remote); do
    rt="refs/remotes/$rem/$br"
    if git show-ref --verify --quiet "$rt"; then
      rts=$(git log -g --format=%ct -1 "$rt" 2>/dev/null || true)
      [ -n "$rts" ] && fetched="$(age_str $(( NOW - rts )))"
      break
    fi
  done

  if [ "$merged" != "yes" ]; then
    verdict="KEEP — unmerged commits"
  elif [ "$br" = "$CURRENT" ]; then
    verdict="KEEP — checked out here"
  elif [ "$ts" -gt "$CUTOFF" ]; then
    verdict="KEEP — newer than ${HOURS}h"
  else
    wt="${WT[$br]:-}"
    if [ -n "$wt" ] && [ -n "$(git -C "$wt" status --porcelain 2>/dev/null)" ]; then
      verdict="KEEP — worktree is dirty"
    else
      verdict="DELETE"
      CANDIDATES+=("$br")
    fi
  fi

  printf '%-32s %-10s %-12s %-10s %s\n' "$br" "$(age_str $age)" "$fetched" "$merged" "$verdict"
done < <(git for-each-ref --format='%(refname:short) %(committerdate:unix)' refs/heads/)

echo
if [ ${#CANDIDATES[@]} -eq 0 ]; then
  echo "Nothing to delete."
  exit 0
fi

echo "${#CANDIDATES[@]} branch(es) to delete: ${CANDIDATES[*]}"

if [ "$APPLY" -ne 1 ]; then
  echo
  echo "DRY RUN — nothing was deleted. Re-run with --yes to apply."
  exit 0
fi

echo
for br in "${CANDIDATES[@]}"; do
  wt="${WT[$br]:-}"
  if [ -n "$wt" ]; then
    echo "  worktree remove $wt"
    git worktree remove "$wt" || { echo "  ! failed, skipping $br"; continue; }
  fi
  # -d, never -D: git refuses if anything is actually unmerged, which is the
  # last safety net behind the is-ancestor check above.
  git branch -d "$br" | sed 's/^/  /'
done
git worktree prune
echo
echo "Done. Remaining branches:"
git branch | sed 's/^/  /'
