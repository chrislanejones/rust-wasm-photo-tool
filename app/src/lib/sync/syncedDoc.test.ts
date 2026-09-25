// Two tabs, one document.
//
// This is the half of sync that has no server in it and that every user gets,
// signed in or not: change a setting in one tab and the other tab is already
// right when you switch to it. It is also the half with the loop hazard — an
// adopted value that re-broadcasts is two tabs talking forever — so the tests
// below check what does NOT happen as much as what does.
//
// TWO TABS IN ONE PROCESS. `vi.resetModules()` + a dynamic import gives a
// fresh copy of the module graph, which means a fresh tab id and a fresh
// BroadcastChannel — the same separation two browser tabs have. Node's
// BroadcastChannel is process-wide and does not deliver to the sender, which
// is exactly the browser's rule, so the wire under test is the real one. One
// `localStorage` is shared by every tab here, as it is by every tab of a
// browser profile — that is where the ledger lives.
//
// NO TAB IS PRIMED BY HAND. A document with no ready gate records its value
// when it is defined; these tests used to call `prime()` themselves, which is
// exactly how they hid that the real `prefs` document never did.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/** Browser-profile storage: one instance shared by every simulated tab. */
class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  setItem(k: string, v: string) {
    this.map.set(k, String(v));
  }
}

interface Theme {
  theme: string;
}

/** One simulated tab: its own module instance, its own held value. */
interface Tab {
  doc: import("@/lib/sync/syncedDoc").SyncedDoc;
  ledger: typeof import("@/lib/sync/ledger");
  /** What this tab's "app" is showing. */
  value: () => Theme;
  /** A user edit in this tab. */
  edit: (theme: string) => void;
  /** Values this tab ADOPTED from elsewhere, in order. */
  adopted: string[];
  close: () => void;
}

interface TabOptions {
  initial?: string;
  format?: number;
  /** A different canonical writer — another build's field order. */
  serialize?: (v: Theme) => string;
  /** Re-announce on every commit, the way the real preferences module does. */
  echoOnAdopt?: boolean;
}

async function openTab(opts: TabOptions = {}): Promise<Tab> {
  vi.resetModules();
  const [{ defineSyncedDoc }, channel, ledger] = await Promise.all([
    import("@/lib/sync/syncedDoc"),
    import("@/lib/sync/channel"),
    import("@/lib/sync/ledger"),
  ]);

  let held: Theme = { theme: opts.initial ?? "dark" };
  const adopted: string[] = [];

  const doc = defineSyncedDoc<Theme>({
    key: "prefs",
    format: opts.format ?? 1,
    read: () => held,
    adopt: (v) => {
      held = v;
      adopted.push(v.theme);
      // Stands in for the store's own change listener: any commit, from
      // wherever, calls back into the document.
      if (opts.echoOnAdopt) doc.changedLocally();
    },
    serialize: opts.serialize ?? ((v) => JSON.stringify({ theme: v.theme })),
    parse: (json) => {
      const parsed = JSON.parse(json) as { theme?: unknown };
      // Same posture as the real documents: a blob from another build is
      // validated, not trusted. An unknown theme is rejected outright here so
      // the rejection path is exercised too.
      if (parsed.theme !== "dark" && parsed.theme !== "light") return null;
      return { theme: parsed.theme };
    },
  });

  return {
    doc,
    ledger,
    value: () => held,
    edit: (theme) => {
      held = { theme };
      doc.changedLocally();
    },
    adopted,
    close: () => channel.closeChannelForTests(),
  };
}

/** Let the channel deliver. BroadcastChannel is asynchronous in the browser
 *  and in Node alike, so there is no synchronous point to assert at. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

// Every simulated tab holds an open BroadcastChannel. Closed after each spec
// so one test's channel cannot deliver into the next one — Node's channels are
// process-wide, so a leaked one is a cross-test message, not a leak you can
// ignore.
let closers: (() => void)[] = [];

beforeEach(() => {
  closers = [];
  vi.stubGlobal("localStorage", new MemoryStorage());
});

afterEach(() => {
  for (const close of closers) close();
  vi.unstubAllGlobals();
});

async function tabs(n: number, opts: TabOptions = {}): Promise<Tab[]> {
  const out: Tab[] = [];
  for (let i = 0; i < n; i++) out.push(await openTab(opts));
  closers = out.map((t) => t.close);
  return out;
}

describe("a synced document across tabs", () => {
  it("carries the FIRST change in a tab to the other tab, with nobody priming anything", async () => {
    // THE REGRESSION (finding 1). A document without a ready gate recorded
    // its value lazily, on first read — which was inside the first
    // `changedLocally`, after the edit. The first change therefore compared
    // against itself: never sent to the other tab, never recorded as owed.
    const [a, b] = await tabs(2);
    a.ledger.setCurrentAccount("acct-a");
    a.edit("light");
    await settle();
    expect(b.value().theme).toBe("light");
    expect(a.doc.snapshot().dirty).toBe(true);
  });

  it("does not deliver a tab its own change", async () => {
    const [a, b] = await tabs(2);
    a.edit("light");
    await settle();
    expect(a.adopted).toEqual([]); // a changed it; a did not "adopt" it
    expect(b.adopted).toEqual(["light"]);
  });

  it("stops after one hop — an adopted value is not re-broadcast", async () => {
    // The loop hazard. If adopting re-announced, these two would trade the
    // same value until the tab closed.
    const [a, b] = await tabs(2, { echoOnAdopt: true });
    a.edit("light");
    await settle();
    await settle();
    expect(b.adopted).toEqual(["light"]);
    expect(a.adopted).toEqual([]);
  });

  it("ignores a message carrying the value the tab already holds", async () => {
    const [a, b] = await tabs(2);
    a.edit("light");
    b.edit("light");
    await settle();
    expect(a.value().theme).toBe("light");
    expect(b.value().theme).toBe("light");
    expect(a.adopted).toEqual([]);
    expect(b.adopted).toEqual([]);
  });

  it("keeps its own value when the incoming blob fails validation", async () => {
    const [a, b] = await tabs(2);
    // A tab from a build whose theme union had a member this one does not.
    a.edit("chartreuse");
    await settle();
    expect(b.value().theme).toBe("dark"); // untouched
    expect(b.adopted).toEqual([]);
  });

  it("shares the obligation to push through the ledger, so a background tab's change is not lost", async () => {
    // The tab that made the change may never talk to the server again (it is
    // closed, or it is the parked one). The pending change is recorded where
    // every tab of the profile reads it.
    const [a, b] = await tabs(2);
    a.ledger.setCurrentAccount("acct-a");
    a.edit("light");
    await settle();
    expect(b.doc.snapshot().dirty).toBe(true);
    expect(b.doc.snapshot().value).toBe('{"theme":"light"}');
  });

  it("clears dirty once the server has the value, and not before", async () => {
    const [a] = await tabs(1);
    a.ledger.setCurrentAccount("acct-a");
    a.edit("light");
    expect(a.doc.snapshot().dirty).toBe(true);

    // A push that lands for a value the document has since moved past must
    // NOT clear the flag — that is how an edit made during a round-trip
    // disappears.
    const inFlight = a.doc.snapshot().value;
    a.edit("dark");
    a.doc.markPushed(inFlight, 7);
    expect(a.doc.snapshot().dirty).toBe(true);

    a.doc.markPushed(a.doc.snapshot().value, 8);
    expect(a.doc.snapshot().dirty).toBe(false);
    expect(a.doc.snapshot().rev).toBe(8);
  });

  it("hands a value adopted from the server straight to the other tabs", async () => {
    const [a, b] = await tabs(2);
    a.ledger.setCurrentAccount("acct-a");
    const changed = a.doc.applyRemote('{"theme":"light"}', 5, { live: true });
    expect(changed).toBe(true);
    expect(a.doc.snapshot().dirty).toBe(false); // the server already has it
    await settle();
    expect(b.value().theme).toBe("light");
    expect(b.doc.snapshot().dirty).toBe(false);
    expect(b.doc.snapshot().rev).toBe(5);
  });

  it("records the revision but writes nothing when the server echoes our value", async () => {
    const [a] = await tabs(1);
    a.ledger.setCurrentAccount("acct-a");
    a.edit("light");
    const changed = a.doc.applyRemote('{"theme":"light"}', 12, { live: true });
    expect(changed).toBe(false);
    expect(a.adopted).toEqual([]); // nothing re-entered the app
    expect(a.doc.snapshot().rev).toBe(12);
    expect(a.doc.snapshot().dirty).toBe(false);
  });
});

describe("a pending change is kept per account, across reloads", () => {
  it("survives a reload (finding 9)", async () => {
    // Dirty used to live in memory only: a change made just before a reload
    // was never sent, while Settings said "Nothing is lost".
    const [a] = await tabs(1);
    a.ledger.setCurrentAccount("acct-a");
    a.edit("light");
    const before = a.doc.snapshot();
    a.close();

    // The same profile, a fresh page. The app's own storage kept the value
    // (here: `initial`); the ledger kept the obligation.
    const [reloaded] = await tabs(1, { initial: "light" });
    const after = reloaded.doc.snapshot();
    expect(after.dirty).toBe(true);
    expect(after.updatedAt).toBe(before.updatedAt);
    expect(after.value).toBe('{"theme":"light"}');
  });

  it("is owed to nobody when made signed out (finding 8)", async () => {
    const [a] = await tabs(1);
    a.ledger.setCurrentAccount(null);
    a.edit("light");
    expect(a.doc.snapshot().dirty).toBe(false);

    // Signing in afterwards does not make it owed to whoever signed in.
    a.ledger.setCurrentAccount("acct-a");
    expect(a.doc.snapshot()).toMatchObject({ dirty: false, seen: false, rev: 0 });
  });

  it("does not follow the browser into another person's account (finding 8)", async () => {
    const [a] = await tabs(1);
    a.ledger.setCurrentAccount("acct-a");
    a.doc.markIdle(9); // has synced with A
    a.edit("light");
    expect(a.doc.snapshot()).toMatchObject({ dirty: true, seen: true, rev: 9 });

    a.ledger.setCurrentAccount("acct-b");
    // B is a stranger: first contact, nothing owed.
    expect(a.doc.snapshot()).toMatchObject({ dirty: false, seen: false, rev: 0 });

    a.ledger.setCurrentAccount("acct-a");
    // A's obligation is still A's.
    expect(a.doc.snapshot()).toMatchObject({ dirty: true, seen: true, rev: 9 });
  });
});

describe("adopting is never an edit (finding 5)", () => {
  // The prefs document is seeded once from the pre-ADR-061 `users.settings`
  // blob, written by a build with a shorter field list. Adopting it re-
  // serializes into THIS build's list — a different string — and the store's
  // own listener calls `changedLocally` in the same turn. That used to count
  // as a local edit: dirty, re-published, re-adopted on the other side.
  async function openUpgradingTab(unit = "px") {
    vi.resetModules();
    const [{ defineSyncedDoc }, channel, ledger] = await Promise.all([
      import("@/lib/sync/syncedDoc"),
      import("@/lib/sync/channel"),
      import("@/lib/sync/ledger"),
    ]);

    let held = { theme: "dark", unit };
    let adopts = 0;
    const doc = defineSyncedDoc<{ theme: string; unit: string }>({
      key: "prefs",
      format: 1,
      read: () => held,
      adopt: (v) => {
        held = v;
        adopts += 1;
        doc.changedLocally(); // the store's listener, re-entering
      },
      serialize: (v) => JSON.stringify({ theme: v.theme, unit: v.unit }),
      parse: (json) => {
        // Like the real validators: a field the blob lacks keeps THIS tab's
        // value, which is what makes the round-trip lengthen the string.
        const p = JSON.parse(json) as { theme?: string; unit?: string };
        return { theme: p.theme ?? held.theme, unit: p.unit ?? held.unit };
      },
    });
    return {
      doc,
      ledger,
      held: () => held,
      adopts: () => adopts,
      close: () => channel.closeChannelForTests(),
    };
  }

  it("announces the upgraded value to sibling tabs, not the blob the server sent", async () => {
    // The two tabs run the same build but hold different units. Had the
    // upgrader passed on the server's short blob, the sibling would fill the
    // missing unit from its OWN value ("in"); receiving the upgraded blob, it
    // takes the upgrader's ("cm").
    const upgrader = await openUpgradingTab("cm");
    const sibling = await openUpgradingTab("in");
    closers = [upgrader.close, sibling.close];

    upgrader.doc.applyRemote('{"theme":"light"}', 1, { live: false });
    await settle();

    expect(upgrader.held()).toEqual({ theme: "light", unit: "cm" });
    expect(sibling.held()).toEqual({ theme: "light", unit: "cm" });
  });

  it("does not count the upgrade as a change the user made", async () => {
    // Before: dirty, published, pushed. The user changed nothing; the server
    // copy is upgraded the next time they do.
    const upgrader = await openUpgradingTab();
    closers = [upgrader.close];
    upgrader.ledger.setCurrentAccount("acct-a");
    upgrader.doc.applyRemote('{"theme":"light"}', 1, { live: false });
    expect(upgrader.adopts()).toBe(1);
    expect(upgrader.doc.snapshot()).toMatchObject({
      dirty: false,
      rev: 1,
      value: '{"theme":"light","unit":"px"}',
    });
  });

  it("does not ping-pong between two tabs whose serializers disagree", async () => {
    // Two builds, same format number, different canonical writers. Each tab's
    // re-serialization of the other's blob differs from the blob; when that
    // counted as an edit they traded it forever (the review measured 28,771
    // adopts per tab in 500 ms).
    const reversed = (v: Theme) => JSON.stringify({ theme: v.theme, v: 2 });
    const a = await openTab({ echoOnAdopt: true });
    const b = await openTab({ echoOnAdopt: true, serialize: reversed });
    closers = [a.close, b.close];

    a.edit("light");
    for (let i = 0; i < 5; i++) await settle();

    expect(b.adopted).toEqual(["light"]);
    expect(a.adopted).toEqual([]);
  });

  it("drops a sibling tab's message written in another format", async () => {
    // A tab left open across a deploy. Its blob is not guessed at.
    const a = await openTab({ format: 2 });
    const b = await openTab({ format: 1 });
    closers = [a.close, b.close];
    a.edit("light");
    await settle();
    expect(b.value().theme).toBe("dark");
    expect(b.adopted).toEqual([]);
  });
});
