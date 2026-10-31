import { describe, expect, it } from "vitest";
import {
  BUILT_IN_RECIPES,
  findRecipe,
  normalizeRecipes,
  recipeFileStem,
  recipeGeometry,
} from "./exportRecipes";

describe("recipeGeometry", () => {
  it("exact 1080×1350 crops a landscape photo from the center", () => {
    const g = recipeGeometry(4000, 3000, { fit: "exact", width: 1080, height: 1350 });
    expect(g.width).toBe(1080);
    expect(g.height).toBe(1350);
    expect(g.crop.height).toBe(3000);
    expect(g.crop.width).toBe(2400);
    expect(g.crop.x).toBe(800);
  });

  it("exact upscales a small photo to the exact size", () => {
    const g = recipeGeometry(400, 500, { fit: "exact", width: 1080, height: 1350 });
    expect([g.width, g.height]).toEqual([1080, 1350]);
    expect(g.crop).toEqual({ x: 0, y: 0, width: 400, height: 500 });
  });

  it("long edge never upscales", () => {
    expect(recipeGeometry(800, 600, { fit: "long", size: 1600 })).toMatchObject({ width: 800, height: 600 });
    expect(recipeGeometry(3000, 4000, { fit: "long", size: 1600 })).toMatchObject({ width: 1200, height: 1600 });
  });
});

describe("recipeFileStem", () => {
  it("fills the tokens", () => {
    expect(recipeFileStem("{name}-{n}-{w}x{h}", { name: "beach", n: 3, w: 1080, h: 1350 })).toBe(
      "beach-3-1080x1350",
    );
  });

  it("replaces characters a file system refuses", () => {
    expect(recipeFileStem("a/b:c", { name: "x", n: 1, w: 1, h: 1 })).toBe("a-b-c");
  });

  it("falls back to the photo name when empty", () => {
    expect(recipeFileStem("  ", { name: "beach", n: 1, w: 1, h: 1 })).toBe("beach");
  });
});

describe("normalizeRecipes", () => {
  const good = {
    id: "r1",
    name: "Blog",
    size: { fit: "width", size: 1200 },
    format: "webp",
    quality: 82,
    pattern: "{name}",
  };

  it("keeps a valid recipe", () => {
    expect(normalizeRecipes([good])).toEqual([good]);
  });

  it("drops a bad one instead of guessing", () => {
    expect(normalizeRecipes([{ ...good, format: "gif" }, { ...good, id: "r2", size: { fit: "exact" } }])).toEqual([]);
  });

  it("refuses an id that claims to be a built-in, and duplicates", () => {
    expect(normalizeRecipes([{ ...good, id: "builtin:x" }, good, good])).toHaveLength(1);
  });

  it("is empty for anything that is not a list", () => {
    expect(normalizeRecipes(undefined)).toEqual([]);
    expect(normalizeRecipes({})).toEqual([]);
  });
});

it("findRecipe looks in the built-ins, then the saved", () => {
  expect(findRecipe("builtin:instagram", [])?.name).toBe("Instagram 1080×1350");
  expect(findRecipe(null, [])).toBeNull();
  expect(BUILT_IN_RECIPES).toHaveLength(3);
});
