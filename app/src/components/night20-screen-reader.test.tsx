// @vitest-environment jsdom
//
// UI Night 20: choices, failures and fields a screen reader could not hear.
// Each block pins what assistive tech is told, not how it looks.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HistogramView } from "@/features/canvas/HistogramView";
import { PlacementGrid } from "@/components/PlacementGrid";
import { MasterBar } from "@/components/master-bar/MasterBar";
import { ReselectBar } from "@/components/ui/reselect-bar";
import { ErrorNote } from "@/components/ui/status-note";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ReactElement } from "react";

const withTips = (ui: ReactElement) => render(<TooltipProvider>{ui}</TooltipProvider>);

vi.mock("@emoji-mart/react", () => ({ default: () => null }));
vi.mock("@emoji-mart/data", () => ({ default: {} }));
import { StampSettingsPanel } from "@/features/tools/settings/StampSettings";

describe("Histogram channels", () => {
  it("is a named radio group that says which channel is drawn", () => {
    render(<HistogramView getHistogram={() => null} signature="" photoKey={null} active={false} />);
    const group = screen.getByRole("radiogroup", { name: "Histogram channels" });
    const [rgb, luma] = screen.getAllByRole("radio");
    expect(group.contains(rgb!)).toBe(true);
    expect(rgb!.getAttribute("aria-checked")).toBe("true");
    expect(luma!.getAttribute("aria-checked")).toBe("false");
    fireEvent.keyDown(rgb!, { key: "ArrowRight" });
    expect(screen.getByRole("radio", { name: "Luma" }).getAttribute("aria-checked")).toBe("true");
  });
});

describe("Placement grid", () => {
  it("announces the chosen cell of nine", () => {
    render(<PlacementGrid value="center" onChange={() => {}} label="Position" />);
    expect(screen.getByRole("radiogroup", { name: "Position" })).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(9);
    expect(screen.getByRole("radio", { name: "Center", checked: true })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Top left" }).getAttribute("aria-checked")).toBe("false");
  });

  it("one Tab stop; arrows move and select", () => {
    const onChange = vi.fn();
    render(<PlacementGrid value="center" onChange={onChange} />);
    const tabStops = screen.getAllByRole("radio").filter((r) => r.tabIndex === 0);
    expect(tabStops.map((r) => r.getAttribute("aria-label"))).toEqual(["Center"]);
    fireEvent.keyDown(screen.getByRole("radio", { name: "Center" }), { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("middle-right");
  });
});

describe("Red Stamp presets", () => {
  it("are a named radio group, nothing checked until one is picked", () => {
    withTips(
      <StampSettingsPanel
        settings={{ brushSize: 20 } as never}
        onChange={() => {}}
        activeMode="red"
      />,
    );
    const group = screen.getByRole("radiogroup", { name: "Stamp" });
    const radios = group.querySelectorAll('[role="radio"]');
    expect(radios).toHaveLength(5);
    expect(group.querySelectorAll('[aria-checked="true"]')).toHaveLength(0);
    act(() => (radios[1] as HTMLElement).click());
    expect(radios[1]!.getAttribute("aria-checked")).toBe("true");
  });
});

describe("Master bar tabs", () => {
  it("the two tabs that are off say so", () => {
    withTips(
      <MasterBar
        activeTab="gallery"
        onTab={() => {}}
        onNew={() => {}}
        onExport={() => {}}
        canExport
        settingsSlot={null}
        userSlot={null}
      />,
    );
    expect(screen.getByRole("button", { name: "Gallery" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Tools" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "Review" }).getAttribute("aria-pressed")).toBe("false");
    // New and Export are actions: still no toggle state.
    expect(screen.getByRole("button", { name: "New" }).hasAttribute("aria-pressed")).toBe(false);
  });
});

describe("Rename by keyboard", () => {
  it("F2 on a row renames it, and the row says so", () => {
    const onRename = vi.fn();
    render(<ReselectBar label="x" onSelect={() => {}} onRename={onRename} title="Select Layer 1" />);
    const row = screen.getByTitle("Select Layer 1");
    expect(row.getAttribute("aria-keyshortcuts")).toBe("F2");
    fireEvent.keyDown(row, { key: "F2" });
    expect(onRename).toHaveBeenCalledOnce();
  });

  it("a row with no rename claims no shortcut", () => {
    render(<ReselectBar label="x" onSelect={() => {}} title="Row" />);
    expect(screen.getByTitle("Row").hasAttribute("aria-keyshortcuts")).toBe(false);
  });
});

describe("ErrorNote", () => {
  it("a failure is an alert", () => {
    render(<ErrorNote>Upload failed</ErrorNote>);
    expect(screen.getByRole("alert").textContent).toBe("Upload failed");
  });
  it("a validation line is polite, so typing is not interrupted", () => {
    render(<ErrorNote polite>Must be 1 or more</ErrorNote>);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("Must be 1 or more");
  });
});
