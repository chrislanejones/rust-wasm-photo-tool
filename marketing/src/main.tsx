import React from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
// tokens first — styles.css consumes every one of these custom properties.
import "./tokens.css";
import "./styles.css";

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

if (container.firstElementChild) {
  hydrateRoot(container, app);
} else {
  createRoot(container).render(app);
}
