#!/usr/bin/env bash
# Deploy sentinel — assert the LIVE site is serving a real engine.
#
# This is the manual check that caught the five-week featureless-prod bug, made
# automatic. From v7.36 to v7.45 netlify.toml ran a bare `wasm-pack build` with
# no --features, so production shipped a WASM without tiles/op-log. Nothing
# crashed: the app's runtime feature-detects quietly took the fallback path, so
# every "shipped ON" op-log flag was silently off for real users while every
# local build was fine. HTTP 200 proved nothing. Only fetching the live binary
# and looking inside it would have caught it.
#
# Checks, against whatever is live right now:
#   1. the wasm is in a sane size band (a featureless build is ~680KB, a real
#      one ~750-765KB; the band spans local vs Netlify toolchain differences)
#   2. the JS glue actually exports the engine surface we think shipped
#
# Runnable by hand — that is the point:  ./scripts/deploy-sentinel.sh
set -uo pipefail

SITE="${SENTINEL_SITE:-https://rust-wasm-photo-tool.netlify.app}"
MIN_WASM="${SENTINEL_MIN_WASM:-700000}"
MAX_WASM="${SENTINEL_MAX_WASM:-800000}"
# Symbols that only exist when the engine is built --features tiles,patchmatch.
# oplog_* is the tiles/op-log surface; remove_object is PatchMatch; rect_select
# is the marquee. Miss any one and prod is not running what we shipped.
REQUIRED_SYMBOLS=(oplog_ remove_object rect_select)

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
fail() { echo "::error::$*"; echo "SENTINEL FAIL: $*" >&2; exit 1; }

fetch() { # url -> file, with retries for transient CDN/network flakes
  local url="$1" out="$2" i
  for i in 1 2 3; do
    curl -fsSL --max-time 120 "$url" -o "$out" && return 0
    echo "  fetch attempt $i failed: $url" >&2
    sleep $((i * 5))
  done
  return 1
}

echo "Deploy sentinel -> $SITE"

fetch "$SITE/" "$TMP/index.html" || fail "could not fetch $SITE/"

app="$(grep -o 'assets/index-[A-Za-z0-9_-]*\.js' "$TMP/index.html" | head -1)"
[ -n "$app" ] || fail "no app bundle referenced by index.html — is the site serving the SPA?"
fetch "$SITE/$app" "$TMP/app.js" || fail "could not fetch $app"
echo "  app bundle : $app"

# The glue is referenced RELATIVELY ("./stamp_tool-<hash>.js") because the
# importer already lives in assets/ — so match the bare filename, not a path.
glue="$(grep -o 'stamp_tool-[A-Za-z0-9_-]*\.js' "$TMP/app.js" | head -1)"
[ -n "$glue" ] || fail "app bundle references no stamp_tool glue — the WASM engine is not wired into this build"
fetch "$SITE/assets/$glue" "$TMP/glue.js" || fail "could not fetch assets/$glue"
echo "  glue       : $glue ($(stat -c%s "$TMP/glue.js") bytes)"

missing=()
for sym in "${REQUIRED_SYMBOLS[@]}"; do
  grep -q "$sym" "$TMP/glue.js" || missing+=("$sym")
done
if [ ${#missing[@]} -gt 0 ]; then
  fail "live glue is MISSING engine exports: ${missing[*]} — production is serving a featureless build (see netlify.toml --features tiles,patchmatch)"
fi
echo "  exports    : ${REQUIRED_SYMBOLS[*]} all present"

wasm="$(grep -o 'stamp_tool_bg-[A-Za-z0-9_-]*\.wasm' "$TMP/glue.js" | head -1)"
[ -n "$wasm" ] || fail "glue references no .wasm binary"
fetch "$SITE/assets/$wasm" "$TMP/engine.wasm" || fail "could not fetch assets/$wasm"
size="$(stat -c%s "$TMP/engine.wasm")"
echo "  wasm       : $wasm ($size bytes)"

if [ "$size" -lt "$MIN_WASM" ]; then
  fail "live wasm is ${size}B, under the ${MIN_WASM}B floor — that is the size of a FEATURELESS build"
fi
if [ "$size" -gt "$MAX_WASM" ]; then
  fail "live wasm is ${size}B, over the ${MAX_WASM}B ceiling — unexpected growth, check what landed"
fi

echo "SENTINEL PASS: live engine is real (${size}B, all exports present)."
