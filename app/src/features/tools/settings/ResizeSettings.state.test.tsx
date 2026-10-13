// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ResizeSettings } from "./ResizeSettings";
vi.mock('@/lib/encodeSupport', () => ({ canEncode: async () => false }));
vi.mock('@/lib/webPerf', () => ({ getImageWeight: async () => null }));
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
