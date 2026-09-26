import React from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
// tokens first — styles.css consumes every one of these custom properties.
import "./tokens.css";
import "./styles.css";
import "./tool-page.css";
import "./openraster.css";
import "./trail.css";
import "./pager.css";
import "./features.css";
// One stylesheet per v2 page, so the parallel ports never share a file.
import "./about.css";
import "./contact.css";
import "./blog.css";
import "./blog-post.css";
import "./architecture.css";
import "./legal.css";
import "./footer.css";
import "./shot-annotations.css";
// After styles.css: its reduced-motion overrides have to win the cascade.
import "./animations.css";
import { initAnalytics } from "./lib/analytics";
import { preloadRoute } from "./routes";

initAnalytics();

const container = document.getElementById("root")!;

/* Two mount paths, chosen by what's already in the container.
 *
 * A production build is prerendered (scripts/prerender.mjs), so #root arrives
 * full and the job is to ADOPT that markup — hydrate attaches listeners to the
 * nodes that are already painted. `createRoot().render()` on the same container
 * would discard every one of them and rebuild the tree from scratch, which
 * throws away the whole point of prerendering: the visitor watches a complete
 * page blank out and come back, and the work is done twice.
 *
 * `vite dev` serves index.html untouched, so #root is empty and there is nothing
 * to hydrate. Calling hydrateRoot on an empty container is not a no-op — React
 * reports the missing markup as a mismatch on every page load — so dev takes the
 * createRoot path instead. Branching on the container rather than on
 * `import.meta.env.PROD` keeps `vite preview` and any future non-prerendered
 * build correct too: the question is only ever "is there markup here?".
 */
const app = (
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

/* The page's own chunk first (see routes.ts). prerender.mjs already lists it
 * as a <link rel="modulepreload">, so it has usually arrived before this line
 * runs. Hydrating before it resolves would leave the whole page inert until it
 * did. */
void preloadRoute(window.location.pathname).then(() => {
  if (container.firstElementChild) {
    hydrateRoot(container, app);
  } else {
    createRoot(container).render(app);
  }
});

/* Fetch the next page's chunk the moment a link to it is pointed at or
 * focused, so the click finds it already loaded. One delegated listener for
 * every internal link, nav, footer and body alike. A preload that has already
 * run is a no-op, so repeat hovers cost nothing. */
const prefetch = (e: Event) => {
  const a = (e.target as Element | null)?.closest?.("a[href^='/']");
  if (a) void preloadRoute(new URL((a as HTMLAnchorElement).href).pathname);
};
document.addEventListener("pointerover", prefetch, { passive: true });
document.addEventListener("focusin", prefetch);
document.addEventListener("touchstart", prefetch, { passive: true });
