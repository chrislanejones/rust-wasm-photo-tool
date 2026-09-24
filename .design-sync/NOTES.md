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
