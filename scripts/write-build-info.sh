#!/usr/bin/env bash
# Write <publish-dir>/build-info.json — the deployed bundle's own statement of
# what it is: which commit, which wasm (sha256 of the PUBLISHED asset, the
# file the browser actually fetches), and which toolchain produced it.
#
# WHY. The wasm build is reproducible per commit (ADR-045, ADR-038 correction):
# hold rustc, wasm-pack and binaryen constant and local == Netlify == CI, byte
# for byte. That makes an exact-hash assertion possible where only a size band
# was before. But "the expected hash" cannot be a constant stored anywhere —
# a seven-line COMMENT in ops.rs moved the binary by 5 bytes (#69: panic
# Locations embed line numbers). The expectation has to come from the same
# commit as the artifact it checks, and the only build that is guaranteed to
# be of the deployed commit is the deploy build itself. So the deploy writes
# its own expectation next to its own asset, and the sentinel reads both from
# the live site. No race with deploy lag: they cannot disagree about which
# commit they are.
#
# CI's independent build of the same commit is then a SECOND, stronger check
# (reproducibility across machines), compared only when the commits match.
#
# Usage: scripts/write-build-info.sh [publish-dir]   (default: www-dist)
# Run AFTER the frontend build, from the repo root. Tolerant of missing tools
# (records "unknown") — the sentinel's job is to compare, this script's job is
# to be honest about what it saw.
set -euo pipefail

PUB="${1:-www-dist}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

[ -d "$PUB" ] || { echo "write-build-info: publish dir '$PUB' not found — run the frontend build first" >&2; exit 1; }

# The served wasm: the hashed copy vite placed in assets/, not pkg/. They are
# byte-identical when the build is honest; hashing the PUBLISHED one is what
# lets the sentinel catch a stale or partially deployed asset.
wasm="$(ls "$PUB"/assets/stamp_tool_bg-*.wasm 2>/dev/null | head -1 || true)"
[ -n "$wasm" ] || { echo "write-build-info: no assets/stamp_tool_bg-*.wasm under $PUB" >&2; exit 1; }
n="$(ls "$PUB"/assets/stamp_tool_bg-*.wasm | wc -l)"
[ "$n" -eq 1 ] || { echo "write-build-info: expected exactly one published wasm, found $n" >&2; exit 1; }

commit="${COMMIT_REF:-${GITHUB_SHA:-$(git rev-parse HEAD 2>/dev/null || echo unknown)}}"
sha="$(sha256sum "$wasm" | cut -d' ' -f1)"
bytes="$(stat -c %s "$wasm")"
# Toolchain provenance comes from build-wasm.sh's record of what it ACTUALLY
# used — never re-derived here. The wrapper's PATH swap is local to its own
# process, so asking `command -v wasm-opt` from this shell reports the
# shadowed copy and writes a lie. (It did: 116 on a build made with 117.)
wo_v=unknown; wp_v=unknown; rustc_v=unknown; features=unknown
if [ -f pkg/.build-wasm.env ]; then
  # shellcheck disable=SC1091
  . pkg/.build-wasm.env
  wo_v="${IH_BUILD_WASM_OPT_VERSION:-unknown}"; wp_v="${IH_BUILD_WASM_PACK:-unknown}"
  rustc_v="${IH_BUILD_RUSTC:-unknown}"; features="${IH_BUILD_FEATURES-unknown}"
else
  echo "write-build-info: pkg/.build-wasm.env not found — was the engine built through scripts/build-wasm.sh? toolchain fields will read 'unknown'" >&2
fi

cat > "$PUB/build-info.json" <<JSON
{
  "commit": "$commit",
  "wasm_asset": "$(basename "$wasm")",
  "wasm_sha256": "$sha",
  "wasm_bytes": $bytes,
  "features": "${features}",
  "rustc": "$rustc_v",
  "wasm_pack": "$wp_v",
  "binaryen": "${wo_v}",
  "built_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
JSON
echo "write-build-info: $PUB/build-info.json  commit ${commit:0:7}  wasm ${sha:0:16}… ($bytes B)  rustc $rustc_v  wasm-pack $wp_v  binaryen $wo_v"
