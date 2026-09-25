import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import Nav from "./components/Nav";
import useHead from "./useHead";
import { trackPageView } from "./lib/analytics";
import { PAGE_ROUTES } from "./routes";

/* The ⌘K palette is its own chunk, mounted after the page has loaded. Before,
 * it rendered all ~70 of its results (closed) into the prerendered markup of
 * every page, and it pulled the whole feature list and its icon set into the
 * entry bundle. Now it loads on idle once the page is up, and mounts closed so
 * its first open still fades in. A ⌘K pressed before then mounts it directly. */
const loadPalette = () => import("./components/CommandPalette");
const CommandPalette = lazy(loadPalette);

/** Client-side routing keeps the scroll position across pages, which is the
 *  wrong default for a set of documents: follow a link and you land halfway
 *  down the next one. Jump to the top — unless the link carried a hash, in
 *  which case honour that instead. */
function ScrollBehaviour() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      // The target may mount in the same frame as the navigation, so wait for it.
      const id = requestAnimationFrame(() => {
        document.querySelector(hash)?.scrollIntoView();
      });
      return () => cancelAnimationFrame(id);
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);

  return null;
}

export default function App() {
  // Title, description, canonical and JSON-LD follow the route. The prerendered
  // HTML already carries the right ones for the page a visitor lands on; this is
  // what keeps them right after a client-side navigation.
  useHead();

  // GA4's own page_view is switched off (see lib/analytics.ts), so this is the
  // only thing that counts a page — including the first. It sits AFTER
  // `useHead()` on purpose: effects in one component run in declaration order,
  // so the title is already the new route's by the time this reads it.
  // Sending from inside ScrollBehaviour instead would invert that — a child's
  // effects run before its parent's — and every hit would carry the PREVIOUS
  // page's title.
  const { pathname: analyticsPath, search: analyticsSearch } = useLocation();
  useEffect(() => {
    trackPageView(analyticsPath + analyticsSearch);
  }, [analyticsPath, analyticsSearch]);

  const [searchOpen, setSearchOpen] = useState(false);
  const [paletteMounted, setPaletteMounted] = useState(false);
  useEffect(() => {
    if (searchOpen) setPaletteMounted(true);
  }, [searchOpen]);
  useEffect(() => {
    let cancelled = false;
    const mount = () => {
      void loadPalette().then(() => !cancelled && setPaletteMounted(true));
    };
    const whenIdle = () => {
      if (typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(mount, { timeout: 4000 });
      } else {
        window.setTimeout(mount, 2000);
      }
    };
    if (document.readyState === "complete") whenIdle();
    else window.addEventListener("load", whenIdle, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener("load", whenIdle);
    };
  }, []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);

  // ⌘K on mac, Ctrl-K elsewhere. Lives here rather than in the palette so the
  // shortcut opens it — a handler inside a closed dialog can't.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <ScrollBehaviour />
      <Nav onOpenSearch={() => setSearchOpen((o) => !o)} searchOpen={searchOpen} />
      {/* Pages are separate chunks (see routes.ts). The fallback never shows
          on a first load, because the page is preloaded before render, and a
          later navigation runs in a transition, which keeps the old page up
          until the new one is ready. It is here because lazy() requires it. */}
      <Suspense fallback={null}>
        <Routes>
          {PAGE_ROUTES.map(({ path, page: { Component } }) => (
            <Route key={path} path={path} element={<Component />} />
          ))}
        </Routes>
      </Suspense>
      {paletteMounted && (
        <Suspense fallback={null}>
          <CommandPalette open={searchOpen} onClose={closeSearch} />
        </Suspense>
      )}
    </>
  );
}
