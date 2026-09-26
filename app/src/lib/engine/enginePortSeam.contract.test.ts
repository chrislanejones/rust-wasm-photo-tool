// ADR-024 Stage 3.5 — the two seam properties, split out of
// engineAsyncMigration.contract.test.ts so that file holds the ratchet and
// this one holds the invariants the ratchet protects: the worker flag is read
// only behind the port, and throwaway engines never touch the live port.
import { describe, it, expect } from "vitest";
import { FILES, rel, code } from "./contractScan";

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
