import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import Logo from "./Logo";
import { EDITOR_URL } from "../config";

export default function Nav() {
  const loc = useLocation();
  const onHome = loc.pathname === "/";
  const [open, setOpen] = useState(false);

  // Close the mobile menu whenever the route changes (link tap, back button).
  useEffect(() => {
    setOpen(false);
  }, [loc.pathname]);

  // Shared link set so the desktop bar and mobile dropdown never drift. On the
  // home page the section links are in-page anchors; elsewhere they route home
  // first (/#section).
  const navItems = (onClick?: () => void, itemClass = "") => (
    <>
      {onHome ? (
        <>
          <a href="#features" onClick={onClick} className={`hover:text-zinc-100 transition ${itemClass}`}>Features</a>
          <a href="#how" onClick={onClick} className={`hover:text-zinc-100 transition ${itemClass}`}>How it works</a>
          <a href="#pricing" onClick={onClick} className={`hover:text-zinc-100 transition ${itemClass}`}>Pricing</a>
        </>
      ) : (
        <>
          <Link to="/#features" onClick={onClick} className={`hover:text-zinc-100 transition ${itemClass}`}>Features</Link>
          <Link to="/#how" onClick={onClick} className={`hover:text-zinc-100 transition ${itemClass}`}>How it works</Link>
          <Link to="/#pricing" onClick={onClick} className={`hover:text-zinc-100 transition ${itemClass}`}>Pricing</Link>
        </>
      )}
      <NavLink
        to="/architecture"
        onClick={onClick}
        className={({ isActive }) =>
          `${isActive ? "text-orange-400" : "hover:text-zinc-100 transition"} ${itemClass}`
        }
      >
        Architecture
      </NavLink>
      <NavLink
        to="/trail-log"
        onClick={onClick}
        className={({ isActive }) =>
          `${isActive ? "text-orange-400" : "hover:text-zinc-100 transition"} ${itemClass}`
        }
      >
        Trail Log
      </NavLink>
    </>
  );

  return (
    <nav className="sticky top-0 z-50 backdrop-blur bg-zinc-950/70 border-b border-zinc-900">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        <Logo />
        <div className="hidden md:flex items-center gap-7 text-sm text-zinc-400">
          {navItems()}
        </div>
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/chrislanejones/rust-wasm-photo-tool"
            target="_blank"
            rel="noopener noreferrer"
            title="Source on GitHub"
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12Z" />
            </svg>
          </a>
          <a
            href="https://codeberg.org/chrislanejones/rust-wasm-photo-tool"
            target="_blank"
            rel="noopener noreferrer"
            title="Source on Codeberg"
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 1.5A10.5 10.5 0 0 0 1.5 12c0 2.45.84 4.71 2.25 6.5L11.9 5.55a.12.12 0 0 1 .2 0l8.15 12.95A10.46 10.46 0 0 0 22.5 12 10.5 10.5 0 0 0 12 1.5Z" />
              <path d="M12.43 8.6l6.95 11.04a10.48 10.48 0 0 1-1.71 1.27L12 9.3l.43-.7Z" opacity=".55" />
            </svg>
          </a>
          <a
            href={EDITOR_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium px-3 py-1.5 rounded-md bg-zinc-100 text-zinc-900 hover:bg-white transition"
          >
            Beta Version
          </a>
          {/* Mobile hamburger — toggles the dropdown below; hidden on md+ */}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle menu"
            aria-expanded={open}
            className="md:hidden p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              {open ? (
                <>
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="6" y1="18" x2="18" y2="6" />
                </>
              ) : (
                <>
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile dropdown panel */}
      {open && (
        <div className="md:hidden border-t border-zinc-900 bg-zinc-950/95 backdrop-blur">
          <div className="max-w-7xl mx-auto px-6 py-3 flex flex-col text-sm text-zinc-300">
            {navItems(() => setOpen(false), "block py-2.5 border-b border-zinc-900/70 last:border-b-0")}
          </div>
        </div>
      )}
    </nav>
  );
}
