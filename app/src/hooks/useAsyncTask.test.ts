// @vitest-environment jsdom
// Plan C §3 — the async grammar's rules, each broken once on purpose.
import { describe, it, expect, vi, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { SAVED_MS, useAsyncTask } from "./useAsyncTask";

afterEach(() => vi.useRealTimers());

describe("useAsyncTask", () => {
  it("timeout invalidates the context and late progress cannot replace its persistent error", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useAsyncTask());
    let ctx!: { setProgress: (p: number | null) => void; isCurrent: () => boolean };
    let resolve!: () => void;
    let work!: Promise<unknown>;
    act(() => { work = result.current.run(c => { ctx = c; return new Promise<void>(r => { resolve = r; }); }, { timeoutMs: 10 }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(11); await work; });
    expect(ctx.isCurrent()).toBe(false);
    const error = result.current.error;
    await act(async () => { ctx.setProgress(1); resolve(); });
    expect(result.current.state).toBe("error");
    expect(result.current.error).toBe(error);
    expect(result.current.progress).toBeNull();
  });

  it("completed and failed contexts cannot restart progress", async () => {
    const { result } = renderHook(() => useAsyncTask());
    let ctx!: { setProgress: (p: number | null) => void; isCurrent: () => boolean };
    await act(async () => { await result.current.run(async c => { ctx = c; return 1; }); });
    act(() => { ctx.setProgress(0.5); });
    expect(ctx.isCurrent()).toBe(false);
    expect(result.current.state).toBe("ready");
    await act(async () => { await result.current.run(async c => { ctx = c; throw new Error("failed"); }); });
    act(() => { ctx.setProgress(0.5); });
    expect(ctx.isCurrent()).toBe(false);
    expect(result.current.state).toBe("error");
  });
  it("processing, then ready", async () => {
    const { result } = renderHook(() => useAsyncTask());
    let resolve!: (v: number) => void;
    let p!: Promise<unknown>;
    act(() => {
      p = result.current.run(() => new Promise<number>((r) => (resolve = r)));
    });
    expect(result.current.state).toBe("processing");
    await act(async () => {
      resolve(7);
      expect(await p).toEqual({ status: "done", value: 7 });
    });
    expect(result.current.state).toBe("ready");
  });

  it("a backend that never answers times out into Error — nothing spins forever", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useAsyncTask());
    let p!: Promise<unknown>;
    act(() => {
      p = result.current.run(() => new Promise(() => {}), { timeoutMs: 1000, timeoutMessage: "The AI did not answer." });
    });
    await act(async () => {
      vi.advanceTimersByTime(1001);
      expect(await p).toEqual({ status: "failed", error: "The AI did not answer." });
    });
    expect(result.current.state).toBe("error");
    expect(result.current.error).toBe("The AI did not answer.");
  });

  it("a superseded run resolves as dropped and never rejects or paints an error", async () => {
    const { result } = renderHook(() => useAsyncTask());
    let rejectFirst!: (e: Error) => void;
    let first!: Promise<unknown>;
    let second!: Promise<unknown>;
    act(() => {
      first = result.current.run(() => new Promise((_, rej) => (rejectFirst = rej)));
    });
    act(() => {
      second = result.current.run(() => Promise.resolve("new"));
    });
    await act(async () => {
      rejectFirst(new Error("engine document replaced"));
      expect(await first).toEqual({ status: "dropped" });
      expect(await second).toEqual({ status: "done", value: "new" });
    });
    expect(result.current.state).toBe("ready");
    expect(result.current.error).toBeNull();
  });

  it("saved shows ✓ briefly, then ready", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useAsyncTask());
    await act(async () => {
      await result.current.run(() => Promise.resolve(1), { saved: true });
    });
    expect(result.current.state).toBe("saved");
    act(() => {
      vi.advanceTimersByTime(SAVED_MS + 1);
    });
    expect(result.current.state).toBe("ready");
  });

  it("progress is reported while processing", async () => {
    const { result } = renderHook(() => useAsyncTask());
    let resolve!: () => void;
    act(() => {
      void result.current.run(({ setProgress }) => {
        setProgress(0.5);
        return new Promise<void>((r) => (resolve = r));
      });
    });
    expect(result.current.progress).toBe(0.5);
    await act(async () => resolve());
  });

  it("reset drops what is in flight", async () => {
    const { result } = renderHook(() => useAsyncTask());
    let resolve!: (v: number) => void;
    let p!: Promise<unknown>;
    act(() => {
      p = result.current.run(() => new Promise<number>((r) => (resolve = r)));
    });
    act(() => result.current.reset());
    await act(async () => {
      resolve(1);
      expect(await p).toEqual({ status: "dropped" });
    });
    expect(result.current.state).toBe("ready");
  });
});
