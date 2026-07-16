import { useCallback, useEffect, useState } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import Nav from "./components/Nav";
import CommandPalette from "./components/CommandPalette";
import Home from "./pages/Home";
import Architecture from "./pages/Architecture";
import Features from "./pages/Features";
import Pricing from "./pages/Pricing";
import Trail from "./pages/Trail";

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
  const [searchOpen, setSearchOpen] = useState(false);
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
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/architecture" element={<Architecture />} />
        <Route path="/features" element={<Features />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/trail-log" element={<Trail />} />
      </Routes>
      <CommandPalette open={searchOpen} onClose={closeSearch} />
    </>
  );
}
