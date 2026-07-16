import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { EDITOR_URL, GITHUB_URL, CODEBERG_URL } from "../config";
import { SearchIcon } from "./Icons";

// Shipping the pill means shipping the keyboard model, so this is a real
// dialog: ⌘K/Ctrl-K toggles, Esc closes, the backdrop closes, ↑/↓ move, Enter
// opens, focus goes into the input and comes back to the trigger, Tab is
// trapped, and the page stops scrolling behind it.
//
// The index is written here rather than scraped, so a section that gets renamed
// can't quietly become a dead result.

type Kind = "route" | "external" | "asset";

interface Item {
  group: string;
  label: string;
  hint: string;
  href: string;
  kind: Kind;
}

const ITEMS: Item[] = [
  { group: "Pages", label: "Home", hint: "The engine, and what runs where", href: "/", kind: "route" },
  { group: "Pages", label: "Architecture", hint: "The two planes, and the seam between them", href: "/architecture", kind: "route" },
  { group: "Pages", label: "Features", hint: "The whole list — engine and interface", href: "/features", kind: "route" },
  { group: "Pages", label: "Pricing", hint: "Three tiers, and the access matrix", href: "/pricing", kind: "route" },
  { group: "Pages", label: "Trail Log", hint: "Every release, and the commits behind them", href: "/trail-log", kind: "route" },

  { group: "On this site", label: "What runs where", hint: "Every operation, and the machine it runs on", href: "/#runs", kind: "route" },
  { group: "On this site", label: "In the editor", hint: "The whole tool list", href: "/#editor", kind: "route" },
  { group: "On this site", label: "The Convex schema", hint: "6 tables, every field and index", href: "/architecture#schema", kind: "route" },
  { group: "On this site", label: "Download the .mermaid source", hint: "The system flowchart", href: "/system-architecture.mermaid", kind: "asset" },

  { group: "Open", label: "Open the demo", hint: "No account, no upload", href: EDITOR_URL, kind: "external" },
  { group: "Open", label: "Source on GitHub", hint: "chrislanejones/rust-wasm-photo-tool", href: GITHUB_URL, kind: "external" },
  { group: "Open", label: "Source on Codeberg", hint: "chrislanejones/rust-wasm-photo-tool", href: CODEBERG_URL, kind: "external" },
];

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return ITEMS;
    return ITEMS.filter((i) => `${i.label} ${i.hint}`.toLowerCase().includes(needle));
  }, [query]);

  // A fresh query means the old highlight is meaningless.
  useEffect(() => setActive(0), [query]);

  // ── open / close ──────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setQuery("");
    document.body.style.overflow = "hidden"; // no scrolling behind the modal
    // The panel is visibility:hidden until .is-open lands, and .focus() on a
    // hidden element silently no-ops — so wait one frame for the style to
    // apply. (The visibility transition is delayed rather than interpolated;
    // see the .cmdk block in styles.css for why that matters.)
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      cancelAnimationFrame(id);
      document.body.style.overflow = "";
    };
  }, [open]);

  // Keep the highlighted row in view when arrowing past the fold.
  useEffect(() => {
    resultsRef.current
      ?.querySelector<HTMLElement>(".cmdk__item.is-active")
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const go = (item: Item | undefined) => {
    if (!item) return;
    onClose();
    if (item.kind === "external") {
      window.open(item.href, "_blank", "noopener");
    } else if (item.kind === "asset") {
      // A real file in /public — it has to be a browser navigation. Client-side
      // routing would just match no route and render the SPA shell instead.
      window.location.href = item.href;
    } else {
      navigate(item.href);
    }
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => (shown.length ? (a + 1) % shown.length : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => (shown.length ? (a - 1 + shown.length) % shown.length : 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        go(shown[active]);
      } else if (e.key === "Tab") {
        // a modal you can tab out of, into the page behind it, isn't modal
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // Re-bound when the result set or the highlight moves, so Enter always
    // opens the row you can actually see highlighted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, shown, active]);

  let lastGroup: string | null = null;

  return (
    <div className={`cmdk${open ? " is-open" : ""}`} aria-hidden={!open}>
      <div className="cmdk__backdrop" onClick={onClose} />
      <div className="cmdk__panel" role="dialog" aria-modal="true" aria-label="Search this site">
        <div className="cmdk__field">
          <SearchIcon />
          <input
            ref={inputRef}
            id="cmdk-input"
            type="text"
            placeholder="Search pages, sections, source…"
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd>esc</kbd>
        </div>

        <div className="cmdk__results" ref={resultsRef} role="listbox" aria-label="Results">
          {!shown.length && <p className="cmdk__empty">Nothing matches “{query.trim()}”.</p>}
          {shown.map((item, i) => {
            const head = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            return (
              <Fragment key={item.href + item.label}>
                {head && <p className="cmdk__group">{head}</p>}
                <button
                  type="button"
                  className={`cmdk__item${i === active ? " is-active" : ""}`}
                  role="option"
                  aria-selected={i === active}
                  onClick={() => go(item)}
                  onPointerEnter={() => setActive(i)}
                >
                  <span className="cmdk__label">{item.label}</span>
                  <span className="cmdk__hint">{item.hint}</span>
                </button>
              </Fragment>
            );
          })}
        </div>

        <div className="cmdk__foot">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> navigate
          </span>
          <span>
            <kbd>↵</kbd> open
          </span>
          <span>
            <kbd>esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
