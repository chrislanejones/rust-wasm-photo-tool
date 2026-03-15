import type { CloneStampState } from "@/hooks/useCloneStamp";

interface Props {
  state: CloneStampState;
  imageCount: number;
}

export function StatusBar({ state, imageCount }: Props) {
  return (
    <footer className="status-bar">
      <div className="status-section">
        <span className={`source-status ${state.hasSource ? "has-source" : ""}`}>
          <span className="status-dot" />
          {state.hasSource
            ? "Source set — click to paint"
            : "Alt+Click to set source"}
        </span>
      </div>

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
          <kbd>Alt</kbd>+<kbd>[</kbd><kbd>]</kbd> brush
        </span>
      </div>

      <div className="status-section status-right">
        <span className="status-zoom-label">
          {imageCount} img{imageCount !== 1 ? "s" : ""}
        </span>
        <span className="status-divider" />
        <span className="status-zoom">
          {state.width && state.height
            ? `${state.width}×${state.height}`
            : "—"}
        </span>
        <span className="status-divider" />
        <span className="status-zoom">{Math.round(state.zoom * 100)}%</span>
      </div>
    </footer>
  );
}
