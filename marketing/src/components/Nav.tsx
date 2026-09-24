import { useCallback, useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { EDITOR_URL, external } from "../config";

// ── SVG path arrays (from the design) ────────────────────────────────────
const P = {
  sliders:   ["M4 6h10","M14 6h6","M4 12h4","M8 12h12","M4 18h14","M18 18h2","M14 4v4","M8 10v4","M18 16v4"],
  select:    ["M5 3a2 2 0 0 0-2 2","M19 3a2 2 0 0 1 2 2","M5 21a2 2 0 0 1-2-2","M9 3h1","M9 21h2","M14 3h1","M3 9v1","M21 9v2","M3 14v1","M12 12l5 10 1.5-4.5L23 16z"],
  brush:     ["M11 10 2.1 18.9","m5 2 5 5","m2 13 5 5","M18 3a3 3 0 0 0-3 3c0 1.5-1 2-2 2.5l4.5 4.5c.5-1 1-2 2.5-2a3 3 0 0 0 3-3 5 5 0 0 0-5-5z"],
  crop:      ["M6 2v14a2 2 0 0 0 2 2h14","M18 22V8a2 2 0 0 0-2-2H2"],
  images:    ["M18 22H4a2 2 0 0 1-2-2V6","M8 2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z","m11 7 2.5 3 2-2L18 12H8z"],
  network:   ["M9 2h6a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z","M12 7v4","M6 15h12","M6 15v-4","M18 15v-4","M3 17h4v4H3z","M10 17h4v4h-4z","M17 17h4v4h-4z"],
  pen:       ["M12 20h9","M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"],
  commit:    ["M3 12h6","M15 12h6","M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"],
  checks:    ["m3 7 2 2 4-4","m3 17 2 2 4-4","M13 8h8","M13 18h8"],
  telescope: ["m10 6 8-4 3 5-8 4z","m5 12 5-6 4 3-5 6z","M3 16l4-5 3 2-4 5z","M9 18l3 4","M14 18l-3 4"],
  info:      ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z","M12 11v5","M12 8h.01"],
};

// ── data ──────────────────────────────────────────────────────────────────
interface ToolPage  { href: string; title: string; desc: string; detail: string }
interface ToolGroup { name: string; paths: string[]; pages: ToolPage[] }

const GROUPS: ToolGroup[] = [
  { name: "Enhance", paths: P.sliders, pages: [
    { href: "/photo-editor",    title: "Photo editor",    desc: "Crop, straighten, brightness, contrast, twelve presets.", detail: "Crop with rule-of-thirds guides, straighten, fix brightness, contrast, shadows and highlights, or set levels against a live histogram. Twelve one-click presets preview on your own photo before you keep one. Every step is an undo entry, and nothing leaves your computer." },
    { href: "/image-compressor", title: "Image compressor", desc: "Shrink to a size or a percentage. WebP, AVIF, JPEG, PNG.", detail: "Pick a target file size or a percentage and the editor resamples and re-encodes on your own machine — WebP, AVIF, JPEG or PNG. Page-speed scores update as you drag. Compress All does the whole gallery in one pass." },
  ]},
  { name: "Select", paths: P.select, pages: [
    { href: "/background-remover",      title: "Background remover", desc: "Cut the subject out cleanly. rembg, on a server.", detail: "One click and the subject is lifted off its background with a clean edge. This one runs on a server we pay for, so it needs a Pro account — the photo goes up, the cut-out comes back, and the job is deleted afterwards." },
    { href: "/remove-object-from-photo", title: "Remove an object",  desc: "Paint over it. Magic eraser locally; an AI pass if you sign in.", detail: "Paint over the thing you want gone. The Magic Eraser fills it in from the surrounding pixels on your own machine, free. For harder cases, Pro adds an AI pass that runs on a server and sends back a cleaner fill." },
  ]},
  { name: "Create", paths: P.brush, pages: [
    { href: "/annotate-image", title: "Annotate an image", desc: "Arrows, boxes, numbered pins, text bubbles, emoji.", detail: "Arrows, boxes, circles, numbered pins, speech bubbles, text in real typefaces, emoji and red review stamps. Everything stays an object you can move, recolor or delete until you export. Snap to a nine-cell grid to line things up." },
    { href: "/clone-stamp",    title: "Clone stamp",      desc: "Paint one part of a photo over another.", detail: "Alt-click a source point, then paint: the pixels from the source follow your brush. Adjustable size, hardness, opacity and spacing, with the Stroke Stabilizer steadying your hand." },
  ]},
  { name: "Edit", paths: P.crop, pages: [
    { href: "/pixelate-image", title: "Pixelate an image", desc: "Block out a face, a plate, a password.", detail: "Paint a region and it turns to blocks; choose the block size. Or use the black-box redaction for a hard cover. It happens on your computer — the original never goes anywhere, and the export is flattened so the pixels are really gone." },
    { href: "/blur-image",     title: "Blur an image",     desc: "Soften a background or hide a detail.", detail: "Brush a blur over just the part you want softened, or blur the whole photo with a slider. Radius and strength are yours to set. Runs on your machine; on some computers, on the graphics card." },
  ]},
  { name: "Batch", paths: P.images, pages: [
    { href: "/batch-image-editor", title: "Batch image editor", desc: "Resize, compress, stamp a logo, rename by content — one pass.", detail: "Load a folder's worth of photos and do one thing to all of them: resize, compress to a size, stamp a logo or text, rename by what's in the picture. One pass, on your own machine, then export the lot." },
  ]},
];

interface LearnItem { key: string; href: string; title: string; desc: string; paths: string[]; detail: string }
const LEARN_ITEMS: LearnItem[] = [
  { key: "architecture", href: "/architecture", title: "Architecture", desc: "One plane is the editor. The other is optional.", paths: P.network,   detail: "Two planes. One is the editor — Rust compiled to WebAssembly, running in a Web Worker on your machine, with your photos in the browser's own database. The other is a server for sign-in, sync, share links and AI passes, and the editor works with it switched off. The page draws where the line is, table by table." },
  { key: "blog",         href: "/blog",         title: "Blog",         desc: "One decision per post, with the measurements.",       paths: P.pen,      detail: "Longer than a changelog line. Each post takes one engineering decision — moving the engine off the main thread, keeping the editor working with no network — says what it cost, and shows the measurements behind it." },
  { key: "trail",        href: "/trail-log",    title: "Trail Log",    desc: "Every release, newest first, and the commits behind them.", paths: P.commit, detail: "Every release, newest first, with the commits behind it. Press a month to narrow the log; the year pill brings it all back. Each month opens with what it amounted to." },
  { key: "features",     href: "/features",     title: "Features",     desc: "The whole list — engine and interface.", paths: P.checks,    detail: "All the features from the repo's own list, regrouped by what you're trying to do — annotate, select, enhance, export. Each has a plain line and the engineering line underneath." },
  { key: "about",        href: "/about",        title: "About",        desc: "Who builds it, and the horse.",          paths: P.info,      detail: "Image Horse is one person's project, and it is named after a horse. Chris builds it. Naji, an Arabian who survived his herd and later worked as a therapy horse, lent the name." },
];

const PRINCIPLE      = { eyebrow: "The principle", title: "An image editor with no upload.", desc: "Your pictures stay on your computer. Every tool below says which parts do, and which need a server.", foot: "/image-editor-no-upload →", href: "/image-editor-no-upload" };
const LEARN_PRINCIPLE = { eyebrow: "Learn", title: "How it's built, and why.", desc: "The architecture, the writing, the release log, the feature list, and the people. Hover anything on the right to see what's behind it.", foot: "5 pages →", href: "/architecture" };
const TOOL_HREFS = GROUPS.flatMap((g) => g.pages.map((p) => p.href));

// ── helpers ───────────────────────────────────────────────────────────────
function Paths({ d, size = 14 }: { d: string[]; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: "block", flexShrink: 0 }}>
      {d.map((path, i) => <path key={i} d={path} />)}
    </svg>
  );
}

interface FeatCard { eyebrow: string; title: string; desc: string; foot: string; href: string }
function FeatureCard({ card }: { card: FeatCard }) {
  return (
    <a href={card.href} className="nav-mega__feat">
      <span className="nav-mega__feat-eye">{card.eyebrow}</span>
      <span className="nav-mega__feat-title">{card.title}</span>
      <span className="nav-mega__feat-desc">{card.desc}</span>
      <span className="nav-mega__feat-foot">{card.foot}</span>
    </a>
  );
}

// ── component ─────────────────────────────────────────────────────────────
interface NavProps {
  onOpenSearch: () => void;
  searchOpen: boolean;
}

export default function Nav({ onOpenSearch, searchOpen }: NavProps) {
  const { pathname } = useLocation();
  const [open, setOpen]           = useState<"tools" | "learn" | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [condensed, setCondensed] = useState(false);
  const [hoveredTool,  setHoveredTool]  = useState<string | null>(null);
  const [hoveredLearn, setHoveredLearn] = useState<string | null>(null);
  const timer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const sheetRef  = useRef<HTMLDivElement>(null);

  const activeTop = (() => {
    if (pathname === "/pricing") return "pricing";
    if (pathname === "/contact") return "contact";
    if (LEARN_ITEMS.some((l) => l.href === pathname)) return "learn";
    if (TOOL_HREFS.includes(pathname)) return "tools";
    return null;
  })();

  const scheduleClose = useCallback(() => {
    clearTimeout(timer.current!);
    timer.current = setTimeout(() => setOpen(null), 160);
  }, []);
  const cancelClose = useCallback(() => clearTimeout(timer.current!), []);
  const closeAll = useCallback(() => {
    clearTimeout(timer.current!);
    setOpen(null);
    setSheetOpen(false);
  }, []);

  // Scroll-morph: condense once the top 120px is gone.
  useEffect(() => {
    const sentinel = document.createElement("div");
    sentinel.setAttribute("aria-hidden", "true");
    sentinel.style.cssText = "position:absolute;top:0;left:0;width:1px;height:120px;pointer-events:none;visibility:hidden";
    document.body.prepend(sentinel);
    const io = new IntersectionObserver(([e]) => setCondensed(!e.isIntersecting), { threshold: 0 });
    io.observe(sentinel);
    return () => { io.disconnect(); sentinel.remove(); };
  }, []);

  // Close everything on navigate.
  useEffect(() => { setSheetOpen(false); setOpen(null); }, [pathname]);

  // Mobile sheet: Escape + click-outside + viewport widening.
  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setSheetOpen(false);
      burgerRef.current?.focus();
    };
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (sheetRef.current?.contains(t) || burgerRef.current?.contains(t)) return;
      setSheetOpen(false);
    };
    const mq = matchMedia("(min-width: 60.0625rem)");
    const onWide = (e: MediaQueryListEvent) => { if (e.matches) setSheetOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    mq.addEventListener("change", onWide);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
      mq.removeEventListener("change", onWide);
    };
  }, [sheetOpen]);

  // Mega panel: Escape closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Feature card for the Tools panel: hovered page → its detail, else principle.
  const featCard: FeatCard = (() => {
    if (hoveredTool) {
      const page  = GROUPS.flatMap((g) => g.pages).find((p) => p.href === hoveredTool);
      const group = GROUPS.find((g) => g.pages.some((p) => p.href === hoveredTool));
      if (page && group) return { eyebrow: group.name, title: page.title, desc: page.detail, foot: page.href.slice(1) + " →", href: page.href };
    }
    return PRINCIPLE;
  })();

  // Feature card for the Learn panel: hovered item → its detail, else intro.
  const learnFeatCard: FeatCard = (() => {
    if (hoveredLearn) {
      const item = LEARN_ITEMS.find((l) => l.key === hoveredLearn);
      if (item) return { eyebrow: "Learn · " + item.title, title: item.desc, desc: item.detail, foot: item.title + " →", href: item.href };
    }
    return LEARN_PRINCIPLE;
  })();

  return (
    <>
      {/* Backdrop — closes everything when clicked */}
      <div
        aria-hidden="true"
        style={{ position: "fixed", inset: 0, zIndex: 290, display: (open !== null || sheetOpen) ? "block" : "none" }}
        onClick={closeAll}
      />

      {/* ── Primary nav ── */}
      <nav
        className={`nav-pill${condensed ? " is-condensed" : ""}`}
        aria-label="Primary"
        onPointerLeave={scheduleClose}
        onPointerEnter={cancelClose}
      >
        {/* The pill row */}
        <div className="nav-pill__row">
          <Link className="nav-pill__mark" to="/">
            <img className="nav-pill__logo" src="/Image-Horse-Logo.svg" alt="" width={44} height={44} />
            <span className="nav-pill__word"><span>Image&nbsp;Horse</span></span>
          </Link>

          {/* Desktop nav items */}
          <ul className="nav-pill__items" role="menubar">
            {(["tools", "learn"] as const).map((key) => (
              <li key={key} role="none">
                <button
                  type="button"
                  role="menuitem"
                  aria-haspopup="true"
                  aria-expanded={open === key}
                  className={`nav-item nav-item--btn${open === key ? " is-open" : ""}${activeTop === key ? " is-active" : ""}`}
                  onClick={() => setOpen((o) => (o === key ? null : key))}
                  onPointerEnter={() => { cancelClose(); setOpen(key); }}
                  onFocus={() => setOpen(key)}
                >
                  {key === "tools" ? "Tools" : "Learn"}
                  <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: "block", flexShrink: 0, transition: "transform 220ms var(--ease-out)", transform: open === key ? "rotate(180deg)" : "none" }}>
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
              </li>
            ))}
            <li role="none">
              <NavLink
                to="/pricing"
                className={({ isActive }) => `nav-item nav-item--link${isActive ? " is-active" : ""}`}
                onPointerEnter={scheduleClose}
              >
                Pricing
              </NavLink>
            </li>
            <li role="none">
              <NavLink
                to="/contact"
                className={({ isActive }) => `nav-item nav-item--link${isActive ? " is-active" : ""}`}
                onPointerEnter={scheduleClose}
              >
                Contact
              </NavLink>
            </li>
          </ul>

          {/* CTA */}
          <a className="cta cta--fill nav-pill__cta" href={EDITOR_URL} aria-label="Open the editor" {...external}>
            <span className="nav-pill__cta-full">Open editor</span>
            <span className="nav-pill__cta-short">Open</span>
          </a>

          {/* ⌘K — desktop only */}
          <button
            className="nav-item nav-item--icon nav-pill__search"
            type="button"
            onClick={onOpenSearch}
            aria-label="Search this site (Command K)"
            aria-expanded={searchOpen}
            aria-haspopup="dialog"
            title="Search — ⌘K"
          >
            <kbd style={{ fontFamily: "var(--font-outlier)", fontSize: "0.8125rem", fontWeight: 700, lineHeight: 1, color: "inherit" }}>⌘K</kbd>
          </button>

          {/* Burger — mobile only */}
          <button
            className="nav-pill__burger"
            type="button"
            ref={burgerRef}
            onClick={() => setSheetOpen((o) => !o)}
            aria-expanded={sheetOpen}
            aria-controls="navsheet"
            aria-label="Menu"
          >
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" style={{ display: "block" }}>
              {sheetOpen ? (
                <>
                  <path d="M6 6l12 12" />
                  <path d="M6 18L18 6" />
                </>
              ) : (
                <>
                  <path d="M3 7h18" />
                  <path d="M3 12h18" />
                  <path d="M3 17h18" />
                </>
              )}
            </svg>
          </button>
        </div>

        {/* ── Mega panel (desktop dropdown) ── */}
        <div className={`nav-mega${open !== null ? " is-open" : ""}`} role="presentation">
          <div className="nav-mega__inner">

            {open === "tools" && (
              <div className="nav-mega__tools" onPointerLeave={() => setHoveredTool(null)}>
                <FeatureCard card={featCard} />
                {GROUPS.map((g) => (
                  <div key={g.name} className="nav-mega__group">
                    <p className="nav-mega__group-head">
                      <Paths d={g.paths} size={14} />
                      {g.name}
                    </p>
                    {g.pages.map((pg) => (
                      <a
                        key={pg.href}
                        href={pg.href}
                        className="nav-mega__page"
                        onPointerEnter={() => setHoveredTool(pg.href)}
                        onFocus={() => setHoveredTool(pg.href)}
                      >
                        <span className="nav-mega__page-title">{pg.title}</span>
                        <span className="nav-mega__page-desc">{pg.desc}</span>
                      </a>
                    ))}
                    {g.pages.length < 2 && (
                      <a href={EDITOR_URL} className="nav-mega__page nav-mega__page--more" {...external} aria-label={`More ${g.name} tools coming`}>
                        <span style={{ fontFamily: "var(--font-outlier)", fontSize: "var(--text-2xs)", lineHeight: 1.4 }}>more coming →</span>
                      </a>
                    )}
                  </div>
                ))}
                <p className="nav-mega__footer">Grouped by the editor's own toolbar: Enhance · Select · Create · Edit · Batch</p>
              </div>
            )}

            {open === "learn" && (
              <div className="nav-mega__learn" onPointerLeave={() => setHoveredLearn(null)}>
                <FeatureCard card={learnFeatCard} />
                <div className="nav-mega__learn-grid">
                  {LEARN_ITEMS.map((l) => (
                    <NavLink
                      key={l.key}
                      to={l.href}
                      className={({ isActive }) => `nav-mega__page${isActive ? " is-active" : ""}`}
                      onPointerEnter={() => setHoveredLearn(l.key)}
                      onFocus={() => setHoveredLearn(l.key)}
                    >
                      <span className="nav-mega__page-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ color: "var(--color-accent)", flexShrink: 0 }}>
                          <Paths d={l.paths} size={15} />
                        </span>
                        {l.title}
                      </span>
                      <span className="nav-mega__page-desc">{l.desc}</span>
                    </NavLink>
                  ))}
                </div>
                <p className="nav-mega__footer" style={{ gridColumn: "1 / -1" }}>Everything that isn't a tool. Pricing and Contact are in the bar.<span style={{ float: "right" }}>Every page is generated from the repo — the log, the features, the schema.</span></p>
              </div>
            )}

          </div>
        </div>
      </nav>

      {/* ── Mobile sheet ── */}
      <div className="nav-sheet" id="navsheet" ref={sheetRef} hidden={!sheetOpen}>

        <a href="/image-editor-no-upload" className="nav-sheet__principle">
          <span className="nav-sheet__principle-eye">The principle</span>
          <span className="nav-sheet__principle-title">An image editor with no upload.</span>
          <span className="nav-sheet__principle-desc">Your pictures stay on your computer. Every tool below says which parts do, and which need a server.</span>
        </a>

        <section className="nav-sheet__section">
          <h2 className="nav-sheet__section-head">
            Tools
            <span>{GROUPS.reduce((n, g) => n + g.pages.length, 0)}</span>
          </h2>
          <div className="nav-sheet__grid">
            {GROUPS.flatMap((g) =>
              g.pages.map((p) => (
                <a key={p.href} href={p.href} className="nav-sheet__card">
                  <span className="nav-sheet__card-group">
                    <Paths d={g.paths} size={12} />
                    {g.name}
                  </span>
                  <span className="nav-sheet__card-title">{p.title}</span>
                  <span className="nav-sheet__card-desc">{p.desc}</span>
                </a>
              ))
            )}
            <a href={EDITOR_URL} className="nav-sheet__card nav-sheet__card--more" {...external} aria-label="More Batch tools coming">
              <span className="nav-sheet__card-group">Batch</span>
              <span className="nav-sheet__card-desc" style={{ fontFamily: "var(--font-outlier)", fontSize: "var(--text-2xs)" }}>more coming →</span>
            </a>
          </div>
        </section>

        <section className="nav-sheet__section">
          <h2 className="nav-sheet__section-head">
            Learn
            <span>{LEARN_ITEMS.length}</span>
          </h2>
          <div className="nav-sheet__grid">
            {LEARN_ITEMS.map((l) => (
              <NavLink
                key={l.key}
                to={l.href}
                className={({ isActive }) => `nav-sheet__card${isActive ? " is-active" : ""}`}
              >
                <span className="nav-sheet__card-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ color: "var(--color-accent)", flexShrink: 0 }}><Paths d={l.paths} size={15} /></span>
                  {l.title}
                </span>
                <span className="nav-sheet__card-desc">{l.desc}</span>
              </NavLink>
            ))}
          </div>
        </section>

        <section className="nav-sheet__pair">
          <NavLink to="/pricing" className={({ isActive }) => `nav-sheet__pair-link${isActive ? " is-active" : ""}`}>
            <span className="nav-sheet__card-title">Pricing</span>
            <span className="nav-sheet__pair-sub">$0 · every tool, every tier</span>
          </NavLink>
          <NavLink to="/contact" className={({ isActive }) => `nav-sheet__pair-link${isActive ? " is-active" : ""}`}>
            <span className="nav-sheet__card-title">Contact</span>
            <span className="nav-sheet__pair-sub">one inbox, one form</span>
          </NavLink>
        </section>

        <a className="nav-sheet__cta" href={EDITOR_URL} {...external}>
          Open the editor
        </a>

      </div>
    </>
  );
}
