import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { existsSync, readFileSync } from "fs";

// `vite preview` answers URLs the way an SPA host does, and Vercel does not:
// `/contact` falls back to dist/index.html (the prerendered HOME page), and
// `/contact/` serves contact/index.html under a pathname the prerender never
// saw. Both hydrate against the wrong HTML and throw React #418 locally on
// pages production serves cleanly. This mirrors vercel.json's
// `cleanUrls: true` + `trailingSlash: false` and its real 404.html, for the
// preview server only. It changes nothing in the build output.
function vercelUrls(): Plugin {
  return {
    name: "preview-vercel-urls",
    configurePreviewServer(server) {
      const dist = path.resolve(server.config.root, server.config.build.outDir);
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? "/";
        const q = url.indexOf("?");
        const pathname = q === -1 ? url : url.slice(0, q);
        const search = q === -1 ? "" : url.slice(q);
        // trailingSlash: false, and cleanUrls' own redirects off .html.
        const clean = pathname
          .replace(/\/index\.html$/, "/")
          .replace(/\.html$/, "")
          .replace(/(.)\/+$/, "$1");
        if (clean !== pathname) {
          res.statusCode = 308;
          res.setHeader("Location", clean + search);
          res.end();
          return;
        }
        if (pathname === "/" || path.extname(pathname)) return next();
        for (const file of [`${pathname}/index.html`, `${pathname}.html`]) {
          if (existsSync(path.join(dist, file))) {
            req.url = file + search;
            return next();
          }
        }
        const notFound = path.join(dist, "404.html");
        if (!existsSync(notFound)) return next();
        res.statusCode = 404;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(readFileSync(notFound));
      });
    },
  };
}

// No Tailwind here on purpose: the site is plain CSS driven by the tokens in
// src/tokens.css. Adding the plugin back would ship a preflight reset that
// fights styles.css for no gain.
export default defineConfig({
  plugins: [react(), vercelUrls()],
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
