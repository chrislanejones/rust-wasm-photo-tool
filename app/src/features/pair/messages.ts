// What pairing says, on each side, in each state (ADR-105). Pure, so the
// wording is tested once and both surfaces read the same lines.
import type { PairStatus } from "./connection";

/** Why this device can or cannot pair right now. */
export type PairAvailability = "ready" | "online-off" | "no-server";

export function pairAvailability(allowed: boolean, hasSignaling: boolean): PairAvailability {
  if (!allowed) return "online-off";
  return hasSignaling ? "ready" : "no-server";
}

/** The line shown while "Everything in your browser" is on. Says why, not
 *  only that: signaling talks to a server, and photos would leave the tab. */
export const ONLINE_OFF_LINE =
  "Pairing is off while everything stays in your browser. It asks a server to introduce your two devices, and photos then leave this tab.";

export const NO_SERVER_LINE = "Pairing isn't available in this build of Image Horse.";

/** "4:59" from milliseconds left. Never negative. */
export function countdown(msLeft: number): string {
  const s = Math.max(0, Math.ceil(msLeft / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

type Line = { title: string; body?: string };

const UNREACHABLE: Line = {
  title: "Couldn't connect the two devices",
  body: "They didn't reach each other within 15 seconds. Some networks (offices, schools, some mobile carriers) block direct connections, and Image Horse doesn't relay photos through a server. Putting both on the same Wi-Fi usually works.",
};

const TAMPERED: Line = {
  title: "This connection couldn't be verified",
  body: "The handshake didn't match the QR code, so it was dropped before anything connected.",
};

/** The computer's dialog. */
export function computerLine(status: PairStatus | "idle"): Line {
  switch (status) {
    case "idle":
    case "starting":
      return { title: "Making a code…" };
    case "waiting":
      return { title: "Scan this with your phone's camera", body: "The code works once." };
    case "connecting":
      return { title: "Phone found. Connecting…" };
    case "connected":
      return { title: "Connected", body: "Your phone and this computer are paired. Keep both open." };
    case "expired":
      return { title: "This code expired", body: "Codes last 5 minutes. Make a new one to try again." };
    case "unreachable":
      return UNREACHABLE;
    case "tampered":
      return { ...TAMPERED, body: `${TAMPERED.body!} Make a new code and scan it again.` };
    case "busy":
      return { title: "Too many people are pairing right now", body: "Try again in a minute." };
    case "disconnected":
      return { title: "The phone disconnected" };
    case "unavailable":
    case "error":
    case "stopped":
      return { title: "Pairing couldn't start", body: "This browser may not support direct connections." };
  }
}

/** The phone's card. */
export function phoneLine(status: PairStatus | "idle"): Line {
  switch (status) {
    case "idle":
    case "starting":
    case "waiting":
    case "connecting":
      return { title: "Pairing with computer…" };
    case "connected":
      return { title: "Connected", body: "Paired with your computer. Keep this page open." };
    case "unavailable":
    case "expired":
      return {
        title: "This code has expired or was already used",
        body: "Make a new one on the computer and scan it again.",
      };
    case "unreachable":
      return UNREACHABLE;
    case "tampered":
      return { ...TAMPERED, body: `${TAMPERED.body!} Make a new code on the computer and scan it again.` };
    case "busy":
      return { title: "Too many people are pairing right now", body: "Try again in a minute." };
    case "disconnected":
      return { title: "The computer disconnected" };
    case "error":
    case "stopped":
      return { title: "Pairing couldn't start", body: "This browser may not support direct connections." };
  }
}

/** States a person can do nothing about but start again. */
export function isEnded(status: PairStatus | "idle"): boolean {
  return !["idle", "starting", "waiting", "connecting", "connected"].includes(status);
}
