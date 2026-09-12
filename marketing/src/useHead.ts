import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  DEFAULT_OG_IMAGE,
  NOT_FOUND_HEAD,
  SITE_NAME,
  abs,
  jsonLdFor,
  routeFor,
  type Route,
} from "./seo";

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

export function applyHead(route: Route) {
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
  for (const key of ["og:url", "og:title", "og:description", "og:type", "og:image"]) {
    drop(`meta[property="${key}"]`);
  }
}

export default function useHead() {
  const { pathname } = useLocation();
  useEffect(() => {
    const route = routeFor(pathname);
    if (route) applyHead(route);
    else applyNotFoundHead();
  }, [pathname]);
}
