// The copied look (Copy look → Paste to selected, lib/look.ts) and the Paste
// dialog's open state. Store actions, not window events: the gallery's menus,
// the thumbnail's right-click and the Ctrl+Alt+C / Ctrl+Alt+V keys all ask
// here, and features/look/LookHost (which holds the live engine) answers.
import { create } from "zustand";
import type { LookStep } from "@/lib/look";

export interface CopiedLook {
  steps: LookStep[];
  /** The photo it came from: skipped on paste, and named in the dialog. */
  fromId: string;
  fromName: string;
}

interface LookState {
  copied: CopiedLook | null;
  pasteOpen: boolean;
  /** Set by LookHost while it is mounted: reads the open photo's look. */
  copyFromOpen: (() => Promise<void>) | null;
  setCopied: (look: CopiedLook | null) => void;
  openPaste: () => void;
  closePaste: () => void;
  setCopyFromOpen: (fn: (() => Promise<void>) | null) => void;
}

export const useLookStore = create<LookState>((set) => ({
  copied: null,
  pasteOpen: false,
  copyFromOpen: null,
  setCopied: (copied) => set({ copied }),
  openPaste: () => set({ pasteOpen: true }),
  closePaste: () => set({ pasteOpen: false }),
  setCopyFromOpen: (copyFromOpen) => set({ copyFromOpen }),
}));

/** Copy the open photo's look; a no-op while no editor is mounted. */
export function copyLook(): void {
  void useLookStore.getState().copyFromOpen?.();
}
