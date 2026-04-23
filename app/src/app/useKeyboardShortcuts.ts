import { useEffect, useRef } from "react";
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
  Digit8: "effects",
  Digit9: "stamp",
  Digit0: "emoji",
};

interface KeyboardShortcutOptions {
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
  onExportAll?: () => void;
  onDeleteAll: () => void;
  onBrushSizeChange: (fn: (prev: StampSettings) => StampSettings) => void;
  setBrushSizeOnTool: (size: number) => void;
  setShowUpload: React.Dispatch<React.SetStateAction<boolean>>;
  setShowTools: React.Dispatch<React.SetStateAction<boolean>>;
  setShowGallery: React.Dispatch<React.SetStateAction<boolean>>;
  setShowHistory: React.Dispatch<React.SetStateAction<boolean>>;
  setShowShortcutModal: React.Dispatch<React.SetStateAction<boolean>>;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset?: () => void;
  onToolChange?: (tool: ToolType) => void;
  onFlipH?: () => void;
  onFlipV?: () => void;
  onRotateCw?: () => void;
  onCopyToClipboard?: () => void;
  // Item 4: Gallery cycling
  onNextPhoto?: () => void;
  onPrevPhoto?: () => void;
  // Item 2: Spacebar pan
  onSpaceDown?: () => void;
  onSpaceUp?: () => void;
}

export function useKeyboardShortcuts({
  onUndo,
  onRedo,
  onExport,
  onExportAll,
  onDeleteAll,
  onBrushSizeChange,
  setBrushSizeOnTool,
  setShowUpload,
  setShowTools,
  setShowGallery,
  setShowHistory,
  setShowShortcutModal,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onToolChange,
  onFlipH,
  onFlipV,
  onRotateCw,
  onCopyToClipboard,
  onNextPhoto,
  onPrevPhoto,
  onSpaceDown,
  onSpaceUp,
}: KeyboardShortcutOptions) {
  const spaceHeldRef = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // ─── Spacebar pan mode ──────────────────────────────
      if (e.code === "Space" && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault();
        if (!spaceHeldRef.current) {
          spaceHeldRef.current = true;
          onSpaceDown?.();
        }
        return;
      }

      // ─── PgUp / PgDn → gallery cycling ──────────────────
      if (e.code === "PageUp") {
        e.preventDefault();
        onPrevPhoto?.();
        return;
      }
      if (e.code === "PageDown") {
        e.preventDefault();
        onNextPhoto?.();
        return;
      }

      // ─── Ctrl/Cmd combos ────────────────────────────────
      if (e.metaKey || e.ctrlKey) {
        if (e.key === "z" || e.key === "Z") {
          e.preventDefault();
          e.shiftKey ? onRedo() : onUndo();
          return;
        }
        if (e.shiftKey && e.code === "KeyC") {
          e.preventDefault();
          onCopyToClipboard?.();
          return;
        }
        return;
      }

      // ─── Alt combos ────────────────────────────────────
      if (e.altKey) {
        if (e.shiftKey) {
          if (e.code === "Slash") {
            e.preventDefault();
            setShowShortcutModal((v) => !v);
            return;
          }
          if (e.code === "KeyE") {
            e.preventDefault();
            onExportAll?.();
            return;
          }
        }

        switch (e.code) {
          case "KeyU": e.preventDefault(); setShowUpload((v) => !v); break;
          case "KeyS": e.preventDefault(); setShowTools((v) => !v); break;
          case "KeyG": e.preventDefault(); setShowGallery((v) => !v); break;
          case "KeyH": e.preventDefault(); setShowHistory((v) => !v); break;
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
          case "Equal": e.preventDefault(); onZoomIn(); break;
          case "Minus": e.preventDefault(); onZoomOut(); break;
          case "Digit0": e.preventDefault(); onZoomReset?.(); break;
          case "KeyF": e.preventDefault(); onFlipH?.(); break;
          case "KeyV": e.preventDefault(); onFlipV?.(); break;
          case "KeyR": e.preventDefault(); onRotateCw?.(); break;
          case "KeyE": e.preventDefault(); onExport(); break;
          case "KeyD": e.preventDefault(); onDeleteAll(); break;
        }
        return;
      }

      // ─── Bare number keys → tool switching ──────────────
      if (onToolChange && e.code in TOOL_BY_DIGIT) {
        e.preventDefault();
        onToolChange(TOOL_BY_DIGIT[e.code]);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        spaceHeldRef.current = false;
        onSpaceUp?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    onUndo, onRedo, onExport, onExportAll, onDeleteAll, onBrushSizeChange,
    setBrushSizeOnTool, setShowUpload, setShowTools, setShowGallery,
    setShowHistory, setShowShortcutModal, onZoomIn,
    onZoomOut, onZoomReset, onToolChange, onFlipH, onFlipV, onRotateCw,
    onCopyToClipboard, onNextPhoto, onPrevPhoto, onSpaceDown, onSpaceUp,
  ]);
}
