// The ladder, the role, and the one rule that keeps a preview honest.
//
// Chris, 09-22-2026, asked how the levels should work: not logged in, logged
// in free, paid, and superuser — with superusers defaulting to paid and able
// to drop down. The answer these tests pin is that "superuser" is a ROLE, not
// a fourth rung: it entitles you to paid (server included), and the preview it
// unlocks may only take away.
import { describe, it, expect } from "vitest";
import {
  ENTITLEMENTS,
  atLeast,
  entitlementOf,
  fromUserMode,
  isAdminEmail,
  previewOf,
  rank,
  toUserMode,
  type Entitlement,
} from "../../../convex/entitlement";

describe("the ladder", () => {
  it("is three rungs, low to high, and each includes the ones before it", () => {
    expect([...ENTITLEMENTS]).toEqual(["none", "free", "paid"]);
    expect(atLeast("paid", "free")).toBe(true);
    expect(atLeast("free", "free")).toBe(true);
    expect(atLeast("free", "paid"), "free does not reach paid").toBe(false);
    expect(atLeast("none", "free")).toBe(false);
  });

  it("translates to the app's older UserMode words, both ways", () => {
    for (const e of ENTITLEMENTS) expect(fromUserMode(toUserMode(e))).toBe(e);
    expect(toUserMode("paid")).toBe("paid");
    expect(toUserMode("free")).toBe("loggedIn");
    expect(toUserMode("none")).toBe("demo");
  });
});

describe("entitlementOf — what a session may use", () => {
  it("signed out is none, whatever the row says", () => {
    expect(entitlementOf("pro", "user", false)).toBe("none");
    expect(entitlementOf(null, "user", false)).toBe("none");
  });

  it("signed in is free, and pro or team is paid", () => {
    expect(entitlementOf("free", "user", true)).toBe("free");
    expect(entitlementOf("pro", "user", true)).toBe("paid");
    expect(entitlementOf("team", "user", true)).toBe("paid");
  });

  it("an unknown, missing or junk tier never opens a paid door", () => {
    for (const t of [null, undefined, "", "PRO", "premium", "pro ", "admin"]) {
      expect(entitlementOf(t, "user", true), `tier ${JSON.stringify(t)}`).toBe("free");
    }
  });

  it("an admin is entitled to paid WITHOUT a tier grant", () => {
    // The point of the role: no fake `pro` on the account row, so the three
    // duplicate user rows one person can accumulate stop mattering.
    expect(entitlementOf("free", "admin", true)).toBe("paid");
    expect(entitlementOf(null, "admin", true)).toBe("paid");
  });

  it("admin outranks being signed out — the role is not a session", () => {
    // Reached only if a caller says admin while signed out; it must not crash
    // or silently downgrade the rule. Admin wins, and the caller is what
    // decides whether there is a session at all.
    expect(entitlementOf(null, "admin", false)).toBe("paid");
  });
});

describe("previewOf — a preview may only take away", () => {
  const cases: [Entitlement | null, Entitlement, Entitlement][] = [
    [null, "paid", "paid"],
    [null, "free", "free"],
    ["free", "paid", "free"],
    ["none", "paid", "none"],
    ["none", "free", "none"],
    ["paid", "free", "free"],
    ["paid", "none", "none"],
    ["free", "none", "none"],
  ];
  it.each(cases)("preview %s with entitlement %s → %s", (preview, ent, want) => {
    expect(previewOf(preview, ent)).toBe(want);
  });

  it("can never raise anyone above what the server allows", () => {
    for (const ent of ENTITLEMENTS) {
      for (const p of [...ENTITLEMENTS, null]) {
        expect(rank(previewOf(p as Entitlement | null, ent))).toBeLessThanOrEqual(rank(ent));
      }
    }
  });
});

describe("isAdminEmail", () => {
  it("takes a list, and tolerates spaces and case", () => {
    const list = " Chris@Example.com , second@example.com ";
    expect(isAdminEmail("chris@example.com", list)).toBe(true);
    expect(isAdminEmail("SECOND@example.com", list)).toBe(true);
    expect(isAdminEmail("third@example.com", list)).toBe(false);
  });

  it("still works for a single address, the older ADMIN_EMAIL shape", () => {
    expect(isAdminEmail("only@example.com", "only@example.com")).toBe(true);
  });

  it("a missing or empty list makes NOBODY an admin", () => {
    // A deployment that forgot the variable must not hand the role to whoever
    // signs in first.
    for (const list of [undefined, "", "   ", ",,"]) {
      expect(isAdminEmail("chris@example.com", list), `list ${JSON.stringify(list)}`).toBe(false);
    }
  });

  it("a missing email is never an admin", () => {
    expect(isAdminEmail(null, "chris@example.com")).toBe(false);
    expect(isAdminEmail(undefined, "chris@example.com")).toBe(false);
    expect(isAdminEmail("", "chris@example.com")).toBe(false);
    expect(isAdminEmail("   ", "chris@example.com")).toBe(false);
  });

  it("does not match a substring or a lookalike", () => {
    const list = "chris@example.com";
    expect(isAdminEmail("chris@example.com.evil.test", list)).toBe(false);
    expect(isAdminEmail("notchris@example.com", list)).toBe(false);
  });
});
