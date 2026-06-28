# Saturday — Possibly-Good Updates

> **Do all of this in a new branch — do NOT touch `master`.**
>
> ```bash
> cd ~/repo/rust-wasm-photo-tool
> git switch -c busy-saturday
> ```
>
> Everything below is "possibly good." Verify each item against the *current* code
> before changing anything, build + smoke-test after each step, and only merge back
> to `master` once it's confirmed working. If an item turns out to already be done
> or to risk a regression, skip it and note why.

This guide distills a long Grok refactor transcript (`~/Downloads/Grok-kit.txt`) into
the parts that are *actually still worth doing* for this repo.

---

## ⚠️ Golden rules (read before doing anything)

The Grok transcript is a **scaffold, not a working refactor**. Almost every file it
"delivered" is a stub — real logic replaced by `// paste your full logic here`,
`vec![]`, or `const effectiveStamp = stamp` placeholders. It was also written against
an **older snapshot** of this project, so most of what it suggests is **already shipped**.

Therefore:

1. **Never paste Grok's code verbatim.** Its files would silently delete working
   paint/composite/blur/text-render/magic-wand logic and the real `effectiveStamp`
   routing. Move *existing* code; don't replace it with stubs.
2. **Do not remove any feature.** Every extraction must be behavior-preserving. If you
   can't prove a method is dead, keep it.
3. **Do not weaken security.** In particular, do not make auth/persistence "fail open."
   See the security note at the bottom.
4. **Verify-before-acting.** For every suggestion, `grep` the repo first. If it already
   exists, skip it.

---

## ✅ Already done — do NOT redo (Grok was on an old snapshot)

Grep-confirmed present in the current tree. **Skip all of these** — re-adding Grok's
versions would overwrite real implementations with stubs:

| Grok "suggestion" | Reality |
|---|---|
| Feature-folder frontend (`app/`, `features/{canvas,tools,gallery,upload}`, `lib/`, `hooks/`) | **Already the layout.** |
| Split Rust into modules (`core/stamp/text/transform/history/drawing/codec/filters/settings`) | **Already split.** (`src/*.rs`) |
| `useColorPicker`, `useUserColors`, `useRecentTexts`, `useIdleTimeout`, `useBreakpoint`, `useAutoCompress`, `useBrushPreview` | **All exist** in `app/src/hooks/`. |
| `MagnifierOverlay`, `ColorSwatchGrid`, `PlacementGrid`, `HistogramView`, `SelectionOverlay`, `CompareSlider`, `SecurityPane`, `ExportPane`, `ConvexClerkProvider` | **All exist** in `app/src/components/` & `features/`. |
| `useKeyboardShortcuts` (undo/redo/export/select-all/escape) | **Exists** (`app/src/app/useKeyboardShortcuts.ts`). |
| Typed `types.ts`, `preferences.ts`, `defaultToolSettings.ts`, EXIF (`lib/exif.ts`), diagnostics, resource monitor | **All exist.** |
| `willReadFrequently: true` on working-copy/batch 2D contexts | **Already set** (`workingCopy.ts`, `BatchSettings.tsx`). |
| Downscale oversized uploads (max-edge cap) | **Already done** (`workingCopy.ts`). |
| Pre-allocated scratch buffers + cached blur kernel (`composite_cache`, `blur_scratch_a/b`, `blur_kernel_cache`) | **Already on the struct** (`lib.rs:399-409`). |
| Region-scoped separable Gaussian blur (`gaussian_blur_region`) | **Already implemented** (`filters.rs:53`). |
| `adjust_brightness` / `adjust_contrast` / `calculate_histogram` / `magic_wand_select` | **Already implemented** (`filters.rs`, `lib.rs`). |

If the user asks "did you add the color picker / histogram / blur perf?" — the answer is
they already had it. Don't reimplement.

---

## 🟢 Genuinely worth doing — ranked

### 1. Add a WASM panic hook (smallest, safest, highest value)

**Gap:** grepping `panic_hook` / `console_error` in `src/lib.rs` and `Cargo.toml` returns
nothing. Right now a Rust panic in WASM surfaces as an opaque `unreachable` in the browser.

**Do:**
- `Cargo.toml` → add under `[dependencies]`:
  ```toml
  console_error_panic_hook = "0.1"
  ```
- In `src/lib.rs`, add and call once from the constructor / an `init`:
  ```rust
  pub fn init_panic_hook() {
      console_error_panic_hook::set_once();
  }
  ```
  Call `init_panic_hook()` at the top of `ImageHorseTool::new` (or wherever the JS side
  first instantiates the tool).

**Risk:** ~none. Additive. **Verify:** `wasm-pack build` succeeds; force a panic in dev
and confirm a readable stack trace in the console. Then remove the test panic.

---

### 2. Split `src/lib.rs` (4,750 lines, ~230 fns) — the real remaining monolith

This is the **one architectural item Grok got right that is still true.** Note `core.rs`
is only ~152 lines: the heavy `impl ImageHorseTool` still lives in `lib.rs`. The struct
already has the right field groupings, so extraction is mechanical.

**Approach — move, don't rewrite, one group at a time, building between each:**

- Pull cohesive `impl ImageHorseTool { ... }` method groups out of `lib.rs` into focused
  files using `impl` blocks in sibling modules (Rust allows multiple `impl` blocks for the
  same type across files in the same crate). Candidate extractions, by theme already
  visible in the code:
  - `brush.rs` — `paint_*`, `erase_*`, `mask_paint_*`, dab accumulation, stroke recomposite.
  - `adjustments.rs` — `adjust_brightness`, `adjust_contrast`, levels/curves if present.
  - `histogram.rs` — `calculate_histogram` (and luminance variant if present).
  - `selection.rs` — `magic_wand_select` and selection state.
  - `layers.rs` — `Layer` struct + mask methods + compositing helpers.
- Keep `lib.rs` as the thin `#[wasm_bindgen]` surface + small free helpers
  (`photo_limit`, `blank_png`, etc.).

**Hard rules for this step:**
- Move whole method bodies **unchanged**. Do not "clean up" logic in the same commit.
- After **each** extracted group: `wasm-pack build` must pass and the app must still paint.
- Make the wasm-bindgen export surface **identical** — the generated `pkg/` bindings and
  `app/src/hooks/stamp_tool.d.ts` must not change shape. If `stamp_tool.d.ts` would change,
  you've altered the public API — stop and reconsider.

**Risk:** medium (it's the core engine). Mitigate with tiny commits + build-after-each.
If it gets hairy, it's fine to land just `brush.rs` and stop.

---

### 3. Slim `app/src/app/AppShell.tsx` (2,938 lines)

Grok's instinct is right but its "~450-line" rewrite is a stub that drops the real
`effectiveStamp` routing. Do it the safe way: **extract, keep wiring intact.**

**Do (incrementally, app must run after each):**
- Lift self-contained chunks into hooks/components **without changing behavior**:
  - tool/mode state → a `useToolState`-style hook (only if not already partially extracted).
  - canvas mouse dispatch → a `useCanvasInteraction` hook, **preserving** the exact
    branch order (mask → eraser → blur → paint) and all the real args.
  - large JSX subtrees → existing/peer components under `features/`.
- The `effectiveStamp` routing logic is load-bearing — move it as a unit, do not replace
  it with `const effectiveStamp = stamp`.

**Risk:** medium (lots of props). Mitigate: extract one concern per commit, run the dev
server and click every tool after each. **Verify:** brush, eraser, blur, mask, text,
shapes, clone-stamp, crop, undo/redo all still work.

---

### 4. Optional cleanups (only if time remains — lowest priority)

- **Other large files** worth a *look* (not mandatory): `CanvasArea.tsx` (1,680),
  `BatchSettings.tsx` (1,199), `useCloneStamp.ts` (1,187). Same rule: extract, don't rewrite.
- **`@/` path alias consistency** — if some hooks still use relative `../lib/...` imports,
  normalize to `@/`. Purely cosmetic; zero behavior change. Confirm `tsconfig.json` +
  `vite.config.ts` already define the alias (they should). **Note:** the aliases are
  already defined (`@`, `@lib`, `@hooks`, `@features`, `@components`, `@app`), so at most
  this is "make every file use them."

---

## 🔵 More worth doing — found by auditing the actual code

The four items above came from the Grok transcript. The items below came from reading
*this* repo directly during Saturday prep. All are **safe/additive** — none remove a
feature or weaken security — and all are verified against the current code.

### 5. Add a CI workflow — the best safety net for this whole refactor

There is **no `.github/workflows/`**, yet this is a public repo that auto-deploys to
Netlify. A GitHub Actions job on PRs into `master` would catch exactly the regressions
the `lib.rs` and `AppShell` splits could introduce. **Do this first** so the rest of
Saturday is gated. Minimal job:

```yaml
# .github/workflows/ci.yml  (sketch — confirm runner + toolchain steps)
# Rust:   cargo test  &&  cargo clippy -- -D warnings  &&  cargo fmt --check
#         wasm-pack build --target web --out-dir pkg
# Front:  pnpm install  &&  pnpm -C app exec tsc --noEmit  &&  pnpm -C app build
```

**Risk:** none (additive). **Value:** highest — it makes every later step verifiable.

### 6. Add a typecheck gate (real gap)

`app` build is `vite build` only. Vite/esbuild **strips** types without checking them, so
a broken type ships silently to Netlify today. Add to `app/package.json`:

```json
"typecheck": "tsc --noEmit"
```

Run it in CI (item 5) and locally after the AppShell extraction (item 3). **Risk:** none.

### 7. Wire up clippy + rustfmt (no config today)

No clippy/rustfmt config exists. During the `lib.rs` split, `cargo clippy` is a free
correctness + simplification pass and will likely flag real things as code moves. Add a
`rustfmt.toml` (defaults are fine) and run `cargo fmt`. Keep clippy advisory if noisy at
first; tighten to `-D warnings` in CI once clean. (ESLint is *optional* — the frontend is
already clean; only add it if you want the gate.)

### 8. Add a top-level React error boundary (pairs with item 1)

There is **no error boundary anywhere** in `app/src`. For a WASM/canvas app, an unexpected
throw — or a Rust panic surfaced through the bindings — currently **white-screens the
entire UI**. Add an `ErrorBoundary` around `<AppShell />` (in `App.tsx`) that renders a
recovery card ("Something broke — reload") and logs the error (show the stack when
`import.meta.env.DEV`). Combined with item 1's panic hook you go from "blank page" to
"diagnosable + recoverable." **Risk:** none (additive).

### 9. Grow the Rust test suite *before* splitting `lib.rs` (de-risks item 2)

You already have ~26 Rust tests — good. But the core-engine move in item 2 is far safer
with **characterization tests on the pure functions that are about to relocate**:

- `filters` — blur / brightness / contrast on a tiny known pixel buffer.
- `transform` — resize / rotate / flip: assert output dimensions + a couple corner pixels.
- `codec` — encode → decode round-trip preserves dimensions and known pixels.
- `calculate_histogram` — known bucket counts for a hand-built buffer.

Write them first (on `busy-saturday`), confirm green, **then** move code. If one breaks
mid-split, you've proven the move wasn't behavior-preserving. This is the single biggest
safety multiplier for item 2.

### 10. Lazy-load the emoji picker (small, real bundle win)

`jszip` is **already** dynamically imported (`await import("jszip")` in `AppShell.tsx`) —
good. But `@emoji-mart/react` + `@emoji-mart/data` are **statically** imported in
`features/tools/settings/StampSettings.tsx`. `@emoji-mart/data` is a large JSON payload
that ships in the initial bundle even though the emoji stamp is a rarely-used sub-mode.
Convert it to `React.lazy` / dynamic `import()` so it loads only when the user opens the
emoji stamp. No `React.lazy` is used anywhere yet, so this also becomes the template for
any future code-split. **Risk:** low — confirm the picker still mounts on first open.

### 11. (optional) `rust-toolchain.toml` for reproducible builds

Pin the Rust toolchain so local and Netlify builds match exactly. One tiny file;
nice-to-have, not urgent.

---

## ✅ Audited and already fine — do NOT "fix" these

Checked during this pass; they're correct. Spending Saturday time here would be wasted:

- **Object URLs don't leak.** Every `createObjectURL` has a matching cache +
  `revokeObjectURL` with cleanup-on-unmount (`GridThumbnails`, `GalleryBar`,
  `ResumeContent`, `ResumeDialog`, `useAutoCompress`).
- **Rust is panic-clean.** Zero `unwrap()` / `expect()` / `panic!` / `unreachable!` /
  `unsafe` in `src/*.rs`. (Item 1's panic hook is still worth it for *unexpected* faults
  like out-of-bounds, but there's no sloppy unwrapping to clean up.)
- **No debug debt.** No stray `console.log`, no `TODO` / `FIXME` / `HACK` markers.
- **`jszip` is already code-split** via dynamic import.
- **Path aliases already exist** in `vite.config.ts` (`@`, `@lib`, `@hooks`, `@features`,
  `@components`, `@app`).
- **WASM is already tuned:** SIMD128 (`.cargo/config.toml`) + LTO + `opt-level=3` +
  `codegen-units=1` (`Cargo.toml`).

---

## Build & smoke-test commands

Confirm exact scripts in `package.json` / workspace before running — don't assume:

```bash
cd ~/repo/rust-wasm-photo-tool

# Rust / WASM
wasm-pack build            # (or the project's documented build cmd — check README)

# Frontend (pnpm workspace)
pnpm install
pnpm -C app dev            # run the dev server and manually click through tools
pnpm -C app build          # production build must pass
```

**Definition of done for any item:** `wasm-pack build` passes, `pnpm -C app build`
passes, dev server runs, and every editing tool still behaves as before.

---

## 🔒 Security notes (do NOT regress these)

The user explicitly asked: improve, but **don't break security**. Two things to watch —
flag them, don't "fix" them in a way that weakens posture:

- **Auth must not fail open.** Grok's `ConvexClerkProvider` returns `<>{children}</>` with
  only a `console.warn` when Convex/Clerk env vars are missing. If the current provider
  already gates on auth, **keep it gated** — do not adopt a fail-open path.
- **`stripExif` re-encode caveat.** If you touch EXIF-strip-on-export, note that
  re-encoding through a 2D canvas also drops the ICC color profile and can shift colors.
  That's a correctness footgun, not a reason to remove the privacy feature — leave the
  strip toggle intact.
- Keep filename sanitization, the MIME allowlist, and crypto-based IDs as-is.

---

## Suggested commit/PR shape

Small, themed commits so anything can be reverted independently. Ordered safety-first —
land the guardrails (CI, tests, typecheck) **before** the risky engine/UI splits:

1. `ci: add GitHub Actions (cargo test/clippy/fmt, wasm-pack, tsc, vite build)`  ← item 5
2. `chore: add typecheck script + rustfmt.toml`  ← items 6, 7
3. `test(rust): characterization tests for filters/transform/codec/histogram`  ← item 9
4. `feat(wasm): add console_error_panic_hook`  ← item 1
5. `feat(ui): top-level error boundary around AppShell`  ← item 8
6. `refactor(rust): extract brush methods from lib.rs into brush.rs`  ← item 2
7. `refactor(rust): extract adjustments/histogram/selection`  ← item 2
8. `refactor(ui): extract canvas interaction + tool state from AppShell`  ← item 3
9. `perf(ui): lazy-load emoji picker`  ← item 10
10. (optional) further extractions, `rust-toolchain.toml`  ← items 4, 11

Keep `busy-saturday` separate until the whole thing is verified, then ask the user before
merging to `master` (per their standing "always ask before merge" preference).
