# Deploying

Two sites, two hosts today, one host once the migration below is finished.

| What | Domain | Project root | Config | Status |
| --- | --- | --- | --- | --- |
| Marketing | `imagehorse.app` (+ `www` → apex) | repo root | [`vercel.json`](../vercel.json) | Vercel, live |
| Editor | `edit.imagehorse.app` | repo root | [`vercel.json` (repo root)](../vercel.json (repo root)) | **Vercel config written, not yet deployed** |
| Editor (old) | `rust-wasm-photo-tool.netlify.app` | repo root | [`netlify.toml`](../netlify.toml) | Netlify, **still live — do not delete yet** |

---

## The marketing site

Nothing about it needs a human after the first deploy. `pnpm run build:marketing`
runs four steps, and the last two are the ones worth knowing about:

1. `tsc -b` — typecheck.
2. `vite build` — the client bundle, into `marketing/dist`.
3. `vite build --ssr src/entry-server.tsx` — the same React tree, compiled for
   Node, into `marketing/dist-ssr`.
4. `node scripts/prerender.mjs` — renders every route from step 3 into the shell
   from step 2, and writes `sitemap.xml`, `robots.txt` and `404.html`.

Step 4 is what makes the site indexable at all; see the comment at the top of
[`marketing/scripts/prerender.mjs`](../marketing/scripts/prerender.mjs) for why.
It fails the build loudly if `marketing/index.html` has lost its `seo:start` /
`seo:end` markers, rather than shipping five copies of an empty shell.

### Why sitemap entries often have no `lastmod`

Expect most production `<url>` entries to carry no `lastmod`, and do not "fix" it
by stamping the build time — that is the one change that would make the field
actively harmful.

`lastmod` comes from the last commit touching the files behind each route. A
shallow clone's oldest commit has no visible parents, so every file in it reads
as having been *added* there, and `git log -1 -- <path>` answers with that commit
for anything older than the cutoff. At depth 1 — which is what Vercel and
`actions/checkout@v4` both give you — that is the whole tree, and all five routes
would claim to have changed at the moment of the deploy. Google learns to ignore
a sitemap that says that.

So `prerender.mjs` reads `.git/shallow` and discards any date resolving to a
boundary commit, per file. Routes whose real commit is inside the fetched history
keep a true date; the rest get none. An absent hint costs nothing.

### Adding a page

Add it to `ROUTES` in [`marketing/src/seo.ts`](../marketing/src/seo.ts) and to
`<Routes>` in `App.tsx`. Everything else — nav, mobile sheet, footer, ⌘K palette,
sitemap entry, prerendered file, `<head>`, JSON-LD — is a projection of that
table and follows automatically. A `<Route>` added *without* a `ROUTES` entry
gets no prerendered file and so 404s in production. That is deliberate: the
mistake is visible on the first click instead of silently serving a page no
crawler can find.

### Regenerating the share cards

The OG images are committed, not built — a production deploy should not be
downloading a 150 MB browser to re-render five pictures.

```bash
pnpm build:marketing                              # needs dist-ssr/entry-server.js
node marketing/scripts/gen-og-images.mjs
```

Re-run it after changing a title in `seo.ts` or a headline in the script. If
Playwright's browsers are not where it expects, point at one:
`CHROMIUM_PATH=/path/to/chrome node marketing/scripts/gen-og-images.mjs`.

---

## Moving the editor off Netlify

`vercel.json` (repo root) is a port of the build command in `netlify.toml`, which stays
the source of truth for that chain until this is validated. **It has not been
run on Vercel yet.** The steps, in an order that never leaves the editor
offline:

1. **Create the Vercel project** against this repo, and in its settings:
   - **Root Directory** = `app`. This is what makes Vercel read
     `vercel.json` (repo root) rather than the repo-root one, which belongs to the
     marketing site. Two projects cannot share one config file.
   - **Include files outside of the Root Directory** = **ON**. Required: the
     Rust crate, `Cargo.toml`, `rust-toolchain.toml` and `scripts/` all live
     above `app/`.
   - Node version 20, matching `netlify.toml`'s `NODE_VERSION`.
   - Every environment variable currently set on Netlify — Convex and Clerk keys
     in particular. Missing keys do not fail the build; they produce a
     logged-out-only app, which is a supported path and therefore a silent
     failure.

2. **Deploy to the Vercel preview URL and check the engine**, before any DNS
   moves:

   ```bash
   SENTINEL_SITE=https://<preview>.vercel.app ./scripts/deploy-sentinel.sh
   ```

   This is not optional. The exact failure it exists to catch — a build command
   missing `--features tiles,patchmatch`, shipping a featureless wasm that looks
   fine until you use a tool — went unnoticed for ten releases on Netlify. A
   ported build command is precisely when it can happen again.

3. **Point `edit.imagehorse.app` at the Vercel project** (CNAME to
   `cname.vercel-dns.com`), and re-run the sentinel against the real hostname.

4. **Only then retire Netlify**: delete the Netlify site, delete `netlify.toml`,
   and drop its references from `docs/CI.md` and the sentinel's comments.

`scripts/deploy-sentinel.sh` already defaults to `https://edit.imagehorse.app`,
so once step 3 is done the CI job checks the new host with no further change.

### One loaded gun to clear while you are in there

`netlify.toml`'s comment header documents a stale duplicate of the build command
in the Netlify UI, which is missing the feature flags and the toolchain pins. It
is currently harmless because `netlify.toml` overrides it. Deleting the Netlify
site removes that hazard permanently — which is a reason to finish step 4 rather
than leave Netlify parked "just in case".

---

## DNS

| Record | Name | Value |
| --- | --- | --- |
| `A` | `@` | Vercel's apex IP (from the project's Domains tab) |
| `CNAME` | `www` | `cname.vercel-dns.com` |
| `CNAME` | `app` | `cname.vercel-dns.com` |

Add **both** `imagehorse.app` and `www.imagehorse.app` to the marketing project.
The `www` → apex redirect is in `vercel.json` as a 308 rather than configured in
the dashboard, so the canonical host is version-controlled next to the
`<link rel="canonical">` that has to agree with it.

---

## After the first deploy on the new domain

These are one-time, and none of them can be done from the repo:

- **Google Search Console** — add `imagehorse.app` as a domain property (DNS TXT
  verification covers the subdomains too), then submit
  `https://imagehorse.app/sitemap.xml`. Nothing gets indexed faster for having a
  sitemap submitted, but this is where you find out if something is broken.
- **Bing Webmaster Tools** — same, and it can import the Search Console setup.
  Worth doing: Bing does not render JavaScript the way Google does, so the
  prerendering is what makes the site legible to it at all, and this is how you
  confirm that.
- **Check the redirect** — `curl -sI https://www.imagehorse.app/pricing` should
  return `308` with `location: https://imagehorse.app/pricing`.
- **Check the 404** — `curl -sI https://imagehorse.app/nope` should return `404`,
  not `200`. A `200` means the catch-all rewrite came back.
- **Re-scrape the share cards** — X, LinkedIn and Facebook all cache the old
  unfurl per URL. Their debuggers force a refresh.
