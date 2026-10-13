// @vitest-environment jsdom
import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GalleryCount } from "./GalleryCount";

it("names the gallery total and cap separately from the active-photo position", () => {
  render(<TooltipProvider><GalleryCount selectionActive={false} selectedCount={0} total={12} maxPhotos={12} /></TooltipProvider>);
  expect(screen.getByRole('heading').textContent).toBe('12photos·12max');
});
it("uses singular photo and allows an uncapped gallery", () => {
  render(<GalleryCount selectionActive={false} selectedCount={0} total={1} />);
  expect(screen.getByRole('heading').textContent).toBe('1photo');
});
it("keeps the selected subset readable", () => {
  render(<GalleryCount selectionActive selectedCount={3} total={12} />);
  expect(screen.getByRole('heading').textContent).toBe('Selected:3of12');
});
