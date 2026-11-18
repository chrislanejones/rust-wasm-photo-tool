import { describe, expect, it } from "vitest";
import { isNetworkPathAllowed } from "@/lib/networkPaths";
import type { PairStatus } from "./connection";
import { ONLINE_OFF_LINE, computerLine, countdown, isEnded, pairAvailability, phoneLine } from "./messages";

const ALL: (PairStatus | "idle")[] = [
  "idle",
  "starting",
  "waiting",
  "connecting",
  "connected",
  "expired",
  "unavailable",
  "tampered",
  "unreachable",
  "busy",
  "error",
  "disconnected",
  "stopped",
];

describe("the online switch turns pairing off", () => {
  it("pairing is a switched network path: off with the switch, on without it", () => {
    expect(isNetworkPathAllowed("pair", false)).toBe(false);
    expect(isNetworkPathAllowed("pair", true)).toBe(true);
  });

  it("switch off → 'online-off', whatever else is true", () => {
    expect(pairAvailability(false, true)).toBe("online-off");
    expect(pairAvailability(false, false)).toBe("online-off");
    expect(pairAvailability(true, true)).toBe("ready");
    expect(pairAvailability(true, false)).toBe("no-server");
  });

  it("the line says why: a server introduces the devices, and photos leave the tab", () => {
    expect(ONLINE_OFF_LINE).toMatch(/server/);
    expect(ONLINE_OFF_LINE).toMatch(/leave this tab/);
  });
});

describe("every state has words, on both sides", () => {
  it.each(ALL)("%s", (s) => {
    expect(computerLine(s).title.length).toBeGreaterThan(0);
    expect(phoneLine(s).title.length).toBeGreaterThan(0);
  });

  it("the 15-second failure says what to try and that nothing is relayed", () => {
    expect(computerLine("unreachable").body).toMatch(/15 seconds/);
    expect(phoneLine("unreachable").body).toMatch(/doesn't relay/);
  });

  it("a used, expired or wrong link reads the same on the phone", () => {
    expect(phoneLine("unavailable")).toEqual(phoneLine("expired"));
  });

  it("only the live states are not 'ended'", () => {
    expect(ALL.filter((s) => !isEnded(s))).toEqual(["idle", "starting", "waiting", "connecting", "connected"]);
  });
});

describe("countdown", () => {
  it("is m:ss, rounds up, and stops at 0:00", () => {
    expect(countdown(5 * 60_000)).toBe("5:00");
    expect(countdown(299_001)).toBe("5:00");
    expect(countdown(299_000)).toBe("4:59");
    expect(countdown(9_000)).toBe("0:09");
    expect(countdown(-5)).toBe("0:00");
  });
});
