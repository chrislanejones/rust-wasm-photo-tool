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

/** Canonical origin. No trailing slash — every helper here joins paths onto it,
 *  and a doubled slash is a different URL to a crawler than the one we claim. */
export const SITE_URL = "https://imagehorse.app";

/** Where the editor lives. A different host to the marketing site, so it is
 *  deliberately NOT in the sitemap: it is an app, not a document, and letting
 *  it compete for the same queries splits the signal across two hostnames. */
export const APP_URL = "https://app.imagehorse.app";

export const SITE_NAME = "Image Horse";

/** The site-wide social card, used when a route declares no image of its own.
 *  Raster, not the SVG logo: X/Twitter and LinkedIn both ignore SVG in
 *  `og:image`, so an SVG here is the same as no card at all. */
export const DEFAULT_OG_IMAGE = "/og/default.png";
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

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
    to: "/features",
    label: "Features",
    title: "Features — every tool in the Image Horse photo editor",
    description:
      "Clone stamp, crop, layers, Bézier pen, text and shapes, background removal, OCR, batch rename, PNG/JPEG/WebP/AVIF export — the full list, grouped and searchable.",
    ogImage: "/og/features.png",
    sources: ["marketing/src/pages/Features.tsx", "marketing/src/data/features.ts"],
  },
  {
    to: "/pricing",
    label: "Pricing",
    title: "Pricing — free with no account, Pro at $10 a month",
    description:
      "Every editing tool is free and needs no signup. Signing in adds cloud sync; Pro adds background removal, object removal, 4× upscale and 5 GB of originals.",
    ogImage: "/og/pricing.png",
    sources: ["marketing/src/pages/Pricing.tsx"],
  },
  {
    to: "/trail-log",
    label: "Trail Log",
    title: "Trail Log — every Image Horse release, dated",
    description:
      "The full changelog: what shipped, when, and how much of it. Commit graphs per month, release notes per version, filterable by feature, fix, perf and infra.",
    ogImage: "/og/trail-log.png",
    sources: ["marketing/src/data/releases.ts", "marketing/src/pages/Trail.tsx"],
    ogType: "article",
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
 * than stars. Same reasoning for `FAQPage`: the markup is only allowed for
 * questions and answers actually visible on the page, and none of these pages
 * has an FAQ section yet.
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
        description: "Adds cloud sync for edits, 24 images and 3 projects.",
      },
      {
        "@type": "Offer",
        name: "Pro",
        price: "10",
        priceCurrency: "USD",
        description:
          "Cloud originals (5 GB), 16 layers, background and object removal, 4× upscale, unlimited AI passes.",
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

/* ── sitemap.xml / robots.txt ───────────────────────────────────────────── */

/** `lastmod` per route, supplied by the caller (the prerender script reads it
 *  from git). A route with no known date is emitted without `lastmod` rather
 *  than with today's — an invented date is the thing that gets the file
 *  ignored. */
export function sitemapXml(lastmod: Record<string, string | undefined>): string {
  const entries = ROUTES.map((r) => {
    const date = lastmod[r.to];
    return [
      "  <url>",
      `    <loc>${abs(r.to)}</loc>`,
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
