// ===== FILE: app/src/components/StatusBar/StatusBar.tsx =====
// Item 8: Architecture link opens in new tab
// Item 2: Added spacebar hint
// Item 4: Added PgUp/PgDn hint
import { ExternalLink } from "lucide-react";
import type { CloneStampState } from "@/hooks/useCloneStamp";

const MARKETING_URL = "https://image-horse.vercel.app";

export type UserMode = "demo" | "loggedIn" | "paid";

interface Props {
  state: CloneStampState;
  imageCount: number;
  userMode?: UserMode;
  /** Per-tier gallery cap, shown as "count / max" when provided. */
  maxPhotos?: number;
  /** Active photo's file size in bytes; shown as a human-readable size. */
  fileSize?: number;
}

/** Format a byte count as a compact human-readable size (e.g. "80 KB"). */
function formatBytes(n?: number): string | null {
  if (n == null || n <= 0) return null;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const USER_MODE_LABEL: Record<UserMode, string> = {
  demo: "Demo mode",
  loggedIn: "Logged in",
  paid: "Paid user",
};

export function StatusBar({ state, imageCount, userMode = "demo", maxPhotos, fileSize }: Props) {
  const sizeLabel = formatBytes(fileSize);
  return (
    <footer className="status-bar">
      <div className="status-section">
        <a
          href={MARKETING_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="status-brand-link"
          title="Visit image-horse.vercel.app"
        >
          <span>🐴 Image Horse</span>
          <ExternalLink size={12} aria-hidden="true" />
        </a>
        <span className="status-divider" />
        <span className="status-zoom-label">{USER_MODE_LABEL[userMode]}</span>
      </div>

      <div className="status-section status-center">
        <span className="status-shortcut-hint">
          <kbd>Ctrl+Z</kbd> undo
        </span>
        <span className="status-divider" />
        <span className="status-shortcut-hint">
          <kbd>Ctrl+Shift+Z</kbd> redo
        </span>
        <span className="status-divider" />
        <span className="status-shortcut-hint">
          <kbd>Space</kbd> pan
        </span>
        <span className="status-divider" />
        <span className="status-shortcut-hint">
          <kbd>PgUp/Dn</kbd> photos
        </span>
        <span className="status-divider" />
        <span className="status-shortcut-hint">
          <kbd>Alt+/</kbd> shortcuts
        </span>
      </div>

      <div className="status-section status-right">
        <span className="status-zoom-label">
          {imageCount}{maxPhotos ? ` / ${maxPhotos}` : ""} img{imageCount !== 1 ? "s" : ""}
        </span>
        {sizeLabel && (
          <>
            <span className="status-divider" />
            <span className="status-zoom">{sizeLabel}</span>
          </>
        )}
        <span className="status-divider" />
        <span className="status-zoom">
          {state.width && state.height ? `${state.width}×${state.height}` : "—"}
        </span>
        <span className="status-divider" />
        <span className="status-zoom">{Math.round(state.zoom * 100)}%</span>
        <span className="status-divider" />
        {/* Item 8: Opens in new tab — back button no longer destroys state */}
        <a
          href="/architecture"
          target="_blank"
          rel="noopener noreferrer"
          className="status-zoom opacity-40 hover:opacity-100 transition-opacity"
          title="Architecture diagram (opens in new tab)"
        >
          v0.9.7-beta
        </a>
      </div>
    </footer>
  );
}
