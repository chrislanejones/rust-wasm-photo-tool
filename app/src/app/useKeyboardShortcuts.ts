import { useEffect, useRef } from "react";
import { useUIStore } from "@/stores/useUIStore";
import { GROUP_BY_KEY, type ToolGroupId } from "@/features/tools/toolGroups";
import { setPaletteActions } from "@/features/commandPalette";
import { navigateTo } from "@/features/routing";

// Digits 1-5 select the five tool GROUPS, in rail order. The table is no
// longer written here at all: it is `GROUP_BY_KEY`, derived from TOOL_GROUPS
// in features/tools/toolGroups.ts, so the binding, the rail tooltip and the
// ShortcutModal row cannot disagree about which digit does what.
//
// This replaces the old eleven-entry TOOL_BY_KEY (digits 1-9, then `0`, then
// `-` for the eleventh tool). Sub-tools get NO bare-key bindings: 33 of them
// would exhaust the number row and then some, and the brief is explicit that
// they are palette- and click-reachable only unless a binding is obvious.
// Freeing `0` and `-` also removes the bare-`Minus` collision hazard that the
// old table had to reason about against Alt+`-` (zoom out).

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
  onGroupChange?: (group: ToolGroupId) => void;
  onFlipH?: () => void;
  onFlipV?: () => void;
  onRotateCw?: () => void;
  onCopyToClipboard?: () => void;
  /** Ctrl/Cmd+C — region-aware copy: the active bounding box / selection
   *  (crop box, shape bbox, magic-wand bounds), falling back to the whole
   *  canvas. Ctrl+Shift+C stays the explicit whole-canvas copy. */
  onCopyRegion?: () => void;
  /** Ctrl/Cmd+J — place the selection on a new layer, leaving the original
   *  (Layer Via Copy). Only fires while something is selected (`hasSelection`)
   *  — otherwise the browser keeps its own Ctrl+J. */
  onNewLayerCopy?: () => void;
  /** Ctrl/Cmd+Shift+J — same, but clears the selected pixels off the source
   *  layer (Layer Via Cut). */
  onNewLayerCut?: () => void;
  /** Ctrl/Cmd+M — toggle the Move-layer mode (Layer Settings tool). */
  onToggleMove?: () => void;
  /** Ctrl/Cmd+Shift+] — send the active layer to the top of the stack.
   *  Ctrl/Cmd+Shift+[ — send it to the bottom (above the canvas layer). */
  onLayerToFront?: () => void;
  onLayerToBack?: () => void;
  /** Enter — apply the pending crop box (same action as the Apply Crop
   *  button). Only fires while a crop selection exists. */
  onApplyCrop?: () => void;
  hasCropSelection?: boolean;
  /** Ctrl/Cmd+\ — pop the feature-celebration dialog (easter egg). */
  onShowCelebration?: () => void;
  // Item 4: Gallery cycling
  onNextPhoto?: () => void;
  onPrevPhoto?: () => void;
  // Item 2: Spacebar pan
  onSpaceDown?: () => void;
  onSpaceUp?: () => void;
}

/** `<input>` types that are controls rather than text fields. Ctrl+Z while
 *  one has focus is the app's undo — see the guard in `handleKeyDown`. */
const NON_TEXT_INPUT_TYPES: ReadonlySet<string> = new Set([
  "range",
  "checkbox",
  "radio",
  "button",
  "submit",
  "reset",
  "color",
  "file",
]);

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
  onLayerToFront,
  onLayerToBack,
  onApplyCrop,
  hasCropSelection,
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
  onGroupChange,
  onFlipH,
  onFlipV,
  onRotateCw,
  onCopyToClipboard,
  onCopyRegion,
  onNewLayerCopy,
  onNewLayerCut,
  onNextPhoto,
  onPrevPhoto,
  onSpaceDown,
  onSpaceUp,
}: KeyboardShortcutOptions) {
  const spaceHeldRef = useRef(false);

  // Publish the session handlers the command palette reuses (undo/redo).
  // This hook already receives them from AppShell for Ctrl+Z/Ctrl+Shift+Z —
  // registering here gives the palette the same reach with zero AppShell
  // edits and no CustomEvents.
  useEffect(() => {
    setPaletteActions({ undo: onUndo, redo: onRedo });
    return () => setPaletteActions(null);
  }, [onUndo, onRedo]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target;
      // A NON-text input — a range slider, checkbox, radio, button — takes
      // focus when clicked and keeps it. It is not a place the user types, so
      // Ctrl+Z there means the app's undo, not the field's. Drag the Strength
      // slider, press Ctrl+Z, and nothing happening is a bug: this used to be
      // masked by a second, unguarded Ctrl+Z listener in useHistory (removed
      // 2026-08-28 because it made every undo a double step).
      //
      // ONLY undo/redo pass through for these controls. Everything else keeps
      // the early return, so a focused slider's arrow keys, Space and Enter
      // still reach the control itself.
      const nonTextInput =
        target instanceof HTMLInputElement && NON_TEXT_INPUT_TYPES.has(target.type);
      if (nonTextInput) {
        if ((e.metaKey || e.ctrlKey) && (e.key === "z" || e.key === "Z")) {
          e.preventDefault();
          if (e.shiftKey) onRedo();
          else onUndo();
        }
        return;
      }
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
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

      // ─── Enter → apply the pending crop ─────────────────
      // Same action as the Apply Crop button. Guarded on an actual crop box
      // existing, so plain Enter stays inert everywhere else; the focused-
      // control guard above already ran, so a Tab-focused button still wins.
      if (
        e.key === "Enter" &&
        !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey &&
        hasCropSelection &&
        onApplyCrop
      ) {
        e.preventDefault();
        onApplyCrop();
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
          if (e.shiftKey) onRedo();
          else onUndo();
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
        // Ctrl/Cmd + J → selection to a new layer (Copy); +Shift → Cut.
        // Only claims the key while something is actually selected — with no
        // selection the browser keeps its own Ctrl+J (downloads/etc.), same
        // spirit as Ctrl+C yielding to a native text selection above.
        if (e.code === "KeyJ") {
          if (!hasSelection) return;
          e.preventDefault();
          if (e.shiftKey) onNewLayerCut?.();
          else onNewLayerCopy?.();
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
        // Brackets. THIS BRANCH READS `shiftKey` AND IT DID NOT USED TO.
        //
        // Both handlers below sat outside any shift test, so Ctrl+Shift+] and
        // Ctrl+Shift+[ ALSO did brush size — silently, undocumented, and
        // occupying the two chords Photoshop uses for bring-to-front and
        // send-to-back. `docs/Keyboard-Shortcuts.md` listed only the unshifted
        // pair, so anyone checking for a collision would have concluded the
        // shifted pair was free. It was not; it was bound by omission.
        //
        // Nothing is taken from anyone here: the shifted pair now does what a
        // user coming from Photoshop already expects, and brush size keeps the
        // unshifted pair it was documented as owning.
        if (e.code === "BracketLeft" || e.code === "BracketRight") {
          e.preventDefault();
          const toFront = e.code === "BracketRight";
          if (e.shiftKey) {
            (toFront ? onLayerToFront : onLayerToBack)?.();
          } else {
            onAdjustBrushSize(toFront ? 1 : -1);
          }
          return;
        }
        return;
      }

      // ─── Alt combos ────────────────────────────────────
      if (e.altKey) {
        // Alt+, toggles the command palette. Reads the UI store directly (the
        // palette is global chrome, not an AppShell concern — no new prop).
        // The input/textarea/contentEditable guard above already prevents this
        // firing while the user is typing.
        if (e.code === "Comma") {
          e.preventDefault();
          useUIStore.getState().setShowCommandPalette((v) => !v);
          return;
        }

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
            // Store action, not the old `image-horse:open-settings` CustomEvent
            // (Stage 3: window events are gone). Settings is a ROUTE now, so
            // Alt+S navigates like any other view change and the URL follows.
            navigateTo({ kind: "settings", tab: useUIStore.getState().settingsTab });
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

      // ─── Bare digits 1-5 → tool GROUP switching ────────────────────
      if (onGroupChange && e.code in GROUP_BY_KEY) {
        e.preventDefault();
        onGroupChange(GROUP_BY_KEY[e.code]);
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
    onUndo, onRedo, onExport, onExportAll, onDeleteAll, onSelectAll, onDeselect, hasSelection, onApplyCrop, hasCropSelection, onAdjustBrushSize,
    setShowUpload, setShowTools, setShowGallery,
    setShowHistory, setShowShortcutModal, setShowDiagnostics, onZoomIn,
    onZoomOut, onZoomReset, onGroupChange, onFlipH, onFlipV, onRotateCw,
    onCopyToClipboard, onCopyRegion, onNewLayerCopy, onNewLayerCut, onNextPhoto, onPrevPhoto, onSpaceDown, onSpaceUp,
    onLayerToFront, onLayerToBack,
  ]);
}
