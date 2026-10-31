// Numbered steps (pins, kind 5) that renumber themselves — the engine side is
// three calls in src/annotations.rs, each one undo step; the rules are in
// lib/pinSteps.ts. This hook drops, deletes and renumbers pins for
// useDrawingTools, and publishes the sequence and the Renumber action to
// useAnnotationStore for the Pins panel (which cannot reach the engine, and
// AppShell gains no props).
//
// Smart Callout v1 lives here too (lib/callouts.ts): with the panel's Drop
// toggle on Callout a click parks its point for the label input, whose Enter
// adds pin, label and leader as ONE step (`continue_step`); deleting a pin
// takes its leader and label with it, and a moved pin redraws its leader. A
// moved label is followed from useTextTool, through `followLabels`. The
// panel's Leader toggle picks a line (default) or an arrow for a new callout.
import { useCallback, useEffect, useRef } from "react";
import type { ImageHorseTool } from "stamp_tool";
import { useAnnotationStore } from "@/stores/useAnnotationStore";
import { nextAfterDrop, nextPinNumber, pinSequence } from "@/lib/pinSteps";
import {
  calloutsToFollow,
  defaultLabelAt,
  findCallouts,
  leaderFor,
  LEADER_KIND,
  type CalloutLayer,
  type CalloutText,
  type Pt,
} from "@/lib/callouts";
import type { Point, ShapeMeta } from "@/lib/drawEditState";
import type { ToolSettings } from "@/lib/types";

interface Options {
  toolRef: React.RefObject<ImageHorseTool | null>;
  settingsRef: React.RefObject<ToolSettings>;
  /** The active layer's shapes, as useDrawingTools last read them. */
  shapes: ShapeMeta[];
  /** Repaint, sync and re-read the shapes after an engine change. */
  afterChange: () => Promise<void>;
}

const BG_KIND = { none: 0, rect: 1, bubble: 2 } as const;

const hexRgb = (hex: string) =>
  [0, 2, 4].map((i) => parseInt(hex.replace("#", "").slice(i, i + 2), 16) || 0);

const rgbHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;

/** A pin's box at `p`: the 1-10 Stroke Width slider maps to a callout-sized
 *  disc radius. */
function pinBox(p: Point, strokeWidth: number) {
  const r = 8 + strokeWidth * 3;
  return { r, x0: p.x - r, y0: p.y - r, x1: p.x + r, y1: p.y + r };
}

async function readShapes(tool: ImageHorseTool): Promise<ShapeMeta[]> {
  try {
    return JSON.parse(await tool.get_shape_annotations()) as ShapeMeta[];
  } catch {
    return [];
  }
}

async function readTexts(tool: ImageHorseTool): Promise<CalloutText[]> {
  try {
    return JSON.parse(await tool.get_text_annotations()) as CalloutText[];
  } catch {
    return [];
  }
}

/** Delete the whole callout that `part` belongs to — its pin, its leader or
 *  its label — as ONE undo step (the pin's gap closes, as for any pin).
 *  Deleting a leader or a label alone used to leave the other two behind as
 *  plain objects. False, deleting nothing, when `part` is in no callout. */
export async function removeCalloutOf(
  tool: ImageHorseTool,
  part: { shape?: number; text?: number },
): Promise<boolean> {
  const c = findCallouts(await readShapes(tool), await readTexts(tool)).find(
    (c) => c.pin === part.shape || c.leader === part.shape || c.label === part.text,
  );
  if (!c) return false;
  tool.remove_pin_annotation(c.pin);
  tool.continue_step();
  tool.remove_shape_annotation(c.leader);
  tool.continue_step();
  tool.remove_text_annotation(c.label);
  useAnnotationStore.getState().bumpAnnotations(); // the Text tool's list
  return true;
}

/** Delete text `id`, or the whole callout when it is a callout's label. */
export async function removeText(tool: ImageHorseTool, id: number): Promise<void> {
  if (!(await removeCalloutOf(tool, { text: id }))) tool.remove_text_annotation(id);
}

/** Redraw the leaders whose pin or label moved between `before` and `now`.
 *  No undo step of its own: it rides the move's. True when one was redrawn.
 *
 *  An arrow leader goes through `reroute_connector`, which takes no step. A
 *  line leader cannot (the engine re-routes arrows only), so it is rewritten
 *  whole by `update_shape_annotation` — its own style read back, the new ends
 *  — right after `continue_step`, which makes that edit join the step the
 *  move opened instead of pushing one. Both are sent in the same tick, so no
 *  recomposite can clear the join between them. */
export async function rerouteCallouts(
  tool: ImageHorseTool,
  before: CalloutLayer,
  now: CalloutLayer,
): Promise<boolean> {
  const moves = calloutsToFollow(before, now);
  if (!moves.length) return false;
  const lines = moves.some((m) => now.shapes.find((s) => s.id === m.id)?.kind === LEADER_KIND.line)
    ? await readShapes(tool)
    : [];
  for (const m of moves) {
    const line = lines.find((s) => s.id === m.id && s.kind === LEADER_KIND.line);
    if (!line) {
      await tool.reroute_connector(m.id, m.x0, m.y0, m.x1, m.y1);
      continue;
    }
    const fill = rgbHex(line.fill_r, line.fill_g, line.fill_b);
    tool.continue_step();
    await tool.update_shape_annotation(
      m.id, LEADER_KIND.line, m.x0, m.y0, m.x1, m.y1,
      rgbHex(line.r, line.g, line.b), line.stroke_width, line.arrow_style,
      line.fill_kind, fill, fill, line.fill_angle, line.fill_block,
      line.sloppiness ?? 0, 0, 0, new Uint16Array(4),
    );
  }
  return true;
}

/** Redraw the leaders whose label moved since `before`, a text list read
 *  earlier, against the engine's state NOW: both lists are read here, the one
 *  right after the other. It used to compare with the Text tool's own list,
 *  which trails the engine by a render. An undo then a quick redo had the
 *  undo's follow pair the undone label with the REDONE leader, "follow" it
 *  back, and the redo's follow put it forward again: a step of its own, which
 *  a later Ctrl+Z spent doing nothing. Read now, a label and its leader come
 *  from one state; after an undo or redo they already match, nothing moves. */
export async function followLabels(tool: ImageHorseTool, before: readonly CalloutText[]): Promise<boolean> {
  const shapes = await readShapes(tool);
  return rerouteCallouts(tool, { shapes, texts: before }, { shapes, texts: await readTexts(tool) });
}

export function usePinSteps({ toolRef, settingsRef, shapes, afterChange }: Options) {
  const { max, gaps } = pinSequence(shapes);
  useEffect(() => {
    useAnnotationStore.getState().setPinSequence({ max, gaps });
  }, [max, gaps]);

  /** The number the next pin takes, and what the Next field holds after. */
  const claimNumber = useCallback(async (tool: ImageHorseTool) => {
    // Read fresh: `shapes` can trail a drop that has not refreshed yet.
    const last = pinSequence(await readShapes(tool)).max;
    const { pinNext, setPinNext } = useAnnotationStore.getState();
    const n = nextPinNumber(last, pinNext);
    return { n, done: () => setPinNext(nextAfterDrop(n, last + 1, pinNext)) };
  }, []);

  /** Drop a pin at `p`, numbered from the panel's Next field (default: after
   *  the last). A number inside the sequence inserts: the pins at and after it
   *  move up one. The label style (number vs letter) follows the Pins tab
   *  toggle. One "Add Pin" step. With Drop on Callout, the click opens the
   *  label input instead and nothing is added until its Enter. */
  const dropPin = useCallback(
    async (p: Point) => {
      const tool = toolRef.current;
      if (!tool) return;
      if (useAnnotationStore.getState().calloutMode) {
        useAnnotationStore.getState().setPendingCallout({ x: p.x, y: p.y });
        return;
      }
      const s = settingsRef.current;
      const b = pinBox(p, s.strokeWidth);
      const { n, done } = await claimNumber(tool);
      tool.insert_pin_annotation(b.x0, b.y0, b.x1, b.y1, n, s.strokeColor, s.pinLabel === "letters" ? 1 : 0);
      done();
      await afterChange();
    },
    [toolRef, settingsRef, claimNumber, afterChange],
  );

  /** A Smart Callout at `p`: the pin, the label `text` (Text tool style) up
   *  and to the right, and the leader between them — one undo step. */
  const commitCallout = useCallback(
    async (p: Pt, text: string) => {
      const tool = toolRef.current;
      if (!tool || !text.trim()) return;
      const s = settingsRef.current;
      const b = pinBox(p, s.strokeWidth);
      const { n, done } = await claimNumber(tool);
      const pin = { id: 0, kind: 5, ...b };
      const at = defaultLabelAt(p, b.r, await tool.width());
      const [tr, tg, tb] = hexRgb(s.textColor);
      const [br, bg, bb] = hexRgb(s.bgColor);
      await tool.insert_pin_annotation(b.x0, b.y0, b.x1, b.y1, n, s.strokeColor, s.pinLabel === "letters" ? 1 : 0);
      tool.continue_step();
      const labelId = await tool.add_text_annotation(
        text.trim(), s.fontSize, tr, tg, tb, s.fontWeight === "bold",
        Math.round(at.x), Math.round(at.y), 0,
        BG_KIND[s.bgKind] ?? 0, br, bg, bb, Math.round(Math.max(0, Math.min(100, s.bgOpacity)) * 2.55),
        Math.max(0, Math.round(s.bgPadding)), Math.max(0, Math.round(s.bgCornerRadius)),
        ((Math.round(s.bgTail) % 360) + 360) % 360, // the bubble tail, as the Text tool sends it
        s.textFontId ?? "",
      );
      const label = (await readTexts(tool)).find((t) => t.id === labelId);
      if (label) {
        const l = leaderFor(pin, label);
        // The panel's Leader toggle: a plain line (default) or an arrow.
        const kind = LEADER_KIND[useAnnotationStore.getState().calloutLeader];
        tool.continue_step();
        tool.add_shape_annotation(
          kind, l.x0, l.y0, l.x1, l.y1, s.strokeColor, 3, 0, 0, "#000000", "#000000", 0, 0, 0, 0, 0, new Uint16Array(4),
        );
      }
      done();
      useAnnotationStore.getState().bumpAnnotations(); // the Text tool's list
      await afterChange();
    },
    [toolRef, settingsRef, claimNumber, afterChange],
  );

  /** Delete pin `id`, closing the gap it leaves; a callout's leader and label
   *  go with it, in the same step. */
  const removePin = useCallback(
    async (id: number) => {
      const tool = toolRef.current;
      if (!tool) return;
      if (!(await removeCalloutOf(tool, { shape: id }))) tool.remove_pin_annotation(id);
    },
    [toolRef],
  );

  // A pin that moved (or was resized) redraws its callout's leader. Every
  // refresh of the shape list is compared with the last one; lib/callouts
  // follows only leaders that did not move themselves, so undo, redo and a
  // photo switch pass through untouched.
  const prevShapes = useRef(shapes);
  useEffect(() => {
    const before = prevShapes.current;
    prevShapes.current = shapes;
    const tool = toolRef.current;
    if (!tool || before === shapes || !before.some((s) => s.kind === 5)) return;
    void (async () => {
      const texts = await readTexts(tool);
      if (await rerouteCallouts(tool, { shapes: before, texts }, { shapes, texts })) await afterChange();
    })();
  }, [shapes, toolRef, afterChange]);

  /** Close every gap on the active layer, in numbered order. One "Renumber
   *  Pins" step, or nothing when there is no gap. */
  const renumberPins = useCallback(async () => {
    const tool = toolRef.current;
    if (tool && (await tool.renumber_pins()) > 0) await afterChange();
  }, [toolRef, afterChange]);

  useEffect(() => {
    const { setRenumberPins, setCommitCallout } = useAnnotationStore.getState();
    setRenumberPins(() => void renumberPins());
    setCommitCallout((p, text) => void commitCallout(p, text));
    return () => {
      setRenumberPins(null);
      setCommitCallout(null);
    };
  }, [renumberPins, commitCallout]);

  return { dropPin, removePin };
}
