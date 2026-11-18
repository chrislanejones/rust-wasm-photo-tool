// Pairing's protocol (ADR-105): the secret, the link, the hashed key, the
// HMAC over each side's SDP, and candidates on the wire. Pure, apart from
// WebCrypto. Nothing here talks to a server or knows about React.
//
// THE SECRET is 16 random bytes, base64url: 22 characters. It lives in the
// QR code's URL FRAGMENT, which a browser never sends to any server, and the
// phone takes it out of the address bar before anything else runs
// (invite.ts). The server only ever sees SHA-256 of it, as the session key.
//
// THE HMAC. Each side signs its SDP with HMAC-SHA256 keyed by the secret, and
// the other side checks it before `setRemoteDescription`. The SDP carries the
// DTLS fingerprint, so a server (or anyone between) that swaps an offer or an
// answer for its own cannot make the check pass without the secret, and the
// connection is dropped instead of made. The role is part of the message, so
// an offer's MAC cannot be replayed as an answer's.
import { PAIR_CANDIDATE_MAX_CHARS } from "../../../../convex/pairLimits";

/** The one STUN server. A public, credential-free server that tells each
 *  device its own public address; it never sees the session or a photo. No
 *  TURN (relay), on purpose: see ADR-105. Listed in the network registry. */
export const PAIR_STUN_URL = "stun:stun.cloudflare.com:3478";

/** From a phone joining (or the computer seeing it join) to the channel
 *  opening. Past this, the devices most likely cannot reach each other. */
export const PAIR_CONNECT_TIMEOUT_MS = 15_000;

/** The data channel's label. PR 2's photo protocol runs on it. */
export const PAIR_CHANNEL_LABEL = "image-horse-pair";

const ROUTE = /^#\/pair\/([A-Za-z0-9_-]{22})\/?$/;
const SECRET = /^[A-Za-z0-9_-]{22}$/;
const MAC = /^[0-9a-f]{64}$/;
const MAC_LABEL = "image-horse-pair/1";

type Fill = (buf: Uint8Array<ArrayBuffer>) => Uint8Array<ArrayBuffer>;
const fillRandom: Fill = (buf) => crypto.getRandomValues(buf);

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array<ArrayBuffer> | null {
  try {
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** A fresh 128-bit secret. */
export function newSecret(fill: Fill = fillRandom): string {
  return toBase64Url(fill(new Uint8Array(16)));
}

/** The secret's 16 bytes, or null if it is not one. */
export function secretBytes(secret: string): Uint8Array<ArrayBuffer> | null {
  if (!SECRET.test(secret)) return null;
  const bytes = fromBase64Url(secret);
  return bytes && bytes.length === 16 ? bytes : null;
}

export function isSecret(s: string): boolean {
  return secretBytes(s) !== null;
}

/** The QR code's link: this page's own origin and path, the secret in the
 *  fragment. Own origin, so a localhost build pairs with itself in tests. */
export function pairLink(origin: string, pathname: string, secret: string): string {
  return `${origin}${pathname}#/pair/${secret}`;
}

/** The secret in a `#/pair/<secret>` fragment, or null. */
export function secretFromHash(hash: string): string | null {
  const m = ROUTE.exec(hash);
  return m && isSecret(m[1]!) ? m[1]! : null;
}

/** The session key the server sees: SHA-256 of the secret's bytes, hex. */
export async function keyHashOf(secret: string): Promise<string> {
  const bytes = secretBytes(secret);
  if (!bytes) throw new Error("not a pairing secret");
  return toHex(await crypto.subtle.digest("SHA-256", bytes));
}

/** A random token for the server's per-client cap. Kept for this tab only. */
export function newClientToken(fill: Fill = fillRandom): string {
  return toBase64Url(fill(new Uint8Array(18)));
}

export type MacRole = "offer" | "answer";

async function hmacKey(secret: string, usage: "sign" | "verify"): Promise<CryptoKey> {
  const bytes = secretBytes(secret);
  if (!bytes) throw new Error("not a pairing secret");
  return crypto.subtle.importKey("raw", bytes, { name: "HMAC", hash: "SHA-256" }, false, [usage]);
}

function macMessage(role: MacRole, sdp: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(`${MAC_LABEL} ${role}\n${sdp}`) as Uint8Array<ArrayBuffer>;
}

/** HMAC-SHA256(secret, "image-horse-pair/1 <role>\n<sdp>"), hex. */
export async function macOf(secret: string, role: MacRole, sdp: string): Promise<string> {
  const key = await hmacKey(secret, "sign");
  return toHex(await crypto.subtle.sign("HMAC", key, macMessage(role, sdp)));
}

/** Whether `mac` is this side's HMAC over `sdp`. WebCrypto's verify compares
 *  in constant time. Never throws: anything malformed is simply false. */
export async function verifyMac(secret: string, role: MacRole, sdp: string, mac: string): Promise<boolean> {
  if (!MAC.test(mac)) return false;
  try {
    const key = await hmacKey(secret, "verify");
    return await crypto.subtle.verify("HMAC", key, fromHex(mac), macMessage(role, sdp));
  } catch {
    return false;
  }
}

/** A candidate as the server stores it, or null if it is too long to send. */
export function encodeCandidate(c: RTCIceCandidateInit): string | null {
  const s = JSON.stringify({ candidate: c.candidate, sdpMid: c.sdpMid, sdpMLineIndex: c.sdpMLineIndex });
  return s.length <= PAIR_CANDIDATE_MAX_CHARS ? s : null;
}

/** A stored candidate back, or null for anything that is not one. */
export function decodeCandidate(s: string): RTCIceCandidateInit | null {
  try {
    const v: unknown = JSON.parse(s);
    if (!v || typeof v !== "object" || Array.isArray(v)) return null;
    const o = v as Record<string, unknown>;
    if (typeof o.candidate !== "string") return null;
    const out: RTCIceCandidateInit = { candidate: o.candidate };
    if (typeof o.sdpMid === "string") out.sdpMid = o.sdpMid;
    if (typeof o.sdpMLineIndex === "number") out.sdpMLineIndex = o.sdpMLineIndex;
    return out;
  } catch {
    return null;
  }
}
