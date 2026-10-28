import { describe, expect, it } from "vitest";
import { applyRule, matchesRule, parseSize } from "./selectBy";
import type { PhotoEntry } from "@/features/gallery/GalleryBar";

const photo = (id: string, w: number, h: number, byteSize = 1000): PhotoEntry =>
  ({
    id,
    name: id,
    mimeType: "image/jpeg",
    byteSize,
    originalByteSize: byteSize,
    origWidth: w,
    origHeight: h,
    workingWidth: w,
    workingHeight: h,
    thumbBlob: new Blob(),
    originalKey: id,
  }) as PhotoEntry;

const gallery = [
  photo("tall", 1080, 1350, 300_000),
  photo("wide", 1600, 900, 900_000),
  photo("sq", 1080, 1081, 50_000),
  photo("tall2", 3000, 4000, 2_000_000),
];
const none = new Set<string>();

describe("Select by", () => {
  it("Portrait ticks exactly the portrait photos", () => {
    expect([...applyRule(gallery, none, { kind: "portrait" }, none, false)]).toEqual(["tall", "tall2"]);
  });

  it("a near-square is Square, not Portrait", () => {
    expect(matchesRule(gallery[2]!, { kind: "square" }, none)).toBe(true);
    expect(matchesRule(gallery[2]!, { kind: "portrait" }, none)).toBe(false);
  });

  it("without Shift a rule replaces the ticks, with Shift it adds", () => {
    const ticked = new Set(["wide"]);
    expect([...applyRule(gallery, ticked, { kind: "square" }, none, false)]).toEqual(["sq"]);
    expect([...applyRule(gallery, ticked, { kind: "square" }, none, true)].sort()).toEqual(["sq", "wide"]);
  });

  it("Larger than compares the stored file size", () => {
    expect([...applyRule(gallery, none, { kind: "larger", bytes: 500 * 1024 }, none, false)]).toEqual([
      "wide",
      "tall2",
    ]);
  });

  it("Edited and Unedited split the gallery", () => {
    const edited = new Set(["wide"]);
    expect([...applyRule(gallery, none, { kind: "edited" }, edited, false)]).toEqual(["wide"]);
    expect([...applyRule(gallery, none, { kind: "unedited" }, edited, false)]).toEqual(["tall", "sq", "tall2"]);
  });

  it("Invert ticks the complement", () => {
    expect([...applyRule(gallery, new Set(["tall", "sq"]), { kind: "invert" }, none, true)]).toEqual([
      "wide",
      "tall2",
    ]);
  });

  it("parseSize reads KB, MB and bare numbers", () => {
    expect(parseSize("300")).toBe(300 * 1024);
    expect(parseSize("1.5 MB")).toBe(1.5 * 1024 * 1024);
    expect(parseSize("250kb")).toBe(250 * 1024);
    expect(parseSize("big")).toBeNull();
  });
});
