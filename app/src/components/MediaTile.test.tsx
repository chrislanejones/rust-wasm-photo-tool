// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { MediaTile } from "./MediaTile";
import { ResumeContent } from "@/features/upload/ResumeContent";
import type { PhotoEntry } from "@/features/gallery/GalleryBar";

let probes: FakeImage[];
class FakeImage {
  src = "";
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  resolve!: () => void;
  reject!: () => void;
  decoded = new Promise<void>((resolve, reject) => { this.resolve = resolve; this.reject = reject; });
  decode = () => this.decoded;
  constructor() { probes.push(this); }
}
beforeEach(() => { probes = []; vi.useFakeTimers(); vi.stubGlobal("Image", FakeImage); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it("waits through decode, with no placeholder for a fast image", async () => {
  const { container } = render(<MediaTile src="/a.png" alt="First photo" />);
  expect(container.querySelector(".skeleton")).toBeNull();
  act(() => probes[0]!.onload!());
  expect(container.querySelector("img")).toBeNull();
  await act(async () => probes[0]!.resolve());
  expect(screen.getByRole("img", { name: "First photo" })).toBeTruthy();
  act(() => vi.advanceTimersByTime(301));
  expect(container.querySelector(".skeleton")).toBeNull();
});

it("ends slow or failed loads and recovers for a changed source", async () => {
  const { container, rerender } = render(<MediaTile src="/a.png" alt="First photo" />);
  act(() => vi.advanceTimersByTime(301));
  expect(screen.getAllByRole("status")).toHaveLength(1);
  act(() => vi.advanceTimersByTime(15_000));
  expect(screen.getByRole("img", { name: /could not be displayed/ })).toBeTruthy();
  expect(container.querySelector(".skeleton")).toBeNull();
  rerender(<MediaTile src="/b.png" alt="First photo" />);
  await act(async () => { probes.at(-1)!.onload!(); probes.at(-1)!.resolve(); });
  expect(screen.getByRole("img", { name: "First photo" }).getAttribute("src")).toBe("/b.png");
});

it("retains decoded pixels during replacement and ignores late completion", async () => {
  const { rerender, container, unmount } = render(<MediaTile src="/a.png" />);
  await act(async () => { probes[0]!.onload!(); probes[0]!.resolve(); });
  rerender(<MediaTile src="/b.png" />);
  const stale = probes.at(-1)!;
  act(() => stale.onload!());
  rerender(<MediaTile src="/c.png" />);
  await act(async () => stale.resolve());
  act(() => vi.advanceTimersByTime(301));
  expect(container.querySelector("img")!.getAttribute("src")).toBe("/a.png");
  expect(container.querySelector(".skeleton")).toBeNull();
  await act(async () => { probes.at(-1)!.onload!(); probes.at(-1)!.resolve(); });
  expect(container.querySelector("img")!.getAttribute("src")).toBe("/c.png");
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it("keeps resume photo tiles and overflow stable before any image arrives", () => {
  const photos = [1, 2, 3].map((id) => ({ id: String(id), name: `Photo ${id}`, thumbBlob: new Blob(["photo"]) }) as PhotoEntry);
  const { container } = render(<ResumeContent photos={photos} onResume={() => {}} onStartFresh={() => {}} />);
  expect(container.querySelectorAll(".h-16")).toHaveLength(3);
  expect(screen.getByText("+1")).toBeTruthy();
  act(() => vi.advanceTimersByTime(301));
  expect(container.querySelectorAll(".h-16")).toHaveLength(3);
  expect(container.querySelectorAll(".skeleton")).toHaveLength(2);
});
