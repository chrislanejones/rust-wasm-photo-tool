import { describe, expect, it } from "vitest";
import { dismissKey, isThanksgivingSeason, readDismissed, thanksgivingDay, writeDismissed } from "./season";

const local = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12);

describe("thanksgivingDay", () => {
  it.each([
    [2026, 26],
    [2027, 25],
    [2028, 23],
    [2029, 22],
    [2030, 28],
    [2024, 28],
  ])("%s → November %s", (year, date) => {
    const day = thanksgivingDay(year);
    expect([day.getMonth(), day.getDate(), day.getDay()]).toEqual([10, date, 4]);
  });
});

describe("isThanksgivingSeason", () => {
  it.each([
    // 2026: Thursday November 26.
    [local(2026, 11, 20), true],
    [local(2026, 11, 26), true],
    [new Date(2026, 10, 29, 23, 59), true],
    [local(2026, 11, 19), false],
    [local(2026, 11, 30), false],
    // 2027: Thursday November 25.
    [local(2027, 11, 19), true],
    [local(2027, 11, 28), true],
    [local(2027, 11, 18), false],
    [local(2027, 11, 29), false],
    [local(2026, 10, 31), false],
    [local(2026, 1, 1), false],
  ])("%s → %s", (date, expected) => {
    expect(isThanksgivingSeason(date)).toBe(expected);
  });
});

describe("dismissal", () => {
  function memoryStorage() {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  }

  it("is remembered for the same year only", () => {
    const s = memoryStorage();
    expect(readDismissed(s, local(2026, 11, 26))).toBe(false);
    writeDismissed(s, local(2026, 11, 26));
    expect(readDismissed(s, local(2026, 11, 28))).toBe(true);
    expect(readDismissed(s, local(2027, 11, 25))).toBe(false);
    expect(dismissKey(local(2026, 11, 26))).not.toBe(dismissKey(local(2027, 11, 25)));
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
    expect(readDismissed(undefined, local(2026, 11, 26))).toBe(false);
    expect(readDismissed(throwing, local(2026, 11, 26))).toBe(false);
    expect(() => writeDismissed(throwing, local(2026, 11, 26))).not.toThrow();
  });
});
