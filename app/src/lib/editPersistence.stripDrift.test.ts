// #22 — the local save and the cloud archive kept SEPARATE copies of the
// live-text stripping map, and they drifted.
//
// Local (`editPersistence.savePhotoEdit`) kept `shadow_box` … `shadow_blur`.
// The cloud path (`hooks/useEditPersistence`) stopped at `bg_tail` and silently
// dropped all nine `shadow_*` fields. So a local restore kept your drop
// shadows and a cross-device restore lost them, with no error on either side.
// Invisible until v7.56, because the cloud path never ran in production.
//
// Both call `stripLiveAnnotations` now, so identity is structural rather than
// coincidental. That makes "do the two agree?" the wrong question to test — of
// course they do, they are one function. The question that still has teeth, and
// the one that failed before this change, is: **does the stripper carry every
// field the engine emits except `tile_*`?** A future field added to
// `PersistedAnnotation` and forgotten in the map is the same bug returning, and
// this pins it.
import { describe, expect, it } from "vitest";
import { stripLiveAnnotations, type PersistedAnnotation } from "./editPersistence";

/** Every field of `PersistedAnnotation`, with a distinguishable value. Adding a
 *  field to the interface without adding it here is a type error; adding it in
 *  both places without teaching the stripper fails the first test below. */
const FULL_ANNOTATION: Required<PersistedAnnotation> = {
  id: 7,
  text: "hello",
  x: 10,
  y: 20,
  font_size: 32,
  r: 1, g: 2, b: 3,
  bold: true,
  rotation_deg: 15,
  background_kind: 2,
  bg_r: 4, bg_g: 5, bg_b: 6, bg_a: 7,
  bg_padding: 8,
  bg_corner_radius: 9,
  bg_tail: 10,
  shadow_box: true,
  shadow_text: true,
  shadow_r: 11, shadow_g: 12, shadow_b: 13, shadow_a: 14,
  shadow_dx: 15, shadow_dy: 16,
  shadow_blur: 17,
};

/** What the engine actually hands over: the annotation plus its tile cache. */
const ENGINE_JSON = JSON.stringify([
  { ...FULL_ANNOTATION, tile_w: 100, tile_h: 50, tile_offset_x: 3, tile_offset_y: 4 },
]);

describe("stripLiveAnnotations", () => {
  it("keeps every PersistedAnnotation field and drops only tile_*", () => {
    const [out] = stripLiveAnnotations(ENGINE_JSON);
    expect(Object.keys(out!).sort()).toEqual(Object.keys(FULL_ANNOTATION).sort());
  });

  it("preserves the values, not just the keys", () => {
    const [out] = stripLiveAnnotations(ENGINE_JSON);
    expect(out).toEqual(FULL_ANNOTATION);
  });

  it("carries the nine shadow fields the cloud copy used to drop", () => {
    // The regression, named. Before #22 the archive reached the other device
    // with these missing and the text rendered flat.
    const [out] = stripLiveAnnotations(ENGINE_JSON);
    for (const k of [
      "shadow_box", "shadow_text", "shadow_r", "shadow_g", "shadow_b",
      "shadow_a", "shadow_dx", "shadow_dy", "shadow_blur",
    ] as const) {
      expect(out![k], `${k} must survive stripping`).toBe(FULL_ANNOTATION[k]);
    }
  });

  it("never emits tile_* — the whole reason the map exists", () => {
    const out = stripLiveAnnotations(ENGINE_JSON);
    for (const k of ["tile_w", "tile_h", "tile_offset_x", "tile_offset_y"]) {
      expect(out[0]).not.toHaveProperty(k);
    }
  });

  it("survives an annotation with none of the optional fields set", () => {
    // Old text created before backgrounds/shadows existed. Optional fields come
    // back as undefined rather than throwing, and JSON.stringify drops them —
    // which is what keeps the persisted bytes identical to before.
    const minimal = { id: 1, text: "t", x: 0, y: 0, font_size: 12, r: 0, g: 0, b: 0, bold: false, rotation_deg: 0 };
    const [out] = stripLiveAnnotations(JSON.stringify([{ ...minimal, tile_w: 1, tile_h: 1, tile_offset_x: 0, tile_offset_y: 0 }]));
    expect(JSON.parse(JSON.stringify(out))).toEqual(minimal);
  });

  it("returns [] for malformed JSON instead of throwing mid-save", () => {
    // Both call sites relied on their own try/catch for this; the behaviour
    // moved into the function and must not have been lost on the way.
    expect(stripLiveAnnotations("not json")).toEqual([]);
    expect(stripLiveAnnotations("")).toEqual([]);
  });

  it("FIXTURE CHECK: the old cloud map really would fail this guard", () => {
    // A guard that cannot fail proves nothing. This is the pre-#22 cloud map,
    // verbatim — it stopped at bg_tail — run against the same assertion the
    // real stripper passes above. If this ever starts matching, the guard has
    // stopped guarding.
    const oldCloudStrip = (raw: string): Record<string, unknown>[] =>
      (JSON.parse(raw) as Record<string, unknown>[]).map((a) => ({
        id: a.id, text: a.text, x: a.x, y: a.y, font_size: a.font_size,
        r: a.r, g: a.g, b: a.b, bold: a.bold, rotation_deg: a.rotation_deg,
        background_kind: a.background_kind,
        bg_r: a.bg_r, bg_g: a.bg_g, bg_b: a.bg_b, bg_a: a.bg_a,
        bg_padding: a.bg_padding, bg_corner_radius: a.bg_corner_radius,
        bg_tail: a.bg_tail,
      }));

    const [stale] = oldCloudStrip(ENGINE_JSON);
    expect(Object.keys(stale!).sort()).not.toEqual(Object.keys(FULL_ANNOTATION).sort());
    // ...and specifically, it is the shadows that go missing.
    expect(stale).not.toHaveProperty("shadow_blur");
    expect(stripLiveAnnotations(ENGINE_JSON)[0]).toHaveProperty("shadow_blur");
  });

  it("handles several annotations", () => {
    const raw = JSON.stringify([
      { ...FULL_ANNOTATION, id: 1, tile_w: 1, tile_h: 1, tile_offset_x: 0, tile_offset_y: 0 },
      { ...FULL_ANNOTATION, id: 2, tile_w: 2, tile_h: 2, tile_offset_x: 0, tile_offset_y: 0 },
    ]);
    const out = stripLiveAnnotations(raw);
    expect(out.map((a) => a.id)).toEqual([1, 2]);
    expect(out.every((a) => !("tile_w" in a))).toBe(true);
  });
});
