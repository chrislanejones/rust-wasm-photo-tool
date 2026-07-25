// @vitest-environment jsdom
// The ih_selection_bool KILL SWITCH had zero external consumers by the time
// fallow looked at it (isSelectionBoolEnabled is called only from inside this
// module), which is exactly the shape of a switch that has quietly stopped
// working. It hadn't — but nothing proved that, and the v7.47 six-mode rework
// rewrote every selection gesture path underneath it.
//
// What makes the switch safe is that `selectionCombineMode` reads the flag
// ITSELF rather than trusting callers to check first, so a new gesture path
// cannot forget the gate. These pin that property, not just the boolean.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isSelectionBoolEnabled, selectionCombineMode } from "./selectionBool";

const KEY = "ih_selection_bool";

// Install our OWN storage rather than using the ambient one. Under Node 25 the
// runtime's experimental built-in localStorage shadows jsdom's and arrives
// half-initialised — the test run emits
//   Warning: `--localstorage-file` was provided without a valid path
// and `window.localStorage.removeItem` is not a function. Depending on which
// localStorage implementation wins is not something this test should care
// about; it cares that the flag gates the combine mode.
const store = new Map<string, string>();
const fakeStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() {
    return store.size;
  },
} as Storage;

let original: PropertyDescriptor | undefined;

beforeEach(() => {
  original = Object.getOwnPropertyDescriptor(window, "localStorage");
  Object.defineProperty(window, "localStorage", {
    value: fakeStorage,
    configurable: true,
    writable: true,
  });
  store.clear();
});

afterEach(() => {
  store.clear();
  if (original) Object.defineProperty(window, "localStorage", original);
});

describe("ih_selection_bool is a kill switch, not an opt-in", () => {
  it("is ON when unset — additive selection ships by default", () => {
    expect(isSelectionBoolEnabled()).toBe(true);
  });

  it('is OFF only for exactly "0"', () => {
    fakeStorage.setItem(KEY, "0");
    expect(isSelectionBoolEnabled()).toBe(false);
  });

  it('any other value leaves it ON (it is a kill switch, so "1"/"false"/junk do not disable)', () => {
    for (const v of ["1", "true", "false", "", "off", "no"]) {
      fakeStorage.setItem(KEY, v);
      expect(isSelectionBoolEnabled()).toBe(true);
    }
  });
});

describe("selectionCombineMode gates itself on the switch", () => {
  it("maps Shift -> union(1) and Alt -> subtract(2) while enabled", () => {
    expect(selectionCombineMode({ shiftKey: true, altKey: false })).toBe(1);
    expect(selectionCombineMode({ shiftKey: false, altKey: true })).toBe(2);
    expect(selectionCombineMode({ shiftKey: false, altKey: false })).toBe(0);
  });

  it("Shift wins when both are held — add is the less destructive intent", () => {
    expect(selectionCombineMode({ shiftKey: true, altKey: true })).toBe(1);
  });

  // THE ACTUAL KILL-SWITCH CONTRACT: with the flag killed, no modifier
  // combination may produce anything but replace(0). Every engine
  // `set_selection_combine` write in the app is fed by this function, so this
  // one assertion is what makes the switch real.
  it("forces replace(0) for EVERY modifier combination when killed", () => {
    fakeStorage.setItem(KEY, "0");
    for (const shiftKey of [true, false]) {
      for (const altKey of [true, false]) {
        expect(selectionCombineMode({ shiftKey, altKey })).toBe(0);
      }
    }
  });
});
