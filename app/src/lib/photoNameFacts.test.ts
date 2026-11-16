import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getOriginal: vi.fn(),
  parseExif: vi.fn(),
}));
vi.mock("@/lib/dexie/originalsAdapter", () => ({ getOriginal: mocks.getOriginal }));
vi.mock("@/lib/exif", () => ({ parseExifFromImage: mocks.parseExif }));

import { forgetNameFactsForTests, loadNameFacts, rememberFileDate } from "./photoNameFacts";

const record = (name: string) => ({
  bytes: new ArrayBuffer(4),
  mimeType: "image/jpeg",
  name,
  width: 10,
  height: 10,
});

beforeEach(() => {
  vi.clearAllMocks();
  forgetNameFactsForTests();
  mocks.getOriginal.mockImplementation(async (key: string) =>
    key === "up" ? record("IMG_4021.JPG") : key === "cur" ? record("beach.png") : null,
  );
  mocks.parseExif.mockReturnValue({ dateTaken: "2024-05-01 10:30" });
});

describe("loadNameFacts", () => {
  it("reads {original} and the EXIF date from the UPLOAD original, not the current file", async () => {
    const f = await loadNameFacts({ uploadKey: "up", originalKey: "cur" });
    expect(f).toEqual({ original: "IMG_4021", dateTaken: "2024-05-01 10:30" });
    expect(mocks.getOriginal).toHaveBeenCalledWith("up");
    expect(mocks.getOriginal).not.toHaveBeenCalledWith("cur");
  });

  it("a photo with no uploadKey has no honest {original}, but its EXIF is still read", async () => {
    // Its originalKey may already be a re-encode named after a renamed photo,
    // so the stored name there is not "the name before any rename".
    const f = await loadNameFacts({ originalKey: "cur" });
    expect(f.original).toBeUndefined();
    expect(f.dateTaken).toBe("2024-05-01 10:30");
  });

  it("no EXIF date leaves dateTaken unset", async () => {
    mocks.parseExif.mockReturnValue(null);
    const f = await loadNameFacts({ uploadKey: "up", originalKey: "up" });
    expect(f.dateTaken).toBeUndefined();
  });

  it("a missing stored file is no facts, not a throw", async () => {
    expect(await loadNameFacts({ uploadKey: "gone", originalKey: "gone" })).toEqual({});
  });

  it("carries the file date remembered at upload", async () => {
    rememberFileDate("up", 1_700_000_000_000);
    const f = await loadNameFacts({ uploadKey: "up", originalKey: "cur" });
    expect(f.fileDate).toBe(1_700_000_000_000);
  });

  it("reads each stored file once (keys are content hashes, so the answer never changes)", async () => {
    await loadNameFacts({ uploadKey: "up", originalKey: "cur" });
    await loadNameFacts({ uploadKey: "up", originalKey: "cur" });
    expect(mocks.getOriginal).toHaveBeenCalledTimes(1);
  });

  it("a failed read is not cached", async () => {
    mocks.getOriginal.mockRejectedValueOnce(new Error("idb"));
    expect(await loadNameFacts({ uploadKey: "up", originalKey: "up" })).toEqual({});
    expect((await loadNameFacts({ uploadKey: "up", originalKey: "up" })).original).toBe("IMG_4021");
  });
});
