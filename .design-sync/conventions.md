# Image Horse — marketing site design system

This is the **marketing site** (imagehorse.app), not the editor. The editor at
edit.imagehorse.app has its own 30-odd primitives in `app/src/components/ui`;
none of them are here, and nothing here should be used to design editor UI.

A design built from this system should port into `marketing/src/` as close to a
copy as possible. That is the whole point of the sync: same tokens, same class
names, same components.

## The site is plain CSS. There is no Tailwind.

No Tailwind, no Radix, no Base UI. From `marketing/vite.config.ts`:

> No Tailwind here on purpose: the site is plain CSS driven by the tokens in
> `src/tokens.css`. Adding the plugin back would ship a preflight reset that
> fights styles.css for no gain.

So: **write class names and CSS custom properties, not utility classes.**
`class="flex gap-4 text-sm"` produces an unstyled element here. The classes
below are real and already carry their layout.

Link `styles.css` and you get the whole site: it `@import`s the tokens, the
main stylesheet, and all fourteen per-page sheets, in the site's own order.

## Type scale — use the v2 rungs, and mind the trap

`--text-hero` `--text-section` `--text-card` `--text-deck` `--text-ui`
`--text-headline` `--text-panel` `--text-coda` `--text-statement`
`--text-figure` `--text-price` `--text-prose` — plus the plain ramp
`--text-2xs` through `--text-4xl` and `--text-display`. 23 in all.

**Do not reuse `.hero__display`, `.section__title--sm` or `.page-head__title`
for a new heading.** Each carries its own font-size that predates the v2 scale
and does not match it. That is how the home page shipped a 119px hero against
an 80px mockup. Set the rung you want with `font-size: var(--text-hero)` on
your own class instead.

## Tokens

| Family | Count | Examples |
|---|---|---|
| `--text-*` | 23 | `--text-hero`, `--text-section`, `--text-card`, `--text-ui` |
| `--color-*` | 21 | `--color-paper`, `--color-ink`, `--color-accent`, `--color-rule` |
| `--space-*` | 9 | `--space-2xs` … `--space-4xl` (xs, sm, md, lg, xl, 2xl, 3xl, 4xl) |
| `--radius-*` | 5 | `--radius-xs`, `--radius-sm`, `--radius-md`, `--radius-pill`, `--radius-logo` |
| `--font-*` | 3 | `--font-display`, `--font-body`, `--font-outlier` |
| `--dur-*` / `--ease-*` | 6 / 4 | motion |
| `--z-*` | 5 | stacking |

Both `--font-display` and `--font-body` are Geist. `--font-outlier` is JetBrains
Mono and is the site's one mono — it marks paths, versions and file names
(`.tp-next__slug` uses it).

The page itself is dark: `--color-paper` is the background, `--color-ink` is
oklch(95%) — near-white. **Every ink token assumes a dark surface.**

## The cream panel

The one pattern that breaks that assumption, and the most common v2 section:
a light panel on the dark page. `.board--cream` redefines its own ink inside
itself, because every `--color-ink*` is illegible on cream:

```css
.board--cream {
  --b-ink;  --b-ink-2;  --b-ink-3;     /* text, in three weights */
  --b-rule; --b-rule-soft;             /* hairlines */
  --b-accent;                          /* the amber, darkened for cream */
  --b-card;                            /* a card sitting on the panel */
}
```

**Inside a cream panel, read from `--b-*` and never from `--color-ink*`.**
Companion classes: `.board`, `.board__head`, `.board__title`, `.board__deck`,
`.board--close`.

## Buttons

One family: `.cta`, with `.cta--fill` (amber, the primary), `.cta--outline`,
`.cta--ink`, `.cta--ink-outline`, and `.cta--lg` for size.

**A filled button inside a prose container needs care.** `.post a` is (0,1,1)
and `.cta--fill` is (0,1,0), so the container's link color wins and a filled
amber button renders amber-on-amber — contrast ratio 1.00, which shipped on
both blog posts. `scripts/check-contrast.mjs` measures every link and button on
all 27 pages from computed styles and is the check that catches it.

## Components

Six, and they are the real shipped code, not reimplementations.

| Component | What it is |
|---|---|
| `ButtonSet` | The twelve editor tool tiles from the home page. No props. |
| `Slider` | The site's only form control. Controlled: `value` + `onValueChange`. |
| `Pager` | Page-at-a-time nav, built for the Trail Log's 17 pages. Controlled. |
| `NextCards` | The four-card "Next" grid that closes every page. |
| `Footer` | The site footer, three columns under the page's own closing line. |
| `Nav` | The floating pill nav and its Tools / Learn mega menus. |

All six read `react-router`, so a design wraps in `MemoryRouter`.

`NextCards` **picks nothing** — `cards` arrives already chosen. The site's
picker is seeded by page path (`marketing/src/data/nextCards.ts`) rather than
random, because the pages are prerendered and a random pick would mismatch on
hydration. If a design needs cards, hand it a literal array.

Deliberately not in this system, with reasons: `CubeLetters` and `HorseTrot`
(three.js/WebGPU behind a lazy chunk — they want a GPU adapter the design
runtime may not have), `OraViewer` (nothing to show without a `.ora` in hand),
`CommandPalette` (opens on a keystroke over the whole page), `OraFaq` /
`OraSubPage` (scaffolding for four specific pages), `NajiBanner` (one fixed
site-wide bar), `Icons` and `NajiArabic` (an icon map and one glyph).

`Footer` also takes `horse` — the trotting horse beside the closing line, used
on the home page and the 404. It is not previewed, for the GPU reason above.

## One known preview limitation

`Footer` and `Nav` show a broken-image glyph where the logo goes. Their markup
is `<img src="/Image-Horse-Logo.svg">` — site-absolute, served from `public/`
on the real site, and there is no root to serve it from inside a bundle. The
components are correct; only the preview card cannot reach the file.
