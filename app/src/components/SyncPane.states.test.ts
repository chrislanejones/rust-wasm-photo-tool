// @vitest-environment jsdom
//
// The Sync pane's state model (UI Night 6 §4): each state wears a StatusMark,
// and says the thing that makes people trust it.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
  useMutation: () => vi.fn(),
}));

// The pane reaches convex through lib/cloud (keyless-safe). Under vitest there
// are no keys, so route lib/cloud to the convex/react mock above.
vi.mock("@/lib/cloud", async () => {
  const c = (await import("convex/react")) as Record<string, unknown>;
  // A hook this file's convex mock leaves out throws when read; stand in a
  // hook that throws only if it is actually CALLED.
  const pick = (k: string) => {
    try {
      return c[k];
    } catch {
      return () => {
        throw new Error(`${k} is not mocked in this test`);
      };
    }
  };
  return {
    CLOUD_CONFIGURED: true,
    useCloudAuth: pick("useConvexAuth"),
    useCloudQuery: pick("useQuery"),
    useCloudMutation: pick("useMutation"),
    useCloudAction: pick("useAction"),
    useCloudClient: pick("useConvex"),
  };
});

import { SyncPane } from "./SyncPane";
import { registerSyncRetry, retrySync, setSyncStatus, type SyncState } from "@/lib/sync/status";
import { setSyncEnabled } from "@/lib/sync/enabled";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  localStorage.clear();
  setSyncEnabled(true);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  registerSyncRetry(null);
});

function render(state: SyncState, extra: Parameters<typeof setSyncStatus>[0] = {}): void {
  setSyncStatus({ state, accountEmpty: false, lastSyncedAt: null, ...extra });
  act(() => root.render(React.createElement(SyncPane)));
}
const title = () => container.querySelector('[data-testid="sync-title"]')?.textContent ?? "";
const markOf = () => container.querySelector('[data-slot="status-mark"]')?.getAttribute("data-status");

describe("Sync pane states (§4)", () => {
  it("up to date carries the CLOCK time of the match", () => {
    // 17:02 local — the plan's "matched 5:02 pm". A clock time, not "3m ago",
    // because a relative time drifts while you read it.
    const t = new Date(2026, 8, 28, 17, 2).getTime();
    render("synced", { lastSyncedAt: t });
    expect(title()).toBe("Up to date · matched 5:02 pm");
    expect(markOf()).toBe("complete");
  });

  it("up to date does not also print 'Last matched …' — the title already says it", () => {
    render("synced", { lastSyncedAt: Date.now() });
    expect(container.textContent).not.toContain("Last matched");
  });

  it("an empty account says so, and offers to send", () => {
    render("synced", { accountEmpty: true });
    expect(container.querySelector('[data-testid="sync-account-empty"]')?.textContent).toBe(
      "Your account is empty",
    );
    const send = [...container.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === "Send current settings",
    );
    expect(send).toBeDefined();
  });

  it("another tab owning sync reads 'Syncing in another tab', calmly", () => {
    render("standby");
    expect(title()).toBe("Syncing in another tab");
    // Not a spinner — THIS tab is not doing anything.
    expect(markOf()).toBe("localOnly");
  });

  it("each state wears its StatusMark", () => {
    const cases: [SyncState, string][] = [
      ["local", "localOnly"],
      ["off", "localOnly"],
      ["connecting", "working"],
      ["syncing", "working"],
      ["synced", "complete"],
      ["error", "attention"],
    ];
    for (const [state, kind] of cases) {
      act(() => root.render(React.createElement("div")));
      render(state);
      expect(markOf(), state).toBe(kind);
    }
  });
});

describe("Retry (§4)", () => {
  it("retrySync runs the registered pass", () => {
    let passes = 0;
    registerSyncRetry(() => passes++);
    expect(retrySync()).toBe(true);
    expect(passes).toBe(1);
  });

  it("with nothing registered it says so instead of pretending", () => {
    registerSyncRetry(null);
    expect(retrySync()).toBe(false);
  });
});
