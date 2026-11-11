// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useMcpBrowserOnlyGuard } from "./useMcpBrowserOnlyGuard";
import { useUIStore } from "@/stores/useUIStore";

const state = vi.hoisted(() => ({ signedIn: true, browserOnlyOn: vi.fn() }));
vi.mock("@/lib/cloud", () => ({
  useCloudAuth: () => ({ isLoading: false, isAuthenticated: state.signedIn }),
  useCloudMutation: () => state.browserOnlyOn,
}));
const set = (on: boolean) => act(() => { useUIStore.setState({ onlineFeaturesEnabled: on }); });

beforeEach(() => { state.signedIn = true; state.browserOnlyOn.mockReset().mockResolvedValue(null); useUIStore.setState({ onlineFeaturesEnabled: true }); });
afterEach(cleanup);

it("tells the server when this device goes browser-only", () => {
  renderHook(() => useMcpBrowserOnlyGuard());
  set(false);
  expect(state.browserOnlyOn).toHaveBeenCalledTimes(1);
});
it("says nothing when turning online back on, or on other store changes", () => {
  renderHook(() => useMcpBrowserOnlyGuard());
  act(() => { useUIStore.setState({ isImageLoading: true }); });
  expect(state.browserOnlyOn).not.toHaveBeenCalled();
  set(false);
  set(true);
  expect(state.browserOnlyOn).toHaveBeenCalledTimes(1);
});
it("does nothing signed out", () => {
  state.signedIn = false;
  renderHook(() => useMcpBrowserOnlyGuard());
  set(false);
  expect(state.browserOnlyOn).not.toHaveBeenCalled();
});
