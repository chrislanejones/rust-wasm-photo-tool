// ===== FILE: app/src/features/commandPalette/paletteActions.ts =====
// Bridge for AppShell-scoped session handlers the palette can't reach through
// ordinary stores (undo/redo live on the engine hook instance inside
// AppShell). useKeyboardShortcuts ALREADY receives them as props — it is the
// existing home for shortcuts, and the palette is just another keyboard
// surface — so its registration effect publishes them here. Zero AppShell
// edits, zero CustomEvents. A Zustand store (not a bare module ref) so the
// palette re-renders when the bridge mounts/unmounts and can disable the
// entries while no session handlers exist.
import { create } from "zustand";

interface PaletteActions {
  undo: () => void;
  redo: () => void;
}

interface PaletteActionsState {
  actions: PaletteActions | null;
}

export const usePaletteActionsStore = create<PaletteActionsState>(() => ({
  actions: null,
}));

/** Registration point — called by useKeyboardShortcuts' effect (mount →
 *  handlers, unmount → null). */
export function setPaletteActions(actions: PaletteActions | null): void {
  usePaletteActionsStore.setState({ actions });
}
