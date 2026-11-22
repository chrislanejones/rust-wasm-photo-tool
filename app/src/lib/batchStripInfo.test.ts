import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseExifFromImage } from "@/lib/exif";
import { confirmText, stripStoredCopy, type StripDeps } from "@/lib/batchStripInfo";

const DIR = path.resolve(__dirname, "../../../tests/fixtures/exif");
const fixture = (name: string) => new Uint8Array(fs.readFileSync(path.join(DIR, name)));

/** A content-addressed fake of the originals store. */
function fakeStore(seed: Record<string, Uint8Array>) {
  const blobs = new Map<string, Uint8Array>(Object.entries(seed));
  let n = 0;
  const deps: StripDeps = {
    async getOriginal(key) {
      const b = blobs.get(key);
      return b ? { bytes: b.slice().buffer, mimeType: "image/jpeg", name: "p.jpg", width: 2, height: 2 } : null;
    },
    async putOriginal(file) {
      const key = `new-${++n}`;
      blobs.set(key, new Uint8Array(await file.arrayBuffer()));
      return key;
    },
  };
  return { deps, blobs };
}

const photo = (o: Partial<{ originalKey: string; uploadKey: string; mimeType: string }> = {}) => ({
  id: "p1",
  name: "p",
  mimeType: o.mimeType ?? "image/jpeg",
  originalKey: o.originalKey ?? "K",
  uploadKey: "uploadKey" in o ? o.uploadKey : (o.originalKey ?? "K"),
});

describe("Batch › Strip info, one photo's stored copy", () => {
  it("Remove location: a new stored file with no GPS; date and camera kept; both keys move", async () => {
    const { deps, blobs } = fakeStore({ K: fixture("jpeg_exif.in.bin") });
    const r = await stripStoredCopy(photo(), "location", deps);
    expect(r.status).toBe("stripped");
    if (r.status !== "stripped") return;
    expect(r.patch.originalKey).toBe("new-1");
    expect(r.patch.uploadKey).toBe("new-1");
    expect(r.replaced).toEqual([["K", "new-1"]]);
    const e = parseExifFromImage(blobs.get("new-1")! as Uint8Array<ArrayBuffer>, "image/jpeg")!;
    expect(e.gps).toBeUndefined();
    expect(e.model).toBe("Model X");
    expect(e.dateTaken).toBe("2026-09-25 01:02");
  });

  it("a repointed photo has its upload original scrubbed too, so Keep all can't bring GPS back", async () => {
    const plain = fixture("jpeg_plain.in.bin"); // e.g. what Resize wrote: no EXIF
    const { deps, blobs } = fakeStore({ R: plain, U: fixture("jpeg_exif.in.bin") });
    const r = await stripStoredCopy(photo({ originalKey: "R", uploadKey: "U" }), "location", deps);
    expect(r.status).toBe("stripped");
    if (r.status !== "stripped") return;
    expect(r.patch.originalKey).toBe("R"); // nothing to remove there
    expect(r.patch.uploadKey).toBe("new-1");
    expect(r.replaced).toEqual([["U", "new-1"]]);
    expect(parseExifFromImage(blobs.get("new-1")! as Uint8Array<ArrayBuffer>, "image/jpeg")!.gps).toBeUndefined();
  });

  it("Remove all on a turned photo keeps only the orientation", async () => {
    const { deps, blobs } = fakeStore({ K: fixture("jpeg_exif_rot6.in.bin") });
    const r = await stripStoredCopy(photo(), "all", deps);
    expect(r.status).toBe("stripped");
    expect(parseExifFromImage(blobs.get("new-1")! as Uint8Array<ArrayBuffer>, "image/jpeg")).toEqual({ orientation: 6 });
  });

  it("a photo with nothing to remove is left alone, with no new file", async () => {
    const { deps, blobs } = fakeStore({ K: fixture("jpeg_plain.in.bin") });
    const r = await stripStoredCopy(photo(), "all", deps);
    expect(r.status).toBe("clean");
    expect(blobs.size).toBe(1);
  });

  it("Leave as is, an SVG and a missing file are not written", async () => {
    const { deps } = fakeStore({ K: fixture("jpeg_exif.in.bin") });
    expect((await stripStoredCopy(photo(), "keep", deps)).status).toBe("skipped");
    expect((await stripStoredCopy(photo({ mimeType: "image/svg+xml" }), "all", deps)).status).toBe("skipped");
    expect((await stripStoredCopy(photo({ originalKey: "gone" }), "all", deps)).status).toBe("failed");
  });

  it("the confirm says what it removes, how many, and that it can't be undone", () => {
    expect(confirmText({ location: 12, all: 0 })).toBe("This removes location from 12 photos. It can't be undone.");
    expect(confirmText({ location: 1, all: 2 })).toBe(
      "This removes location from 1 photo and all camera info from 2 photos. It can't be undone.",
    );
  });
});
