import { lazy, type ComponentType } from "react";
import { matchRoutes } from "react-router-dom";

/* Every page, as its own chunk.
 *
 * Until this file existed, all pages shipped in one bundle, so the home page
 * downloaded and parsed every other page before it could hydrate. The worst of
 * them was the Trail Log's release data, 274 KB of the 690 KB. Each page now
 * loads when it is visited, and the entry bundle keeps only what every page
 * shares.
 *
 * ── why not plain React.lazy ────────────────────────────────────────────
 * The site is prerendered (scripts/prerender.mjs) and then hydrated, and both
 * of those need the page in hand BEFORE React renders. renderToString does not
 * wait for a lazy component: it writes the Suspense fallback into the HTML. And
 * a hydration that meets a lazy page still loading leaves that part of the
 * page inert until the chunk lands.
 *
 * So each page is a pair. `preload()` fetches the module and keeps it, and
 * `Component` is a lazy() whose loader hands back a thenable that has already
 * resolved once `preload()` has finished. lazy() reads a settled thenable
 * synchronously (react/cjs lazyInitializer, 19.2), so a preloaded page renders
 * in the same pass with no suspend and no fallback. The server and main.tsx
 * both call `preloadRoute(url)` before rendering, which makes that always true
 * on first load. A client-side navigation to a page not yet loaded does
 * suspend. React Router 7 runs navigations in a transition, so the old page
 * stays on screen until the new one is ready, and main.tsx preloads a page's
 * chunk as soon as a pointer or focus lands on a link to it.
 */

type PageModule = { default: ComponentType };

export interface LazyPage {
  Component: ComponentType;
  preload: () => Promise<void>;
}

function lazyPage(load: () => Promise<PageModule>): LazyPage {
  let mod: PageModule | undefined;
  let pending: Promise<void> | undefined;
  const preload = () => (pending ??= load().then((m) => void (mod = m)));
  const Component = lazy(() =>
    mod
      ? // A settled thenable, not a Promise: a Promise always resolves on a
        // later microtask, and lazy() would suspend for that one tick.
        ({ then: (resolve: (m: PageModule) => void) => resolve(mod!) } as unknown as Promise<PageModule>)
      : preload().then(() => mod!),
  );
  return { Component, preload };
}

const Home = lazyPage(() => import("./pages/Home"));
const Architecture = lazyPage(() => import("./pages/Architecture"));
const Blog = lazyPage(() => import("./pages/Blog"));
const BlogPost = lazyPage(() => import("./pages/BlogPost"));
const Features = lazyPage(() => import("./pages/Features"));
const Pricing = lazyPage(() => import("./pages/Pricing"));
const About = lazyPage(() => import("./pages/About"));
const Contact = lazyPage(() => import("./pages/Contact"));
const Trail = lazyPage(() => import("./pages/Trail"));
const PrivacyPolicy = lazyPage(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazyPage(() => import("./pages/TermsOfService"));
const ComingSoon = lazyPage(() => import("./pages/ComingSoon"));
const OpenRaster = lazyPage(() => import("./pages/OpenRaster"));
// All ten tool landing pages are ONE component that reads its content out of
// toolPages.ts by pathname. They still get a route, a sitemap entry and a
// prerendered <head> each, which is the part a crawler cares about.
const ToolLanding = lazyPage(() => import("./pages/ToolLanding"));
const NotFound = lazyPage(() => import("./pages/NotFound"));

/** The route table App.tsx renders, in match order.
 *
 *  Every static path here also needs an entry in ROUTES (seo.ts). That entry
 *  gives the page its prerendered file, and without the file a route that works
 *  from a client-side link returns 404 on a reload. See the note in
 *  scripts/prerender.mjs. */
export const PAGE_ROUTES: { path: string; page: LazyPage; source: string }[] = [
  { path: "/", page: Home, source: "src/pages/Home.tsx" },
  { path: "/architecture", page: Architecture, source: "src/pages/Architecture.tsx" },
  { path: "/blog", page: Blog, source: "src/pages/Blog.tsx" },
  // The one parameterized route on the site. It is NOT in ROUTES (see the note
  // in seo.ts), so prerender.mjs writes these files from POSTS instead, and an
  // unknown slug renders NotFound rather than a blank article.
  { path: "/blog/:slug", page: BlogPost, source: "src/pages/BlogPost.tsx" },
  { path: "/features", page: Features, source: "src/pages/Features.tsx" },
  { path: "/pricing", page: Pricing, source: "src/pages/Pricing.tsx" },
  { path: "/about", page: About, source: "src/pages/About.tsx" },
  { path: "/contact", page: Contact, source: "src/pages/Contact.tsx" },
  { path: "/trail-log", page: Trail, source: "src/pages/Trail.tsx" },
  { path: "/privacy-policy", page: PrivacyPolicy, source: "src/pages/PrivacyPolicy.tsx" },
  { path: "/terms-of-service", page: TermsOfService, source: "src/pages/TermsOfService.tsx" },
  { path: "/in-the-works", page: ComingSoon, source: "src/pages/ComingSoon.tsx" },
  { path: "/openraster", page: OpenRaster, source: "src/pages/OpenRaster.tsx" },
  { path: "/photo-editor", page: ToolLanding, source: "src/pages/ToolLanding.tsx" },
  { path: "/image-compressor", page: ToolLanding, source: "src/pages/ToolLanding.tsx" },
  { path: "/background-remover", page: ToolLanding, source: "src/pages/ToolLanding.tsx" },
  { path: "/remove-object-from-photo", page: ToolLanding, source: "src/pages/ToolLanding.tsx" },
  { path: "/annotate-image", page: ToolLanding, source: "src/pages/ToolLanding.tsx" },
  { path: "/clone-stamp", page: ToolLanding, source: "src/pages/ToolLanding.tsx" },
  { path: "/pixelate-image", page: ToolLanding, source: "src/pages/ToolLanding.tsx" },
  { path: "/blur-image", page: ToolLanding, source: "src/pages/ToolLanding.tsx" },
  { path: "/batch-image-editor", page: ToolLanding, source: "src/pages/ToolLanding.tsx" },
  { path: "/image-editor-no-upload", page: ToolLanding, source: "src/pages/ToolLanding.tsx" },
  // A catch-all, so an unknown URL gets a page that says so instead of a bare
  // nav over empty space. Paired with a real 404 status from the host (see
  // scripts/prerender.mjs).
  { path: "*", page: NotFound, source: "src/pages/NotFound.tsx" },
];

/** The route entry a URL renders, matched the same way <Routes> matches it. */
export function pageRouteFor(pathname: string) {
  const match = matchRoutes(
    PAGE_ROUTES.map((r) => ({ path: r.path })),
    pathname,
  )?.at(-1);
  return PAGE_ROUTES.find((r) => r.path === match?.route.path) ?? PAGE_ROUTES.at(-1)!;
}

/** Load the page a URL renders. Resolves once it can render synchronously. */
export function preloadRoute(pathname: string): Promise<void> {
  return pageRouteFor(pathname).page.preload();
}
