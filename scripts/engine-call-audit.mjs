// Phase 2 — sync→async audit.
//
// Enumerates every call into the wasm engine from app/src and categorises it by
// what a worker migration would cost:
//   (a) fire-and-forget          — return value unused; a postMessage suffices
//   (b) value-consumed-sync      — the HARD ones; each needs a Promise + rewrite
//   (c) per-frame hot path       — round-trip latency is a design problem
//
// Method names come from the engine's own .d.ts rather than a hand-written list,
// so a method added to the engine cannot silently escape the audit.
//
// KNOWN REMAINING GAP (2026-08-08). Receivers are matched by name: the literal
// handles, plus locals bound from `toolRef.current` in the same file. An engine
// handle that arrives as a typed PARAMETER (`function f(t: ImageHorseTool)`) is
// only counted when that file happens to also bind an alias of the same name —
// true in editPersistence.ts, not guaranteed anywhere else. So these counts are
// a floor, not a total. Fixing it properly wants the TS type-checker, not a
// regex; until then, do not treat a file's absence here as proof it is clean.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { createRequire } from "node:module";

// argv may carry flags (`--samples`); the first NON-flag argument is the root.
const ROOT = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? process.cwd();

// `typescript` is declared in app/package.json, NOT at the repo root — a bare
// `import ts from "typescript"` here only works because pnpm happens to hoist
// it, and a stricter node-linker or a fresh install would break it. That would
// surface as a module-not-found inside
// `engineAsyncMigration.contract.test.ts`, which shells out to this script, so
// the whole suite would fail for a reason nothing on screen explains. Resolve
// it where it is actually declared instead of trusting the hoist.
const require_ = createRequire(import.meta.url);
const ts = (() => {
  // ROOT first (the tree being audited), then the SCRIPT's own checkout. The
  // second is not redundant: pointing this at a git worktree — the only honest
  // way to measure "what did that change actually move?" — gives a tree with
  // source but no `node_modules`, and the resolver has to fall back to the
  // checkout it was launched from.
  const here = new URL(".", import.meta.url).pathname;
  for (const dir of [join(ROOT, "app"), ROOT, join(here, "../app"), join(here, "..")]) {
    try {
      return require_(require_.resolve("typescript", { paths: [dir] }));
    } catch {
      /* try the next location */
    }
  }
  throw new Error(
    "engine-call-audit needs the TypeScript compiler to classify awaited call sites.\n" +
      "It is a devDependency of app/. Run `pnpm install` — do NOT add it at the root\n" +
      "just to satisfy this script.",
  );
})();
const DTS = join(ROOT, "app/src/hooks/stamp_tool.d.ts");
const SRC = join(ROOT, "app/src");

// --- engine surface -------------------------------------------------------
const dts = readFileSync(DTS, "utf8");
const methods = new Set(
  [...dts.matchAll(/^\s{4}([a-z_][a-z0-9_]*)\s*\(/gim)].map((m) => m[1]),
);
// getters/readonly props are reads too
for (const m of dts.matchAll(/^\s{4}(?:readonly\s+)?([a-z_][a-z0-9_]*)\s*:/gim)) {
  methods.add(m[1]);
}
methods.delete("constructor");

// --- files ----------------------------------------------------------------
function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e) && !/\.test\.tsx?$/.test(e) && !e.endsWith(".d.ts")) out.push(p);
  }
  return out;
}

// Files/functions where a round trip lands inside an interaction loop.
// `useSelectionActions` added 2026-08-09. Its `handleLassoMove` is bound to
// onLassoMove and its own comment says so: "recomputed on every mouse-move
// while a session is open. This is the interactive path... which is what keeps
// it inside a frame budget on a big image." Without it in this list, two
// per-pointermove calls (`lasso_active`, `lasso_path_to`) were classified as
// ordinary value-consumed work and would have been swept into the a5 batch.
// The contract puts hot-path sites LAST on purpose: an await on pointermove is
// a dropped frame, not a slower call, and they need their own reasoning.
/**
 * ⚠️ RETIRED 2026-08-10 (a8 scoping, second pass). Hot-path detection used to be
 * `HOT_FILE && HOT_CTX` — a hand-maintained FILE allowlist AND a keyword inside a
 * ±6-line window:
 *
 *   const HOT_FILE = /useDrawingTools|useCloneStamp|usePaintTool|.../;
 *   const HOT_CTX  = /pointermove|requestAnimationFrame|flushToCanvas|.../i;
 *
 * v7.97 fixed its FALSE NEGATIVES (six live per-mouse-move sites filed as
 * ordinary work). This removes it outright, because its FALSE POSITIVES were
 * worse: of the 21 sites it alone called hot, **19 were discrete once-per-gesture
 * actions** — `onMouseDown`, `onMouseUp`, `commitEdit`, `cancelEdit`, `applyCrop`,
 * `dropPin`, `clearCloneSource`, `selectShape`, `beginLayerResize`, `begin`,
 * `commit`, `cancel`, `handleSelectionClick`, `handleDeleteSelection`,
 * `handleNewLayerFromSelection`. They inherited "hot" purely from living in a
 * listed FILE with a listed word within six lines, and being parked in a10 hid
 * them from the a8 queue they belong in.
 *
 * A rule that is right 2 times out of 21 is not a heuristic, it is noise. It is
 * replaced by the enclosing-function-name test plus the small verified list
 * below.
 */
const HOT_BY_CALLER = {
  "app/src/hooks/usePastePlacementTool.ts::update":
    "wired as `onPastePlacementChange` and invoked from CanvasArea's `onMove` " +
    "PointerEvent listener — runs per pointermove while the paste box is dragged",
  "app/src/hooks/useMagicEraserTool.ts::pushOverlay":
    "called from inside `requestAnimationFrame` in `scheduleOverlay` — " +
    "rAF-throttled, once per frame for the whole magic-eraser stroke",

  // ── reached from `flushToCanvas` ACROSS A FILE BOUNDARY (found 2026-08-10) ──
  // These two are the reason the name test needs this list at all. Both live in
  // `lib/`, both have thoroughly ordinary names, and both are called from inside
  // `useEngineCore.flushToCanvas` — the per-frame blit — via an import:
  //
  //   flushToCanvas (useEngineCore.ts:300)  ->  syncOplog        (tilesFlush.ts)
  //   flushToCanvas (useEngineCore.ts:301)  ->  onOplogFlush     (oplogPersistence.ts)
  //                                              -> isLogTrustworthy
  //
  // Converting them makes the function async, and `flushToCanvas` consumes both
  // SYNCHRONOUSLY (`registerOplogStats(syncOplog(t))`), so it would hand a
  // Promise to a stats registrar and put a round trip on every frame.
  //
  // Nothing else could have caught this: the enclosing-name test only sees the
  // function's OWN name, and a caller in another module is invisible to it.
  // Found by tracing the call chain out of `flushToCanvas` by hand.
  "app/src/lib/tilesFlush.ts::syncOplog":
    "called from useEngineCore.flushToCanvas:300 — runs on every flush, and its " +
    "result is consumed synchronously by registerOplogStats",
  // Third cross-file case (2026-08-11). `HistogramView.sample()` calls this,
  // and `sample` runs inside a `requestAnimationFrame` retry loop
  // (HistogramView.tsx:213/223/233) that keeps trying until a valid histogram
  // is available for the new photo. So `calculate_histogram()` — a full pass
  // over the composite — is on a frame path, reached from another module.
  "app/src/app/session/useCanvasActions.ts::getHistogram":
    "called by HistogramView.sample(), which runs inside requestAnimationFrame " +
    "until the bars settle — a per-frame read of the whole composite",

  "app/src/lib/oplogPersistence.ts::isLogTrustworthy":
    "reached from useEngineCore.flushToCanvas:301 via onOplogFlush. NOTE it is " +
    "ALSO called from the async saveOplogInner, so the function cannot simply be " +
    "made async for that caller's benefit — the flush caller is the binding one",
};

/**
 * Hot-path detection by the ENCLOSING FUNCTION'S NAME (a8 scoping, 2026-08-10).
 *
 * WHY THIS EXISTS. `HOT_FILE && HOT_CTX` misfiled three different ways, and all
 * three were live per-mouse-move sites sitting in the ordinary a8 queue where
 * the next batch would have added an `await` to them:
 *
 *   1. HOT_FILE is a hand-maintained ALLOWLIST, and `AppShell.tsx` is not on
 *      it — so `blurMove`'s `effect_move` (the blur-brush drag) was ordinary
 *      even though its own line calls `flushToCanvas`, which HOT_CTX matches.
 *   2. HOT_CTX knows `pointermove` but not `mousemove`, so
 *      `useColorPicker.onMouseMove` and `useTextTool.onCanvasHover` missed.
 *   3. The ±6-line window cannot see the handler it is inside. In
 *      `handleLassoMove`, `lasso_active` (line 130) was ordinary and
 *      `lasso_path_to` (line 132) was hot — SAME FUNCTION, two lines apart.
 *      The only thing that made 132 hot is the substring "preview" inside
 *      `setLassoPreview`. Meanwhile the comment three lines above says
 *      "recomputed on every mouse-move ... inside a frame budget" — the one
 *      definitive piece of evidence, and unreadable here because comments are
 *      blanked before this test runs.
 *
 * TRAILING WORD-SEGMENT, NOT SUBSTRING, AND NOT ANY SEGMENT. Two false
 * positives had to be designed out, and both were caught by checking the moved
 * list rather than trusting the delta:
 *
 *   - Substring `/move/i` matches `removeLayer`, `removeShape`, `remove_layer`.
 *     So the name is split on camelCase and underscores and segments are
 *     matched whole — `remove` never reads as `move`.
 *   - ANY-segment matching then caught `moveLayer`, a discrete layer reorder
 *     from the layers panel that is already converted and is not a frame path.
 *     The difference is grammatical: in a hot handler the word is the trailing
 *     EVENT noun (`blurMove`, `onMouseMove`, `handleLassoMove`, `onCanvasHover`)
 *     while in `moveLayer` it is the leading VERB. Only the LAST segment counts.
 *
 * Known limit, stated rather than hidden: a hot handler whose name does not end
 * in one of these words (`onPointerMoveThrottled`) is missed by this test. That
 * is why HOT_CTX stays as a second, independent signal rather than being
 * replaced — neither is a superset of the other.
 */
const HOT_SEGMENT = /^(?:move|hover|drag|stroke|preview|scrub|pan)$/i;
function hotByName(name) {
  if (!name) return false;
  const segs = name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  return HOT_SEGMENT.test(segs[segs.length - 1] ?? "");
}

// Receivers this audit used to recognise. It only ever matched these three
// literal names, so `const t = toolRef.current; t.width()` — the dominant shape
// in useTransforms, editPersistence, useLayers and usePaintTool — was invisible.
// That hid 93 of 285 call sites (33%), and ADR-024 Stage 3.5 was scoped off the
// undercount. Local aliases are now resolved per file; see `aliasesIn`.
const LITERAL_RECEIVER = /^(?:toolRef\.current|hookResult\.toolRef\.current|tool|engine)$/;

/**
 * Blank out comments, preserving line COUNT and column positions.
 *
 * Found 2026-08-08 the honest way: a comment added to `port.ts` explaining the
 * alias problem contained the words `const t = toolRef.current; t.width()`, and
 * the audit counted it as a real call site — the total went 164 -> 165 and the
 * Stage 3.5 ratchet failed. Every count this script has ever printed included
 * whatever engine calls appeared in prose.
 *
 * Same failure `engineOwnership.contract.test.ts` guards against in its own
 * header: "an earlier guard in this repo passed against deleted code because it
 * matched the identifier inside the comment explaining the code — a test
 * satisfied by its own docs."
 *
 * Characters are replaced with spaces rather than removed so `file:line` stays
 * accurate and `line.slice(0, m.index)` still describes real syntax.
 */
function stripComments(text) {
  let out = "";
  let i = 0;
  let mode = "code"; // code | line | block | sq | dq | tpl
  while (i < text.length) {
    const c = text[i];
    const n = text[i + 1];
    const blank = c === "\n" ? "\n" : " ";
    if (mode === "code") {
      if (c === "/" && n === "/") { mode = "line"; out += "  "; i += 2; continue; }
      if (c === "/" && n === "*") { mode = "block"; out += "  "; i += 2; continue; }
      if (c === "'") mode = "sq";
      else if (c === '"') mode = "dq";
      else if (c === "`") mode = "tpl";
      out += c; i++; continue;
    }
    if (mode === "line") {
      if (c === "\n") { mode = "code"; out += "\n"; i++; continue; }
      out += " "; i++; continue;
    }
    if (mode === "block") {
      if (c === "*" && n === "/") { mode = "code"; out += "  "; i += 2; continue; }
      out += blank; i++; continue;
    }
    // inside a string literal: copy verbatim, honour escapes and terminators
    if (c === "\\") { out += c + (text[i + 1] ?? ""); i += 2; continue; }
    if ((mode === "sq" && c === "'") || (mode === "dq" && c === '"') || (mode === "tpl" && c === "`")) {
      mode = "code";
    }
    out += c; i++;
  }
  return out;
}

/** Names bound from the engine handle somewhere in this file. */
function aliasesIn(text) {
  const out = new Set();
  for (const m of text.matchAll(
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:[A-Za-z_$][\w$]*\.)?toolRef\.current/g,
  )) {
    out.add(m[1]);
  }
  return out;
}

// --- the AWAITED dimension (ADR-024 Stage 3.5 acceptance gate) -------------
//
// Category (a/b/c) says what a site COSTS to migrate. It does not say whether
// the migration has happened, and the two must not be conflated: the consumed
// test above treats `await` as one of the consuming contexts, so converting all
// of them leaves the value-consumed count exactly where it started. The gate is
// the un-awaited count going 164 -> 0, which needs its own axis.
//
// TWO TRAPS, both named in the Stage 3.5 contract, both reported separately
// because a miscounting audit is worse than none:
//
//   1. `if (t.width())` on a Promise is ALWAYS TRUTHY and compiles clean. tsc
//      cannot catch it — a Promise is a perfectly good `unknown` in a
//      condition. Flagged as `truthy-trap`, and it is the dangerous bucket:
//      the code is wrong rather than merely unconverted.
//   2. A call inside a NON-ASYNC callback cannot simply gain an `await`; the
//      callback has to be restructured first. That is a different, larger job
//      than adding a keyword, so it is `needs-restructure`, not `un-awaited`.
//
// Accuracy note, deliberately not papered over: enclosing-function detection is
// a backward scan for the nearest `function` / `=>` and whether `async` precedes
// it. It is a heuristic. It will misread deeply nested or oddly formatted
// callbacks. Widen it only from hand-checked false positives, the same standard
// the receiver regex was held to — a clean-looking number from a wrong method is
// the failure mode this whole axis exists to prevent.

/** Is the call at `before`…`match` directly awaited? */
function isAwaited(before) {
  // `await t.foo()`, `await (t.foo())`, `return await t.foo()`
  return /\bawait\s*\(?\s*$/.test(before);
}

/** Does this call feed a condition, where an un-awaited Promise is truthy? */
function inCondition(before, after) {
  if (/\b(?:if|while|switch)\s*\($/.test(before.replace(/\s+$/, "") + "")) return true;
  if (/\b(?:if|while)\s*\(\s*!?\s*$/.test(before)) return true;
  if (/[!]\s*$/.test(before)) return true;
  if (/\?\?|&&|\|\|/.test(before) && /\b(?:if|while|return|\?)/.test(before)) return true;
  // ternary test position: `cond ? a : b` where the call is before the `?`
  if (/^\s*\??\s*[:?]/.test(after)) return true;
  return false;
}

/**
 * Nearest enclosing function is `async`?
 *
 * PARSED, not pattern-matched. The first version of this scanned backwards for
 * a line that looked like a function head, and QC's AST sweep found it wrong on
 * **18 of 166 sites** — the gate total was right, the split was not:
 *
 *   un-awaited        47 reported / 61 true   (30% understated)
 *   needs-restructure 95 reported / 81 true   (17% overstated)
 *   truthy-trap       24 reported / 24 true   (clean)
 *
 * Two causes, both fatal to a backward line scan and neither fixable by
 * widening the regex:
 *
 *   1. A multi-line parameter list. `async (` opens on one line and `) => {`
 *      closes several lines later; the scan hit `) => {`, saw no `async` on
 *      THAT line, and declared the function synchronous. Sixteen sites,
 *      including all nine inside `savePhotoEdit`.
 *   2. The 60-line lookback expiring returned `null`, and `null` fell through
 *      to `un-awaited` — "couldn't tell" silently became "just add await".
 *
 * Both disappear against a real parse. `null` now means genuinely module top
 * level, where top-level await IS available, so it stays awaitable.
 *
 * Costs one `createSourceFile` per file (~30 files, unmeasurable next to the
 * regex sweep). Worth it: a3–a10 are scoped off this split, and sixteen sites
 * wrongly filed as "needs a restructure" is a fortnight of imaginary work.
 */
function asyncLookupFor(raw, filePath) {
  const sf = ts.createSourceFile(
    filePath,
    raw,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    /\.tsx$/.test(filePath) ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const isFunctionLike = (n) =>
    ts.isFunctionDeclaration(n) ||
    ts.isFunctionExpression(n) ||
    ts.isArrowFunction(n) ||
    ts.isMethodDeclaration(n) ||
    ts.isConstructorDeclaration(n) ||
    ts.isGetAccessor(n) ||
    ts.isSetAccessor(n);

  /** Innermost node containing `offset`. */
  function innermost(node, offset) {
    let hit = node;
    const visit = (n) => {
      if (offset < n.getStart(sf) || offset >= n.getEnd()) return;
      hit = n;
      ts.forEachChild(n, visit);
    };
    ts.forEachChild(node, visit);
    return hit;
  }

  const enclosingAsync = (offset) => {
    let n = innermost(sf, offset);
    while (n) {
      if (isFunctionLike(n)) {
        return Boolean(
          n.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.AsyncKeyword),
        );
      }
      n = n.parent;
    }
    return null; // module top level — top-level await is available here
  };

  /**
   * Name of the innermost NAMED function enclosing `offset`, or "" at module
   * top level.
   *
   * Added 2026-08-10 (a8 scoping). Hot-path classification used to be a
   * ±6-line text window plus a keyword list, and that produced three separate
   * misfilings — see HOT_NAME below. An arrow function assigned to a const
   * (`const onMouseMove = useCallback((e) => {...})`) carries its name on the
   * VariableDeclaration, not the arrow, so climb through the initializer
   * wrappers (`useCallback(...)`, parens) to find it.
   */
  const enclosingName = (offset) => {
    let n = innermost(sf, offset);
    while (n) {
      if (isFunctionLike(n)) {
        if (n.name && ts.isIdentifier(n.name)) return n.name.text;
        // Arrow/function expression: the name lives on an ancestor
        // VariableDeclaration or PropertyAssignment, possibly through a
        // `useCallback(` / `useMemo(` call wrapper.
        let up = n.parent;
        while (up) {
          if (ts.isVariableDeclaration(up) && ts.isIdentifier(up.name)) return up.name.text;
          if (ts.isPropertyAssignment(up) && ts.isIdentifier(up.name)) return up.name.text;
          if (ts.isFunctionDeclaration(up) || ts.isMethodDeclaration(up)) break;
          up = up.parent;
        }
        return "";
      }
      n = n.parent;
    }
    return "";
  };

  /**
   * Is the call at `offset` VALUE-CONSUMED?
   *
   * Was `!/^\s*(?:void\s+)?$/.test(textBeforeItOnThisLine)` — a single-line
   * test, and therefore blind in exactly the way the awaited axis was. A call
   * that merely *starts* a line reads as bare even when it is an argument to
   * something opened on the line above:
   *
   *     Array.from(
   *       tool.text_ink_offset_bg(text, size, bold, kind, pad),   // <- "bare"
   *     )
   *
   * Found while writing `textMetricsCache.ts`, whose own formatting produced
   * one. Consumed is now "the call is not the whole statement", asked of the
   * parse: walk out through parentheses and `as`/`!` wrappers to the first
   * meaningful parent, and it is fire-and-forget only if that is an
   * ExpressionStatement (or a `void` of one).
   */
  const isConsumed = (offset) => {
    let n = innermost(sf, offset);
    // Climb to the CallExpression the offset sits inside.
    while (n && !ts.isCallExpression(n)) n = n.parent;
    if (!n) return null;
    let cur = n;
    let parent = cur.parent;
    while (
      parent &&
      (ts.isParenthesizedExpression(parent) ||
        ts.isAsExpression(parent) ||
        ts.isNonNullExpression(parent) ||
        ts.isSatisfiesExpression?.(parent))
    ) {
      cur = parent;
      parent = cur.parent;
    }
    if (!parent) return true;
    if (ts.isExpressionStatement(parent)) return false;
    // `void tool.foo()` as a statement is a deliberate discard.
    if (
      ts.isVoidExpression(parent) &&
      parent.parent &&
      ts.isExpressionStatement(parent.parent)
    ) {
      return false;
    }
    return true;
  };

  return { enclosingAsync, isConsumed, enclosingName };
}

/** Byte offset of the start of each line, for line/col -> offset. */
function lineStarts(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === "\n") starts.push(i + 1);
  return starts;
}

const rows = [];
for (const file of walk(SRC)) {
  const rel = relative(ROOT, file);
  const raw = readFileSync(file, "utf8");
  const text = stripComments(raw);
  const lines = text.split("\n");
  // Snippets come from the ORIGINAL text so the report stays readable; only
  // matching runs against the stripped copy.
  const rawLines = raw.split("\n");
  const aliases = aliasesIn(text);
  // One parse per file. Comment-stripping preserves offsets, so a position
  // computed from the stripped copy indexes the original correctly.
  const { enclosingAsync: isAsyncAt, isConsumed, enclosingName } = asyncLookupFor(raw, file);
  const starts = lineStarts(raw);
  lines.forEach((line, i) => {
    // A call on the engine handle, by literal name OR via a local alias.
    const re = /([A-Za-z_$][\w$.]*)\??\.([a-z_][a-z0-9_]*)\s*\(/g;
    let m;
    while ((m = re.exec(line)) !== null) {
      const recv = m[1];
      const name = m[2];
      if (!methods.has(name)) continue;
      if (!LITERAL_RECEIVER.test(recv) && !aliases.has(recv)) continue;
      const before = line.slice(0, m.index);
      // Consumed if the call feeds an assignment, condition, return, arg, await,
      // property access, or template — i.e. anything but a bare statement.
      // AST first; the single-line test survives only as a fallback for a file
      // TypeScript could not parse (none today, but a silent crash here would
      // read as "everything is fire-and-forget", i.e. a passing gate).
      const offsetForNode = (starts[i] ?? 0) + m.index;
      const astConsumed = isConsumed(offsetForNode);
      const consumed =
        astConsumed === null ? !/^\s*(?:void\s+)?$/.test(before) : astConsumed;
      const ctx = lines.slice(Math.max(0, i - 6), i + 2).join("\n");
      // Name first; then the two verified exceptions the name cannot express.
      // Both are per-site facts checked by reading the CALLER, which is how
      // `update` and `pushOverlay` hid behind discrete-sounding names.
      const handlerName = enclosingName((starts[i] ?? 0) + m.index);
      const hot = hotByName(handlerName) || `${rel}::${handlerName}` in HOT_BY_CALLER;

      // --- awaited axis, orthogonal to the a/b/c category -------------------
      const after = line.slice(m.index + m[0].length);
      let awaited = "n/a"; // fire-and-forget needs no await
      if (consumed) {
        const offset = (starts[i] ?? 0) + m.index;
        if (isAwaited(before)) awaited = "awaited";
        else if (inCondition(before, after)) awaited = "truthy-trap";
        else if (isAsyncAt(offset) === false) awaited = "needs-restructure";
        else awaited = "un-awaited";
      }

      rows.push({
        awaited,
        file: rel,
        line: i + 1,
        method: name,
        category: hot ? "c-hot-path" : consumed ? "b-value-consumed" : "a-fire-and-forget",
        // The enclosing function's name, so the hot-path decision is auditable
        // from the JSON rather than only reproducible by re-running the regex.
        handler: enclosingName((starts[i] ?? 0) + m.index),
        snippet: (rawLines[i] ?? line).trim().slice(0, 110),
      });
    }
  });
}

// --- THE STAGE 3.5 GATE ----------------------------------------------------
// Printed first because it is the number the stage is accepted on, and because
// the category totals below deliberately do NOT move as conversions land.
const consumedRows = rows.filter((r) => r.category === "b-value-consumed");
const gate = {
  awaited: consumedRows.filter((r) => r.awaited === "awaited").length,
  unawaited: consumedRows.filter((r) => r.awaited === "un-awaited").length,
  restructure: consumedRows.filter((r) => r.awaited === "needs-restructure").length,
  truthy: consumedRows.filter((r) => r.awaited === "truthy-trap").length,
};
const remaining = gate.unawaited + gate.restructure + gate.truthy;

// `--json` prints ONLY this and exits. `engineAsyncMigration.contract.test.ts`
// consumes it, so the test and this script cannot drift into two different
// definitions of "converted" — there is one implementation and the test shells
// out to it rather than reimplementing the classification.
if (process.argv.includes("--json")) {
  console.log(
    JSON.stringify({
      total: rows.length,
      valueConsumed: consumedRows.length,
      ...gate,
      remaining,
      remainingByFile: consumedRows
        .filter((r) => r.awaited !== "awaited")
        .reduce((acc, r) => ((acc[r.file] = (acc[r.file] || 0) + 1), acc), {}),
      truthySites: consumedRows
        .filter((r) => r.awaited === "truthy-trap")
        .map((r) => `${r.file}:${r.line}`),
      // Handler names, so the contract test can assert the hot-path split in
      // BOTH directions: nothing per-move left in the ordinary queue, and no
      // discrete action dragged into the hot queue by a loose name match.
      remainingHandlers: consumedRows
        .filter((r) => r.awaited !== "awaited")
        .map((r) => `${r.file}:${r.line} ${r.handler}`),
      hotHandlers: rows
        .filter((r) => r.category === "c-hot-path")
        .map((r) => `${r.file}:${r.line} ${r.handler}`),
    }),
  );
  process.exit(0);
}

console.log("=".repeat(64));
console.log("ADR-024 STAGE 3.5 GATE — value-consumed sites not yet converted");
console.log("=".repeat(64));
console.log(`  REMAINING (the gate: this must reach 0)   ${String(remaining).padStart(4)}`);
console.log(`    un-awaited        (add await)           ${String(gate.unawaited).padStart(4)}`);
console.log(`    needs-restructure (non-async callback)  ${String(gate.restructure).padStart(4)}`);
console.log(`    truthy-trap       (feeds a condition)   ${String(gate.truthy).padStart(4)}  <-- highest risk to convert`);
console.log(`  already awaited                           ${String(gate.awaited).padStart(4)}`);
console.log("");

if (gate.truthy > 0) {
  // NOT bugs today — these are synchronous and correct. The bucket exists
  // because they are the conversions most likely to go wrong SILENTLY: make the
  // method return a Promise and forget the `await`, and the condition becomes
  // permanently true with no type error and no test failure. Convert these
  // deliberately and last within their file, never by sweep.
  console.log("TRUTHY-TRAP SITES — correct today; convert deliberately.");
  console.log("If one of these becomes a Promise without `await`, the test is always true");
  console.log("and neither tsc nor the existing tests can see it:");
  for (const r of consumedRows.filter((x) => x.awaited === "truthy-trap")) {
    console.log(`  ${r.file}:${r.line}  ${r.method}  |  ${r.snippet}`);
  }
  console.log("");
}

// `--samples` dumps a handful of sites per bucket. The awaited axis is a
// heuristic (see the header), so it has to stay spot-checkable by hand rather
// than trusted because the total looks plausible.
if (process.argv.includes("--samples")) {
  const buckets = {};
  for (const r of consumedRows) (buckets[r.awaited] ??= []).push(r);
  for (const [k, v] of Object.entries(buckets)) {
    console.log(`--- ${k} (${v.length}) ---`);
    for (const r of v.slice(0, 5)) {
      console.log(`   ${r.file}:${r.line}  |  ${r.snippet.slice(0, 84)}`);
    }
  }
  console.log("");
}

console.log("REMAINING BY FILE (un-awaited + restructure + truthy):");
const remByFile = {};
for (const r of consumedRows.filter((x) => x.awaited !== "awaited")) {
  remByFile[r.file] = (remByFile[r.file] || 0) + 1;
}
for (const [f, n] of Object.entries(remByFile).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(3)}  ${f}`);
}
console.log("");

// --- report ---------------------------------------------------------------
const byCat = {};
const byFile = {};
for (const r of rows) {
  byCat[r.category] = (byCat[r.category] || 0) + 1;
  byFile[r.file] ??= { a: 0, b: 0, c: 0 };
  byFile[r.file][r.category[0]]++;
}

console.log("ENGINE METHODS DECLARED:", methods.size);
console.log("TOTAL CALL SITES:", rows.length);
console.log("\nBY CATEGORY:");
for (const [k, v] of Object.entries(byCat).sort()) console.log(`  ${k.padEnd(20)} ${v}`);

console.log("\nBY FILE (a=fire-and-forget, b=value-consumed, c=hot-path):");
const files = Object.entries(byFile).sort((x, y) => (y[1].a + y[1].b + y[1].c) - (x[1].a + x[1].b + x[1].c));
for (const [f, c] of files) {
  console.log(`  ${String(c.a + c.b + c.c).padStart(3)}  a=${String(c.a).padStart(3)} b=${String(c.b).padStart(3)} c=${String(c.c).padStart(2)}  ${f}`);
}

console.log("\nTOP METHODS IN CATEGORY B (each needs a Promise + call-site rewrite):");
const bMethods = {};
for (const r of rows.filter((r) => r.category === "b-value-consumed")) {
  bMethods[r.method] = (bMethods[r.method] || 0) + 1;
}
for (const [m, n] of Object.entries(bMethods).sort((a, b) => b[1] - a[1]).slice(0, 25)) {
  console.log(`  ${String(n).padStart(3)}  ${m}`);
}

console.log("\nCATEGORY C — HOT PATH SITES:");
for (const r of rows.filter((r) => r.category === "c-hot-path")) {
  console.log(`  ${r.file}:${r.line}  ${r.method}`);
}
