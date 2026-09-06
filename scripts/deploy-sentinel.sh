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
#   1. the wasm is in a sane size band. ⚠️ The numbers here rot — re-measure,
#      never trust the comment. As of 2026-08-18 (ADR-037): featureless 723,755 B
#      local, featured 806,967 B local, featured 813,546 B LIVE. That last gap is
#      6,579 B of rustc, not of code: nothing pins the toolchain (netlify.toml
#      curls rustup `--default-toolchain stable`, CI uses dtolnay@stable), so the
#      live binary is built by whatever stable is on the day — 1.97.1 against a
#      local 1.92.0. The band absorbs that; a size measured locally is NOT the
#      shipped size. The floor had already gone vacuous once: it sat at 700,000
#      while a featureless build had grown to 723,755 and sailed through it.
#   2. the JS glue actually exports the engine surface we think shipped
#
# Runnable by hand — that is the point:  ./scripts/deploy-sentinel.sh
set -uo pipefail

SITE="${SENTINEL_SITE:-https://rust-wasm-photo-tool.netlify.app}"
MIN_WASM="${SENTINEL_MIN_WASM:-800000}"
MAX_WASM="${SENTINEL_MAX_WASM:-840000}"
# Methods that only exist when the engine is built --features tiles,patchmatch.
# `oplog_active` is the tiles/op-log surface; `remove_object` is PatchMatch.
#
# ⚠️ MATCHED AS DECLARATIONS, NOT AS BARE STRINGS — and that is the whole point.
# This list used to be `(oplog_ remove_object rect_select)` grepped with a plain
# `grep -q`, and ALL THREE were vacuous (measured 2026-09-05 against a real
# featureless build):
#   • `oplog_` matched a doc comment mentioning `oplog_engine_in_sync`
#   • `remove_object` matched 2 doc comments that merely NAME it
#   • `rect_select` is not feature-gated at all — it is in every build
# So the export half of this sentinel PASSED on a featureless build, and the
# size floor below was the only thing catching the failure this script exists
# for (see project_netlify_featureless_wasm_bug). Same bug class CLAUDE.md
# already documents for guardrails.sh: a text grep cannot tell code from prose.
#
# Matched as a DECLARATION: the name, an argument list, and an opening brace
# (`remove_object() {`). A doc comment can name a symbol but cannot follow it
# with a signature and a brace. Deliberately NOT anchored on indentation — the
# live glue is a Vite chunk, and an indent anchor would false-fail the day the
# minifier collapses whitespace.
#
# Verified against three real artifacts (2026-09-05): the live minified glue,
# a raw featured `pkg/` glue, and a raw FEATURELESS one. Featured 1/1/1,
# featureless 0/0/1 — the two gated symbols correctly absent.
#
# If this ever does misfire it fails CLOSED (a false alarm on a good deploy),
# which is the right direction to be wrong for a sentinel; the old bare grep
# failed OPEN and waved a featureless build through.
REQUIRED_SYMBOLS=(oplog_active remove_object)
# Not feature-gated, so it proves only that this is a real engine glue and not
# that the features are on. Kept deliberately, listed separately so nobody
# mistakes it for a feature check again.
WIRED_SYMBOLS=(rect_select)

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
for sym in "${REQUIRED_SYMBOLS[@]}" "${WIRED_SYMBOLS[@]}"; do
  grep -qE "${sym}\([A-Za-z0-9_\$, ]*\)[[:space:]]*\{" "$TMP/glue.js" || missing+=("$sym")
done
if [ ${#missing[@]} -gt 0 ]; then
  fail "live glue is MISSING engine exports: ${missing[*]} — production is serving a featureless build (see netlify.toml --features tiles,patchmatch)"
fi
echo "  exports    : ${REQUIRED_SYMBOLS[*]} ${WIRED_SYMBOLS[*]} all declared"

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
