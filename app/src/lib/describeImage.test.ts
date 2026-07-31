// Name-building rules for Batch → AI Rename.
//
// The engine's side of this (does a blue image come back "blue"?) is tested in
// Rust, in src/describe.rs. What is tested here is the name-building: token
// expansion, slugging, and collision handling. The engine WILL describe two
// beach photos identically, so the dedup cases below are the point of this
// file — they keep the collision resolved where the user can see it, rather
// than leaving it to the ZIP export's own `usedNames` pass to invent suffixes
// after the fact.
import { describe, expect, it } from "vitest";

import {
  applyDescriptionPattern,
  dedupeNames,
  parseDescription,
  slugify,
  splitExtension,
  UNKNOWN_DESCRIPTION,
  type ImageDescription,
} from "@/lib/describeImage";

const DESC: ImageDescription = {
  kind: "photo",
  subject: "portrait",
  tone: "dark",
  contrast: "high",
  palette: "vivid",
  color: "blue",
  orientation: "landscape",
  detail: "busy",
  transparent: false,
  slug: "dark-blue-portrait",
};

const patternInput = (over: Partial<Parameters<typeof applyDescriptionPattern>[1]> = {}) => ({
  description: DESC,
  originalName: "IMG_4021.JPG",
  index: 0,
  start: 1,
  pad: 2,
  ...over,
});

describe("parseDescription", () => {
  it("reads a well-formed engine payload", () => {
    const d = parseDescription(JSON.stringify(DESC));
    expect(d).toEqual(DESC);
  });

  it("falls back instead of throwing on junk", () => {
    expect(parseDescription("")).toEqual(UNKNOWN_DESCRIPTION);
    expect(parseDescription("{oh no")).toEqual(UNKNOWN_DESCRIPTION);
    expect(parseDescription("null")).toEqual(UNKNOWN_DESCRIPTION);
  });

  it("repairs a payload with missing or wrongly-typed fields", () => {
    const d = parseDescription('{"color":123,"slug":"x","transparent":"yes"}');
    expect(d.color).toBe("grey"); // number rejected, fallback used
    expect(d.slug).toBe("x");
    expect(d.transparent).toBe(false); // only a real `true` counts
    expect(d.subject).toBe("");
  });
});

describe("slugify", () => {
  it("lowercases and collapses everything unsafe to single dashes", () => {
    expect(slugify("Sunset Over The Bay!!")).toBe("sunset-over-the-bay");
    expect(slugify("a  //  b")).toBe("a-b");
  });

  it("trims leading and trailing dashes", () => {
    expect(slugify("  -- hello -- ")).toBe("hello");
  });

  it("strips accents rather than dropping the letter", () => {
    expect(slugify("Café Ström")).toBe("cafe-strom");
  });

  it("returns empty for input with nothing slug-worthy in it", () => {
    expect(slugify("...")).toBe("");
    expect(slugify("")).toBe("");
  });
});

describe("splitExtension", () => {
  it("splits on the last dot", () => {
    expect(splitExtension("a.b.png")).toEqual(["a.b", ".png"]);
  });

  it("leaves extensionless names alone", () => {
    expect(splitExtension("beach")).toEqual(["beach", ""]);
  });

  it("treats a leading dot as part of the name, not an extension", () => {
    expect(splitExtension(".gitignore")).toEqual([".gitignore", ""]);
  });
});

describe("applyDescriptionPattern", () => {
  it("expands the description tokens", () => {
    expect(applyDescriptionPattern("{desc}", patternInput())).toBe("dark-blue-portrait");
    expect(applyDescriptionPattern("{color}-{subject}", patternInput())).toBe("blue-portrait");
    expect(applyDescriptionPattern("{kind}-{orientation}", patternInput())).toBe(
      "photo-landscape",
    );
  });

  it("numbers from `start`, padded to `pad`", () => {
    expect(applyDescriptionPattern("{desc}-{n}", patternInput({ index: 0 }))).toBe(
      "dark-blue-portrait-01",
    );
    expect(
      applyDescriptionPattern("{n}", patternInput({ index: 9, start: 1, pad: 3 })),
    ).toBe("010");
  });

  it("keeps the original base name via {name}, without its extension", () => {
    expect(applyDescriptionPattern("{name}-{color}", patternInput())).toBe("img-4021-blue");
  });

  it("collapses empty tokens instead of leaving orphan dashes", () => {
    const subjectless = { ...DESC, subject: "", tone: "" };
    expect(
      applyDescriptionPattern(
        "{tone}-{color}-{subject}",
        patternInput({ description: subjectless }),
      ),
    ).toBe("blue");
  });

  it("leaves unknown tokens as literal text rather than eating them", () => {
    expect(applyDescriptionPattern("{color}-{nope}", patternInput())).toBe("blue-nope");
  });

  it("never returns a blank name", () => {
    expect(applyDescriptionPattern("", patternInput())).toBe("dark-blue-portrait");
    expect(applyDescriptionPattern("///", patternInput())).toBe("dark-blue-portrait");
    // Pattern is empty AND the engine had nothing: still not blank.
    expect(
      applyDescriptionPattern(
        "",
        patternInput({ description: { ...DESC, slug: "" }, originalName: "!!!.png" }),
      ),
    ).toBe("image");
  });
});

describe("dedupeNames", () => {
  it("leaves already-unique names untouched", () => {
    expect(dedupeNames(["a", "b", "c"])).toEqual(["a", "b", "c"]);
  });

  it("suffixes repeats — the twenty-identical-beach-photos case", () => {
    expect(dedupeNames(["beach", "beach", "beach"])).toEqual(["beach", "beach-2", "beach-3"]);
  });

  it("does not collide with a literal name that already looks like a suffix", () => {
    // Naive numbering would rename the second "beach" to "beach-2" and
    // duplicate the real one sitting at index 1.
    expect(dedupeNames(["beach", "beach-2", "beach"])).toEqual([
      "beach",
      "beach-2",
      "beach-3",
    ]);
  });

  it("treats names differing only in case as colliding", () => {
    // APFS and NTFS agree with this; a case-sensitive compare would ship a
    // pair of files that overwrite each other on export.
    expect(dedupeNames(["Beach", "beach"])).toEqual(["Beach", "beach-2"]);
  });

  it("keeps every output distinct across a messy run", () => {
    const out = dedupeNames(["x", "x", "x-2", "X", "y", "x-3", "x"]);
    const lower = out.map((s) => s.toLowerCase());
    expect(new Set(lower).size).toBe(out.length);
  });
});
