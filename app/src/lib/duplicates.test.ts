import { describe, expect, it } from "vitest";
import {
  COLOR_LIMIT,
  colorDistance,
  groupLookAlikes,
  hashDistance,
  LOOKS_SAME_BITS,
  planDuplicates,
  planGroup,
  type DuplicateCandidate,
  type Fingerprint,
} from "./duplicates";

const fp = (hi: number, lo: number, rgb = 0x808080): Fingerprint => ({ hi, lo, rgb });

/** A fingerprint `bits` bits away from `base` (flipping low bits of `lo`). */
const flipped = (base: Fingerprint, bits: number): Fingerprint => ({
  ...base,
  lo: (base.lo ^ (bits >= 32 ? 0xffffffff : (1 << bits) - 1)) >>> 0,
});

const photo = (id: string, w: number, h: number, edited = false, byteSize = w * h): DuplicateCandidate => ({
  id,
  width: w,
  height: h,
  byteSize,
  edited,
});

describe("hashDistance / colorDistance", () => {
  it("counts differing bits across both halves", () => {
    expect(hashDistance(fp(0, 0), fp(0, 0))).toBe(0);
    expect(hashDistance(fp(0xffffffff, 0xffffffff), fp(0, 0))).toBe(64);
    expect(hashDistance(fp(0x80000000, 1), fp(0, 0))).toBe(2);
  });
  it("takes the worst channel", () => {
    expect(colorDistance(fp(0, 0, 0x102030), fp(0, 0, 0x112a30))).toBe(10);
  });
});

describe("groupLookAlikes", () => {
  const a = fp(0x12345678, 0x9abcdef0);
  it(`joins at ${LOOKS_SAME_BITS} bits and not at ${LOOKS_SAME_BITS + 1}`, () => {
    expect(groupLookAlikes([{ id: "a", fp: a }, { id: "b", fp: flipped(a, LOOKS_SAME_BITS) }])).toEqual([["a", "b"]]);
    expect(groupLookAlikes([{ id: "a", fp: a }, { id: "b", fp: flipped(a, LOOKS_SAME_BITS + 1) }])).toEqual([]);
  });
  it("keeps two same-hash photos apart when their colors are not close", () => {
    const black = fp(0, 0, 0x000000);
    const white = fp(0, 0, 0xffffff);
    const nearBlack = fp(0, 0, COLOR_LIMIT * 0x010101);
    expect(groupLookAlikes([{ id: "k", fp: black }, { id: "w", fp: white }])).toEqual([]);
    expect(groupLookAlikes([{ id: "k", fp: black }, { id: "n", fp: nearBlack }])).toEqual([["k", "n"]]);
  });
  it("chains pairs: A~B and B~C is one group even when A and C are further apart", () => {
    const b = flipped(a, 4);
    const c = { ...b, hi: (b.hi ^ 0xf) >>> 0 }; // 4 more bits away from b, 8 from a
    expect(hashDistance(a, c)).toBe(8);
    expect(groupLookAlikes([{ id: "a", fp: a }, { id: "x", fp: fp(0, 0) }, { id: "c", fp: c }, { id: "b", fp: b }])).toEqual([
      ["a", "c", "b"],
    ]);
  });
  it("drops lone photos and keeps gallery order", () => {
    const other = fp(0xffff0000, 0x0000ffff);
    expect(
      groupLookAlikes([
        { id: "solo", fp: fp(0x0f0f0f0f, 0x0f0f0f0f) },
        { id: "o1", fp: other },
        { id: "a1", fp: a },
        { id: "o2", fp: other },
        { id: "a2", fp: a },
      ]),
    ).toEqual([
      ["o1", "o2"],
      ["a1", "a2"],
    ]);
  });
});

describe("planGroup — Keep", () => {
  it("keeps the largest resolution when nothing is edited", () => {
    expect(planGroup([photo("s", 320, 240), photo("l", 960, 720), photo("m", 640, 480)]).keep).toBe("l");
  });
  it("breaks a resolution tie by file size, then by gallery order", () => {
    expect(planGroup([photo("a", 960, 720, false, 100), photo("b", 960, 720, false, 300)]).keep).toBe("b");
    expect(planGroup([photo("a", 960, 720, false, 100), photo("b", 960, 720, false, 100)]).keep).toBe("a");
  });
  it("keeps the edited one when exactly one is edited, even if it is smaller", () => {
    expect(planGroup([photo("big", 960, 720), photo("ed", 320, 240, true)]).keep).toBe("ed");
  });
  it("keeps the largest when two are edited", () => {
    expect(planGroup([photo("e1", 320, 240, true), photo("e2", 960, 720, true), photo("u", 640, 480)]).keep).toBe("e2");
  });
});

describe("planGroup — pre-ticks", () => {
  it("ticks everything but Keep when nothing is edited", () => {
    expect(planGroup([photo("s", 320, 240), photo("l", 960, 720), photo("m", 640, 480)]).ticked).toEqual(["s", "m"]);
  });
  it("ticks the unedited ones when the edited one is Keep", () => {
    expect(planGroup([photo("big", 960, 720), photo("ed", 320, 240, true), photo("x", 640, 480)]).ticked).toEqual([
      "big",
      "x",
    ]);
  });
  it("never pre-ticks an edited photo", () => {
    for (const plan of [
      planGroup([photo("big", 960, 720), photo("ed", 320, 240, true)]),
      planGroup([photo("ed", 320, 240, true), photo("big", 960, 720)]),
    ]) {
      expect(plan.ticked).not.toContain("ed");
    }
  });
  it("ticks NOTHING in a group where two photos are edited", () => {
    expect(planGroup([photo("e1", 320, 240, true), photo("e2", 960, 720, true)]).ticked).toEqual([]);
    expect(planGroup([photo("e1", 320, 240, true), photo("u", 960, 720), photo("e2", 640, 480, true)]).ticked).toEqual([]);
  });
  it("never ticks Keep", () => {
    const plan = planGroup([photo("s", 320, 240), photo("l", 960, 720)]);
    expect(plan.ticked).not.toContain(plan.keep);
  });
});

describe("planDuplicates", () => {
  it("leaves out photos with no fingerprint instead of guessing", () => {
    const a = fp(1, 2);
    const plans = planDuplicates(
      [photo("p1", 100, 100), photo("p2", 200, 200), photo("nofp", 300, 300)],
      new Map([
        ["p1", a],
        ["p2", a],
      ]),
    );
    expect(plans).toEqual([{ ids: ["p1", "p2"], keep: "p2", ticked: ["p1"] }]);
  });

  it("groups 200 photos in well under a second", () => {
    // 200 fingerprints: 50 clusters of 4 near-copies (0–3 bits apart).
    const photos: DuplicateCandidate[] = [];
    const fps = new Map<string, Fingerprint>();
    let s = 1;
    const rand = () => (s = (Math.imul(s, 1103515245) + 12345) >>> 0);
    for (let c = 0; c < 50; c++) {
      const base = fp(rand(), rand(), rand() & 0xffffff);
      for (let k = 0; k < 4; k++) {
        const id = `c${c}-${k}`;
        photos.push(photo(id, 1000 + k, 750));
        fps.set(id, flipped(base, k));
      }
    }
    const t0 = performance.now();
    const plans = planDuplicates(photos, fps);
    const ms = performance.now() - t0;
    expect(plans).toHaveLength(50);
    expect(plans.every((p) => p.ids.length === 4 && p.ticked.length === 3)).toBe(true);
    expect(ms).toBeLessThan(1000);
  });
});
