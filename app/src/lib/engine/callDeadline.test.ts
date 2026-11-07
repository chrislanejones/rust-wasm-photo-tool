import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CALL_TIMEOUT_MS, callExpired } from "@/lib/engine/callDeadline";

describe("callExpired", () => {
  it("runs a call before its deadline", () => {
    expect(callExpired(1000, 999)).toBe(false);
  });

  it("refuses a call at and after its deadline", () => {
    expect(callExpired(1000, 1000)).toBe(true);
    expect(callExpired(1000, 1001)).toBe(true);
  });

  it("runs a call with no deadline", () => {
    expect(callExpired(undefined, Number.MAX_SAFE_INTEGER)).toBe(false);
  });

  it("gives the caller a real wait", () => {
    expect(CALL_TIMEOUT_MS).toBeGreaterThanOrEqual(10_000);
  });
});

describe("the worker's drain", () => {
  const source = readFileSync(resolve(__dirname, "../../workers/engine.worker.ts"), "utf8");
  const drain = source.slice(source.indexOf("async function drain()"));

  it("checks the deadline before anything that touches the engine", () => {
    const check = drain.indexOf("callExpired(req.deadline, Date.now())");
    expect(check).toBeGreaterThan(-1);
    expect(check).toBeLessThan(drain.indexOf("blits.beforeCall(req.method)"));
    expect(check).toBeLessThan(drain.indexOf("(tool as unknown as Record<string, unknown>)[req.method]"));
  });

  it("answers the refused call rather than dropping it", () => {
    const check = drain.indexOf("callExpired(req.deadline, Date.now())");
    const body = drain.slice(check, drain.indexOf("continue;", check));
    expect(body).toContain("CALL_EXPIRED_ERROR");
    expect(body).toContain("ok: false");
  });
});
