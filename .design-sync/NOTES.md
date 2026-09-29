# design-sync notes

- **Scope (Chris, 09-24-2026): sync the MARKETING site's design system, not the
  editor app's.** The goal is for Claude Design mockups of marketing pages to
  come out already written in our tokens and class names, so porting a mockup
  into `marketing/src/` is close to a copy instead of a full translation.
  The editor's 30 primitives in `app/src/components/ui` are out of scope for
  now. They would be a separate project if wanted later.
- **The marketing system is mostly tokens + CSS classes, not a component
  library.** Sources of truth: `marketing/src/tokens.css` (color, type scale
  incl. the v2 rungs `--text-hero`, `--text-section`, `--text-card`,
  `--text-deck`, `--text-ui`, `--text-headline`), `marketing/src/styles.css`,
  plus the per-page files added by the v2 ports (`tool-page.css`,
  `features.css`, `trail.css`). React components live in
  `marketing/src/components/` (Nav, Footer, ButtonSet, CubeLetters,
  ShotTimeline, CommandPalette, Slider, Icons, NajiArabic). No Storybook, no
  `*.stories.*`, no `dist/`, so it's the package shape, and it will likely need
  an off-script layout per the skill's "upload format is the contract" rule.
- **Timing: run only after the v2 ports land and are committed** (Pricing,
  Features, 10 tool pages, Trail Log). Each port was still editing
  tokens.css/styles.css on 09-24; syncing mid-port would upload a moving
  vocabulary.
- **The cream panel is a first-class pattern, not a one-off.** Every v2 page
  uses it (`.board--cream` with local `--b-ink` vars on Home, `.soon-board` on
  /coming-soon). Document it in the conventions header with its local ink
  variables, because the site's own ink tokens are tuned for light-on-dark and
  every one is wrong on cream.
- **Known trap to put in the conventions header:** don't reuse `.hero__display`,
  `.section__title--sm` or `.page-head__title` for v2 headings. Each carries its
  own font-size that doesn't match the v2 scale; that's how Home shipped a 119px
  hero against an 80px mockup.
- Design project the mockups live in (not the sync target): `c4c7a8aa-9fac-4728-a0ff-65b35eb0f0d1`
  ("Image horse marketing mockup", PROJECT_TYPE_PROJECT). The sync goes into a
  NEW design-system project, per the skill.
- **Copy overrides that must not be re-imported from the mockup project:**
  Pricing's footer line was "We charge for our bills, not for your CPU." Chris
  called it a bad tagline on 09-24, and it's now "Free where it runs on your
  machine. Paid where it runs on ours." The mockup still has the old line.
  Fix it there too, or a re-port will bring it back.
- **09-24-2026: the first sync was started, then PAUSED before any project was
  created.** Chris redirected to implementing `Home bottom section.dc.html` from
  design project `054e87bd-f08f-4efa-88cf-0682bc08af31` (three.js WEBGPU cubes +
  trotting horse in the footer). Re-run the sync only after that work is
  committed, because it changes `CubeLetters`, `Footer`, `footer.css` and the nav.
  No `projectId` is pinned yet, so the next run is still a first-time import.
- **Three.js now lives on the home page, lazily.** `components/*.three.ts` are
  chunk boundaries importing from `three/webgpu` (three 0.170.0). A design that
  uses `<gpu-letters>` or `<horse-trot>` maps to `CubeLetters` and
  `<Footer horse />`, not to a custom element.
- **09-25-2026: the sync was started a second time, then PAUSED again before any
  project was created.** Chris redirected to porting the OpenRaster pages from
  design project `ffa0b2cf-a798-4307-85ce-b314b627eb35` (`/openraster` v2 plus
  the new `/what-is-ora`, `/ora-to-png` and `/ora-to-psd`, branch
  `feat/ora-page-v2`). Still no `projectId` pinned; the next run is still a
  first-time import. Wait until that branch has merged.

## 09-27-2026 — the sync RAN. Project `d312dd68-978f-445f-81b3-765e65fbfabd` ("Image Horse Marketing"), 63 files.

**The build recipe** (all of it is in config.json now, so this is just the command):

```bash
node .ds-sync/package-build.mjs --config .design-sync/config.json \
  --node-modules marketing/node_modules --out ./ds-bundle
node .design-sync/post-build.mjs ./ds-bundle     # ALWAYS, see below
node .ds-sync/package-validate.mjs ./ds-bundle
```

Run it from the repo root. `cfg.entry` is CWD-relative; every other path in the
config is PKG_DIR-relative (PKG_DIR is `marketing/`, found by walking up from
the entry to the first package.json with a name). Without `cfg.entry` the build
dies `ENOENT node_modules/photo-horse-marketing/package.json` — there is no
self-link.

**`post-build.mjs` is not optional and not cosmetic.** Four separate silent
failures ran through it, all of the same shape — the design renders, just
wrong, and every gate stays green:

| What | Symptom in a design | Cause |
|---|---|---|
| 14 stylesheets missing | NextCards renders as a bulleted list, Pager as "1. 2. 3." | main.tsx imports 17 sheets side by side; the converter copies only `cfg.cssEntry` |
| tokens.css missing | no color, type scale or spacing at all (79 properties referenced, undefined) | same |
| absolute `url(/fonts/…)` | everything in a system font | `public/` is served at the root on the site; a bundle has no root |

It reads the sheet list out of `main.tsx`, so a NEW stylesheet is picked up
without editing it. Order is load-bearing: `animations.css` is imported last on
purpose so its reduced-motion overrides win the cascade.

**Six things the converter could not work out on its own**, all now in config:

- `dtsPropsFor` — all six `.d.ts` came out `[key: string]: unknown`. The
  extractor resolves `<Name>Props` from the package's built .d.ts tree;
  marketing has none ("exported PascalCase symbols: 0"), and five components
  annotate props inline anyway while `SliderProps`/`FooterProps`/`NavProps` are
  declared but never exported. Transcribed by hand from source.
- `componentSrcMap` — otherwise `[ZERO_MATCH]`.
- `extraFonts` — the four woff2 files.
- `storyImports.loaders` `.css` → `css`. `STORY_LOADERS` maps it to `empty`,
  which silently dropped `previews/preview.css`.
- `overrides` cardMode — Nav/Footer single, NextCards/Pager column.
- `entry`, as above.

**Previews are authored in `.design-sync/previews/<Name>.tsx` and committed.**
Two things there that are not obvious:

1. **Import from `"photo-horse-marketing"`, never by relative path.** A
   relative import resolves to the component's source, and rule 2 only shims a
   resolved path when it can NAME the export — which needs the .d.ts tree we
   do not have. So the previews bundled private copies: `_preview/Footer.js`
   came out **1.47 MB** with its own react-router, whose context the bundle's
   MemoryRouter could not fill, and Footer/Nav/NextCards all rendered empty.
   The bare package specifier takes rule 1, which shims unconditionally. Every
   preview is ~4 KB now.
2. **`preview.css` gives the card the site's dark surface.** The generated card
   sets `body{background:#fff}` and this site is light-on-dark, so four of six
   previews were unreadable white-on-white with black slabs — and the render
   check passed them, because it measures emptiness and height, not legibility.
   `html body`, not `body`: the card's inline `<style>` comes after the link.

**Known, accepted:** Footer and Nav previews show a broken-image glyph for the
logo. `<img src="/Image-Horse-Logo.svg">` is site-absolute and a bundle has no
root to serve it from. The components are fine; only the card cannot reach it.

**`conventions.md` is the README header** and is the point of the whole sync.
Every class, token and prop in it was checked against the built artifacts
(38 tokens, 17 classes, 6 components — all present). Re-check after editing it.

## 09-27-2026 (re-sync) — `resync.mjs` REBUILDS, so it wipes styles.css too

The first re-sync verdict was clean: `ok: true`, anchor ok, all six components
`unchanged`, `upload.any: false`. Correct — and it still left the local bundle
broken, because **the driver runs `package-build.mjs` internally**, which
rewrites `styles.css` back to the converter's single `@import`. The 14 per-page
sheets and tokens.css dropped straight back out of the closure.

Measured, before and after re-running `post-build.mjs`:

| | after the driver | after post-build |
|---|---|---|
| `styles.css` @imports | **1** | **16** |
| tokens defined | 0 (79 referenced, undefined) | **215** |
| validator verdict | `✓ bundle is complete` (2 warnings) | `✓ bundle is complete` |
| render check | **6/6 clean** | 6/6 clean |

Read those last two rows twice. Every component rendered as an **unstyled
bulleted list in Times New Roman**, and the render check ticked five of six
green anyway — it measures emptiness and height, not legibility. The contact
sheet is the only thing that showed it.

Two things follow, and the second is the dangerous one:

1. **`post-build.mjs` runs after `resync.mjs` as well**, not just after a bare
   `package-build.mjs`. Treat "any build" as "any build, including the one
   inside the driver".
2. **The anchor does not cover the styles.css manifest.** `styleSha` is
   computed over `_ds_bundle.css`, which the rebuild does not touch — so the
   diff sees "styling unchanged" and reports nothing to upload while the
   closure is gutted. On the atomic path, which re-uploads the whole bundle,
   that is how a gutted manifest would reach the project with a green verdict
   in front of it.

The remote was verified intact after this run (16 imports, read back with
`get_file`), so nothing shipped broken. But the only reason is that this
re-sync had nothing to upload.
