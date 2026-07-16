import { useCallback, useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { EDITOR_URL, GITHUB_URL, CODEBERG_URL, PAGES, external } from "../config";
import { BurgerIcon, CodebergIcon, GitHubIcon } from "./Icons";

interface NavProps {
  onOpenSearch: () => void;
  searchOpen: boolean;
}

export default function Nav({ onOpenSearch, searchOpen }: NavProps) {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [condensed, setCondensed] = useState(false);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // ── the glide — a rule that follows the pointer across the menu ──
  // It rests under the page you're on, and follows hover/focus away from there.
  const moveTo = useCallback((el: HTMLElement | null) => {
    const list = listRef.current;
    if (!list) return;
    if (!el) {
      list.style.setProperty("--go", "0");
      return;
    }
    // offsetLeft is relative to the list, which is the positioned ancestor
    list.style.setProperty("--gx", `${el.offsetLeft}px`);
    list.style.setProperty("--gw", String(el.offsetWidth));
    list.style.setProperty("--go", "1");
  }, []);

  const rest = useCallback(() => {
    const current = listRef.current?.querySelector<HTMLElement>('a[aria-current="page"]');
    moveTo(current ?? null);
  }, [moveTo]);

  // Re-rest on navigation, and again once the webfont lands — a glide measured
  // against the fallback face is the wrong width the moment Geist swaps in.
  useEffect(() => {
    rest();
    document.fonts?.ready.then(rest);
    window.addEventListener("resize", rest);
    return () => window.removeEventListener("resize", rest);
  }, [rest, pathname]);

  // ── scroll-morph — condense the pill once the top of the page is gone ──
  // A sentinel + IntersectionObserver, never a scroll listener.
  useEffect(() => {
    const sentinel = document.createElement("div");
    sentinel.setAttribute("aria-hidden", "true");
    sentinel.style.cssText =
      "position:absolute;top:0;left:0;width:1px;height:120px;pointer-events:none;visibility:hidden";
    document.body.prepend(sentinel);

    const io = new IntersectionObserver(([entry]) => setCondensed(!entry.isIntersecting), {
      threshold: 0,
    });
    io.observe(sentinel);
    return () => {
      io.disconnect();
      sentinel.remove();
    };
  }, []);

  // The bar reflows when it condenses, so the glide's anchor moves with it.
  useEffect(() => {
    const id = requestAnimationFrame(rest);
    return () => cancelAnimationFrame(id);
  }, [condensed, rest]);

  // ── the mobile sheet ──────────────────────────────────────
  // Close on navigation, or it sits open over the page you just asked for.
  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    if (!menuOpen) return;

    // Escape closes and returns focus to the trigger — a sheet you can open
    // with the keyboard but not close with it is a trap.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMenuOpen(false);
      burgerRef.current?.focus();
    };
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (sheetRef.current?.contains(t) || burgerRef.current?.contains(t)) return;
      setMenuOpen(false);
    };
    // Growing back to desktop must not leave a stale open sheet behind the CSS
    // that now hides the burger.
    const mq = matchMedia("(min-width: 60.0625rem)");
    const onWide = (e: MediaQueryListEvent) => e.matches && setMenuOpen(false);

    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    mq.addEventListener("change", onWide);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
      mq.removeEventListener("change", onWide);
    };
  }, [menuOpen]);

  const sourceLinks = (
    <>
      <a
        className="nav-pill__icon"
        href={GITHUB_URL}
        title="Source on GitHub"
        aria-label="Source on GitHub"
        {...external}
      >
        <GitHubIcon />
      </a>
      <a
        className="nav-pill__icon"
        href={CODEBERG_URL}
        title="Source on Codeberg"
        aria-label="Source on Codeberg"
        {...external}
      >
        <CodebergIcon />
      </a>
    </>
  );

  return (
    <>
      <nav className={`nav-pill${condensed ? " is-condensed" : ""}`} aria-label="Primary">
        <Link className="nav-pill__mark" to="/">
          <img className="nav-pill__logo" src="/Image-Horse-Logo.svg" alt="" width={44} height={44} />
          <span className="nav-pill__word">
            <span>Image&nbsp;Horse</span>
          </span>
        </Link>

        <ul className="nav-pill__links" ref={listRef} onPointerLeave={rest}>
          {PAGES.map((p) => (
            <li key={p.to}>
              {/* NavLink sets aria-current="page" itself — the glide reads it */}
              <NavLink
                to={p.to}
                end={p.to === "/"}
                onPointerEnter={(e) => moveTo(e.currentTarget)}
                onFocus={(e) => moveTo(e.currentTarget)}
                onBlur={(e) => {
                  if (!listRef.current?.contains(e.relatedTarget as Node)) rest();
                }}
              >
                {p.label}
              </NavLink>
            </li>
          ))}
          <span className="nav-pill__glide" aria-hidden="true" />
        </ul>

        <a className="cta cta--fill nav-pill__cta" href={EDITOR_URL} {...external}>
          Open the demo
        </a>

        {/* Condensing hides these, so they have to leave the tab order too. */}
        <span className="nav-pill__source" inert={condensed ? true : undefined}>
          <button
            className="nav-pill__icon nav-pill__kbd"
            type="button"
            onClick={onOpenSearch}
            aria-label="Search this site (Command K)"
            aria-expanded={searchOpen}
            aria-haspopup="dialog"
            title="Search — ⌘K"
          >
            <kbd>⌘K</kbd>
          </button>
          {sourceLinks}
        </span>

        <button
          className="nav-pill__burger"
          type="button"
          ref={burgerRef}
          onClick={() => setMenuOpen((o) => !o)}
          aria-expanded={menuOpen}
          aria-controls="navsheet"
          aria-label="Menu"
        >
          <BurgerIcon />
        </button>
      </nav>

      <div className="nav-sheet" id="navsheet" ref={sheetRef} hidden={!menuOpen}>
        {/* The wordmark lives here rather than in the pill on a phone: at 20px
            it pushed the burger to x=374 on a 375px screen — off the edge, so
            the menu could not be opened at all. */}
        <p className="nav-sheet__brand">
          <img className="nav-sheet__logo" src="/Image-Horse-Logo.svg" alt="" width={32} height={32} />
          <span>Image&nbsp;Horse</span>
        </p>
        {PAGES.map((p) => (
          <NavLink key={p.to} to={p.to} end={p.to === "/"}>
            {p.label}
          </NavLink>
        ))}
        <p className="nav-sheet__source">{sourceLinks}</p>
      </div>
    </>
  );
}
