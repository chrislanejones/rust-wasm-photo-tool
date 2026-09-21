// @vitest-environment jsdom
//
// The cloud half, end to end: the real `useCloudSync`, the real documents
// machinery (syncedDoc + ledger + reconcile), and the real Convex handlers
// from convex/sync.ts running against an in-memory db (fakeConvex.testkit).
// Only `convex/react` is replaced — by a reactive `useQuery` that re-runs the
// real `sync:pull` whenever the fake db changes, and a `useMutation` that
// calls the real `sync:push`.
//
// "The phone" in these tests is a direct write to that server. "This device"
// is the hook. Every scenario is one a reviewer found reverting or losing a
// setting, and each asserts on what the user would see (the value the app
// holds) and on what the server ends up holding.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  createFakeConvex,
  type FakeConvex,
  type PullResult,
  type PushArgs,
  type PushResult,
} from "./fakeConvex.testkit";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Key = "prefs" | "ui";

const h = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  const state = {
    server: null as unknown as FakeConvex,
    auth: { isAuthenticated: true, isLoading: false },
    pull: undefined as PullResult | undefined,
    /** How `push` behaves: the real server, a thrown transport error, or held
     *  in a queue the way Convex holds a mutation while offline. */
    mode: "live" as "live" | "throw" | "queue",
    queue: [] as (() => void)[],
    pushes: [] as PushArgs[],
    /** Delay between a push landing and the query showing it. */
    pullLagMs: 0,
    values: {} as Record<Key, string>,
    adopted: [] as string[],
    /** Every adoption with the context it was given: "load" or "live". */
    contexts: [] as string[],
    uiReady: Promise.resolve() as Promise<void>,
    docs: {} as Record<Key, import("./syncedDoc").SyncedDoc>,
    docList: [] as import("./syncedDoc").SyncedDoc[],
    /** The status store as the hook's host last rendered it. */
    status: null as import("./status").SyncStatus | null,
    subscribe(cb: () => void) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    notify() {
      for (const l of listeners) l();
    },
    async refresh() {
      state.pull = await state.server.pull();
      state.notify();
    },
    async push(args: PushArgs): Promise<PushResult> {
      state.pushes.push(args);
      if (state.mode === "throw") throw new Error("offline");
      if (state.mode === "queue") await new Promise<void>((resolve) => state.queue.push(resolve));
      const result = await state.server.push(args);
      setTimeout(() => void state.refresh(), state.pullLagMs);
      return result;
    },
  };
  return state;
});

vi.mock("convex/react", async () => {
  const React = await import("react");
  return {
    useConvexAuth: () => React.useSyncExternalStore(h.subscribe, () => h.auth),
    useQuery: (_ref: unknown, args: unknown) => {
      const pull = React.useSyncExternalStore(h.subscribe, () => h.pull);
      return args === "skip" ? undefined : pull;
    },
    useMutation: () => h.push,
  };
});

// Two small documents instead of the app's three: the machinery under test is
// the same, and these hold a plain string the tests can read and set. `ui`
// has a ready gate the tests can hold shut, like a zustand store whose
// IndexedDB never answers.
//
// Built in `mountDevice`, from the SAME fresh `syncedDoc` module the hook
// imports, and handed over through a stable array. Building them inside the
// mock factory does not work: vitest keeps a mocked module across
// `resetModules`, so documents made there stay bound to the first test's
// module graph and later tests' edits reach a listener nobody mounted.
vi.mock("./docs", () => ({ SYNCED_DOCS: h.docList }));
vi.mock("@/lib/diagnosticsLog", () => ({ logDiagnostic: vi.fn() }));

const blob = (v: string) => JSON.stringify({ v });
const T0 = Date.UTC(2026, 8, 21, 12);

let container: HTMLDivElement;
let root: Root;
let modules: {
  leader: typeof import("./leader");
  ledger: typeof import("./ledger");
  status: typeof import("./status");
  channel: typeof import("./channel");
};

async function flush(ms = 0): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/** Load this device's modules (fresh) with `values` as what it holds, and
 *  mount the hook. The ledger lives in jsdom's localStorage, which `beforeEach`
 *  clears unless a test is deliberately modeling a reload. */
async function mountDevice(values: Record<Key, string> = { prefs: "dark", ui: "tools" }) {
  h.values = { ...values };
  vi.resetModules();
  const { defineSyncedDoc } = await import("./syncedDoc");
  const make = (key: Key, ready?: () => Promise<void>) =>
    defineSyncedDoc<{ v: string }>({
      key,
      format: 1,
      read: () => ({ v: h.values[key] }),
      adopt: (value, context) => {
        h.values[key] = value.v;
        h.adopted.push(`${key}:${value.v}`);
        h.contexts.push(`${key}:${value.v}:${context.live ? "live" : "load"}`);
      },
      serialize: (value) => JSON.stringify({ v: value.v }),
      parse: (json) => {
        try {
          const p = JSON.parse(json) as { v?: unknown };
          return typeof p.v === "string" ? { v: p.v } : null;
        } catch {
          return null;
        }
      },
      ...(ready ? { ready } : {}),
    });
  h.docs = { prefs: make("prefs"), ui: make("ui", () => h.uiReady) };
  h.docList.splice(0, h.docList.length, h.docs.prefs, h.docs.ui);

  const [{ useCloudSync }, leader, ledger, status, channel] = await Promise.all([
    import("./useCloudSync"),
    import("./leader"),
    import("./ledger"),
    import("./status"),
    import("./channel"),
  ]);
  modules = { leader, ledger, status, channel };
  function Host() {
    useCloudSync();
    h.status = status.useSyncStatus();
    return null;
  }
  await act(async () => {
    root.render(React.createElement(Host));
  });
  await flush();
}

/** Another device writes `value` on top of whatever the server holds. */
async function phoneWrites(key: Key, value: string, account?: string) {
  const row = h.server.row(key, account);
  const r = await h.server.push({
    key,
    value: blob(value),
    format: 1,
    baseRev: (row?.rev as number | undefined) ?? 0,
  });
  expect(r.status).toBe("stored");
  await act(async () => {
    await h.refresh();
  });
}

/** A user edit on this device. */
function edit(key: Key, value: string) {
  h.values[key] = value;
  h.docs[key].changedLocally();
}

function hideTab() {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(async () => {
  vi.useFakeTimers({ now: T0 });
  localStorage.clear();
  h.server = createFakeConvex();
  h.auth = { isAuthenticated: true, isLoading: false };
  h.mode = "live";
  h.queue = [];
  h.pushes = [];
  h.pullLagMs = 0;
  h.adopted = [];
  h.contexts = [];
  h.status = null;
  h.uiReady = Promise.resolve();
  await h.server.signIn("user_a");
  h.pull = await h.server.pull();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  modules?.channel.closeChannelForTests();
  Reflect.deleteProperty(document, "visibilityState");
  vi.useRealTimers();
});

describe("a change this device just pushed", () => {
  it("is not reverted by the pull from BEFORE the push (finding 10)", async () => {
    await phoneWrites("prefs", "dark"); // rev 1
    await mountDevice(); // holds "dark" too: agreed at rev 1

    h.pullLagMs = 5_000; // the query catches up slowly
    edit("prefs", "light");
    await flush(600); // debounce → push → stored at rev 2
    expect(h.server.row("prefs")).toMatchObject({ value: blob("light"), rev: 2 });

    // Something reruns sync while the query still shows rev 1 "dark".
    hideTab();
    await flush();
    expect(h.values.prefs).toBe("light");
    expect(h.adopted).toEqual([]);

    await flush(5_000); // the query catches up
    expect(h.values.prefs).toBe("light");
  });

  it("is followed by a second quick edit that is pushed, not reverted to the first (finding 3)", async () => {
    await phoneWrites("prefs", "dark");
    await mountDevice();

    edit("prefs", "light");
    await flush(600); // rev 2 "light", stamped by the server at T0+600
    expect(h.server.row("prefs")).toMatchObject({ rev: 2 });

    // This device's clock is a minute slow of the server's. Its second edit is
    // stamped EARLIER than the server's stamp on its own first push.
    vi.setSystemTime(Date.now() - 60_000);
    edit("prefs", "system");
    // Before the debounce fires, the query delivers something (another
    // document changed), and sync reconciles `prefs` against rev 2 — this
    // device's own echo.
    await phoneWrites("ui", "gallery");
    await flush(600);

    expect(h.values.prefs).toBe("system");
    expect(h.server.row("prefs")).toMatchObject({ value: blob("system"), rev: 3 });
  });
});

describe("another device's change, into a session already under way (finding 12)", () => {
  it("is adopted as a load the first time, and as live after that — until this tab takes the claim again", async () => {
    await phoneWrites("prefs", "dark");
    await mountDevice({ prefs: "light", ui: "tools" });
    // First reconcile of this page: first contact, taken as a load.
    expect(h.contexts).toEqual(["prefs:dark:load"]);

    await phoneWrites("prefs", "system");
    await flush();
    // The session is running now: documents may hold back navigation.
    expect(h.contexts.at(-1)).toBe("prefs:system:live");

    // Another tab took the claim, then "Use here" brought it back: a new
    // session, so the next one is a load again.
    act(() => modules.leader.setHoldsTabClaim(false));
    await phoneWrites("prefs", "dark");
    act(() => modules.leader.setHoldsTabClaim(true));
    await flush();
    expect(h.contexts.at(-1)).toBe("prefs:dark:load");
  });
});

describe("a change queued while offline (finding 7)", () => {
  it("does not land on top of a newer change from another device when it replays", async () => {
    await phoneWrites("prefs", "dark"); // rev 1
    await mountDevice();

    h.mode = "queue"; // offline: Convex holds the mutation
    edit("prefs", "light"); // at T0
    await flush(600);
    expect(h.pushes).toHaveLength(1);

    // An hour later the phone changes it.
    vi.setSystemTime(Date.now() + 3_600_000);
    await phoneWrites("prefs", "system"); // rev 2

    // Reconnect: the queued push replays with the revision it was based on.
    h.mode = "live";
    await act(async () => {
      for (const release of h.queue.splice(0)) release();
    });
    await flush(1_000);

    expect(h.server.row("prefs")).toMatchObject({ value: blob("system"), rev: 2 });
    expect(h.values.prefs).toBe("system");
  });
});

describe("first contact with an account (finding 8)", () => {
  it("takes the account's copy instead of pushing this browser's own", async () => {
    await phoneWrites("prefs", "dark"); // the account's real setting, at T0

    // This browser holds "light", filed as owed to this account but never
    // reconciled with it — a change made in the first second of a session,
    // a minute AFTER the phone's. Written straight into the ledger's storage,
    // the way a previous page load would have left it.
    const account = h.pull!.account;
    localStorage.setItem("image-horse-sync-account", account);
    localStorage.setItem(
      "image-horse-sync-ledger-v1",
      JSON.stringify({
        [account]: {
          prefs: { rev: 0, pending: blob("light"), updatedAt: T0 + 60_000, seen: false },
        },
      }),
    );

    await mountDevice({ prefs: "light", ui: "tools" });
    await flush(1_000);

    expect(h.values.prefs).toBe("dark");
    expect(h.server.row("prefs")).toMatchObject({ value: blob("dark"), rev: 1 });
    expect(h.pushes.filter((p) => p.key === "prefs")).toEqual([]);
  });

  it("never sends one person's unsent change into the next person's account", async () => {
    const accountB = await h.server.signIn("user_b");
    await phoneWrites("prefs", "b-dark", accountB); // B's own setting
    await h.server.signIn("user_a");
    h.pull = await h.server.pull();

    await mountDevice();
    h.mode = "throw"; // A's change cannot be sent
    edit("prefs", "a-light");
    await flush(600);
    expect(h.pushes.length).toBeGreaterThan(0); // it really tried
    expect(h.docs.prefs.snapshot().dirty).toBe(true);

    // A signs out, B signs in, same browser.
    h.mode = "live";
    await h.server.signIn("user_b");
    await act(async () => {
      await h.refresh();
    });
    await flush(1_000);

    expect(h.values.prefs).toBe("b-dark");
    expect(h.server.row("prefs", accountB)).toMatchObject({ value: blob("b-dark"), rev: 1 });

    // And back to A: the device no longer holds what A was owed, so nothing
    // (least of all B's setting) is sent into A's account.
    await h.server.signIn("user_a");
    await act(async () => {
      await h.refresh();
    });
    await flush(1_000);
    expect(h.server.row("prefs", h.pull!.account)).toBeUndefined();
  });
});

describe("Forget the synced copy (finding 2)", () => {
  it("stays forgotten while this device is online, until something is changed here", async () => {
    await phoneWrites("prefs", "dark");
    await mountDevice();
    expect(h.pushes).toEqual([]);

    await h.server.clear();
    await act(async () => {
      await h.refresh();
    });
    await flush(10_000);

    expect(h.pushes).toEqual([]); // nothing re-seeded it
    expect(h.server.row("prefs")).toMatchObject({ value: null });
    expect(h.server.row("ui")).toMatchObject({ value: null });
    expect(h.values.prefs).toBe("dark"); // this device keeps what it has

    edit("prefs", "light"); // a change on purpose brings that one back
    await flush(600);
    expect(h.server.row("prefs")).toMatchObject({ value: blob("light") });
    expect(h.server.row("ui")).toMatchObject({ value: null });
  });

  it("is not undone by a change this device made BEFORE the forget and sends after it", async () => {
    await phoneWrites("prefs", "dark");
    await mountDevice();

    h.mode = "throw";
    edit("prefs", "light"); // at T0, cannot be sent
    await flush(600);
    expect(h.pushes.length).toBeGreaterThan(0); // it really tried

    vi.setSystemTime(Date.now() + 60_000);
    await h.server.clear(); // Forget, pressed on the phone a minute later
    h.mode = "live";
    await act(async () => {
      await h.refresh();
    });
    await flush(600_000); // every retry the backoff would make

    expect(h.server.row("prefs")).toMatchObject({ value: null });
  });

  it("does not bring the legacy settings blob back", async () => {
    await h.server.signIn("user_legacy", blob("legacy-light"));
    h.pull = await h.server.pull();
    await mountDevice();
    expect(h.values.prefs).toBe("legacy-light"); // seeded once, as before

    await h.server.clear();
    await act(async () => {
      await h.refresh();
    });
    await flush(10_000);
    expect(h.pull!.legacySettings).toBeNull();
    expect(h.adopted).toEqual(["prefs:legacy-light"]);
  });
});

describe("a store that never finishes loading (finding 6)", () => {
  it("does not stop sync for the other documents", async () => {
    h.uiReady = new Promise<void>(() => {}); // IndexedDB blocked
    await mountDevice();

    edit("prefs", "light");
    await flush(600 + 5_000);
    expect(h.server.row("prefs")).toMatchObject({ value: blob("light") });

    // And the pass let go of its lock: a second change goes too.
    edit("prefs", "system");
    await flush(600 + 5_000);
    expect(h.server.row("prefs")).toMatchObject({ value: blob("system") });
  });
});

describe("one pusher per device, backing off (finding 13)", () => {
  it("only the tab holding the tab claim sends", async () => {
    await mountDevice();
    act(() => modules.leader.setHoldsTabClaim(false)); // another tab took it
    edit("prefs", "light");
    await flush(10_000);
    expect(h.pushes).toEqual([]);
    expect(h.status?.state).toBe("standby");

    // This tab takes the claim back ("Use here"): the change is still owed,
    // in the ledger, and goes.
    act(() => modules.leader.setHoldsTabClaim(true));
    await flush(1_000);
    expect(h.server.row("prefs")).toMatchObject({ value: blob("light") });
  });

  it("backs off instead of retrying every five seconds", async () => {
    await mountDevice();
    h.mode = "throw";
    edit("prefs", "light");
    await flush(600);
    await flush(120_000);
    // A fixed 5 s beat would be 25 attempts in two minutes. 5+10+20+40+80 s
    // is 155 s, so at most five fit — and the first came from the edit.
    expect(h.pushes.length).toBeLessThanOrEqual(5);
    expect(h.pushes.length).toBeGreaterThanOrEqual(3);
    expect(h.status).toMatchObject({ state: "error", willRetry: true });
  });

  it("does not retry a change the server refused outright", async () => {
    await mountDevice();
    edit("prefs", "x".repeat(70_000)); // over the server's size cap
    await flush(600);
    await flush(600_000);
    expect(h.pushes).toHaveLength(1);
    expect(h.status).toMatchObject({ state: "error", willRetry: false });
  });
});
