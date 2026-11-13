import { describe, it, expect } from "vitest";
import { DEFAULT_PREFERENCES, parsePreferences, serializePreferences } from "./preferences";

// Text in Box (ADR-104) is a saved preference: chosen once, kept on reload and
// synced to a signed-in user's other devices like every other preference.
describe("the Text in Box preference", () => {
  it("defaults to top-left, what every text was", () => {
    expect(DEFAULT_PREFERENCES.textAlign).toBe("top-left");
    expect(parsePreferences("{}")?.textAlign).toBe("top-left");
  });

  it("survives a round trip through the stored blob", () => {
    const blob = serializePreferences({ ...DEFAULT_PREFERENCES, textAlign: "bottom-right" });
    expect(parsePreferences(blob)?.textAlign).toBe("bottom-right");
  });

  it("is appended LAST, so no other field's position moves", () => {
    const keys = Object.keys(JSON.parse(serializePreferences(DEFAULT_PREFERENCES)));
    expect(keys.at(-1)).toBe("textAlign");
    expect(keys.at(-2)).toBe("exportRecipes");
  });

  it("reads anything off the grid (and #462's old left/right) as top-left", () => {
    for (const bad of ["left", "right", "sideways", 3, null]) {
      expect(parsePreferences(JSON.stringify({ textAlign: bad }))?.textAlign).toBe("top-left");
    }
  });
});
