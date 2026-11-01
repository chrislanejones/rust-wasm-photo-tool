import { describe, expect, it } from "vitest";
import { dismissKey, fallBackDay, isFallBackSeason, readDismissed, writeDismissed } from "./season";

const local = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12);

describe("fallBackDay", () => {
  it.each([
    [2026, 1],
    [2027, 7],
    [2028, 5],
    [2029, 4],
    [2030, 3],
  ])("%s → November %s", (year, date) => {
    const day = fallBackDay(year);
    expect([day.getMonth(), day.getDate(), day.getDay()]).toEqual([10, date, 0]);
  });
});

describe("isFallBackSeason", () => {
  it.each([
    // 2026: clocks go back Sunday November 1.
    [local(2026, 10, 26), true],
    [local(2026, 11, 1), true],
    [new Date(2026, 10, 3, 23, 59), true],
    [local(2026, 10, 25), false],
    [local(2026, 11, 4), false],
    // 2027: Sunday November 7.
    [local(2027, 11, 1), true],
    [local(2027, 11, 9), true],
    [local(2027, 10, 31), false],
    [local(2027, 11, 10), false],
    [local(2026, 1, 1), false],
  ])("%s → %s", (date, expected) => {
    expect(isFallBackSeason(date)).toBe(expected);
  });
});

describe("dismissal", () => {
  function memoryStorage() {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  }

  it("is remembered for the same year only", () => {
    const s = memoryStorage();
    expect(readDismissed(s, local(2026, 11, 1))).toBe(false);
    writeDismissed(s, local(2026, 11, 1));
    expect(readDismissed(s, local(2026, 10, 27))).toBe(true);
    expect(readDismissed(s, local(2027, 11, 7))).toBe(false);
    expect(dismissKey(local(2026, 11, 1))).not.toBe(dismissKey(local(2027, 11, 7)));
  });

  it("treats missing or throwing storage as not closed", () => {
    const throwing = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readDismissed(undefined, local(2026, 11, 1))).toBe(false);
    expect(readDismissed(throwing, local(2026, 11, 1))).toBe(false);
    expect(() => writeDismissed(throwing, local(2026, 11, 1))).not.toThrow();
  });
});
