// Camera info, the export choice (Night 11-21, 231, ADR-108). Runs the three
// choices over the committed oracle fixtures (tests/fixtures/exif/), which
// carry GPS N 37°46'30.5" W 122°25'10", camera "TestCam"/"Model X" and a
// capture date of 2026:09:25 01:02:03.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { applyExifToReencoded, parseExifFromImage, readExifTiff } from "@/lib/exif";
import {
  cameraInfoForReencoded,
  cameraInfoForVerbatim,
  cameraInfoOf,
  prefsForCameraInfo,
} from "@/lib/exif/cameraInfo";
import { tiffOrientation } from "@/lib/exif/orientation";

type Bytes = Uint8Array<ArrayBuffer>;
const DIR = path.resolve(__dirname, "../../../../tests/fixtures/exif");
const fixture = (name: string): Bytes => new Uint8Array(fs.readFileSync(path.join(DIR, name)));

// A bare JPEG with no metadata at all — what an engine re-encode produces.
const BARE: Bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0x00, 0x02, 1, 2, 3, 4, 0xff, 0xd9]);

const exifOf = (b: Bytes) => parseExifFromImage(b, "image/jpeg");
const hasApp1 = (b: Bytes) => {
  for (let i = 0; i + 1 < b.length; i++) if (b[i] === 0xff && b[i + 1] === 0xe1) return true;
  return false;
};

describe("the choice is the two existing preferences", () => {
  it("maps both ways, and Keep leaves the strip scope alone", () => {
    expect(cameraInfoOf({ exifKeep: true, exifStripMode: "all" })).toBe("keep");
    expect(cameraInfoOf({ exifKeep: false, exifStripMode: "location" })).toBe("location");
    expect(cameraInfoOf({ exifKeep: false, exifStripMode: "all" })).toBe("all");
    expect(prefsForCameraInfo("keep", "location")).toEqual({ exifKeep: true, exifStripMode: "location" });
    expect(prefsForCameraInfo("location")).toEqual({ exifKeep: false, exifStripMode: "location" });
    expect(prefsForCameraInfo("all")).toEqual({ exifKeep: false, exifStripMode: "all" });
  });

  it("the default preferences mean Remove all, which is today's behavior", async () => {
    const { DEFAULT_PREFERENCES } = await import("@/lib/preferences");
    expect(cameraInfoOf(DEFAULT_PREFERENCES)).toBe("all");
  });
});

describe("a re-encoded export (single Download, edited ZIP entries, recipes)", () => {
  const src = fixture("jpeg_exif.in.bin");
  const tiff = readExifTiff(src, "image/jpeg");

  it("the fixture really carries GPS, a date and a camera", () => {
    const e = exifOf(src)!;
    expect(e.gps).toBeDefined();
    expect(e.dateTaken).toBe("2026-09-25 01:02");
    expect(e.model).toBe("Model X");
  });

  it("Remove location: no GPS tags; date and camera kept", () => {
    const out = cameraInfoForReencoded(BARE, "jpeg", "location", tiff, 2, 2);
    const e = exifOf(out)!;
    expect(e.gps).toBeUndefined();
    expect(e.dateTaken).toBe("2026-09-25 01:02");
    expect(e.make).toBe("TestCam");
    expect(e.model).toBe("Model X");
    // The coordinate bytes are gone, not just the pointer to them: the
    // latitude triple 37/1 46/1 3050/100 appears nowhere in the file.
    const lat = [0x25, 0, 0, 0, 1, 0, 0, 0, 0x2e, 0, 0, 0, 1, 0, 0, 0];
    expect(Buffer.from(out).includes(Buffer.from(lat))).toBe(false);
    expect(Buffer.from(src).includes(Buffer.from(lat))).toBe(true);
  });

  it("Remove all: no EXIF at all", () => {
    const out = cameraInfoForReencoded(BARE, "jpeg", "all", tiff, 2, 2);
    expect(out).toEqual(BARE);
    expect(hasApp1(out)).toBe(false);
  });

  it("Keep all: byte-identical to today for an upright photo", () => {
    const today = applyExifToReencoded(BARE, "jpeg", "keep", tiff, 2, 2);
    expect(cameraInfoForReencoded(BARE, "jpeg", "keep", tiff, 2, 2)).toEqual(today);
    expect(exifOf(today)!.gps).toBeDefined();
  });

  it("Keep all on a turned photo writes Orientation 1, since the pixels are already upright", () => {
    const rot = readExifTiff(fixture("jpeg_exif_rot6.in.bin"), "image/jpeg")!;
    expect(tiffOrientation(rot)).toBe(6);
    const out = cameraInfoForReencoded(BARE, "jpeg", "keep", rot, 2, 2);
    expect(tiffOrientation(readExifTiff(out, "image/jpeg"))).toBe(1);
    expect(exifOf(out)!.gps).toBeDefined(); // everything else kept
  });

  it("PNG and AVIF never carry a transplant, whatever the choice", () => {
    for (const c of ["keep", "location", "all"] as const) {
      expect(cameraInfoForReencoded(BARE, "png", c, tiff, 2, 2)).toEqual(BARE);
    }
  });
});

describe("a verbatim export or stored copy (the file's own bytes)", () => {
  it("Remove location: no GPS; date and camera kept; same length", () => {
    const src = fixture("jpeg_exif.in.bin");
    const out = cameraInfoForVerbatim(src, "image/jpeg", "location");
    expect(out.length).toBe(src.length);
    const e = exifOf(out)!;
    expect(e.gps).toBeUndefined();
    expect(e.dateTaken).toBe("2026-09-25 01:02");
    expect(e.model).toBe("Model X");
  });

  it("Remove all on an upright photo: no EXIF", () => {
    const out = cameraInfoForVerbatim(fixture("jpeg_exif.in.bin"), "image/jpeg", "all");
    expect(hasApp1(out)).toBe(false);
    expect(exifOf(out)).toBeNull();
  });

  it("Remove all on a turned photo keeps ONLY the orientation, so it isn't sideways", () => {
    const out = cameraInfoForVerbatim(fixture("jpeg_exif_rot6.in.bin"), "image/jpeg", "all");
    expect(exifOf(out)).toEqual({ orientation: 6 });
    const t = readExifTiff(out, "image/jpeg")!;
    expect(t.length).toBe(26); // header + one entry + next-IFD pointer
  });

  it("Remove all keeps the ICC profile on a turned photo too", () => {
    const out = cameraInfoForVerbatim(fixture("jpeg_exif_rot8_be_icc.in.bin"), "image/jpeg", "all");
    expect(exifOf(out)).toEqual({ orientation: 8 });
    expect(Buffer.from(out).includes(Buffer.from("ICC_PROFILE"))).toBe(true);
  });

  it("Keep all: the stored bytes, untouched", () => {
    const src = fixture("jpeg_exif_rot6.in.bin");
    expect(cameraInfoForVerbatim(src, "image/jpeg", "keep")).toBe(src);
  });
});
