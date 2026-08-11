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
 *     81  NOT work — the measurement getting more honest, and in the direction
 *         that matters most: six live PER-MOUSE-MOVE sites were sitting in the
 *         ordinary queue, where the next batch would have added an `await` to a
 *         frame path. Hot-path detection was `HOT_FILE && HOT_CTX` — a
 *         hand-maintained file allowlist AND a keyword inside a ±6-line window
 *         — and it failed three separate ways at once:
 *           1. the allowlist omits AppShell, so `blurMove`'s blur-brush drag
 *              was ordinary despite its own line calling `flushToCanvas`;
 *           2. HOT_CTX knows `pointermove` but not `mousemove`, missing
 *              `useColorPicker.onMouseMove` and `useTextTool.onCanvasHover`;
 *           3. the window cannot see the handler it is inside, so ONE function
 *              was split across two categories twice over — `handleLassoMove`
 *              (130 ordinary, 132 hot) and `usePaintTool.onMouseMove` (138/140
 *              ordinary, 141 hot). The only thing that made 132 hot was the
 *              substring "preview" inside `setLassoPreview`.
 *         Now also classified by the ENCLOSING FUNCTION NAME from the AST the
 *         audit already parses. See `hotByName` for why it matches the TRAILING
 *         camelCase segment only: any-segment matching pulled in `moveLayer`, a
 *         discrete layers-panel reorder, where `move` is the leading verb.
 *
 *     76  a8 batch 1 — `useHistory.ts` fully converted, 5 -> 0. FOUR of the five
 *         are truthy traps (`if (toolRef.current?.undo())`), the same shape as
 *         `useLayers.ts` and the reason both files were done as a unit rather
 *         than swept: drop one `await` and the condition is permanently true,
 *         so every Ctrl+Z repaints and re-syncs whether or not anything was
 *         undone, with nothing to catch it. The fifth is `selection_overlay`
 *         inside `refreshSelectionMask`.
 *
 *     74  a8 batch 2: `loadImageFromPixels`'s two `width`/`height` reads, which
 *         sit in an already-`async` function so they needed only the `await`.
 *         The `canvas.width =` ASSIGNMENTS they feed are Stage 4's problem, not
 *         this stage's — after `transferControlToOffscreen()` they throw on the
 *         main thread. Awaiting the read is orthogonal to that.
 *
 *     80  NOT work, and the number went UP — the measurement getting honest in
 *         the OTHER direction. v7.97 fixed the hot-path rule's false negatives;
 *         this retires the rule for its false positives. Of the 21 sites
 *         `HOT_FILE && HOT_CTX` alone called hot, **19 were discrete
 *         once-per-gesture actions** (`onMouseDown`, `onMouseUp`, `commitEdit`,
 *         `cancelEdit`, `applyCrop`, `dropPin`, `clearCloneSource`,
 *         `selectShape`, `beginLayerResize`, `begin`, `commit`, `cancel`,
 *         `handleSelectionClick`, `handleDeleteSelection`,
 *         `handleNewLayerFromSelection`) parked in a10 where a8 could not see
 *         them. A rule right 2 times out of 21 is noise, not a heuristic.
 *         Six of the nineteen were value-consumed and unconverted, so the gate
 *         rose 74 -> 80; the other thirteen are fire-and-forget. Hot 32 -> 13.
 *
 *     77  a8 batch 3: `useTransforms.ts` 3 -> 0 — `copyRegion`, and the
 *         post-flip `width`/`height` reads that mirror the clone source. Those
 *         two reads sit AFTER their mutation deliberately and must stay there;
 *         ordering survives the worker because the port is FIFO.
 *
 *     73  NOT work — scoping again, and a new SHAPE of miss. Four sites sit in
 *         `lib/tilesFlush.ts` and `lib/oplogPersistence.ts` under thoroughly
 *         ordinary names (`syncOplog`, `isLogTrustworthy`) and are called from
 *         inside `useEngineCore.flushToCanvas` — the per-frame blit — ACROSS A
 *         FILE BOUNDARY via an import. The enclosing-name test only ever sees a
 *         function's OWN name, so a hot caller in another module is invisible to
 *         it. `flushToCanvas` consumes `syncOplog(t)` synchronously, so
 *         converting it would have handed a Promise to a stats registrar and put
 *         a round trip on every frame. Found by tracing the call chain out of
 *         `flushToCanvas` by hand.
 *
 *     67  a8 batch 4: `useExport.ts` 4 -> 0 and `lib/exportImage.ts` 2 -> 0.
 *         PARKING_LOT records `useExport` as four-fifths unreachable (only
 *         `exportBlob` has a caller), and the pickaxe agrees — `.exportPng(`,
 *         `.generateThumbnail(` and `.generateThumbnailUrl(` return NO commits
 *         against a working control of 5 for `.exportBlob(`. Converted anyway
 *         so the file is not left half-done, but the live value is `exportBlob`
 *         (share + download) and `compositeSavedEdit` (batch export).
 *         `generateThumbnailUrl` needed a RESTRUCTURE, not an await: it called
 *         `generateThumbnail` inside a manual `new Promise` executor, where an
 *         async callee turns `if (!thumb)` into a truthy trap.
 *
 *     63  a8 batch 5: `useCanvasActions` 4 -> 0, but only THREE are work — the
 *         clipboard copy's two reads and the export capture. The fourth,
 *         `getHistogram`, is a RECLASSIFICATION: `HistogramView.sample()` calls
 *         it from inside a `requestAnimationFrame` retry loop, so a full
 *         composite pass runs per frame. Third cross-file hot caller found this
 *         way, after `syncOplog` and `isLogTrustworthy`.
 *
 *     59  a8 batch 6: the four single-site files whose enclosing function was
 *         ALREADY `async`, plus `TextSettings.runOcrJob`. Nothing clever —
 *         `copy_region_composited` (Copy Selection), `capture_state` ×2 (both
 *         save paths, hook and lib), `export_png` (OCR). Picked deliberately as
 *         the batch with no restructuring in it, to leave the night's budget
 *         for the three single-site files that DO need it.
 *
 *     56  a8 batch 7: the last three single-call files, and the three that
 *         needed the restructuring batch 6 deliberately avoided.
 *         `useExportDimensions`'s effect callback cannot be `async` (React
 *         would read the Promise as its cleanup), so it became an async IIFE
 *         with a cancellation flag — load-bearing, because its deps refire on
 *         every bbox-moving edit and the result is persisted to the Convex
 *         `shares` table. `useColorPicker` and `useCloneStamp` had to go
 *         TOGETHER: `Stamp = ReturnType<typeof useCloneStamp>`, so both
 *         handlers feed the same `Stamp["onMouseDown"]` slot and converting
 *         either alone breaks the other's cast. `useCloneStamp`'s was also a
 *         truthy trap — `if (!t.has_source())`.
 *
 *  Work: the 138, 125, 117, 115, 103, 94, 93, 92, 87, 76, 74, 77, 67, 63, 59 and 56 lines. The
 *  rest is the measurement catching up — in BOTH directions, and the upward
 *  moves matter just as much: a8 could not have been scoped off 74.
 *
 *  ⚠️ THE GATE'S TARGET IS 5, NOT 0 — see `DISSOLVES_AT_STAGE_4` below.
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
const BUDGET = 56;

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
  remainingHandlers: string[];
  hotHandlers: string[];
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
    // a8 scoping: six sites left the value-consumed bucket entirely for
    // hot-path. Four were in non-async handlers (restructure 54 - 4 = 50) and
    // two were truthy traps (11 - 2 = 9). un-awaited is untouched at 22 — none
    // of the six sat in an async function. Gate 87 - 6 = 81, and this is a
    // RECLASSIFICATION, not a conversion: no call site changed.
    // a8 batch 1 (useHistory): one `selection_overlay` in a non-async
    // `useCallback` leaves restructure (50 - 1 = 49); the four truthy traps
    // leave truthy (9 - 4 = 5). un-awaited untouched at 22 again, and `awaited`
    // rises 13 -> 18. Gate 81 - 5 = 76.
    // a8 batch 2: `loadImageFromPixels` is already `async`, so its two reads
    // were un-awaited (22 - 2 = 20). restructure and truthy untouched.
    // Gate 76 - 2 = 74.
    // a8 scoping pass 2: 19 discrete sites left hot-path and re-entered the
    // value-consumed bucket. Six were unconverted — four truthy traps
    // (5 + 4 = 9) and two in non-async callbacks (49 + 2 = 51) — and thirteen
    // were fire-and-forget, which the gate never counted. un-awaited and
    // awaited both untouched. Gate 74 + 6 = 80.
    // a8 batch 3 (useTransforms): all three sat in non-async callbacks, so they
    // came out of restructure (51 - 3 = 48). un-awaited and truthy untouched;
    // awaited 20 -> 23. Gate 80 - 3 = 77.
    // a8 scoping pass 3: four sites reached from `flushToCanvas` ACROSS a file
    // boundary (`syncOplog`, `isLogTrustworthy`) moved to hot-path. All four sat
    // in plain functions, so restructure 48 - 4 = 44. Gate 77 - 4 = 73.
    // a8 batch 4: `useExport` 4 -> 0 and `exportImage` 2 -> 0. Four sat in
    // already-async functions (un-awaited 20 - 4 = 16) and two in non-async
    // callbacks (restructure 44 - 2 = 42). awaited 23 -> 29. Gate 73 - 6 = 67.
    // a8 batch 5: `useCanvasActions` 4 -> 0. THREE were conversions (clipboard
    // x2 + export, all in already-async functions: un-awaited 16 - 3 = 13,
    // awaited 29 -> 32) and ONE was a reclassification — `getHistogram` is
    // called by HistogramView.sample() inside a requestAnimationFrame loop, so
    // it left restructure for hot-path (42 - 1 = 41). Gate 67 - 4 = 63.
    // a8 batch 6: four single-site files. THREE sat in already-async functions
    // (`handleCopyRegion`, and `savePhotoEdit` in both useEditPersistence and
    // lib/editPersistence): un-awaited 13 - 3 = 10. ONE was a non-async arrow
    // (`TextSettings.runOcrJob`, an onClick): restructure 41 - 1 = 40. truthy
    // untouched at 9 — none of the four fed a condition. awaited 32 -> 36.
    // Gate 63 - 4 = 59, and 10 + 40 + 9 = 59.
    // a8 batch 7: the three single-call files that needed restructuring. NONE
    // sat in an already-async function, so un-awaited is untouched at 10 — the
    // whole batch came out of the other two buckets. `useExportDimensions`'s
    // effect and `useColorPicker.onMouseDown` were non-async callbacks
    // (restructure 40 - 2 = 38); `useCloneStamp`'s `has_source()` fed an `if`
    // (truthy 9 - 1 = 8). awaited 36 -> 39. Gate 59 - 3 = 56, and
    // 10 + 38 + 8 = 56.
    ).toBe(38);
    expect(gate.unawaited).toBe(10);
    expect(gate.truthy).toBe(8);
    expect(gate.awaited, "cumulative converted sites").toBe(39);
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

  // ── the hot-path split, pinned in BOTH directions (a8 scoping) ────────────
  //
  // The gate reaching 0 means "every ordinary value-consuming call is async".
  // That is only meaningful if the ordinary/hot split is right, and it was
  // wrong six times — always in the dangerous direction, leaving a live
  // per-mouse-move site in the queue for the next batch to `await`.
  const lastSegment = (name: string) =>
    (name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").split(/[^A-Za-z0-9]+/).filter(Boolean).pop() ??
      "").toLowerCase();
  const HOT_WORDS = ["move", "hover", "drag", "stroke", "preview", "scrub", "pan"];
  const handlerOf = (row: string) => row.split(" ").slice(1).join(" ");

  it("leaves no per-move handler in the ordinary queue", () => {
    // Direction 1 — the one that can do harm. An `await` added to a handler
    // that runs on every mouse-move is a dropped frame, which is precisely why
    // ADR-024 puts hot-path sites LAST (a10).
    const stragglers = gate.remainingHandlers.filter((r) =>
      HOT_WORDS.includes(lastSegment(handlerOf(r))),
    );
    expect(
      stragglers,
      "these run per pointer-move but are queued as ordinary a8 work",
    ).toEqual([]);
  });

  // ── the gate's target is 5, not 0 ────────────────────────────────────────
  //
  // ADR-024 says two things that cannot both be true, and this is where they
  // meet:
  //
  //   Stage 3.5  "Until these are done the Stage 3 flag can never be turned
  //              on" — i.e. the gate must reach 0, and Stage 4 is now gated on
  //              Stage 3.5 alone.
  //   Triage     "`flushToCanvas`'s remaining reads dissolve at Stage 4 and
  //              must NOT be converted."
  //
  // So five sites sit inside the gate, can only leave it when Stage 4 lands,
  // and Stage 4 waits on the gate. Left implicit, that deadlock does not just
  // stall — it PRESSURES. A future session grinding toward zero meets five
  // stubborn sites in `flushToCanvas` and converts them to finish the job,
  // which puts an `await` on the per-frame blit: the exact regression this
  // whole arc exists to prevent, and the same shape as the six per-mouse-move
  // sites v7.97 pulled back out of the queue.
  //
  // Naming them makes the target reachable AND makes converting them fail
  // loudly instead of looking like progress.
  //
  // Keyed by FILE + HANDLER, never by line number: line numbers drift with
  // every edit above them, and a stale allowlist entry that silently stops
  // matching is worse than no allowlist.
  const DISSOLVES_AT_STAGE_4: Record<string, string> = {
    "app/src/hooks/useEngineCore.ts::flushToCanvas":
      "the per-frame blit. Under Option A the canvas moves INTO the worker, so " +
      "this path stops crossing the boundary at all — it dissolves rather than " +
      "converting. Converting it instead adds a round trip per frame.",
  };
  const EXEMPT_TOTAL = 5;

  const keyOf = (row: string) => {
    const [site, ...rest] = row.split(" ");
    return `${site.replace(/:\d+$/, "")}::${rest.join(" ")}`;
  };

  it("the Stage-4 exempt sites are all still present and still unconverted", () => {
    // If this fails LOW, someone converted `flushToCanvas` — read the reason
    // above before "fixing" the number. It is not progress.
    const exempt = gate.remainingHandlers.filter((r) => keyOf(r) in DISSOLVES_AT_STAGE_4);
    expect(
      exempt.length,
      "flushToCanvas's reads must stay UNCONVERTED until Stage 4 dissolves them — " +
        `converting them puts an await on the per-frame blit.\n${Object.entries(
          DISSOLVES_AT_STAGE_4,
        )
          .map(([k, why]) => `  ${k}\n    ${why}`)
          .join("\n")}`,
    ).toBe(EXEMPT_TOTAL);
  });

  it("has a reachable target: the gate bottoms out at the Stage-4 floor", () => {
    // THE NUMBER THAT ACTUALLY MATTERS. `BUDGET` counts everything still
    // un-awaited; this is the part a8/a9 can actually act on. Stage 3.5 is
    // done when this reaches 0 — not when BUDGET does, which it cannot.
    const convertible = gate.remaining - EXEMPT_TOTAL;
    expect(convertible, "convertible work left in Stage 3.5").toBe(BUDGET - EXEMPT_TOTAL);
    expect(gate.remaining).toBeGreaterThanOrEqual(EXEMPT_TOTAL);
  });

  it("every allowlist entry still matches something", () => {
    // Guards the allowlist itself. An entry that stops matching — because the
    // handler was renamed or the file moved — would silently grant a blanket
    // exemption to nothing while the real sites drift back into the count.
    for (const key of Object.keys(DISSOLVES_AT_STAGE_4)) {
      expect(
        gate.remainingHandlers.some((r) => keyOf(r) === key),
        `stale allowlist entry: ${key} matches no remaining call site`,
      ).toBe(true);
    }
  });

  it("the hot queue holds only per-move handlers and verified exceptions", () => {
    // The anti-regression for the bug this pass fixed. a10 is where work goes
    // to be done LAST, so anything parked there is invisible to a8 — and 19
    // discrete actions sat there because they happened to live in a listed file
    // near a listed word. Getting into the hot queue now requires either a name
    // that ends in a per-move word, or an explicit entry in the audit's
    // `HOT_BY_CALLER` justified by reading the CALLER.
    //
    // Both exceptions hid behind discrete-sounding names, which is exactly why
    // a name test alone is not enough:
    //   update()      <- CanvasArea's `onMove` PointerEvent listener
    //   pushOverlay() <- inside requestAnimationFrame, per frame while painting
    const exceptions = [
      ...new Set(
        gate.hotHandlers
          .map(handlerOf)
          .filter((h) => !HOT_WORDS.includes(lastSegment(h))),
      ),
    ].sort();
    expect(
      exceptions,
      "a handler reached the hot queue without a per-move name — justify it in " +
        "HOT_BY_CALLER by reading its caller, or it belongs in a8",
    ).toEqual(["getHistogram", "isLogTrustworthy", "pushOverlay", "syncOplog", "update"]);
  });

  it("does not drag a discrete action into the hot queue on a name match", () => {
    // Direction 2 — the false positive designed out of `hotByName`. `moveLayer`
    // is a layers-panel reorder: `move` is the leading VERB, not a trailing
    // event noun. Loosening the match to any segment pulls it in, which would
    // quietly park finished work in a10 and flatter the gate.
    const dragged = gate.hotHandlers.filter((r) => handlerOf(r) === "moveLayer");
    expect(dragged, "moveLayer is a discrete reorder, not a frame path").toEqual([]);
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
