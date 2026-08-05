// ===== FILE: app/src/lib/saveOwnership.test.ts =====
//
// The archive-ownership guard.
//
// `savePhotoEdit(photoId, toolRef)` reads whatever document the engine is
// currently holding and writes it under `edit-${photoId}`. It never checked that
// the engine was actually holding THAT photo. Normally it is, so nothing showed.
//
// It stops being true the moment a photo switch is superseded. Measured in a
// real session 2026-08-05 (13s switches, 10 of 10 supersedes inside
// saveOutgoing):
//
//   1. paint photo A            → engine holds A, undoCount 1
//   2. click B                  → activePhotoId := B, but the switch dies in
//                                 saveOutgoing; the engine STILL holds A
//   3. click C                  → "outgoing" is now B, engine still holds A,
//                                 undoCount still 1 → B reads as modified →
//                                 B's archive is written with A's pixels
//
// Confirmed against the live IndexedDB: four photos, four different aspect
// ratios in the gallery, and all four `edit-*` archives decoded to 1445x2128 —
// the painted car's dimensions. Photos the user never touched now restore as
// the car.
//
// PHASE 1 of these tests reproduced that against the shipped code and passed,
// which was the evidence the mechanism was real rather than inferred. They are
// INVERTED here: the same sequence must now refuse.
//
// The assertions are about OWNERSHIP rather than pixels — a fake engine whose
// document is identifiable by its dimensions — because that is the actual
// invariant. "Photo B's archive holds photo B's document" is the property; the
// car is just how it was noticed.
import { beforeEach, describe, expect, it } from "vitest";

import { savePhotoEdit, loadPhotoEdit, deletePhotoEdit } from "@/lib/editPersistence";
import {
  setEngineDocument,
  engineDocumentStats,
  __resetEngineDocument,
} from "@/lib/engineDocument";
import type { ImageHorseTool } from "stamp_tool";

/** A stand-in engine whose document is identifiable by its dimensions. */
function fakeTool(docWidth: number, docHeight: number) {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, docWidth & 0xff, docHeight & 0xff]);
  return {
    export_png: () => png,
    width: () => docWidth,
    height: () => docHeight,
    undo_snapshot_count: () => 1,
    get_undo_snapshot_png: () => png,
    get_undo_snapshot_label: () => "Brush",
    get_undo_snapshot_annotations: () => "[]",
    redo_snapshot_count: () => 0,
    get_redo_snapshot_png: () => png,
    get_redo_snapshot_label: () => "",
    get_redo_snapshot_annotations: () => "[]",
    get_text_annotations: () => "[]",
    get_shape_annotations: () => "[]",
    active_layer_id: () => 0,
    get_layers: () => "[]",
    layer_count: () => 0,
  } as unknown as ImageHorseTool;
}

const PHOTO_A = "photo-a-the-one-actually-painted";
const PHOTO_B = "photo-b-never-touched";

// A = 1445x2128 (the real car), B is a different shape entirely.
const A_W = 1445;
const A_H = 2128;
const B_W = 2048;
const B_H = 1365;

beforeEach(async () => {
  await deletePhotoEdit(PHOTO_A);
  await deletePhotoEdit(PHOTO_B);
  __resetEngineDocument();
});

describe("the guard refuses a cross-photo write", () => {
  it("will not write A's document under B's id", async () => {
    // The engine holds A. The app believes it is saving B (superseded switch).
    setEngineDocument(PHOTO_A);
    const toolRef = { current: fakeTool(A_W, A_H) };

    const written = await savePhotoEdit(PHOTO_B, toolRef);

    expect(written).toBe(false);
    // The corruption, in one assertion: B has no archive at all, rather than
    // one containing A's canvas.
    expect(await loadPhotoEdit(PHOTO_B)).toBeNull();
  });

  it("leaves an untouched photo without an undo stack it never earned", async () => {
    // Why the corruption was self-sustaining: B used to end up with an archive
    // carrying one undo entry, so the next visit restored it, undoCount came
    // back as 1, B read as modified again, and it was re-saved on every switch
    // forever. No archive, no loop.
    setEngineDocument(PHOTO_A);
    const toolRef = { current: fakeTool(A_W, A_H) };

    await savePhotoEdit(PHOTO_B, toolRef);

    expect(await loadPhotoEdit(PHOTO_B)).toBeNull();
  });

  it("refuses every id except the one the engine holds", async () => {
    // The same engine state used to be writable under any number of ids, and
    // every write succeeded. Now exactly one does.
    setEngineDocument(PHOTO_A);
    const toolRef = { current: fakeTool(A_W, A_H) };

    expect(await savePhotoEdit(PHOTO_A, toolRef)).toBe(true);
    expect(await savePhotoEdit(PHOTO_B, toolRef)).toBe(false);

    const a = await loadPhotoEdit(PHOTO_A);
    expect(a!.canvasW).toBe(A_W);
    expect(await loadPhotoEdit(PHOTO_B)).toBeNull();
  });
});

describe("the guard does not refuse legitimate work", () => {
  // This half matters more than the half above. A guard that refuses too much
  // destroys work the user really did, which is worse than the bug it fixes.

  it("allows the save when the engine holds the expected photo", async () => {
    setEngineDocument(PHOTO_A);
    const toolRef = { current: fakeTool(A_W, A_H) };

    expect(await savePhotoEdit(PHOTO_A, toolRef)).toBe(true);

    const a = await loadPhotoEdit(PHOTO_A);
    expect(a!.canvasW).toBe(A_W);
    expect(a!.undoStack).toHaveLength(1);
  });

  it("allows the save when ownership is UNKNOWN", async () => {
    // The deliberate one-directional bias, and the opposite of the collector's
    // "when in doubt, keep the bytes". A missed setEngineDocument call must
    // degrade to the shipped behaviour, never to a refusal.
    __resetEngineDocument(); // holding === null
    const toolRef = { current: fakeTool(B_W, B_H) };

    expect(await savePhotoEdit(PHOTO_B, toolRef)).toBe(true);
    expect((await loadPhotoEdit(PHOTO_B))!.canvasW).toBe(B_W);
  });

  it("saves the incoming photo normally after a real switch", async () => {
    // The whole point: a switch that COMPLETES moves ownership, so the photo
    // the user is now editing saves exactly as before.
    setEngineDocument(PHOTO_A);
    const aRef = { current: fakeTool(A_W, A_H) };
    expect(await savePhotoEdit(PHOTO_A, aRef)).toBe(true);

    setEngineDocument(PHOTO_B); // B's load landed
    const bRef = { current: fakeTool(B_W, B_H) };
    expect(await savePhotoEdit(PHOTO_B, bRef)).toBe(true);

    expect((await loadPhotoEdit(PHOTO_A))!.canvasW).toBe(A_W);
    expect((await loadPhotoEdit(PHOTO_B))!.canvasW).toBe(B_W);
  });
});

describe("the guard reports whether it is doing anything", () => {
  // A guard whose allow-unknown rate is high allows everything and only reads
  // like a fix. These are the counts the re-measure checks in the browser via
  // window.__ihSaveGuard().

  it("counts each branch at the decision point", async () => {
    const toolRef = { current: fakeTool(A_W, A_H) };

    await savePhotoEdit(PHOTO_A, toolRef); // unknown → allowed
    setEngineDocument(PHOTO_A);
    await savePhotoEdit(PHOTO_A, toolRef); // known, matches → allowed
    await savePhotoEdit(PHOTO_B, toolRef); // known, differs → refused

    expect(engineDocumentStats()).toEqual({
      holding: PHOTO_A,
      allowedUnknown: 1,
      allowedKnown: 1,
      refused: 1,
    });
  });

  it("stops reporting unknown once a photo has loaded", async () => {
    // The fixture-level answer to 'how often does unknown actually fire': once,
    // before the first load, and never again while ownership is maintained.
    // The browser number is Phase 6's job — fixtures cannot prove the real app
    // maintains it, only that maintaining it produces this.
    const toolRef = { current: fakeTool(A_W, A_H) };

    await savePhotoEdit(PHOTO_A, toolRef); // boot: nothing loaded yet
    expect(engineDocumentStats().allowedUnknown).toBe(1);

    setEngineDocument(PHOTO_A);
    for (let i = 0; i < 5; i++) await savePhotoEdit(PHOTO_A, toolRef);

    expect(engineDocumentStats().allowedUnknown).toBe(1); // still just the one
    expect(engineDocumentStats().allowedKnown).toBe(5);
  });
});
