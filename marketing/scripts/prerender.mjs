#!/usr/bin/env node
// Turns the client build into five real HTML documents.
//
//   dist/index.html            ← "/"          (overwritten, was the empty shell)
//   dist/architecture/index.html
//   dist/features/index.html
//   dist/pricing/index.html
//   dist/trail-log/index.html
//   dist/404.html              ← the catch-all route, for a real 404 status
//   dist/sitemap.xml
//   dist/robots.txt
//
// Runs as the third step of `pnpm build`, after the client build (which produces
// the template and the hashed asset names) and the SSR build (which produces the
// renderer). See package.json.
//
// ── why this exists ────────────────────────────────────────────────────────
// A Vite SPA ships one index.html whose body is `<div id="root"></div>`. Every
// word of every page arrives later, from JavaScript. Googlebot will run that JS
// and eventually see the text, but "eventually" is a second queue with its own
// budget, and it is the only crawler that makes the attempt at all: Bingbot,
// DuckDuckGo, the LinkedIn and Slack unfurlers, and every LLM crawler read the
// HTML they are handed and stop. For a five-page marketing site the entire
// argument for the product was invisible to all of them.
//
// The fix is to run the same React tree under Node at build time and write the
// result to disk. No server, no framework migration, no runtime cost — the
// output is still a static directory, and the client still hydrates into it.
//
// ── the 404 ───────────────────────────────────────────────────────────────
// `404.html` is Vercel's convention: it is served, with an actual 404 status,
// for any path that matches no file and no rewrite. That is why vercel.json no
// longer carries a catch-all rewrite to /index.html — that rewrite answered
// every junk URL with the home page at status 200, which is a soft 404. The
// consequence to know about: a route that exists in App.tsx but not in ROUTES
// gets no file here and so 404s in production. That is deliberate. Both lists
// are projections of ROUTES (seo.ts), so the two cannot disagree unless someone
// adds a <Route> without adding the route — and a hard 404 makes that mistake
// visible on the first click instead of silently serving the wrong page.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const marketing = resolve(here, "..");
const repoRoot = resolve(marketing, "..");
const dist = join(marketing, "dist");

const { render, ROUTES, headTagsFor, robotsTxt, sitemapXml, NOT_FOUND_HEAD } = await import(
  join(marketing, "dist-ssr", "entry-server.js")
);

// ── the template ──────────────────────────────────────────────────────────
// index.html as the client build left it: correct <script>/<link> tags with the
// content-hashed filenames, which is exactly why the template is taken from the
// build output rather than from source. Hand-writing those names would break on
// every asset change.
const template = readFileSync(join(dist, "index.html"), "utf8");

const SEO_START = "<!-- seo:start -->";
const SEO_END = "<!-- seo:end -->";
const ROOT_DIV = '<div id="root"></div>';

// Fail loudly on a template that can't be filled, rather than quietly shipping
// five copies of the same unedited shell. Both of these have gone missing before
// in other projects for dull reasons — a formatter reflowing the div onto two
// lines is enough — and the failure is otherwise invisible until a crawler sees
// it weeks later.
for (const marker of [SEO_START, SEO_END, ROOT_DIV]) {
  if (!template.includes(marker)) {
    throw new Error(
      `prerender: index.html is missing ${JSON.stringify(marker)}. ` +
        `The prerender step splices the per-route <head> and body in at these ` +
        `exact strings; check marketing/index.html.`,
    );
  }
}

const headStart = template.indexOf(SEO_START);
const headEnd = template.indexOf(SEO_END) + SEO_END.length;

/** Splice one route's <head> and rendered body into the shell. */
function documentFor(route) {
  const head = headTagsFor(route);
  const body = render(route.to);
  return (
    template.slice(0, headStart) +
    head +
    template.slice(headEnd)
  ).replace(ROOT_DIV, `<div id="root">${body}</div>`);
}

// ── lastmod, from git ─────────────────────────────────────────────────────
// `lastmod` is one of the few sitemap hints Google still reads, and it only
// reads it while it stays plausible — a file where every URL changed at the
// moment of the last deploy is a file it learns to ignore. So each route's date
// comes from the last commit that touched the files behind it.
//
// %cs is the committer date as bare YYYY-MM-DD, which is already the W3C date
// form the sitemap spec wants, with no timezone to get wrong.
//
// Shallow clones are the expected failure here: CI and Vercel both fetch with a
// truncated history, so a file's last commit may simply not be in the tree. A
// route with no answer is emitted with no `lastmod` rather than with today's —
// omitting the hint costs nothing, inventing it discredits the other four.
function lastCommitDate(paths) {
  const dates = paths
    .map((p) => {
      try {
        return execFileSync("git", ["log", "-1", "--format=%cs", "--", p], {
          cwd: repoRoot,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        }).trim();
      } catch {
        return "";
      }
    })
    .filter(Boolean);
  // The newest of them: a page is as fresh as the most recently changed thing
  // it is built from.
  return dates.sort().at(-1);
}

// ── write ─────────────────────────────────────────────────────────────────
const lastmod = {};
for (const route of ROUTES) {
  lastmod[route.to] = lastCommitDate(route.sources);

  // "/" is the shell's own path, so it overwrites dist/index.html. Everything
  // else becomes a directory index, which is what lets /features be served as a
  // static file without a rewrite.
  const out =
    route.to === "/" ? join(dist, "index.html") : join(dist, route.to, "index.html");
  const html = documentFor(route);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);

  const size = (Buffer.byteLength(html) / 1024).toFixed(1);
  console.log(`  ${route.to.padEnd(14)} → ${size} kB  ${lastmod[route.to] ?? "(no lastmod)"}`);
}

// The 404 renders through the same router, on a path guaranteed not to match a
// real route, so it picks up the catch-all. It gets `noindex`: the page is meant
// to be served for many different bad URLs, and it is the one page on the site
// that should never appear in results. `headTagsFor` is skipped entirely — a
// canonical here would be a lie, since this document stands in for whatever URL
// was asked for rather than for one address of its own.
const notFoundHead = [
  `<title>${NOT_FOUND_HEAD.title}</title>`,
  `<meta name="robots" content="${NOT_FOUND_HEAD.robots}" />`,
].join("\n    ");
writeFileSync(
  join(dist, "404.html"),
  (template.slice(0, headStart) + notFoundHead + template.slice(headEnd)).replace(
    ROOT_DIV,
    `<div id="root">${render("/__not_found__")}</div>`,
  ),
);
console.log("  404            → dist/404.html (noindex)");

writeFileSync(join(dist, "sitemap.xml"), sitemapXml(lastmod));
writeFileSync(join(dist, "robots.txt"), robotsTxt());
console.log(`  sitemap.xml    → ${ROUTES.length} URLs`);
console.log("  robots.txt     → written");
