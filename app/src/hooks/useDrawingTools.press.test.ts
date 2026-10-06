// @vitest-environment jsdom
// A drag that moves and lifts while the engine is still answering the press.
//
// `onMouseDown` awaits engine round trips (commit the pending shape, the
// hit-test, the cross-layer hit-test) before it knows the press is a new drag,
// and they slow down as shapes pile up. The pointer does not wait: it used to
// move and lift into a hook that was not drawing yet, so the drag vanished —
// and the hook then started drawing anyway, with the button already up, so
// the NEXT drag ran from the vanished one's start point. Found drawing 30
// diagram shapes in a row; it began around the 14th.
import { describe, it, expect, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type React from "react";

vi.mock("@/lib/engineGate", () => ({ importEngine: () => new Promise(() => {}) }));
vi.mock("@/lib/annotationHitTest", () => ({ findForeignAnnotation: async () => false }));

const { useDrawingTools } = await import("./useDrawingTools");
const { defaultToolSettings } = await import("@/lib/defaultToolSettings");

/** A promise the test settles by hand — the engine taking its time. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

/** A 100×100 canvas laid out 1:1 at the viewport origin. */
function canvas(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 100;
  c.height = 100;
  c.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 }) as DOMRect;
  // jsdom has no 2D context; the rubber band only needs calls to land somewhere.
  const ctx = new Proxy({ canvas: c }, { get: (t, k) => (k in t ? t[k as "canvas"] : () => {}) });
  c.getContext = (() => ctx) as unknown as HTMLCanvasElement["getContext"];
  return c;
}

const ev = (x: number, y: number) =>
  ({ button: 0, clientX: x, clientY: y }) as React.MouseEvent<HTMLCanvasElement>;

function setup() {
  const hits: Array<ReturnType<typeof deferred<number>>> = [];
  const added: number[][] = [];
  const tool = {
    shape_annotation_at: () => {
      const d = deferred<number>();
      hits.push(d);
      return d.promise;
    },
    // What `commitEdit` needs to land a pending shape.
    add_shape_annotation: async (_k: number, x0: number, y0: number, x1: number, y1: number) => {
      added.push([x0, y0, x1, y1]);
      return added.length;
    },
    get_shape_annotations: async () => "[]",
  };
  const { result, rerender } = renderHook(
    ({ shape }: { shape: "rect" | "star" }) =>
    useDrawingTools({
      toolRef: { current: tool } as never,
      canvasRef: { current: canvas() },
      previewRef: { current: canvas() },
      activeTool: "shapes",
      settings: { ...defaultToolSettings, shape },
      flushToCanvas: () => {},
      syncState: () => {},
    }),
    { initialProps: { shape: "rect" as "rect" | "star" } },
  );
  /** Answer the `i`th hit-test once the hook has asked it. */
  const answer = async (i: number, id: number) => {
    await vi.waitFor(() => expect(hits.length).toBeGreaterThan(i));
    hits[i].resolve(id);
  };
  return { result, hits, added, answer, rerender };
}

describe("a press the engine is still answering", () => {
  it("keeps the drag the pointer made while it waited", async () => {
    const { result, answer } = setup();
    let down!: Promise<void>;
    act(() => {
      down = result.current.onMouseDown(ev(10, 10));
    });
    // The pointer travels and lifts before the hit-test answers.
    act(() => {
      result.current.onMouseMove(ev(40, 30));
      result.current.onMouseMove(ev(60, 50));
      result.current.onMouseUp();
    });
    expect(result.current.editState).toBeNull();
    await act(async () => {
      await answer(0, -1); // empty canvas
      await down;
    });
    expect(result.current.editState).toMatchObject({
      kind: "shape",
      start: { x: 10, y: 10 },
      end: { x: 60, y: 50 },
      drawnShape: "rect",
    });
  });

  it("a lost press does not hand its start point to the next drag", async () => {
    const { result, answer } = setup();
    let first!: Promise<void>;
    act(() => {
      first = result.current.onMouseDown(ev(5, 5));
    });
    // A click that lands on nothing: no movement, lifted at once.
    act(() => result.current.onMouseUp());
    await act(async () => {
      await answer(0, -1);
      await first;
    });
    expect(result.current.editState).toBeNull(); // a sub-3px click draws nothing
    let second!: Promise<void>;
    act(() => {
      second = result.current.onMouseDown(ev(50, 50));
    });
    act(() => {
      result.current.onMouseMove(ev(90, 80));
      result.current.onMouseUp();
    });
    await act(async () => {
      await answer(1, -1);
      await second;
    });
    expect(result.current.editState).toMatchObject({
      start: { x: 50, y: 50 },
      end: { x: 90, y: 80 },
    });
  });

  it("a press waits for the one before it, and a click before a drag stays a click", async () => {
    const { result, hits, answer } = setup();
    let a!: Promise<void>;
    let b!: Promise<void>;
    act(() => {
      a = result.current.onMouseDown(ev(10, 10));
    });
    act(() => result.current.onMouseUp());
    act(() => {
      b = result.current.onMouseDown(ev(20, 20));
    });
    act(() => {
      result.current.onMouseMove(ev(70, 60));
      result.current.onMouseUp();
    });
    // Only the first press asks the engine: the second waits its turn.
    await act(async () => {
      await vi.waitFor(() => expect(hits).toHaveLength(1));
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(hits).toHaveLength(1);
    await act(async () => {
      await answer(0, -1);
      await a;
    });
    expect(result.current.editState).toBeNull(); // the click drew nothing
    await act(async () => {
      await answer(1, -1);
      await b;
    });
    expect(result.current.editState).toMatchObject({
      start: { x: 20, y: 20 },
      end: { x: 70, y: 60 },
    });
  });

  it("two quick drags both land: the second commits the first", async () => {
    const { result, hits, added, answer } = setup();
    let a!: Promise<void>;
    let b!: Promise<void>;
    // Both drags happen before the engine has answered either press.
    act(() => {
      a = result.current.onMouseDown(ev(10, 10));
    });
    act(() => {
      result.current.onMouseMove(ev(40, 40));
      result.current.onMouseUp();
    });
    act(() => {
      b = result.current.onMouseDown(ev(50, 50));
    });
    act(() => {
      result.current.onMouseMove(ev(90, 95));
      result.current.onMouseUp();
    });
    await act(async () => {
      await answer(0, -1);
      await a;
    });
    // The first drag landed as the pending shape, and the second press — next
    // in line — committed it to the engine before its own hit-test.
    await act(async () => {
      await vi.waitFor(() => expect(hits).toHaveLength(2));
    });
    expect(added).toEqual([[10, 10, 40, 40]]);
    await act(async () => {
      await answer(1, -1);
      await b;
    });
    expect(added).toEqual([[10, 10, 40, 40]]);
    expect(result.current.editState).toMatchObject({ start: { x: 50, y: 50 }, end: { x: 90, y: 95 } });
  });

  it("a drag that finishes late draws what was picked when it was pressed", async () => {
    const { result, answer, rerender } = setup();
    let down!: Promise<void>;
    act(() => {
      down = result.current.onMouseDown(ev(10, 10));
    });
    act(() => {
      result.current.onMouseMove(ev(60, 60));
      result.current.onMouseUp();
    });
    // The next tile is clicked, and the pointer hovers off, before the
    // engine answers the press.
    rerender({ shape: "star" });
    act(() => result.current.onMouseMove(ev(95, 95)));
    await act(async () => {
      await answer(0, -1);
      await down;
    });
    expect(result.current.editState).toMatchObject({
      drawnShape: "rect",
      end: { x: 60, y: 60 },
    });
  });

  it("a press that lands on a shape still selects it, and draws nothing", async () => {
    const { result, answer } = setup();
    let down!: Promise<void>;
    act(() => {
      down = result.current.onMouseDown(ev(10, 10));
    });
    act(() => {
      result.current.onMouseMove(ev(60, 60));
      result.current.onMouseUp();
    });
    await act(async () => {
      await answer(0, 7); // shape 7 is under the press
      await down.catch(() => {});
    });
    // selectShape reads the shape list from the engine, which this fake lacks,
    // so no edit box opens — but neither does a new rubber-band shape.
    expect(result.current.editState).toBeNull();
  });
});
