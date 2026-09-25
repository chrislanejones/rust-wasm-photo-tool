// A DRAGGED TEXT BOX SURVIVES A RELOAD. Four of these rows were RED when the
// file was written; ADR-060 is what turned them green.
//
// PARKING LOT: "a dragged text box does not survive a reload" (2026-08-14,
// docs/PARKING_LOT.md). Re-reproduced 2026-09-20 against the PRODUCTION build
// at https://edit.imagehorse.app (commit 34dd0d9, OP_FORMAT_VERSION 8), logged
// out, shipped defaults:
//
//   type a text, drag its right box handle 120 px left so the words reflow to
//   two lines, press Enter, reload, click "Resume editing"
//     → the text came back on ONE unwrapped line, running off the canvas.
//
// Screenshots and the raw IndexedDB dumps are in FINDINGS-oplog-and-text-0919.md.
//
// ── WHY THE EXISTING GUARD DID NOT CATCH IT ─────────────────────────────────
//
// editPersistence.stripDrift.test.ts asks exactly the right question — "does
// the stripper carry every field the engine emits except tile_*?" — and then
// built its input from `Required<PersistedAnnotation>`, the app's OWN
// allowlist type. A field the engine emits and `PersistedAnnotation` never
// declared cannot appear in that input, so the guard was blind to precisely
// the fields that were being dropped. That is the #22 shadow_* failure a
// second time, one level up: two sources of truth, and the test written
// against the wrong one. (That guard now reads the engine's captured JSON
// too — same fixture as this file.)
//
// So the input here is NOT typed from the app. It is the engine's own
// `get_text_annotations()` output, captured verbatim into
// tests/fixtures/oplog/v8-engine-text-annotations.json (provenance in the file
// and in tests/fixtures/oplog/README.md).
//
// ── THE SHAPE HALVES ARE CONTROLS ───────────────────────────────────────────
//
// A red row is a harness claim first. `sloppiness` — the setting whose twin
// bug shapes never had, because `parseShapes` was never an allowlist — rides
// through both halves of the archive round trip. If a text row goes red while
// its shape row stays green, the harness works and the text path is the thing
// that is broken.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { stripLiveAnnotations, parseShapes, type PersistedLayer } from "./editPersistence";
import { restoreLayerStack, type PngDecoder } from "./restoreLayerStack";

const FIXTURES = resolve(dirname(fileURLToPath(import.meta.url)), "../../../tests/fixtures/oplog");

/** The engine's own JSON for one text: a non-default face, a box dragged to
 *  168 px wide and 96 px tall. Captured, not typed. */
const ENGINE_TEXT_JSON: string = JSON.parse(
  readFileSync(resolve(FIXTURES, "v8-engine-text-annotations.json"), "utf8"),
).engineJson;

/** The same session's shape, straight out of the live archive record: the
 *  control, because shapes already carry their settings. */
const ARCHIVE_SHAPES_JSON: string = JSON.stringify(
  JSON.parse(readFileSync(resolve(FIXTURES, "v8-archive-edit-record.json"), "utf8")).shapes,
);

// ── Argument positions in `restore_text_annotation` ─────────────────────────
//
// ⚠️ CORRECTED FROM THE FIRST DRAFT OF THIS FILE, which read the width at
// index 26 and called the call "26 arguments ... ending at font_id". Counted
// against the Rust signature (src/layer.rs) and against the call site
// (restoreLayerStack.ts), the pre-v8.81 call takes TWENTY-SEVEN arguments —
// text, font_size, r, g, b, bold, x, y, rotation_deg, background_kind, four
// bg colour channels, bg_padding, bg_corner_radius, bg_tail, two shadow
// toggles, four shadow colour channels, shadow_dx, shadow_dy, shadow_blur,
// font_id — so `font_id` is index 26 and the width is index 27.
//
// The assertions did not change; an index did. The miscount would have made
// this harness read a STRING slot and report "the engine was never told",
// which is a false red — the exact failure mode `feedback_red_test_row_is_a_
// harness_claim` names. `the_font_id_slot_is_where_this_file_thinks_it_is`
// below is the guard that stops it silently happening again.
const ARG_FONT_ID = 26;
const ARG_WRAP_WIDTH = 27;
const ARG_BOX_HEIGHT = 28;
const ARG_PERSPECTIVE = 29;

/** Records what the restore path actually tells the engine.
 *
 *  It accepts BOTH shapes a fix could take, so the assertion does not
 *  prejudge the design: extra trailing arguments on `restore_text_annotation`
 *  (the way `font_id` and `sloppiness` were added), or a follow-up
 *  `set_text_wrap_width` / `set_text_box_height` call (both exports exist
 *  today — stamp_tool.d.ts:935 and :942 — and useTextTool already commits
 *  through them). Either way the engine ends up believing a width, and that
 *  is what `wrapWidthOf` reports. */
class RecordingTool {
  nextId = 0;
  /** Every argument list `restore_text_annotation` was called with. */
  textCalls: unknown[][] = [];
  shapeCalls: unknown[][] = [];
  wrapSet = new Map<number, number>();
  boxSet = new Map<number, number>();
  layers: string[] = [];
  finishedAt: number | null = null;

  begin_layer_restore() {}
  push_restored_layer(_rgba: Uint8Array, _w: number, _h: number, name: string) {
    this.layers.push(name);
  }
  restore_text_annotation(...args: unknown[]) {
    this.textCalls.push(args);
    return ++this.nextId;
  }
  restore_shape_annotation(...args: unknown[]) {
    this.shapeCalls.push(args);
    return ++this.nextId;
  }
  restore_pin_annotation(...args: unknown[]) {
    this.shapeCalls.push(args);
    return ++this.nextId;
  }
  restore_polyline_annotation(...args: unknown[]) {
    this.shapeCalls.push(args);
    return ++this.nextId;
  }
  restore_bezier_annotation(...args: unknown[]) {
    this.shapeCalls.push(args);
    return ++this.nextId;
  }
  set_text_wrap_width(id: number, w: number) {
    this.wrapSet.set(id, w);
    return true;
  }
  set_text_box_height(id: number, h: number) {
    this.boxSet.set(id, h);
    return true;
  }
  finish_layer_restore(idx: number) {
    this.finishedAt = idx;
  }

  /** What the engine believes the first restored text's box width is, by
   *  either route. `undefined` = it was never told. */
  wrapWidthOf(id: number): number | undefined {
    const viaSetter = this.wrapSet.get(id);
    if (viaSetter !== undefined) return viaSetter;
    const call = this.textCalls[id - 1];
    return typeof call?.[ARG_WRAP_WIDTH] === "number"
      ? (call[ARG_WRAP_WIDTH] as number)
      : undefined;
  }

  boxHeightOf(id: number): number | undefined {
    const viaSetter = this.boxSet.get(id);
    if (viaSetter !== undefined) return viaSetter;
    const call = this.textCalls[id - 1];
    return typeof call?.[ARG_BOX_HEIGHT] === "number"
      ? (call[ARG_BOX_HEIGHT] as number)
      : undefined;
  }

  /** The shape control: `sloppiness` is the last argument of the shape call.
   *  Indexed by call order, NOT by the engine id — the ids are handed out
   *  across both kinds, so the first shape is id 2 in a document whose first
   *  restore was a text. */
  sloppinessOfShape(nth: number): number | undefined {
    const call = this.shapeCalls[nth];
    return typeof call?.[call.length - 1] === "number"
      ? (call[call.length - 1] as number)
      : undefined;
  }
}

const decodePng: PngDecoder = async () => ({
  rgba: new Uint8ClampedArray(4),
  w: 1,
  h: 1,
});

function layerFromFixtures(): PersistedLayer {
  return {
    id: 1,
    name: "Photo",
    visible: true,
    opacity: 1,
    png: new Uint8Array([1]),
    annotations: stripLiveAnnotations(ENGINE_TEXT_JSON),
    shapes: parseShapes(ARCHIVE_SHAPES_JSON),
  };
}

describe("a dragged text box survives a reload (PARKING LOT, 2026-08-14)", () => {
  describe("the harness reads the slots it thinks it reads", () => {
    it("the_font_id_slot_is_where_this_file_thinks_it_is", async () => {
      // ⚠️ THE ANTI-MISCOUNT GUARD. Every restore-side row below is an index
      // into an argument list, and the first draft of this file had that index
      // off by one. Pin the one argument whose TYPE is distinctive: `font_id`
      // is the only string after `text`, so if the layout ever shifts, this
      // row names it instead of four rows going red for the wrong reason.
      const tool = new RecordingTool();
      await restoreLayerStack(
        tool as unknown as Parameters<typeof restoreLayerStack>[0],
        [layerFromFixtures()],
        1,
        decodePng,
      );
      const call = tool.textCalls[0]!;
      expect(call[ARG_FONT_ID], "font_id sits at index 26").toBe("liberation-serif");
      expect(typeof call[ARG_WRAP_WIDTH], "the width slot holds a number").toBe("number");
      expect(typeof call[ARG_BOX_HEIGHT], "the height slot holds a number").toBe("number");
      expect(call[ARG_PERSPECTIVE], "the quad slot holds 8 floats").toHaveLength(8);
    });
  });

  describe("save side — what reaches IndexedDB", () => {
    it("CONTROL: the shape's sloppiness is persisted", () => {
      // The twin that was fixed. If this goes red the fixture or the parser
      // moved, not the bug.
      const [shape] = parseShapes(ARCHIVE_SHAPES_JSON);
      expect(shape!.sloppiness, "shapes carry their own settings").toBe(50);
    });

    it("CONTROL: font_id is persisted (added with #131, and it works)", () => {
      const [ann] = stripLiveAnnotations(ENGINE_TEXT_JSON);
      expect(ann!.font_id).toBe("liberation-serif");
    });

    it("the box WIDTH the user dragged is persisted", () => {
      const [ann] = stripLiveAnnotations(ENGINE_TEXT_JSON);
      // The engine handed over `"wrap_width":168`. `stripLiveAnnotations` was
      // an explicit allowlist and the field was not on it, so the archive on
      // disk had never carried it — verified against a live production record
      // in tests/fixtures/oplog/v8-archive-edit-record.json. It is a denylist
      // now (ADR-060) and the field rides through.
      expect(
        (ann as unknown as { wrap_width?: number }).wrap_width,
        "the dragged box width must reach the archive",
      ).toBe(168);
    });

    it("the box HEIGHT the user dragged is persisted", () => {
      const [ann] = stripLiveAnnotations(ENGINE_TEXT_JSON);
      expect(
        (ann as unknown as { box_height?: number }).box_height,
        "the dragged box height must reach the archive",
      ).toBe(96);
    });
  });

  describe("FIXTURE CHECKS — the red rows above are satisfiable", () => {
    // A guard that cannot pass proves as little as one that cannot fail. These
    // three run the same assertions against a world where the fields DO get
    // through, so a red row above means the product path dropped them — not
    // that the fixture never had them or the recorder cannot see them.
    it("the captured engine JSON really carries the box axes", () => {
      const raw = JSON.parse(ENGINE_TEXT_JSON) as Array<Record<string, unknown>>;
      expect(raw[0]!.wrap_width, "the engine emits wrap_width").toBe(168);
      expect(raw[0]!.box_height, "the engine emits box_height").toBe(96);
    });

    it("a stripper that carried them would pass the save-side assertion", () => {
      const carryingStrip = (json: string) =>
        (JSON.parse(json) as Array<Record<string, unknown>>).map((a) => ({
          ...stripLiveAnnotations(JSON.stringify([a]))[0]!,
          wrap_width: a.wrap_width as number,
          box_height: a.box_height as number,
        }));
      const [ann] = carryingStrip(ENGINE_TEXT_JSON);
      expect(ann!.wrap_width).toBe(168);
      expect(ann!.box_height).toBe(96);
    });

    it("the recorder sees the width by EITHER route a fix could take", () => {
      const viaSetter = new RecordingTool();
      viaSetter.restore_text_annotation("t");
      viaSetter.set_text_wrap_width(1, 168);
      viaSetter.set_text_box_height(1, 96);
      expect(viaSetter.wrapWidthOf(1), "setter route").toBe(168);
      expect(viaSetter.boxHeightOf(1), "setter route").toBe(96);

      const viaArgs = new RecordingTool();
      // 27 arguments before v8.81, so the width and height are the next two.
      viaArgs.restore_text_annotation(
        ...Array.from({ length: ARG_WRAP_WIDTH }, () => 0),
        168,
        96,
      );
      expect(viaArgs.wrapWidthOf(1), "trailing-argument route").toBe(168);
      expect(viaArgs.boxHeightOf(1), "trailing-argument route").toBe(96);
    });
  });

  describe("restore side — what the engine is told on resume", () => {
    it("CONTROL: the shape gets its sloppiness back", async () => {
      const tool = new RecordingTool();
      await restoreLayerStack(
        tool as unknown as Parameters<typeof restoreLayerStack>[0],
        [layerFromFixtures()],
        1,
        decodePng,
      );
      expect(tool.shapeCalls.length, "the shape was restored").toBe(1);
      expect(tool.sloppinessOfShape(0), "shapes get their settings back").toBe(50);
    });

    it("the text gets its box WIDTH back", async () => {
      const tool = new RecordingTool();
      await restoreLayerStack(
        tool as unknown as Parameters<typeof restoreLayerStack>[0],
        [layerFromFixtures()],
        1,
        decodePng,
      );
      expect(tool.textCalls.length, "the text was restored").toBe(1);
      // Two ways to pass, neither of them chosen here — see RecordingTool.
      expect(tool.wrapWidthOf(1), "the engine must learn the dragged width").toBe(168);
    });

    it("the text gets its box HEIGHT back", async () => {
      const tool = new RecordingTool();
      await restoreLayerStack(
        tool as unknown as Parameters<typeof restoreLayerStack>[0],
        [layerFromFixtures()],
        1,
        decodePng,
      );
      expect(tool.boxHeightOf(1), "the engine must learn the dragged height").toBe(96);
    });

    it("AN ARCHIVE WRITTEN BEFORE v8.81 RESTORES UNCHANGED", async () => {
      // ⚠️ THE NO-DATA-LOSS ROW. IndexedDB here is user data with no backup
      // and no server copy, so the interesting case is not the new archive —
      // it is the one already on a user's disk, which has no `wrap_width`, no
      // `box_height` and no `perspective` because the stripper that wrote it
      // never carried them.
      //
      // Absent must mean what it meant then: 0 is "size the box to the text"
      // and a wrong-length quad is "no perspective". Nothing is rewritten,
      // nothing throws, and the three new arguments are handed over as the
      // values the old archive implied. This is also why no Dexie `.version()`
      // bump is needed — the fields are optional and unindexed, exactly like
      // `font_id` and the nine `shadow_*` before them.
      const legacy = layerFromFixtures();
      legacy.annotations = legacy.annotations.map((a) => {
        const old: Record<string, unknown> = { ...a };
        delete old.wrap_width;
        delete old.box_height;
        delete old.perspective;
        return old as unknown as (typeof legacy.annotations)[number];
      });

      const tool = new RecordingTool();
      await restoreLayerStack(
        tool as unknown as Parameters<typeof restoreLayerStack>[0],
        [legacy],
        1,
        decodePng,
      );
      expect(tool.textCalls.length, "the old text still restores").toBe(1);
      expect(tool.wrapWidthOf(1), "absent width reads as 'size to the text'").toBe(0);
      expect(tool.boxHeightOf(1), "absent height reads as 'size to the text'").toBe(0);
      expect(
        tool.textCalls[0]![ARG_PERSPECTIVE],
        "absent quad reads as no quad, which the engine takes as the identity",
      ).toHaveLength(0);
      // And the fields it DID carry are untouched by the new plumbing.
      expect(tool.textCalls[0]![ARG_FONT_ID], "the face still arrives").toBe(
        "liberation-serif",
      );
    });
  });
});
