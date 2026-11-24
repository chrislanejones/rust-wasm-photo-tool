// @vitest-environment jsdom
//
// The Export dialog adapts to the task (Chris, 11-24-2026): a row that cannot
// apply is LEFT OUT, not grayed out to keep the dialog's shape.
//
//   Selected image: File Name (+ its extension), Raster | Vector | With Layers,
//                   no recipe, ONE primary Download
//   All images:     Recipe + Batch settings, Raster | Vector, no File Name,
//                   Download ZIP
//   Both:           tiles named for the format; Privacy & metadata shut, its
//                   choice on the right
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterAll, expect, it, vi } from "vitest";

vi.hoisted(() => {
  vi.stubEnv("VITE_CONVEX_URL", "");
  vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "");
});
afterAll(() => vi.unstubAllEnvs());
import { TooltipProvider } from "@/components/ui/tooltip";
import { DownloadDialog } from "./DownloadDialog";
import type { DownloadFormatOption } from "@/app/session/useDownloadFormat";

const FORMATS: DownloadFormatOption[] = [
  { value: "jpeg", label: "JPEG", hint: "Small · no transparency" },
  { value: "png", label: "PNG", hint: "Lossless · transparency" },
  { value: "webp", label: "WebP", hint: "Small · transparency" },
  { value: "avif", label: "AVIF", hint: "Smallest · modern" },
  { value: "ora", label: "ORA", hint: "Krita · GIMP" },
];

function renderDialog() {
  return render(
    <DownloadDialog
      open
      onOpenChange={vi.fn()}
      photoCount={3}
      formats={FORMATS}
      pluginFormats={[]}
      format="jpeg"
      onFormatChange={vi.fn()}
      fileName={{ value: "", defaultStem: "DMV-revised", onChange: vi.fn() }}
      ext=".jpg"
      downloadLabel="Download JPEG"
      onDownload={vi.fn()}
      shareAction={<button type="button">Share link</button>}
      onCopy={vi.fn()}
      onDownloadAll={vi.fn()}
      zipFormat="jpeg"
      zipLabel="JPEG"
      svg={{ selected: false, all: 0 }}
    />,
    { wrapper: TooltipProvider },
  );
}

it("Selected image: the name with its extension, no recipe, one primary", () => {
  renderDialog();
  const dialog = screen.getByRole("dialog");
  const field = within(dialog).getByLabelText("File Name");
  expect(field.getAttribute("placeholder")).toBe("DMV-revised");
  expect(field.getAttribute("aria-describedby")).toBe("export-file-ext");
  expect(dialog.querySelector("#export-file-ext")?.textContent).toBe(".jpg");
  expect(within(dialog).queryByLabelText("Recipe")).toBeNull();
  expect(dialog.querySelector("#export-summary")?.textContent).toBe("DMV-revised.jpg · 1 image · JPEG");
  const kinds = within(within(dialog).getByRole("radiogroup", { name: "Kind of file" })).getAllByRole("radio");
  expect(kinds.map((k) => k.textContent?.trim())).toEqual(["Raster", "Vector", "With Layers"]);
  // The tiles are named for their format.
  // (By name: a tile's icon carries its own lettering, hidden from the name.)
  const format = within(within(dialog).getByRole("radiogroup", { name: "Format" }));
  expect(format.getAllByRole("radio")).toHaveLength(4);
  for (const name of ["JPEG", "PNG", "WebP", "AVIF"]) expect(format.getByRole("radio", { name })).toBeTruthy();
  expect(within(dialog).getByTestId("export-format-says").textContent).toBe("JPEG — Small · no transparency");
});

it("Privacy & metadata is shut, with its choice on the right, and opens to Camera Info", () => {
  renderDialog();
  const dialog = screen.getByRole("dialog");
  const privacy = within(dialog).getByRole("button", { name: /^Privacy & metadata/ });
  expect(privacy.getAttribute("aria-expanded")).toBe("false");
  expect(privacy.textContent).toMatch(/Keep all|Remove location|Remove all/);
  fireEvent.click(privacy);
  expect(privacy.getAttribute("aria-expanded")).toBe("true");
  expect(within(dialog).getByRole("radiogroup", { name: "Camera Info" })).toBeTruthy();
});

it("All images: recipe and Batch settings in, File Name and With Layers out", () => {
  renderDialog();
  const dialog = screen.getByRole("dialog");
  fireEvent.click(within(dialog).getByRole("radio", { name: "All images (3)" }));
  expect(within(dialog).queryByLabelText("File Name")).toBeNull();
  expect(within(dialog).getByLabelText("Recipe")).toBeTruthy();
  expect(within(dialog).getByRole("button", { name: "Save recipe" })).toBeTruthy();
  const batch = within(dialog).getByLabelText("Batch settings");
  expect(within(batch).getAllByRole("term").map((t) => t.textContent)).toEqual(["Size", "Naming", "Camera info", "Packaging"]);
  expect(batch.textContent).toContain("Original size");
  expect(batch.textContent).toContain("Original file names");
  const kinds = within(within(dialog).getByRole("radiogroup", { name: "Kind of file" })).getAllByRole("radio");
  expect(kinds.map((k) => k.textContent?.trim())).toEqual(["Raster", "Vector"]);
  expect(dialog.querySelector("#export-summary")?.textContent).toBe("3 images · JPEG · ZIP");
  expect(within(dialog).getByRole("button", { name: "Download ZIP" })).toBeTruthy();
});
