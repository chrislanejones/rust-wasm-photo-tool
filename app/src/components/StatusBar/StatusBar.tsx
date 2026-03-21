// ===== FILE: app/src/components/StatusBar/StatusBar.tsx =====
// Item 8: Architecture link opens in new tab
// Item 2: Added spacebar hint
// Item 4: Added PgUp/PgDn hint
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
  effects: [
    { keys: "Drag", action: "blur area" },
    { keys: "Sliders", action: "brightness/contrast" },
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
      <div className="status-section">🐴 Image Horse</div>

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
            {/* Item 2: Spacebar hint */}
            <span className="status-shortcut-hint">
              <kbd>Space</kbd> pan
            </span>
            <span className="status-divider" />
            {/* Item 4: PgUp/PgDn hint */}
            <span className="status-shortcut-hint">
              <kbd>PgUp/Dn</kbd> photos
            </span>
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
        {/* Item 8: Opens in new tab — back button no longer destroys state */}
        <a
          href="/architecture"
          target="_blank"
          rel="noopener noreferrer"
          className="status-zoom opacity-40 hover:opacity-100 transition-opacity"
          title="Architecture diagram (opens in new tab)"
        >
          v0.9.2-beta
        </a>
      </div>
    </footer>
  );
}
