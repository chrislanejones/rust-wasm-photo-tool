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
// is exactly the browser's rule, so the wire under test is the real one.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/** One simulated tab: its own module instance, its own held value. */
interface Tab {
  doc: import("@/lib/sync/syncedDoc").SyncedDoc;
  /** What this tab's "app" is showing. */
  value: () => { theme: string };
  /** A user edit in this tab. */
  edit: (theme: string) => void;
  /** Values this tab ADOPTED from elsewhere, in order. */
  adopted: string[];
  close: () => void;
}

async function openTab(initial = "dark"): Promise<Tab> {
  vi.resetModules();
  const [{ defineSyncedDoc }, channel] = await Promise.all([
    import("@/lib/sync/syncedDoc"),
    import("@/lib/sync/channel"),
  ]);

  let held = { theme: initial };
  const adopted: string[] = [];

  const doc = defineSyncedDoc<{ theme: string }>({
    key: "prefs",
    read: () => held,
    adopt: (v) => {
      held = v;
      adopted.push(v.theme);
    },
    serialize: (v) => JSON.stringify({ theme: v.theme }),
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
});

afterEach(() => {
  for (const close of closers) close();
});

async function twoTabs(initial = "dark"): Promise<[Tab, Tab]> {
  const a = await openTab(initial);
  const b = await openTab(initial);
  closers = [a.close, b.close];
  // Prime both: a document reads its value lazily, and the first read is what
  // "unchanged" is later compared against.
  a.doc.prime();
  b.doc.prime();
  return [a, b];
}

describe("a synced document across tabs", () => {
  it("carries a change from one tab to the other", async () => {
    const [a, b] = await twoTabs();
    a.edit("light");
    await settle();
    expect(b.value().theme).toBe("light");
  });

  it("does not deliver a tab its own change", async () => {
    const [a, b] = await twoTabs();
    a.edit("light");
    await settle();
    expect(a.adopted).toEqual([]); // a changed it; a did not "adopt" it
    expect(b.adopted).toEqual(["light"]);
  });

  it("stops after one hop — an adopted value is not re-broadcast", async () => {
    // The loop hazard. If adopting re-announced, these two would trade the
    // same value until the tab closed. One hop each way, and it stops.
    const [a, b] = await twoTabs();
    a.edit("light");
    await settle();
    await settle();
    expect(b.adopted).toEqual(["light"]);
    expect(a.adopted).toEqual([]);
  });

  it("ignores a message carrying the value the tab already holds", async () => {
    // The same toggle pressed in both tabs before either message lands. Each
    // tab then hears an announcement of the value it is already showing;
    // writing it back into the app would be a pointless re-render at best,
    // and at worst — for a document whose `adopt` touches the WASM engine — a
    // real unit of work for nothing.
    const [a, b] = await twoTabs();
    a.edit("light");
    b.edit("light");
    await settle();
    expect(a.value().theme).toBe("light");
    expect(b.value().theme).toBe("light");
    expect(a.adopted).toEqual([]);
    expect(b.adopted).toEqual([]);
  });

  it("keeps its own value when the incoming blob fails validation", async () => {
    const [a, b] = await twoTabs();
    // A tab from a build whose theme union had a member this one does not.
    a.edit("chartreuse");
    await settle();
    expect(b.value().theme).toBe("dark"); // untouched
    expect(b.adopted).toEqual([]);
  });

  it("carries the obligation to push, so a background tab's change is not lost", async () => {
    // The tab that made the change may never talk to the server again (it is
    // closed, or it is the parked one). Whichever tab adopts it inherits the
    // dirty flag and owes the push.
    const [a, b] = await twoTabs();
    a.edit("light");
    await settle();
    expect(b.doc.snapshot().dirty).toBe(true);
    expect(b.doc.snapshot().value).toBe('{"theme":"light"}');
  });

  it("clears dirty once the server has the value, and not before", async () => {
    const [a] = await twoTabs();
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
    // Every tab has its own Convex subscription and would get there in the
    // end, but a background tab's socket can be throttled for minutes. The
    // tab that hears it first passes it on.
    const [a, b] = await twoTabs();
    const changed = a.doc.applyRemote('{"theme":"light"}', 5, Date.now());
    expect(changed).toBe(true);
    expect(a.doc.snapshot().dirty).toBe(false); // the server already has it
    await settle();
    expect(b.value().theme).toBe("light");
    expect(b.doc.snapshot().dirty).toBe(false);
  });

  it("records the revision but writes nothing when the server echoes our value", async () => {
    const [a] = await twoTabs();
    a.edit("light");
    const changed = a.doc.applyRemote('{"theme":"light"}', 12, Date.now());
    expect(changed).toBe(false);
    expect(a.adopted).toEqual([]); // nothing re-entered the app
    expect(a.doc.snapshot().rev).toBe(12);
    expect(a.doc.snapshot().dirty).toBe(false);
  });
});

describe("a document whose adopt upgrades the blob it was handed", () => {
  // THE REGRESSION. `prefs` is seeded once from the pre-ADR-061
  // `users.settings` blob, which was written by a build with a shorter field
  // list. Adopting it parses, normalizes and re-serializes into the CURRENT
  // list — a different string — which re-enters `changedLocally` in the same
  // turn. `applyRemote` used to announce its ARGUMENT to the sibling tabs, so
  // every other tab was handed the stale pre-migration blob a moment after
  // this one had already upgraded past it, and the two disagreed until a
  // reload. It must announce what the document holds when adopt returns.
  async function openUpgradingTab() {
    vi.resetModules();
    const [{ defineSyncedDoc }, channel] = await Promise.all([
      import("@/lib/sync/syncedDoc"),
      import("@/lib/sync/channel"),
    ]);

    // The app's value carries a field the old wire format did not.
    let held = { theme: "dark", unit: "px" };
    const doc = defineSyncedDoc<{ theme: string; unit: string }>({
      key: "prefs",
      read: () => held,
      adopt: (v) => {
        held = v;
        // Stands in for the preferences module's listener: any commit, from
        // wherever, re-serializes and re-announces.
        doc.changedLocally();
      },
      serialize: (v) => JSON.stringify({ theme: v.theme, unit: v.unit }),
      parse: (json) => {
        const p = JSON.parse(json) as { theme?: string; unit?: string };
        // `normalize`: a missing field takes its default rather than staying
        // absent, which is what makes the round-trip lengthen the string.
        return { theme: p.theme ?? "dark", unit: p.unit ?? "px" };
      },
    });
    return { doc, held: () => held, close: () => channel.closeChannelForTests() };
  }

  it("announces the upgraded value to sibling tabs, not the blob the server sent", async () => {
    const upgrader = await openUpgradingTab();
    const sibling = await openTab();
    closers = [upgrader.close, sibling.close];

    // The legacy blob: no `unit` field at all.
    upgrader.doc.applyRemote('{"theme":"light"}', 1, Date.now());
    await settle();

    // The upgrader migrated on adopt...
    expect(upgrader.held()).toEqual({ theme: "light", unit: "px" });
    // ...and the sibling got THAT, not `{"theme":"light"}`.
    expect(sibling.value().theme).toBe("light");
    expect(sibling.doc.snapshot().value).toBe('{"theme":"light","unit":"px"}');
  });

  it("still owes the server the upgraded blob", async () => {
    // The server holds the short legacy string; this device now holds a longer
    // one. That is a real difference and it has to be pushed, or the migration
    // never lands and every load redoes it.
    const upgrader = await openUpgradingTab();
    closers = [upgrader.close];
    upgrader.doc.applyRemote('{"theme":"light"}', 1, Date.now());
    expect(upgrader.doc.snapshot().dirty).toBe(true);
    expect(upgrader.doc.snapshot().value).toBe('{"theme":"light","unit":"px"}');
  });
});
