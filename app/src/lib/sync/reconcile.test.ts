// The sync layer's one decision, enumerated.
//
// Everything else in lib/sync is transport. This is the part that decides
// whether a device takes the server's copy of a document or the server takes
// the device's — so it is the part whose failure mode is "the preference I
// set on my laptop came back wrong", which the user sees and no other test
// here would catch. Pure by construction: no channel, no store, no network.
import { describe, it, expect } from "vitest";
import { reconcile, type LocalDocState, type RemoteDocState } from "@/lib/sync/reconcile";

const T0 = 1_700_000_000_000;
const DARK = '{"theme":"dark"}';
const LIGHT = '{"theme":"light"}';

function local(over: Partial<LocalDocState> = {}): LocalDocState {
  return { value: DARK, rev: 3, updatedAt: T0, dirty: false, seen: true, format: 1, ...over };
}

function remote(over: Partial<RemoteDocState> = {}): RemoteDocState {
  return { value: DARK, rev: 3, updatedAt: T0, format: 1, ...over };
}

describe("reconcile — an account with no row", () => {
  it("does NOT seed the account from a device that changed nothing", () => {
    // The pre-ADR-061 rule ("server wins on load, push on apply"). Seeding
    // from whichever device was online is what undid Forget.
    expect(reconcile(local(), null)).toBe("idle");
    expect(reconcile(local({ seen: false, rev: 0 }), null)).toBe("idle");
  });

  it("creates the row from a change the user actually made", () => {
    expect(reconcile(local({ dirty: true }), null)).toBe("push");
  });
});

describe("reconcile — revisions", () => {
  it("pushes a second quick edit over the echo of this device's own first push", () => {
    // THE REGRESSION. Edit, push lands at rev 4, edit again; the query then
    // delivers rev 4 — this device's own write. Deciding by timestamp read
    // the echo as newer whenever the server clock was ahead of this one, and
    // adopted it: the second edit reverted to the first. Same revision means
    // nobody else wrote, whatever the clocks say.
    expect(
      reconcile(
        local({ value: LIGHT, rev: 4, dirty: true, updatedAt: T0 }),
        remote({ value: DARK, rev: 4, updatedAt: T0 + 60_000 }),
      ),
    ).toBe("push");
  });

  it("holds on a snapshot older than what this device already knows", () => {
    // The pull still on screen from before this device's push: acting on it
    // adopts the pre-push value (the "revert flicker").
    expect(reconcile(local({ value: LIGHT, rev: 5 }), remote({ value: DARK, rev: 4 }))).toBe("hold");
    expect(
      reconcile(local({ value: LIGHT, rev: 5, dirty: true }), remote({ value: DARK, rev: 4 })),
    ).toBe("hold");
  });

  it("is idle on equal values even when the revisions disagree", () => {
    // A device can be behind on `rev` and still hold the right bytes — the
    // server skips the write when a value is unchanged.
    expect(reconcile(local({ rev: 1 }), remote({ rev: 9 }))).toBe("idle");
  });
});

describe("reconcile — first contact with an account", () => {
  it("adopts the account's copy, even over a pending change", () => {
    // A never-synced browser (or a second person on a shared one) must not
    // push its near-default documents over an account that already has them.
    expect(reconcile(local({ seen: false, rev: 0, dirty: true, value: LIGHT }), remote())).toBe(
      "adopt",
    );
    expect(reconcile(local({ seen: false, rev: 0, value: LIGHT }), remote())).toBe("adopt");
  });

  it("does nothing when the account's copy was forgotten, or already matches", () => {
    expect(reconcile(local({ seen: false, rev: 0, dirty: true }), remote({ value: null }))).toBe(
      "idle",
    );
    expect(reconcile(local({ seen: false, rev: 0 }), remote())).toBe("idle");
  });
});

describe("reconcile — another device's change", () => {
  it("adopts a different remote value when this device owes nothing", () => {
    expect(reconcile(local(), remote({ value: LIGHT, rev: 4 }))).toBe("adopt");
  });

  it("pushes this device's pending change over an older one from elsewhere", () => {
    expect(
      reconcile(
        local({ value: LIGHT, dirty: true, updatedAt: T0 + 5_000 }),
        remote({ value: '{"theme":"system"}', rev: 4, updatedAt: T0 }),
      ),
    ).toBe("push");
  });

  it("adopts over a pending change when another device wrote since, and later — the parked tab", () => {
    expect(
      reconcile(
        local({ value: LIGHT, dirty: true, updatedAt: T0 }),
        remote({ value: '{"theme":"system"}', rev: 4, updatedAt: T0 + 86_400_000 }),
      ),
    ).toBe("adopt");
  });

  it("prefers the local change when the two timestamps tie", () => {
    expect(
      reconcile(
        local({ value: LIGHT, dirty: true, updatedAt: T0 }),
        remote({ value: '{"theme":"system"}', rev: 4, updatedAt: T0 }),
      ),
    ).toBe("push");
  });

  it("never adopts a value it already has, dirty or not", () => {
    expect(reconcile(local({ dirty: true }), remote())).toBe("idle");
    expect(reconcile(local({ updatedAt: 0 }), remote({ updatedAt: T0 }))).toBe("idle");
  });
});

describe("reconcile — a forgotten document", () => {
  const forgotten = (over: Partial<RemoteDocState> = {}) =>
    remote({ value: null, rev: 4, updatedAt: T0 + 10_000, format: 0, ...over });

  it("stays forgotten on a device with nothing pending", () => {
    expect(reconcile(local(), forgotten())).toBe("idle");
  });

  it("drops a change made BEFORE the forget instead of resurrecting the copy", () => {
    // Offline laptop, change at T0; the user pressed Forget on the phone at
    // T0+10s. The forget is the later decision.
    expect(reconcile(local({ value: LIGHT, dirty: true, updatedAt: T0 }), forgotten())).toBe(
      "idle",
    );
  });

  it("sends a change made after the forget", () => {
    expect(
      reconcile(local({ value: LIGHT, dirty: true, updatedAt: T0 + 20_000 }), forgotten()),
    ).toBe("push");
    // …and one made on top of a forget this device has already recorded.
    expect(reconcile(local({ value: LIGHT, dirty: true, rev: 4, updatedAt: T0 }), forgotten())).toBe(
      "push",
    );
  });
});

describe("reconcile — formats", () => {
  it("never pushes over a row written by a newer format", () => {
    // That build knows fields this one cannot see; a push would erase them.
    const newer = remote({ value: '{"theme":"system"}', rev: 4, format: 2 });
    expect(reconcile(local({ value: LIGHT, dirty: true, rev: 4 }), newer)).toBe("hold");
    expect(reconcile(local({ value: LIGHT, dirty: true, updatedAt: T0 + 5_000 }), newer)).toBe(
      "hold",
    );
    // A newer format with nothing pending is still adopted, as far as this
    // build can read it.
    expect(reconcile(local(), newer)).toBe("adopt");
  });

  it("pushes over an OLDER format normally", () => {
    expect(
      reconcile(local({ value: LIGHT, dirty: true, rev: 4 }), remote({ rev: 4, format: 0 })),
    ).toBe("push");
  });
});
