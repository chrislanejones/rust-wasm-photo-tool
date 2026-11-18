// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ResizeSettings } from "./ResizeSettings";
vi.mock('@/lib/encodeSupport', () => ({ canEncode: async () => false }));
vi.mock('@/lib/webPerf', () => ({ getImageWeight: async () => null, googleImageLimitBytes: () => 20_000 }));
const props = () => ({ disabled: false, imageWidth: 256, imageHeight: 256, currentByteSize: 4000, originalByteSize: 4000, activePhotoId: 'A', quality: 60, appliedQuality: 75, onQualityChange: vi.fn(), onQualityCommit: vi.fn(), onResize: vi.fn(), onResizeOnly: vi.fn(), exportFormat: 'webp' as const, onExportFormatChange: vi.fn(), compressProgress: { completed: 0, total: 0 } });
afterEach(() => vi.useRealTimers());
it('Reset restores the committed quality and follows undo, even on the same photo', async () => {
  const p = props();
  const h = render(<ResizeSettings {...p} />, { wrapper: TooltipProvider });
  fireEvent.click(screen.getByRole('button', { name: 'Reset Quality', exact: true }));
  expect(p.onQualityChange).toHaveBeenLastCalledWith(75);
  h.rerender(<ResizeSettings {...p} appliedQuality={90} />);
  fireEvent.click(screen.getByRole('button', { name: 'Reset Quality', exact: true }));
  expect(p.onQualityChange).toHaveBeenLastCalledWith(90);
  await act(async () => {});
});
it('does not measure the outgoing document while controls are disabled', async () => {
  vi.useFakeTimers();
  const measureApply = vi.fn(async () => ({ bytes: 1200, kept: false }));
  render(<ResizeSettings {...props()} disabled measureApply={measureApply} />, { wrapper: TooltipProvider });
  await act(async () => { await vi.advanceTimersByTimeAsync(500); });
  expect(measureApply).not.toHaveBeenCalled();
});

// ⚡ Auto (11-18): the gallery's Compress rules, filled into BOTH sliders.
const width = () => (screen.getByRole('spinbutton', { name: /width/i }) as HTMLInputElement).value;
const height = () => (screen.getByRole('spinbutton', { name: /height/i }) as HTMLInputElement).value;
it('one ⚡ on the Scale row and one on the Quality row, the same Auto', async () => {
  render(<ResizeSettings {...props()} />, { wrapper: TooltipProvider });
  expect(screen.getAllByRole('button', { name: /^Auto compress/ })).toHaveLength(2);
  await act(async () => {});
});
it('Auto fits a big photo within 2500 px and steps quality down from 75 to the first that passes, measured at that size', async () => {
  const p = props();
  const measureApply = vi.fn(async (r: { quality: number; w: number; h: number }) => ({ bytes: r.quality > 65 ? 50_000 : 10_000, kept: false }));
  render(<ResizeSettings {...p} imageWidth={5000} imageHeight={2500} measureApply={measureApply} />, { wrapper: TooltipProvider });
  await act(async () => {
    fireEvent.click(screen.getAllByRole('button', { name: /^Auto compress/ })[0]);
  });
  await act(async () => {});
  expect([width(), height()]).toEqual(['2500', '1250']);
  const autoCalls = measureApply.mock.calls.map(([r]) => r).filter((r) => r.w === 2500 && r.h === 1250);
  expect(autoCalls.map((r) => r.quality).slice(0, 3)).toEqual([75, 70, 65]);
  expect(p.onQualityChange).toHaveBeenLastCalledWith(65);
});
it('Auto on PNG moves only the size: quality changes nothing there', async () => {
  const p = props();
  const measureApply = vi.fn(async () => ({ bytes: 1, kept: false }));
  render(<ResizeSettings {...p} imageWidth={3000} imageHeight={3000} exportFormat="png" measureApply={measureApply} />, { wrapper: TooltipProvider });
  await act(async () => {
    fireEvent.click(screen.getAllByRole('button', { name: /^Auto compress/ })[1]);
  });
  expect([width(), height()]).toEqual(['2500', '2500']);
  expect(p.onQualityChange).not.toHaveBeenCalled();
});
