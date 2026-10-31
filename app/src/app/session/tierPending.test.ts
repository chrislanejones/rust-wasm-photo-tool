// decideGalleryCap: a pending tier is never the one that refuses (Night 10-27).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { capMessage, decideGalleryCap, TIER_PENDING_MAX_MS, type TierRef } from "./tierPending";
import { TIERS } from "@/lib/tiers";

const free = { mode: "loggedIn" as const, max: TIERS.loggedIn.galleryLimit };
const ref = (pending: boolean, mode: "loggedIn" | "paid" = "loggedIn"): TierRef => ({
  current: { mode, pending },
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("window", globalThis);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("decideGalleryCap", () => {
  it("answers at once when the add fits under the cap in force, pending or not", async () => {
    await expect(decideGalleryCap(ref(true), free, 20)).resolves.toEqual(free);
  });

  it("answers at once with the cap in force when the tier is decided", async () => {
    await expect(decideGalleryCap(ref(false), free, 30)).resolves.toEqual(free);
  });

  it("waits for a pending tier, then answers with the decided tier's cap", async () => {
    const tier = ref(true);
    let answer: unknown = null;
    void decideGalleryCap(tier, free, 30).then((a) => { answer = a; });
    await vi.advanceTimersByTimeAsync(2000);
    expect(answer, "still waiting — no refusal while pending").toBeNull();
    tier.current = { mode: "paid", pending: false };
    await vi.advanceTimersByTimeAsync(60);
    expect(answer).toEqual({ mode: "paid", max: TIERS.paid.galleryLimit });
  });

  it("a FREE answer after the wait is still the free cap", async () => {
    const tier = ref(true);
    let answer: unknown = null;
    void decideGalleryCap(tier, free, 30).then((a) => { answer = a; });
    tier.current = { mode: "loggedIn", pending: false };
    await vi.advanceTimersByTimeAsync(60);
    expect(answer).toEqual(free);
  });

  it("stops waiting at TIER_PENDING_MAX_MS and answers with the cap in force", async () => {
    let answer: unknown = null;
    void decideGalleryCap(ref(true), free, 30).then((a) => { answer = a; });
    await vi.advanceTimersByTimeAsync(TIER_PENDING_MAX_MS + 100);
    expect(answer).toEqual(free);
  });
});

describe("capMessage", () => {
  it("words each tier as before the move", () => {
    expect(capMessage("demo", 12)).toBe("Demo galleries hold 12 photos. Sign in to load up to 24.");
    expect(capMessage("loggedIn", 24)).toBe("Free accounts hold 24 photos. Pro (100) is coming soon.");
    expect(capMessage("paid", 100)).toBe("Gallery is limited to 100 photos.");
  });
});
