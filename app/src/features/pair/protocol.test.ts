import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  PAIR_STUN_URL,
  decodeCandidate,
  encodeCandidate,
  isSecret,
  keyHashOf,
  macOf,
  newClientToken,
  newSecret,
  pairLink,
  secretBytes,
  secretFromHash,
  verifyMac,
} from "./protocol";
import { CLIENT_TOKEN, HEX64, PAIR_CANDIDATE_MAX_CHARS } from "../../../../convex/pairLimits";

const SDP = "v=0\r\no=- 46117 2 IN IP4 127.0.0.1\r\na=fingerprint:sha-256 AB:CD:EF\r\n";

describe("the QR secret", () => {
  it("is 128 random bits, URL-safe, 22 characters, and two are never the same", () => {
    const a = newSecret();
    const b = newSecret();
    expect(a).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(secretBytes(a)).toHaveLength(16);
    expect(a).not.toBe(b);
  });

  it("comes from crypto.getRandomValues, all 16 bytes of it", () => {
    const fixed = (buf: Uint8Array) => {
      buf.set(Array.from({ length: 16 }, (_, i) => i * 17));
      return buf;
    };
    const s = newSecret(fixed);
    expect([...secretBytes(s)!]).toEqual(Array.from({ length: 16 }, (_, i) => i * 17));
  });

  it("rejects anything that is not exactly 16 bytes of base64url", () => {
    for (const bad of ["", "short", "A".repeat(21), "A".repeat(23), "A".repeat(21) + "+", "A".repeat(21) + "/"]) {
      expect(isSecret(bad), bad).toBe(false);
    }
    expect(isSecret(newSecret())).toBe(true);
  });
});

describe("the link rides in the URL fragment", () => {
  it("is the page's own origin and path, then #/pair/<secret>", () => {
    const s = newSecret();
    expect(pairLink("https://edit.imagehorse.app", "/", s)).toBe(`https://edit.imagehorse.app/#/pair/${s}`);
    expect(pairLink("http://localhost:4311", "/", s)).toBe(`http://localhost:4311/#/pair/${s}`);
    // So the secret is never part of what a browser requests.
    const url = new URL(pairLink("https://edit.imagehorse.app", "/", s));
    expect(url.pathname + url.search).not.toContain(s);
  });

  it("reads the secret back out of a hash, and only a well-formed one", () => {
    const s = newSecret();
    expect(secretFromHash(`#/pair/${s}`)).toBe(s);
    expect(secretFromHash(`#/pair/${s}/`)).toBe(s);
    expect(secretFromHash(`#/pair/${s}x`)).toBeNull();
    expect(secretFromHash("#/pair/")).toBeNull();
    expect(secretFromHash("#/settings/security")).toBeNull();
    expect(secretFromHash("")).toBeNull();
  });
});

describe("what the server sees", () => {
  it("the key is SHA-256 of the secret's bytes, in hex, in the server's own format", async () => {
    const s = newSecret();
    const expected = createHash("sha256").update(secretBytes(s)!).digest("hex");
    const key = await keyHashOf(s);
    expect(key).toBe(expected);
    expect(key).toMatch(HEX64);
    expect(key).not.toContain(s);
  });

  it("the client token fits the server's pattern", () => {
    expect(newClientToken()).toMatch(CLIENT_TOKEN);
  });

  it("STUN is one public server, and no TURN", () => {
    expect(PAIR_STUN_URL).toMatch(/^stun:/);
  });
});

describe("the HMAC over the handshake", () => {
  it("is HMAC-SHA256 keyed by the secret, over a role label and the SDP", async () => {
    const s = newSecret();
    const expected = createHmac("sha256", secretBytes(s)!).update(`image-horse-pair/1 offer\n${SDP}`).digest("hex");
    expect(await macOf(s, "offer", SDP)).toBe(expected);
  });

  it("verifies the real thing", async () => {
    const s = newSecret();
    expect(await verifyMac(s, "answer", SDP, await macOf(s, "answer", SDP))).toBe(true);
  });

  it("refuses a tampered SDP (a swapped DTLS fingerprint)", async () => {
    const s = newSecret();
    const mac = await macOf(s, "offer", SDP);
    const swapped = SDP.replace("AB:CD:EF", "AB:CD:EE");
    expect(await verifyMac(s, "offer", swapped, mac)).toBe(false);
  });

  it("refuses a MAC made with a different secret (the server's own forgery)", async () => {
    const mac = await macOf(newSecret(), "offer", SDP);
    expect(await verifyMac(newSecret(), "offer", SDP, mac)).toBe(false);
  });

  it("refuses an offer's MAC presented as an answer's (no reflection)", async () => {
    const s = newSecret();
    expect(await verifyMac(s, "answer", SDP, await macOf(s, "offer", SDP))).toBe(false);
  });

  it("refuses a malformed MAC without throwing", async () => {
    const s = newSecret();
    for (const bad of ["", "zz", "a".repeat(63), "A".repeat(64)]) {
      expect(await verifyMac(s, "offer", SDP, bad), bad).toBe(false);
    }
  });
});

describe("candidates on the wire", () => {
  it("round-trip", () => {
    const c = { candidate: "candidate:1 1 udp 2122260223 192.168.1.4 54321 typ host", sdpMid: "0", sdpMLineIndex: 0 };
    expect(decodeCandidate(encodeCandidate(c)!)).toEqual(c);
  });

  it("one too long for the server is not sent", () => {
    expect(encodeCandidate({ candidate: "x".repeat(PAIR_CANDIDATE_MAX_CHARS), sdpMid: "0" })).toBeNull();
  });

  it("anything that is not a candidate is ignored", () => {
    for (const bad of ["", "nope", "{}", '{"candidate":5}', "[1]", "null"]) {
      expect(decodeCandidate(bad), bad).toBeNull();
    }
  });
});
