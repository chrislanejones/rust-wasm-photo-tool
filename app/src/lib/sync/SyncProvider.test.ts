// @vitest-environment jsdom
//
// The cloud half of sync fails, and the editor stays up.
//
// `useCloudSync` reads with convex/react's `useQuery`, which reports a server
// error by throwing DURING RENDER. Convex functions are deployed by hand, so a
// build that calls `sync:pull` can reach a signed-in user before the deployment
// can answer it. `SyncProvider` sits at the composition root, so without the
// boundary that throw unmounts the whole app.
//
// These tests stand in for that with a `useCloudSync` that throws the message
// Convex really sends, and assert on the three things a user would notice: the
// rest of the tree is still there, the status says "error", and exactly one
// toast appeared — not one per retry.
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const MISSING = "Could not find public function for 'sync:pull'. Did you forget to run `npx convex dev`?";

const cloud = vi.hoisted(() => ({ shouldThrow: true }));
const toastError = vi.hoisted(() => vi.fn());
const toastDismiss = vi.hoisted(() => vi.fn());

vi.mock("./useCloudSync", () => ({
  useCloudSync: () => {
    if (cloud.shouldThrow) throw new Error(MISSING);
  },
}));
// The registry creates the three documents as an import side effect. None of
// that is under test here, and it drags the stores and the engine types in.
vi.mock("./docs", () => ({}));
vi.mock("sonner", () => ({ toast: { error: toastError, dismiss: toastDismiss } }));
vi.mock("@/lib/diagnosticsLog", () => ({ logDiagnostic: vi.fn() }));

let container: HTMLDivElement;
let root: Root;
let seen: string[];

async function mount(): Promise<void> {
  // `CLOUD_CONFIGURED` is read once, at module load, so the env has to be in
  // place before the module is — hence the stub and the dynamic import.
  vi.stubEnv("VITE_CONVEX_URL", "https://smoke-placeholder-123.convex.cloud");
  vi.resetModules();
  const { SyncProvider } = await import("./SyncProvider");
  const { useSyncStatus } = await import("./status");

  function Probe() {
    const { state } = useSyncStatus();
    seen.push(state);
    return React.createElement(
      "p",
      { "data-testid": "rest-of-app" },
      `editor is up · sync ${state}`,
    );
  }

  // createElement, not JSX: vitest only collects `src/**/*.test.ts`, so a
  // `.test.tsx` here would be a file that is never run and never fails.
  await act(async () => {
    root.render(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(SyncProvider),
        React.createElement(Probe),
      ),
    );
  });
}

// The first import of the provider transforms React, the status store and the
// boundary from cold, which alone ran past the 5 s default and failed whichever
// test happened to go first. Pay for it once, here, where it is not a test.
beforeAll(async () => {
  vi.stubEnv("VITE_CONVEX_URL", "https://smoke-placeholder-123.convex.cloud");
  await import("./SyncProvider");
  vi.unstubAllEnvs();
}, 60_000);

beforeEach(() => {
  cloud.shouldThrow = true;
  toastError.mockClear();
  toastDismiss.mockClear();
  seen = [];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  // React logs every error a boundary catches. Expected here, so keep the run
  // readable — and the spy doubles as proof the throw really happened.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("SyncProvider, when the cloud half throws during render", () => {
  it("keeps the rest of the app mounted and reports the failure", async () => {
    await mount();

    expect(console.error).toHaveBeenCalled(); // the throw was real
    expect(container.querySelector('[data-testid="rest-of-app"]')?.textContent).toBe(
      "editor is up · sync error",
    );
    expect(seen.at(-1)).toBe("error");
  });

  it("shows ONE toast for the episode, however many times it fails again", async () => {
    await mount();
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError.mock.calls[0][0]).toBe("Settings sync isn't working");

    // What an offline stretch looks like from the status store: a local change
    // flips it to "syncing", the push fails, it is "error" again. Twice.
    const { setSyncStatus } = await import("./status");
    for (let i = 0; i < 2; i++) {
      await act(async () => setSyncStatus({ state: "syncing" }));
      await act(async () => setSyncStatus({ state: "error", lastError: `again ${i}` }));
    }
    expect(toastError).toHaveBeenCalledTimes(1);
  });

  it("takes the toast down on recovery, and may speak again after that", async () => {
    await mount();
    const { setSyncStatus } = await import("./status");

    await act(async () => setSyncStatus({ state: "synced", lastError: null }));
    expect(toastDismiss).toHaveBeenCalledWith("settings-sync-error");

    await act(async () => setSyncStatus({ state: "error", lastError: "a new episode" }));
    expect(toastError).toHaveBeenCalledTimes(2);
  });

  it("retries by remounting, so an open tab recovers without a reload", async () => {
    vi.useFakeTimers();
    await mount();
    expect(seen.at(-1)).toBe("error");

    // The deployment catches up.
    cloud.shouldThrow = false;
    const errorsBefore = (console.error as unknown as { mock: { calls: unknown[] } }).mock.calls
      .length;
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    // Remounted and did not throw again: no new boundary catch was logged.
    const errorsAfter = (console.error as unknown as { mock: { calls: unknown[] } }).mock.calls
      .length;
    expect(errorsAfter).toBe(errorsBefore);
    expect(container.querySelector('[data-testid="rest-of-app"]')).not.toBeNull();
  });
});
