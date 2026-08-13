// ADR-024 Stage 1 — the ownership guard.
//
// Stage 1's deliverable is NOT the port module. It is this: the test that fails
// when something reaches the live engine outside the one owner. ADR-024 says
// why in one line — "two ports, or any path that reaches the engine outside the
// queue, and that guarantee is gone SILENTLY". The failure mode is not a crash,
// it is an undo stack that quietly stops reproducing, which is the hardest kind
// of bug to attribute months later.
//
// Source-level on purpose. A second owner is not a wrong value yet; it is a
// wrong value waiting for someone to add a call. Behaviour cannot see it, and
// by the time behaviour can, the arc is already built on top. Same reasoning as
// `toolSurfaces.contract.test.ts`, which caught the toolbar drift's cause
// rather than its symptom.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// ⚠️ ANCHORED ON THIS FILE, NEVER ON THE LAUNCH DIRECTORY (v8.30). A source-walking
// guard that resolves relative to the launch directory reads ZERO files when
// vitest is started from the repo root — `<repo>/src` is the Rust crate and has
// no `.ts` in it — so `walk()` returns an empty list and every assertion over it
// passes VACUOUSLY. Verified by planting a real violation: from the repo root
// the guard stayed green; from `app/` it caught it.
const APP_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const SRC = join(APP_ROOT, "src");

/** Every .ts/.tsx under app/src, excluding specs. */
function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e) && !/\.test\.tsx?$/.test(e) && !e.endsWith(".d.ts")) out.push(p);
  }
  return out;
}

const rel = (f: string) => f.split("/src/")[1] ?? f;

/** Comments are stripped before every check below. An earlier guard in this
 *  repo passed against deleted code because it matched the identifier inside
 *  the comment explaining the code — a test satisfied by its own docs. */
const code = (f: string) =>
  readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const FILES = walk(SRC);

describe("only useEngineCore owns the live engine handle", () => {
  it("is the only module that assigns toolRef.current", () => {
    const writers = FILES.filter((f) => /toolRef\.current\s*=[^=]/.test(code(f))).map(rel);
    expect(writers, "a second writer to the live handle — see ADR-024's ONE PORT invariant")
      .toEqual(["hooks/useEngineCore.ts"]);
  });

  it("never assigns a raw engine — every live handle comes from the factory", () => {
    const src = code(join(SRC, "hooks/useEngineCore.ts"));
    // Each `toolRef.current = <expr>` must be null (reset) or the port call.
    //
    // `(?!=)` matters — without it this reads a COMPARISON as an assignment.
    // a13's liveness guard (`() => toolRef.current === t`) was the first code in
    // the repo to compare against the live handle, and it failed this test with
    // "unrouted assignment: toolRef.current = == t)": the regex matched the
    // first `=` of `===` and captured the rest of the line. The sibling check
    // above already had `=[^=]` for exactly this reason; this one did not, and
    // nothing had exercised the difference in the eight months it existed.
    const assigns = [...src.matchAll(/toolRef\.current\s*=(?!=)\s*([^;]+);/g)].map((m) =>
      m[1].trim(),
    );
    expect(assigns.length, "expected the known assignment sites").toBeGreaterThan(0);
    // ⚠️ v8.24 — THE ROUTE CHANGED, AND SO DID WHAT THIS CAN CHECK.
    //
    // This used to require `attachLivePort(...)` literally. That function could
    // never have been the swap point: it receives an engine already built and
    // image-loaded on the main thread, and a worker cannot adopt that handle
    // (`docs/engine-worker-a12-design.md`). Construction moved into
    // `createLiveEngine()`, so the assignments now read `= tool` where `tool`
    // came from an awaited factory call.
    //
    // A name check on the right-hand side would therefore be worthless — `tool`
    // is just an identifier. What still has teeth is the OTHER test below:
    // nothing outside the declared owners may call `new Tool(...)` at all, so an
    // unrouted handle cannot exist to be assigned. This one keeps the weaker but
    // still real guarantee that no assignment is a bare construction.
    for (const a of assigns) {
      expect(a, `an engine constructed inline at the assignment: toolRef.current = ${a}`)
        .not.toMatch(/new\s+(?:mod\.)?(?:ImageHorseTool|Tool)\s*\(/);
    }
  });
});

// The allowlist is the interesting part of this file, not a footnote.
//
// A throwaway engine is a SEPARATE DOCUMENT — a photo the user is not looking
// at, rendered on the side. Its ops must never enter the live document's op
// log, and it must never queue behind the live port. Both entries below are
// correct and must keep working; the guard exists so a THIRD one is a decision
// somebody makes on purpose rather than a line somebody adds.
const THROWAWAY_ENGINES: Record<string, string> = {
  "lib/exportImage.ts":
    "compositeSavedEdit — rebuilds a saved edit's layer stack to render one photo during a batch export",
  "features/tools/settings/BatchSettings.tsx":
    "batch operations render each photo in turn without opening it",
};

// The LIVE document's engine. Two entries, and the second one is the whole
// point of ADR-024: under Option A the owner MOVES into the worker. They are
// not throwaways — each is the document the user is editing, one on the main
// thread and one behind the port — so they get their own category rather than
// being waved through the throwaway list.
//
// Stage 3 added the worker and this test failed until it was listed. That is
// the guard working: relocating the live engine is a decision, and it should
// cost somebody a deliberate edit here.
//
// Exactly one of these is live at a time — `ih_engine_worker` decides which,
// and since a14 (v8.32) it defaults ON: the worker owns the live document
// unless `=0` opts a tab out. Two simultaneous live engines would be two
// ports, which is precisely what the ONE PORT PER DOCUMENT invariant forbids.
const LIVE_ENGINE_OWNERS: Record<string, string> = {
  "hooks/useEngineCore.ts":
    "the main-thread engine — the kill-switch (`ih_engine_worker=0`) fallback since a14",
  "workers/engine.worker.ts":
    "ADR-024 Stage 3 — the same live document behind the port; the DEFAULT owner since a14 (v8.32)",
  "lib/engine/port.ts":
    "ADR-024 a12.1 — `createLiveEngine()` is the swap point: it builds the local engine when the flag is off and asks the worker to build one when it is on. The construction that used to sit in useEngineCore's five load paths now happens here, once.",
};

describe("throwaway engines are declared, not incidental", () => {
  it("only the allowlisted modules construct their own engine", () => {
    const builders = FILES.filter((f) =>
      /new\s+(?:mod\.)?(?:ImageHorseTool|Tool)\s*\(/.test(code(f)),
    ).map(rel);

    const unexpected = builders.filter(
      (f) => !(f in LIVE_ENGINE_OWNERS) && !(f in THROWAWAY_ENGINES),
    );
    expect(
      unexpected,
      "a new engine instance outside every declared owner.\n" +
        "If it renders a document the user is NOT editing, add it to THROWAWAY_ENGINES with a reason.\n" +
        "If it IS the live document, that is a port decision — add it to LIVE_ENGINE_OWNERS and read ADR-024's ONE PORT PER DOCUMENT invariant first.",
    ).toEqual([]);
  });

  it("every allowlist entry still exists and still builds one", () => {
    // A stale allowlist is worse than none: it silently permits a path that
    // moved somewhere else.
    for (const [f, why] of Object.entries(THROWAWAY_ENGINES)) {
      expect(why.length, `${f} needs a reason, not an empty string`).toBeGreaterThan(20);
      const full = FILES.find((x) => rel(x) === f);
      expect(full, `allowlisted ${f} no longer exists — drop it from the list`).toBeTruthy();
      expect(
        /new\s+(?:mod\.)?(?:ImageHorseTool|Tool)\s*\(/.test(code(full!)),
        `allowlisted ${f} no longer constructs an engine — drop it from the list`,
      ).toBe(true);
    }
  });

  it("no throwaway routes itself through the live port", () => {
    for (const f of Object.keys(THROWAWAY_ENGINES)) {
      const full = FILES.find((x) => rel(x) === f)!;
      expect(
        code(full),
        `${f} calls attachLivePort — a throwaway document must NOT share the live queue: ` +
          "its ops would enter the live op log and it would serialise behind the open photo",
      ).not.toContain("attachLivePort");
    }
  });
});
