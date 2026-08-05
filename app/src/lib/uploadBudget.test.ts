// ===== FILE: app/src/lib/uploadBudget.test.ts =====
//
// The cloud-upload rate limiter.
//
// Written against the incident it exists to prevent: one brush stroke produced
// 28 uploads, and over the app's life that became 3.1K upload-url calls and
// 3,535 MB of orphaned storage — enough to exceed the Convex free plan, disable
// every deployment on the account, and take an unrelated production website
// down with it.
//
// Time is injected rather than mocked globally. A limiter whose tests depend on
// wall-clock timing is a flaky test suite, and this one has to be trustworthy:
// if it denies too eagerly it silently stops syncing the user's work to the
// cloud, and nobody would notice for weeks.
import { beforeEach, describe, expect, it } from "vitest";

import {
  mayUpload,
  recordUpload,
  uploadBudgetStats,
  __resetUploadBudget,
  MIN_INTERVAL_MS,
  WINDOW_MS,
  MAX_PER_WINDOW,
} from "@/lib/uploadBudget";

const T0 = 1_700_000_000_000;

beforeEach(() => {
  __resetUploadBudget();
});

describe("per-photo interval — the tight-loop case", () => {
  it("allows the first upload of a photo", () => {
    expect(mayUpload("a", T0)).toEqual({ ok: true });
  });

  it("denies a second upload of the SAME photo inside the interval", () => {
    recordUpload("a", T0);
    const v = mayUpload("a", T0 + 1_000);
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.reason).toBe("interval");
      expect(v.retryInMs).toBe(MIN_INTERVAL_MS - 1_000);
    }
  });

  it("allows again once the interval has passed", () => {
    recordUpload("a", T0);
    expect(mayUpload("a", T0 + MIN_INTERVAL_MS)).toEqual({ ok: true });
  });

  it("does not let one photo's interval block a DIFFERENT photo", () => {
    // The limit is per photo. Switching between photos is normal use and must
    // not be throttled by whichever one was saved last.
    recordUpload("a", T0);
    expect(mayUpload("b", T0 + 1_000)).toEqual({ ok: true });
  });

  it("reproduces the measured churn: 0s, 7s, 15.4s, 25s on one photo", () => {
    // Photo jzfnrd, straight from the live trace — four uploads at an
    // IDENTICAL undo count. Two of the four survive this limiter:
    //
    //   0s     first upload             → allowed
    //   7s     7s after the last        → DENIED (interval)
    //   15.4s  15.4s after the last     → allowed
    //   25s    only 9.6s after 15.4s    → DENIED (interval)
    //
    // The 25s one is the interesting case and the reason the interval is a
    // gap-since-last-upload rather than a fixed slot: it looks far from the
    // start but is under 10s from the upload that actually preceded it.
    __resetUploadBudget();
    const at = (s: number) => T0 + s * 1000;

    expect(mayUpload("jzfnrd", at(0)).ok).toBe(true);
    recordUpload("jzfnrd", at(0));

    expect(mayUpload("jzfnrd", at(7)).ok).toBe(false);

    expect(mayUpload("jzfnrd", at(15.4)).ok).toBe(true);
    recordUpload("jzfnrd", at(15.4));

    expect(mayUpload("jzfnrd", at(25)).ok).toBe(false); // 9.6s < 10s
  });
});

describe("rolling-window ceiling — the breadth case", () => {
  it("denies once the window is full", () => {
    // Spread across distinct photos so the per-photo interval never fires:
    // this is the failure a per-photo limit alone cannot see.
    for (let i = 0; i < MAX_PER_WINDOW; i++) recordUpload(`photo-${i}`, T0 + i);

    const v = mayUpload("photo-new", T0 + MAX_PER_WINDOW);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("ceiling");
  });

  it("frees up as the window slides", () => {
    for (let i = 0; i < MAX_PER_WINDOW; i++) recordUpload(`photo-${i}`, T0 + i);
    expect(mayUpload("photo-new", T0 + MAX_PER_WINDOW).ok).toBe(false);

    // Once the oldest stamp falls out of the window, there is room again.
    expect(mayUpload("photo-new", T0 + WINDOW_MS + 1).ok).toBe(true);
  });

  it("reports how long until the ceiling lifts", () => {
    for (let i = 0; i < MAX_PER_WINDOW; i++) recordUpload(`photo-${i}`, T0);
    const v = mayUpload("photo-new", T0 + 60_000);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.retryInMs).toBe(WINDOW_MS - 60_000);
  });
});

describe("it does not throttle ordinary use", () => {
  // The important half. A limiter that denies real work stops syncing the
  // user's edits and nobody finds out for weeks.

  it("lets a person edit a five-photo gallery all evening", () => {
    // One upload per photo every 30s for an hour: comfortably real behaviour,
    // and far more saving than a human actually does.
    let denied = 0;
    let t = T0;
    for (let round = 0; round < 12; round++) {
      for (let p = 0; p < 5; p++) {
        if (mayUpload(`photo-${p}`, t).ok) recordUpload(`photo-${p}`, t);
        else denied++;
        t += 30_000;
      }
    }
    expect(denied).toBe(0);
  });
});

describe("accounting", () => {
  it("spends budget only on recordUpload, not on asking", () => {
    // A failed upload must not burn the allowance it never used, so the check
    // and the spend are separate calls.
    for (let i = 0; i < 10; i++) mayUpload(`photo-${i}`, T0);
    expect(uploadBudgetStats(T0).inWindow).toBe(0);
    expect(uploadBudgetStats(T0).remaining).toBe(MAX_PER_WINDOW);
  });

  it("tallies each outcome separately", () => {
    mayUpload("a", T0); // allowed
    recordUpload("a", T0);
    mayUpload("a", T0 + 1); // interval
    for (let i = 0; i < MAX_PER_WINDOW; i++) recordUpload(`p${i}`, T0);
    mayUpload("z", T0 + 2); // ceiling

    const s = uploadBudgetStats(T0 + 2);
    expect(s.allowed).toBe(1);
    expect(s.deniedInterval).toBe(1);
    expect(s.deniedCeiling).toBe(1);
  });
});
