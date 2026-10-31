import { describe, expect, it } from "vitest";
import { dismissKey, isHalloweenSeason, readDismissed, writeDismissed } from "./season";

const local = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12);

describe("isHalloweenSeason", () => {
  it.each([
    [local(2026, 10, 24), true],
    [local(2026, 10, 31), true],
    [new Date(2026, 9, 31, 23, 59), true],
    [local(2026, 10, 23), false],
    [local(2026, 11, 1), false],
    [local(2026, 9, 30), false],
    [local(2026, 1, 1), false],
  ])("%s → %s", (date, expected) => {
    expect(isHalloweenSeason(date)).toBe(expected);
  });
});

describe("dismissal", () => {
  function memoryStorage() {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  }

  it("is remembered for the same year only", () => {
    const s = memoryStorage();
    expect(readDismissed(s, local(2026, 10, 31))).toBe(false);
    writeDismissed(s, local(2026, 10, 31));
    expect(readDismissed(s, local(2026, 10, 25))).toBe(true);
    expect(readDismissed(s, local(2027, 10, 31))).toBe(false);
    expect(dismissKey(local(2026, 10, 31))).not.toBe(dismissKey(local(2027, 10, 31)));
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
    expect(readDismissed(undefined, local(2026, 10, 31))).toBe(false);
    expect(readDismissed(throwing, local(2026, 10, 31))).toBe(false);
    expect(() => writeDismissed(throwing, local(2026, 10, 31))).not.toThrow();
  });
});
