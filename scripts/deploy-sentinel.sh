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

# ── Exact-hash assertions (ADR-046) ─────────────────────────────────────────
# The size band above catches catastrophe; this catches everything else. The
# build is reproducible PER COMMIT (ADR-045, ADR-038 correction), so the
# deployed bundle carries its own expectation in build-info.json — written by
# the same build that produced the asset, so the two cannot disagree about
# which commit they are, and deploy lag cannot make this check fail wrongly.
#
# Two tiers, weakest first:
#   1. self-consistency — the wasm the site SERVES is the one its build wrote.
#      Catches a stale CDN object, a partial deploy, a hand-edited asset.
#   2. reproducibility  — CI's independent build of the SAME commit produced
#      the SAME bytes. Only compared when the commits match (on a push, CI
#      builds github.sha; the live site may still be serving the previous
#      commit for a minute — that is lag, not a failure, and is reported as
#      such). Catches optimizer / compiler / feature drift between builders.
#
# The size floor STAYS as an independent check: the export check was vacuous
# for its whole life and the floor was the only thing that ever caught a
# featureless deploy. Don't remove the survivor.
live_sha="$(sha256sum "$TMP/engine.wasm" | cut -d' ' -f1)"
# ⚠️ A 200 IS NOT PROOF THE FILE EXISTS. Netlify's SPA fallback serves
# index.html for ANY unknown path, so `curl -f` on a missing build-info.json
# succeeds and hands back HTML. Checked against the real site 2026-09-05: it
# returned the app shell, and an earlier version of this block read that as
# "present but malformed" and failed a perfectly healthy deploy. Require the
# body to actually be JSON before believing in it.
if fetch "$SITE/build-info.json" "$TMP/build-info.json" 2>/dev/null &&
   [ "$(head -c 1 "$TMP/build-info.json")" = "{" ]; then
  bi() { grep -oE "\"$1\": *\"[^\"]*\"" "$TMP/build-info.json" | head -1 | sed -E 's/.*: *"([^"]*)"/\1/'; }
  bi_commit="$(bi commit)"; bi_sha="$(bi wasm_sha256)"; bi_asset="$(bi wasm_asset)"
  bi_binaryen="$(bi binaryen)"; bi_rustc="$(bi rustc)"; bi_features="$(bi features)"
  echo "  build-info : commit ${bi_commit:0:7}  binaryen ${bi_binaryen:-?}  rustc ${bi_rustc:-?}  features ${bi_features:-?}"
  if [ -z "$bi_sha" ]; then
    fail "build-info.json is present but carries no wasm_sha256 — scripts/write-build-info.sh is broken or was skipped"
  fi
  # Tier 1: served asset == the asset this build wrote.
  if [ "$live_sha" != "$bi_sha" ]; then
    fail "the wasm the site SERVES is not the one its build wrote.
  served : $wasm  sha256 ${live_sha:0:16}…
  built  : $bi_asset  sha256 ${bi_sha:0:16}…
  This is a deploy problem, not a code one. Likely causes, in order:
    1. a stale CDN/edge object — purge the asset and re-check
    2. a partial deploy — index.html and assets/ from different builds
    3. build-info.json left over from a previous publish
    4. a hand-edited or re-optimized asset in the publish dir"
  fi
  echo "  tier 1     : served wasm == build's own record  ✓"
  # Tier 2: CI's independent build of the same commit == this build.
  if [ -n "${EXPECTED_WASM_SHA256:-}" ] && [ -n "${EXPECTED_COMMIT:-}" ]; then
    if [ "$bi_commit" = "$EXPECTED_COMMIT" ]; then
      if [ "$bi_sha" != "$EXPECTED_WASM_SHA256" ]; then
        fail "CI and the deploy built the SAME commit (${bi_commit:0:7}) and got DIFFERENT bytes.
  deploy : ${bi_sha:0:16}…   (binaryen ${bi_binaryen:-?}, rustc ${bi_rustc:-?}, features ${bi_features:-?})
  CI     : ${EXPECTED_WASM_SHA256:0:16}…
  The build is reproducible per commit (ADR-045), so one builder drifted.
  Likely causes, in order:
    1. wasm-opt version — scripts/build-wasm.sh pins binaryen 117; a PATH
       copy that beat the pin, or a wasm-pack other than 0.15.0
    2. rustc — rust-toolchain.toml says 1.97.1; RUSTUP_TOOLCHAIN in the
       environment overrides the file (ADR-038)
    3. feature flags — IH_WASM_FEATURES must be unset (= tiles,patchmatch)
       on both; CI's other build is deliberately feature-free
    4. an env RUSTFLAGS on one side (replaces .cargo/config.toml's array)
    5. a genuine source difference — then the commits are NOT the same and
       build-info.json's commit field is wrong"
      fi
      echo "  tier 2     : CI build of ${bi_commit:0:7} == deploy build  ✓  (reproducible across builders)"
    else
      echo "  tier 2     : skipped — CI built ${EXPECTED_COMMIT:0:7}, live is ${bi_commit:0:7} (deploy lag or a different branch); nothing to compare yet"
    fi
  else
    echo "  tier 2     : skipped — no CI expectation in the environment (scheduled run, or run by hand)"
  fi
else
  # Fail-OPEN only for the transition: a deploy from before this check has no
  # build-info.json. Once the first post-#69 deploy is confirmed live, flip
  # this to fail() — a missing file then means the publish step is broken.
  echo "  build-info : ABSENT (missing, or the SPA fallback answered with HTML) — this deploy predates the exact-hash check (ADR-046); tiers 1–2 skipped. Flip to fail-closed once a post-check deploy is live."
fi

if [ "$size" -lt "$MIN_WASM" ]; then
  fail "live wasm is ${size}B, under the ${MIN_WASM}B floor — that is the size of a FEATURELESS build"
fi
if [ "$size" -gt "$MAX_WASM" ]; then
  fail "live wasm is ${size}B, over the ${MAX_WASM}B ceiling — unexpected growth, check what landed"
fi

echo "SENTINEL PASS: live engine is real (${size}B, all exports present, sha256 ${live_sha:0:16}…)."
