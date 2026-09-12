# Deploying

## Which config belongs to which site

Vercel picks a project's config file by its **Root Directory** setting. Several
projects build out of this one repo and they do NOT share a config — get the
mapping wrong and a project builds the other site.

| Site | Config | Vercel Root Directory | Output | Domain |
| --- | --- | --- | --- | --- |
| **Editor** | [`vercel.json`](../vercel.json) (repo root) | *(repo root)* | `www-dist` | `edit.imagehorse.app` |
| **Marketing** | [`marketing/vercel.json`](../marketing/vercel.json) | `marketing` | `marketing/dist` | `imagehorse.app` (+ `www` → apex) |
| Editor (old) | [`netlify.toml`](../netlify.toml) | *(repo root)* | `www-dist` | `rust-wasm-photo-tool.netlify.app` — **still live** |

**The editor roots at the repo root and cannot root at `app/`.** `Cargo.toml`,
`rust-toolchain.toml` and `scripts/build-wasm.sh` all live above `app/`, so from
there the engine has nothing to build. There is deliberately no `app/vercel.json`;
one was written and removed, because it hand-ported `netlify.toml`'s
`curl … rustup-init` step, which commit `55b02cf` had just proved fails on Vercel
— the build image ships Rust with `CARGO_HOME=/rust` and rustup-init refuses to
install over it. The root `vercel.json` is the tested version.

**The marketing root directory is pinned by CI.** The `marketing` job in
`.github/workflows/ci.yml` runs with `working-directory: marketing` precisely so
it "fails the same way Vercel would". If that setting ever changes, change the CI
job with it — that job is what keeps this table honest.

**Three Vercel projects are currently attached to this repo**, which is one more
than there is work for. From the deployment bot's own metadata:

| Project | Root Directory | Reads | Notes |
| --- | --- | --- | --- |
| `image-horse-marketing` | `marketing` | `marketing/vercel.json` | the marketing site |
| `image-horse` | *(repo root)* | `vercel.json` | builds the **editor**, despite the name — it is the name the marketing site used at `image-horse.vercel.app` |
| `rust-wasm-photo-tool-app` | `app` | *(nothing)* | no config in this repo targets `app/`; it builds on Vercel's defaults |

> ⚠️ Two of these want a decision that cannot be made from the repo. `image-horse`
> and `rust-wasm-photo-tool-app` both appear to be aimed at the editor, and only
> one of them reads a config this repo controls. Whichever is not serving a domain
> should be deleted — an extra project is a second deploy on every push and a
> second thing to keep configured.

### The one non-obvious Vercel setting

The marketing project's Root Directory is `marketing`, and it **also needs
"Include files outside of the Root Directory in the Build Step" turned ON.**
Without it the install fails before a line of the site is built:

```
ERR_PNPM_CATALOG_ENTRY_NOT_FOUND_FOR_SPEC
No catalog entry '@types/react' was found for catalog 'default'.
```

`marketing/package.json` declares react, react-dom, vite, typescript and the
React types as `"catalog:"`, and the catalog those resolve against lives in
`pnpm-workspace.yaml` at the **repo root**. Root Directory alone gives the build
only the `marketing/` subtree, so pnpm has a specifier it cannot resolve.

Reproduced by copying `marketing/` somewhere on its own and running
`pnpm install`; it fails identically. This is not something a config file in this
repo can fix — removing `catalog:` would work but would undo the single source of
truth for shared versions that `pnpm-workspace.yaml` exists to provide. It is a
project setting, and the same setting the editor project needs for the Rust crate.

CI does not catch it: `.github/workflows/ci.yml`'s `marketing` job checks out the
whole repo and only *runs* from `marketing/`, so the workspace root is always
present there. The mirror is faithful about the working directory and cannot be
faithful about the file set.

### DNS

| Record | Name | Value |
| --- | --- | --- |
| `A` | `@` | Vercel's apex IP (from the project's Domains tab) |
| `CNAME` | `www` | `cname.vercel-dns.com` |
| `CNAME` | `edit` | `cname.vercel-dns.com` |

Add **both** `imagehorse.app` and `www.imagehorse.app` to the marketing project.
The `www` → apex redirect is a 308 in `marketing/vercel.json` rather than a
dashboard setting, so the canonical host is version-controlled next to the
`<link rel="canonical">` that has to agree with it.

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

`vite.config.ts` sets `ssr.noExternal: true`, and it is load-bearing. Without it
the SSR build leaves React external and `prerender.mjs` resolves a second
physical copy out of the pnpm store — react-dom binds one React, the components
import another, and the dispatcher is null the moment a hook runs
(`Cannot read properties of null (reading 'useContext')`). Naming packages
individually does not fix it: the app imports `react-router-dom`, which stays
external and pulls its own `react-router`.

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

Not finished. Netlify still serves the editor and still builds every PR preview,
so `netlify.toml` stays until these are done, in this order:

1. **Attach `edit.imagehorse.app` to the editor project** and get a production
   deployment onto it.

   **This is the current blocker.** `scripts/deploy-sentinel.sh` already points
   at `edit.imagehorse.app`, and the host answers `404` — so the sentinel is
   failing on master itself, not just on branches. Note the shape of that
   failure: a 404 rather than a DNS error is what Vercel returns for a domain
   that resolves to it but has no project attached or no production deployment.
   The DNS is the easy half.

   Confirm too that every environment variable set on Netlify is set on the
   Vercel project — Convex and Clerk keys in particular. Missing keys do not
   fail the build; they produce a logged-out-only app, which is a supported path
   and therefore a silent failure.

2. **Run the sentinel by hand against the real host** before trusting CI's copy:

   ```bash
   SENTINEL_SITE=https://edit.imagehorse.app ./scripts/deploy-sentinel.sh
   ```

   Not optional. The failure it exists to catch — a build command missing
   `--features tiles,patchmatch`, shipping a featureless wasm that looks fine
   until you use a tool — went unnoticed for ten releases on Netlify. A migrated
   build command is exactly when it can happen again.

3. **Only then**: delete the Netlify site, delete `netlify.toml`, and drop its
   references from `docs/CI.md` and the sentinel's comments.

### On pointing the sentinel at a host that isn't serving

`SENTINEL_SITE`'s default has to follow whatever is actually serving users, and
it has now been moved ahead of the domain twice on this work — once to
`app.imagehorse.app` (wrong hostname entirely) and once to `edit.imagehorse.app`
before it was attached. Both turned CI red within a minute.

The cost is not the red run. It is that a check red for a reason everybody knows
about stops being read, and this is the check standing between a featureless wasm
and production. If step 1 is going to take a while, park the default on whatever
is serving and move it in step 2.

### One loaded gun to clear while you are in there

`netlify.toml`'s header documents a stale duplicate of the build command living
in the Netlify UI, missing the feature flags and the toolchain pins. It is
harmless only because `netlify.toml` overrides it. Deleting the Netlify site
removes that hazard permanently — a reason to finish step 3 rather than leave
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
