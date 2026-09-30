# Deploying

## Which config belongs to which project

Three Vercel projects are linked to this repo, and Vercel picks a project's
config file by its **Root Directory** setting. Get this mapping wrong and a
project builds the other site.

| Vercel project | Root Directory | Reads | Builds | Output |
| --- | --- | --- | --- | --- |
| `image-horse` | *(repo root)* | [`vercel.json`](../vercel.json) | the **editor** | `www-dist` |
| `rust-wasm-photo-tool-app` | `app` | *(no config in `app/`)* | — | — |
| `image-horse-marketing` | `marketing` | [`marketing/vercel.json`](../marketing/vercel.json) | the **marketing site** | `marketing/dist` |

> The marketing row is confirmed by the repo's own CI: the `marketing` job in
> `.github/workflows/ci.yml` runs with `working-directory: marketing`, and its
> comment records that Vercel's Root Directory is `/marketing`. If that setting
> ever changes, change the CI job with it — that job is what keeps this table
> honest.
>
> Read the job's own "fails the same way Vercel would" narrowly, though: it
> reproduces Vercel's *working directory*, not its *file set*. It checks out the
> whole repository, so anything that breaks only because files above `marketing/`
> are absent passes in CI and fails on Vercel — see the next section for the case
> that actually bit.
>
> ⚠️ **The apex has been serving the editor.** That is not a hypothetical to
> check — #135 established it. The project serving `imagehorse.app` had its Root
> Directory at the repo root, so Vercel read the *root* `vercel.json`, and #133
> repointed that file at the editor build. Until the apex is pointed at a project
> that builds `marketing/`, none of the prerendering, sitemap or metadata below is
> what visitors or crawlers actually get.
>
> There is no `app/vercel.json`. One was added in the first draft of this branch
> and removed: it hand-ported the old `netlify.toml` build command, including the
> `curl … rustup-init` step that commit `55b02cf` had *just* proved fails on
> Vercel — the build image ships Rust already, with `CARGO_HOME=/rust`, and
> rustup-init refuses to install over it. The root `vercel.json` is the tested
> version; do not reintroduce a second one.

### What actually stopped the marketing deploy

**The config has to be schema-valid, and JSON-valid is not enough.** Vercel's
config schema is `additionalProperties: false` at every level, so a `"//"`
comment key makes the whole file invalid and the deployment is rejected with a
400 *before a build starts*. `marketing/vercel.json` carried 8 of them and was
never once usable. Fixed in #135; the prose those keys held now lives in
[`marketing/VERCEL-CONFIG.md`](../marketing/VERCEL-CONFIG.md) — keep it there.

That was the whole blocker. With the schema fixed, `image-horse-marketing`
builds and deploys clean.

The trap worth naming: `json.load()` succeeding proves the file is JSON, not that
Vercel will accept it. Checking the former and calling the config "valid" is how
this shipped.

#### A `catalog:` failure that does NOT happen on Vercel

Worth recording because it looks like it should, and predicting it here was
wrong. Copy `marketing/` somewhere on its own and run `pnpm install` and you get:

```
ERR_PNPM_CATALOG_ENTRY_NOT_FOUND_FOR_SPEC
No catalog entry '@types/react' was found for catalog 'default'.
```

`marketing/package.json` declares react, react-dom, vite, typescript and the
React types as `"catalog:"`, and that catalog lives in `pnpm-workspace.yaml` at
the repo root. So the reasoning was: Root Directory `marketing` hands the build
only that subtree, therefore Vercel must hit the same wall and needs "Include
files outside of the Root Directory in the Build Step".

**It does not, and it doesn't.** The first schema-valid deployment installed and
built fine. Vercel's Root Directory is not equivalent to a standalone copy of
that directory — the workspace root is reachable. Do not go turning settings on
to fix this; there is nothing to fix.

The general lesson is the same one as above, pointed the other way: a local
reproduction proves what your machine does, not what the platform does. Both
halves of this section were originally asserted from something that was not the
platform.

Domains, once the mapping is confirmed:

| Record | Name | Value |
| --- | --- | --- |
| `A` | `@` | Vercel's apex IP (from the project's Domains tab) |
| `CNAME` | `www` | `cname.vercel-dns.com` |
| `CNAME` | `edit` | `cname.vercel-dns.com` |

Add **both** `imagehorse.app` and `www.imagehorse.app` to the marketing project.
The `www` → apex redirect is a 308 in `marketing/vercel.json` rather than a
dashboard setting, so the canonical host is version-controlled next to the
`<link rel="canonical">` that has to agree with it.

Netlify is **retired** (2026-09-27, see "Retiring Netlify" below).
`rust-wasm-photo-tool.netlify.app` 301s to `edit.imagehorse.app`, builds are
stopped, and `netlify.toml` is deleted.

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

### Why sitemap entries often have no `lastmod`

Expect most production `<url>` entries to carry no `lastmod`, and do not "fix" it
by stamping the build time — that is the one thing that makes the field actively
harmful.

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

**DONE 2026-09-27.** Steps 1–3 were already met; step 4 ran that day.

The order mattered, and none of it took the editor offline:

1. **Confirm the project/domain mapping** in the Vercel dashboard (see the
   warning above), and that every environment variable set on Netlify is set on
   the Vercel project too — the Convex and Clerk keys in particular. Missing keys
   do not fail the build; they produce a logged-out-only app, which is a
   supported path and therefore a silent failure.

2. **Run the sentinel against the Vercel deployment**, before any DNS moves:

   ```bash
   SENTINEL_SITE=https://<the-vercel-url> ./scripts/deploy-sentinel.sh
   ```

   This is not optional. The exact failure it exists to catch — a build command
   missing `--features tiles,patchmatch`, shipping a featureless wasm that looks
   fine until you use a tool — went unnoticed for ten releases on Netlify. A
   migrated build command is precisely when it can happen again.

3. **Point `edit.imagehorse.app` at the editor project**, re-run the sentinel
   against it by hand, and only then change its default. **DONE 2026-09-12**
   (#136): the default is now `https://edit.imagehorse.app`.

   `scripts/deploy-sentinel.sh` used to default to the Netlify host on purpose —
   it has to follow whatever is actually serving users. Changing it first was
   tried and CI rejected it in under a minute: three fetches, three 404s. Note
   the shape of that failure, because it is informative — `edit.imagehorse.app`
   answered with an HTTP 404 rather than failing to resolve, which is what Vercel
   returns for a domain that resolves to it but is not attached to any project.
   The DNS is the easy half; the domain also has to be added to the project.

   The reason to care about the ordering is not the red run. It is that a check
   which is red for a reason everyone knows about gets ignored or switched off —
   and this is the check that exists to catch a featureless wasm, which once
   shipped for ten releases without anyone noticing.

4. **Retire the host. DONE 2026-09-27.** What was actually done, in this order:

   | Step | Result |
   | --- | --- |
   | Prebuilt redirect deploy (`netlify deploy --no-build --prod`) | `/*` → `https://edit.imagehorse.app/:splat` **301**, path and query preserved |
   | `build_settings.stop_builds = true` | no further builds, no further PR checks |
   | `build_settings.cmd = ""` | **closes #56** — the stale UI command is gone |
   | `netlify.toml`, `.netlify/` deleted | the repo no longer configures a host it does not use |
   | `cspInlineHash.test.ts` | dropped its `netlify.toml` config; it would have thrown ENOENT |
   | Unlink the GitHub repo | **NOT DONE** — the API ignores `repo: null` and `build_settings.repo_url: null`. Cosmetic only while builds are stopped; clear it in the UI under Project configuration → Build & deploy → Continuous deployment. |

   The site itself was **kept, not deleted**, so the 301 keeps working. Deleting
   it frees `rust-wasm-photo-tool.netlify.app` for anyone to claim and turns
   every old link into a 404.

### What retiring it cost

Step 4 cleared a standing hazard and gave up a real check, and both are worth
stating.

Cleared: `netlify.toml` documented a stale duplicate of the build command living
in the Netlify UI, missing the feature flags and the toolchain pins. It was
harmless only because `netlify.toml` overrode it — and the retirement itself
proved the gun was loaded. A `netlify deploy` run from a directory with no
`netlify.toml` picked up that UI command (`commandOrigin: ui`) and tried to run
it. That is exactly the failure the file's header warned about, observed live.

Given up: **the third builder.** Laptop, CI and Netlify all produced 823,503 B
for the commit after the move, and Vercel alone produced 823,479 B — which is how
its `/rust` `CARGO_HOME` was found to miss every `--remap-path-prefix` entry in
`.cargo/config.toml`. Three against one is what made that readable. It is now CI
against production, one against one, and a future drift has no tie-breaker in
automation. Reproduce locally before believing either side.

In fairness to the decision: by the time it was retired Netlify had not compiled
this tree since 2026-09-17. Every deploy from 09-22 onward — 100 consecutive,
production and preview alike — failed with "Skipped due to account builds usage
exceeded". The third opinion had already stopped being given; retiring the host
only stopped the red checks that were standing in for it.

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
