// @vitest-environment jsdom
//
// AI Usage while auth connects or the usage query is in flight: one card-shaped
// skeleton, never the signed-out "Sign in to see your usage" copy, and never a
// bare "Loading your usage…" line that the real card then pushes down.
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

const cloud = vi.hoisted(() => ({
  auth: { isLoading: true, isAuthenticated: false },
  usage: undefined as unknown,
}));
vi.mock("@/lib/cloud", () => ({
  useCloudAuth: () => cloud.auth,
  useCloudQuery: () => cloud.usage,
}));

import { AIUsagePane } from "./AIUsagePane";
import { TooltipProvider } from "@/components/ui/tooltip";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLElement;
function render() {
  act(() => root!.render(React.createElement(TooltipProvider, null, React.createElement(AIUsagePane))));
  return container;
}
const skeleton = () => container.querySelector<HTMLElement>('[data-testid="usage-skeleton"]');

beforeEach(() => {
  vi.useFakeTimers();
  cloud.auth = { isLoading: true, isAuthenticated: false };
  cloud.usage = undefined;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  vi.useRealTimers();
});

const usage = {
  daily: { used: 1, cap: 5, resetsAt: Date.now() + 3_600_000 },
  monthly: { used: 4, cap: 50, resetsAt: Date.now() + 86_400_000 },
};

describe("AIUsagePane loading", () => {
  it("while auth connects, shows the skeleton, not the sign-in copy", () => {
    render();
    expect(skeleton()).toBeTruthy();
    expect(container.textContent).not.toContain("Sign in to see your usage");
  });

  it("signed in with the query in flight, shows the skeleton, not a loading line", () => {
    cloud.auth = { isLoading: false, isAuthenticated: true };
    render();
    expect(skeleton()).toBeTruthy();
    expect(skeleton()!.getAttribute("role")).toBe("status");
    expect(skeleton()!.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0);
  });

  it("reserves the card at once and paints the bars after 300 ms", () => {
    render();
    expect(skeleton()!.className).toContain("[&>*]:invisible");
    act(() => vi.advanceTimersByTime(300));
    expect(skeleton()!.className).not.toContain("[&>*]:invisible");
  });

  it("gives way to the meters when usage arrives", () => {
    cloud.auth = { isLoading: false, isAuthenticated: true };
    cloud.usage = usage;
    render();
    expect(skeleton()).toBeNull();
    expect(container.textContent).toContain("Today");
    expect(container.textContent).toContain("This month");
  });

  it("signed out (auth settled) still says to sign in", () => {
    cloud.auth = { isLoading: false, isAuthenticated: false };
    render();
    expect(skeleton()).toBeNull();
    expect(container.textContent).toContain("Sign in to see your usage");
  });
});
