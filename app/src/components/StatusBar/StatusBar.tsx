// ===== FILE: app/src/components/StatusBar/StatusBar.tsx =====
import type { CloneStampState } from "@/hooks/useCloneStamp";

interface Props {
  state: CloneStampState;
  imageCount: number;
  showKbdHints: boolean;
}

export function StatusBar({
  state,
  imageCount,
  showKbdHints: _showKbdHints,
}: Props) {
  return (
    <footer className="status-bar">
      {/* Left — Source status */}
      <div className="status-section">
        <span
          className={`source-status ${state.hasSource ? "has-source" : ""}`}
        >
          <span className="status-dot" />
          {state.hasSource
            ? "Source set — click to paint"
            : "Alt+Click to set source"}
        </span>
      </div>

      {/* Center — Inline shortcut hints */}
      <div className="status-section status-center">
        <span className="status-shortcut-hint">
          <kbd>Alt</kbd>+<kbd>Click</kbd> source
        </span>
        <span className="status-divider" />
        <span className="status-shortcut-hint">
          <kbd>Alt</kbd>+<kbd>Scroll</kbd> zoom
        </span>
        <span className="status-divider" />
        <span className="status-shortcut-hint">
          <kbd>Ctrl</kbd>+<kbd>Z</kbd> undo
        </span>
        <span className="status-divider" />
        <span className="status-shortcut-hint">
          <kbd>Alt</kbd>+<kbd>[</kbd>
          <kbd>]</kbd> brush
        </span>
        <span className="status-divider" />
        {/* Alt+/ toggles inline KBD badges on bars */}
        <span className="status-shortcut-hint">
          <kbd>Alt</kbd>+<kbd>/</kbd> hints
        </span>
        <span className="status-divider" />
        {/* Alt+? opens the full shortcut modal */}
        <span className="status-shortcut-hint">
          <kbd>Alt</kbd>+<kbd>?</kbd> shortcuts
        </span>
      </div>

      {/* Right — Image count, dimensions, zoom */}
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
      </div>
    </footer>
  );
}
