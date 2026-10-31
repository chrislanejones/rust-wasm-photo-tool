// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ConnectionsPane } from "./ConnectionsPane";
const state = vi.hoisted(() => ({ preview: true, signedIn: false }));
vi.mock("@/hooks/useMcpPreview", () => ({ useMcpPreview: () => state.preview }));
vi.mock("@/lib/cloud", () => ({ useCloudAuth: () => ({ isLoading: false, isAuthenticated: state.signedIn }) }));
afterEach(() => { cleanup(); state.preview = true; state.signedIn = false; });
it("shows only sign-in guidance to signed-out visitors", () => {
  render(<ConnectionsPane />);
  expect(screen.getByText("Sign in to connect an AI app")).toBeTruthy();
  expect(screen.queryByRole("switch")).toBeNull();
  expect(screen.queryByRole("button")).toBeNull();
});
it("keeps access disabled and labels prompts as future behavior", () => {
  state.signedIn = true;
  render(<ConnectionsPane />);
  const toggle = screen.getByRole("switch") as HTMLInputElement;
  expect(toggle.disabled).toBe(true);
  expect(toggle.checked).toBe(false);
  expect(screen.getAllByRole("button", { name: "Copy prompt" })).toHaveLength(3);
  expect(screen.getByText(/These prompts will not work yet/)).toBeTruthy();
});
it("renders nothing when the Beta is off", () => {
  state.preview = false;
  const { container } = render(<ConnectionsPane />);
  expect(container.textContent).toBe("");
});
