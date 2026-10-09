// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { ShareViewer } from "./ShareViewer";
const query = vi.hoisted(() => ({ value: undefined as unknown, record: vi.fn(async () => {}) }));
vi.mock("convex/react", () => ({ useQuery: () => query.value, useMutation: () => query.record }));
const share = { status: "live", imageUrl: "/share.png", canvasW: 640, canvasH: 480, title: "Harbor", views: 1, createdAt: 0 };
let probes: FakeImage[];
class FakeImage {
  onload: (() => void) | null = null; onerror: (() => void) | null = null; src = "";
  resolve!: () => void;
  decoded = new Promise<void>(r => { this.resolve = r; });
  decode = () => this.decoded;
  constructor() { probes.push(this); }
}
beforeEach(() => { query.value = undefined; probes = []; vi.useFakeTimers(); vi.stubGlobal("Image", FakeImage); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it("carries one existing loading status through query arrival until decode", async () => {
  const { container, rerender } = render(<ShareViewer token="test" />);
  expect(container.querySelector(".skeleton")).toBeNull();
  act(() => vi.advanceTimersByTime(301));
  expect(screen.getAllByRole("status")).toHaveLength(1);
  query.value = share;
  rerender(<ShareViewer token="test" />);
  expect(screen.getAllByRole("status")).toHaveLength(1);
  expect(screen.queryByRole("img", { name: "Harbor" })).toBeNull();
  const box = container.querySelector<HTMLElement>('[style*="aspect-ratio"]')!;
  expect(box.style.aspectRatio).toBe("640 / 480");
  act(() => probes[0]!.onload!());
  expect(screen.queryByRole("img", { name: "Harbor" })).toBeNull();
  await act(async () => probes[0]!.resolve());
  expect(screen.getByRole("img", { name: "Harbor" })).toBeTruthy();
  expect(container.querySelector(".skeleton")).toBeNull();
});

it("retries a failed image without disabling other actions", async () => {
  query.value = share;
  const { container } = render(<ShareViewer token="test" />);
  act(() => probes[0]!.onerror!());
  expect(screen.getByText("This image could not be loaded.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Copy link" }).hasAttribute("disabled")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(probes).toHaveLength(2);
  await act(async () => { probes[1]!.onload!(); probes[1]!.resolve(); });
  expect(screen.getByRole("img", { name: "Harbor" })).toBeTruthy();
  expect(container.querySelector(".skeleton")).toBeNull();
});
