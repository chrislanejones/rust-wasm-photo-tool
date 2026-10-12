// @vitest-environment jsdom
//
// Plan & Billing while auth connects or `users.me` is in flight: one
// pane-shaped skeleton, never a spinner, and never the signed-out
// "Sign in to view…" copy flashing at a signed-in user.
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SubscriptionButton } from "./SubscriptionButton";
import type { GeneralControls } from "./GeneralPane";
import type { OpenRasterControls } from "./ExportPane";
import { DEFAULT_PREFERENCES } from "@/lib/preferences";
import { useUIStore } from "@/stores/useUIStore";

const cloud = vi.hoisted(() => ({
  auth: { isLoading: true, isAuthenticated: false },
  me: undefined as unknown,
}));
vi.mock("@/lib/cloud", async () => {
  const { getFunctionName } = await import("convex/server");
  return {
    CLOUD_CONFIGURED: false,
    useCloudQuery: (ref: unknown) =>
      getFunctionName(ref as never) === "users:me" ? cloud.me : null,
    useCloudMutation: () => vi.fn(),
    useCloudAction: () => vi.fn(),
    useCloudAuth: () => cloud.auth,
    useCloudClient: () => null,
  };
});
vi.mock("./UserMenu", () => ({ UserMenu: () => null }));

const general: GeneralControls = { current: DEFAULT_PREFERENCES, onApply: vi.fn() };
const openRaster: OpenRasterControls = {
  stampToolRef: { current: null }, flushToCanvas: vi.fn(), syncState: vi.fn(),
  onAddPhotos: vi.fn(async () => {}),
};
const show = () => render(<SubscriptionButton general={general} openRaster={openRaster} />);
const skeleton = () => document.querySelector<HTMLElement>('[data-testid="plan-skeleton"]');

beforeEach(() => {
  vi.useFakeTimers();
  cloud.auth = { isLoading: true, isAuthenticated: false };
  cloud.me = undefined;
  useUIStore.setState({ settingsOpen: true, settingsTab: "billing" });
});
afterEach(() => {
  useUIStore.setState({ settingsOpen: false, settingsTab: "general" });
  vi.useRealTimers();
});

describe("Plan & Billing loading", () => {
  it("while auth connects, shows the skeleton, not the sign-in copy", () => {
    cloud.me = null;
    show();
    expect(skeleton()).toBeTruthy();
    expect(screen.queryByText(/Sign in to view and manage your plan/)).toBeNull();
  });

  it("signed in with users.me in flight, shows the skeleton and no spinner", () => {
    cloud.auth = { isLoading: false, isAuthenticated: true };
    show();
    expect(skeleton()).toBeTruthy();
    expect(screen.queryByLabelText("Loading your plan")).toBeNull();
  });

  it("announces once and keeps the bars hidden until the grace ends", () => {
    show();
    const el = skeleton()!;
    expect(el.getAttribute("role")).toBe("status");
    expect(el.textContent).toContain("Loading your plan…");
    expect(el.dataset.shown).toBeUndefined();
    act(() => { vi.advanceTimersByTime(300); });
    expect(skeleton()!.dataset.shown).toBe("true");
  });

  it("signed out, shows the sign-in copy and no skeleton", () => {
    cloud.auth = { isLoading: false, isAuthenticated: false };
    cloud.me = null;
    show();
    expect(skeleton()).toBeNull();
    expect(screen.getByText(/Sign in to view and manage your plan/)).toBeTruthy();
  });

  it("a keyless build (signed out, query never answers) shows the sign-in copy, not a skeleton for good", () => {
    cloud.auth = { isLoading: false, isAuthenticated: false };
    cloud.me = undefined;
    show();
    act(() => { vi.advanceTimersByTime(5_000); });
    expect(skeleton()).toBeNull();
    expect(screen.getByText(/Sign in to view and manage your plan/)).toBeTruthy();
  });

  it("signed in with a plan, shows the plan and no skeleton", () => {
    cloud.auth = { isLoading: false, isAuthenticated: true };
    cloud.me = { tier: "free" };
    show();
    expect(skeleton()).toBeNull();
    expect(screen.getByText("Current plan")).toBeTruthy();
  });
});
