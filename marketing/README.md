# Image Horse marketing site

The public site at [imagehorse.app](https://imagehorse.app/). Vite, React and
plain CSS, with every route prerendered for search and sharing.

Run from the repository root:

```bash
pnpm run dev:marketing
pnpm run build:marketing
node marketing/scripts/gen-trail-data.mjs
```

The Vercel marketing project has Root Directory `marketing` and reads
[`vercel.json`](vercel.json), publishing `dist`. The repository's root Vercel
configuration builds the editor at edit.imagehorse.app.

## Release routine

Update the latest release in [../README.md](../README.md), append the dated
history in [../docs/Change-summary.md](../docs/Change-summary.md), and add the
release at the top of [src/data/releases.ts](src/data/releases.ts). Those
release entries drive the Trail Log's annual and monthly counts and highlights.

Run the generator after landing the actual commits on `master`. It refreshes
[src/data/commits.ts](src/data/commits.ts), the GitHub-style squares in every
Trail Log view; the feature list; in-app celebration totals; and sitemap dates.
Commit dates come from the original author dates. Recheck the generated data
after the release commit, before pushing, so today's square includes it too.

Refresh [src/data/featureCards.ts](src/data/featureCards.ts) and
[../docs/Features.md](../docs/Features.md) when behavior changes. Keep
[src/data/comingSoon.ts](src/data/comingSoon.ts) honest: it feeds both
`/in-the-works` and the home page. Completed work belongs in the Trail Log;
work still under review stays in the register.

Latest: **v9.31 — 2026-10-16**, preset slider arrow keys change the setting
by one, including Shapes → Points, and commit the final value on key release.
