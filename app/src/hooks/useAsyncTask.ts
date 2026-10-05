// One async grammar (Plan C §3). Every long-running flow — AI result,
// background removal, export, ZIP, ORA import, large decode, batch, sync,
// backup — moves through the same five states instead of inventing its own
// spinner or toast:
//
//   ready       nothing pending                         → nothing extra
//   loading     fetching something that exists          → skeletons in its place
//   processing  computing something new                 → source stays, inert;
//                                                          progress if known, ↻ if not
//   saved       a result landed somewhere durable        → ✓, briefly
//   error       it did not work                          → replaces progress, says
//                                                          what failed, offers an action
//
// Rules the hook enforces so callers cannot get them wrong:
//
//   • EVERY run times out into `error`. Nothing spins forever.
//   • A run that is SUPERSEDED (another run started, or `reset()` was called)
//     resolves as "dropped": its result is ignored and it never rejects, so a
//     stale engine call cannot surface as an unhandled rejection.
//   • `saved` falls back to `ready` on its own after SAVED_MS.
import { useCallback, useEffect, useRef, useState } from "react";

export type AsyncState = "ready" | "loading" | "processing" | "saved" | "error";

export interface AsyncStatus {
  state: AsyncState;
  /** 0..1 while processing with a known length; null when unknown. */
  progress: number | null;
  /** What failed, in words a person can act on. Set only in `error`. */
  error: string | null;
}

export interface RunOptions {
  /** `processing` (computing something new, the default) or `loading`. */
  kind?: "loading" | "processing";
  /** Give up and show Error after this long. Default 60 s. */
  timeoutMs?: number;
  /** The Error message when it times out. */
  timeoutMessage?: string;
  /** Show ✓ Saved afterwards (a durable result). Default false → straight to ready. */
  saved?: boolean;
}

/** What `run` resolves to. "dropped" = superseded; the caller does nothing. */
export type RunResult<T> = { status: "done"; value: T } | { status: "dropped" } | { status: "failed"; error: string };

export const SAVED_MS = 1500;
const DEFAULT_TIMEOUT_MS = 60_000;

class TimeoutError extends Error {}

function messageOf(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return "Something went wrong.";
}

export function useAsyncTask() {
  const [status, setStatus] = useState<AsyncStatus>({ state: "ready", progress: null, error: null });
  const seq = useRef(0);
  const savedTimer = useRef<number | undefined>(undefined);
  const mounted = useRef(true);
  useEffect(() => {
    // Copied for the cleanup: these refs hold counters, not DOM nodes, but
    // reading them through locals keeps the rule (and the intent) plain.
    const live = mounted;
    const runs = seq;
    const saved = savedTimer;
    live.current = true;
    return () => {
      live.current = false;
      runs.current++; // anything in flight is dropped on unmount
      window.clearTimeout(saved.current);
    };
  }, []);

  const set = useCallback((s: AsyncStatus) => {
    if (mounted.current) setStatus(s);
  }, []);

  const run = useCallback(
    async <T,>(
      work: (ctx: { setProgress: (p: number | null) => void; isCurrent: () => boolean }) => Promise<T>,
      opts: RunOptions = {},
    ): Promise<RunResult<T>> => {
      const id = ++seq.current;
      const isCurrent = () => id === seq.current && mounted.current;
      window.clearTimeout(savedTimer.current);
      const kind = opts.kind ?? "processing";
      set({ state: kind, progress: null, error: null });
      const setProgress = (p: number | null) => {
        if (isCurrent()) set({ state: kind, progress: p, error: null });
      };
      let timer: number | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = window.setTimeout(
          () => reject(new TimeoutError(opts.timeoutMessage ?? "It took too long and was stopped.")),
          opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        );
      });
      try {
        const value = await Promise.race([work({ setProgress, isCurrent }), timeout]);
        if (!isCurrent()) return { status: "dropped" };
        if (opts.saved) {
          set({ state: "saved", progress: null, error: null });
          savedTimer.current = window.setTimeout(() => {
            if (isCurrent()) set({ state: "ready", progress: null, error: null });
          }, SAVED_MS);
        } else {
          set({ state: "ready", progress: null, error: null });
        }
        return { status: "done", value };
      } catch (err) {
        // A superseded run's failure is not news: it never rejects and never
        // paints an Error over the run that replaced it.
        if (!isCurrent()) return { status: "dropped" };
        const error = messageOf(err);
        set({ state: "error", progress: null, error });
        return { status: "failed", error };
      } finally {
        window.clearTimeout(timer);
      }
    },
    [set],
  );

  /** Back to ready; anything in flight is dropped. */
  const reset = useCallback(() => {
    seq.current++;
    window.clearTimeout(savedTimer.current);
    set({ state: "ready", progress: null, error: null });
  }, [set]);

  return { ...status, run, reset };
}
