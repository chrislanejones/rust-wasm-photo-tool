# `marketing/vercel.json` — why it is shaped the way it is

**These notes used to live inside `vercel.json` as `"//"` keys. They had to come
out: the Vercel config schema sets `additionalProperties: false` at every level,
so a `"//"` key makes the file invalid and the deployment is rejected before a
build ever starts —**

```
Error: Invalid request: should NOT have additional property `//`. (400)
```

That was not theoretical. The file carried 8 of them and had never once been
used, because the marketing project's Root Directory was still the repo root, so
Vercel read the *root* `vercel.json` instead and nobody found out. Keep this file
beside the JSON and keep them in step; do not put the prose back into the JSON.

---

## Which file is which

The MARKETING project (`imagehorse.app`) reads **this** directory's
`vercel.json`, because that project's Root Directory is `marketing`. The
repo-root `vercel.json` is the **EDITOR's** (`edit.imagehorse.app`). The two must
not be confused — they build different things and carry different
content-security policies.

## There is no catch-all rewrite any more

It used to be `/(.*)` -> `/index.html`, the standard SPA fallback, and it stopped
being right the moment `scripts/prerender.mjs` started emitting a real file per
route. Vercel checks the filesystem before rewrites, so `/features` would still
resolve correctly — but every junk URL was answered with the home page at status
200, which is a soft 404. With no rewrite, unmatched paths fall through to
`dist/404.html` with an actual 404, which is what `404.html` is for on Vercel.

The consequence to know about: a route in `App.tsx` with no entry in `ROUTES`
(`src/seo.ts`) gets no prerendered file and so 404s in production. That is
deliberate — the mistake shows up on the first click instead of silently serving
the wrong page.

## `redirects` — the www redirect

One hostname holds the ranking signal. `www` is a separate origin to a crawler,
so it is redirected rather than served — permanently, so the redirect itself is
what gets cached and indexed. The apex is canonical because that is what
`src/seo.ts` writes into every `<link rel=canonical>` and every sitemap entry;
changing one without the other splits the site in two.

## `headers` — `/(.*)`

### `Strict-Transport-Security`

`.app` is on the HSTS preload list at the TLD, so browsers already refuse
plaintext here — this header keeps that true if the site ever moves to a domain
that isn't.

### `Content-Security-Policy-Report-Only`

Deliberately **NOT** the editor's policy. This site loads no wasm, no Clerk, no
Convex, so it has no business allowing `'wasm-unsafe-eval'` or those origins — a
marketing page that can reach the auth provider is strictly more attack surface
for no feature. Keep the two policies apart even when it means duplicating the
four headers above.

### `Cache-Control: public, max-age=0, must-revalidate`

The SAFE default, applied to everything and then narrowed below. It is the right
value for the HTML: those filenames are stable across deploys, so a cached copy
would keep pointing at the previous build's hashed assets. Matching on a `.html`
suffix instead does **NOT** work — a prerendered route is requested as
`/features`, with no extension, and only resolves to `features/index.html` after
this stage.

## `headers` — `/assets/(.*)`

**ORDER MATTERS**: this also matches `/(.*)` above, and Vercel applies every
matching rule in order with the last write of a given header winning. It must
stay **BELOW** the block that sets the default, or the assets get `max-age=0`.
Everything under `/assets/` carries a content hash, so a changed file is a
changed URL and this can never serve a stale one; `immutable` additionally stops
the revalidation request browsers make on reload.

## `headers` — `/(sitemap.xml|robots.txt)`

Same ordering rule. An hour absorbs a crawl spike and still picks up a new page
on the next fetch.

## `headers` — og images and icons

The share cards and icons change only when `scripts/gen-og-images.mjs` is re-run,
and a scraper refetching one on every unfurl is waste. A day, not a year: unlike
`/assets/` these filenames are NOT content-hashed, so a stale copy is possible
and should expire on its own.
