// @vitest-environment jsdom
//
// The "Add this image" dialog offers two ways in: a new layer, or a new
// gallery image. "Merge into layer" was removed on 10-14-2026 (destructive,
// confusing, and it froze on big images); this pins that it stays gone.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ImportImageDialog } from "./ImportImageDialog";

function open(hasActivePhoto: boolean) {
  render(
    <ImportImageDialog
      open
      onOpenChange={() => {}}
      previewUrl={null}
      width={0}
      height={0}
      canUseLayers
      hasActivePhoto={hasActivePhoto}
      onNewLayer={() => {}}
      onAddToGallery={() => {}}
    />,
  );
}

describe("import choices", () => {
  it("offers Add to Layer and Add Image to Gallery, and nothing that merges", () => {
    open(true);
    const tiles = screen.getAllByRole("button").map((b) => b.textContent ?? "");
    expect(tiles.some((t) => t.includes("Add to Layer"))).toBe(true);
    expect(tiles.some((t) => t.includes("Add Image to Gallery"))).toBe(true);
    expect(tiles.some((t) => /merge/i.test(t))).toBe(false);
    expect(screen.queryByText(/merge/i)).toBeNull();
  });
});
