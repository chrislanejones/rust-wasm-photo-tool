// @vitest-environment jsdom
// Plan C §3 — an AI job the backend never settles becomes an Error with a way
// back, instead of a spinner that runs for ever.
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";

const h = vi.hoisted(() => ({ dispatches: 0 }));
vi.mock("@/lib/cloud", () => ({
  CLOUD_CONFIGURED: true,
  useCloudMutation: () => async () => "https://upload.example/url",
  useCloudAction: () => async () => {
    h.dispatches++;
    return { jobId: `job-${h.dispatches}` };
  },
  // The job row never moves: the webhook never fires.
  useCloudQuery: () => ({ status: "running" }),
}));

const { useAIJob, AI_JOB_TIMEOUT_MS, AI_TIMEOUT_MESSAGE } = await import("./useAIJob");
const { useUIStore } = await import("@/stores/useUIStore");

beforeEach(() => {
  h.dispatches = 0;
  vi.useFakeTimers();
  useUIStore.setState({ onlineFeaturesEnabled: true });
  vi.stubGlobal("fetch", async () => ({ json: async () => ({ storageId: "s1" }) }));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useAIJob — nothing spins for ever", () => {
  it("a job with no answer turns into an Error after the timeout, and Try again re-sends it", async () => {
    const { result } = renderHook(() => useAIJob(() => {}));
    await act(async () => {
      await result.current.run("rembg", "photo-1", new Uint8Array([1, 2, 3]));
    });
    expect(result.current.phase).toBe("running");
    expect(result.current.busy).toBe(true);

    act(() => {
      vi.advanceTimersByTime(AI_JOB_TIMEOUT_MS - 1);
    });
    expect(result.current.phase).toBe("running");
    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(result.current.phase).toBe("error");
    expect(result.current.error).toBe(AI_TIMEOUT_MESSAGE);
    expect(result.current.busy).toBe(false);

    await act(async () => {
      result.current.retry();
      await vi.runOnlyPendingTimersAsync();
    });
    expect(h.dispatches).toBe(2);
    expect(result.current.phase).toBe("running");
  });
});
