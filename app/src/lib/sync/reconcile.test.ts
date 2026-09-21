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

function local(over: Partial<LocalDocState> = {}): LocalDocState {
  return { value: '{"theme":"dark"}', rev: 3, updatedAt: T0, dirty: false, ...over };
}

function remote(over: Partial<RemoteDocState> = {}): RemoteDocState {
  return { value: '{"theme":"dark"}', rev: 3, updatedAt: T0, ...over };
}

describe("reconcile", () => {
  it("seeds an account that has never held this document", () => {
    // Nothing on the server. Even a clean device pushes: the first device to
    // get here is what every later one then adopts.
    expect(reconcile(local(), null)).toBe("push");
    expect(reconcile(local({ dirty: true }), null)).toBe("push");
  });

  it("does nothing when both sides hold the same value", () => {
    expect(reconcile(local(), remote())).toBe("idle");
  });

  it("is idle on equal values even when the revisions disagree", () => {
    // A device can be behind on `rev` and still hold the right bytes — the
    // server skips the write when a value is unchanged, so revisions drift
    // apart without meaning anything. Comparing revs here instead of values
    // would push an identical blob on every reconnect, and every OTHER device
    // would see a change that is not one.
    expect(reconcile(local({ rev: 1 }), remote({ rev: 9 }))).toBe("idle");
  });

  it("adopts a different remote value when this device owes nothing", () => {
    // The whole point of the feature: the phone changed it, this laptop had
    // no pending change of its own, so the laptop shows what the phone said.
    expect(reconcile(local(), remote({ value: '{"theme":"light"}' }))).toBe("adopt");
  });

  it("pushes this device's pending change over an older remote value", () => {
    expect(
      reconcile(
        local({ value: '{"theme":"light"}', dirty: true, updatedAt: T0 + 5_000 }),
        remote({ updatedAt: T0 }),
      ),
    ).toBe("push");
  });

  it("adopts over a pending change when the remote one is newer — the parked tab", () => {
    // A tab left open offline: it still holds the value it had when the
    // connection went, and the user has been on their phone since. Pushing
    // here would overwrite every change made in between with a stale one.
    expect(
      reconcile(
        local({ value: '{"theme":"light"}', dirty: true, updatedAt: T0 }),
        remote({ updatedAt: T0 + 86_400_000 }),
      ),
    ).toBe("adopt");
  });

  it("prefers the local change when the two timestamps tie", () => {
    // A tie means the clocks agree to the millisecond, which in practice means
    // no useful signal. The device the user is touching wins.
    expect(
      reconcile(
        local({ value: '{"theme":"light"}', dirty: true, updatedAt: T0 }),
        remote({ updatedAt: T0 }),
      ),
    ).toBe("push");
  });

  it("never adopts a value it already has, dirty or not", () => {
    // Equality is checked BEFORE dirtiness, so a device that pushed and then
    // re-read its own write does not treat it as someone else's change.
    expect(reconcile(local({ dirty: true }), remote())).toBe("idle");
  });

  it("treats the value, not the timestamp, as the identity of a document", () => {
    // Same bytes, wildly different clocks — still nothing to do. This is what
    // keeps a device with a skewed clock from fighting the server forever.
    expect(reconcile(local({ updatedAt: 0 }), remote({ updatedAt: T0 }))).toBe("idle");
  });
});
