// ===== FILE: app/src/components/StatusBar/StatusBar.tsx =====
// Item 8: Architecture link opens in new tab
// Item 2: Added spacebar hint
// Item 4: Added PgUp/PgDn hint
import { Fragment, useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import type { CloneStampState } from "@/hooks/useCloneStamp";
import { formatBytes } from "@/lib/format";

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
  { keys: "Alt+,", label: "commands" },
  { keys: "Space", label: "pan" },
  { keys: "PgUp/Dn", label: "photos" },
  { keys: "Alt+Scroll", label: "zoom" },
];

/** Always pinned in the last slot — never cycles or swaps. */
const PINNED_HINT: ShortcutHint = { keys: "Alt+/", label: "shortcuts" };

const CYCLE_MS = 3 * 60 * 1000; // rotate the interface-hint slot every 3 minutes

const MARKETING_URL = "https://image-horse.vercel.app";

/** Tier of the current user. Lives here historically; consumed by
 *  `photoLimits` and AppShell even though the status bar no longer shows it. */
export type UserMode = "demo" | "loggedIn" | "paid";

interface Props {
  state: CloneStampState;
  /** Active photo's file size in bytes; shown as a human-readable size. */
  fileSize?: number;
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
  activeToolHint,
  activeToolHint2,
}: Props) {
  const sizeLabel = formatBytes(fileSize);

  // Rotate the interface-hint slot every 3 minutes. The first three slots
  // change (two tool-related, one interface-related cycling); Alt+/ is
  // always pinned last.
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setCycle((c) => c + 1), CYCLE_MS);
    return () => window.clearInterval(id);
  }, []);

  const dynamic: ShortcutHint[] = [];
  if (activeToolHint) dynamic.push(activeToolHint);
  if (activeToolHint2 && !dynamic.some((d) => d.label === activeToolHint2.label)) {
    dynamic.push(activeToolHint2);
  }
  for (let i = 0; dynamic.length < 3 && i < BASE_HINTS.length; i++) {
    const h = BASE_HINTS[(cycle + i) % BASE_HINTS.length];
    if (!dynamic.some((d) => d.label === h.label)) dynamic.push(h);
  }
  const hints: ShortcutHint[] = [...dynamic.slice(0, 3), PINNED_HINT];
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
        <span className="status-zoom">
          {state.width && state.height ? `${state.width}×${state.height}` : "—"}
        </span>
        <span className="status-divider" />
        <span className="status-zoom">{Math.round(state.zoom * 100)}%</span>
      </div>
    </footer>
  );
}
