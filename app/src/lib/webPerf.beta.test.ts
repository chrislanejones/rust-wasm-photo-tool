// Beta "PageSpeed budget" (ih_web_budget, PR #289): what the switch changes,
// and what it must NOT change.
import { describe, it, expect, afterEach, vi } from "vitest";

const store = new Map<string, string>();
vi.stubGlobal("window", { localStorage: { getItem: (k: string) => store.get(k) ?? null } });
const calls: string[] = [];
vi.mock("@/lib/engineGate", () => ({
  importEngine: async () => ({
    web_perf_metrics: () => { calls.push("budget"); return [140, 12]; },
    web_perf_metrics_score: () => { calls.push("score"); return [55, 12]; },
  }),
}));

const { autoCompressTarget, getWebPerfMetrics, webTargetBytes } = await import("./webPerf");
const input = { curW: 2000, curH: 1500, curBytes: 900_000, origBytes: 900_000, newW: 2000, newH: 1500, quality: 80 };

afterEach(() => {
  store.clear();
  calls.length = 0;
});

describe("PageSpeed budget (Beta)", () => {
  it("off: the old score and the old flat 200 KB target", async () => {
    expect(await getWebPerfMetrics(input)).toEqual({ kind: "score", value: 55, performanceGain: 12 });
    expect(calls).toEqual(["score"]);
    expect(autoCompressTarget(2000, 1500)).toBe(200 * 1024);
  });

  it("on: the budget used, and Auto Compress aims for pixels / 6", async () => {
    store.set("ih_web_budget", "1");
    expect(await getWebPerfMetrics(input)).toEqual({ kind: "budget", value: 140, performanceGain: 12 });
    expect(calls).toEqual(["budget"]);
    expect(autoCompressTarget(2000, 1500)).toBe(webTargetBytes(2000, 1500));
    expect(autoCompressTarget(2000, 1500)).not.toBe(200 * 1024);
  });
});
