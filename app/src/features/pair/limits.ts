// What a pairing may send (ADR-105, "Sending"). Pure, so both ends read the
// same numbers: the SENDER checks what was picked, and the RECEIVER checks the
// manifest again, because a sender can lie (photoLink.ts).
//
// The type list and the 50 MB are Transfer's (features/transfer/send.ts), not
// a copy: a photo that can go through the inbox can go over a pairing.
import { MAX_BYTES, deviceLabel, isTransferImage, type DeviceLabel } from "@/features/transfer/send";
import type { PairRole } from "./pairStore";

/** Largest single photo: Transfer's 50 MB. */
export const PAIR_FILE_MAX_BYTES = MAX_BYTES;
/** Most photos in one send. */
export const PAIR_BATCH_MAX = 50;
/** Longest file name kept on the receiving side. */
const PAIR_NAME_MAX = 200;

export interface Picked {
  name: string;
  type: string;
  size: number;
}

export interface Refusal {
  name: string;
  reason: string;
}

const MiB = 1024 * 1024;

/** "60.0 MB, over the 50 MB limit for one photo" — Transfer's wording of size. */
function tooBigReason(bytes: number): string {
  return `${(bytes / MiB).toFixed(1)} MB, over the ${PAIR_FILE_MAX_BYTES / MiB} MB limit for one photo`;
}

const NOT_A_PHOTO = "not a photo Image Horse can open";
const OVER_BATCH = `over the ${PAIR_BATCH_MAX} photos you can send at once`;

/** Why this one file can't go, or null if it can. */
export function fileRefusal(f: Picked): string | null {
  if (!isTransferImage(f)) return NOT_A_PHOTO;
  if (f.size <= 0) return "empty";
  if (f.size > PAIR_FILE_MAX_BYTES) return tooBigReason(f.size);
  return null;
}

/** Split what was picked into what goes and what doesn't, with the reason.
 *  The first 50 that pass go; the rest are left out and said so. */
export function checkPicked<T extends Picked>(files: readonly T[]): { send: T[]; refused: Refusal[] } {
  const send: T[] = [];
  const refused: Refusal[] = [];
  for (const f of files) {
    const why = fileRefusal(f);
    if (why) refused.push({ name: f.name, reason: why });
    else if (send.length >= PAIR_BATCH_MAX) refused.push({ name: f.name, reason: OVER_BATCH });
    else send.push(f);
  }
  return { send, refused };
}

export type PeerLabel = DeviceLabel | "Computer";

const PHONE_LABELS: ReadonlySet<string> = new Set<DeviceLabel>(["iPhone", "iPad", "Android phone", "Android tablet", "Phone"]);

/** This device's label in a manifest: a guess from the user agent, nothing
 *  stored, no fingerprinting. A computer is just "Computer". */
export function ownLabel(role: PairRole, ua: string, maxTouchPoints = 0): PeerLabel {
  return role === "computer" ? "Computer" : deviceLabel(ua, maxTouchPoints);
}

/** The other side's label, kept only when it is one of ours. The computer is
 *  "Computer" whatever it says. */
export function peerLabel(raw: unknown, peerRole: PairRole): PeerLabel {
  if (peerRole === "computer") return "Computer";
  return typeof raw === "string" && PHONE_LABELS.has(raw) ? (raw as DeviceLabel) : "Phone";
}

/** "18 MB", "2.5 MB", "300 KB". */
export function sizeText(bytes: number): string {
  if (bytes < MiB) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const mb = bytes / MiB;
  return mb >= 10 ? `${Math.round(mb)} MB` : `${Number(mb.toFixed(1))} MB`;
}

/** "4 photos (18 MB)". */
export function batchLine(count: number, bytes: number): string {
  return `${count} ${count === 1 ? "photo" : "photos"} (${sizeText(bytes)})`;
}

/** The name as the receiver keeps it: no path, trimmed, at most 200 characters. */
export function cleanName(raw: string): string {
  const base = raw.split(/[\\/]/).pop()!.trim();
  return (base || "Photo").slice(0, PAIR_NAME_MAX);
}
