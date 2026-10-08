// @vitest-environment jsdom
//
// The Quality slider stored 67 for a knob on the 80 preset (10-07): with
// presets the <input>'s value is a TRACK POSITION, and the release handler
// committed it raw. The commit must be the same value onChange reports.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SizeSlider } from "./size-slider";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function setTrack(input: HTMLInputElement, pos: number) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  setter.call(input, String(pos));
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("SizeSlider with presets commits the mapped value on release", () => {
  for (const pos of [0, 28, 50, 67, 100]) {
    it(`track position ${pos}: commit === last onChange`, () => {
      const changes: number[] = [];
      const commits: number[] = [];
      function Harness() {
        const [v, setV] = React.useState(75);
        return (
          <SizeSlider
            label="Quality"
            value={v}
            onChange={(n) => { changes.push(n); setV(n); }}
            onCommit={(n) => commits.push(n)}
            presets={[50, 70, 80, 90] as const}
            variant="numbers"
            min={10}
            max={100}
            unit="%"
          />
        );
      }
      act(() => root.render(<Harness />));
      const input = container.querySelector('input[type="range"]') as HTMLInputElement;
      act(() => setTrack(input, pos));
      act(() => { input.dispatchEvent(new PointerEvent("pointerup", { bubbles: true })); });
      expect(commits.length).toBe(1);
      expect(commits[0]).toBe(changes[changes.length - 1] ?? 75); // 75 sits at position 50: no change event
    });
  }
});
