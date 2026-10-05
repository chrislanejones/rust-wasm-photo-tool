// The cloud storage quota rule (convex/entitlement.ts → storageQuotaVerdict),
// enforced by convex/storageQuota.ts at the moment a pointer is committed.
// Boundary tests: one byte under the cap, exactly at it, one byte over.
import { describe, expect, it } from "vitest";
import {
  formatBytes,
  STORAGE_QUOTA_BYTES,
  storageQuotaVerdict,
  type Entitlement,
} from "../../../convex/entitlement";
import { TIERS } from "./tiers";

const MiB = 1024 * 1024;

function verdict(entitlement: Entitlement, usedBytes: number, incomingBytes: number, replacingBytes = 0) {
  return storageQuotaVerdict({ entitlement, usedBytes, incomingBytes, replacingBytes });
}

describe("storage quota — the advertised caps", () => {
  it("free is 100 MB and Pro is 5 GB, the figures the pricing page sells", () => {
    expect(STORAGE_QUOTA_BYTES.free).toBe(100 * MiB);
    expect(STORAGE_QUOTA_BYTES.paid).toBe(5 * 1024 * MiB);
    expect(STORAGE_QUOTA_BYTES.none).toBe(0);
  });

  it("the app's tier matrix shows the server's numbers, not its own copy", () => {
    expect(TIERS.loggedIn.storageQuotaBytes).toBe(STORAGE_QUOTA_BYTES.free);
    expect(TIERS.paid.storageQuotaBytes).toBe(STORAGE_QUOTA_BYTES.paid);
    expect(TIERS.loggedIn.storageLabel).toBe("100 MB");
    expect(TIERS.paid.storageLabel).toBe("5 GB");
  });
});

describe.each([
  ["free", STORAGE_QUOTA_BYTES.free],
  ["paid", STORAGE_QUOTA_BYTES.paid],
] as const)("storage quota boundary — %s", (entitlement, cap) => {
  const incoming = 31 * MiB; // the live backend's median archive

  it("one byte under the cap after the write: allowed", () => {
    expect(verdict(entitlement, cap - incoming - 1, incoming)).toBeNull();
  });

  it("exactly at the cap after the write: allowed", () => {
    expect(verdict(entitlement, cap - incoming, incoming)).toBeNull();
  });

  it("one byte over the cap after the write: refused, in words a person can read", () => {
    const refusal = verdict(entitlement, cap - incoming + 1, incoming);
    expect(refusal).not.toBeNull();
    expect(refusal).toContain("cloud storage is full");
    expect(refusal).toContain(formatBytes(cap));
    expect(refusal).toContain("Delete a cloud edit or a share link");
  });
});

describe("storage quota — replacing a file", () => {
  it("replacing an edit with one the same size never fails, even on a full account", () => {
    const cap = STORAGE_QUOTA_BYTES.free;
    expect(verdict("free", cap, 40 * MiB, 40 * MiB)).toBeNull();
  });

  it("replacing with a file one byte larger on a full account is refused", () => {
    const cap = STORAGE_QUOTA_BYTES.free;
    expect(verdict("free", cap, 40 * MiB + 1, 40 * MiB)).not.toBeNull();
  });

  it("a signed-out session can store nothing", () => {
    expect(verdict("none", 0, 1)).not.toBeNull();
    expect(verdict("none", 0, 0)).toBeNull();
  });
});

describe("formatBytes", () => {
  it("reads the way the pricing page does", () => {
    expect(formatBytes(100 * MiB)).toBe("100 MB");
    expect(formatBytes(5 * 1024 * MiB)).toBe("5 GB");
    expect(formatBytes(Math.round(31.86 * MiB))).toBe("31.9 MB");
  });
});
