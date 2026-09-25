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
// course they do, they are one function. The question that still has teeth is:
// **does the stripper carry every field the engine emits except `tile_*`?**
//
// ── ⚠️ THIS GUARD WAS BLIND BY CONSTRUCTION, AND THAT IS WHY IT MOVED ───────
//
// It used to build its input from `Required<PersistedAnnotation>` — the app's
// OWN allowlist type. A field the ENGINE emits and `PersistedAnnotation` never
// declared cannot appear in an input typed from `PersistedAnnotation`, so the
// guard could not see the fields that were actually being dropped. It asked
// "does the stripper carry every field the stripper knows about?", which is a
// tautology wearing a useful question's clothes.
//
// It was blind to three of them for four versions. `annotations_to_json`
// (src/annotations.rs) has emitted `wrap_width` since v8.40, `box_height`
// since v8.41 and `perspective` since v8.42, and none of the three ever
// reached a user's IndexedDB — which is the reload bug ADR-060 fixes.
//
// So the input is now the ENGINE'S OWN captured output:
// tests/fixtures/oplog/v8-engine-text-annotations.json, `get_text_annotations()`
// verbatim, with the provenance in the file. Two sources of truth is the bug;
// the engine is the one that wins.
//
// ── THE LOOP THAT KEEPS THE FIXTURE HONEST ──────────────────────────────────
//
// A captured fixture can go stale, and a stale fixture is blind again. The
// Rust side closes that: `tests/oplog_v7_v8_fixture_resume.rs` ::
// `the_captured_engine_json_still_carries_every_key_the_engine_emits` compares
// this same fixture against a live `get_text_annotations()`. Add a field to
// the engine and that test goes red first, naming this file.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { stripLiveAnnotations, type PersistedAnnotation } from "./editPersistence";

const FIXTURES = resolve(dirname(fileURLToPath(import.meta.url)), "../../../tests/fixtures/oplog");

/** `ImageHorseTool::get_text_annotations()` verbatim — one text with a
 *  non-default face, a box dragged to 168×96, and every other field the engine
 *  writes. Captured, not typed. */
const ENGINE_JSON: string = JSON.parse(
  readFileSync(resolve(FIXTURES, "v8-engine-text-annotations.json"), "utf8"),
).engineJson;

/** The tile cache. The ONLY thing the stripper is allowed to remove: it is
 *  re-rendered on restore, so persisting it bakes in something stale. */
const TILE_FIELDS = ["tile_w", "tile_h", "tile_offset_x", "tile_offset_y"];

/** Every key the engine emitted, minus the tile cache — what the archive must
 *  carry, derived from the engine's bytes rather than declared here. */
const EXPECTED_KEYS = Object.keys(
  (JSON.parse(ENGINE_JSON) as Array<Record<string, unknown>>)[0]!,
)
  .filter((k) => !TILE_FIELDS.includes(k))
  .sort();

/** Every field of `PersistedAnnotation`, with a distinguishable value. Adding a
 *  field to the interface without adding it here is a type error. This is no
 *  longer the guard's INPUT — it is the other side of a two-way comparison, so
 *  a field the engine grows and the app never declares is caught, and so is a
 *  field the app declares that the engine does not emit. */
const FULL_ANNOTATION: Required<PersistedAnnotation> = {
  id: 7,
  text: "hello",
  x: 10,
  y: 20,
  font_size: 32,
  r: 1, g: 2, b: 3,
  bold: true,
  font_id: "liberation-serif",
  rotation_deg: 15,
  wrap_width: 168,
  box_height: 96,
  perspective: [0, 0, 1, 0, 1, 1, 0, 1],
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

describe("stripLiveAnnotations", () => {
  it("keeps every field THE ENGINE emits and drops only tile_*", () => {
    // The whole point of the file, asked against the engine's own bytes.
    const [out] = stripLiveAnnotations(ENGINE_JSON);
    expect(Object.keys(out!).sort()).toEqual(EXPECTED_KEYS);
  });

  it("the app's declared type matches what the engine emits, both ways", () => {
    // Two-way, so neither side can drift silently:
    //   engine grows a field → EXPECTED_KEYS gains it → PersistedAnnotation
    //     must declare it (and `restoreLayerStack` must hand it back);
    //   app declares a field the engine does not emit → it is dead weight in
    //     IndexedDB and this names it.
    expect(Object.keys(FULL_ANNOTATION).sort()).toEqual(EXPECTED_KEYS);
  });

  it("carries the box axes and the quad the archive used to drop", () => {
    // ADR-060, named. Emitted since v8.40 / v8.41 / v8.42, on disk since
    // v8.81. A dragged box came back unwrapped for four versions because the
    // allowlist above this comment did not mention them.
    const [out] = stripLiveAnnotations(ENGINE_JSON);
    expect(out!.wrap_width, "wrap_width must survive stripping").toBe(168);
    expect(out!.box_height, "box_height must survive stripping").toBe(96);
    expect(out!.perspective, "the corner quad must survive stripping").toEqual([
      0, 0, 1, 0, 1, 1, 0, 1,
    ]);
  });

  it("carries the typeface — the same regression shape as the shadows below", () => {
    // v8.76. A dropped `font_id` would put the archive's text back in
    // Liberation Sans on the other device, which is exactly how the nine
    // shadow fields were lost before #22: a field added to the engine and not
    // to the strip map is silently absent, not an error.
    const [out] = stripLiveAnnotations(ENGINE_JSON);
    expect(out!.font_id, "font_id must survive stripping").toBe("liberation-serif");
  });

  it("carries the nine shadow fields the cloud copy used to drop", () => {
    // The regression, named. Before #22 the archive reached the other device
    // with these missing and the text rendered flat.
    const engine = (JSON.parse(ENGINE_JSON) as Array<Record<string, unknown>>)[0]!;
    const [out] = stripLiveAnnotations(ENGINE_JSON);
    for (const k of [
      "shadow_box", "shadow_text", "shadow_r", "shadow_g", "shadow_b",
      "shadow_a", "shadow_dx", "shadow_dy", "shadow_blur",
    ] as const) {
      expect(out![k], `${k} must survive stripping`).toBe(engine[k]);
    }
  });

  it("preserves the values, not just the keys", () => {
    const engine = JSON.parse(ENGINE_JSON) as Array<Record<string, unknown>>;
    const expected = { ...engine[0]! };
    for (const k of TILE_FIELDS) delete expected[k];
    expect(stripLiveAnnotations(ENGINE_JSON)[0]).toEqual(expected);
  });

  it("never emits tile_* — the whole reason the map exists", () => {
    const out = stripLiveAnnotations(ENGINE_JSON);
    for (const k of TILE_FIELDS) {
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
    // Both call sites relied on their own try/catch for this; the behavior
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
    expect(Object.keys(stale!).sort()).not.toEqual(EXPECTED_KEYS);
    // ...and specifically, it is the shadows that go missing.
    expect(stale).not.toHaveProperty("shadow_blur");
    expect(stripLiveAnnotations(ENGINE_JSON)[0]).toHaveProperty("shadow_blur");
  });

  it("FIXTURE CHECK: the v8.80 allowlist really would fail this guard", () => {
    // The second one, and the reason this file was rewritten: the map that
    // shipped in v8.80 carried the shadows and the face and still dropped the
    // box. Against `Required<PersistedAnnotation>` as it was then, it passed.
    // Against the engine's own JSON, it does not.
    const v880Strip = (raw: string): Record<string, unknown>[] =>
      (JSON.parse(raw) as Record<string, unknown>[]).map((a) => {
        const kept: Record<string, unknown> = { ...a };
        for (const k of [...TILE_FIELDS, "wrap_width", "box_height", "perspective"]) {
          delete kept[k];
        }
        return kept;
      });

    const [stale] = v880Strip(ENGINE_JSON);
    expect(Object.keys(stale!).sort()).not.toEqual(EXPECTED_KEYS);
    expect(stale).not.toHaveProperty("wrap_width");
    expect(stripLiveAnnotations(ENGINE_JSON)[0]).toHaveProperty("wrap_width");
  });

  it("handles several annotations", () => {
    const one = (JSON.parse(ENGINE_JSON) as Array<Record<string, unknown>>)[0]!;
    const raw = JSON.stringify([
      { ...one, id: 1 },
      { ...one, id: 2 },
    ]);
    const out = stripLiveAnnotations(raw);
    expect(out.map((a) => a.id)).toEqual([1, 2]);
    expect(out.every((a) => !("tile_w" in a))).toBe(true);
  });
});
