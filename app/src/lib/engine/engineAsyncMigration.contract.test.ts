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
 *    125  a7 landed: `useLayers.ts` fully converted, 13 -> 0. Nine of those
 *         were truthy-trap guards (`if (t.remove_layer(id))`), which is why
 *         they were done deliberately as one file rather than swept.
 *    121  NOT work: `useSelectionActions` joined the audit's HOT_FILE list.
 *         Its `handleLassoMove` runs per pointermove — its own comment says
 *         "the interactive path... inside a frame budget" — so four sites
 *         moved from value-consumed to hot-path, where the contract puts them
 *         LAST on purpose. They were about to be swept into the a5 batch.
 *    117  a4 landed: `useExport.ts`'s two atomic captures, 6 sites -> 2.
 *         `capture_composite()` and `capture_thumbnail()` return pixels and the
 *         dimensions that describe them together. Small number, and that is the
 *         point — the ADR had already triaged this file as "do NOT convert
 *         individually", so the six were never six independent conversions.
 *    115  a4 continued: the ORA thumbnail, 3 sites -> 1, onto the same
 *         `capture_thumbnail()`. Done because tracing found `useExport`'s
 *         thumbnail half is UNREACHABLE (nothing has ever read
 *         `generateThumbnail`; `git log --all -G` is empty), so `openraster/
 *         export.ts` is the only place that call runs in production. The a4
 *         entry above is honest about the static count and this one is what
 *         makes it buy runtime safety.
 *
 *    103  a4 finished: the THIRD capture shape — the exclude-background
 *         composite — plus AppShell's `persistActiveCanvas`. Six sites of three
 *         reads became six of one, across `useCanvasActions` (clipboard +
 *         export), `AppShell` (ShareButton + persistActiveCanvas) and
 *         `exportImage` (both branches). Biggest single drop that is real work.
 *         Unlike the other two captures this one is also a WORK fix: each of
 *         the three `*_excluding_background` getters recomputed the whole
 *         composite, its tight bbox and the crop, so the split form did all of
 *         that three times to answer one question.
 *
 *     94  a5 landed: `useEngineCore`'s `syncState` — the eleven reads React
 *         renders from — became one `capture_ui_state()`. Same ATOMIC CAPTURE
 *         family as a3/a4: they are assembled into one object and handed to one
 *         `setState`, so split behind the worker React would render a snapshot
 *         that never existed. `syncState` has 74 call sites, so this is also
 *         eleven boundary crossings per edit reduced to one.
 *
 *         ⚠️ THE ARITHMETIC IS 10, NOT 11, AND THE MISSING ONE IS AN AUDIT
 *         BLIND SPOT — see the note below. 103 - 10 + 1 = 94.
 *
 *     93  housekeeping: `useExportDimensions` — the Share button's size label —
 *         moved onto `export_dims_excluding_background()`. Only 2 -> 1 on the
 *         counter, but the point was never the counter: each of the two getters
 *         it replaced ran a whole `composite_excluding_background()` internally
 *         and kept one integer, so a caption cost two full-document composites.
 *
 *     92  a7 landed (half): AppShell's pen re-edit hit-test. Only 2 -> 1, and
 *         deliberately small — a7's OTHER named site, `useTextTool`'s
 *         apparently identical hit-test-then-look-up, turned out NOT to be an
 *         atomic capture at all and was withdrawn rather than converted.
 *         `commitText()` MUTATES between its two reads, on purpose, and its
 *         `find` returning undefined is a handled case rather than a silent
 *         failure. Two sites with the same read sequence are not the same
 *         problem; what sits between the reads is part of the pattern.
 *
 *     87  a7 finished: both `openraster/export.ts` captures, 7 sites -> 2, onto
 *         a new `capture_layer_stack()`. NOT `capture_ui_state()`, which would
 *         have needed no new engine code: that one answers `has_transparency`
 *         with `get_image_data()`, a full composite of the document allocated
 *         and scanned, which an `.ora` export that already encodes every layer
 *         separately has no use for. Split by cost, not by naming.
 *
 *         This does NOT make `exportOra` atomic and must not be read as having
 *         done so — the `await import("jszip")` still separates the metadata
 *         from the layer PNGs, and the file still mutates mid-export. Both are
 *         pre-existing and triaged in ADR-024; both stay open.
 *
 *  Work: the 138, 125, 117, 115, 103, 94, 93, 92 and 87 lines. The rest is the
 *  measurement catching up.
 *
 *  THE THIRD FORMATTING BLIND SPOT (found during a5, 2026-08-09). The audit
 *  matches an engine call's RECEIVER with a regex, so a call whose receiver and
 *  method sit on different lines is invisible to it:
 *
 *      const history = t
 *        .history_labels()      // <- never counted
 *
 *  That is the same failure family as the two already recorded above — the
 *  alias undercount that hid 93 sites, and the multi-line `async (` head that
 *  misfiled 16. Formatting defeats detection, three times now.
 *
 *  Scale, measured rather than assumed: a scan of every .ts/.tsx under app/src
 *  at 63e4239, comments stripped, receiver on one line and a d.ts-declared
 *  method on the next, found **exactly one** instance — this one. So the gate
 *  was under-reporting by 1, not by a fraction, and it is now 0 because a5
 *  removed it. `no_multiline_engine_calls` below keeps it that way.
 *  Measured both sides with the same audit against a worktree at HEAD, which is
 *  the only way to tell a real delta from a measurement change — the two had
 *  been tangled twice before. */
const BUDGET = 87;

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
    //
    // a4 moved both buckets by 2, and the arithmetic is worth writing down
    // because it is the check that the drop is real work and not a classifier
    // wobble. `exportBlob`'s three reads sat in an async callback, so they were
    // un-awaited (39 − 3 + 1 `capture_composite` = 37); `generateThumbnail`'s
    // three sat in a synchronous one, so they were restructure (71 − 3 + 1
    // `capture_thumbnail` = 69). Six out, two in, both buckets −2, gate −4.
    // The ORA thumbnail then took un-awaited 37 − 3 + 1 = 35 (it sits in an
    // async function, so all three were in that bucket), leaving restructure
    // untouched at 69. Gate 117 − 2 = 115.
    // a4's final batch: five async sites (exportImage ×2, useCanvasActions ×2,
    // persistActiveCanvas) took un-awaited 35 − 10 = 25; ShareButton's
    // non-async arrow took restructure 69 − 2 = 67. Gate 115 − 12 = 103.
    // a5: `syncState` is a non-async `useCallback`, so all of its sites were
    // restructure. Ten counted out, one `capture_ui_state` in: 67 - 10 + 1 = 58.
    // un-awaited is untouched at 25 — a5 converted nothing in an async context.
    // useExportDimensions' effect is a non-async callback, so its two sites
    // were restructure: 58 - 2 + 1 = 57. un-awaited untouched at 25.
    // a7: `handlePenHitTest` is a non-async `useCallback`, so both of its sites
    // (`shape_annotation_at` + `get_shape_annotations`) were restructure, and
    // the `capture_pen_hit` replacing them lands in the same bucket:
    // 57 - 2 + 1 = 56. un-awaited untouched at 25 — that half of a7 converted
    // nothing in an async context.
    // a7's openraster half splits across BOTH buckets, which is the check that
    // it is real work: `flattenAllLayersInPlace` is a plain sync function, so
    // its three reads were restructure (56 - 3 + 1 `capture_layer_stack` = 54);
    // `exportOra` is `async`, so its four were un-awaited
    // (25 - 4 + 1 = 22). Seven out, two in, gate 92 - 5 = 87.
    ).toBe(54);
    expect(gate.unawaited).toBe(22);
  });

  it("has no engine call the audit cannot see (multi-line receiver)", () => {
    // THE AUDIT'S THIRD FORMATTING BLIND SPOT, found during a5. It matches a
    // call's receiver with a regex, so this is invisible to it and silently
    // absent from the gate:
    //
    //     const history = t
    //       .history_labels()
    //
    // The gate is the whole point of Stage 3.5, and a gate that under-reports
    // is worse than no gate — the same lesson as the alias undercount (93
    // sites) and the multi-line `async (` head (16 misfiled). Rather than
    // widen the audit's regex and shift every pinned number at once, this
    // asserts the blind spot stays EMPTY. It was 1 before a5 and is 0 now.
    //
    // If this fails: either reformat the call onto one line, or teach
    // `engine-call-audit.mjs` to resolve receivers through the AST and re-pin
    // every count in this file deliberately. Do not just delete the test.
    const declared = new Set(
      [...readFileSync(join(SRC, "hooks/stamp_tool.d.ts"), "utf8").matchAll(
        /^\s+([a-z_][a-z0-9_]*)\(/gm,
      )].map((m) => m[1]),
    );
    const multiline =
      /(?:toolRef\.current|\bt|\btool|\bengine)\s*\n\s*\.([a-z_][a-z0-9_]*)\s*\(/g;

    const offenders: string[] = [];
    for (const f of FILES) {
      for (const m of code(f).matchAll(multiline)) {
        if (declared.has(m[1])) offenders.push(`${rel(f)} -> .${m[1]}()`);
      }
    }

    expect(
      offenders,
      `Engine call(s) split across lines, which the audit's receiver regex ` +
        `cannot match — so they are missing from the gate count (${gate.remaining}) ` +
        `and would be migrated by nobody:\n  ${offenders.join("\n  ")}`,
    ).toEqual([]);
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
