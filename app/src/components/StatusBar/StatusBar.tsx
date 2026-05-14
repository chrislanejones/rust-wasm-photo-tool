// ===== FILE: app/src/components/StatusBar/StatusBar.tsx =====
// Item 8: Architecture link opens in new tab
// Item 2: Added spacebar hint
// Item 4: Added PgUp/PgDn hint
import type { CloneStampState } from "@/hooks/useCloneStamp";

export type UserMode = "demo" | "loggedIn" | "paid";

interface Props {
  state: CloneStampState;
  imageCount: number;
  userMode?: UserMode;
}

const USER_MODE_LABEL: Record<UserMode, string> = {
  demo: "Demo mode",
  loggedIn: "Logged in",
  paid: "Paid user",
};

export function StatusBar({ state, imageCount, userMode = "demo" }: Props) {
  return (
    <footer className="status-bar">
      <div className="status-section">
        <p>🐴 Image Horse</p>
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
          <kbd>Alt+?</kbd> shortcuts
        </span>
      </div>

      <div className="status-section status-right">
        <span className="status-zoom-label">
          {imageCount} img{imageCount !== 1 ? "s" : ""}
        </span>
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
          v0.9.6-beta
        </a>
      </div>
    </footer>
  );
}
