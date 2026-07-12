import { useEffect, useRef } from "react";
import type { ToolType } from "@/lib/types";

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

/**
 * True if `el` (the focused element) is a control that natively responds to
 * Space/Enter activation — a real button, link, select, summary, or anything
 * with an ARIA widget role that handles its own keys. Used so the global
 * shortcut handler doesn't swallow Space (pan mode) or Enter when the user has
 * Tab-focused such a control: the browser must be allowed to fire the click.
 */
function isActivatable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const node = el.closest(
    'button, a[href], select, summary, [role="button"], [role="link"], ' +
      '[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], ' +
      '[role="tab"], [role="checkbox"], [role="switch"], [role="radio"], [role="option"]',
  );
  if (!node) return false;
  // A disabled control won't activate, so don't block the shortcut for it.
  return !(node as HTMLButtonElement).disabled;
}

interface KeyboardShortcutOptions {
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
  onExportAll?: () => void;
  onDeleteAll: () => void;
  /** Selection Marker: Alt+A selects all; Alt+D deselects when something is
   *  selected, otherwise falls back to Delete All. */
  onSelectAll?: () => void;
  onDeselect?: () => void;
  hasSelection?: boolean;
  /** Shrink (-1) or grow (+1) the active brush — routed by tool in AppShell. */
  onAdjustBrushSize: (direction: -1 | 1) => void;
  setShowUpload: React.Dispatch<React.SetStateAction<boolean>>;
  setShowTools: React.Dispatch<React.SetStateAction<boolean>>;
  setShowGallery: React.Dispatch<React.SetStateAction<boolean>>;
  setShowHistory: React.Dispatch<React.SetStateAction<boolean>>;
  setShowShortcutModal: React.Dispatch<React.SetStateAction<boolean>>;
  setShowDiagnostics?: React.Dispatch<React.SetStateAction<boolean>>;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset?: () => void;
  onToolChange?: (tool: ToolType) => void;
  onFlipH?: () => void;
  onFlipV?: () => void;
  onRotateCw?: () => void;
  onCopyToClipboard?: () => void;
  /** Ctrl/Cmd+C — region-aware copy: the active bounding box / selection
   *  (crop box, shape bbox, magic-wand bounds), falling back to the whole
   *  canvas. Ctrl+Shift+C stays the explicit whole-canvas copy. */
  onCopyRegion?: () => void;
  /** Ctrl/Cmd+M — toggle the Move-layer mode (Layer Settings tool). */
  onToggleMove?: () => void;
  /** Ctrl/Cmd+\ — pop the feature-celebration dialog (easter egg). */
  onShowCelebration?: () => void;
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
  onSelectAll,
  onDeselect,
  hasSelection,
  onToggleMove,
  onShowCelebration,
  onAdjustBrushSize,
  setShowUpload,
  setShowTools,
  setShowGallery,
  setShowHistory,
  setShowShortcutModal,
  setShowDiagnostics,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onToolChange,
  onFlipH,
  onFlipV,
  onRotateCw,
  onCopyToClipboard,
  onCopyRegion,
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
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return;
      }

      // ─── Keyboard activation of focused controls ────────
      // When the user has Tab-focused a button/link/etc., let the browser
      // handle Space/Enter so the control actually activates. Without this the
      // Space-pan branch below would preventDefault and swallow the click.
      //
      // Enter always activates a focused control. Space is special: it doubles
      // as the pan hotkey, and a MOUSE click on a tool button leaves that
      // button focused (but NOT :focus-visible). If we blocked Space for any
      // focused control, space-to-pan would silently re-fire the last-clicked
      // tool. So we only let Space activate when the control is keyboard-
      // focused (:focus-visible) — preserving Tab+Space accessibility while
      // letting mouse users pan after clicking a tool.
      if (e.key === "Enter" && isActivatable(e.target)) {
        return;
      }
      if (
        (e.code === "Space" || e.key === " ") &&
        isActivatable(e.target) &&
        e.target instanceof Element &&
        e.target.matches(":focus-visible")
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
        if (e.code === "KeyC") {
          if (e.shiftKey) {
            // Ctrl/Cmd+Shift+C — explicit whole-canvas copy (unchanged).
            e.preventDefault();
            onCopyToClipboard?.();
            return;
          }
          // Ctrl/Cmd+C — region-aware copy. Yield to a native DOM text
          // selection (don't preventDefault) so copying page text still works.
          const sel = window.getSelection();
          if (!sel || sel.isCollapsed) {
            e.preventDefault();
            onCopyRegion?.();
          }
          return;
        }
        // Ctrl/Cmd + M → toggle Move-layer (Layer Settings tool).
        if (e.code === "KeyM") {
          e.preventDefault();
          onToggleMove?.();
          return;
        }
        // Ctrl/Cmd + \ → feature-celebration popper (easter egg).
        if (e.code === "Backslash") {
          e.preventDefault();
          onShowCelebration?.();
          return;
        }
        // Ctrl/Cmd + [ or ] → shrink / grow the active brush (any brush tool).
        if (e.code === "BracketLeft") {
          e.preventDefault();
          onAdjustBrushSize(-1);
          return;
        }
        if (e.code === "BracketRight") {
          e.preventDefault();
          onAdjustBrushSize(1);
          return;
        }
        return;
      }

      // ─── Alt combos ────────────────────────────────────
      if (e.altKey) {
        // Alt+/ toggles the shortcut modal (with or without Shift, so users
        // can press the literal "/" key or the shifted "?" interchangeably).
        if (e.code === "Slash") {
          e.preventDefault();
          setShowShortcutModal((v) => !v);
          return;
        }

        // Alt+Delete -> diagnostics log overlay
        if (e.code === "Delete") {
          e.preventDefault();
          setShowDiagnostics?.((v) => !v);
          return;
        }
        if (e.shiftKey) {
          if (e.code === "KeyE") {
            e.preventDefault();
            onExportAll?.();
            return;
          }
        }

        switch (e.code) {
          case "KeyN": e.preventDefault(); setShowUpload((v) => !v); break;
          case "KeyT": e.preventDefault(); setShowTools((v) => !v); break;
          case "KeyG": e.preventDefault(); setShowGallery((v) => !v); break;
          case "KeyR": e.preventDefault(); setShowHistory((v) => !v); break;
          case "Equal": e.preventDefault(); onZoomIn(); break;
          case "Minus": e.preventDefault(); onZoomOut(); break;
          case "Digit0": e.preventDefault(); onZoomReset?.(); break;
          case "KeyF": e.preventDefault(); onFlipH?.(); break;
          case "KeyV": e.preventDefault(); onFlipV?.(); break;
          case "KeyS":
            e.preventDefault();
            window.dispatchEvent(new CustomEvent("image-horse:open-settings"));
            break;
          case "KeyE": e.preventDefault(); onExport(); break;
          case "KeyA": e.preventDefault(); onSelectAll?.(); break;
          case "KeyD":
            e.preventDefault();
            if (hasSelection) onDeselect?.();
            else onDeleteAll();
            break;
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
      // Only end pan mode if it actually started on keydown. If a button was
      // focused we deliberately let the keydown through, so spaceHeldRef stays
      // false — and we must NOT preventDefault here, or we'd cancel the
      // button's native Space-keyup click.
      if (e.code === "Space" && spaceHeldRef.current) {
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
    onUndo, onRedo, onExport, onExportAll, onDeleteAll, onSelectAll, onDeselect, hasSelection, onAdjustBrushSize,
    setShowUpload, setShowTools, setShowGallery,
    setShowHistory, setShowShortcutModal, setShowDiagnostics, onZoomIn,
    onZoomOut, onZoomReset, onToolChange, onFlipH, onFlipV, onRotateCw,
    onCopyToClipboard, onCopyRegion, onNextPhoto, onPrevPhoto, onSpaceDown, onSpaceUp,
  ]);
}
