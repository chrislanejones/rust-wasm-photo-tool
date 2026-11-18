// Pairing's shared state (ADR-105). The controller (pairController.ts) writes
// it; the Pair a phone dialog, the phone's card and, in the next PR, the photo
// protocol read it. The live RTCPeerConnection and its data channel are held
// HERE so whatever sends photos can reach them without owning the handshake.
import { create } from "zustand";
import type { PairStatus, PairUpdate } from "./connection";

export type PairRole = "computer" | "phone";

interface PairState {
  /** The computer's Pair a phone dialog. */
  dialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
  /** The phone: the secret this page was opened with (`#/pair/<secret>`),
   *  already taken out of the address bar. "" for a mangled link. Null when
   *  this page was not opened from a pairing link, or it was dismissed. */
  invite: string | null;
  setInvite: (secret: string | null) => void;

  role: PairRole | null;
  status: PairStatus | "idle";
  /** The QR code's link. Holds the secret: shown, copied, never logged. */
  link: string | null;
  expiresAt: number | null;
  peer: RTCPeerConnection | null;
  channel: RTCDataChannel | null;

  /** Start a fresh attempt in `role`. */
  begin: (role: PairRole) => void;
  /** Apply one update from the attempt. */
  apply: (update: PairUpdate) => void;
  /** Back to idle (the attempt must already be stopped). */
  reset: () => void;
}

const IDLE = {
  role: null,
  status: "idle",
  link: null,
  expiresAt: null,
  peer: null,
  channel: null,
} as const;

export const usePairStore = create<PairState>((set) => ({
  dialogOpen: false,
  setDialogOpen: (dialogOpen) => set({ dialogOpen }),
  invite: null,
  setInvite: (invite) => set({ invite }),
  ...IDLE,
  begin: (role) => set({ ...IDLE, role, status: "starting" }),
  apply: (u) =>
    set((s) => ({
      status: u.status ?? s.status,
      link: u.link ?? s.link,
      expiresAt: u.expiresAt ?? s.expiresAt,
      peer: u.peer !== undefined ? u.peer : s.peer,
      channel: u.channel !== undefined ? u.channel : s.channel,
    })),
  reset: () => set({ ...IDLE }),
}));
