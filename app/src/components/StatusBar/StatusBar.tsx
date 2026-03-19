import type { CloneStampState } from "@/hooks/useCloneStamp";
import type { ToolType } from "@/lib/types";

interface Props {
  state: CloneStampState;
  imageCount: number;
  showKbdHints: boolean;
  activeTool?: ToolType;
}

const TOOL_HINTS: Record<string, { keys: string; action: string }[]> = {
  stamp: [
    { keys: "Alt+Click", action: "set source" },
    { keys: "Alt+[ ]", action: "brush size" },
    { keys: "Ctrl+Z", action: "undo" },
  ],
  compress: [
    { keys: "Alt+E", action: "export" },
    { keys: "Ctrl+Z", action: "undo" },
  ],
  crop: [
    { keys: "Drag", action: "select area" },
    { keys: "Ctrl+Z", action: "undo" },
  ],
  brush: [
    { keys: "Drag", action: "paint" },
    { keys: "Alt+[ ]", action: "brush size" },
    { keys: "Ctrl+Z", action: "undo" },
  ],
  blur: [
    { keys: "Drag", action: "blur area" },
    { keys: "Alt+[ ]", action: "brush size" },
    { keys: "Ctrl+Z", action: "undo" },
  ],
  arrow: [
    { keys: "Drag", action: "draw arrow" },
    { keys: "Ctrl+Z", action: "undo" },
  ],
  shapes: [
    { keys: "Drag", action: "draw shape" },
    { keys: "Ctrl+Z", action: "undo" },
  ],
  emoji: [
    { keys: "Click", action: "stamp emoji" },
    { keys: "Ctrl+Z", action: "undo" },
  ],
  text: [
    { keys: "Click", action: "place text" },
    { keys: "Enter", action: "commit" },
    { keys: "Esc", action: "cancel" },
  ],
  ai: [{ keys: "Alt+E", action: "export" }],
};

export function StatusBar({
  state,
  imageCount,
  showKbdHints,
  activeTool = "stamp",
}: Props) {
  const hints = TOOL_HINTS[activeTool] ?? TOOL_HINTS.stamp;

  return (
    <footer className="status-bar">
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

      {/* Center — dynamic tool hints (toggle with Alt+/) */}
      <div className="status-section status-center">
        {showKbdHints && (
          <>
            {hints.map((hint, i) => (
              <span key={i} className="status-shortcut-hint">
                {i > 0 && <span className="status-divider" />}
                <kbd>{hint.keys}</kbd> {hint.action}
              </span>
            ))}
            <span className="status-divider" />
            <span className="status-shortcut-hint">
              <kbd>Alt+?</kbd> shortcuts
            </span>
            <span className="status-divider" />
          </>
        )}
        <span className="status-shortcut-hint">
          <kbd>Alt+/</kbd> hints
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
        <a
          href="/architecture"
          className="status-zoom opacity-40 hover:opacity-100 transition-opacity"
          title="Architecture diagram"
        >
          v0.9.1-beta
        </a>
      </div>
    </footer>
  );
}
