// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import { ConnectionsPane } from "./ConnectionsPane";
import { useUIStore } from "@/stores/useUIStore";

type Connection = { enabled: boolean; offReason: string | null; url: string | null } | undefined;
const fresh = () => ({
  preview: true,
  signedIn: true,
  connection: { enabled: false, offReason: null, url: null } as Connection,
  calls: [] as unknown[] | undefined,
});
const state = vi.hoisted(() => ({
  current: null as unknown as ReturnType<typeof Object>,
  setEnabled: vi.fn(),
}));
state.current = fresh();

vi.mock("@/hooks/useMcpPreview", () => ({ useMcpPreview: () => state.current.preview }));
vi.mock("@/lib/cloud", () => ({
  useCloudAuth: () => ({ isLoading: false, isAuthenticated: state.current.signedIn }),
  useCloudQuery: (ref: never) => (getFunctionName(ref) === "mcp:connection" ? state.current.connection : state.current.calls),
  useCloudMutation: () => state.setEnabled,
}));

const setOnline = (on: boolean) => useUIStore.setState({ onlineFeaturesEnabled: on });
afterEach(() => { cleanup(); state.current = fresh(); state.setEnabled.mockReset(); setOnline(false); });
const toggle = () => screen.getByRole("switch") as HTMLButtonElement;

it("shows only sign-in guidance to signed-out visitors", () => {
  state.current.signedIn = false;
  render(<ConnectionsPane />);
  expect(screen.getByText("Sign in to connect an AI app")).toBeTruthy();
  expect(screen.queryByRole("switch")).toBeNull();
  expect(screen.queryByRole("button")).toBeNull();
});

it("renders nothing when the Beta is off", () => {
  state.current.preview = false;
  const { container } = render(<ConnectionsPane />);
  expect(container.textContent).toBe("");
});

it("the switch writes to the server", () => {
  setOnline(true);
  state.setEnabled.mockResolvedValue(null);
  render(<ConnectionsPane />);
  expect(toggle().getAttribute("aria-checked")).toBe("false");
  fireEvent.click(toggle());
  expect(state.setEnabled).toHaveBeenCalledWith({ enabled: true });
});

it("on a browser-only device it can't be turned on", () => {
  render(<ConnectionsPane />);
  expect(toggle().disabled).toBe(true);
  expect(screen.getByText(/Turn on online features in Security first/)).toBeTruthy();
});

it("an account still on can always be turned off", () => {
  state.current.connection = { enabled: true, offReason: null, url: null };
  render(<ConnectionsPane />);
  expect(toggle().disabled).toBe(false);
});

it("says that off cuts access right away", () => {
  setOnline(true);
  render(<ConnectionsPane />);
  expect(screen.getByText(/cuts access right away, even if an app still holds a token/)).toBeTruthy();
});

it("no URL until the server is on", () => {
  render(<ConnectionsPane />);
  expect(screen.getByText("Not switched on yet.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Copy URL" })).toBeNull();
});

it("the URL and Copy once the server is on", () => {
  state.current.connection = { enabled: false, offReason: null, url: "https://x.convex.site/mcp" };
  render(<ConnectionsPane />);
  expect(screen.getByText("https://x.convex.site/mcp")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Copy URL" })).toBeTruthy();
});

it("recent activity lists each call", () => {
  state.current.calls = [{ id: "1", app: "client_1", tool: "list_shares", outcome: "error", at: 1 }];
  render(<ConnectionsPane />);
  expect(screen.getByText("list_shares")).toBeTruthy();
  expect(screen.getByText("Error")).toBeTruthy();
});

it("says when there is no activity", () => {
  render(<ConnectionsPane />);
  expect(screen.getByText(/No AI app has used your account yet/)).toBeTruthy();
});
