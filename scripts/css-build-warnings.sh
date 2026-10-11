#!/usr/bin/env bash
# CSS build warnings stay at ZERO (Night 10-07 §3.3).
#
#   scripts/css-build-warnings.sh build.log   # check a captured build log
#   scripts/css-build-warnings.sh             # build, then check
#
# Tailwind scans TEXT, comments included, so a comment that spells a whole
# arbitrary class (the example lived in three comments until #315) is minted
# into a rule, and the CSS optimizer then rejects the value and prints
# "Found 1 warning while optimizing generated CSS: … Unexpected token
# Delim('*')". The build still succeeds, so nothing failed. This makes it fail.
#
# Not in guardrails.sh on purpose: guardrails greps source text and never
# builds, and this warning only exists in a build's output. CI runs it on the
# log of the build it already does (the `web` job).
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ $# -ge 1 ]]; then
  log="$1"
else
  log="$(mktemp)"
  pnpm run build 2>&1 | tee "$log" >/dev/null
fi

# "Found N warning(s) while optimizing generated CSS:"
hits="$(grep -E 'warnings? while optimizing generated CSS' "$log" || true)"
if [[ -n "$hits" ]]; then
  echo "FAIL css-build-warnings: the build printed CSS optimizer warnings:"
  echo "$hits"
  grep -E "Unexpected token|^\S*│ +\." "$log" | sed 's/\x1b\[[0-9;]*m//g' | head -20 || true
  echo "Usually a COMMENT spelling a complete arbitrary class. Reword the comment."
  exit 1
fi
echo "ok css-build-warnings: 0"
