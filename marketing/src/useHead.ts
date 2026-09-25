import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  AUTHOR,
  BLOG_BASE,
  DEFAULT_OG_IMAGE,
  NOT_FOUND_HEAD,
  SITE_NAME,
  abs,
  jsonLdFor,
  jsonLdForPost,
  postTitle,
  postUrl,
  routeFor,
  type Route,
} from "./seo";
import { postFor, type Post } from "./data/posts";

/* Keeps <head> honest across client-side navigation.
 *
 * Every route ships prerendered, so the FIRST page a visitor lands on already
 * has the right title, description, canonical and JSON-LD baked into the HTML —
 * that is the copy crawlers read, and this hook never has to produce it.
 *
 * What this is for is the soft navigation afterwards. React Router swaps the
 * body and leaves <head> exactly as the server sent it, so without this the tab
 * title, the canonical and the share card all keep describing whichever page
 * the visitor entered on. That matters in three places that are easy to forget:
 * the browser tab and history entry, anything that reads the live DOM (the
 * share sheet on Android, Safari's Reading List), and a crawler that executes
 * JS and follows in-app links rather than re-requesting each URL.
 *
 * It is written to be idempotent: running it on mount re-applies the values the
 * prerender already wrote, which is a no-op rather than a correction.
 */

/** Find an existing tag or create it, so repeat navigations reuse one node
 *  instead of stacking a fresh `<meta>` per visit. */
function upsert(selector: string, create: () => HTMLElement): HTMLElement {
  const existing = document.head.querySelector<HTMLElement>(selector);
  if (existing) return existing;
  const el = create();
  document.head.appendChild(el);
  return el;
}

const meta = (attr: "name" | "property", key: string, content: string) => {
  const el = upsert(`meta[${attr}="${key}"]`, () => {
    const m = document.createElement("meta");
    m.setAttribute(attr, key);
    return m;
  });
  el.setAttribute("content", content);
};

const link = (rel: string, href: string) => {
  const el = upsert(`link[rel="${rel}"]`, () => {
    const l = document.createElement("link");
    l.setAttribute("rel", rel);
    return l;
  });
  el.setAttribute("href", href);
};

const drop = (selector: string) => document.head.querySelector(selector)?.remove();

function applyHead(route: Route) {
  const url = abs(route.to);
  const image = abs(route.ogImage ?? DEFAULT_OG_IMAGE);

  document.title = route.title;
  meta("name", "description", route.description);
  link("canonical", url);

  meta("property", "og:type", route.ogType ?? "website");
  meta("property", "og:site_name", SITE_NAME);
  meta("property", "og:title", route.title);
  meta("property", "og:description", route.description);
  meta("property", "og:url", url);
  meta("property", "og:image", image);
  meta("property", "og:image:alt", route.title);

  // Clear a `noindex` that applyNotFoundHead may have left on the document.
  // Navigating 404 → real page and keeping the noindex would be invisible to a
  // human and fatal to a crawler that followed the same path.
  drop('meta[name="robots"]');

  // Same argument, one page over: navigating post → page leaves this document
  // claiming a publication date and an author that belong to an article the
  // reader has left. og:type is overwritten above; these have no page
  // equivalent to overwrite them, so they have to be removed.
  dropArticleTags();

  meta("name", "twitter:card", "summary_large_image");
  meta("name", "twitter:title", route.title);
  meta("name", "twitter:description", route.description);
  meta("name", "twitter:image", image);

  // Replace the graph rather than appending one: two `@graph` blocks claiming
  // different `WebPage` nodes for one URL is a contradiction, and the crawler
  // is under no obligation to pick the newer one.
  const ld = upsert('script[type="application/ld+json"]', () => {
    const s = document.createElement("script");
    s.type = "application/ld+json";
    return s;
  });
  ld.textContent = jsonLdFor(route);
}

/** The `article:*` properties. Only ever present on a post. */
const ARTICLE_TAGS = [
  "article:published_time",
  "article:modified_time",
  "article:author",
  "article:section",
] as const;

const dropArticleTags = () => {
  for (const key of ARTICLE_TAGS) drop(`meta[property="${key}"]`);
};

/** The live-DOM twin of `postHeadTagsFor` in seo.ts.
 *
 *  The two have to agree, and they are two functions because they write to two
 *  different things — one builds a string at build time, this one mutates a
 *  document that already has another page's tags on it. The prerendered HTML is
 *  what crawlers read; this is what keeps the tab title, the share sheet and the
 *  canonical honest after a client-side navigation. */
function applyPostHead(post: Post) {
  const url = postUrl(post);
  const image = abs(post.ogImage ?? DEFAULT_OG_IMAGE);
  const title = postTitle(post);

  document.title = title;
  meta("name", "description", post.description);
  link("canonical", url);

  meta("property", "og:type", "article");
  meta("property", "og:site_name", SITE_NAME);
  meta("property", "og:title", title);
  meta("property", "og:description", post.description);
  meta("property", "og:url", url);
  meta("property", "og:image", image);
  meta("property", "og:image:alt", post.headline);

  meta("property", "article:published_time", post.published);
  // Set it or clear it — never leave the previous post's revision date on a
  // post that has never been revised.
  if (post.updated) meta("property", "article:modified_time", post.updated);
  else drop('meta[property="article:modified_time"]');
  meta("property", "article:author", AUTHOR.name);
  meta("property", "article:section", post.tag);

  drop('meta[name="robots"]');

  meta("name", "twitter:card", "summary_large_image");
  meta("name", "twitter:title", title);
  meta("name", "twitter:description", post.description);
  meta("name", "twitter:image", image);

  const ld = upsert('script[type="application/ld+json"]', () => {
    const s = document.createElement("script");
    s.type = "application/ld+json";
    return s;
  });
  ld.textContent = jsonLdForPost(post);
}

/** The head for a URL that matches no route.
 *
 *  This runs on a client-side navigation to a bad link — a hard load of one gets
 *  404.html, which already carries these tags. The removals are the important
 *  part: arriving here from a real page leaves that page's canonical, og:url and
 *  JSON-LD in the document, and every one of them would now be describing the
 *  wrong URL. A stale canonical is the worst of the three, since it actively
 *  tells a crawler this address is a copy of the page the visitor came from. */
function applyNotFoundHead() {
  document.title = NOT_FOUND_HEAD.title;
  meta("name", "robots", NOT_FOUND_HEAD.robots);

  drop('link[rel="canonical"]');
  drop('script[type="application/ld+json"]');
  dropArticleTags();
  for (const key of ["og:url", "og:title", "og:description", "og:type", "og:image"]) {
    drop(`meta[property="${key}"]`);
  }
}

/** The post a pathname names, if it names one. `/blog` itself is a Route and
 *  is handled before this is reached; only `/blog/<slug>` gets here. */
function postOnPath(pathname: string): Post | undefined {
  const prefix = `${BLOG_BASE}/`;
  if (!pathname.startsWith(prefix)) return undefined;
  // One segment only. `/blog/a/b` is not a post, and treating it as one would
  // hand `postFor` the string "a/b" and get a miss anyway — but by the longer
  // route, through a lookup that looks like it should have worked.
  const slug = pathname.slice(prefix.length);
  return slug && !slug.includes("/") ? postFor(slug) : undefined;
}

export default function useHead() {
  const { pathname } = useLocation();
  useEffect(() => {
    const route = routeFor(pathname);
    if (route) return applyHead(route);

    const post = postOnPath(pathname);
    if (post) return applyPostHead(post);

    applyNotFoundHead();
  }, [pathname]);
}
