// `react-router`, not `react-router-dom/server`. That subpath was the v6 home
// for StaticRouter and does not exist in v7 — react-router-dom@7 has no "./server"
// export at all, and does not re-export StaticRouter either, so the v6 import
// resolves to nothing. It is a direct dependency here for that reason: pnpm's
// strict node_modules will not resolve a package this one has not asked for.
import { StaticRouter } from "react-router";
import { renderToString } from "react-dom/server";
import App from "./App";
import { preloadRoute, pageRouteFor } from "./routes";

/* The build-time half of the site.
 *
 * `vite build --ssr` compiles this to a Node-loadable bundle that
 * scripts/prerender.mjs imports once per route. Nothing here runs in a browser.
 *
 * Deliberately NOT imported: tokens.css and styles.css. main.tsx pulls those in
 * for the client bundle, and importing them again here would have Vite emit a
 * second, unreferenced stylesheet into the SSR output for no benefit — the
 * prerendered HTML links the client build's stylesheet, which is the same CSS.
 *
 * Also deliberately absent: any attempt to stub `window` or `document`. If a
 * component reaches for a browser global during render, this build fails loudly
 * with the component named, which is the correct outcome — a stub would let the
 * page render subtly differently on the server and turn a clear build error into
 * a hydration mismatch nobody sees until a crawler does.
 */

/* Async because each page is its own chunk (see routes.ts). renderToString
 * never waits for a lazy component; it writes the Suspense fallback, which is
 * empty here. So the page is loaded first, and the render that follows finds
 * it already resolved. */
export async function render(url: string): Promise<string> {
  await preloadRoute(url);
  return renderToString(
    <StaticRouter location={url}>
      <App />
    </StaticRouter>,
  );
}

/** The source file of the page a URL renders. prerender.mjs looks it up in
 *  the client build's manifest to find the chunk it should modulepreload. */
export const pageSourceFor = (url: string) => pageRouteFor(url).source;

/* Re-exported so the prerender script has exactly one copy of the route table
 * and the <head> builders — the same module the browser bundle uses. Importing
 * seo.ts into a .mjs script directly is not an option (it is TypeScript), and
 * hand-maintaining a parallel JS copy is the drift this whole arrangement is
 * built to prevent. */
export {
  ROUTES,
  headTagsFor,
  postHeadTagsFor,
  robotsTxt,
  sitemapXml,
  SITE_URL,
  NOT_FOUND_HEAD,
} from "./seo";

/* The posts, for the same reason as ROUTES: prerender.mjs writes one file per
 * post and needs the list, and the list is TypeScript. */
export { POSTS, postPath } from "./data/posts";
