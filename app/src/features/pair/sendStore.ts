// The photo transfer on screen (ADR-105, "Sending"). The controller
// (sendController.ts) feeds the protocol's events in; the transfer dialog, the
// Send buttons and the phone's card read the view.
import { create } from "zustand";
import type { Refusal } from "./limits";
import type { LinkEvent } from "./photoLink";
import { reduceTransfer, type TransferView } from "./transferView";

interface SendState {
  view: TransferView | null;
  apply: (e: LinkEvent) => void;
  /** Sending: what the limits left out of the pick. */
  setRefused: (refused: Refusal[]) => void;
  /** Done with an ended transfer: close its dialog. */
  clear: () => void;
}

export const usePairSendStore = create<SendState>((set) => ({
  view: null,
  apply: (e) => set((s) => ({ view: reduceTransfer(s.view, e) })),
  setRefused: (refused) => set((s) => (s.view ? { view: { ...s.view, refused } } : {})),
  clear: () => set({ view: null }),
}));
