// The engine-call audit's JSON, typed once and loaded once.
//
// WHY IT SHELLS OUT. The classification lives in `scripts/engine-call-audit.mjs`
// and only there. Reimplementing "is this awaited" in the test would create two
// definitions of converted that drift apart, and the audit is the artifact the
// contract names as the measure. One implementation, the tests consume it.
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { REPO } from "./contractScan";

export interface Gate {
  total: number;
  valueConsumed: number;
  awaited: number;
  unawaited: number;
  restructure: number;
  truthy: number;
  remaining: number;
  remainingByFile: Record<string, number>;
  truthySites: string[];
  remainingHandlers: string[];
  hotHandlers: string[];
  /** a10 — the hot-path bucket, measured for the first time in v8.21. */
  hotConsumed: number;
  hotRemaining: number;
  hotRemainingHandlers: string[];
}

export const gate: Gate = JSON.parse(
  execFileSync("node", [join(REPO, "scripts/engine-call-audit.mjs"), "--json", REPO], {
    encoding: "utf8",
  }),
);
