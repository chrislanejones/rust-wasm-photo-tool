import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// No Tailwind here on purpose: the site is plain CSS driven by the tokens in
// src/tokens.css. Adding the plugin back would ship a preflight reset that
// fights styles.css for no gain.
export default defineConfig({
  plugins: [react()],
  define: {
    // The footer's copyright year. Stamped once per build so the client and
    // SSR bundles (built by the same `pnpm build`) print the same year.
    __BUILD_YEAR__: JSON.stringify(new Date().getFullYear()),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // One React, one react-dom. Without this the SSR build externalises them and
    // `node scripts/prerender.mjs` loads a second physical copy out of the pnpm
    // store — react-dom then binds a different React than the components import,
    // and the dispatcher is null: "Cannot read properties of null (reading
    // 'useContext')" the moment a hook runs.
    dedupe: ["react", "react-dom", "react-router"],
  },
  build: {
    // scripts/prerender.mjs reads this to find each page's chunk (and any CSS
    // it imports) and link it from that page's HTML. It deletes the file once
    // read, so it never ships.
    manifest: true,
  },
  ssr: {
    // Bundle EVERYTHING into dist-ssr/entry-server.js rather than leaving bare
    // imports for Node to resolve. Listing packages individually does not work:
    // the app imports react-router-dom, which stayed external and pulled its own
    // react-router, which called useContext on a React that was not the bundled
    // one. There is no server here — prerender.mjs runs the bundle once and
    // writes HTML — so nothing needs to stay external.
    noExternal: true,
  },
});
