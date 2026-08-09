// ADR-024 Stage 3.5 — the async-migration guard.
//
// Stage 3.5's invariant, verbatim from the contract:
//
//   Stage 3.5 makes every live-document value-consuming engine call async
//   without exposing worker/local selection to callers. Stage 3.5 is accepted
//   structurally; worker ON is accepted behaviorally only after local and
//   worker implementations pass the same contract.
//
// This file proves the STRUCTURAL half. It cannot prove the behavioural half —
// that needs a running worker and an op-log equivalence run, which is a12/a13.
//
// WHY A RATCHET AND NOT A BOOLEAN. Value-consuming sites start un-awaited
// today, so a test that simply failed on "any un-awaited call" would be red
// before the first batch and would stay red for weeks — a permanently failing
// test teaches people to ignore the suite. Instead the count is pinned. It
// fails if the number goes UP (a new un-converted call sneaked in) and it fails
// if the number goes DOWN without the budget being lowered (so a batch cannot
// land without someone deliberately recording the progress). 168 -> 0 is the
// gate, one edit to `BUDGET` per batch.
//
// WHY IT SHELLS OUT. The classification lives in `scripts/engine-call-audit.mjs`
// and only there. Reimplementing "is this awaited" here would create two
// definitions of converted that drift apart, and the audit is the artifact the
// contract names as the measure. One implementation, this test consumes it.
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** Lower this by exactly the batch size as each of a3–a10 lands. Gate is 0.
 *
 *  The history of this number is worth keeping, because every move was a
 *  measurement getting more honest rather than code getting better:
 *
 *    121  the contract's figure. The audit matched only three literal receiver
 *         names, so `const t = toolRef.current; t.width()` was invisible.
 *    162  after per-file alias resolution (+93 sites found, −some reclassified).
 *    164  v7.77 added engine reads in `useExport.ts`.
 *    166  after comment-stripping — the audit had been counting engine calls
 *         written inside comments, and prose near a site ("preview", "stroke")
 *         was classifying it as hot-path.
 *    171  after the consumed test moved to the AST. The single-line version
 *         read a call that merely STARTS a line as a bare statement, so any
 *         call formatted as an argument on its own line counted as
 *         fire-and-forget. Five sites had been invisible this way.
 *    168  a2 landed: six direct call sites became three inside
 *         `textMetricsCache.ts`.
 *    138  a3 landed: both save paths now read the document through ONE
 *         `capture_state()` call instead of ~32 separate reads, and the
 *         superseded `collectLayers` went with them. This is the first entry
 *         that is real work rather than the measurement catching up.
 *
 *  Only the last line is work. Measured both sides with the same audit against
 *  a worktree at HEAD, which is the only way to tell a real delta from a
 *  measurement change — the two had been tangled twice before. */
const BUDGET = 138;

const REPO = join(process.cwd(), "..");
const SRC = join(process.cwd(), "src");

interface Gate {
  total: number;
  valueConsumed: number;
  awaited: number;
  unawaited: number;
  restructure: number;
  truthy: number;
  remaining: number;
  remainingByFile: Record<string, number>;
  truthySites: string[];
}

const gate: Gate = JSON.parse(
  execFileSync("node", [join(REPO, "scripts/engine-call-audit.mjs"), "--json", REPO], {
    encoding: "utf8",
  }),
);

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e) && !/\.test\.tsx?$/.test(e) && !e.endsWith(".d.ts")) out.push(p);
  }
  return out;
}

const rel = (f: string) => f.split("/src/")[1] ?? f;

/** Comments stripped — same reasoning as the ownership contract: a guard that
 *  matches the identifier inside the comment explaining it is satisfied by its
 *  own documentation. */
const code = (f: string) =>
  readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const FILES = walk(SRC);

describe("Stage 3.5 — value-consuming engine calls become async", () => {
  it("the audit still finds the call sites at all", () => {
    // Guards against the ratchet passing because the script silently matched
    // nothing — a zero from a broken audit reads identically to a finished
    // migration, and that is the exact failure this arc keeps hitting.
    expect(gate.total, "audit found no engine call sites — the script is broken, not the code")
      .toBeGreaterThan(200);
    expect(gate.valueConsumed).toBeGreaterThan(0);
  });

  it(`has no more than ${BUDGET} unconverted value-consuming calls`, () => {
    const worstFiles = Object.entries(gate.remainingByFile)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([f, n]) => `  ${n}  ${f}`)
      .join("\n");
    expect(
      gate.remaining,
      `Unconverted value-consuming engine calls went UP (${gate.remaining} > ${BUDGET}).\n` +
        `A new synchronous value-consuming call was added. Await it, or convert it now.\n` +
        `Worst files:\n${worstFiles}`,
    ).toBeLessThanOrEqual(BUDGET);
  });

  it("the budget is not stale", () => {
    expect(
      gate.remaining,
      `Unconverted calls are down to ${gate.remaining} but BUDGET still says ${BUDGET}.\n` +
        `Lower BUDGET in this file to ${gate.remaining} so the progress is recorded.\n` +
        `When it reaches 0, Stage 3.5's structural gate is met.`,
    ).toBeGreaterThanOrEqual(BUDGET);
  });

  it("the bucket split matches the AST, not a pattern guess", () => {
    // QC's independent AST sweep, 2026-08-08, put the split at 61/81/24 on the
    // code as it stood then; a2 and the consumed fix moved it to 65/79/24. The
    // first version of `enclosingIsAsync` scanned lines backwards and got 18 of
    // 166 wrong — multi-line `async (` … `) => {` heads read as synchronous,
    // and an expired lookback returned null which fell through to "un-awaited",
    // so "couldn't tell" silently became "just add await". The script now
    // parses with the TypeScript compiler and agrees with that sweep exactly.
    //
    // Pinned because the split is what a3–a10 are scoped off. The gate total
    // survived the bug; the split did not, and sixteen sites wrongly filed as
    // "needs a restructure" is a fortnight of imaginary work.
    expect(gate.unawaited + gate.restructure + gate.truthy).toBe(gate.remaining);
    expect(
      gate.restructure,
      "needs-restructure moved. If real, update this and re-scope a3–a10; " +
        "if the classifier changed, check it against a parse before trusting it.",
    ).toBe(75);
    expect(gate.unawaited).toBe(39);
  });

  it("reports the truthy-trap sites so they are converted deliberately", () => {
    // Not bugs today. These feed conditions, so if one becomes a Promise
    // without `await` the test is permanently true and NOTHING catches it —
    // not tsc (a Promise is a fine `unknown`), not the existing suite. They are
    // listed rather than merely counted so a batch cannot sweep them by accident.
    expect(gate.truthySites.length).toBe(gate.truthy);
    for (const s of gate.truthySites) expect(s).toMatch(/^app\/src\/.+:\d+$/);
  });
});

// The flag belongs in `port.ts`. A caller that branches on it has re-exposed
// the choice Stage 3.5 exists to hide, and every such branch is a place the two
// implementations can quietly diverge.
//
// `featureFlags.ts` is allowlisted and is NOT a call site: it is the registry
// that lists all 11 flags for the dev flag panel, and it consumes
// `engineWorkerEnabled` as the `isOn` reader exactly like every other flag.
// The contract said "nothing consumes its return value"; the repo disagreed,
// and per the contract's own rule the repo wins.
const FLAG_READERS: Record<string, string> = {
  "lib/engine/port.ts": "owns the flag — this is where the local/worker choice belongs",
  "lib/featureFlags.ts": "the flag registry; surfaces ih_engine_worker in the dev panel like all 11",
};

describe("worker selection stays behind the port", () => {
  it("no call site branches on ih_engine_worker", () => {
    const readers = FILES.filter((f) =>
      /ih_engine_worker|engineWorkerEnabled/.test(code(f)),
    ).map(rel);
    const unexpected = readers.filter((f) => !(f in FLAG_READERS));
    expect(
      unexpected,
      "a module outside the port reads the engine-worker flag.\n" +
        "Stage 3.5's invariant is that callers use the async contract REGARDLESS of what is behind\n" +
        "the seam. If a caller has to know, the seam is not doing its job — fix the seam, not the caller.",
    ).toEqual([]);
  });

  it("every allowlisted flag reader still reads it", () => {
    // A stale allowlist silently permits a path that moved elsewhere.
    for (const [f, why] of Object.entries(FLAG_READERS)) {
      expect(why.length, `${f} needs a reason`).toBeGreaterThan(20);
      const full = FILES.find((x) => rel(x) === f);
      expect(full, `allowlisted ${f} no longer exists — drop it`).toBeTruthy();
      expect(
        /ih_engine_worker|engineWorkerEnabled/.test(code(full!)),
        `allowlisted ${f} no longer reads the flag — drop it from FLAG_READERS`,
      ).toBe(true);
    }
  });
});

// Deliberately overlaps `engineOwnership.contract.test.ts`. The contract lists
// this as one of the three properties Stage 3.5's guard must hold, and a test
// file should stand alone for the property it names — duplicated assertions are
// cheap, whereas a property nobody owns is how ONE PORT PER DOCUMENT erodes.
describe("throwaway engines stay off the live port", () => {
  const THROWAWAY = ["lib/exportImage.ts", "features/tools/settings/BatchSettings.tsx"];

  it("no throwaway document routes through attachLivePort", () => {
    for (const f of THROWAWAY) {
      const full = FILES.find((x) => rel(x) === f);
      expect(full, `${f} moved — update this list and engineOwnership.contract.test.ts together`)
        .toBeTruthy();
      expect(
        code(full!),
        `${f} calls attachLivePort — its ops would land in the LIVE document's op log, ` +
          "so undo would replay edits to a photo nobody opened",
      ).not.toContain("attachLivePort");
    }
  });
});
