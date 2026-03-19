import { useEffect } from "react";
import type { StampSettings, ToolType } from "@/lib/types";

/** All ten tools in toolbar order — keys 1-9, 0 */
const TOOL_BY_DIGIT: Record<string, ToolType> = {
  Digit1: "compress",
  Digit2: "crop",
  Digit3: "brush",
  Digit4: "text",
  Digit5: "arrow",
  Digit6: "ai",
  Digit7: "shapes",
  Digit8: "blur",
  Digit9: "stamp",
  Digit0: "emoji",
};

interface KeyboardShortcutOptions {
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
  onDeleteAll: () => void;
  onBrushSizeChange: (fn: (prev: StampSettings) => StampSettings) => void;
  setBrushSizeOnTool: (size: number) => void;
  setShowUpload: React.Dispatch<React.SetStateAction<boolean>>;
  setShowTools: React.Dispatch<React.SetStateAction<boolean>>;
  setShowGallery: React.Dispatch<React.SetStateAction<boolean>>;
  setShowHistory: React.Dispatch<React.SetStateAction<boolean>>;
  setShowKbdHints: React.Dispatch<React.SetStateAction<boolean>>;
  setShowShortcutModal: React.Dispatch<React.SetStateAction<boolean>>;
  // Zoom
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset?: () => void;
  // Tool switching
  onToolChange?: (tool: ToolType) => void;
  // Transform shortcuts
  onFlipH?: () => void;
  onFlipV?: () => void;
  onRotateCw?: () => void;
  // Copy to clipboard
  onCopyToClipboard?: () => void;
}

export function useKeyboardShortcuts({
  onUndo,
  onRedo,
  onExport,
  onDeleteAll,
  onBrushSizeChange,
  setBrushSizeOnTool,
  setShowUpload,
  setShowTools,
  setShowGallery,
  setShowHistory,
  setShowKbdHints,
  setShowShortcutModal,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onToolChange,
  onFlipH,
  onFlipV,
  onRotateCw,
  onCopyToClipboard,
}: KeyboardShortcutOptions) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // ─── Ctrl/Cmd combos ─────────────────────────────
      if (e.metaKey || e.ctrlKey) {
        if (e.key === "z" || e.key === "Z") {
          e.preventDefault();
          e.shiftKey ? onRedo() : onUndo();
          return;
        }
        // Ctrl+Shift+C → copy to clipboard
        if (e.shiftKey && e.code === "KeyC") {
          e.preventDefault();
          onCopyToClipboard?.();
          return;
        }
        return;
      }

      // ─── Alt combos ──────────────────────────────────
      if (e.altKey) {
        // Alt+Shift+/ → shortcut modal
        if (e.shiftKey && e.code === "Slash") {
          e.preventDefault();
          setShowShortcutModal((v) => !v);
          return;
        }

        switch (e.code) {
          // Panels
          case "KeyU":
            e.preventDefault();
            setShowUpload((v) => !v);
            break;
          case "KeyS":
            e.preventDefault();
            setShowTools((v) => !v);
            break;
          case "KeyG":
            e.preventDefault();
            setShowGallery((v) => !v);
            break;
          case "KeyH":
            e.preventDefault();
            setShowHistory((v) => !v);
            break;
          case "Slash":
            e.preventDefault();
            setShowKbdHints((v) => !v);
            break;

          // Brush size
          case "BracketLeft":
            e.preventDefault();
            onBrushSizeChange((prev) => {
              const next = Math.max(2, prev.brushSize - 5);
              setBrushSizeOnTool(next);
              return { ...prev, brushSize: next };
            });
            break;
          case "BracketRight":
            e.preventDefault();
            onBrushSizeChange((prev) => {
              const next = Math.min(200, prev.brushSize + 5);
              setBrushSizeOnTool(next);
              return { ...prev, brushSize: next };
            });
            break;

          // Zoom
          case "Equal": // Alt + = / Alt + +
            e.preventDefault();
            onZoomIn();
            break;
          case "Minus": // Alt + -
            e.preventDefault();
            onZoomOut();
            break;
          case "Digit0": // Alt + 0 → reset zoom
            e.preventDefault();
            onZoomReset?.();
            break;

          // Transform
          case "KeyF": // Alt + F → flip horizontal
            e.preventDefault();
            onFlipH?.();
            break;
          case "KeyV": // Alt + Shift + F would conflict, so Alt+V for vertical flip
            e.preventDefault();
            onFlipV?.();
            break;
          case "KeyR": // Alt + R → rotate 90° CW
            e.preventDefault();
            onRotateCw?.();
            break;

          // Actions
          case "KeyE":
            e.preventDefault();
            onExport();
            break;
          case "KeyD":
            e.preventDefault();
            onDeleteAll();
            break;
        }
        return;
      }

      // ─── Bare number keys → tool switching (no modifier) ──
      if (onToolChange && e.code in TOOL_BY_DIGIT) {
        e.preventDefault();
        onToolChange(TOOL_BY_DIGIT[e.code]);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    onUndo,
    onRedo,
    onExport,
    onDeleteAll,
    onBrushSizeChange,
    setBrushSizeOnTool,
    setShowUpload,
    setShowTools,
    setShowGallery,
    setShowHistory,
    setShowKbdHints,
    setShowShortcutModal,
    onZoomIn,
    onZoomOut,
    onZoomReset,
    onToolChange,
    onFlipH,
    onFlipV,
    onRotateCw,
    onCopyToClipboard,
  ]);
}
