#!/usr/bin/env bash
# The ONE way to build the engine. package.json, netlify.toml and CI all call
# this, so the optimizer that rewrites the binary is checked in one place.
#
# WHY THIS EXISTS. rustc is pinned (rust-toolchain.toml, ADR-038) and wasm-pack
# is pinned (0.15.0, netlify.toml + ci.yml). The tool that is NOT pinned is
# `wasm-opt` — binaryen — which wasm-pack runs LAST and which rewrites every
# byte of the output. wasm-pack 0.15.0 fetches binaryen 117 into its cache and
# uses it… unless a `wasm-opt` is already on PATH, in which case PATH WINS,
# silently. Measured 2026-09-05 (ADR-045): binaryen 116 on this laptop vs 117
# on Netlify produced binaries differing in 456,523 byte positions whose sizes
# happened to land 3 B apart. It read as a rounding error for two ADRs.
#
# Hold the optimizer constant and local == deployed, byte for byte. So this
# script FAILS LOUDLY on any other optimizer. A warning is not enough — this
# class of drift reads as flake for hours.
#
# What "pinned" means here, since wasm-pack has no flag for it:
#   • wasm-pack must be exactly $WASM_PACK_VERSION (its fetched binaryen is a
#     function of its own version)
#   • if a `wasm-opt` is on PATH it must report exactly $WASM_OPT_VERSION;
#     if none is on PATH, wasm-pack fetches $WASM_OPT_VERSION itself — which
#     is what CI and Netlify do, and what every shipped binary was built with
#   • after the build, the artifact's mtime must have MOVED. A build that
#     exits non-zero can leave the previous pkg/ in place, and a stale
#     artifact reads as a passing result (it did, 2026-09-05).
set -euo pipefail

WASM_PACK_VERSION="0.15.0"
WASM_OPT_VERSION="117"
# Set IH_WASM_FEATURES="" for a feature-free build (CI); unset = the shipped set.
FEATURES="${IH_WASM_FEATURES-tiles,patchmatch}"
OUT="pkg"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

fail() { printf '\n\033[1;31m✗ build-wasm: %s\033[0m\n' "$*" >&2; exit 1; }
note() { printf '  %s\n' "$*"; }

# ── 1. wasm-pack itself ──────────────────────────────────────────────────────
command -v wasm-pack >/dev/null || fail "wasm-pack not found. Install the pinned one: cargo install wasm-pack --version $WASM_PACK_VERSION --locked"
wp="$(wasm-pack --version | awk '{print $2}')"
[ "$wp" = "$WASM_PACK_VERSION" ] || fail "wasm-pack is $wp, pinned is $WASM_PACK_VERSION.
  The binaryen it fetches is a function of its own version, so a different
  wasm-pack is a different optimizer. Fix: cargo install wasm-pack --version $WASM_PACK_VERSION --locked"
note "wasm-pack $wp"

# ── 2. the optimizer wasm-pack will actually use ────────────────────────────
# Self-heal first: if wasm-pack has ALREADY fetched binaryen $WASM_OPT_VERSION
# into its cache, put that exact binary first on PATH. It is byte-for-byte the
# one CI and Netlify run, so a foreign wasm-opt elsewhere on PATH is shadowed
# rather than rejected — loudly, below, so nobody is surprised. The cache
# layout is a wasm-pack internal; it is stable because wasm-pack is pinned.
# Version-checked after the swap, so a wrong cache entry still fails.
cache="${XDG_CACHE_HOME:-$HOME/.cache}/.wasm-pack"
for cand in "$cache"/wasm-opt-*/bin; do
  [ -x "$cand/wasm-opt" ] || continue
  cv="$("$cand/wasm-opt" --version 2>/dev/null | grep -oE 'version [0-9]+' | awk '{print $2}')"
  if [ "$cv" = "$WASM_OPT_VERSION" ]; then
    prev="$(command -v wasm-opt 2>/dev/null || true)"
    export PATH="$cand:$PATH"
    if [ -n "$prev" ] && [ "$prev" != "$cand/wasm-opt" ]; then
      printf '  \033[1;33m! shadowing %s (binaryen %s) with wasm-pack'"'"'s cached %s at %s\033[0m\n' \
        "$prev" "$("$prev" --version 2>/dev/null | grep -oE 'version [0-9]+' | awk '{print $2}')" \
        "$WASM_OPT_VERSION" "$cand/wasm-opt"
    fi
    break
  fi
done

if wo_path="$(command -v wasm-opt 2>/dev/null)"; then
  wo="$(wasm-opt --version 2>/dev/null | grep -oE 'version [0-9]+' | awk '{print $2}')"
  [ "$wo" = "$WASM_OPT_VERSION" ] || fail "a wasm-opt is on PATH and it is binaryen ${wo:-?}, not $WASM_OPT_VERSION.
  PATH WINS over the copy wasm-pack would fetch, so this build would not
  match production (ADR-045: 116 vs 117 = 456,523 differing bytes).
  Found at: $wo_path
  Fix, pick one:
    • remove it from PATH for this build:  PATH=\$(echo \"\$PATH\" | tr ':' '\\n' | grep -v \"\$(dirname $wo_path)\" | paste -sd:) $0
    • or install binaryen $WASM_OPT_VERSION in its place
    • or delete it and let wasm-pack fetch its own ($WASM_OPT_VERSION)"
  note "wasm-opt $wo on PATH ($wo_path) — matches pin"
else
  note "no wasm-opt on PATH — wasm-pack will fetch binaryen $WASM_OPT_VERSION (this is what CI and Netlify do)"
fi

# ── 3. no RUSTFLAGS in the environment ──────────────────────────────────────
# An env RUSTFLAGS REPLACES .cargo/config.toml's array rather than merging: it
# silently drops simd128 AND the path remaps, and the result is ~14 KB smaller
# — a "size win" that is a performance regression (see .cargo/config.toml).
[ -z "${RUSTFLAGS:-}" ] || fail "RUSTFLAGS is set in the environment (\"$RUSTFLAGS\").
  It REPLACES .cargo/config.toml's rustflags instead of merging, dropping
  simd128 and the --remap-path-prefix entries. Unset it; add flags in the
  config file instead."

# ── 4. build, then prove the artifact moved ─────────────────────────────────
# Nanosecond mtimes: two honest builds inside one wall-clock second would
# otherwise read as "not rewritten".
before="$(date -r "$OUT/stamp_tool_bg.wasm" +%s%N 2>/dev/null || echo 0)"
# CI builds FEATURE-FREE on purpose (ci.yml: the tiles/patchmatch surface is
# linted and tested there, not shipped from there). IH_WASM_FEATURES="" opts
# into that; an empty --features list is not the same as none, so omit it.
if [ -n "$FEATURES" ]; then
  wasm-pack build --target web --out-dir "$OUT" -- --features "$FEATURES"
else
  wasm-pack build --target web --out-dir "$OUT"
fi
after="$(date -r "$OUT/stamp_tool_bg.wasm" +%s%N 2>/dev/null || echo 0)"
[ "$after" -gt "$before" ] || fail "$OUT/stamp_tool_bg.wasm was not rewritten (mtime $before → $after).
  wasm-pack returned success but the artifact is the PREVIOUS build's. Do not
  trust any size or hash read from it."

size="$(stat -c %s "$OUT/stamp_tool_bg.wasm")"
sha="$(sha256sum "$OUT/stamp_tool_bg.wasm" | cut -c1-16)"
printf '\n\033[1;32m✓ build-wasm: %s B  sha256 %s…  features=%s\033[0m\n' "$size" "$sha" "${FEATURES:-<none>}"
