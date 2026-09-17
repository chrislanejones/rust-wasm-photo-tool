# #131 runtime fonts — what has to be decided before it merges

Written 2026-09-16 against master `34351cfa`; **§3 rewritten 2026-09-17**
against `2d4fd1dc` after reading the branch and measuring the live engine.
**Not a merge plan.**

#131 has been open since 09-11. It was blocked on three things — an ADR number
collision, a real rebase, and a design question. **The design question is now
answered by measurement** (§3), and the recommendation is written down. The
other two are still mechanical work waiting to be done.

## Where it stands

| | |
|---|---|
| PR | **#131** `feat/runtime-fonts` |
| Open since | 2026-09-11 |
| Size | **+2,808 / −288 across 50 files** |
| Behind master | **33 commits** |
| Mergeable | **CONFLICTING / DIRTY** |
| CI (on its own stale head) | 19 pass, 1 skipping |

It touches the engine (`src/fonts.rs`, `text.rs`, `annotations.rs`, `layer.rs`,
`history.rs`, `lib.rs`, `ops.rs`), ships **six Liberation TTFs** into
`app/public/fonts/`, and moves the sentinel band — see §3 for what that band
move actually pays for, which is not what the title implies.

---

## 1. The ADR number collides — mechanical, but do it first

#131 adds `docs/adr/053-fonts-arrive-at-runtime-and-the-sentinel-ceiling-moves-to-pay-for-it.md`.

Master already has a **different** ADR-053, from #130:
`053-a-shapes-perspective-is-normalised-over-its-bbox-and-its-tile-is-padded.md`.

Two documents cannot both be ADR-053. **Renumber #131's to 057** (054/055/056
are taken by Levels, Presets and PanelActionBar) and fix its `INDEX.md` row.
This is not a conflict resolution — resolving the INDEX conflict without
renumbering produces an index with two 053s in it.

---

## 2. `ops.rs` moved underneath it — real rebase work

#130 bumped the op log **v5 → v6** and added `Op::ShapePerspective`, and it
moved `oplog_sync_annotations`' diff out of `lib.rs` into
`ops::annotation_sync_ops`. #131 also edits `ops.rs`, `annotations.rs` and
`history.rs`, and was written against v5.

Nine of its files overlap master's changes since its base: `AppShell.tsx`,
`CanvasArea.tsx`, `stamp_tool.d.ts`, `engineAsyncMigration.contract.test.ts`,
`INDEX.md`, `File-Map.md`, `netlify.toml`, `deploy-sentinel.sh`,
`guardrails.sh`, plus the Rust four.

The `engineAsyncMigration` counter is the one to watch: it is cumulative and
three PRs have moved it tonight (Levels → 141, Presets → 144, perspective →
146). #131 will add its own converted sites on top, and the test is the oracle
for the final number — resolve it by arithmetic, then let the test confirm.

---

## 3. The question, answered by measurement — 2026-09-17

**The earlier draft of this section framed the choice as "runtime OR embedded"
and told the reader the PR was the only place the answer lived. Both halves
were wrong.** The PR was read, the branch was measured, and the live engine was
measured with the sentinel. What follows replaces that framing.

### Embedding is the status quo, not an option

`src/text.rs:13-14` on **master** already compiles two Liberation Sans faces
into the engine with `include_bytes!`. #131 keeps the **byte-identical blobs**
(verified by object hash, both `SAME BLOB`). So no decision moves the engine
from "no fonts" to "fonts" — it already has them.

| | Bytes |
|---|---|
| Live engine (`deploy-sentinel.sh`, 09-17, PASS) | **845,156** |
| Font data already inside it | **123,492** |
| Font share of the engine | **14.6%** |
| Ceiling (#160) | 860,000 |
| Headroom | 14,844 |
| Floor — the featureless-build detector | 800,000 |
| #131 sets `MAX_WASM` to | 872,000 (**+12,000** over today) |

⚠️ 872,000 was written when the ceiling was 840,000, so the branch asked for
+32,000 at the time. Against today's 860,000 the ask is +12,000. **The branch
has not been built, so #131's actual wasm size is still unmeasured** — the
figure above is what it requests, not what it needs.

### What #131 actually implements: both

It keeps the embedded pair as the always-available baseline AND adds
`register(font_id, bold, bytes)` so four more faces (Mono, Serif, each in
regular and bold) arrive from `app/public/fonts/` at runtime. That is why its
title says "runtime" while it also edits `deploy-sentinel.sh` — the two facts
never disagreed, they describe different halves of one design.

| Added to the branch | Size |
|---|---|
| Rust, across 8 files incl. a new 361-line `src/fonts.rs` | ~999 lines |
| Six Liberation TTFs as static assets | 181,928 B |
| **New font bytes inside the wasm** | **0** |

The size growth pays for registry code, not typefaces.

### The three options, with their real costs

**A — Runtime only, dropping the embedded pair**

| Benefit | Cost |
|---|---|
| Engine sheds ~123,492 B | Lands near **721,664 — under the 800,000 floor** |
| Adding a face never touches the band again | The floor is the featureless-build detector, and it STAYS at 800,000 (Chris, 09-15) |
| Faces cache separately from the engine | A 404 on a `.ttf` means no text renders at all, with no fallback |

Tripping the floor is the blocker. That detector exists because Netlify shipped
a featureless wasm for ten releases (v7.36–45) and nothing noticed.

**B — Embed all six**

| Benefit | Cost |
|---|---|
| Works offline, no fetch, no 404 path | **+120,000 to +246,000 B**, depending on which build |
| One code path, no registry | Ceiling moves by ~105,000 to ~231,000 |
| Nothing to precache in the service worker | Every future face costs band again, narrowing the detector each time |

**C — Hybrid, which is what the PR does**

| Benefit | Cost |
|---|---|
| Embedded pair guarantees text always renders | Two code paths to reason about |
| Extra faces cost **zero** wasm bytes | 181,928 B of TTF become assets to precache |
| Band ask is **+12,000**, not +105,000 | Registration is order-dependent: register before measure |
| Floor stays satisfied | A missing file silently narrows the dropdown |

### ⚠️ The finding that changes the arithmetic

The embedded and shipped copies of the same face are not the same build:

| | Embedded (`src/fonts`) | Shipped (`app/public/fonts`) |
|---|---|---|
| Size | 61,972 | **29,748** |
| Glyphs | 460 | **458** |
| `glyf` table | 53,752 | 25,120 |
| Hinting (`fpgm` / `prep`) | present | **absent** |

The engine rasterizes with **`ab_glyph`** (`Cargo.toml:51`, `text.rs:10`),
a pure outline rasterizer that never executes TrueType hinting bytecode. So
roughly **64,000 bytes** of the embedded pair is instruction data nothing runs,
for a difference of two glyphs.

That is over four times the headroom available now, and five times what #131
asks for. **Swapping the embedded pair for the unhinted build would likely let
#131 land with no ceiling move at all.**

### Recommendation

Take **C**, and swap the embedded pair to the unhinted build in the same
commit. Text still renders with nothing fetched, the engine stops carrying
bytecode `ab_glyph` ignores, and ADR-051's argument — that a font cannot be
embedded without moving this band — keeps failing loudly, because the band will
not have moved.

**Not yet verified**: the unhinted swap needs a visual check that rendered text
is unchanged. The comparison above is of tables and glyph counts, not pixels.

---

## 4. Also worth checking before it lands

- **ADR-051 says the selector is currently cosmetic** — `render_text` takes no
  font, and a grep for `font_family` across `src/*.rs` returns nothing. Three
  surfaces disagree today (box measured in Liberation, textarea in the selected
  font, commit in Liberation; monospace diverges +26.3%). #131 should close
  that, and the test that proves it is worth naming.
- **Registration is monotone, and order matters**: register before measure, or
  a measurement runs against a face that is not loaded yet.
- **Font bytes in IndexedDB are user data** → the `dexie-migration` skill
  applies if any of this persists per-user faces.
- **A malformed `.ttf` must not panic** — `try_from_slice` returns a `Result`
  and the engine's panic count is a guardrail baseline (47).
- **`netlify.toml` and `deploy-sentinel.sh`** both moved on master since #131
  was written; Netlify is the rollback path now, not the host.

---

## Recommended sequence

1. Chris confirms §3 — recommendation is hybrid + unhinted swap, measured.
2. Renumber the ADR to **057**, fix `INDEX.md`.
3. Merge master into the branch (not rebase — it is pushed), resolve the four
   Rust files and the async counter.
4. Rebuild the engine and re-run the sentinel. With the unhinted swap the
   ceiling may not need to move at all — measure before raising it, and if it
   does move, do it in the **same commit** with the reasoning written down, the
   way #160 did.
5. Full gates: `cargo fmt`, `clippy --all-targets` (no features — the
   documented trap), `cargo test --features tiles,patchmatch`, tsc, vitest,
   guardrails.

**Not tonight.** Three of those five steps are decisions or judgement calls,
and the budget is 11 of 14 master commits in 24 hours.
