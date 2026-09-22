// @vitest-environment jsdom
//
// The sync switch on its own: where it is kept, what switching it off forgets,
// and that every tab of the device hears it.
import { describe, it, expect, beforeEach, vi } from "vitest";

const LEDGER = "image-horse-sync-ledger-v1";
const ACCOUNT = "image-horse-sync-account";
const entry = { rev: 3, pending: null, updatedAt: 0, seen: true };

async function load() {
  vi.resetModules();
  return await import("./enabled");
}

beforeEach(() => {
  localStorage.clear();
});

describe("the sync switch", () => {
  it("is on until someone turns it off, and stays off across a reload", async () => {
    let m = await load();
    expect(m.isSyncEnabled()).toBe(true);
    m.setSyncEnabled(false);
    m = await load(); // a reload: fresh module, same storage
    expect(m.isSyncEnabled()).toBe(false);
    m.setSyncEnabled(true);
    expect(localStorage.getItem("image-horse-sync-enabled")).toBeNull();
  });

  it("off forgets this device's record of the signed-in account, and only that account", async () => {
    localStorage.setItem(ACCOUNT, "acct_a");
    localStorage.setItem(LEDGER, JSON.stringify({ acct_a: { prefs: entry }, acct_b: { prefs: entry } }));
    const m = await load();

    m.setSyncEnabled(false);

    expect(localStorage.getItem(ACCOUNT)).toBeNull();
    expect(JSON.parse(localStorage.getItem(LEDGER)!)).toEqual({ acct_b: { prefs: entry } });
  });

  it("on keeps the ledger as it is", async () => {
    localStorage.setItem(ACCOUNT, "acct_a");
    localStorage.setItem(LEDGER, JSON.stringify({ acct_a: { prefs: entry } }));
    localStorage.setItem("image-horse-sync-enabled", "off");
    const m = await load();

    m.setSyncEnabled(true);

    expect(JSON.parse(localStorage.getItem(LEDGER)!)).toEqual({ acct_a: { prefs: entry } });
  });

  it("tells this tab's subscribers, and hears another tab through the storage event", async () => {
    const m = await load();
    const heard = vi.fn();
    const off = m.subscribeSyncEnabled(heard);

    m.setSyncEnabled(false);
    expect(heard).toHaveBeenCalledTimes(1);

    // Another tab turns it back on: its write reaches this tab as a `storage`
    // event, never as a call here.
    localStorage.removeItem("image-horse-sync-enabled");
    window.dispatchEvent(new StorageEvent("storage", { key: "image-horse-sync-enabled" }));
    expect(heard).toHaveBeenCalledTimes(2);
    expect(m.isSyncEnabled()).toBe(true);

    window.dispatchEvent(new StorageEvent("storage", { key: "some-other-key" }));
    expect(heard).toHaveBeenCalledTimes(2);

    off();
    m.setSyncEnabled(false);
    expect(heard).toHaveBeenCalledTimes(2);
  });

  it("setting the value it already has is a no-op", async () => {
    const m = await load();
    const heard = vi.fn();
    m.subscribeSyncEnabled(heard);
    m.setSyncEnabled(true);
    expect(heard).not.toHaveBeenCalled();
  });
});
