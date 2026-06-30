Master Cleanup & Refactor Playbook

> **Last updated:** 2026-06-28 · **Project:** Image Horse (`rust-wasm-photo-tool`)
> **Doc version:** 2.0 (bug fixes + CI integration + ratchet conventions)

Single self-contained reference for keeping **Image Horse** clean, and a template for the next
Tailwind + Rust + WASM + React project. Every section follows the same shape: **one source of
truth**, no magic values in components, a **DO-NOT** list of intentional exceptions, a **guardrail**
grep, and an **outstanding** backlog.

Run everything from the repo root in WSL: `~/repo/rust-wasm-photo-tool` (Debian, user `clj`).
Verify with `pnpm --filter stamp-tool build` (React) and `pnpm run build:wasm` (Rust).
Don't `git push`/merge without asking.

> Markers: **[IH]** = Image-Horse-specific fact · **[generic]** = reuse on any Tailwind+Rust+WASM+React app.

## Contents

0. [The one rule](#0-the-one-rule)
1. [Dependencies & build — single pnpm workspace](#1-dependencies--build--single-pnpm-workspace)
2. [Color & theme tokens](#2-color--theme-tokens)
3. [Layout tokens — z / shadow / radius / motion / heights](#3-layout-tokens--z-index--shadow--radius--motion--heights)
4. [Typography (+ reusable playbook)](#4-typography)
5. [React health](#5-react-health)
   - 5a. [Skeleton / loading-state SSOT](#5a-skeleton--loading-state-ssot-ih)
6. [Rust / WASM health](#6-rust--wasm-health)
7. [Responsive snapped side panels](#7-responsive-snapped-side-panels)
8. [Accessibility](#8-accessibility)
9. [Target folder structure — React](#9-target-folder-structure--react-feature-first)
10. [Target folder structure — Rust](#10-target-folder-structure--rust-facade--engine)
11. [Master punch-list](#11-master-punch-list-suggested-order)
12. [Reusable guardrail bundle](#12-reusable-guardrail-bundle)
13. [Doc conventions (ratchet, whitelist, retirement)](#13-doc-conventions)

---

---

# 0. The one rule [generic]

Each fact lives in exactly one place:

| Fact                                 | Single source                                        |
| ------------------------------------ | ---------------------------------------------------- |
| Dependency versions                  | pnpm **catalog** in `pnpm-workspace.yaml`            |
| Colors / spacing / z / motion / type | `app/src/styles.css` tokens                          |
| Panel width / breakpoints            | `app/src/lib/layout.ts`                              |
| Compiled WASM bundle                 | `./pkg` (built once, aliased in)                     |
| Image pixels                         | active `Layer.buf.data` in Rust                      |
| Original photo bytes                 | content-addressed (SHA-256) in `originalsStore`      |
| `wasm-bindgen` version               | `Cargo.toml` is canonical; `package.json` must match |

When the same value appears twice, that's the bug. File it under the matching section.

Repo map (4 deploy units, one workspace): `src/*.rs`→WASM core (`./pkg`) · `app/`→editor
(Netlify, `www-dist/`) · `marketing/`→site (Vercel) · `convex/`→backend.

---

---

# 1. Dependencies & build — single pnpm workspace [generic] _(applied on branch `chore/ssot-monorepo`)_

**Smell:** per-package `pnpm-workspace.yaml` + `pnpm-lock.yaml` + `node_modules`; drifting
versions; copy-pasted `overrides`; a root `package.json` with deps nothing imports; `app/pkg`
a tracked symlink into a gitignored dir.

**Steps:**

1. `git checkout -b chore/ssot-monorepo` (carry WIP, don't commit it).
2. Root `pnpm-workspace.yaml` = version SSOT:
   ```yaml
   packages: [app, marketing]
   catalog: # ONLY place shared versions are pinned
     react: ^19.0.0
     react-dom: ^19.0.0
     "@types/react": ^19.0.0
     "@types/react-dom": ^19.0.0
     "@vitejs/plugin-react": ^4.3.4
     vite: ^6.0.5
     typescript: ^5.7.2
     tailwindcss: ^4.0.6
     "@tailwindcss/vite": ^4.0.6
     convex: ^1.41.0
   overrides:
     js-cookie: ">=3.0.7"
     ws: ">=8.21.0"
     "@clerk/shared": "^3.47.7" # CAP at the major clerk-react@5.x expects
   allowBuilds:
     esbuild: true
     tesseract.js: true
     "@swc/core": false
     "@clerk/shared": false
   ```
3. `git rm app/pnpm-workspace.yaml marketing/pnpm-workspace.yaml app/pnpm-lock.yaml marketing/pnpm-lock.yaml pnpm-lock.yaml`
4. Root `package.json` → orchestrator only; scripts delegate via `--filter`; keep just `"devDependencies": { "convex": "catalog:" }`.
5. `app/` + `marketing/` package.json → shared deps become `"catalog:"`; app-specific deps stay literal; drop marketing's local `pnpm` block.
6. WASM SSOT: `git rm app/pkg`; in `app/vite.config.ts` alias `stamp_tool` → `../pkg/stamp_tool.js`.
7. Deploy: **KEEP** the root `vercel.json` — it pins Vercel to `build:marketing` → `marketing/dist`. Do NOT delete it: the Root-Directory-only approach is unreliable, and without the root config Vercel runs the repo-root `pnpm build` (the app) and fails on the gitignored WASM `pkg/`; `netlify.toml` installs at workspace root, builds `pnpm --filter stamp-tool build`.
8. `rm -rf node_modules app/node_modules marketing/node_modules && pnpm install`
9. Verify both builds.

**Gotcha:** `>=` in an override is not a floor, it's a free pass to the next major. `@clerk/shared:
'>=3.47.7'` resolved to `4.21.0` and broke the app (`"useClientContext" is not exported`). Cap to `^`.

**Cross-platform hygiene.** WSL + Windows checkouts can introduce `\r\n` line endings into `*.sh`,
turning your guardrails into silent no-ops. Add at the repo root:

```
# .gitattributes
* text=auto eol=lf
*.sh text eol=lf
*.bat text eol=crlf
```

An `.editorconfig` with `end_of_line = lf` and `indent_style = space` pairs nicely.

**CI flag.** After the new root lockfile is committed, all CI installs MUST use `--frozen-lockfile`
to catch silent drift. Local dev uses default (mutable).

**DO NOT** dedupe the three `public/` dirs — root=GitHub README, `marketing/public`=Vercel,
`app/public`=Netlify. Three serving contexts = three legit copies. [IH]

**Guardrail:**

```bash
# Shared deps must use catalog:
rg -n '"(react|react-dom|vite|typescript|tailwindcss|@tailwindcss/vite|@vitejs/plugin-react|@types/react|@types/react-dom|convex)":\s*"\^?[0-9]' app/package.json marketing/package.json \
  && echo 'Use "catalog:" — versions live in pnpm-workspace.yaml' || echo 'clean'

# Overrides must not use >= (auto-promotes to next major)
rg -n '"[<>]=' pnpm-workspace.yaml && echo 'overrides: use ^ not >=' || echo 'clean'

# wasm-bindgen drift between Rust and JS (Cargo is canonical)
cargo_v=$(rg -oN 'wasm-bindgen\s*=\s*"=?([0-9.]+)"' Cargo.toml -r '$1' | head -1)
js_v=$(rg -oN '"wasm-bindgen":\s*"=?([0-9.]+)"' app/package.json -r '$1' | head -1)
[ -n "$cargo_v" ] && [ -n "$js_v" ] && [ "$cargo_v" != "$js_v" ] \
  && echo "drift: cargo=$cargo_v js=$js_v" || echo 'clean'
```

---

---

# 2. Color & theme tokens [IH conventions, generic method]

Reference for keeping the app on its **semantic design tokens** so light/dark/system theming keeps
working. The token source of truth is `app/src/styles.css` (`:root` = light, `.dark` = dark, mapped
to Tailwind via `@theme inline`).

> **Rule of thumb:** app _chrome_ never uses raw Tailwind color utilities (`bg-zinc-*`, `text-white`,
> `text-emerald-*`, hex/rgb in `className`). It uses the semantic tokens below, which flip per theme
> automatically.

## Semantic token utilities (use these)

**Text:** `text-text-primary` (brightest) · `text-text-secondary` (mid) · `text-text-muted` (dim) ·
`text-foreground` / `text-muted-foreground` (shadcn equivalents) · `text-primary` (warm brand accent —
cream on dark, **tan on light**) · `text-destructive` · `text-success` · `text-warning`.

**Backgrounds:** `bg-background` (app) · `bg-card` (panel/elevated) · `bg-muted` (subtle fill) ·
`bg-bg-elevated` (inputs) · `bg-secondary` · `bg-accent` (hover) · `bg-destructive`/`bg-success`/`bg-warning` ·
`bg-bg-primary` / `bg-bg-secondary` / `bg-bg-tertiary`.

**Borders / ring:** `border-border` (default) · `border-border-active` (selected) · `border-input` · `ring-ring`.

**`theme-*` aliases** (tool-settings panels): `text-theme-foreground`, `text-theme-primary`,
`bg-theme-muted`, `border-theme-sidebar-border`, etc. — all resolve to the tokens above.

## Raw → token mapping (what the sweep applied)

| Raw utility                                    | Token                           |
| ---------------------------------------------- | ------------------------------- |
| `text-white`, `text-zinc-50/100/200`           | `text-text-primary`             |
| `text-zinc-300/400`                            | `text-text-secondary`           |
| `text-zinc-500/600`                            | `text-text-muted`               |
| `bg-white`                                     | `bg-card`                       |
| `bg-zinc-900/950`, solid `bg-black`            | `bg-background`                 |
| `bg-zinc-800`                                  | `bg-card`                       |
| `bg-zinc-700/600`                              | `bg-bg-elevated`                |
| `bg-zinc-200/100`                              | `bg-muted`                      |
| `border-zinc-*` / `gray` / `neutral` / `slate` | `border-border`                 |
| `text-emerald-*` / `green-*`                   | `text-success` (same for `bg-`) |
| `text-red-*` / `rose-*`                        | `text-destructive`              |
| `text-amber-*` / `yellow-*` / `orange-*`       | `text-warning`                  |

Preserve opacity suffixes: `text-zinc-400/70` → `text-text-muted/70`.

## DO NOT convert (intentionally static — read over the photo or are content/brand colors)

- **Over-photo overlays:** `bg-black/<n>` / `bg-white/<n>` scrims and modal/dialog backdrops
  (CompareSlider, MagnifierOverlay, GalleryBar badges, Modal, dialog, ShortcutModal, UploadDialog preview).
- **SVG overlay elements** in `CanvasArea` (crop mask, marquee, drag handles) and `PenOverlay` anchor
  handles (`#5af`/`#fff`/`#000`).
- **Saturated brand / category / severity colors:** `bg-purple-600` AI buttons **(keep `text-white`)**,
  `ring-orange-400` selection rings, `bg-orange-500` badges, `blue`=CONVEX_DB / `violet`=REPLICATE_AI
  severity, `sky` links.
- **`text-white` on a brand gradient** (e.g. active `ToolButton`) — converting makes the label dark-on-bright in light mode.
- **Content/data palettes:** `lib/colors.ts`, `lib/defaultToolSettings.ts`, `StampSettings` presets,
  `toolConfig.ts` gradients, `public/Image-Horse-Logo.svg`.

## Inline whitelist tag (preferred over file excludes)

Use a comment at the use site instead of growing the guardrail's `-g '!**/file.tsx'` list:

```tsx
<button className="text-white bg-gradient-to-r from-purple-600 to-pink-600">
  {/* allow: raw-color (gradient button — semantic primary disappears) */}
  AI Restore
</button>
```

The guardrail strips lines matching `allow: raw-color` before flagging. Benefits: self-documenting at
the use site, survives file renames, and the exclude list stops being a graveyard. See §13.

## Gotchas

- **Light accent ≠ dark accent.** Dark uses cream `#fcdfc2`; light uses deeper tan `#c98f3f` for
  `--accent`/`--primary`/`--ring`/`--border-active`. Cream is illegible on light as text/thin line/slider thumb.
- **Don't blanket `text-white` → `text-text-primary`.** On a saturated/gradient button the label must
  stay `text-white`; `text-text-primary` is dark in light mode and disappears.
- Native range sliders: thumb = `var(--accent)`, track = `var(--bg-tertiary)`.

## Guardrail (whitelist-tag aware)

```bash
# Strip allow-tagged lines first, then look for raw colors in app chrome
rg -n '\b(bg|text|border|ring)-(zinc|neutral|gray|slate|stone)-[0-9]{2,3}\b|\btext-white\b|\bbg-white\b' app/src \
  -g '!**/CanvasArea.tsx' -g '!**/PenOverlay.tsx' -g '!**/CompareSlider.tsx' \
  -g '!**/MagnifierOverlay.tsx' -g '!**/GalleryBar.tsx' -g '!**/lib/colors.ts' -g '!**/toolConfig.ts' \
  | rg -v 'allow: raw-color' \
  | (grep . && echo 'Use semantic tokens, not raw colors' || echo 'clean')
```

(Marketing site `/marketing` is out of scope — leave it alone.)

**Outstanding:** `SubscriptionButton.tsx` still has ~12 raw color utils (WIP file during migration;
run the mapping once stable, then **drop it from the exclude list** — that's the ratchet).

---

---

# 3. Layout tokens — z-index / shadow / radius / motion / heights [IH]

Same idea as color: **one source**, no magic numbers in components. All in `app/src/styles.css :root`
(theme-independent). Use `var(--…)` in CSS and the arbitrary-value form `z-[var(--z-modal)]` /
`bottom-[var(--panel-bottom)]` in JSX.

## Z-index ladder — the stacking single source

No more "+1 to win". Every app-level overlay maps to a rung:

```
--z-canvas: 1          canvas / pen-overlay base
--z-canvas-overlay: 10 in-canvas loaders & badges
--z-compare: 20        compare-slider handle, NEW pill
--z-topbar: 30         floating top bar
--z-panel: 40          Tools / Gallery / Review panels + status bar
--z-dialog: 50         dialogs, dropdowns, tooltips, magnifier
--z-modal: 60          modals (above dialogs)
--z-progress: 100      top load-progress bar
--z-idle: 200          full-screen idle overlay
--z-cursor: 1000       brush cursor / source marker (defensive against vendor overlays)
```

JSX: `className="… z-[var(--z-modal)]"`. CSS: `z-index: var(--z-panel)`.
**Exception:** leave local micro-stacks alone — `z-10/20/30` _inside_ a single thumbnail or canvas
tile are scoped stacking contexts, not part of the global ladder.

## Shadow

`--shadow-sm/-md/-lg` (generic elevation) · `--shadow-panel` (floating side-panel/sidebar elevation —
Tools + Review; don't re-inline `0 4px 24px …`). **Leave:** one-off/dynamic shadows (CompareSlider
handle glow, StampSettings shadow tinted by stamp color).

## Radius

`--radius` (6px → `rounded-md`) · `--radius-lg` (10px → `rounded-lg`) · `--radius-sm` (4px → `rounded-sm`).
In CSS use `var(--radius*)`. `rounded-full` (circles) and large `rounded-xl/2xl` surfaces are intentional — leave.

## Motion

`--dur-fast:.1s · --dur-base:.15s · --dur-slow:.2s · --dur-slower:.3s` + `--ease-standard`. Reference
these in new transitions instead of magic seconds.

**Pair with `prefers-reduced-motion`.** Every non-trivial transition/animation should be inside (or
adjacent to) a `@media (prefers-reduced-motion: reduce)` override that zeroes durations. Guardrail
under §12 flags any transition/animation rule that isn't accompanied by such a block in the same file.

## Layout heights

`--statusbar-h:36px` · `--statusbar-gap:12px` · `--panel-bottom:calc(var(--statusbar-h)+var(--statusbar-gap))`
(=48px). The status bar, its reserved space, and both side panels' bottom offset derive from these —
change the bar height in one place. Window breakpoints + panel widths live in `app/src/lib/layout.ts`
(`SIDE_PANEL_WIDTH`, `BP_COMPACT`, `BP_TIGHT`).

## Outstanding

- **`shadow-2xl`** (×8 on modals) still Tailwind built-in → add `--shadow-modal` and swap.
- **Motion duration migration not bulk-done** — `--dur-*` exist, but ~20 scattered `transition: … 0.15s`
  literals in `styles.css` weren't swapped (a blanket find/replace would also rewrite the token defs).
  Do it with line-scoped edits below `:root`.
- **`2px/3px/8px`** radius literals have no exact token — left as-is.
- Tailwind `rounded-*`/`duration-*` utilities in JSX are already on Tailwind's scale; not worth rewriting.
- **[L1 link]** add `--side-panel-width` so `layout.ts` and the panel CSS stop disagreeing (see §7).

## Guardrail — catch new magic numbers

```bash
rg -n 'z-index:\s*[0-9]' app/src/styles.css            # should only be .photo-thumb
rg -n '\bz-(10|20|30|40|50|60|100)\b|\bz-\[[0-9]' app/src -g '*.tsx' \
  -g '!**/GalleryBar.tsx' -g '!**/AppShell.tsx'        # rest should be z-[var(--z-*)]

# prefers-reduced-motion: any transition/animation rule with no matching reduce block in same file
for f in $(rg -l 'transition:|animation:' app/src/styles.css); do
  rg -q 'prefers-reduced-motion' "$f" || echo "missing reduced-motion guard: $f"
done
```

---

---

# 4. Typography [IH conventions]

Collapse scattered, hand-tuned font values into **one scale**. Tokens in `app/src/styles.css`.
Scope = **UI chrome only** — never the in-canvas text-tool size/weight (domain data) or WASM font files.

## 🚨 The `@theme` trap — read this first

Put type tokens in a **plain `@theme {}`** block, **not** `@theme inline {}` (the color block). Plain
`@theme` emits `--text-*` as real `:root` custom properties **and** generates the `.text-*` utilities —
so both `text-2xs` (JSX) and `var(--text-2xs)` (raw CSS / `.label-caps`) resolve.

**`@theme inline` inlines the value at compile time and does NOT emit the `--text-*` var**, silently
breaking any raw-CSS that references it. Build will succeed; visual will quietly regress.

Verify by `grep '--text-2xs:' www-dist/assets/*.css` — must return at least one match.

## The scale (use these)

6 size steps + 5 weight files + 3 leading tokens. Only the display end is fluid.

| Token       | Size    | Notes                                                |
| ----------- | ------- | ---------------------------------------------------- |
| `text-2xs`  | 10px    | collapses the old `8/9/10/11px` band                 |
| `text-xs`   | 12px    | = Tailwind v4 default                                |
| `text-sm`   | 14px    |                                                      |
| `text-base` | 16px    |                                                      |
| `text-lg`   | 17→20px | **fluid** `clamp(1.0625rem, 1rem + 0.3vw, 1.25rem)`  |
| `text-2xl`  | 20→28px | **fluid** `clamp(1.25rem, 1.1rem + 0.75vw, 1.75rem)` |

**Line heights** (paired tokens — don't hand-tune per component):

| Token              | Value | Use for                        |
| ------------------ | ----- | ------------------------------ |
| `--leading-tight`  | 1.15  | display, single-line labels    |
| `--leading-normal` | 1.4   | body, panel text               |
| `--leading-loose`  | 1.6   | help text, multi-line tooltips |

Weights: DM Sans **400/600/700**, JetBrains Mono **400/600** (no 500, no faux 900).
`font-medium`→`font-semibold`, `font-black`→`font-bold`. `.label-caps` = the recurring uppercase-mono
caption (`font-mono` + `text-2xs` + `600` + `--tracking-label` 0.06em + uppercase).

## Raw → token mapping

| Raw                                           | Token                          |
| --------------------------------------------- | ------------------------------ |
| `text-[8/9/10/11px]`, CSS `font-size: 8–11px` | `text-2xs` / `var(--text-2xs)` |
| CSS `font-size: 12px`                         | `var(--text-xs)`               |
| CSS `font-size: 13/14px`                      | `var(--text-sm)`               |
| `font-medium` (500)                           | `font-semibold`                |
| `font-black` (faux 900)                       | `font-bold`                    |
| `line-height: 1.1–1.2`                        | `var(--leading-tight)`         |
| `line-height: 1.4–1.5`                        | `var(--leading-normal)`        |

## DO NOT convert

- **In-canvas text tool:** `toolSettings.fontSize/fontWeight/fontFamily`, `defaultToolSettings.ts`
  (`fontSize: 24`), `recent_texts`, `CanvasArea`'s `'Liberation Sans', Arial, …` default — text **drawn
  into the image**, not UI; family must match the WASM font.
- **WASM font files:** `src/fonts/LiberationSans-{Regular,Bold}.ttf` (Rust/ab_glyph render on-image text/emoji).

## Gotchas

- **Dropping weight 500 is a design call** — bolds body-emphasis everywhere. Reversible (revert the
  `font-medium` sed + restore `;500` in `index.html`).
- **SVG `fontSize` is a number prop, not a class** — `rg 'text-\[…px\]'` misses it.
- **px→token rounding shifts real sizes** (11→10, 13→14); always do a visual walk of dense panels:
  ImageMetaPanel, ResourceMonitor, EffectsSettings, ShapeSettings, ArrowSettings, DiagnosticLogOverlay.

## Outstanding

- `features/canvas/CanvasGuidesOverlay.tsx` — SVG ruler/grid labels hardcode `fontSize={9}` ×2; bump
  to `10` to match `text-2xs` (`fontFamily="var(--font-mono)"` there is already correct).
- `.label-caps` not yet applied — ~10 inline uppercase-mono labels still spell it out (ImageMetaPanel,
  ResourceMonitor, EffectsSettings, ShapeSettings, ArrowSettings, AISettings, Modal,
  DiagnosticLogOverlay, AppShell, StampSettings). Swap by hand, keeping each site's `text-*` color.
- `StampSettings.tsx` — `tracking-[0.15em]` off-token; inline `fontFamily:'"Arial Black","Impact",…'`
  hardcoded system font for a preview glyph. Decide keep vs tokenize.

## Reusable typography playbook (any Tailwind v4 app) [generic]

**1. Inventory sweep**

```bash
rg -oN 'text-\[[0-9.]+px\]' src -g '*.tsx' -g '*.ts' | sort | uniq -c | sort -rn
rg -oN 'text-(xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)\b' src -g '*.tsx' -g '*.ts' | sort | uniq -c
rg -oN 'font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)' src -g '*.tsx' | sort | uniq -c
rg -nN 'fontSize|fontWeight|fontFamily' src -g '*.tsx' -g '*.ts'      # HIDDEN: inline JS + SVG attrs bypass Tailwind
rg -nN 'font-size:\s*[0-9.]+px' src --glob '*.css' | sort
rg -nN 'font-weight:\s*(500|900)' src --glob '*.css'
rg -nN 'line-height:\s*[0-9.]+' src --glob '*.css'
rg -nN 'font|woff|preload|preconnect' index.html
```

**2. Define once (plain `@theme` — NOT `@theme inline`)**

```css
@theme {
  --text-2xs: 0.625rem;
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: clamp(1.0625rem, 1rem + 0.3vw, 1.25rem);
  --text-2xl: clamp(1.25rem, 1.1rem + 0.75vw, 1.75rem);
  --leading-tight: 1.15;
  --leading-normal: 1.4;
  --leading-loose: 1.6;
  --tracking-label: 0.06em;
}
.label-caps {
  font-family: var(--font-mono);
  font-size: var(--text-2xs);
  font-weight: 600;
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
}
```

**3. Codemod (GNU sed / WSL — review inventory first)**

```bash
sed -i -E 's/font-size:[[:space:]]*(8|9|10|11)px/font-size: var(--text-2xs)/g;
           s/font-size:[[:space:]]*12px/font-size: var(--text-xs)/g;
           s/font-size:[[:space:]]*(13|14)px/font-size: var(--text-sm)/g' src/styles.css
rg -l 'text-\[(9|10|11)px\]' src -g '*.tsx' -g '*.ts' | xargs sed -i -E 's/text-\[(9|10|11)px\]/text-2xs/g'
rg -l 'font-medium|font-black' src -g '*.tsx' | xargs sed -i -E 's/\bfont-medium\b/font-semibold/g; s/\bfont-black\b/font-bold/g'
```

**4. Verify (build, then grep the OUTPUT css)**

```bash
pnpm run build
CSS=$(ls -t www-dist/assets/*.css | head -1)
grep -c -- '--text-2xs:' "$CSS"          # >=1 → @theme emitted the var (not inline-trapped)
grep -o  '\.text-2xs{[^}]*}' "$CSS"      # .text-2xs{font-size:var(--text-2xs)}
grep -c  'clamp(' "$CSS"                  # fluid lg/2xl present
grep -c -- '--leading-tight:' "$CSS"     # leading tokens emitted
```

Then a manual visual walk of dense panels.

---

---

# 5. React health [generic patterns, IH line refs]

Clean folders, strong TS (`strict` + `noUnused*` + `noFallthroughCasesInSwitch`; only 2 `as any`).
Gaps: size, splitting, resilience, state-SSOT.

| #   | Issue                                                                     | File:line                                                              | Fix                                                                                 | Priority |
| --- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------- |
| R1  | **God component** (gallery, tools, compression, export, modals, undo, AI) | `app/src/app/AppShell.tsx` (~2511 lines)                               | extract `useToolState`/`useCompressionState`/`useBulkExport`; lift modal state      | CRITICAL |
| R2  | **No error boundary** — render throw blanks the app                       | (none)                                                                 | per-feature boundaries (canvas, modals, ai), not one root; log via `diagnosticsLog` | HIGH     |
| R3  | **Zero code-splitting** — one 2.16 MB chunk (gzip 467 KB)                 | build warning                                                          | lazy-load + Vite `manualChunks` for vendor isolation                                | HIGH     |
| R4  | **Gallery list not persisted per-change** — crash mid-op loses list       | `AppShell.tsx` ~881                                                    | `void saveGalleryManifest(next, activeId)` inside the `setPhotos` updater           | HIGH     |
| R5  | **Object-URL leak** in async compress callback                            | `hooks/useAutoCompress.ts:135`                                         | create→use→revoke in `try/finally` (or `useEffect` cleanup for non-async paths)     | HIGH     |
| R6  | Oversized multi-job hooks                                                 | `hooks/useEditPersistence.ts` (~369), `hooks/useCloneStamp.ts` (~1074) | split IDB vs Convex sync; isolate brush math                                        | MEDIUM   |
| R7  | `as any`                                                                  | `hooks/useEditPersistence.ts:330`, `hooks/useRecentTexts.ts:42`        | import real type (`Id<"_storage">`, `PersistedText`)                                | LOW      |
| R8  | **No bundle-size guardrail** despite known 2.16 MB problem                | (CI)                                                                   | `size-limit` or simple `du` check in `check.sh` — fail > 2.5 MB main chunk          | MEDIUM   |

**Per-feature error boundaries (R2).** A canvas render throw shouldn't blank the modal stack and vice
versa. Wrap each feature root (`<Canvas/>`, `<Tools/>`, `<Modals/>`, `<AI/>`) in its own boundary;
fallbacks degrade gracefully (e.g., canvas crash → "Canvas error, your photo is safe — refresh to retry").

**Code-splitting (R3):** two complementary strategies.

1. **`React.lazy` for gated UI:** emoji-mart + `@emoji-mart/data` (huge, only StampSettings emoji mode) →
   `React.lazy(() => import("@emoji-mart/react"))` behind `<Suspense>`. Lazy-load
   animation-heavy modals (`ResumeDialog`, `ObjectRemovalModal`). `jszip` is _already_
   `await import("jszip")` — copy that pattern.
2. **Vite `manualChunks` for deterministic vendor splits:** in `vite.config.ts`:
   ```ts
   build: { rollupOptions: { output: { manualChunks: {
     'vendor-react': ['react', 'react-dom'],
     'vendor-emoji': ['@emoji-mart/data', '@emoji-mart/react'],
     'vendor-motion': ['framer-motion'],
     // wasm stays in its own chunk via vite-plugin-wasm; do NOT add it here
   }}}}
   ```
   Splits vendors at build time so they cache across deploys.

WASM (~900 KB) correctly loaded via `vite-plugin-wasm` + top-level-await; leave it.

**Bundle-size ratchet (R8):** start the threshold at _current size + 5%_, tighten as you cut. Check
goes in `check.sh` so it runs in CI on every PR.

**Conventions to honor [IH]:** custom DOM events (`"text-committed"`, `"red-stamp-select"`) decouple
overlays from React — own each listener in the hook that emits it, with cleanup. WASM pixel buffers
stay **ref-based** (`backbufferRef`). Bytes content-addressed by SHA-256 in `originalsStore` (bytes
SSOT) — no second cache.

**State-SSOT map:** React=ephemeral UI · IndexedDB (`editPersistence`,`originalsStore`)=edits+originals ·
localStorage (`preferences`)=prefs · Convex=prefs mirror (hash-guarded). Weak spot: gallery manifest
vs React state (R4).

**Guardrail:**

```bash
rg -n '\bas any\b' app/src -g '*.ts' -g '*.tsx' | grep -v '\.d\.ts'
rg -n 'createObjectURL' app/src -g '*.tsx' -g '*.ts'     # each needs a paired revoke

# bundle-size ratchet (after build)
size=$(du -b www-dist/assets/index-*.js 2>/dev/null | sort -rn | head -1 | cut -f1)
[ "${size:-0}" -gt 2500000 ] && echo "main chunk > 2.5 MB ($size bytes)"
```

---

---

# 5a. Skeleton / loading-state SSOT [IH]

Same idea as color/type: **one source of truth for "this content isn't ready yet" UI**, modelled on
[Chakra UI's Skeleton](https://chakra-ui.com/docs/components/skeleton). No more scattered bespoke
`Loading…` text nodes, ad-hoc `animate-pulse` placeholder blocks, or the `.canvas-spinner` doing
double duty as a content placeholder.

**Three coordinated definition sites:**

| Concern                          | Single source                                                          |
| -------------------------------- | ---------------------------------------------------------------------- |
| Component primitive + public API | `app/src/components/ui/skeleton.tsx`                                    |
| Shared base class constant       | `app/src/lib/styles.ts` — `SKELETON_BASE = "skeleton block bg-muted"`  |
| Shimmer machinery + a11y/motion  | `app/src/styles.css` — `.skeleton` + `@keyframes skeleton-shimmer`     |

`SKELETON_BASE` mirrors the existing `HOVER_RING` SSOT convention in `lib/styles.ts`: the base surface
colour is the **`bg-muted` semantic token** (§2 — no raw colours), so the placeholder re-themes with
the palette. The `.skeleton` class layers a clipped shimmer sweep (`::after`) on top and degrades to a
static muted block under `prefers-reduced-motion` / `html.reduce-motion` (§3). The component is an
`aria-busy` live region announcing "Loading" to screen readers (§8).

> **Rule:** no raw loading-placeholder UI in app chrome — use `<Skeleton>` / `<SkeletonText>` /
> `<SkeletonCircle>`. Sizing is className-driven (`h-*` / `w-*` / `size-*`); `variant` only picks the
> shape. Flip skeleton ⇄ real content from one boolean with `loading={false}` (renders `children`).

## Public API (terse)

- **`<Skeleton>`** — `loading?: boolean` (default `true`; `loading={false}` renders `children`),
  `variant?: "rectangle" | "circle" | "text"` (default `rectangle`), + all `div` attrs. Renders
  `role="status" aria-busy aria-live="polite"` with an sr-only "Loading…".
- **`<SkeletonText>`** — `noOfLines?: number` (alias `lines?`, default `3`; final line shortened to
  `w-3/5` when multi-line), `loading?`, `lineClassName?`. Same live-region semantics; the inner bars
  are `aria-hidden`.
- **`<SkeletonCircle>`** — `size?: number | string` (px number or any CSS length; falls back to
  className sizing), `loading?`. A `variant="circle"` `Skeleton` with `aspect-square`.

## Raw → primitive mapping

| Raw placeholder pattern                                  | Primitive                                  |
| ------------------------------------------------------- | ------------------------------------------ |
| bespoke `>Loading…<` text node (content not ready)      | `<Skeleton>` / `<SkeletonText>`            |
| `animate-pulse` placeholder block / bar                 | `<Skeleton>` (sized via className)         |
| multi-line text placeholder                             | `<SkeletonText noOfLines={n}>`             |
| circular avatar / round-thumbnail placeholder           | `<SkeletonCircle size={n}>`                |
| `.canvas-spinner` used as a **content** placeholder     | `<Skeleton>` reserving the layout footprint |

## DO NOT convert (the one intentional exception)

- **In-button progress spinners** — `Loader2 animate-spin` inside a button/action ("Saving…",
  "Removing…", "Uploading…"). These signal **action progress**, not a content placeholder, and must
  stay. Skeletons reserve layout for content that is about to arrive; spinners report that an
  in-flight operation is running. Different jobs — don't merge them.
- The `.canvas-spinner` keyframe itself stays for genuine in-canvas progress; only its use as a
  layout-reservation placeholder migrates to `<Skeleton>`.

## Outstanding

**Migrated (the representative slice):**

- `features/gallery/GalleryBar.tsx` — thumbnail loading.
- `components/ShareViewer.tsx` — shared-image loading.
- `components/SubscriptionButton.tsx` — Plan & Billing loading.

**Follow-up (still raw placeholder / spinner-as-placeholder — migrate, then drop from the guardrail
exclude per §13 ratchet):** `UploadDialog.tsx`, `NewActions.tsx`, `FirstRunScreen.tsx`,
`features/canvas/CanvasArea.tsx` (`.canvas-spinner`), `AISettings.tsx`, `ObjectRemovalModal.tsx`,
`BatchSettings.tsx`, `ShareButton.tsx`, `ImageMetaPanel.tsx`, `BrandRevealScreen.tsx`, `AppShell.tsx`.

## Guardrail — ad-hoc loading placeholders in app chrome

```bash
# Flags bespoke "Loading…" text nodes and animate-pulse placeholders that should
# be <Skeleton>. Excludes the skeleton primitive itself and its sr-only label;
# strips in-button progress spinners (Loader2 / animate-spin) — action progress
# is NOT a content placeholder (see DO NOT, above).
rg -n '>\s*Loading[.…]|\banimate-pulse\b' app/src -g '*.tsx' \
  -g '!**/ui/skeleton.tsx' \
  | rg -v 'Loader2|animate-spin|sr-only|allow: raw-loading' \
  | (grep . && echo 'Use <Skeleton>/<SkeletonText>/<SkeletonCircle> for content placeholders' || echo 'clean')
```

(Marketing site `/marketing` is out of scope. Mark deliberate exceptions inline with
`{/* allow: raw-loading (reason) */}` per §13.)

---

---

# 6. Rust / WASM health [generic patterns, IH line refs]

Excellent baseline: **no `unwrap`/`expect`/`panic!`, no `unsafe`**; tuned release
(`opt-level=3`,`lto=true`,`codegen-units=1`); SIMD (`+simd128`). Errors surface to JS as
`false`/`None`/empty-`Vec`. Image SSOT = active `Layer.buf.data`; `composite_cache` ephemeral;
zero-copy blit via `data_ptr()`/`data_len()`. History snapshots whole stack; text tiles `Arc`-shared;
blur/paint reuse scratch buffers + cached kernel; downsampling gamma-correct.

| #   | Issue                                                             | File:line                                            | Fix                                                                                     | Priority                                      |
| --- | ----------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------- |
| W5  | **No `console_error_panic_hook`**                                 | init                                                 | `console_error_panic_hook::set_once()` in `#[wasm_bindgen(start)]` — 1 line, invaluable | **HIGH** (promoted: free + huge debug payoff) |
| W1  | **Unbounded alloc from JS sizes**                                 | `lib.rs:56` (`blank_png`), `lib.rs:~1940` (`resize`) | `const MAX_DIM:u32=65536; let w=width.min(MAX_DIM);`                                    | MEDIUM                                        |
| W2  | **Size math without saturation** — `(w as usize)*(h as usize)*4`  | `lib.rs:884` (+ ~1033, ~1073)                        | `(w as usize).saturating_mul(h as usize).saturating_mul(4)`                             | LOW                                           |
| W3  | **NaN in polygon sort** → undefined order                         | `drawing.rs:105`                                     | `pts.sort_by(\|a,b\| a.partial_cmp(b).unwrap_or(Ordering::Equal))` or `f32::total_cmp`  | LOW                                           |
| W4  | **flood-fill tolerance unclamped** (magic wand)                   | `lib.rs:~1349`                                       | clamp tolerance / cap fill area                                                         | LOW                                           |
| W6  | **`lib.rs` ~4.3k lines, ~120 exports**                            | `lib.rs`                                             | split (see §10)                                                                         | REFACTOR                                      |
| W7  | **No host-side `cargo test`** — engine math only runs on `wasm32` | (none)                                               | once §10 lands, `cargo test --lib` runs on host with no `wasm-bindgen` deps             | MEDIUM                                        |

**Convention [generic]:** every `#[wasm_bindgen]` entry taking a JS dimension must clamp/validate
**before** allocating — WASM has no recoverable OOM. Keep "no panics, return `false`/empty"; if you
need rich errors return `Result<_, JsValue>`, never `unwrap`.

**Engine error type (forward-looking, see §10).** When the engine is extracted, expose a real
`EngineError` enum (variants like `Oom`, `InvalidDims`, `OutOfBounds`) rather than `bool`/`Option`.
The `api/` facade maps it to `JsValue` at the boundary. This is the only way engine code is
genuinely host-testable for failure modes.

**Guardrail:**

```bash
rg -n '\.unwrap\(\)|\.expect\(|panic!|unsafe ' src -g '*.rs'   # want 0 (drawing.rs:105 unwrap_or is allowed)
rg -n 'Vec::with_capacity|vec!\s*\[\s*0' src -g '*.rs'         # each needs a MAX_DIM clamp upstream

# Once §10 lands: engine must be wasm-free + host-testable
[ -d src/engine ] && rg -q '#\[wasm_bindgen\]' src/engine && echo 'wasm_bindgen leaked into engine/'
[ -d src/engine ] && (cd "$(git rev-parse --show-toplevel)" && cargo test --lib --quiet 2>&1 | tail -5)
```

---

---

# 7. Responsive snapped side panels [IH]

Docked panels (Tools left, Review right, Gallery bottom) are **fixed at `z-[var(--z-panel)]` (40)**;
`.main-content` + gallery bar **animate margins** (framer-motion) to dodge them. Layout SSOT =
`app/src/lib/layout.ts`: `SIDE_PANEL_WIDTH=260`, `PANEL_OPEN_GUTTER=284`, `BP_COMPACT=1000`,
`BP_TIGHT=1200`. One resize listener in `TopBar.tsx` (~76–86): `narrow=w<1000`;
`compact=narrow||(w<1200 && bothPanelsOpen)`. `GalleryBar`/`CanvasArea` use `ResizeObserver`.

| #   | Issue                                                                    | File:line                                                          | Fix                                                                                                                          | Priority |
| --- | ------------------------------------------------------------------------ | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | -------- |
| L1  | **Panel-width SSOT leak** — `260` in TS but hardcoded `260px` in CSS/JSX | `styles.css .review-panel`, `ToolsSidebar.tsx:203`, `layout.ts:10` | emit `--side-panel-width:260px` in `:root`; use `w-[var(--side-panel-width)]` everywhere                                     | HIGH     |
| L2  | **Magic offsets in emoji-grid mode** (`top:80/12`,`bottom:168/56`)       | `AppShell.tsx:~2316`                                               | derive from `--statusbar-h`/gallery height                                                                                   | MEDIUM   |
| L3  | **No auto-fit-to-window** — big image overflows narrow window            | `CanvasArea.tsx`                                                   | on load `zoom=min(cW/iW,cH/iH)`                                                                                              | MEDIUM   |
| L4  | **No mobile/touch breakpoint** (260px ≈ half a phone)                    | `ToolsSidebar.tsx`,`styles.css`                                    | `@media(max-width:640px)`: overlay (not push), bigger hit targets, **use `dvh` not `vh`** for canvas height (mobile URL bar) | MEDIUM   |
| L5  | **Resize jank** (undebounced + queued anims)                             | `TopBar.tsx:76`,`AppShell.tsx:~2300`                               | debounce ~100ms or drive from a CSS var                                                                                      | LOW      |
| L6  | **No "panels hidden" affordance**                                        | `AppShell.tsx`                                                     | always-visible toggles + first-run hint                                                                                      | LOW      |

**Mobile viewport units (L4 detail).** `100vh` jumps when mobile Safari/Chrome's URL bar hides/shows
— canvas resizes mid-gesture. Use `100dvh` (dynamic) for the canvas fill; `100svh` (smallest) for
fixed UI like the toolbar so it never overflows when chrome is visible. `lvh` (largest) is rarely
what you want.

**DO NOT** convert `z-10/20/30` _inside_ a single thumbnail/tile — scoped contexts, not the ladder.

**Behavior by width:** `<1000` narrow (TopBar drops Undo/Redo, shows zoom%) · `1000–1200` both panels
open → compact (zoom% hidden) · `>1200` full. No auto-collapse — user toggles via Alt+T/R/G.

**Guardrail:**

```bash
rg -n '\b260px\b|w-\[260px\]|width:\s*260' app/src        # after L1: only layout.ts / :root
rg -n 'top:\s*\d{2,}|bottom:\s*\d{2,}' app/src/app/AppShell.tsx
rg -n '100vh\b' app/src                                    # consider dvh/svh for mobile
```

---

---

# 8. Accessibility [generic checklist, IH line refs]

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
| **A7** | **No `aria-live` for status** — SR users miss "Applied blur", "AI done", brush size | (none) | one `aria-live="polite" sr-only` region in AppShell; push from any toast/status emitter. **Promoted to Quick Wins — HIGH leverage for SR users, ~30 min** |

**Medium (~½ day):** A8 confirm Sonner `Toaster` not `aria-hidden`. A9 custom `Modal.tsx`
needs `role/aria-modal/aria-labelledby`. A10 heading hierarchy + `<fieldset>` in tool-setting groups.

**Larger:** migrate `UploadDialog`/`ShortcutModal` to Radix; arrow-key nav within tool grid; real
NVDA/VoiceOver pass + Axe/WAVE.

**Guardrail (FIXED — was a no-op in v1):**

```bash
# role=button without aria-label
unnamed=$(rg -n 'role="button"' app/src -g '*.tsx' | rg -v 'aria-label' || true)
[ -n "$unnamed" ] && echo "role=button without aria-label:" && echo "$unnamed" | head

# Click handlers on non-interactive elements
rg -n '<(div|span)[^>]*onClick' app/src -g '*.tsx' | head

# img without alt
rg -n '<img[^>]*>' app/src -g '*.tsx' | rg -v 'alt=' | head
```

---

---

# 9. Target folder structure — React (feature-first) [generic blueprint]

**Principle:** organize by _feature_, not by _file kind_. A feature owns its components, hooks, and
local lib together; only truly cross-cutting code lives in `shared/`. The composition root (`app/`)
wires features and holds nothing domain-specific.

## Current (kind-first — scattered across `components/`, `hooks/`, `lib/`)

```
app/src/
  app/        App.tsx · AppShell.tsx (2511 lines) · useKeyboardShortcuts.ts
  components/ ui/* · TopBar/* · StatusBar/* · *Pane.tsx · *Modal/Overlay · SizeSlider · ColorSwatchGrid · SubscriptionButton · UserMenu · ConvexClerkProvider …
  features/   tools/(+settings/) · canvas/ · gallery/ · upload/
  hooks/      use{Paint,Text,Emoji,RedStamp,Clone,Drawing,BrushPreview,ColorPicker,AIJob,AutoCompress,EditPersistence,IdleTimeout,StoreUser,UserColors,RecentTexts}…
  lib/        utils · format · colors · layout · types · animations · exif · editPersistence · workingCopy · originalsStore · preferences · galleryManifest …
```

Problem: a feature's pieces span 3 dirs; AppShell is a god component; "where does this go?" has no rule.

## Target

```
app/src/
  main.tsx
  app/                         # composition root ONLY
    App.tsx
    ErrorBoundary.tsx          # R2 — and per-feature wrappers below
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
    ui/                        # design-system primitives (was components/ui)
    components/                # cross-feature chrome: TopBar/, StatusBar/, TabGroup, SizeSlider, ColorSwatchGrid, IdleOverlay, DiagnosticLogOverlay, ResourceMonitor, ImageMetaPanel, ShortcutModal
    hooks/                     # useIdleTimeout, useUserColors
    lib/                       # utils, format, colors, colorParser, layout, types, animations, exif, webPerf, diagnosticsLog, photoLimits, defaultToolSettings, pinLabel, resourceMonitor, testImages, gridGeometry, editPersistence, workingCopy, originalsStore, exportImage
    wasm/                      # stamp_tool wrapper — the SINGLE import site for the WASM module + blit helpers + stamp_tool.d.ts
  styles/styles.css            # token SSOT
```

**Why `shared/wasm/`:** today components import `stamp_tool` directly via the Vite alias. Funnel all
WASM access through `shared/wasm/index.ts` so one place owns init, memory-view helpers, and the JS↔Rust
contract. Mirrors the Rust `api/` facade in §10.

**Barrel files (`index.ts`).** Use them sparingly — they encourage accidental coupling and tank
tree-shaking visibility. Rule: each feature exposes one `index.ts` listing its public surface; do not
create barrels inside `hooks/` or `lib/` subdirs (import the leaf file directly).

## Migration (incremental — aliases make it safe)

Vite already defines `@`, `@lib`, `@hooks`, `@features`, `@components`, `@app`. Move in feature-sized PRs; update aliases last.

1. Add `@shared` → `src/shared`. Create `shared/{ui,components,hooks,lib,wasm}`.
2. **Mechanical first:** `git mv components/ui/* shared/ui/`; move pure utils to `shared/lib/`. Codemod imports. Build green = commit.
3. **Per feature:** pull that feature's hooks/components out of `hooks/`+`components/` into `features/<x>/`. One feature per PR.
4. **Decompose AppShell (R1)** into `app/shell/*` _after_ the moves so the diff is pure extraction.
5. Retire empty `@hooks`/`@components` aliases; keep `@features`,`@app`,`@shared`,`@lib`.

Codemod example (GNU sed / WSL — review first):

```bash
rg -l '@components/ui/' app/src | xargs sed -i 's#@components/ui/#@shared/ui/#g'
```

> macOS BSD sed needs `-i ''` (empty arg) — guardrail/codemods in this doc assume GNU sed (WSL/Linux).

**Guardrail — thin root, decoupled features:**

```bash
wc -l app/src/app/shell/AppShell.tsx          # target < 450
rg -n "@features/" app/src/features            # cross-feature imports → move shared code to shared/
```

---

---

# 10. Target folder structure — Rust (facade + engine) [generic blueprint]

**Principle:** separate the **JS-facing API** (thin `#[wasm_bindgen]` facade — all input
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
  lib.rs                 # thin facade: pub use + #[wasm_bindgen(start)] panic hook + re-export of JS API
  api/                   # the ONLY place with #[wasm_bindgen]; validates/clamps JS inputs, then calls engine
    mod.rs               # ImageHorseTool struct + fields; delegates to engine
    io.rs                # load_image / export PNG / thumbnails / data_ptr / data_len
    layers.rs            # add/remove/reorder/visibility/opacity
    paint.rs             # paint / blur / pixelate / redact entry points
    annotations.rs       # text + shape + pin create/edit/commit (JSON in/out)
    transform.rs         # flip / rotate / crop / resize entry points
    selection.rs         # magic wand, marquee
    history.rs           # undo / redo / clear
  engine/                # pure Rust, NO wasm_bindgen, host-testable
    image_buffer.rs      # from core.rs
    compositor.rs        # layer blend (blend_over, recomposite) — extracted from lib.rs
    paint_engine.rs      # paint/blur/pixelate/redact stroke state+math — extracted from lib.rs
    annotation_render.rs # text/shape tile building, pin rendering — extracted from lib.rs
    transform.rs · filters.rs · text.rs · stamp.rs   # moved, wasm-free
    error.rs             # EngineError enum — variants: Oom, InvalidDims, OutOfBounds, Decode, etc.
  history.rs             # snapshot model (already clean)
  geometry.rs            # shared math (from drawing.rs helpers)
  settings.rs            # constants incl. MAX_DIM (W1)
  fonts/
```

**Contract this enforces:** all clamping (W1/W4) + saturating math (W2) live in `api/`; the engine
returns `Result<T, EngineError>` and assumes valid inputs; engine compiles/tests on the **host**
(`cargo test --lib`) not just `wasm32`; `lib.rs` shrinks to re-exports + `console_error_panic_hook::set_once()` (W5).

**Why a real error enum (`engine/error.rs`).** `bool`/`Option` collapses every failure mode into
"didn't work". An `EngineError` lets the facade map specifics to JS (e.g., `Oom` → user-facing "out
of memory, try smaller image"; `OutOfBounds` → internal log + return false) and lets host tests
assert _why_ something failed.

## Migration (compiler-guided, low risk)

1. Add `engine/mod.rs` + `api/mod.rs`; move `core.rs`→`engine/image_buffer.rs`. Build.
2. **Cut-and-fix (compiler-driven development):** lift compositor fns from `lib.rs` into
   `engine/compositor.rs` as free functions, `pub use` back. Compiler lists every break — fix, build,
   commit. Repeat for `paint_engine`, `annotation_render`.
3. Add `engine/error.rs` with `EngineError` enum. Change engine returns from `bool`/`Option` to
   `Result<_, EngineError>`. Facade catches at the boundary.
4. Split `ImageHorseTool`'s `#[wasm_bindgen]` methods into `api/*.rs` via multiple `impl` blocks. Each:
   clamp inputs → call engine → map `EngineError` to `JsValue`.
5. Add `settings::MAX_DIM` + apply W1/W2/W4 in `api/`. Add panic hook in `lib.rs` (W5).
6. Keep `wasm-pack build --target web --out-dir pkg` unchanged — output path is the SSOT.

**Supply chain.** Add `cargo audit` (RustSec advisory check) to CI; pair with `pnpm audit` on the
JS side. Both run weekly + on `Cargo.lock`/`pnpm-lock.yaml` changes.

**Guardrail — thin facade, pure engine:**

```bash
rg -n '#\[wasm_bindgen\]' src/engine && echo 'engine must be wasm-free!' || echo 'engine clean'
rg -c '#\[wasm_bindgen\]' src/api/*.rs           # the JS surface, all in one folder
wc -l src/lib.rs                                  # target < 200
rg -n '\.min\(MAX_DIM\)|saturating_mul' src/api   # input clamping lives in the facade
cargo test --lib --quiet                          # engine must be host-testable
```

---

---

# 11. Master punch-list (suggested order)

1. **W5** panic hook (1 line, free, transforms debugging) · **R2** error boundary · **R4** persist
   manifest · **R5** URL leak · **A7** aria-live region — **all cheap, all high-leverage, do these
   first**.
2. **L1** panel-width CSS var · **A1–A6** a11y quick wins — pure SSOT/labels, low risk.
3. **W1/W2/W4** clamp + saturate WASM inputs — safety.
4. **R3** code-split emoji-mart + heavy modals · **R8** bundle-size guardrail — ship size + lock it in.
5. **L3** auto-fit canvas · **L4** mobile breakpoint (with `dvh`).
6. **Structure refactors (own PRs, no behavior change):** §9 React feature-first move → then **R1**
   AppShell decomposition; §10 Rust facade/engine split → covers **W6**, **W7**, **R6**.
7. **Token backlog:** §2 `SubscriptionButton` (then drop from guardrail excludes), §3 `--shadow-modal`
   - motion-literal migration, §4 `.label-caps` + `CanvasGuidesOverlay` fontSize + `--leading-*`.
8. **CI integration:** wire `scripts/check.sh` into pre-commit + GitHub Actions (see `CI-Guardrails.md`).

Rule for every item: small branch → run the section guardrail + relevant build
(`pnpm --filter stamp-tool build`, and `pnpm run build:wasm` for Rust) → commit. Don't push without asking.

---

---

# 12. Reusable guardrail bundle [generic]

Drop into `scripts/check.sh`, run before each commit and in CI. Non-zero exit on any leak.

```bash
#!/usr/bin/env bash
# Reports all failures (no early exit), exits non-zero if any check fired.
# Run from repo root.
set -uo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

fail=0
note(){
  echo "✗ $1" >&2
  if [ -n "${2:-}" ]; then
    echo "$2" | sed 's/^/    /' >&2
  fi
  fail=1
}

# ── 1. version drift (catalog SSOT) ──────────────────────────────────────────
drift=$(rg -n '"(react|react-dom|vite|typescript|tailwindcss|@tailwindcss/vite|@vitejs/plugin-react|@types/react|@types/react-dom|convex)":\s*"\^?[0-9]' app/package.json marketing/package.json 2>/dev/null || true)
[ -n "$drift" ] && note "dep versions not via catalog:" "$drift"

# ── 1b. overrides using >= (auto-promotes to next major) ─────────────────────
ge=$(rg -n '"[<>]=' pnpm-workspace.yaml 2>/dev/null || true)
[ -n "$ge" ] && note "overrides: use ^ not >=" "$ge"

# ── 1c. wasm-bindgen drift between Cargo.toml and package.json ───────────────
cargo_v=$(rg -oN 'wasm-bindgen\s*=\s*"=?([0-9.]+)"' Cargo.toml -r '$1' 2>/dev/null | head -1)
js_v=$(rg -oN '"wasm-bindgen":\s*"=?([0-9.]+)"' app/package.json -r '$1' 2>/dev/null | head -1)
if [ -n "$cargo_v" ] && [ -n "$js_v" ] && [ "$cargo_v" != "$js_v" ]; then
  note "wasm-bindgen drift: cargo=$cargo_v js=$js_v"
fi

# ── 2. raw colors in app chrome (whitelist-tag aware) ────────────────────────
raw=$(rg -n '\b(bg|text|border|ring)-(zinc|neutral|gray|slate|stone)-[0-9]{2,3}\b|\btext-white\b|\bbg-white\b' app/src \
  -g '!**/CanvasArea.tsx' -g '!**/PenOverlay.tsx' -g '!**/CompareSlider.tsx' \
  -g '!**/MagnifierOverlay.tsx' -g '!**/GalleryBar.tsx' -g '!**/lib/colors.ts' -g '!**/toolConfig.ts' \
  2>/dev/null | rg -v 'allow: raw-color' || true)
[ -n "$raw" ] && note "raw colors — use semantic tokens (or tag with /* allow: raw-color */)" "$(echo "$raw" | head -5)"

# ── 3. type scale leaks ──────────────────────────────────────────────────────
typ=$(rg -n 'text-\[[0-9.]+px\]|font-medium|font-black' app/src -g '*.tsx' 2>/dev/null || true)
[ -n "$typ" ] && note "off-scale type / faux weights" "$(echo "$typ" | head -5)"

# ── 4. z-index magic numbers ─────────────────────────────────────────────────
zmagic=$(rg -n '\bz-(10|20|30|40|50|60|100)\b|z-\[[0-9]' app/src -g '*.tsx' \
  -g '!**/GalleryBar.tsx' -g '!**/AppShell.tsx' 2>/dev/null || true)
[ -n "$zmagic" ] && note "raw z-index — use z-[var(--z-*)]" "$(echo "$zmagic" | head -5)"

# ── 5. panel-width SSOT leak ─────────────────────────────────────────────────
pw=$(rg -n 'w-\[260px\]|width:\s*260' app/src 2>/dev/null || true)
[ -n "$pw" ] && note "hardcoded 260px — use --side-panel-width" "$(echo "$pw" | head -5)"

# ── 6. React escape hatches ──────────────────────────────────────────────────
asany=$(rg -n '\bas any\b' app/src -g '*.ts' -g '*.tsx' 2>/dev/null | grep -v '\.d\.ts' || true)
[ -n "$asany" ] && note "as any present" "$(echo "$asany" | head -5)"

# ── 7. Rust panics / unsafe / wasm in engine ─────────────────────────────────
rustbad=$(rg -n '\.unwrap\(\)|\.expect\(|panic!|unsafe ' src -g '*.rs' 2>/dev/null || true)
[ -n "$rustbad" ] && note "rust panic/unsafe" "$(echo "$rustbad" | head -5)"
if [ -d src/engine ]; then
  engwasm=$(rg -n '#\[wasm_bindgen\]' src/engine 2>/dev/null || true)
  [ -n "$engwasm" ] && note "wasm_bindgen leaked into engine/" "$engwasm"
fi

# ── 8. a11y: unnamed role=button (FIXED — v1 was a no-op) ───────────────────
unnamed=$(rg -n 'role="button"' app/src -g '*.tsx' 2>/dev/null | rg -v 'aria-label' || true)
[ -n "$unnamed" ] && note "role=button without aria-label" "$(echo "$unnamed" | head -5)"

# ── 8b. img without alt ──────────────────────────────────────────────────────
noalt=$(rg -n '<img[^>]*>' app/src -g '*.tsx' 2>/dev/null | rg -v 'alt=' || true)
[ -n "$noalt" ] && note "img missing alt attribute" "$(echo "$noalt" | head -5)"

# ── 9. prefers-reduced-motion not respected ──────────────────────────────────
for f in $(rg -l 'transition:|animation:' app/src/styles.css 2>/dev/null); do
  if ! rg -q 'prefers-reduced-motion' "$f"; then
    note "missing reduced-motion guard: $f"
  fi
done

# ── 10. bundle-size ratchet (only checks if a build exists) ──────────────────
if compgen -G "www-dist/assets/index-*.js" > /dev/null; then
  size=$(du -b www-dist/assets/index-*.js | sort -rn | head -1 | cut -f1)
  threshold=2500000
  if [ "${size:-0}" -gt "$threshold" ]; then
    note "main chunk > $((threshold/1024/1024)) MB (current: $((size/1024/1024)) MB)"
  fi
fi

# ── exit ─────────────────────────────────────────────────────────────────────
if [ "$fail" -eq 0 ]; then
  echo "✓ all guardrails clean"
else
  echo "" >&2
  echo "❌ $fail check(s) failed — see above" >&2
fi
exit $fail
```

Set executable: `chmod +x scripts/check.sh`. Wire to CI/pre-commit via `CI-Guardrails.md`.

---

---

# 13. Doc conventions

Three rules that keep this document honest as the codebase changes:

**1. Ratchet pattern — guardrail excludes shrink, never grow.**
Every `-g '!**/<file>'` in a guardrail is technical debt with a name. When a section's "Outstanding"
item ships, the matching file gets dropped from the exclude list in the same PR. The exclude list is
_not_ a graveyard; if a file legitimately can't be cleaned (e.g., `CanvasArea.tsx`'s over-photo
scrims), promote the reason to a DO-NOT entry instead.

**2. Inline whitelist tag beats per-file exclude.**
For intentional one-off exceptions, mark the use site:

```tsx
{
  /* allow: raw-color (gradient button — semantic primary disappears on light) */
}
<button className="text-white …">…</button>;
```

Guardrails strip `allow: <tag>` lines before flagging. Self-documenting, survives renames, makes
audit grep-able: `rg 'allow: raw-color' app/src`.

**3. Section retirement — collapse when work lands.**
When a multi-step section completes (e.g., §1's `chore/ssot-monorepo` is merged), replace the
"Steps" narrative with a 2-line "Done — see <commit-sha>" stub. **Keep the guardrail and
Gotchas/DO-NOT.** Otherwise the doc grows monotonically and reads like a changelog.

---

_See `CI-Guardrails.md` (sibling file) for wiring `scripts/check.sh` into pre-commit hooks and
GitHub Actions._
