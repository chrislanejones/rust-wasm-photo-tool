// @vitest-environment jsdom
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SizeSlider } from "./size-slider";

// Matches Shapes → Points, including its initial value and preset endpoints.
function PointsSlider({
  initialValue = 5,
  disabled = false,
  onChange = (_value: number) => {},
  onCommit,
}: {
  initialValue?: number;
  disabled?: boolean;
  onChange?: (value: number) => void;
  onCommit?: (value: number) => void;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <SizeSlider
      label="Points"
      value={value}
      onChange={(next) => { onChange(next); setValue(next); }}
      onCommit={onCommit}
      presets={[3, 5, 8, 12]}
      variant="numbers"
      disabled={disabled}
    />
  );
}

describe("preset SizeSlider keyboard navigation", () => {
  it.each([
    ["ArrowRight", "ArrowLeft"],
    ["ArrowUp", "ArrowDown"],
  ])("%s increases Points from 5 to 6 and %s returns to 5", (increase, decrease) => {
    const onChange = vi.fn();
    render(<PointsSlider onChange={onChange} />);
    const slider = screen.getByRole("slider", { name: "Points" });

    // Prevent the browser from also applying a native track-position step.
    expect(fireEvent.keyDown(slider, { key: increase })).toBe(false);
    expect(onChange).toHaveBeenLastCalledWith(6);
    expect(slider.getAttribute("aria-valuetext")).toBe("6");
    fireEvent.keyUp(slider, { key: increase });
    fireEvent.keyDown(slider, { key: decrease });
    expect(onChange.mock.calls).toEqual([[6], [5]]);
    expect(slider.getAttribute("aria-valuetext")).toBe("5");
  });

  it.each([
    [4, "ArrowLeft", 3],
    [4, "ArrowDown", 3],
    [11, "ArrowRight", 12],
    [11, "ArrowUp", 12],
  ])("clamps from %i using %s at preset endpoint %i", (initialValue, key, endpoint) => {
    const onChange = vi.fn();
    const onCommit = vi.fn();
    render(<PointsSlider initialValue={initialValue} onChange={onChange} onCommit={onCommit} />);
    const slider = screen.getByRole("slider", { name: "Points" });
    fireEvent.keyDown(slider, { key });
    fireEvent.keyDown(slider, { key, repeat: true });
    fireEvent.keyUp(slider, { key });
    expect(onChange.mock.calls).toEqual([[endpoint]]);
    expect(slider.getAttribute("aria-valuetext")).toBe(String(endpoint));
    expect(onCommit.mock.calls).toEqual([[endpoint]]);

    onCommit.mockClear();
    fireEvent.keyDown(slider, { key });
    fireEvent.keyUp(slider, { key });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("commits the final actual value once on release after repeated keydowns", () => {
    const onChange = vi.fn();
    const onCommit = vi.fn();
    render(<PointsSlider onChange={onChange} onCommit={onCommit} />);
    const slider = screen.getByRole("slider", { name: "Points" });
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    fireEvent.keyDown(slider, { key: "ArrowRight", repeat: true });
    fireEvent.keyDown(slider, { key: "ArrowRight", repeat: true });
    expect(onChange.mock.calls).toEqual([[6], [7], [8]]);
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.keyUp(slider, { key: "Shift" });
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.keyUp(slider, { key: "ArrowRight" });
    expect(onCommit.mock.calls).toEqual([[8]]);
    fireEvent.keyUp(slider, { key: "ArrowRight" });
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("ignores arrow input while disabled", () => {
    const onChange = vi.fn();
    const onCommit = vi.fn();
    render(<PointsSlider disabled onChange={onChange} onCommit={onCommit} />);
    const slider = screen.getByRole("slider", { name: "Points" }) as HTMLInputElement;
    expect(slider.disabled).toBe(true);
    for (const key of ["ArrowRight", "ArrowUp", "ArrowLeft", "ArrowDown"]) {
      fireEvent.keyDown(slider, { key });
      fireEvent.keyUp(slider, { key });
    }
    expect(onChange).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
    expect(slider.getAttribute("aria-valuetext")).toBe("5");
  });

  it("keeps preset buttons selecting their preset value", () => {
    const onChange = vi.fn();
    const onCommit = vi.fn();
    render(<PointsSlider onChange={onChange} onCommit={onCommit} />);
    fireEvent.click(screen.getByRole("radio", { name: "Points 8" }));
    expect(onChange.mock.calls).toEqual([[8]]);
    expect(screen.getByRole("slider", { name: "Points" }).getAttribute("aria-valuetext")).toBe("8");
    expect(onCommit).not.toHaveBeenCalled();
  });
});
