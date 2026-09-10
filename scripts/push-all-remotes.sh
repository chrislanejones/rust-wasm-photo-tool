#!/usr/bin/env bash
# Push a ref to EVERY configured remote, then prove it landed on each.
#
# ⚠️ WHY THIS EXISTS. Cutting v8.74 the push loop looked for a remote named
# "codeberg". This repo's is spelled "codeburg". The grep matched nothing, the
# loop pushed nowhere, and it reported success — so Codeberg sat 12 commits
# behind while every summary said both remotes were in sync. Nobody was lied
# to on purpose; the check simply had nothing to find and said so with silence.
#
# A SKIPPED CHECK IS NOT A PASSING CHECK. Two rules follow, and this script is
# only those two rules:
#
#   1. Never name a remote. Enumerate `git remote` and push to all of them, so
#      a rename, a typo or a new mirror cannot silently drop one.
#   2. Verify AFTER pushing. Read the sha back off each remote and compare it
#      to local. A push that "succeeded" and left the wrong sha is the failure
#      this is guarding, and only the read-back can see it.
#
# Usage:
#   scripts/push-all-remotes.sh master v8.74     # a branch and a tag
#   scripts/push-all-remotes.sh master           # just the branch
#
set -uo pipefail

BRANCH="${1:?usage: push-all-remotes.sh <branch> [tag]}"
TAG="${2:-}"

mapfile -t REMOTES < <(git remote)
if [ "${#REMOTES[@]}" -eq 0 ]; then
  echo "FAIL: no git remotes configured — nothing to push to." >&2
  exit 1
fi

LOCAL_SHA="$(git rev-parse "$BRANCH")"
echo "local $BRANCH = ${LOCAL_SHA:0:8}"
echo "remotes: ${REMOTES[*]}"
echo

fail=0

for r in "${REMOTES[@]}"; do
  echo "── $r ──"
  if ! git push "$r" "$BRANCH" 2>&1 | sed 's/^/  /'; then
    echo "  FAIL: push of $BRANCH to $r returned non-zero" >&2
    fail=1
  fi
  if [ -n "$TAG" ]; then
    if ! git push "$r" "$TAG" 2>&1 | sed 's/^/  /'; then
      echo "  FAIL: push of tag $TAG to $r returned non-zero" >&2
      fail=1
    fi
  fi
done

echo
echo "── verify (read back from each remote) ──"
for r in "${REMOTES[@]}"; do
  remote_sha="$(git ls-remote "$r" "refs/heads/$BRANCH" 2>/dev/null | cut -f1)"
  if [ -z "$remote_sha" ]; then
    echo "  FAIL $r: $BRANCH not found on the remote after pushing" >&2
    fail=1
  elif [ "$remote_sha" != "$LOCAL_SHA" ]; then
    echo "  FAIL $r: $BRANCH is ${remote_sha:0:8}, local is ${LOCAL_SHA:0:8}" >&2
    fail=1
  else
    echo "  ok   $r: $BRANCH ${remote_sha:0:8}"
  fi

  if [ -n "$TAG" ]; then
    tag_sha="$(git ls-remote "$r" "refs/tags/$TAG" 2>/dev/null | cut -f1)"
    if [ -z "$tag_sha" ]; then
      echo "  FAIL $r: tag $TAG not found on the remote after pushing" >&2
      fail=1
    else
      echo "  ok   $r: tag $TAG ${tag_sha:0:8}"
    fi
  fi
done

echo
if [ "$fail" -ne 0 ]; then
  echo "PUSH INCOMPLETE — at least one remote does not match local." >&2
  exit 1
fi
echo "All ${#REMOTES[@]} remote(s) match local."
