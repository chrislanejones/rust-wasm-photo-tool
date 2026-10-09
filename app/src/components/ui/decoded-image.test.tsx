// @vitest-environment jsdom
import { StrictMode } from "react";
import { act, render, screen } from "@testing-library/react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { DecodedImage } from "./decoded-image";
let probes: FakeImage[];
class FakeImage {
  src = ""; onload: (() => void) | null = null; onerror: (() => void) | null = null;
  resolve!: () => void; reject!: () => void;
  decoded = new Promise<void>((resolve, reject) => { this.resolve = resolve; this.reject = reject; });
  decode = () => this.decoded;
  constructor() { probes.push(this); }
}
beforeEach(() => { probes = []; vi.useFakeTimers(); vi.stubGlobal('Image', FakeImage); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('terminates a rejected decode, with no lingering loading announcement', async () => {
  render(<DecodedImage source="/photo.png" alt="Harbor" />);
  act(() => vi.advanceTimersByTime(301));
  expect(screen.getAllByRole('status')).toHaveLength(1);
  await act(async () => { probes[0]!.onload!(); probes[0]!.reject(); });
  expect(screen.queryByRole('status')).toBeNull();
  expect(screen.getByRole('img', { name:'Harbor could not be displayed' })).toBeTruthy();
});

it('does not resurrect a timed-out image when its decode completes late', async () => {
  render(<DecodedImage source="/photo.png" alt="Harbor" />);
  act(() => probes[0]!.onload!());
  act(() => vi.advanceTimersByTime(15_000));
  await act(async () => probes[0]!.resolve());
  expect(screen.queryByRole('img', { name:'Harbor' })).toBeNull();
  expect(screen.getByRole('img', { name:/could not be displayed/ })).toBeTruthy();
});

it('pairs object URL ownership under StrictMode and removes pending work on unmount', () => {
  let id = 0;
  const created = vi.spyOn(URL,'createObjectURL').mockImplementation(() => `blob:test-${++id}`);
  const revoked = vi.spyOn(URL,'revokeObjectURL').mockImplementation(() => {});
  const { unmount } = render(<StrictMode><DecodedImage source={new Blob(['photo'])} alt="Harbor" /></StrictMode>);
  const current = probes.at(-1)!;
  expect(revoked.mock.calls.flat()).not.toContain(current.src);
  unmount();
  expect(revoked.mock.calls.flat().sort()).toEqual(created.mock.results.map(r => r.value).sort());
  expect(vi.getTimerCount()).toBe(0);
  expect(current.onload).toBeNull();
  expect(current.onerror).toBeNull();
});
