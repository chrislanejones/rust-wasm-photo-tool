// ===== FILE: app/src/components/StatusBar/StatusBar.tsx =====
// Item 8: Architecture link opens in new tab
// Item 2: Added spacebar hint
// Item 4: Added PgUp/PgDn hint
import { Fragment, useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import type { CloneStampState } from "@/hooks/useCloneStamp";
import { formatBytes } from "@/lib/format";
import { useUploadDimensions } from "@/hooks/useUploadDimensions";
import { useBreakpoint } from "@/lib/useBreakpoint";

export interface ShortcutHint {
  keys: string;
  label: string;
}

/** Pool of generic, tool-agnostic interface hints the status bar rotates
 *  through in the third slot (tool-specific shortcuts belong in
 *  `TOOL_SHORTCUT`/`TOOL_ACTION_SHORTCUT` in AppShell instead). */
const BASE_HINTS: ShortcutHint[] = [
  { keys: "Ctrl+Z", label: "undo" },
  { keys: "Ctrl+Shift+Z", label: "redo" },
  { keys: "Space", label: "pan" },
  { keys: "PgUp/Dn", label: "photos" },
  { keys: "Alt+Scroll", label: "zoom" },
  // Routing (v7.24) — the palette can copy a link straight to the view you're
  // in. Nothing else advertises that, and a URL you never see is a URL you
  // never use.
  { keys: "Alt+, → copy link", label: "share this view" },
];

/** The tail of the bar, pinned so the last slots are always in the same place.
 *  Neither cycles and neither is ever swapped out for a tool hint — the point
 *  is muscle memory: the two ways into everything else live at a fixed address.
 *
 *  ⚠️ Both are deliberately ABSENT from `BASE_HINTS`. A hint that is pinned and
 *  also in the rotation pool renders twice. */
const PINNED_SHORTCUTS: ShortcutHint = { keys: "Alt+/", label: "shortcuts" };
const PINNED_COMMANDS: ShortcutHint = { keys: "Alt+,", label: "commands" };

const CYCLE_MS = 3 * 60 * 1000; // rotate the interface-hint slots every 3 minutes

/** The bar has a fixed shape at each size, and the shape is the point — a hint
 *  you reach for should be in the same place every time you look.
 *
 *      DESKTOP (≥ BP_COMPACT), six slots
 *        1–2  the active TOOL's own shortcuts
 *        3–4  the rotating pool (BASE_HINTS)
 *          5  Alt+/  locked
 *          6  Alt+,  locked
 *
 *      COMPACT / TABLET (< BP_COMPACT), two slots
 *          1  the rotating pool
 *          2  Alt+/  locked
 *
 *  On compact the tool hints are dropped rather than the locked ones: the tool
 *  you are holding is already visible in the sidebar, whereas the two ways into
 *  everything else are not advertised anywhere except here. */
const TOOL_SLOTS_DESKTOP = 2;
const BASE_SLOTS_DESKTOP = 2;
const BASE_SLOTS_COMPACT = 1;

const MARKETING_URL = "https://image-horse.vercel.app";

/** Tier of the current user. Lives here historically; consumed by
 *  `photoLimits` and AppShell even though the status bar no longer shows it. */
export type UserMode = "demo" | "loggedIn" | "paid";

interface Props {
  state: CloneStampState;
  /** Active photo's file size in bytes; shown as a human-readable size. */
  fileSize?: number;
  /** The PHOTO's size (#81) — NOT the document's. Omitted falls back to the
   *  document, which is what this showed before, so nothing flickers on load. */
  photoWidth?: number;
  photoHeight?: number;
  /** Digit-key shortcut for the currently-active tool (1st dynamic slot). */
  activeToolHint?: ShortcutHint;
  /** The active tool's own distinctive action shortcut, when it has one (2nd
   *  dynamic slot). Falls through to the cycling interface-hint pool when
   *  absent, so that slot never sits empty. */
  activeToolHint2?: ShortcutHint;
}

export function StatusBar({
  state,
  fileSize,
  photoWidth,
  photoHeight,
  activeToolHint,
  activeToolHint2,
}: Props) {
  const sizeLabel = formatBytes(fileSize);
  // Read from the gallery store rather than two more props out of AppShell —
  // see the hook for why `entry.origWidth` is NOT the upload size.
  const uploadDims = useUploadDimensions();
  // #81 — the PHOTO's size, passed in rather than asked for here: AppShell
  // already holds the engine and the same numbers feed the Resize panel, so
  // one hook answers both and they cannot disagree. `state.width/height` is
  // the DOCUMENT, which on a default artboard import is photo + 2 ×
  // canvasPadding — a number 20px bigger than the file that was opened.
  const photoW = photoWidth ?? state.width;
  const photoH = photoHeight ?? state.height;

  // TWO things vary here, and they are independent:
  //   • the TOOL — `activeToolHint` / `activeToolHint2` change the moment the
  //     active tool does, so the first slots follow what you are holding.
  //   • TIME — the remaining slots rotate through BASE_HINTS every 3 minutes,
  //     so the bar eventually shows you everything rather than the same two
  //     shortcuts forever.
  // The LOCKED TAIL participates in neither. `Alt+/` is last at every size;
  // `Alt+,` follows it on desktop only.
  const { compact } = useBreakpoint();
  const locked: ShortcutHint[] = compact
    ? [PINNED_SHORTCUTS]
    : [PINNED_SHORTCUTS, PINNED_COMMANDS];
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setCycle((c) => c + 1), CYCLE_MS);
    return () => window.clearInterval(id);
  }, []);

  // Tool slots first — desktop only. Compact drops them (see the slot map).
  const dynamic: ShortcutHint[] = [];
  if (!compact) {
    if (activeToolHint) dynamic.push(activeToolHint);
    if (activeToolHint2 && !dynamic.some((d) => d.label === activeToolHint2.label)) {
      dynamic.push(activeToolHint2);
    }
    dynamic.splice(TOOL_SLOTS_DESKTOP);
  }

  // Then the rotating pool. A tool with fewer than two shortcuts leaves its
  // slot free and the pool takes it, so the row is never short — the same
  // fall-through the second tool slot has always had.
  const fillTo = compact
    ? BASE_SLOTS_COMPACT
    : TOOL_SLOTS_DESKTOP + BASE_SLOTS_DESKTOP;
  for (let i = 0; dynamic.length < fillTo && i < BASE_HINTS.length; i++) {
    const h = BASE_HINTS[(cycle + i) % BASE_HINTS.length];
    if (!dynamic.some((d) => d.label === h.label)) dynamic.push(h);
  }
  const hints: ShortcutHint[] = [...dynamic.slice(0, fillTo), ...locked];
  return (
    <footer className="status-bar">
      <div className="status-section">
        <a
          href={MARKETING_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="status-brand-link whitespace-nowrap"
          title="Visit image-horse.vercel.app"
        >
          <span>🐴 Image Horse</span>
          <ExternalLink size={12} aria-hidden="true" />
        </a>
      </div>

      <div className="status-section status-center">
        {hints.map((h, i) => (
          <Fragment key={`${h.keys}-${h.label}`}>
            {i > 0 && <span className="status-divider" />}
            <span className="status-shortcut-hint">
              <kbd>{h.keys}</kbd> {h.label}
            </span>
          </Fragment>
        ))}
      </div>

      <div className="status-section status-right">
        {sizeLabel && (
          <>
            <span className="status-zoom">{sizeLabel}</span>
            <span className="status-divider" />
          </>
        )}
        {uploadDims && (
          <>
            <span className="status-zoom" title="Dimensions of the photo as uploaded">
              Original: {uploadDims.width}×{uploadDims.height}
            </span>
            <span className="status-divider" />
          </>
        )}
        {/* The zoom percentage used to end this row. Removed 2026-09-10 at
            Chris's request — the canvas size beside it is the number that
            matters, and Alt+Scroll's hint on the left already says zoom. */}
        {/* "Photo:", not "Current:" (#81). The label was honest only while the
            number was the document AND the document was photo + padding. It now
            reports the PHOTO's own bounds, so it says which thing it measured —
            which is the question that started this: a freshly imported 800×600
            file read 820×620 and nothing said why.

            Falls back to the document until the engine has answered, which is
            what this showed before #81, so nothing flickers on load. */}
        <span className="status-zoom" title="Size of the photo itself, not the canvas it sits on">
          Photo: {photoW && photoH ? `${photoW}×${photoH}` : "—"}
        </span>
      </div>
    </footer>
  );
}
