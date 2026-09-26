// @vitest-environment jsdom
//
// Constitution rule 5, Night 2: Send stays on screen in a standby tab.
//
// "Send this device's settings" used to disappear when another tab on the
// device held the claim, and the feature read as broken for twenty minutes.
// It is now shown DISABLED there, says why, and offers "Use here", which takes
// the claim through lib/sync/leader.ts.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Signed in: Send is only ever offered to an account.
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
  useMutation: () => vi.fn(),
}));

import { SyncPane } from "./SyncPane";
import { setSyncStatus, type SyncState } from "@/lib/sync/status";
import { setSyncEnabled } from "@/lib/sync/enabled";
import { registerTabClaimer } from "@/lib/sync/leader";

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
});

function render(state: SyncState, accountEmpty: boolean): void {
  setSyncStatus({ state, accountEmpty });
  act(() => root.render(React.createElement(SyncPane)));
}

const btn = (label: string) =>
  [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === label) as
    | HTMLButtonElement
    | undefined;
const SEND = "Send this device's settings";

describe("Sync › Send, visible and disabled beats disappearing", () => {
  it("in standby, Send is still rendered, disabled, and described by the reason", () => {
    render("standby", true);
    const send = btn(SEND);
    expect(send, "Send must not disappear in a standby tab").toBeDefined();
    expect(send!.disabled).toBe(true);
    const why = document.getElementById(send!.getAttribute("aria-describedby") ?? "");
    expect(why?.textContent).toMatch(/Another Image Horse tab on this device is the one that syncs/);
  });

  it("in standby, Use here takes the claim", () => {
    const claim = vi.fn();
    const unregister = registerTabClaimer(claim);
    render("standby", true);
    const useHere = btn("Use here");
    expect(useHere).toBeDefined();
    act(() => useHere!.click());
    expect(claim).toHaveBeenCalledTimes(1);
    unregister();
  });

  it("in the syncing tab, Send is enabled and there is no Use here and no reason", () => {
    render("synced", true);
    expect(btn(SEND)?.disabled).toBe(false);
    expect(btn(SEND)?.hasAttribute("aria-describedby")).toBe(false);
    expect(btn("Use here")).toBeUndefined();
  });

  it("with an account that already holds settings, there is nothing to send", () => {
    render("standby", false);
    expect(btn(SEND)).toBeUndefined();
    expect(btn("Use here")).toBeUndefined();
  });
});
