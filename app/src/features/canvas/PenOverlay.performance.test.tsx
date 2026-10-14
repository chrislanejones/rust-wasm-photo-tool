// @vitest-environment jsdom
import { Profiler } from "react";
import { render, fireEvent, act } from "@testing-library/react";
import { expect, it, vi } from "vitest";
vi.mock("@/lib/strokeLeash", () => ({ getStrokeLeash: async () => 0, NO_LEASH: 0, StrokeLeash: class { isOn = false; } }));
import { PenOverlay } from "./PenOverlay";
it("bounds preview renders per frame and commits the last unsent drag position", async () => {
  vi.stubGlobal("PointerEvent", MouseEvent);
  const frames = new Map<number, FrameRequestCallback>(); let frame = 0;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => { frames.set(++frame, cb); return frame; });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 100;
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 } as DOMRect);
  const commit = vi.fn(async (_points: number[], _close: boolean) => undefined); let renders = 0;
  const view = render(<Profiler id="pen" onRender={() => { renders++; }}><PenOverlay canvasEl={canvas} color="#ef4444" strokeWidth={2} onCommit={commit} /></Profiler>);
  const surface = view.container.querySelector("svg > rect")!;
  fireEvent.pointerDown(surface, { clientX: 10, clientY: 10 }); fireEvent.pointerUp(window, { clientX: 10, clientY: 10 });
  fireEvent.pointerDown(surface, { clientX: 40, clientY: 40 });
  const start = renders;
  for (let i = 0; i < 200; i++) fireEvent.pointerMove(window, { clientX: 50 + i / 10, clientY: 60 });
  console.log("pen preview commits for 200 moves:", renders - start);
  expect(renders - start).toBeLessThanOrEqual(1);
  // Release/Enter before rAF must still commit the latest point.
  fireEvent.pointerUp(window, { clientX: 69.9, clientY: 60 });
  await act(async () => { fireEvent.keyDown(window, { key: "Enter" }); });
  const points = commit.mock.calls[0]?.[0] as unknown as number[];
  expect(points).toContain(69.9);
  act(() => { for (const cb of frames.values()) cb(0); frames.clear(); });
  view.unmount(); vi.unstubAllGlobals();
});
