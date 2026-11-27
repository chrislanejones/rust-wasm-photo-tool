import { describe, expect, it } from "vitest";
import { blackFriday, dismissKey, isBlackFridaySeason, readDismissed, writeDismissed } from "./season";

const local = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12);

describe("blackFriday", () => {
  it.each([
    [2026, 27],
    [2027, 26],
    [2028, 24],
    [2029, 23],
    [2030, 29],
    [2024, 29],
  ])("%s → November %s", (year, date) => {
    const day = blackFriday(year);
    expect([day.getMonth(), day.getDate(), day.getDay()]).toEqual([10, date, 5]);
  });
});

describe("isBlackFridaySeason", () => {
  it.each([
    // 2026: Friday November 27.
    [local(2026, 11, 27), true],
    [new Date(2026, 10, 27, 0, 1), true],
    [new Date(2026, 10, 29, 23, 59), true],
    [local(2026, 11, 26), false], // Thanksgiving itself
    [local(2026, 11, 30), false],
    // 2027: Friday November 26.
    [local(2027, 11, 26), true],
    [local(2027, 11, 28), true],
    [local(2027, 11, 25), false],
    [local(2027, 11, 29), false],
    [local(2026, 1, 1), false],
  ])("%s → %s", (date, expected) => {
    expect(isBlackFridaySeason(date)).toBe(expected);
  });
});

describe("dismissal", () => {
  function memoryStorage() {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  }

  it("is remembered for the same year only", () => {
    const s = memoryStorage();
    expect(readDismissed(s, local(2026, 11, 27))).toBe(false);
    writeDismissed(s, local(2026, 11, 27));
    expect(readDismissed(s, local(2026, 11, 29))).toBe(true);
    expect(readDismissed(s, local(2027, 11, 26))).toBe(false);
    expect(dismissKey(local(2026, 11, 27))).not.toBe(dismissKey(local(2027, 11, 26)));
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
    expect(readDismissed(undefined, local(2026, 11, 27))).toBe(false);
    expect(readDismissed(throwing, local(2026, 11, 27))).toBe(false);
    expect(() => writeDismissed(throwing, local(2026, 11, 27))).not.toThrow();
  });
});
