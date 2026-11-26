// @vitest-environment jsdom
//
// The Export dialog adapts to the task (Chris, 11-24-2026): a row that cannot
// apply is LEFT OUT, not grayed out to keep the dialog's shape.
//
//   Selected image: File Name (+ its extension), then a recipe under it,
//                   Raster | Vector | With Layers, ONE primary Download
//   All images:     Recipe + Batch settings, Raster | Vector, no File Name,
//                   Download ZIP
//   Both:           tiles named for the format; Privacy & Metadata shut, its
//                   choice on the right; how compressed, on the footer's right
import type { ComponentProps } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterAll, expect, it, vi } from "vitest";

vi.hoisted(() => {
  vi.stubEnv("VITE_CONVEX_URL", "");
  vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "");
});
afterAll(() => vi.unstubAllEnvs());
import { TooltipProvider } from "@/components/ui/tooltip";
import { DownloadDialog } from "./DownloadDialog";
import { useZipRecipeStore } from "@/stores/useZipRecipeStore";
import type { DownloadFormatOption } from "@/app/session/useDownloadFormat";
import type { ActiveFormat } from "@/lib/plugins";

const FORMATS: DownloadFormatOption[] = [
  { value: "jpeg", label: "JPEG", hint: "Small · no transparency" },
  { value: "png", label: "PNG", hint: "Lossless · transparency" },
  { value: "webp", label: "WebP", hint: "Small · transparency" },
  { value: "avif", label: "AVIF", hint: "Smallest · modern" },
  { value: "ora", label: "ORA", hint: "Krita · GIMP" },
];

function renderDialog(over: Partial<ComponentProps<typeof DownloadDialog>> = {}) {
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
      {...over}
    />,
    { wrapper: TooltipProvider },
  );
}

it("Selected image: the name with its extension, a recipe under it, one primary", () => {
  renderDialog();
  const dialog = screen.getByRole("dialog");
  const field = within(dialog).getByLabelText("File Name");
  expect(field.getAttribute("placeholder")).toBe("DMV-revised");
  expect(field.getAttribute("aria-describedby")).toBe("export-file-ext");
  expect(dialog.querySelector("#export-file-ext")?.textContent).toBe(".jpg");
  expect(within(dialog).getByLabelText("Recipe")).toBeTruthy();
  const settings = within(dialog).getByLabelText("Image settings");
  // The name field is the naming; nothing here says Packaging.
  expect(within(settings).getAllByRole("term").map((t) => t.textContent)).toEqual(["Size", "Camera info"]);
  expect(dialog.querySelector("#export-summary")?.textContent).toBe("DMV-revised.jpg · 1 image · JPEG");
  expect(within(dialog).getByTestId("export-compressed").textContent).toBe("Not compressed");
  const kinds = within(within(dialog).getByRole("radiogroup", { name: "Kind of file" })).getAllByRole("radio");
  expect(kinds.map((k) => k.textContent?.trim())).toEqual(["Raster", "Vector", "With Layers"]);
  // The tiles are named for their format.
  // (By name: a tile's icon carries its own lettering, hidden from the name.)
  const format = within(within(dialog).getByRole("radiogroup", { name: "Format" }));
  expect(format.getAllByRole("radio")).toHaveLength(4);
  for (const name of ["JPEG", "PNG", "WebP", "AVIF"]) expect(format.getByRole("radio", { name })).toBeTruthy();
  expect(within(dialog).getByTestId("export-format-says").textContent).toBe("JPEG — Small · no transparency");
});

it("Privacy & Metadata is shut, with its choice on the right, and opens to Camera Info", () => {
  renderDialog();
  const dialog = screen.getByRole("dialog");
  const privacy = within(dialog).getByRole("button", { name: /^Privacy & Metadata/ });
  expect(privacy.getAttribute("aria-expanded")).toBe("false");
  expect(privacy.textContent).toMatch(/Keep All Metadata|Remove Location Metadata|Remove All Metadata/);
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
  expect(within(batch).getAllByRole("term").map((t) => t.textContent)).toEqual(["Size", "Naming", "Camera info"]);
  expect(batch.textContent).toContain("Original size");
  expect(batch.textContent).toContain("Original file names");
  const kinds = within(within(dialog).getByRole("radiogroup", { name: "Kind of file" })).getAllByRole("radio");
  expect(kinds.map((k) => k.textContent?.trim())).toEqual(["Raster", "Vector"]);
  expect(dialog.querySelector("#export-summary")?.textContent).toBe("3 images · JPEG · ZIP");
  expect(within(dialog).getByTestId("export-compressed").textContent).toMatch(/^\d+ of \d+ compressed$/);
  expect(within(dialog).getByRole("button", { name: "Download ZIP" })).toBeTruthy();
});

it("All images leaves a one-image plugin format, so the recipe the ZIP uses stays in view", () => {
  // Kept on All, the plugin format hid the recipe (and its camera info)
  // while the ZIP still applied it (CodeRabbit on #516).
  const tiff = { plugin: { name: "TIFF" }, format: { id: "tiff", label: "TIFF", hint: "Lossless · print" } } as unknown as ActiveFormat;
  const onFormatChange = vi.fn();
  renderDialog({ pluginFormats: [tiff], format: "tiff" as never, onFormatChange });
  const dialog = screen.getByRole("dialog");
  onFormatChange.mockClear();
  fireEvent.click(within(dialog).getByRole("radio", { name: "All images (3)" }));
  expect(onFormatChange).toHaveBeenCalledWith("jpeg");
});

it("with a recipe picked, the footer says nothing about compression, on either scope", () => {
  // QC 11-26-2026: with Email small picked the footer read "Not compressed"
  // while the recipe wrote a different, re-encoded file. The line reads the
  // gallery's Resize & Compress result, which is not what a recipe downloads.
  useZipRecipeStore.getState().setRecipeId("builtin:email-small");
  try {
    renderDialog();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByTestId("export-compressed")).toBeNull();
    fireEvent.click(within(dialog).getByRole("radio", { name: "All images (3)" }));
    expect(within(dialog).queryByTestId("export-compressed")).toBeNull();
  } finally {
    useZipRecipeStore.getState().setRecipeId(null);
  }
});
