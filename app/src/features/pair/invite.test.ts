// @vitest-environment jsdom
// The phone's pairing link: the secret comes out of the address bar before
// anything else can read it (the router, GA4's page_view, Vercel Analytics).
import { afterEach, describe, expect, it } from "vitest";
import { captureInviteFromUrl } from "./invite";
import { usePairStore } from "./pairStore";
import { newSecret } from "./protocol";

afterEach(() => {
  usePairStore.getState().setInvite(null);
  window.history.replaceState(null, "", "/");
});

describe("captureInviteFromUrl", () => {
  it("takes the secret out of the URL without a history entry, and keeps it in memory", () => {
    const secret = newSecret();
    window.history.replaceState(null, "", `/?keep=1#/pair/${secret}`);
    const before = window.history.length;
    expect(captureInviteFromUrl()).toBe(secret);
    expect(window.location.href).not.toContain(secret);
    expect(window.location.hash).toBe("");
    // The rest of the URL survives.
    expect(window.location.search).toBe("?keep=1");
    expect(window.history.length).toBe(before);
    expect(usePairStore.getState().invite).toBe(secret);
  });

  it("a mangled pairing link is still taken out, and remembered as unusable", () => {
    window.history.replaceState(null, "", "/#/pair/abc");
    expect(captureInviteFromUrl()).toBe("");
    expect(window.location.hash).toBe("");
    expect(usePairStore.getState().invite).toBe("");
  });

  it("leaves every other URL alone", () => {
    window.history.replaceState(null, "", "/#/settings/security");
    expect(captureInviteFromUrl()).toBeNull();
    expect(window.location.hash).toBe("#/settings/security");
    expect(usePairStore.getState().invite).toBeNull();
  });
});
