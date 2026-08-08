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

const SRC = join(process.cwd(), "src");

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

  it("routes every live engine it creates through attachLivePort", () => {
    const src = code(join(SRC, "hooks/useEngineCore.ts"));
    // Each `toolRef.current = <expr>` must be null (reset) or the port call.
    const assigns = [...src.matchAll(/toolRef\.current\s*=\s*([^;]+);/g)].map((m) => m[1].trim());
    expect(assigns.length, "expected the known assignment sites").toBeGreaterThan(0);
    for (const a of assigns) {
      expect(a, `unrouted assignment: toolRef.current = ${a}`)
        .toMatch(/^(null|attachLivePort\(.*\))$/);
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
// and it is OFF. Two simultaneous live engines would be two ports, which is
// precisely what the ONE PORT PER DOCUMENT invariant forbids.
const LIVE_ENGINE_OWNERS: Record<string, string> = {
  "hooks/useEngineCore.ts":
    "the main-thread engine — today's only live document owner",
  "workers/engine.worker.ts":
    "ADR-024 Stage 3 — the same live document behind the port; unreachable while ih_engine_worker is off",
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
