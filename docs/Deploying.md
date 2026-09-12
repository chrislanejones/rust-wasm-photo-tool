# Deploying

## Which config belongs to which project

Two Vercel projects are linked to this repo, and Vercel picks a project's config
file by its **Root Directory** setting. Get this mapping wrong and a project
builds the other site.

| Vercel project | Root Directory | Reads | Builds | Output |
| --- | --- | --- | --- | --- |
| `image-horse` | *(repo root)* | [`vercel.json`](../vercel.json) | the **editor** | `www-dist` |
| `rust-wasm-photo-tool-app` | `app` | *(no config in `app/`)* | — | — |
| the marketing project | `marketing` | [`marketing/vercel.json`](../marketing/vercel.json) | the **marketing site** | `marketing/dist` |

> ⚠️ **Unverified: which project serves `imagehorse.app`.** The repo-root
> `vercel.json` builds the *editor* (`feat/app-on-vercel`), and the project whose
> Root Directory is the repo root is named `image-horse` — the name the marketing
> site used to deploy under at `image-horse.vercel.app`. Those two facts do not
> sit together comfortably, and the Vercel dashboard is the only place to settle
> it. Before pointing DNS anywhere, confirm which project each domain is attached
> to.
>
> There is no `app/vercel.json`. One was added in the first draft of this branch
> and removed: it hand-ported the old `netlify.toml` build command, including the
> `curl … rustup-init` step that commit `55b02cf` had *just* proved fails on
> Vercel — the build image ships Rust already, with `CARGO_HOME=/rust`, and
> rustup-init refuses to install over it. The root `vercel.json` is the tested
> version; do not reintroduce a second one.

Domains, once the mapping is confirmed:

| Record | Name | Value |
| --- | --- | --- |
| `A` | `@` | Vercel's apex IP (from the project's Domains tab) |
| `CNAME` | `www` | `cname.vercel-dns.com` |
| `CNAME` | `app` | `cname.vercel-dns.com` |

Add **both** `imagehorse.app` and `www.imagehorse.app` to the marketing project.
The `www` → apex redirect is a 308 in `marketing/vercel.json` rather than a
dashboard setting, so the canonical host is version-controlled next to the
`<link rel="canonical">` that has to agree with it.

Netlify is **still live** and still builds every PR preview. `netlify.toml` stays
until `scripts/deploy-sentinel.sh` passes against the Vercel host — see
"Retiring Netlify" below.

---

## The marketing site

`pnpm run build:marketing` runs four steps; the last two are the ones worth
knowing about:

1. `tsc -b` — typecheck.
2. `vite build` — the client bundle, into `marketing/dist`.
3. `vite build --ssr src/entry-server.tsx` — the same React tree compiled for
   Node, into `marketing/dist-ssr`.
4. `node scripts/prerender.mjs` — renders every route from step 3 into the shell
   from step 2, and writes `sitemap.xml`, `robots.txt` and `404.html`.

Step 4 is what makes the site indexable at all; the comment at the top of
[`marketing/scripts/prerender.mjs`](../marketing/scripts/prerender.mjs) explains
why a client-rendered SPA is invisible to everything except Googlebot. It fails
the build loudly if `marketing/index.html` has lost its `seo:start` / `seo:end`
markers, rather than shipping five copies of an empty shell.

### Adding a page

Add it to `ROUTES` in [`marketing/src/seo.ts`](../marketing/src/seo.ts) and to
`<Routes>` in `App.tsx`. Everything else — nav, mobile sheet, footer, ⌘K palette,
sitemap entry, prerendered file, `<head>`, JSON-LD — is a projection of that
table and follows automatically. A `<Route>` added *without* a `ROUTES` entry
gets no prerendered file and so 404s in production. That is deliberate: the
mistake is visible on the first click instead of silently serving a page no
crawler can find.

### Regenerating the share cards

The OG images are committed, not built — a production deploy should not download
a 150 MB browser to re-render five pictures.

```bash
pnpm build:marketing                              # needs dist-ssr/entry-server.js
node marketing/scripts/gen-og-images.mjs
```

Re-run it after changing a title in `seo.ts` or a headline in the script. If
Playwright's browsers are not where it expects:
`CHROMIUM_PATH=/path/to/chrome node marketing/scripts/gen-og-images.mjs`.

---

## Retiring Netlify

Not yet done, and the order matters — none of these steps takes the editor
offline:

1. **Confirm the project/domain mapping** in the Vercel dashboard (see the
   warning above), and that every environment variable currently set on Netlify
   is set on the Vercel project too — the Convex and Clerk keys in particular.
   Missing keys do not fail the build; they produce a logged-out-only app, which
   is a supported path and therefore a silent failure.

2. **Run the sentinel against the Vercel deployment**, before any DNS moves:

   ```bash
   SENTINEL_SITE=https://<the-vercel-url> ./scripts/deploy-sentinel.sh
   ```

   This is not optional. The exact failure it exists to catch — a build command
   missing `--features tiles,patchmatch`, shipping a featureless wasm that looks
   fine until you use a tool — went unnoticed for ten releases on Netlify. A
   migrated build command is precisely when it can happen again.

3. **Point `app.imagehorse.app` at the editor project** and re-run the sentinel
   against the real hostname. `scripts/deploy-sentinel.sh` already defaults to
   `https://app.imagehorse.app`, so from here the CI job checks the new host with
   no further change.

4. **Only then**: delete the Netlify site, delete `netlify.toml`, and drop its
   references from `docs/CI.md` and the sentinel's comments.

Step 4 also clears a standing hazard. `netlify.toml`'s header documents a stale
duplicate of the build command living in the Netlify UI, missing the feature
flags and the toolchain pins. It is harmless only because `netlify.toml`
overrides it — which is a reason to finish the migration rather than leave
Netlify parked "just in case".

---

## After the first deploy on the new domain

One-time, and none of it can be done from the repo:

- **Google Search Console** — add `imagehorse.app` as a domain property (DNS TXT
  verification covers the subdomains too), then submit
  `https://imagehorse.app/sitemap.xml`. Nothing indexes faster for having a
  sitemap submitted; this is where you find out if something is broken.
- **Bing Webmaster Tools** — same, and it can import the Search Console setup.
  Worth doing: Bing does not render JavaScript the way Google does, so the
  prerendering is what makes the site legible to it at all, and this is how you
  confirm that.
- **Check the redirect** — `curl -sI https://www.imagehorse.app/pricing` should
  return `308` with `location: https://imagehorse.app/pricing`.
- **Check the 404** — `curl -sI https://imagehorse.app/nope` should return `404`,
  not `200`. A `200` means a catch-all rewrite came back.
- **Re-scrape the share cards** — X, LinkedIn and Facebook each cache the old
  unfurl per URL. Their debuggers force a refresh.
