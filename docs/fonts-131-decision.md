# #131 runtime fonts — what has to be decided before it merges

Written 2026-09-16 against master `34351cfa`. **Not a merge plan.** #131 has
been open since 09-11 and is now blocked on three things, only one of which is
a conflict. The other two are decisions.

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
`app/public/fonts/`, and moves the sentinel band.

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

## 3. ⚠️ The real question: the band moved tonight, for a different reason

#131's own title is *"fonts arrive at runtime and **the sentinel ceiling moves
to pay for it**"*.

The ceiling moved tonight, in #160 — but **not for fonts**:

| | Bytes |
|---|---|
| Old ceiling | 840,000 |
| **New ceiling** (#160) | **860,000** |
| Live engine | 845,156 |
| **Headroom** | **~14,800** |
| One Liberation TTF | **61,972** |

That headroom is **deliberately smaller than one font file**, and #160 says so
explicitly. ADR-051's finding — a font cannot be embedded without moving this
band — has to keep failing loudly, so #160 was careful not to pre-authorise
what #131 wants.

**So #131 needs the band moved again, on purpose this time.** That is the
decision, and it is Chris's:

| Option | Consequence |
|---|---|
| **Fonts load at runtime from `/fonts/*.ttf`** | wasm unchanged, band untouched — six TTFs become static assets, ~372 KB of downloads, and the engine gets `FontRef::try_from_slice` bytes it did not compile in |
| **Embed and raise the ceiling again** | every embedded face costs ~62 KB of band; the featureless detector's useful range narrows each time |
| **Ship the selector cosmetic** | status quo — the 12-entry dropdown that renders in Liberation regardless, which ADR-051 already calls a shipped vacuous control |

⚠️ Read the PR before assuming which one it implements. Its title says
"arrive at runtime", which points at option 1 — but it also edits
`deploy-sentinel.sh`, which only makes sense for option 2. Those two facts
disagree and the PR is the only place the answer is.

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

1. Chris answers §3 — runtime or embedded.
2. Renumber the ADR to **057**, fix `INDEX.md`.
3. Merge master into the branch (not rebase — it is pushed), resolve the four
   Rust files and the async counter.
4. Rebuild the engine and re-run the sentinel; if the answer was "embedded",
   move the ceiling in the **same commit** with the reasoning written down, the
   way #160 did.
5. Full gates: `cargo fmt`, `clippy --all-targets` (no features — the
   documented trap), `cargo test --features tiles,patchmatch`, tsc, vitest,
   guardrails.

**Not tonight.** Three of those five steps are decisions or judgement calls,
and the budget is 11 of 14 master commits in 24 hours.
