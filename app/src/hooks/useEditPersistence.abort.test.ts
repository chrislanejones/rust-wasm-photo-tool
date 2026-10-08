// @vitest-environment jsdom
// Night 10-07 PR 2 — THE LEAK (ADR-083): a timed-out backup upload is
// CANCELLED, not abandoned.
//
// The 8 s timeout used to reject without aborting. The bytes kept flowing,
// the file landed in storage, and the client never learned its id, so
// `discardFailedUpload` (which needs the id) could not collect it: 167 of 207
// stored files. These pin the two halves of the fix:
//
//   1. an upload past the timeout has its fetch's signal ABORTED;
//   2. a detached upload (a photo switch mid-save) is NOT aborted by the
//      switch, and completes in the background.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import type { RefObject } from "react";
import type { ImageHorseTool } from "stamp_tool";

const h = vi.hoisted(() => ({
  saves: 0,
  discards: 0,
  signals: [] as AbortSignal[],
  /** How long the stub upload takes before it answers. */
  uploadMs: 0,
}));

vi.mock("@/lib/cloud", () => ({
  CLOUD_CONFIGURED: true,
  useCloudAuth: () => ({ isAuthenticated: true, isLoading: false }),
  useCloudClient: () => ({}),
  useCloudMutation: (ref: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(ref);
    if (name.endsWith(":generateUploadUrl")) return async () => "https://upload.example/u";
    if (name.endsWith(":save")) return async () => void h.saves++;
    if (name.endsWith(":discardFailedUpload"))
      return async () => {
        h.discards++;
        return { deleted: true, reason: "unreferenced" };
      };
    return async () => undefined;
  },
}));

vi.mock("@/lib/editPersistence", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/editPersistence")>()),
  savePhotoEdit: async () => true,
  decodeCapture: () => ({
    canvasW: 4,
    canvasH: 4,
    canvasPng: new Uint8Array([1, 2, 3, 4]),
    undoStack: [],
    redoStack: [],
    layers: [],
    activeLayerId: 0,
    annotations: [],
    shapes: [],
  }),
}));

vi.mock("@/lib/uploadBudget", () => ({
  mayUpload: () => ({ ok: true }),
  recordUpload: () => {},
  isUploadRetryEnabled: () => false,
}));

const { useEditPersistence } = await import("./useEditPersistence");
const { useUIStore } = await import("@/stores/useUIStore");

/** A fetch that answers after `h.uploadMs`, or rejects the moment its signal
 *  aborts — what a browser does to a cancelled request. */
function stubFetch() {
  vi.stubGlobal("fetch", (_url: string, init: RequestInit) => {
    // No signal (master before the fix) records one that never aborts, so
    // the assertions below go red on the CONDITION, not on a crash.
    const signal = init.signal ?? new AbortController().signal;
    h.signals.push(signal);
    return new Promise((resolve, reject) => {
      const t = setTimeout(
        () => resolve({ ok: true, json: async () => ({ storageId: "kg_stored" }) }),
        h.uploadMs,
      );
      signal.addEventListener("abort", () => {
        clearTimeout(t);
        reject(new DOMException("aborted", "AbortError"));
      });
    });
  });
}

/** The save hashes the archive (crypto.subtle, real async) before it
 *  fetches, so fake time must not move until the fetch has started. Only
 *  setTimeout is faked, so setImmediate still turns the real loop. */
async function untilUploadStarts(): Promise<void> {
  // Bounded by REAL time, not a spin count: under a loaded run the digest
  // took longer than 500 turns of the loop and the test went red on its own
  // harness (Night 10-07, 1 in 15 parallel runs).
  const deadline = performance.now() + 10_000;
  while (h.signals.length === 0 && performance.now() < deadline) {
    await new Promise((r) => setImmediate(r));
  }
  expect(h.signals, "the upload started").toHaveLength(1);
}

const toolRef = { current: { capture_state: async () => "{}" } } as unknown as RefObject<ImageHorseTool | null>;

beforeEach(() => {
  h.saves = 0;
  h.discards = 0;
  h.signals = [];
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  useUIStore.setState({ onlineFeaturesEnabled: true });
  stubFetch();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useEditPersistence — a timed-out upload is cancelled, not abandoned", () => {
  it("an upload that exceeds the 8 s timeout is aborted", async () => {
    h.uploadMs = 30_000; // a slow link
    const { result } = renderHook(() => useEditPersistence());
    let done!: Promise<boolean>;
    act(() => {
      done = result.current.savePhotoEdit("photo-1", toolRef);
    });
    await act(async () => {
      await untilUploadStarts();
      await vi.advanceTimersByTimeAsync(8_001);
    });
    expect(h.signals, "the upload carried a signal").toHaveLength(1);
    expect(h.signals[0]!.aborted, "the timeout ABORTED the request").toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
      await done;
    });
    expect(h.saves, "no pointer for a cancelled upload").toBe(0);
  });

  it("a detached upload (switch mid-save) is not aborted, and completes", async () => {
    h.uploadMs = 5_000; // slower than the switch, inside the timeout
    const { result } = renderHook(() => useEditPersistence());
    let returned = false;
    await act(async () => {
      await result.current.savePhotoEdit("photo-1", toolRef, { detachCloudUpload: true });
      returned = true;
      await untilUploadStarts();
    });
    expect(returned, "the switch did not wait on the network").toBe(true);
    expect(h.saves, "still uploading in the background").toBe(0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_001);
    });
    expect(h.signals[0]!.aborted, "the switch must not abort the upload").toBe(false);
    expect(h.saves, "the background upload committed its pointer").toBe(1);
    expect(h.discards).toBe(0);
  });

  it("an upload inside the timeout is never aborted", async () => {
    h.uploadMs = 100;
    const { result } = renderHook(() => useEditPersistence());
    await act(async () => {
      const p = result.current.savePhotoEdit("photo-1", toolRef);
      await untilUploadStarts();
      await vi.advanceTimersByTimeAsync(20_000);
      await p;
    });
    expect(h.signals[0]!.aborted).toBe(false);
    expect(h.saves).toBe(1);
  });
});
