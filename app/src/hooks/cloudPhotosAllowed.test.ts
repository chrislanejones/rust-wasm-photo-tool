// What the "Everything in your browser" switch has to cover.
//
// 09-22-2026: the switch gated the AI tools (they carry `requiresNetwork`) and
// nothing else, while `useEditPersistence` uploaded a flattened copy of every
// edited photo on `isAuthenticated` ALONE. Settings › Security said "your
// photos never leave this tab" with the switch off; for a signed-in person
// that was false. Measured on the live deployment the same day: 207 files,
// 6.9 GB, median 31.7 MB — all of it this path.
//
// These tests pin the rule itself and, more importantly, pin that the two
// cloud READ/WRITE legs go through it while the two DELETE legs deliberately
// do not.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { cloudPhotosAllowed } from "./useEditPersistence";

describe("cloudPhotosAllowed", () => {
  it("needs BOTH a signed-in account and the switch on", () => {
    expect(cloudPhotosAllowed(true, true), "signed in, switch on").toBe(true);
    expect(cloudPhotosAllowed(true, false), "signed in, switch OFF").toBe(false);
    expect(cloudPhotosAllowed(false, true), "signed out, switch on").toBe(false);
    expect(cloudPhotosAllowed(false, false)).toBe(false);
  });

  it("is off for the default state of a fresh signed-in profile", () => {
    // The switch ships OFF (useUIStore's default), so signing in alone must not
    // start uploading photos. That is the whole bug this file exists for.
    const shippedDefaultOfTheSwitch = false;
    expect(cloudPhotosAllowed(true, shippedDefaultOfTheSwitch)).toBe(false);
  });
});

describe("the hook's own call sites", () => {
  // Reading the source is the only way to assert WHICH legs are gated without
  // mounting a hook that needs a live engine handle, a Convex client and an
  // IndexedDB. The strings below are load-bearing; if they are renamed, this
  // test fails loudly rather than going quietly vacuous.
  const src = readFileSync(
    fileURLToPath(new URL("./useEditPersistence.ts", import.meta.url)),
    "utf8",
  );

  it("sends and fetches only through the gate", () => {
    // The upload leg and the cloud-read leg.
    expect(src.match(/if \(cloudAllowed\) \{/g) ?? [], "gated legs").toHaveLength(2);
    // Neither may be reached by the old, weaker condition.
    expect(src).not.toMatch(/if \(isAuthenticated\) \{\s*\n\s*try \{\s*\n\s*const tool/);
  });

  it("still deletes from the server with the switch off", () => {
    // Both delete legs keep the bare auth check: taking a copy back must work
    // exactly when a person has decided to stop sending things.
    const deleteLegs = src.match(/if \(isAuthenticated\) \{/g) ?? [];
    expect(deleteLegs, "removeEdit + clearAll").toHaveLength(2);
    expect(src).toMatch(/removeEdit\(\{ photoKey: photoId \}\)/);
    expect(src).toMatch(/clearAllConvex\(\)/);
  });

  it("names the promise it is keeping, so the next reader finds the pane", () => {
    expect(src).toMatch(/Settings › Security/);
    expect(src).toMatch(/never leave this tab/);
  });
});
