import { useEffect } from "react";
import type { StampSettings } from "@/lib/types";

interface KeyboardShortcutOptions {
  // WASM tool actions
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
  onDeleteAll: () => void;
  onBrushSizeChange: (fn: (prev: StampSettings) => StampSettings) => void;
  setBrushSizeOnTool: (size: number) => void;

  // Panel toggles
  setShowUpload: React.Dispatch<React.SetStateAction<boolean>>;
  setShowTools: React.Dispatch<React.SetStateAction<boolean>>;
  setShowGallery: React.Dispatch<React.SetStateAction<boolean>>;
  setShowHistory: React.Dispatch<React.SetStateAction<boolean>>;
  setShowKbdHints: React.Dispatch<React.SetStateAction<boolean>>;
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
}: KeyboardShortcutOptions) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // ── Ctrl/Cmd shortcuts ────────────────────────────────────────
      if (e.metaKey || e.ctrlKey) {
        if (e.key === "z" || e.key === "Z") {
          e.preventDefault();
          if (e.shiftKey) {
            console.log("Redo hotkey triggered (Ctrl+Shift+Z)");
            onRedo();
          } else {
            console.log("Undo hotkey triggered (Ctrl+Z)");
            onUndo();
          }
          return;
        }
      }

      // ── Alt shortcuts ─────────────────────────────────────────────
      if (!e.altKey) return;

      switch (e.code) {
        // Panel toggles
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

        // Export
        case "KeyE":
          e.preventDefault();
          onExport();
          break;

        // Delete all
        case "KeyD":
          e.preventDefault();
          onDeleteAll();
          break;
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
  ]);
}
