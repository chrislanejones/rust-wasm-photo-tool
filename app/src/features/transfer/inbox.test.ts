// "Add to gallery" (features/transfer/inbox.ts, ADR-102): a photo leaves the
// inbox ONLY after its own import landed and the gallery manifest has it.
import { describe, expect, it, vi } from "vitest";
import type { AddPhotosResult } from "@/lib/addPhotosResult";
import { addToGallery, expiresIn, NOT_CONFIRMED, waitForManifest, type AddDeps, type InboxEntry } from "./inbox";

const item = (id: string, url: string | null = `https://files.invalid/${id}`): InboxEntry => ({
  id,
  name: `${id}.jpg`,
  mime: "image/jpeg",
  url,
});

function deps(outcomes: (files: File[]) => AddPhotosResult | void, over: Partial<AddDeps> = {}) {
  const d = {
    download: vi.fn(async (it: InboxEntry) => new File([new Uint8Array(1)], it.name, { type: it.mime })),
    addPhotos: vi.fn(async (files: File[]) => outcomes(files)),
    confirmSaved: vi.fn(async () => true),
    receive: vi.fn(async () => ({ removed: true })),
    ...over,
  };
  return d;
}

const allAdded = (files: File[]): AddPhotosResult => ({
  outcomes: files.map((f) => ({ status: "added" as const, photoId: `g-${f.name}` })),
});

describe("addToGallery", () => {
  it("Add all: one import call with every file, then receive for each", async () => {
    const d = deps(allAdded);
    const report = await addToGallery([item("a"), item("b"), item("c")], d);
    expect(d.addPhotos).toHaveBeenCalledTimes(1);
    expect(d.addPhotos.mock.calls[0]![0].map((f: File) => f.name)).toEqual(["a.jpg", "b.jpg", "c.jpg"]);
    expect(d.confirmSaved).toHaveBeenCalledWith(["g-a.jpg", "g-b.jpg", "g-c.jpg"]);
    expect(d.receive.mock.calls.map((c) => c[0])).toEqual(["a", "b", "c"]);
    expect(report).toEqual({ added: ["a", "b", "c"], errors: {}, overLimit: [] });
  });

  it("an import that fails stays in the inbox with its error, and is never received", async () => {
    const d = deps(() => ({
      outcomes: [
        { status: "added", photoId: "g1" },
        { status: "failed", message: "Couldn't open b.jpg." },
      ],
    }));
    const report = await addToGallery([item("a"), item("b")], d);
    expect(d.receive.mock.calls.map((c) => c[0])).toEqual(["a"]);
    expect(report.errors).toEqual({ b: "Couldn't open b.jpg." });
  });

  it("the gallery limit holds: what the import left out stays, and is counted", async () => {
    const d = deps(() => ({
      outcomes: [{ status: "added", photoId: "g1" }, { status: "over-limit" }, { status: "over-limit" }],
    }));
    const report = await addToGallery([item("a"), item("b"), item("c")], d);
    expect(d.receive.mock.calls.map((c) => c[0])).toEqual(["a"]);
    expect(report.overLimit).toEqual(["b", "c"]);
  });

  it("nothing is received until the manifest has the photos", async () => {
    const d = deps(allAdded, { confirmSaved: vi.fn(async () => false) });
    const report = await addToGallery([item("a")], d);
    expect(d.receive).not.toHaveBeenCalled();
    expect(report.errors).toEqual({ a: NOT_CONFIRMED });
  });

  it("a funnel that reports nothing is treated as unconfirmed", async () => {
    const d = deps(() => undefined);
    const report = await addToGallery([item("a")], d);
    expect(d.receive).not.toHaveBeenCalled();
    expect(report.errors.a).toBe(NOT_CONFIRMED);
  });

  it("a download that fails, or a file already gone, never reaches the import", async () => {
    const d = deps(allAdded, {
      download: vi.fn(async (it: InboxEntry) => {
        if (it.id === "a") throw new Error("403");
        return new File([new Uint8Array(1)], it.name);
      }),
    });
    const report = await addToGallery([item("a"), item("gone", null), item("c")], d);
    expect(d.addPhotos.mock.calls[0]![0].map((f: File) => f.name)).toEqual(["c.jpg"]);
    expect(Object.keys(report.errors).sort()).toEqual(["a", "gone"]);
    expect(report.added).toEqual(["c"]);
  });
});

describe("waitForManifest", () => {
  it("resolves true once every id is stored, false at the deadline", async () => {
    let photos: { id: string }[] = [];
    const load = vi.fn(async () => ({ photos }));
    setTimeout(() => (photos = [{ id: "x" }, { id: "y" }]), 30);
    expect(await waitForManifest(["x", "y"], load, { timeoutMs: 1_000, everyMs: 10 })).toBe(true);
    expect(await waitForManifest(["z"], load, { timeoutMs: 40, everyMs: 10 })).toBe(false);
  });
});

describe("expiresIn", () => {
  it("rounds up, so a photo sent a minute ago reads 7 days", () => {
    const now = 1_000_000_000;
    expect(expiresIn(now + 7 * 86_400_000 - 60_000, now)).toBe("Expires in 7 days");
    expect(expiresIn(now + 3_600_000, now)).toBe("Expires today");
    expect(expiresIn(now - 1, now)).toBe("Expired, removed soon");
  });
});
