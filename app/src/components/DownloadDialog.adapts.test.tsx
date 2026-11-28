// @vitest-environment jsdom
//
// The Export dialog adapts to the task (Chris, 11-24-2026): a row that cannot
// apply is LEFT OUT, not grayed out to keep the dialog's shape.
//
//   Selected image: File Name (+ its extension), then a recipe under it,
//                   ONE grouped Format row (JPEG PNG WebP AVIF · SVG · ORA
//                   PSD), ONE primary Download
//   All images:     Recipe + Batch settings, the raster formats (and SVG when
//                   an SVG was uploaded), no File Name, Download ZIP
//   No "Kind of file" row (11-28-2026, the export one-row A/B): a group that
//   can't apply is left out of the Format row instead.
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

/** The Format row's tiles, in order, by accessible name (a tile's icon
 *  carries its own lettering, hidden from the name, so textContent doubles it). */
function formatRow(dialog: HTMLElement): string[] {
  const row = within(within(dialog).getByRole("radiogroup", { name: "Format" }));
  const radios = row.getAllByRole("radio");
  const names = ["JPEG", "PNG", "WebP", "AVIF", "SVG", "ORA", "PSD"].filter((n) => row.queryByRole("radio", { name: n }));
  return names.sort((a, b) => radios.indexOf(row.getByRole("radio", { name: a })) - radios.indexOf(row.getByRole("radio", { name: b })))
    .concat(radios.length === names.length ? [] : [`+${radios.length - names.length} unnamed`]);
}

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
  // ONE row: no Kind of file. No SVG was uploaded, so its group is left out.
  expect(within(dialog).queryByRole("radiogroup", { name: "Kind of file" })).toBeNull();
  // The tiles are named for their format.
  // (By name: a tile's icon carries its own lettering, hidden from the name.)
  const format = within(within(dialog).getByRole("radiogroup", { name: "Format" }));
  expect(formatRow(dialog)).toEqual([
    "JPEG", "PNG", "WebP", "AVIF", "ORA", "PSD",
  ]);
  // Each group after the first starts with a break the eye can see.
  expect(format.getByRole("radio", { name: "ORA" }).getAttribute("data-group-start")).toBe("");
  expect(format.getByRole("radio", { name: "PNG" }).hasAttribute("data-group-start")).toBe(false);
  expect(format.getByRole("radio", { name: "PSD" }).hasAttribute("disabled")).toBe(true);
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
  // Layered files can't go in a ZIP, and no SVG was uploaded: raster only.
  expect(within(dialog).queryByRole("radiogroup", { name: "Kind of file" })).toBeNull();
  expect(formatRow(dialog)).toEqual([
    "JPEG", "PNG", "WebP", "AVIF",
  ]);
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

it("an uploaded SVG brings its group into the row, between raster and layered", () => {
  renderDialog({ svg: { selected: true, all: 1 } });
  const dialog = screen.getByRole("dialog");
  const format = within(within(dialog).getByRole("radiogroup", { name: "Format" }));
  expect(formatRow(dialog)).toEqual([
    "JPEG", "PNG", "WebP", "AVIF", "SVG", "ORA", "PSD",
  ]);
  expect(format.getByRole("radio", { name: "SVG" }).getAttribute("data-group-start")).toBe("");
  // On All the SVG group stays (one SVG to zip), the layered group goes.
  fireEvent.click(within(dialog).getByRole("radio", { name: "All images (3)" }));
  expect(formatRow(dialog)).toEqual([
    "JPEG", "PNG", "WebP", "AVIF", "SVG",
  ]);
});

it("a recipe still picks the format: a layered pick leaves the recipe out, a raster one brings it back", () => {
  const onFormatChange = vi.fn();
  const { rerender } = renderDialog({ format: "ora" as never, onFormatChange });
  // Every open starts on a raster format, so the mount effect asks for one.
  expect(onFormatChange).toHaveBeenCalledWith("jpeg");
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).queryByLabelText("Recipe")).toBeNull();
  fireEvent.click(within(within(dialog).getByRole("radiogroup", { name: "Format" })).getByRole("radio", { name: "PNG" }));
  expect(onFormatChange).toHaveBeenLastCalledWith("png");
  rerender(
    <TooltipProvider>
      <DownloadDialog
        open onOpenChange={vi.fn()} photoCount={3} formats={FORMATS} pluginFormats={[]} format="png"
        onFormatChange={onFormatChange} fileName={{ value: "", defaultStem: "DMV-revised", onChange: vi.fn() }}
        ext=".png" downloadLabel="Download PNG" onDownload={vi.fn()} shareAction={<button type="button">Share link</button>}
        onCopy={vi.fn()} onDownloadAll={vi.fn()} zipFormat="png" zipLabel="PNG" svg={{ selected: false, all: 0 }}
      />
    </TooltipProvider>,
  );
  expect(within(screen.getByRole("dialog")).getByLabelText("Recipe")).toBeTruthy();
});
