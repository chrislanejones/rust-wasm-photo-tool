// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SubscriptionButton } from "./SubscriptionButton";
import type { GeneralControls } from "./GeneralPane";
import type { OpenRasterControls } from "./ExportPane";
import type { SuperUserControls } from "./SuperUserPane";
import { DEFAULT_PREFERENCES } from "@/lib/preferences";
import { useUIStore } from "@/stores/useUIStore";
import { fromUserMode } from "../../../convex/entitlement";

// Session/server boundaries are canned; the real dialog, store, rail and panes
// verify that a removed category leaves a reachable, correctly labelled view.
vi.mock("@/lib/cloud", () => ({
  CLOUD_CONFIGURED: false,
  useCloudQuery: () => null,
  useCloudMutation: () => vi.fn(),
  useCloudAction: () => vi.fn(),
  useCloudAuth: () => ({ isAuthenticated: false, isLoading: false }),
  useCloudClient: () => null,
}));
vi.mock("./UserMenu", () => ({ UserMenu: () => null }));
vi.mock("./SuperUserPane", () => ({ SuperUserPane: () => <p>Admin controls</p> }));

const general: GeneralControls = { current: DEFAULT_PREFERENCES, onApply: vi.fn() };
const openRaster: OpenRasterControls = {
  stampToolRef: { current: null }, flushToCanvas: vi.fn(), syncState: vi.fn(),
  onAddPhotos: vi.fn(async () => {}),
};
const superUser: SuperUserControls = {
  mode: "paid", overridden: false, onSelect: vi.fn(), onReset: vi.fn(),
  entitlement: fromUserMode("paid"),
};
beforeEach(() => useUIStore.setState({ settingsOpen: true, settingsTab: "superuser" }));
afterEach(() => useUIStore.setState({ settingsOpen: false, settingsTab: "general" }));

it("keeps a labelled panel and one reachable tab after the admin category disappears", () => {
  const { rerender } = render(<SubscriptionButton general={general} openRaster={openRaster} superUser={superUser} />);
  const admin = screen.getByRole("tab", { name: "Super User" });
  expect(admin.tabIndex).toBe(0);
  expect(screen.getByRole("tabpanel", { name: "Super User" })).toBeTruthy();
  rerender(<SubscriptionButton general={general} openRaster={openRaster} />);
  expect(screen.queryByRole("tab", { name: "Super User" })).toBeNull();
  const first = screen.getByRole("tab", { name: "General" });
  expect(first.tabIndex).toBe(0);
  expect(first.getAttribute("aria-selected")).toBe("true");
  expect(screen.getAllByRole("tab").filter((tab) => tab.tabIndex === 0)).toHaveLength(1);
  expect(screen.getByRole("tabpanel", { name: "General" }).getAttribute("aria-labelledby")).toBe(first.id);
  expect(screen.getByRole("button", { name: "Apply", exact: true }).hasAttribute("disabled")).toBe(true);
  first.focus(); fireEvent.keyDown(first, { key: "ArrowDown" });
  const appearance = screen.getByRole("tab", { name: "Appearance" });
  expect(document.activeElement).toBe(appearance);
  expect(screen.getByRole("tabpanel", { name: "Appearance" })).toBeTruthy();
});

it("reopens a stale unavailable category on a real available tab", async () => {
  await act(async () => { useUIStore.getState().closeSettings(); });
  render(<SubscriptionButton general={general} openRaster={openRaster} />);
  fireEvent.click(screen.getByRole("button", { name: "Settings", exact: true }));
  expect(useUIStore.getState().settingsTab).toBe("general");
  expect(screen.getByRole("tab", { name: "General" }).tabIndex).toBe(0);
  expect(screen.getByRole("tabpanel", { name: "General" })).toBeTruthy();
});
