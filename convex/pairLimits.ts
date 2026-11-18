// Pairing's limits (ADR-105), as plain numbers with no imports, so the editor
// can read the same values the server enforces (app/src/features/pair). The
// signaling functions in pairSessions.ts run WITHOUT sign-in, so every one of
// these is a cap on what an anonymous caller can make the server hold.

/** An unjoined session lives this long: the QR code is good for 5 minutes. */
export const PAIR_UNJOINED_TTL_MS = 5 * 60_000;
/** A joined session lives this long, as a backstop. The devices delete it
 *  themselves once they are connected (`close`). */
export const PAIR_JOINED_TTL_MS = 30 * 60_000;
/** An offer or an answer (an SDP) at most this many UTF-8 bytes. A real one
 *  with one data channel is about 1 KB. */
export const PAIR_SDP_MAX_BYTES = 16 * 1024;
/** ICE candidates a side. A laptop with a few network interfaces offers ~10. */
export const PAIR_CANDIDATES_MAX = 40;
/** One serialized candidate. A real one is ~150 characters. */
export const PAIR_CANDIDATE_MAX_CHARS = 512;
/** Sessions created in any one minute, by everybody together. The only cap a
 *  caller cannot step around (the per-client one below can be, see ADR-105). */
export const PAIR_CREATES_PER_MINUTE = 20;
/** Live sessions a single client token may hold at once. */
export const PAIR_LIVE_PER_CLIENT = 3;

/** SHA-256 hex: the session key (the hash of the QR secret) and both HMACs. */
export const HEX64 = /^[0-9a-f]{64}$/;
/** The per-tab client token: random, URL-safe, 16 to 64 characters. */
export const CLIENT_TOKEN = /^[A-Za-z0-9_-]{16,64}$/;
