// @vitest-environment jsdom
//
// Settings › Storage while `users.me` is in flight (tier pending leftover,
// 10-27-2026): a paid user saw "Sign in with a Pro account" flash before the
// plan arrived, because StoragePane read the tier straight from `me` and the
// tier is null until `me` lands. It now gets SubscriptionButton's
// `planLoading` and shows a placeholder until then.
//
// The plan asked for an e2e with `users.me` delayed 2 s. The Playwright build
// is the logged-out demo (placeholder keys, no Clerk session), so a signed-in
// paid user cannot be reached there; this drives the same states through the
// mocked cloud hooks, the way SubscriptionButton.loading.test.tsx does.
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SubscriptionButton } from "./SubscriptionButton";
import type { GeneralControls } from "./GeneralPane";
import type { OpenRasterControls } from "./ExportPane";
import { DEFAULT_PREFERENCES } from "@/lib/preferences";
import { useUIStore } from "@/stores/useUIStore";

const cloud = vi.hoisted(() => ({
  auth: { isLoading: false, isAuthenticated: true },
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
const placeholder = () => document.querySelector('[data-testid="storage-plan-loading"]');
const SIGN_IN = /Sign in with a Pro account/;

beforeEach(() => {
  cloud.auth = { isLoading: false, isAuthenticated: true };
  cloud.me = undefined;
  useUIStore.setState({ settingsOpen: true, settingsTab: "storage" });
});
afterEach(() => {
  useUIStore.setState({ settingsOpen: false, settingsTab: "general" });
});

describe("Settings › Storage while the plan loads", () => {
  it("signed in with users.me in flight: a placeholder, never the sign-in copy", () => {
    show();
    expect(placeholder()).toBeTruthy();
    expect(screen.queryByText(SIGN_IN)).toBeNull();
  });

  it("while auth itself connects: the placeholder too", () => {
    cloud.auth = { isLoading: true, isAuthenticated: false };
    cloud.me = null;
    show();
    expect(placeholder()).toBeTruthy();
    expect(screen.queryByText(SIGN_IN)).toBeNull();
  });

  it("once a Pro plan lands: no placeholder and no sign-in copy", () => {
    cloud.me = { tier: "pro" };
    show();
    expect(placeholder()).toBeNull();
    expect(screen.queryByText(SIGN_IN)).toBeNull();
    expect(screen.queryByText(/Pro feature/)).toBeNull();
  });

  it("signed out: the sign-in copy, and no placeholder", () => {
    cloud.auth = { isLoading: false, isAuthenticated: false };
    cloud.me = null;
    show();
    expect(placeholder()).toBeNull();
    expect(screen.getByText(SIGN_IN)).toBeTruthy();
  });
});
