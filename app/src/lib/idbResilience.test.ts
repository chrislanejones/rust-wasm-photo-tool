// #23 — the hand-rolled IndexedDB stores cached a connection (or a promise)
// that could go bad and stay cached for the whole session.
//
// Two failure shapes, one per direction:
//   · a REJECTED open was cached, so a single transient failure (private-mode
//     quota refusal, an eviction landing mid-open) wedged that store until the
//     tab was reloaded — every later call got the same rejected promise back.
//   · a CLOSED connection was cached. Browsers close idle IndexedDB
//     connections on their own, and every transaction on a closed connection
//     throws InvalidStateError. For editPersistence that is every edit save
//     for the rest of the session.
//
// These drive the REAL store modules against fake-indexeddb, faulting
// `indexedDB.open` to produce each shape, because the interesting behaviour is
// in the module-level cache and a re-implementation here would prove nothing.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const realOpen = indexedDB.open.bind(indexedDB);

afterEach(() => {
  vi.restoreAllMocks();
  indexedDB.open = realOpen;
});

/** Fail the next `n` opens with an error, then behave normally. */
function failNextOpens(n: number): { calls: () => number } {
  let calls = 0;
  indexedDB.open = ((name: string, version?: number) => {
    calls += 1;
    if (calls > n) return realOpen(name, version);
    // A request object that reports failure on the next tick, the way a real
    // refused open does.
    const req = {
      onsuccess: null as null | (() => void),
      onerror: null as null | (() => void),
      onupgradeneeded: null as null | (() => void),
      error: new DOMException("quota", "QuotaExceededError"),
      result: undefined,
    };
    queueMicrotask(() => req.onerror?.());
    return req as unknown as IDBOpenDBRequest;
  }) as typeof indexedDB.open;
  return { calls: () => calls };
}

describe("originalsStore — a failed open is not cached forever", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("retries the open after a transient failure instead of wedging the store", async () => {
    const probe = failNextOpens(1);
    const store = await import("@/lib/originalsStore");

    // First call rides the faulted open and fails. Before #23 this rejection
    // was cached, and every later call in the session got it back.
    await expect(store.listOriginalKeys()).rejects.toBeTruthy();

    // Second call must open again — and succeed.
    const keys = await store.listOriginalKeys();
    expect(Array.isArray(keys)).toBe(true);
    expect(probe.calls()).toBeGreaterThanOrEqual(2);
  });
});

describe("galleryManifest — same guard, same reason", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("recovers on the next call after a refused open", async () => {
    failNextOpens(1);
    const mod = await import("@/lib/galleryManifest");

    await expect(mod.loadGalleryManifest()).rejects.toBeTruthy();
    await expect(mod.loadGalleryManifest()).resolves.toBeNull();
  });
});

describe("idbStorage — the Zustand persist adapter", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("recovers on the next call after a refused open", async () => {
    failNextOpens(1);
    const { idbStorage } = await import("@/stores/storage/idbStorage");

    // The adapter swallows read errors by contract (a preferences read must
    // never break boot), so the observable claim is the one that matters:
    // whatever the first call does, the SECOND one works against real storage.
    await idbStorage.getItem("probe").catch(() => null);
    await idbStorage.setItem("probe", JSON.stringify({ state: { a: 1 } }));
    expect(await idbStorage.getItem("probe")).toContain('"a":1');
  });
});

describe("a closed connection is dropped, not reused", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("originalsStore reopens after the browser closes an idle connection", async () => {
    // Reach the connection the MODULE cached, not one of our own — the handler
    // under test is installed on that object. Intercepting `open` is the only
    // way in, since the store deliberately exports no handle.
    let moduleConn: IDBDatabase | null = null;
    indexedDB.open = ((name: string, version?: number) => {
      const req = realOpen(name, version);
      req.addEventListener("success", () => {
        moduleConn = req.result;
      });
      return req;
    }) as typeof indexedDB.open;

    const store = await import("@/lib/originalsStore");
    await store.listOriginalKeys(); // warm the cache
    expect(moduleConn).not.toBeNull();

    // What a browser does to an idle handle: fire `close`, then the connection
    // really is unusable. Invoking the handler directly rather than dispatching
    // an event — fake-indexeddb validates event types, and a real close calls
    // exactly this.
    (moduleConn as unknown as { onclose?: () => void }).onclose?.();
    moduleConn!.close();

    // TEETH: without the handler, the store still holds this now-closed
    // connection and the next transaction throws InvalidStateError. With it,
    // the cache was dropped and this reopens.
    await expect(store.listOriginalKeys()).resolves.toBeDefined();
  });

  it("editPersistence reopens too — it caches the connection, not the promise", async () => {
    let moduleConn: IDBDatabase | null = null;
    indexedDB.open = ((name: string, version?: number) => {
      const req = realOpen(name, version);
      req.addEventListener("success", () => {
        if (name === "image-horse-edits") moduleConn = req.result;
      });
      return req;
    }) as typeof indexedDB.open;

    const mod = await import("@/lib/editPersistence");
    await mod.loadPhotoEdit("probe"); // warm the cache
    expect(moduleConn).not.toBeNull();

    (moduleConn as unknown as { onclose?: () => void }).onclose?.();
    moduleConn!.close();

    // Every edit save for the rest of the session depended on this.
    await expect(mod.loadPhotoEdit("probe")).resolves.toBeNull();
  });
});
