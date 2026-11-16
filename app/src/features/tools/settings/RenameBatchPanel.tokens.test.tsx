// @vitest-environment jsdom
// Batch › Rename end to end in the component: a `{date}` / `{original}` pattern
// waits for the stored-file read, previews the real names, and Rename writes
// them. Proves the panel is wired to the shared formatter, not just that the
// formatter works.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { PhotoEntry } from "@/features/gallery/GalleryBar";

const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("@/lib/photoNameFacts", () => ({ loadNameFacts: mocks.load }));
vi.mock("@/components/ui/sonner", () => ({ toast: { success: vi.fn() } }));

import { RenameBatchPanel } from "./RenameBatchPanel";

const photo = (id: string, name: string): PhotoEntry =>
  ({
    id,
    name,
    mimeType: "image/jpeg",
    origWidth: 4032,
    origHeight: 3024,
    originalKey: `k-${id}`,
    uploadKey: `k-${id}`,
  }) as PhotoEntry;

it("a {date}_{original} pattern previews and applies the EXIF date and upload name", async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  mocks.load.mockImplementation(async (p: PhotoEntry) => {
    await gate;
    return p.id === "a"
      ? { original: "IMG_4021", dateTaken: "2024-05-01 10:30" }
      : { original: "DSC_0007", dateTaken: "2023:07:04 09:05:00" };
  });
  const setPhotos = vi.fn();
  const photos = [photo("a", "beach"), photo("b", "dune")];
  render(<RenameBatchPanel photos={photos} setPhotos={setPhotos} />, { wrapper: TooltipProvider });

  fireEvent.change(screen.getByLabelText("Name pattern"), {
    target: { value: "{date}_{original}_{width}x{height}.{ext}" },
  });
  // Still reading: Rename must wait, or it would name from today's date.
  const busy = screen.getByRole("button", { name: /Reading dates and names/ });
  expect(busy).toHaveProperty("disabled", true);

  await act(async () => {
    release();
    await gate;
  });

  expect(screen.getByText("2024-05-01_IMG_4021_4032x3024.jpg")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Rename 2 images" }));
  const update = setPhotos.mock.calls[0][0] as (prev: PhotoEntry[]) => PhotoEntry[];
  expect(update(photos).map((p) => p.name)).toEqual([
    "2024-05-01_IMG_4021_4032x3024.jpg",
    "2023-07-04_DSC_0007_4032x3024.jpg",
  ]);
});
