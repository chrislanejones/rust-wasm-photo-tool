// @vitest-environment jsdom
// Compare mode's line in the gallery bar: the old pill's words, in the count
// readout's style, with a lightbulb and an X that ends compare mode.
import { beforeEach, expect, it } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GalleryCompareStatus } from "./GalleryCompareStatus";
import { useScreenshotCompareStore } from "@/stores/useScreenshotCompareStore";
import { useGalleryStore } from "@/stores/useGalleryStore";

const status = () => screen.getByRole("status").textContent?.replace(/\s+/g, " ").trim();
const ui = () => render(<TooltipProvider><GalleryCompareStatus /></TooltipProvider>);

beforeEach(() => {
  // B is the open photo: start() makes the picks A and B.
  useGalleryStore.setState({ activePhotoId: "b" });
  useScreenshotCompareStore.getState().stop();
  useScreenshotCompareStore.getState().beginPick();
});

it("says how many are picked, and what happens once two are", () => {
  ui();
  expect(status()).toBe("Pick 2 photos to compare · 0 of 2");
  act(() => useScreenshotCompareStore.getState().setPicks(["a"]));
  expect(status()).toBe("Pick 2 photos to compare · 1 of 2");
  act(() => {
    useScreenshotCompareStore.getState().setPicks(["a", "b"]);
    useScreenshotCompareStore.getState().setPending({ a: "a", b: "b", from: "x" });
  });
  expect(status()).toBe("Opening the second photo…");
  act(() => useScreenshotCompareStore.getState().start("a"));
  expect(status()).toBe("Comparing 2 photos");
});

it("has the lightbulb, and its X ends compare mode", () => {
  ui();
  expect(screen.getByRole("button", { name: "Compare info" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Stop comparing" }));
  expect(useScreenshotCompareStore.getState()).toMatchObject({ picking: false, picks: [], otherId: null });
});
