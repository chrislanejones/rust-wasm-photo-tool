/* The blog's table of contents.
 *
 * METADATA ONLY — no JSX, no component imports, nothing that reaches for a
 * browser global. seo.ts imports this module to build the sitemap, the per-post
 * <head> and the BlogPosting graph, and seo.ts is loaded under Node by
 * scripts/prerender.mjs. Importing a post's .tsx body here would drag the whole
 * React tree into the sitemap's import graph for nothing.
 *
 * The bodies live in src/posts/<slug>.tsx and are wired to these entries by
 * src/posts/registry.tsx — the one module that knows about both halves. A post
 * with an entry here and no body in the registry fails the build rather than
 * shipping a headline over an empty page; see the registry for that check.
 *
 * Newest first. This order is the order on /blog, and the first entry is the
 * one the home page shows.
 */

export type PostTag = "engineering" | "rust" | "performance" | "privacy" | "design";

export interface Post {
  /** URL segment — the post lives at `/blog/<slug>`.
   *
   *  Treat it as permanent. It is the canonical URL, the og:url, the sitemap
   *  entry and whatever anyone pasted into a chat six months ago; renaming it
   *  breaks all four at once for a cosmetic gain. */
  slug: string;

  /** The on-page <h1>. Free to run long and to be two sentences — it is set in
   *  display type and it is the first thing read. */
  headline: string;

  /** The <title>. Keep under ~60 characters INCLUDING the " — Image Horse"
   *  suffix that `postTitle` adds, or Google truncates mid-phrase. This is
   *  separate from `headline` on purpose: the headline is written for a reader
   *  who has already landed, the title for someone scanning ten blue links. */
  title: string;

  /** The standfirst under the headline. One sentence, sets up the argument. */
  deck: string;

  /** <meta name="description">, 140–160 characters. Not a ranking factor — it
   *  is the pitch under the blue link. */
  description: string;

  /** ISO `YYYY-MM-DD`. Spec form, not display form: it goes into
   *  `<time datetime>`, the BlogPosting graph and the sitemap verbatim, and
   *  every one of those reads ISO. `fmtPostDate` turns it into prose. */
  published: string;

  /** Set only when the post is materially revised after publication — a typo
   *  fix is not a revision. It becomes `dateModified` in the article graph,
   *  and a `dateModified` that moves on every deploy is the thing that gets
   *  the whole graph distrusted. */
  updated?: string;

  /** The release this post is about, if it is about one. Shown in the dateline
   *  in mono, matching the Trail Log's version chips. */
  version?: string;

  /** One tag, for the filter on /blog. Deliberately singular: a post with four
   *  tags is a post that has not decided what it is about. */
  tag: PostTag;

  /** Files whose last commit dates this post for the sitemap's `lastmod`.
   *  Repo-relative, same contract as `Route.sources` in seo.ts — include the
   *  primary sources the post draws on, so a post whose evidence moved reads
   *  as freshly touched and one that nobody edited does not. */
  sources: string[];

  /** Social card, site-relative. Falls back to the site default.
   *
   *  Left unset until the PNG is actually committed. `pnpm gen:og` writes one
   *  card per post to public/og/blog/<slug>.png — it needs a Chromium
   *  (`pnpm exec playwright install chromium`) and is deliberately not part of
   *  `pnpm build`. Point this at "/og/blog/<slug>.png" once that file is in the
   *  repo, and not before: a route claiming a card that is not there unfurls as
   *  a broken image, which is worse than the generic one. */
  ogImage?: string;
}

export const POSTS: readonly Post[] = [
  {
    slug: "engine-in-a-worker",
    headline: "We moved the engine off the main thread. The pixels stayed put.",
    title: "Moving a Rust engine into a Web Worker",
    deck: "How Image Horse moved its Rust engine into a worker without ever sending a frame across a thread boundary — and why the obvious way to do it is impossible.",
    description:
      "The Rust engine behind Image Horse now runs in a Web Worker. Heavy operations blocked the UI for 129–137 ms; they block it for none. Here is what it took.",
    published: "2026-08-13",
    version: "v8.32",
    tag: "engineering",
    sources: [
      "marketing/src/posts/engine-in-a-worker.tsx",
      "docs/adr/024-engine-in-a-worker.md",
      "docs/engine-worker-feasibility.md",
    ],
  },
] as const;

/** The post for a slug, or `undefined`. Returns the miss rather than a fallback
 *  for the same reason `routeFor` does — a fallback would let a junk URL render
 *  a real post's canonical, which invites a crawler to index the junk as a
 *  duplicate of the real thing. Callers handle the miss. */
export const postFor = (slug: string): Post | undefined => POSTS.find((p) => p.slug === slug);

/** `/blog/<slug>` — the one place the URL shape is written down. */
export const postPath = (post: Post) => `/blog/${post.slug}`;

/** Display form: "13 August 2026".
 *
 *  Parsed off the string rather than through `new Date(iso)`, which reads a
 *  bare ISO date as UTC midnight and renders it in the reader's local zone —
 *  so anyone west of Greenwich sees a post published a day early.
 *
 *  This is deliberately the same shape and the same technique as `fmtDate` in
 *  pages/Trail.tsx, so a date on /blog and a date on /trail-log cannot read
 *  differently. It is duplicated rather than extracted because there are two
 *  of them; if a third appears, that is the moment to lift all three into one
 *  module rather than now. */
const MONTHS_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const fmtPostDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${parseInt(d, 10)} ${MONTHS_FULL[parseInt(m, 10) - 1]} ${y}`;
};
