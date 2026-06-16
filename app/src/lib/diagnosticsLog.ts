// In-memory diagnostics ring buffer feeding the Alt+Delete log overlay.
//
// The app had no telemetry before this; entries live only in memory for the
// current tab, are never persisted, and are never sent anywhere. The overlay
// is a developer/debug aid.

export type LogSource =
  | "WASM_ENGINE"
  | "CONVEX_DB"
  | "REPLICATE_AI"
  | "UI_THREAD"
  | "CONSOLE";

export interface LogEntry {
  id: number;
  ts: number;
  source: LogSource;
  message: string;
  durationMs?: number;
}

const MAX_ENTRIES = 500;
let buffer: LogEntry[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit(): void {
  for (const fn of listeners) fn();
}

/** Append an entry. Reassigns the buffer so useSyncExternalStore re-renders. */
export function logDiagnostic(
  source: LogSource,
  message: string,
  durationMs?: number,
): void {
  const entry: LogEntry = {
    id: nextId++,
    ts: Date.now(),
    source,
    message,
    durationMs,
  };
  buffer =
    buffer.length >= MAX_ENTRIES ? [...buffer.slice(1), entry] : [...buffer, entry];
  emit();
}

export function getDiagnostics(): readonly LogEntry[] {
  return buffer;
}

export function clearDiagnostics(): void {
  buffer = [];
  emit();
}

export function subscribeDiagnostics(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

let consoleHooked = false;

/**
 * Mirror console.error/warn/info into the buffer once, globally, so runtime
 * issues surface in the overlay without instrumenting every call site. The
 * original console methods are still invoked. Idempotent.
 */
export function installConsoleCapture(): void {
  if (consoleHooked || typeof console === "undefined") return;
  consoleHooked = true;
  (["error", "warn", "info"] as const).forEach((level) => {
    const orig = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      try {
        logDiagnostic("CONSOLE", `[${level}] ` + args.map(stringifyArg).join(" "));
      } catch {
        // never let logging break the app
      }
      orig(...args);
    };
  });
}

function stringifyArg(a: unknown): string {
  if (typeof a === "string") return a;
  if (a instanceof Error) return a.message;
  try {
    return JSON.stringify(a);
  } catch {
    return String(a);
  }
}
