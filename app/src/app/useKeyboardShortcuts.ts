// ===== FILE: app/src/app/useKeyboardShortcuts.ts =====
import { useEffect } from "react";
import type { StampSettings } from "@/lib/types";

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
}: KeyboardShortcutOptions) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Ctrl/Cmd + Z / Shift+Z for undo/redo
      if (e.metaKey || e.ctrlKey) {
        if (e.key === "z" || e.key === "Z") {
          e.preventDefault();
          if (e.shiftKey) {
            onRedo();
          } else {
            onUndo();
          }
          return;
        }
      }

      if (!e.altKey) return;

      // Alt + ? (Shift + /) → open shortcut modal
      if (e.shiftKey && e.code === "Slash") {
        e.preventDefault();
        setShowShortcutModal((v) => !v);
        return;
      }

      switch (e.code) {
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
          // Alt + / (no shift) → toggle inline KBD hints
          e.preventDefault();
          setShowKbdHints((v) => !v);
          break;
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
        case "KeyE":
          e.preventDefault();
          onExport();
          break;
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
    setShowShortcutModal,
  ]);
}
