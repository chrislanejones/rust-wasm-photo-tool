// `react-router`, not `react-router-dom/server`. That subpath was the v6 home
// for StaticRouter and does not exist in v7 — react-router-dom@7 has no "./server"
// export at all, and does not re-export StaticRouter either, so the v6 import
// resolves to nothing. It is a direct dependency here for that reason: pnpm's
// strict node_modules will not resolve a package this one has not asked for.
import { StaticRouter } from "react-router";
import { renderToString } from "react-dom/server";
import App from "./App";

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

export function render(url: string): string {
  return renderToString(
    <StaticRouter location={url}>
      <App />
    </StaticRouter>,
  );
}

/* Re-exported so the prerender script has exactly one copy of the route table
 * and the <head> builders — the same module the browser bundle uses. Importing
 * seo.ts into a .mjs script directly is not an option (it is TypeScript), and
 * hand-maintaining a parallel JS copy is the drift this whole arrangement is
 * built to prevent. */
export { ROUTES, headTagsFor, robotsTxt, sitemapXml, SITE_URL, NOT_FOUND_HEAD } from "./seo";
