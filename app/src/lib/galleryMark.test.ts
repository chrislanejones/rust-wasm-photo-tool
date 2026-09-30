import { describe, expect, it } from "vitest";
import { CONFLICT_CHOICES, pickGalleryMark, type GalleryPhotoState, type GalleryViewer } from "./galleryMark";

/* One mark per thumbnail, by priority, and silence for the local default.
 * These run against fixtures on purpose: tonight there is no backend for any
 * flag but the edit backup (Night 6 §0), so the rule is pinned before it has
 * anything to wire to. */

const PAID: GalleryViewer = { signedIn: true, paid: true, cloudAllowed: true };
const FREE: GalleryViewer = { signedIn: true, paid: false, cloudAllowed: true };
const OUT: GalleryViewer = { signedIn: false, paid: false, cloudAllowed: false };
const PAID_OFFLINE: GalleryViewer = { signedIn: true, paid: true, cloudAllowed: false };

const EVERYTHING: GalleryPhotoState = {
  uploadFailed: true,
  conflict: true,
  changedElsewhere: true,
  uploading: true,
  backedUp: true,
};

describe("one mark, by priority", () => {
  it("failed beats everything", () => {
    expect(pickGalleryMark(EVERYTHING, PAID)?.id).toBe("failed");
  });

  it("walks down the order as each higher state clears", () => {
    const steps: [Partial<GalleryPhotoState>, string][] = [
      [{ uploadFailed: false }, "conflict"],
      [{ uploadFailed: false, conflict: false }, "changedElsewhere"],
      [{ uploadFailed: false, conflict: false, changedElsewhere: false }, "working"],
      [{ uploadFailed: false, conflict: false, changedElsewhere: false, uploading: false }, "backedUp"],
    ];
    for (const [clear, want] of steps) {
      expect(pickGalleryMark({ ...EVERYTHING, ...clear }, PAID)?.id, want).toBe(want);
    }
  });

  it("returns ONE mark, never a list — the corner is not a status report", () => {
    const m = pickGalleryMark(EVERYTHING, PAID);
    expect(Array.isArray(m)).toBe(false);
    expect(m).not.toBeNull();
  });
});

describe("the calm default", () => {
  it("a local-only photo shows no mark at all", () => {
    for (const v of [PAID, FREE, OUT, PAID_OFFLINE]) {
      expect(pickGalleryMark({}, v)).toBeNull();
    }
  });

  it("an all-false state is also silent", () => {
    const off: GalleryPhotoState = {
      uploadFailed: false,
      conflict: false,
      changedElsewhere: false,
      uploading: false,
      backedUp: false,
    };
    expect(pickGalleryMark(off, PAID)).toBeNull();
  });
});

describe("who sees what", () => {
  it("signed out sees nothing, whatever the flags say", () => {
    expect(pickGalleryMark(EVERYTHING, OUT)).toBeNull();
  });

  it("free signed-in sees a failure, but not paid-only states", () => {
    expect(pickGalleryMark(EVERYTHING, FREE)?.id).toBe("failed");
    expect(pickGalleryMark({ conflict: true }, FREE)).toBeNull();
    expect(pickGalleryMark({ changedElsewhere: true }, FREE)).toBeNull();
    expect(pickGalleryMark({ backedUp: true }, FREE)).toBeNull();
  });

  it("with the online switch off, nothing about SENDING shows", () => {
    // Uploading and backed-up both describe a trip to the server; with the
    // switch off there has not been one.
    expect(pickGalleryMark({ uploading: true }, PAID_OFFLINE)).toBeNull();
    expect(pickGalleryMark({ backedUp: true }, PAID_OFFLINE)).toBeNull();
  });
});

describe("every mark has words", () => {
  const states: GalleryPhotoState[] = [
    { uploadFailed: true },
    { conflict: true },
    { changedElsewhere: true },
    { uploading: true },
    { backedUp: true },
  ];
  it.each(states.map((s) => [Object.keys(s)[0], s]))("%s has an accessible name", (_k, s) => {
    const m = pickGalleryMark(s as GalleryPhotoState, PAID);
    expect(m?.label?.trim().length ?? 0).toBeGreaterThan(3);
  });

  it("changed-elsewhere carries a dot so it reads unlike a plain upload", () => {
    expect(pickGalleryMark({ changedElsewhere: true }, PAID)?.dot).toBe(true);
    expect(pickGalleryMark({ uploading: true }, PAID)?.dot).toBeFalsy();
  });
});

describe("conflict is a door", () => {
  it("the conflict mark opens a menu", () => {
    expect(pickGalleryMark({ conflict: true }, PAID)?.opensMenu).toBe(true);
  });

  it("the menu offers exactly the three decided ways out", () => {
    expect(CONFLICT_CHOICES.map((c) => c.label)).toEqual([
      "Keep this one",
      "Use the other version",
      "Keep both",
    ]);
  });
});
