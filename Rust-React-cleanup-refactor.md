# Rust · WASM · React — Cleanup & Refactor Playbook

Reusable reference for keeping **Image Horse** (`rust-wasm-photo-tool`) clean, and a
template for the next Rust+WASM+React project. Every section follows the same shape:
**one source of truth**, no magic values in components, a **DO-NOT** list of intentional
exceptions, a **guardrail** grep, and an **outstanding** backlog.

Run everything from the repo root in WSL: `~/repo/rust-wasm-photo-tool`
(Debian, user `clj`). Build to verify: `pnpm --filter stamp-tool build` for React,
`pnpm run build:wasm` for Rust. Don't `git push`/merge without asking.

Companion docs:
- `tailwind-cleaner.md` — colors/theme, z/shadow/radius/motion/layout tokens, typography (the design-token SSOT).
- This file — dependencies, React health, Rust/WASM health, responsive panels, a11y, **folder structure**.

> Markers: **[IH]** = Image-Horse-specific fact · **[generic]** = reuse on any Rust+WASM+React app.

---
---

# 0. The one rule  [generic]

Each fact lives in exactly one place:

| Fact | Single source |
|---|---|
| Dependency versions | pnpm **catalog** in `pnpm-workspace.yaml` |
| Colors / spacing / z / motion / type | `app/src/styles.css` tokens |
| Panel width / breakpoints | `app/src/lib/layout.ts` |
| Compiled WASM bundle | `./pkg` (built once, aliased in) |
| Image pixels | active `Layer.buf.data` in Rust |
| Original photo bytes | content-addressed (SHA-256) in `originalsStore` |

When the same value appears twice, that's the bug. File it under the matching section.

Repo map (4 deploy units, one workspace): `src/*.rs`→WASM core (`./pkg`) · `app/`→editor
(Netlify, `www-dist/`) · `marketing/`→site (Vercel) · `convex/`→backend.

---
---

# 1. Dependencies & build — single pnpm workspace  [generic]  *(applied on branch `chore/ssot-monorepo`)*

**Smell:** per-package `pnpm-workspace.yaml` + `pnpm-lock.yaml` + `node_modules`; drifting
versions; copy-pasted `overrides`; a root `package.json` with deps nothing imports; `app/pkg`
a tracked symlink into a gitignored dir.

**Steps:**
1. `git checkout -b chore/ssot-monorepo` (carry WIP, don't commit it).
2. Root `pnpm-workspace.yaml` = version SSOT:
   ```yaml
   packages: [app, marketing]
   catalog:                       # ONLY place shared versions are pinned
     react: ^19.0.0
     react-dom: ^19.0.0
     '@types/react': ^19.0.0
     '@types/react-dom': ^19.0.0
     '@vitejs/plugin-react': ^4.3.4
     vite: ^6.0.5
     typescript: ^5.7.2
     tailwindcss: ^4.0.6
     '@tailwindcss/vite': ^4.0.6
     convex: ^1.41.0
   overrides:
     js-cookie: '>=3.0.7'
     ws: '>=8.21.0'
     '@clerk/shared': '^3.47.7'   # CAP at the major clerk-react@5.x expects
   allowBuilds:
     esbuild: true
     tesseract.js: true
     '@swc/core': false
     '@clerk/shared': false
   ```
3. `git rm app/pnpm-workspace.yaml marketing/pnpm-workspace.yaml app/pnpm-lock.yaml marketing/pnpm-lock.yaml pnpm-lock.yaml`
4. Root `package.json` → orchestrator only; scripts delegate via `--filter`; keep just `"devDependencies": { "convex": "catalog:" }`.
5. `app/` + `marketing/` package.json → shared deps become `"catalog:"`; app-specific deps stay literal; drop marketing's local `pnpm` block.
6. WASM SSOT: `git rm app/pkg`; in `app/vite.config.ts` alias `stamp_tool` → `../pkg/stamp_tool.js`.
7. Deploy: `git rm vercel.json` (root stale; Vercel rooted at `marketing/`); `netlify.toml` installs at workspace root, builds `pnpm --filter stamp-tool build`.
8. `rm -rf node_modules app/node_modules marketing/node_modules && pnpm install`
9. Verify both builds.

**Gotcha:** `>=` in an override is not a floor, it's a free pass to the next major. `@clerk/shared:
'>=3.47.7'` resolved to `4.21.0` and broke the app (`"useClientContext" is not exported`). Cap to `^`.

**DO NOT** dedupe the three `public/` dirs — root=GitHub README, `marketing/public`=Vercel,
`app/public`=Netlify. Three serving contexts = three legit copies. [IH]

**Guardrail:**
```bash
rg -n '"(react|react-dom|vite|typescript|tailwindcss|@tailwindcss/vite|@vitejs/plugin-react|@types/react|@types/react-dom|convex)":\s*"\^?[0-9]' app/package.json marketing/package.json \
  && echo 'Use "catalog:" — versions live in pnpm-workspace.yaml' || echo 'clean'
```

---
---

# 2. React health  [generic patterns, [IH] line refs]

Clean folders, strong TS (`strict` + `noUnused*` + `noFallthroughCasesInSwitch`; only 2 `as any`).
Gaps are size, splitting, resilience, state-SSOT.

| # | Issue | File:line | Fix | Priority |
|---|---|---|---|---|
| R1 | **God component** (gallery, tools, compression, export, modals, undo, AI) | `app/src/app/AppShell.tsx` (~2511 lines) | Extract `useToolState`/`useCompressionState`/`useBulkExport`; lift modal state | CRITICAL |
| R2 | **No error boundary** — a render throw blanks the app | (none) | `components/ErrorBoundary.tsx`, wrap `<AppShell/>`, log via `diagnosticsLog` | HIGH |
| R3 | **Zero code-splitting** — one 2.16 MB chunk (gzip 467 KB) | build warning | lazy-load emoji-mart + heavy modals (below) | HIGH |
| R4 | **Gallery list not persisted per-change** — crash mid-op loses photo list | `AppShell.tsx` ~881 | `void saveGalleryManifest(next, activeId)` inside the `setPhotos` updater | HIGH |
| R5 | **Object-URL leak** in async compress callback | `hooks/useAutoCompress.ts:135` | create→use→revoke in `try/finally` | HIGH |
| R6 | Oversized multi-job hooks | `hooks/useEditPersistence.ts` (~369), `hooks/useCloneStamp.ts` (~1074) | split IDB vs Convex sync; isolate brush math | MEDIUM |
| R7 | `as any` | `hooks/useEditPersistence.ts:330`, `hooks/useRecentTexts.ts:42` | import the real type (`Id<"_storage">`, `PersistedText`) | LOW |

**Code-splitting (R3):** emoji-mart + `@emoji-mart/data` (huge, only StampSettings emoji mode) →
`React.lazy(() => import("@emoji-mart/react"))` behind `<Suspense>`, gated on mode. Lazy-load
animation-heavy modals (`ResumeDialog`, `ObjectRemovalModal`). `jszip` is *already*
`await import("jszip")` — copy that, don't regress. WASM (~900 KB) is correctly loaded via
`vite-plugin-wasm` + top-level-await; leave it.

**Conventions to honor [IH]:** custom DOM events (`"text-committed"`, `"red-stamp-select"`) decouple
overlays from React — own each listener in the hook that emits it, with cleanup. WASM pixel buffers
stay **ref-based** (`backbufferRef`) to avoid re-renders. Bytes are content-addressed by SHA-256 in
`originalsStore` (the bytes SSOT) — don't add a second cache.

**State-SSOT map:** React state=ephemeral UI · IndexedDB (`editPersistence`,`originalsStore`)=edits+
originals · localStorage (`preferences`)=prefs · Convex=prefs mirror (hash-guarded). Weak spot:
gallery manifest vs React state (R4).

**Guardrail:**
```bash
rg -n '\bas any\b' app/src -g '*.ts' -g '*.tsx' | grep -v '\.d\.ts'      # trend to 0
rg -n 'createObjectURL' app/src -g '*.tsx' -g '*.ts'                      # each needs a paired revoke
```

---
---

# 3. Rust / WASM health  [generic patterns, [IH] line refs]

Excellent baseline: **no `unwrap`/`expect`/`panic!`, no `unsafe`**; tuned release
(`opt-level=3`,`lto=true`,`codegen-units=1`); SIMD (`+simd128`). Errors surface to JS as
`false`/`None`/empty-`Vec`. Image SSOT = active `Layer.buf.data`; `composite_cache` ephemeral;
zero-copy blit via `data_ptr()`/`data_len()`. History snapshots the whole stack; text tiles
`Arc`-shared; blur/paint reuse scratch buffers + cached kernel; downsampling gamma-correct.

| # | Issue | File:line | Fix | Priority |
|---|---|---|---|---|
| W1 | **Unbounded alloc from JS sizes** | `lib.rs:56` (`blank_png`), `lib.rs:~1940` (`resize`) | `const MAX_DIM:u32=65536; let w=width.min(MAX_DIM);` | MEDIUM |
| W2 | **Size math without saturation** — `(w as usize)*(h as usize)*4` | `lib.rs:884` (+ ~1033, ~1073) | `.saturating_mul()` chain | LOW |
| W3 | **NaN in polygon sort** → undefined order | `drawing.rs:105` | filter NaNs before sort | LOW |
| W4 | **flood-fill tolerance unclamped** (magic wand) | `lib.rs:~1349` | clamp tolerance / cap fill area | LOW |
| W5 | **No `console_error_panic_hook`** | init | `console_error_panic_hook::set_once()` in `#[wasm_bindgen(start)]` | VERY LOW |
| W6 | **`lib.rs` ~4.3k lines, ~120 exports** | `lib.rs` | split (see §7) | REFACTOR |

**Convention [generic]:** every `#[wasm_bindgen]` entry that takes a JS dimension must
clamp/validate **before** allocating — WASM has no recoverable OOM. Keep the "no panics, return
`false`/empty" contract; if you ever need rich errors return `Result<_, JsValue>`, never `unwrap`.

**Guardrail:**
```bash
rg -n '\.unwrap\(\)|\.expect\(|panic!|unsafe ' src -g '*.rs'   # want 0 (drawing.rs:105 unwrap_or is the only allowed)
rg -n 'Vec::with_capacity|vec!\[0' src -g '*.rs'               # each needs a MAX_DIM clamp upstream
```

---
---

# 4. Responsive snapped side panels  [IH]

Docked panels (Tools left, Review right, Gallery bottom) are **fixed at `z-[var(--z-panel)]` (40)**;
`.main-content` + gallery bar **animate margins** (framer-motion) to dodge them. Layout SSOT =
`app/src/lib/layout.ts`: `SIDE_PANEL_WIDTH=260`, `PANEL_OPEN_GUTTER=284`, `BP_COMPACT=1000`,
`BP_TIGHT=1200`. One resize listener in `TopBar.tsx` (~76–86): `narrow=w<1000`;
`compact=narrow||(w<1200 && bothPanelsOpen)`. `GalleryBar`/`CanvasArea` use `ResizeObserver`.

| # | Issue | File:line | Fix | Priority |
|---|---|---|---|---|
| L1 | **Panel-width SSOT leak** — `260` in TS but hardcoded `260px` in CSS/JSX | `styles.css .review-panel`, `ToolsSidebar.tsx:203`, `layout.ts:10` | emit `--side-panel-width:260px` in `:root`; use `w-[var(--side-panel-width)]` everywhere | HIGH |
| L2 | **Magic offsets in emoji-grid mode** (`top:80/12`,`bottom:168/56`) | `AppShell.tsx:~2316` | derive from `--statusbar-h`/gallery height | MEDIUM |
| L3 | **No auto-fit-to-window** — big image overflows narrow window | `CanvasArea.tsx` | on load `zoom=min(cW/iW,cH/iH)` | MEDIUM |
| L4 | **No mobile/touch breakpoint** (260px ≈ half a phone) | `ToolsSidebar.tsx`,`styles.css` | `@media(max-width:640px)`: overlay (not push), bigger hit targets | MEDIUM |
| L5 | **Resize jank** (undebounced + queued anims) | `TopBar.tsx:76`,`AppShell.tsx:~2300` | debounce ~100ms or drive from a CSS var | LOW |
| L6 | **No "panels hidden" affordance** | `AppShell.tsx` | always-visible toggles + first-run hint | LOW |

**DO NOT** convert `z-10/20/30` *inside* a single thumbnail/tile — scoped contexts, not the ladder.

**Guardrail:**
```bash
rg -n '\b260px\b|w-\[260px\]|width:\s*260' app/src        # after L1: only layout.ts / :root
rg -n 'top:\s*\d{2,}|bottom:\s*\d{2,}' app/src/app/AppShell.tsx
```

---
---

# 5. Accessibility  [generic checklist, [IH] line refs]

Strong base: Radix Dialog (focus trap+Esc), native form controls, rich keyboard shortcuts
(`useKeyboardShortcuts.ts`, discoverable via `ShortcutModal`/Alt+/), global `:focus-visible`,
`prefers-reduced-motion`, AA token contrast. Gaps: labels, semantics, status announcements.

**Quick wins (~1–2 h):**
| # | Issue | File:line | Fix |
|---|---|---|---|
| A1 | Canvas unlabeled | `CanvasArea.tsx` | `aria-label="Photo editing canvas"`+`role="region"` |
| A2 | Gallery thumb `role=button` unnamed | `GalleryBar.tsx:113` | `aria-label={`Photo: ${entry.name}`}` |
| A3 | Icon buttons rely on `title` | `ToggleButtonGroup.tsx:53`,`ToolButton.tsx:20` | add `aria-label` |
| A4 | `ShortcutModal` lacks dialog semantics | `ShortcutModal.tsx:99` | `role="dialog" aria-modal aria-labelledby` |
| A5 | Form controls unlabeled | `SizeSlider.tsx`,`ColorSwatchGrid.tsx:83` | `id`+`<label htmlFor>`; `<fieldset><legend>` |
| A6 | Decorative overlay exposed | `MagnifierOverlay.tsx:50` | `aria-hidden="true"` |

**Medium (~½ day):** A7 add one `aria-live="polite" sr-only` region, push "Applied blur"/"Brush 25px"/
"AI done" into it (HIGH for SR). A8 confirm Sonner `Toaster` not `aria-hidden`. A9 custom `Modal.tsx`
needs `role/aria-modal/aria-labelledby`. A10 heading hierarchy + `<fieldset>` in tool-setting groups.

**Larger:** migrate `UploadDialog`/`ShortcutModal` to Radix; arrow-key nav within tool grid; real
NVDA/VoiceOver pass + Axe/WAVE.

**Guardrail:**
```bash
rg -n 'role="button"' app/src -g '*.tsx' | rg -v 'aria-label'
rg -n 'onClick' app/src -g '*.tsx' | rg '<div|<span'
```

---
---

# 6. Target folder structure — React (feature-first)  [generic blueprint]

**Principle:** organize by *feature*, not by *file kind*. A feature owns its components, hooks, and
local lib together; only truly cross-cutting code lives in `shared/`. The composition root (`app/`)
wires features together and holds nothing domain-specific.

## Current (kind-first — split across `components/`, `hooks/`, `lib/`)
```
app/src/
  app/        App.tsx · AppShell.tsx (2511 lines) · useKeyboardShortcuts.ts
  components/ ui/* · TopBar/* · StatusBar/* · *Pane.tsx · *Modal/Overlay · SizeSlider · ColorSwatchGrid · SubscriptionButton · UserMenu · ConvexClerkProvider …
  features/   tools/(+settings/) · canvas/ · gallery/ · upload/
  hooks/      use{Paint,Text,Emoji,RedStamp,Clone,Drawing,BrushPreview,ColorPicker,AIJob,AutoCompress,EditPersistence,IdleTimeout,StoreUser,UserColors,RecentTexts}…
  lib/        utils · format · colors · layout · types · animations · exif · editPersistence · workingCopy · originalsStore · preferences · galleryManifest …
```
Problem: a feature's pieces are scattered across 3 dirs; AppShell is a god component; "where does
this go?" has no rule.

## Target
```
app/src/
  main.tsx
  app/                         # composition root ONLY
    App.tsx
    ErrorBoundary.tsx          # R2
    providers/                 # ConvexClerkProvider, MotionConfig, Theme
    keyboard/useKeyboardShortcuts.ts
    shell/                     # the decomposed AppShell (R1)
      AppShell.tsx             # thin: layout + wiring (~300–400 lines)
      useGalleryState.ts · useToolState.ts · useCompressionState.ts · useBulkExport.ts
  features/
    canvas/                    # CanvasArea, SelectionOverlay, PenOverlay, CanvasGuidesOverlay, CompareSlider, MagnifierOverlay
      hooks/                   # useDrawingTools, useBrushPreview, useColorPicker
    tools/                     # ToolsSidebar, ToolGrid, ToolButton, toolConfig, settings/*
      hooks/                   # usePaintTool, useTextTool, useEmojiTool, useRedStampTool, useCloneStamp, useRecentTexts
    gallery/                   # GalleryBar, GridThumbnails + galleryManifest.ts
    review/                    # ReviewPanel, HistogramView, history/layers UI
    upload/                    # UploadDialog + useAutoCompress
    ai/                        # AISettings, ObjectRemovalModal, AIUsagePane + useAIJob
    account/                   # SubscriptionButton, UserMenu, SuperUserPane + tiers, superuser, useStoreUser
    preferences/               # *Pane.tsx (General/Appearance/Export/Storage/RulersGrids/Security) + preferences.ts, useTheme
  shared/
    ui/                        # design-system primitives (was components/ui): button, dialog, tooltip, context-menu, radio-cards, sonner, Modal, tiny-*, large-button, toggle-button-group …
    components/                # cross-feature chrome: TopBar/, StatusBar/, TabGroup, SizeSlider, ColorSwatchGrid, IdleOverlay, DiagnosticLogOverlay, ResourceMonitor, ImageMetaPanel, ShortcutModal
    hooks/                     # useIdleTimeout, useUserColors
    lib/                       # utils, format, colors, colorParser, layout, types, animations, exif, webPerf, diagnosticsLog, photoLimits, defaultToolSettings, pinLabel, resourceMonitor, testImages, gridGeometry, editPersistence, workingCopy, originalsStore, exportImage
    wasm/                      # stamp_tool wrapper — the SINGLE import site for the WASM module + the data_ptr/data_len blit helpers and stamp_tool.d.ts
  styles/styles.css            # token SSOT
```

**Why a `shared/wasm/` wrapper:** today components import `stamp_tool` directly via the Vite alias.
Funnel all WASM access through `shared/wasm/index.ts` so there's one place that owns init,
memory-view helpers, and the JS↔Rust contract. Mirrors the Rust `api/` facade in §7.

## Migration (incremental — aliases make it safe)
Vite already defines `@`, `@lib`, `@hooks`, `@features`, `@components`, `@app`. Move in feature-sized
PRs; update the alias map last.
1. Add `@shared` alias → `src/shared`. Create `shared/{ui,components,hooks,lib,wasm}`.
2. **Mechanical first:** `git mv components/ui/* shared/ui/`; move pure utils to `shared/lib/`. Fix imports with a codemod (below). Build green = commit.
3. **Per feature:** pull that feature's hooks out of `hooks/` and components out of `components/` into `features/<x>/`. One feature per PR. Build green each time.
4. **Decompose AppShell (R1)** into `app/shell/*` hooks — do this *after* the moves so the diff is pure extraction, not relocation.
5. Retire `@hooks`/`@components` aliases once empty; keep `@features`,`@app`,`@shared`,`@lib`.

Codemod for a move (GNU sed / WSL — review first):
```bash
# example: repoint old ui import path to @shared/ui after git mv
rg -l '@components/ui/' app/src | xargs sed -i 's#@components/ui/#@shared/ui/#g'
```

**Guardrail — keep the composition root thin & features decoupled:**
```bash
wc -l app/src/app/shell/AppShell.tsx          # target < 450
rg -n "@features/(\w+)/" app/src/features | awk -F/ '{print $0}' | rg -v "@features/$(…)"  # spot cross-feature imports → move shared code to shared/
```

---
---

# 7. Target folder structure — Rust (facade + engine)  [generic blueprint]

**Principle:** separate the **JS-facing API** (thin `#[wasm_bindgen]` facade, all input
validation/clamping lives here) from the **pure engine** (no `wasm_bindgen`, unit-testable on the
host). `lib.rs` becomes a table of contents, not a 4,300-line monolith.

## Current
```
src/
  lib.rs       ~4300 lines — ImageHorseTool struct + ~120 #[wasm_bindgen] methods + helpers (god module)
  core.rs      ImageBuffer + bilinear sampling
  codec.rs     PNG export / thumbnails
  drawing.rs · filters.rs · transform.rs · text.rs · stamp.rs · history.rs · settings.rs
  fonts/       LiberationSans-{Regular,Bold}.ttf
```

## Target
```
src/
  lib.rs                 # thin facade: pub use + the #[wasm_bindgen(start)] panic hook + re-export of the JS API
  api/                   # the ONLY place with #[wasm_bindgen]; validates/clamps JS inputs, then calls engine
    mod.rs               # ImageHorseTool struct + field decls; delegates to engine
    io.rs                # load_image / export PNG / thumbnails / data_ptr / data_len
    layers.rs            # add/remove/reorder/visibility/opacity
    paint.rs             # paint / blur / pixelate / redact stroke entry points
    annotations.rs       # text + shape + pin create/edit/commit (JSON in/out)
    transform.rs         # flip / rotate / crop / resize entry points
    selection.rs         # magic wand, marquee
    history.rs           # undo / redo / clear
  engine/                # pure Rust, NO wasm_bindgen, host-testable
    image_buffer.rs      # from core.rs (ImageBuffer, sampling)
    compositor.rs        # layer stack blend (blend_over, recomposite) — extracted from lib.rs
    paint_engine.rs      # paint/blur/pixelate/redact stroke state+math — extracted from lib.rs
    annotation_render.rs # text/shape tile building, pin rendering — extracted from lib.rs
    transform.rs · filters.rs · text.rs · stamp.rs   # moved, wasm-free
  history.rs             # snapshot model (already clean)
  geometry.rs            # shared math (from drawing.rs helpers)
  settings.rs            # constants incl. MAX_DIM (W1)
  fonts/
```

**The contract this enforces:**
- All clamping (W1/W4) and saturating math (W2) live in `api/` — the engine assumes valid inputs.
- The engine compiles & tests on the host (`cargo test`), not just `wasm32` — fast feedback, no browser.
- `lib.rs` shrinks to re-exports + `console_error_panic_hook::set_once()` (W5).

## Migration (compiler-guided, low risk)
1. Add `engine/mod.rs` + `api/mod.rs`; move `core.rs`→`engine/image_buffer.rs` (rename in `lib.rs`). Build.
2. **Extract by cut-and-fix:** lift the compositor functions out of `lib.rs` into `engine/compositor.rs`, make them free functions/`impl` on engine types, `pub use` back. The compiler lists every break — fix, build, commit. Repeat for `paint_engine`, `annotation_render`.
3. Split the `#[wasm_bindgen]` methods of `ImageHorseTool` into `api/*.rs` via `impl ImageHorseTool` blocks (Rust allows multiple `impl` blocks across files in the same module). Each method: clamp inputs → call engine.
4. Add `settings::MAX_DIM` and apply W1/W2/W4 in `api/`. Add the panic hook in `lib.rs` (W5).
5. Keep `wasm-pack build --target web --out-dir pkg` unchanged — output path is the SSOT.

**Guardrail — keep the facade thin and the engine pure:**
```bash
rg -n '#\[wasm_bindgen\]' src/engine && echo 'engine must be wasm-free!' || echo 'engine clean'
rg -c '#\[wasm_bindgen\]' src/api/*.rs           # the JS surface, all in one folder
wc -l src/lib.rs                                  # target < 200
rg -n '\.min\(MAX_DIM\)|saturating_mul' src/api   # input clamping lives in the facade
```

---
---

# 8. Design tokens — see `tailwind-cleaner.md`  [IH]

Don't duplicate it here. Summary: app chrome uses **semantic tokens** from `app/src/styles.css`
(`text-text-*`, `bg-*`, `border-border*`), never raw `bg-zinc-*`/`text-white`/hex. Type tokens go in
plain `@theme {}` (not `@theme inline {}`). Z/shadow/radius/motion/height tokens in `:root`. Each has
its own guardrail + DO-NOT list in that doc. **New link [L1]:** add `--side-panel-width` so layout.ts
and the panel CSS stop disagreeing.

---
---

# 9. Master punch-list (suggested order)

1. **R2** error boundary · **R4** persist manifest · **R5** URL leak — resilience, cheap, high value.
2. **L1** panel-width CSS var · **A1–A6** a11y quick wins — pure SSOT/labels, low risk.
3. **W1/W2/W4** clamp + saturate WASM size inputs · **W5** panic hook — safety.
4. **R3** code-split emoji-mart + heavy modals — ship size.
5. **A7** aria-live · **L3** auto-fit canvas · **L4** mobile breakpoint.
6. **Structure refactors (own PRs, no behavior change):** §6 React feature-first move → then **R1**
   AppShell decomposition; §7 Rust facade/engine split → covers **W6**, **R6**.
7. Token backlog (`tailwind-cleaner.md`): `SubscriptionButton`, `--shadow-modal`, `.label-caps`.

Rule for every item: small branch → run the section guardrail + the relevant build
(`pnpm --filter stamp-tool build`, and `pnpm run build:wasm` for Rust) → commit. Don't push without asking.

---
---

# 10. Reusable guardrail bundle  [generic]

Drop into `scripts/check.sh` and run before each commit. Exit non-zero on any leak.
```bash
#!/usr/bin/env bash
set -uo pipefail
fail=0
note(){ echo "✗ $1"; fail=1; }

# 1. version drift (catalog SSOT)
rg -q '"(react|react-dom|vite|typescript|tailwindcss|@tailwindcss/vite|@vitejs/plugin-react|@types/react|@types/react-dom|convex)":\s*"\^?[0-9]' app/package.json marketing/package.json && note "dep versions not via catalog:"

# 2. raw colors in app chrome
rg -q '\b(bg|text|border|ring)-(zinc|neutral|gray|slate|stone)-[0-9]{2,3}\b|\btext-white\b|\bbg-white\b' app/src \
  -g '!**/CanvasArea.tsx' -g '!**/PenOverlay.tsx' -g '!**/CompareSlider.tsx' \
  -g '!**/MagnifierOverlay.tsx' -g '!**/GalleryBar.tsx' -g '!**/lib/colors.ts' -g '!**/toolConfig.ts' \
  && note "raw colors — use semantic tokens"

# 3. panel-width SSOT leak
rg -q 'w-\[260px\]|width:\s*260' app/src && note "hardcoded 260px — use --side-panel-width"

# 4. React escape hatches
rg -q '\bas any\b' app/src -g '*.ts' -g '*.tsx' && note "as any present"

# 5. Rust panics / unsafe / wasm in engine
rg -q '\.unwrap\(\)|\.expect\(|panic!|unsafe ' src -g '*.rs' && note "rust panic/unsafe"
[ -d src/engine ] && rg -q '#\[wasm_bindgen\]' src/engine && note "wasm_bindgen leaked into engine/"

# 6. a11y: unnamed role=button
rg -n 'role="button"' app/src -g '*.tsx' | rg -vq 'aria-label' || true

exit $fail
```
