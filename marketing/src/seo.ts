/* Everything a crawler reads, in one table.
 *
 * The nav, the footer, the ⌘K palette, the sitemap, the prerendered <head> of
 * each route and the head-sync on client navigation ALL read `ROUTES` below.
 * That is the whole point: a page's title used to be able to disagree with its
 * sitemap entry, and a sitemap that lists a URL the router doesn't serve is a
 * soft-404 that costs crawl budget. One list means a route is either in all of
 * it or in none of it.
 *
 * This module must stay free of browser globals — the prerender step imports it
 * under Node to build the <head> and the sitemap. Nothing here may touch
 * `window`, `document` or `matchMedia`.
 */

import { POSTS, postPath, type Post } from "./data/posts";
import { OPENRASTER_FAQ } from "./data/openraster";
import { FEATURES } from "./data/features";

/** Counted, not typed: the feature list is generated from docs/Features.md, so a
 *  number written into a description goes stale the next time a feature lands. */
const FEATURE_COUNT = FEATURES.reduce((n, g) => n + g.items.length, 0);

/** Canonical origin. No trailing slash — every helper here joins paths onto it,
 *  and a doubled slash is a different URL to a crawler than the one we claim. */
export const SITE_URL = "https://imagehorse.app";

/** Where the editor lives. A different host to the marketing site, so it is
 *  deliberately NOT in the sitemap: it is an app, not a document, and letting
 *  it compete for the same queries splits the signal across two hostnames. */
export const APP_URL = "https://edit.imagehorse.app";

export const SITE_NAME = "Image Horse";

/** The site-wide social card, used when a route declares no image of its own.
 *  Raster, not the SVG logo: X/Twitter and LinkedIn both ignore SVG in
 *  `og:image`, so an SVG here is the same as no card at all. */
export const DEFAULT_OG_IMAGE = "/og/default.png";
const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;

/** Absolute URL for a site-relative path. Open Graph requires absolute URLs —
 *  a relative `og:image` is silently dropped by most scrapers. */
export const abs = (path: string) => `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;

export interface Route {
  /** Router path, and the sitemap URL. Always starts with "/". */
  to: string;
  /** Nav / footer / palette label. */
  label: string;
  /** The full <title>. Keep under ~60 characters: past that Google truncates
   *  in the middle of the phrase you were trying to rank for. */
  title: string;
  /** The <meta name="description">. 140–160 characters. This is not a ranking
   *  factor on its own — it is the click-through pitch under the blue link. */
  description: string;
  /** Social card for this route, site-relative. Falls back to the default. */
  ogImage?: string;
  /** Files whose last commit dates this route, for the sitemap's `lastmod`.
   *  Paths are repo-relative. `lastmod` is one of the few sitemap fields
   *  Google actually reads, and only when it is honest — so it is derived from
   *  git rather than stamped with the build time, which would claim every page
   *  changed on every deploy and get the whole file distrusted. */
  sources: string[];
  /** `og:type`. "website" for the home page, "article" for the log. */
  ogType?: "website" | "article";
  /** Footer only: in the sitemap and the prerender, out of the nav and the
   *  palette. The legal pages are reference documents — a reader goes looking
   *  for them, so they do not earn a slot in a nav that is otherwise seven
   *  places you might want to go. They stay in ROUTES because the sitemap and
   *  the prerendered <head> are exactly what they need. */
  footerOnly?: boolean;
  /** A tool landing page: in the sitemap, the prerender and the mega-menu, out
   *  of the footer's main column, which is a list of places on the site rather
   *  than a list of jobs the editor does. `toolPages.ts` carries their content;
   *  this table carries only what a crawler reads. */
  toolPage?: boolean;
  /** Questions answered ON the page. Read by the page for its FAQ section and
   *  by `jsonLdFor` for a FAQPage node — the same list, so the markup can never
   *  name a question the visitor cannot see. */
  faq?: readonly { q: string; a: string }[];
}

/** Every page, in nav order. A new page appears in the nav, the mobile sheet,
 *  the footer, the palette, the sitemap AND the prerender by being added here —
 *  or in none of them. */
export const ROUTES: readonly Route[] = [
  {
    to: "/",
    label: "Home",
    title: "Image Horse — private photo editor that runs in your browser",
    description:
      "Crop, compress, annotate and batch-edit photos without uploading them. A Rust and WebAssembly image editor that runs on your own machine — no account needed.",
    ogImage: "/og/default.png",
    sources: ["marketing/src/pages/Home.tsx"],
    ogType: "website",
  },
  {
    to: "/architecture",
    label: "Architecture",
    title: "How Image Horse works — Rust, WASM and an optional cloud",
    description:
      "A map of the whole system: what runs in your tab, what only runs when you sign in, and what the editor still does with the network cut off entirely.",
    ogImage: "/og/architecture.png",
    sources: ["marketing/src/pages/Architecture.tsx", "marketing/src/data/schema.ts"],
  },
  {
    to: "/blog",
    label: "Blog",
    title: "The changelog says what. This says why.",
    description:
      "Long-form notes on how Image Horse is built: what shipped, what it cost, and the measurements behind each decision. No roadmaps, no announcements.",
    ogImage: "/og/blog.png",
    sources: ["marketing/src/pages/Blog.tsx", "marketing/src/data/posts.ts"],
    ogType: "website",
  },
  {
    to: "/features",
    label: "Features",
    title: "Features — everything the Image Horse editor does",
    description:
      `All ${FEATURE_COUNT} features of a photo editor that runs in your browser: annotate, select, enhance, export. A plain line for each, and the engineering line underneath.`,
    ogImage: "/og/features.png",
    sources: ["marketing/src/pages/Features.tsx", "marketing/src/data/features.ts"],
  },
  {
    to: "/openraster",
    label: "OpenRaster (.ora)",
    title: "Open .ora files in your browser — OpenRaster viewer",
    description:
      "See every layer of an OpenRaster (.ora) file in your browser, nothing uploaded. What a .ora holds, how Image Horse exports and imports one, and what survives.",
    ogImage: "/og/openraster.png",
    sources: [
      "marketing/src/pages/OpenRaster.tsx",
      "marketing/src/components/OraViewer.tsx",
      "marketing/src/lib/ora.ts",
      "marketing/src/data/openraster.ts",
    ],
    faq: OPENRASTER_FAQ,
  },
  {
    to: "/pricing",
    label: "Pricing",
    title: "Image Horse pricing — free with no account, Pro at $10/mo",
    description:
      "Every editing tool is free and needs no signup. Signing in adds cloud sync; Pro adds background removal, object removal, text extraction and 5 GB of storage.",
    ogImage: "/og/pricing.png",
    sources: ["marketing/src/pages/Pricing.tsx"],
  },
  {
    to: "/about",
    label: "About",
    title: "About Image Horse — the developer, and the horse",
    description:
      "Image Horse is built by Chris Lane Jones, a web developer in Jacksonville, Florida. This is who works on it, and the horse it is named after.",
    ogImage: "/og/about.png",
    sources: ["marketing/src/pages/About.tsx", "marketing/src/data/people.ts"],
  },
  {
    to: "/trail-log",
    label: "Trail Log",
    title: "Trail Log — every Image Horse release, in the open",
    description:
      "Every Image Horse release, newest first: what shipped, when, and the commits behind it. Pick a month to see its commit graph and highlights, or read it all.",
    ogImage: "/og/trail-log.png",
    sources: ["marketing/src/data/releases.ts", "marketing/src/pages/Trail.tsx"],
    ogType: "article",
  },
  {
    to: "/contact",
    ogImage: "/og/contact.png",
    label: "Contact",
    title: "Contact Image Horse — email, bugs and security",
    description:
      "Email the developer, report a bug on GitHub or Codeberg, send a security problem privately, or ask for your account to be deleted. One person reads all of it.",
    sources: ["marketing/src/pages/Contact.tsx"],
    footerOnly: true,
  },
  {
    to: "/privacy-policy",
    ogImage: "/og/privacy-policy.png",
    label: "Privacy Policy",
    title: "Privacy Policy — Image Horse",
    description:
      "What stays on your machine, what leaves it, and what you can switch off. Editing runs in your browser; the exceptions are named here one by one.",
    sources: ["marketing/src/pages/PrivacyPolicy.tsx"],
    footerOnly: true,
  },
  {
    to: "/terms-of-service",
    ogImage: "/og/terms-of-service.png",
    label: "Terms of Service",
    title: "Terms of Service — Image Horse",
    description:
      "The terms for using Image Horse: your pictures stay yours, the software is beta and free, and the paid tier bills monthly through Stripe.",
    sources: ["marketing/src/pages/TermsOfService.tsx"],
    footerOnly: true,
  },
  {
    to: "/in-the-works",
    ogImage: "/og/in-the-works.png",
    label: "What's coming",
    title: "What's coming to Image Horse — building, decided, ideas",
    description:
      "What is being built, what is decided and what is still an idea. No dates: when something ships it moves to the Trail Log and comes off this page.",
    sources: ["marketing/src/pages/ComingSoon.tsx"],
  },
  {
    to: "/photo-editor",
    ogImage: "/og/photo-editor.png",
    label: "Photo editor",
    title: "Free photo editor that runs in your browser — no upload",
    description:
      "Crop, straighten and correct exposure without uploading anything. Twelve presets preview on your own photo, every step undoes, and no account is needed.",
    sources: ["marketing/src/pages/ToolLanding.tsx", "marketing/src/data/toolPages.ts"],
    toolPage: true,
  },
  {
    to: "/image-compressor",
    ogImage: "/og/image-compressor.png",
    label: "Image compressor",
    title: "Image compressor — hit a target file size in your browser",
    description:
      "Compress to an exact file size or a percentage in WebP, AVIF, JPEG or PNG. Runs on your own machine, shows the page-speed effect, and does whole folders at once.",
    sources: ["marketing/src/pages/ToolLanding.tsx", "marketing/src/data/toolPages.ts"],
    toolPage: true,
  },
  {
    to: "/background-remover",
    ogImage: "/og/background-remover.png",
    label: "Background remover",
    title: "Background remover — cut out a subject cleanly",
    description:
      "One click lifts the subject off its background with a clean edge, including hair. Runs on a server and needs Pro; the job is deleted once the result comes back.",
    sources: ["marketing/src/pages/ToolLanding.tsx", "marketing/src/data/toolPages.ts"],
    toolPage: true,
  },
  {
    to: "/remove-object-from-photo",
    ogImage: "/og/remove-object-from-photo.png",
    label: "Remove an object",
    title: "Remove an object from a photo — free, in your browser",
    description:
      "Paint over what you want gone and the Magic Eraser fills it from the surrounding pixels on your own machine, free. Pro adds an AI pass for harder cases.",
    sources: ["marketing/src/pages/ToolLanding.tsx", "marketing/src/data/toolPages.ts"],
    toolPage: true,
  },
  {
    to: "/annotate-image",
    ogImage: "/og/annotate-image.png",
    label: "Annotate an image",
    title: "Annotate an image — arrows, boxes, pins and text",
    description:
      "Add arrows, boxes, numbered pins, speech bubbles, real text and emoji. Everything stays editable until export, snaps to a grid, and never leaves your machine.",
    sources: ["marketing/src/pages/ToolLanding.tsx", "marketing/src/data/toolPages.ts"],
    toolPage: true,
  },
  {
    to: "/clone-stamp",
    ogImage: "/og/clone-stamp.png",
    label: "Clone stamp",
    title: "Clone stamp tool — paint one part of a photo over another",
    description:
      "Alt-click a source, then paint: those pixels follow your brush. Adjustable size, hardness, opacity and spacing, with a stabilizer to steady the stroke.",
    sources: ["marketing/src/pages/ToolLanding.tsx", "marketing/src/data/toolPages.ts"],
    toolPage: true,
  },
  {
    to: "/pixelate-image",
    ogImage: "/og/pixelate-image.png",
    label: "Pixelate an image",
    title: "Pixelate an image — block out a face or a password",
    description:
      "Paint a region into blocks, or use a hard black box. Runs on your machine and exports flattened, so the covered pixels are genuinely gone from the file.",
    sources: ["marketing/src/pages/ToolLanding.tsx", "marketing/src/data/toolPages.ts"],
    toolPage: true,
  },
  {
    to: "/blur-image",
    ogImage: "/og/blur-image.png",
    label: "Blur an image",
    title: "Blur an image — soften a background or hide a detail",
    description:
      "Brush a blur over one part of a photo or blur the whole thing with a slider. Radius and strength are yours to set, and it runs on your own machine.",
    sources: ["marketing/src/pages/ToolLanding.tsx", "marketing/src/data/toolPages.ts"],
    toolPage: true,
  },
  {
    to: "/batch-image-editor",
    ogImage: "/og/batch-image-editor.png",
    label: "Batch image editor",
    title: "Batch image editor — do one thing to a whole folder",
    description:
      "Resize, compress, stamp a logo or text, and rename a whole folder of photos in one pass. Runs on your own machine and exports the lot as a ZIP.",
    sources: ["marketing/src/pages/ToolLanding.tsx", "marketing/src/data/toolPages.ts"],
    toolPage: true,
  },
  {
    to: "/image-editor-no-upload",
    ogImage: "/og/image-editor-no-upload.png",
    label: "No-upload image editor",
    title: "Image editor with no upload — everything stays on your machine",
    description:
      "Edit photos without uploading them anywhere. The engine runs in your browser, your files stay in local storage, and every exception is named on this page.",
    sources: ["marketing/src/pages/ToolLanding.tsx", "marketing/src/data/toolPages.ts"],
    toolPage: true,
  },
] as const;

/** The route for a path, or `undefined` if there isn't one.
 *
 *  It returns `undefined` rather than falling back to the home route, and the
 *  difference is not cosmetic. With a fallback, a client-side navigation to a
 *  bad URL rewrote the 404 page's <head> with the HOME page's title and — much
 *  worse — `<link rel="canonical" href="https://imagehorse.app/">`. That is a
 *  page telling Google "the canonical version of this URL is the home page",
 *  which invites it to index junk URLs as duplicates of the front page. Callers
 *  must handle the miss; `useHead` does, with NOT_FOUND_HEAD below. */
export const routeFor = (pathname: string): Route | undefined =>
  ROUTES.find((r) => r.to === pathname);

/** What <head> should say for a URL that matches no route. No canonical at all:
 *  this document stands in for whatever wrong address was asked for, so it has
 *  no one URL of its own to name — and naming the wrong one is worse than
 *  naming none. `follow` keeps any links on it live. */
export const NOT_FOUND_HEAD = {
  title: "Page not found — Image Horse",
  robots: "noindex, follow",
} as const;

/* ── structured data ────────────────────────────────────────────────────────
 * Three graphs, and a deliberate omission.
 *
 * `Organization` and `WebSite` go on every page so the brand and the site are
 * described once, consistently. `SoftwareApplication` carries the pricing, and
 * `BreadcrumbList` gives the subpages a trail back to the root.
 *
 * NOT here: `aggregateRating`. It is what makes Google draw stars next to a
 * result, and it is the single most tempting thing on this list to invent.
 * There are no reviews to aggregate, so marking any up would be false, is
 * against Google's structured-data policy, and earns a manual action rather
 * than stars. `FAQPage` is held to the same rule: the markup is only allowed
 * for questions and answers actually visible on the page, so it appears only
 * on a route that declares `faq`, and the page renders that same list.
 */

const ORGANIZATION_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;

const organization = () => ({
  "@type": "Organization",
  "@id": ORGANIZATION_ID,
  name: SITE_NAME,
  url: SITE_URL,
  logo: {
    "@type": "ImageObject",
    url: abs("/Image-Horse-Logo.svg"),
  },
  sameAs: [
    "https://github.com/chrislanejones/rust-wasm-photo-tool",
    "https://codeberg.org/chrislanejones/rust-wasm-photo-tool",
  ],
});

const website = () => ({
  "@type": "WebSite",
  "@id": WEBSITE_ID,
  name: SITE_NAME,
  url: SITE_URL,
  publisher: { "@id": ORGANIZATION_ID },
  inLanguage: "en",
});

/** The product itself. `offers` is an AggregateOffer spanning the real tiers —
 *  $0 with no account through $10/month — because that is what the pricing page
 *  says, and structured data that disagrees with the visible page is worse than
 *  none. */
const softwareApplication = () => ({
  "@type": "SoftwareApplication",
  "@id": `${SITE_URL}/#app`,
  name: SITE_NAME,
  url: APP_URL,
  applicationCategory: "MultimediaApplication",
  applicationSubCategory: "Photo Editor",
  operatingSystem: "Any — runs in a web browser",
  browserRequirements: "Requires WebAssembly. Chrome, Edge, Firefox or Safari.",
  description:
    "A browser image editor built in Rust and shipped as WebAssembly. Editing runs on your own machine; sign-in and the AI passes are the only things that reach a server.",
  publisher: { "@id": ORGANIZATION_ID },
  isAccessibleForFree: true,
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "USD",
    lowPrice: "0",
    highPrice: "10",
    offerCount: 3,
    offers: [
      {
        "@type": "Offer",
        name: "Demo",
        price: "0",
        priceCurrency: "USD",
        description: "Every WASM tool, 8 layers per image, 12-image gallery. No signup.",
      },
      {
        "@type": "Offer",
        name: "Free",
        price: "0",
        priceCurrency: "USD",
        description: "Adds cloud sync for edits, 24 images and 100 MB of cloud storage.",
      },
      {
        "@type": "Offer",
        name: "Pro",
        price: "10",
        priceCurrency: "USD",
        description:
          "5 GB of cloud storage, 16 layers, background and object removal, text extraction, 50 AI passes a day and 300 a month.",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: "10",
          priceCurrency: "USD",
          billingIncrement: 1,
          unitCode: "MON",
        },
      },
    ],
  },
});

/** The page's own questions, only where the page shows them (`Route.faq`). */
const faqPage = (route: Route) =>
  route.faq?.length
    ? {
        "@type": "FAQPage",
        "@id": `${abs(route.to)}#faq`,
        mainEntity: route.faq.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      }
    : null;

/** Home is the root, so it gets no breadcrumb — a one-item trail is noise. */
const breadcrumbs = (route: Route) =>
  route.to === "/"
    ? null
    : {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: route.label, item: abs(route.to) },
        ],
      };

/** The page itself, tied to the site and the brand. */
const webPage = (route: Route) => ({
  "@type": "WebPage",
  "@id": `${abs(route.to)}#webpage`,
  url: abs(route.to),
  name: route.title,
  description: route.description,
  isPartOf: { "@id": WEBSITE_ID },
  about: { "@id": `${SITE_URL}/#app` },
  primaryImageOfPage: { "@type": "ImageObject", url: abs(route.ogImage ?? DEFAULT_OG_IMAGE) },
  inLanguage: "en",
});

/* ── the blog ───────────────────────────────────────────────────────────────
 * A post is not a Route, and making it one was the first thing tried. Routes
 * are the five things in the nav: they have a label, they are in the sitemap in
 * nav order, and the ⌘K palette lists every one of them. Posts have an author,
 * two dates and a body, they are not in the nav, and there will be more of them
 * than a nav could hold. Forcing both into one array meant `label` was dead
 * weight on posts and `datePublished` was dead weight on pages.
 *
 * So there are two lists, and they meet in exactly three places — the sitemap
 * below, `useHead`, and scripts/prerender.mjs. All three are in this file's
 * import graph or read from it, which is what keeps a post from existing in the
 * router and not in the sitemap.
 */

export const BLOG_BASE = "/blog";

/** The byline. One constant rather than a string per post: every post here is
 *  written by the person who wrote the code it describes, and a name typed six
 *  times is a name that will be spelled two ways by the tenth post. */
export const AUTHOR = {
  name: "Chris Lane Jones",
  url: "https://github.com/chrislanejones",
} as const;

const AUTHOR_ID = `${SITE_URL}/#author`;
const BLOG_ID = `${SITE_URL}${BLOG_BASE}#blog`;

const person = () => ({
  "@type": "Person",
  "@id": AUTHOR_ID,
  name: AUTHOR.name,
  url: AUTHOR.url,
});

/** The <title> for a post. The suffix is appended here rather than typed into
 *  every entry, so it cannot drift on one post — and `Post.title` stays short
 *  enough that the pair still clears ~60 characters. */
export const postTitle = (post: Post) => `${post.title} — ${SITE_NAME}`;

export const postUrl = (post: Post) => abs(postPath(post));

/** The blog itself, listing its posts. Goes on /blog only. `blogPost` is a bare
 *  list of `@id` references rather than inlined articles: each post describes
 *  itself in full on its own page, and repeating the whole record here would be
 *  two sources for one fact. */
const blogNode = () => ({
  "@type": "Blog",
  "@id": BLOG_ID,
  name: `${SITE_NAME} — Blog`,
  url: abs(BLOG_BASE),
  publisher: { "@id": ORGANIZATION_ID },
  author: { "@id": AUTHOR_ID },
  inLanguage: "en",
  blogPost: POSTS.map((post) => ({ "@id": `${postUrl(post)}#post` })),
});

/** One post.
 *
 *  `dateModified` is emitted only when the post actually declares one. The
 *  tempting alternative — falling back to the build time, or to `datePublished`
 *  — is the same mistake as a sitemap that stamps every URL with today: a field
 *  that moves on every deploy tells a crawler nothing except that this site's
 *  dates are not worth reading. */
const blogPosting = (post: Post) => ({
  "@type": "BlogPosting",
  "@id": `${postUrl(post)}#post`,
  headline: post.headline,
  name: postTitle(post),
  description: post.description,
  url: postUrl(post),
  datePublished: post.published,
  ...(post.updated ? { dateModified: post.updated } : {}),
  author: { "@id": AUTHOR_ID },
  publisher: { "@id": ORGANIZATION_ID },
  isPartOf: { "@id": BLOG_ID },
  mainEntityOfPage: { "@type": "WebPage", "@id": `${postUrl(post)}#webpage` },
  image: { "@type": "ImageObject", url: abs(post.ogImage ?? DEFAULT_OG_IMAGE) },
  about: { "@id": `${SITE_URL}/#app` },
  inLanguage: "en",
  keywords: post.tag,
});

/** Home → Blog → the post. Three deep, so unlike the subpages it is worth
 *  emitting in full. */
const postBreadcrumbs = (post: Post) => ({
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Blog", item: abs(BLOG_BASE) },
    { "@type": "ListItem", position: 3, name: post.title, item: postUrl(post) },
  ],
});

export const jsonLdForPost = (post: Post) =>
  JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      organization(),
      website(),
      person(),
      blogPosting(post),
      {
        "@type": "WebPage",
        "@id": `${postUrl(post)}#webpage`,
        url: postUrl(post),
        name: postTitle(post),
        description: post.description,
        isPartOf: { "@id": WEBSITE_ID },
        primaryImageOfPage: {
          "@type": "ImageObject",
          url: abs(post.ogImage ?? DEFAULT_OG_IMAGE),
        },
        inLanguage: "en",
      },
      postBreadcrumbs(post),
    ],
  });

/** One `@graph` per page rather than a stack of separate <script> blocks: the
 *  nodes cross-reference each other by `@id`, and a single graph is the only
 *  shape where those references are guaranteed to resolve. */
export const jsonLdFor = (route: Route) =>
  JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      organization(),
      website(),
      softwareApplication(),
      webPage(route),
      breadcrumbs(route),
      faqPage(route),
      // /blog is the one route that is also a container of other documents.
      route.to === BLOG_BASE ? blogNode() : null,
      route.to === BLOG_BASE ? person() : null,
    ].filter(Boolean),
  });

/* ── <head> ─────────────────────────────────────────────────────────────── */

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** The per-route part of <head>, as HTML. The prerender step splices this into
 *  each generated page; `useHead` re-applies the same values to the live DOM on
 *  client navigation, so a soft nav and a hard load end up identical. */
export function headTagsFor(route: Route): string {
  const url = abs(route.to);
  const image = abs(route.ogImage ?? DEFAULT_OG_IMAGE);
  const tags = [
    `<title>${esc(route.title)}</title>`,
    `<meta name="description" content="${esc(route.description)}" />`,
    // The one URL that counts. Without it, every query string and tracking
    // parameter on a shared link is a separate, duplicate page.
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="${route.ogType ?? "website"}" />`,
    `<meta property="og:site_name" content="${esc(SITE_NAME)}" />`,
    `<meta property="og:title" content="${esc(route.title)}" />`,
    `<meta property="og:description" content="${esc(route.description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta property="og:image:width" content="${OG_IMAGE_WIDTH}" />`,
    `<meta property="og:image:height" content="${OG_IMAGE_HEIGHT}" />`,
    `<meta property="og:image:alt" content="${esc(route.title)}" />`,
    `<meta property="og:locale" content="en_US" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(route.title)}" />`,
    `<meta name="twitter:description" content="${esc(route.description)}" />`,
    `<meta name="twitter:image" content="${image}" />`,
    `<script type="application/ld+json">${jsonLdFor(route)}</script>`,
  ];
  return tags.join("\n    ");
}

/** The same job for a post. Not a branch inside `headTagsFor`, because the
 *  differences are not cosmetic: `og:type` is `article` rather than `website`,
 *  the `article:*` properties only exist here, and the JSON-LD is a different
 *  graph entirely. A shared function with five conditionals would be harder to
 *  read than two that each say one thing. */
export function postHeadTagsFor(post: Post): string {
  const url = postUrl(post);
  const image = abs(post.ogImage ?? DEFAULT_OG_IMAGE);
  const title = postTitle(post);
  const tags = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(post.description)}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="article" />`,
    `<meta property="og:site_name" content="${esc(SITE_NAME)}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(post.description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta property="og:image:width" content="${OG_IMAGE_WIDTH}" />`,
    `<meta property="og:image:height" content="${OG_IMAGE_HEIGHT}" />`,
    `<meta property="og:image:alt" content="${esc(post.headline)}" />`,
    `<meta property="og:locale" content="en_US" />`,
    // Facebook and LinkedIn read these; Google reads the JSON-LD below and
    // ignores them. Both are cheap, and the pair disagreeing is the failure
    // mode worth avoiding — so both are built from the same two fields.
    `<meta property="article:published_time" content="${post.published}" />`,
    ...(post.updated
      ? [`<meta property="article:modified_time" content="${post.updated}" />`]
      : []),
    `<meta property="article:author" content="${esc(AUTHOR.name)}" />`,
    `<meta property="article:section" content="${esc(post.tag)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(post.description)}" />`,
    `<meta name="twitter:image" content="${image}" />`,
    `<script type="application/ld+json">${jsonLdForPost(post)}</script>`,
  ];
  return tags.join("\n    ");
}

/* ── sitemap.xml / robots.txt ───────────────────────────────────────────── */

/** `lastmod` per route, supplied by the caller (the prerender script reads it
 *  from git). A route with no known date is emitted without `lastmod` rather
 *  than with today's — an invented date is the thing that gets the file
 *  ignored. */
export function sitemapXml(lastmod: Record<string, string | undefined>): string {
  // Pages first, in nav order, then the posts newest-first — the same order a
  // reader meets them in. A sitemap carries no ranking weight by position, but
  // a file a human can diff against the nav is one whose mistakes get noticed.
  const locs = [...ROUTES.map((r) => r.to), ...POSTS.map(postPath)];
  const entries = locs.map((to) => {
    const date = lastmod[to];
    return [
      "  <url>",
      `    <loc>${abs(to)}</loc>`,
      ...(date ? [`    <lastmod>${date}</lastmod>`] : []),
      "  </url>",
    ].join("\n");
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    "</urlset>",
    "",
  ].join("\n");
}

export function robotsTxt(): string {
  return [
    "# https://imagehorse.app",
    "",
    // Nothing is disallowed, and /assets/ in particular must not be. It holds
    // the stylesheet and the JS bundle, and Google renders a page before it
    // judges it — block those and it sees an unstyled skeleton, reports the page
    // as mobile-unfriendly, and marks the render "loaded with issues". Blocking
    // build assets to save crawl budget is a real pattern and it is the wrong
    // trade every time for a five-page site.
    "User-agent: *",
    "Allow: /",
    "",
    `Sitemap: ${abs("/sitemap.xml")}`,
    "",
  ].join("\n");
}
