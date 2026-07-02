import { useCallback, useEffect, useRef, useState } from "react";
import type { ImageHorseTool } from "stamp_tool";
import type { ToolSettings } from "@/lib/types";
import { parseColorSync, warmColorParser } from "@/lib/colorParser";
import { useAnnotationStore } from "@/stores/useAnnotationStore";

export interface TextInput {
  screenX: number;
  screenY: number;
  canvasX: number;
  canvasY: number;
  text: string;
  rotation: number; // degrees, clockwise (matches CSS rotate())
  /** Snapshot of the style at the time the input opened. When editing an
   *  existing annotation we want to preserve its original style rather than
   *  whatever the toolbar currently shows. */
  fontSize: number;
  fontWeight: string;
  textColor: string;
}

/** Shape of one entry returned from `tool.get_text_annotations()`. */
export interface AnnotationMeta {
  id: number;
  text: string;
  x: number;
  y: number;
  font_size: number;
  r: number;
  g: number;
  b: number;
  bold: boolean;
  rotation_deg: number;
  tile_w: number;
  tile_h: number;
  tile_offset_x: number;
  tile_offset_y: number;
}

interface UseTextToolOptions {
  toolRef: React.RefObject<ImageHorseTool | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  settings: ToolSettings;
  flushToCanvas: () => void;
  syncState: () => void;
  active: boolean;
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

/**
 * Parse a color string to RGB bytes. Routes through the Rust `parse_color`
 * WASM export so we accept the same forms (#rgb, #rrggbb, #rrggbbaa, rgb(),
 * rgba()) as the swatch grid's + button. Alpha is dropped since text fill
 * is rendered opaque. Falls back to a minimal #rrggbb parser only if WASM
 * hasn't loaded yet (extremely unlikely — useTextTool is always reached
 * after the WASM tool is constructed).
 */
function hexToRgb(input: string): [number, number, number] {
  const parsed = parseColorSync(input);
  if (parsed) return [parsed.r, parsed.g, parsed.b];
  // Cold-cache fallback for the very first text commit after a hard refresh.
  const h = input.replace("#", "");
  if (h.length < 6) return [0, 0, 0];
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

const BG_KIND_MAP = { none: 0, rect: 1, bubble: 2 } as const;

export function useTextTool({
  toolRef,
  canvasRef,
  containerRef,
  settings,
  flushToCanvas,
  syncState,
  active,
}: UseTextToolOptions) {
  const [textInput, setTextInput] = useState<TextInput | null>(null);
  const textInputRef = useRef<TextInput | null>(null);
  textInputRef.current = textInput;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [pendingText, setPendingText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastPositionRef = useRef<Omit<TextInput, "text"> | null>(null);
  /** When non-null, commitText updates the existing annotation instead of
   *  creating a new one. */
  const editingAnnotationId = useRef<number | null>(null);
  /** Parsed annotation list — refreshed after every add/update/remove. */
  const [annotations, setAnnotations] = useState<AnnotationMeta[]>([]);
  /** Annotation id currently under the cursor (text-tool hover). */
  const [hoveredAnnotationId, setHoveredAnnotationId] = useState<number | null>(
    null,
  );

  const refreshAnnotations = useCallback(() => {
    const tool = toolRef.current;
    if (!tool) {
      setAnnotations([]);
      return;
    }
    try {
      const raw = tool.get_text_annotations();
      const parsed: AnnotationMeta[] = JSON.parse(raw);
      setAnnotations(parsed);
    } catch {
      setAnnotations([]);
    }
  }, [toolRef]);

  useEffect(() => {
    if (!active) return;
    const handler = (e: CustomEvent<{ text: string }>) =>
      setPendingText(e.detail.text);
    window.addEventListener("prefill-text", handler as EventListener);
    return () =>
      window.removeEventListener("prefill-text", handler as EventListener);
  }, [active]);

  // Warm the Rust color parser so the first text-commit's hex→rgb runs
  // entirely through WASM (rather than the JS fallback).
  useEffect(() => {
    warmColorParser();
  }, []);

  // Keep annotations roughly in sync after photo loads or external mutations.
  useEffect(() => {
    if (active) refreshAnnotations();
  }, [active, refreshAnnotations]);

  // After an undo/redo/jump in the history layer, the WASM annotation vector
  // may have changed even though no JS-side text op fired. Refresh and drop
  // any stale edit/hover state pointing at an annotation that no longer
  // exists at this history step.
  // Was a `text-annotations-changed` window event before stage 4; now driven by
  // the annotation-revision counter in the store. prevRev skips the mount run so
  // this fires only on an actual bump (matching the old event-only semantics).
  const annotationsRevision = useAnnotationStore((s) => s.annotationsRevision);
  const prevAnnotationsRev = useRef(annotationsRevision);
  useEffect(() => {
    if (prevAnnotationsRev.current === annotationsRevision) return;
    prevAnnotationsRev.current = annotationsRevision;
    const tool = toolRef.current;
    if (!tool) return;
    let list: AnnotationMeta[] = [];
    try {
      list = JSON.parse(tool.get_text_annotations());
    } catch {
      list = [];
    }
    setAnnotations(list);
    // Drop the editing input if it points at a vanished annotation.
    if (editingAnnotationId.current !== null) {
      const stillThere = list.some((a) => a.id === editingAnnotationId.current);
      if (!stillThere) {
        editingAnnotationId.current = null;
        textInputRef.current = null;
        setTextInput(null);
        tool.set_editing_text(-1);
      }
    }
    // Drop stale hover.
    setHoveredAnnotationId((prev) =>
      prev === null || list.some((a) => a.id === prev) ? prev : null,
    );
  }, [annotationsRevision, toolRef]);

  const commitText = useCallback(() => {
    const ti = textInputRef.current;
    if (!ti) return;
    const editingId = editingAnnotationId.current;
    textInputRef.current = null;
    editingAnnotationId.current = null;
    setTextInput(null);
    const tool = toolRef.current;
    if (!tool) return;

    // Stop suppressing the baked tile — the committed annotation should render.
    tool.set_editing_text(-1);

    if (!ti.text.trim()) {
      // Empty text — if we were editing an existing annotation, remove it.
      if (editingId !== null) {
        tool.remove_text_annotation(editingId);
        refreshAnnotations();
        flushToCanvas();
        syncState();
      }
      return;
    }

    const hex = ti.textColor.replace("#", "");
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const bold = ti.fontWeight === "bold";
    const x = Math.round(ti.canvasX);
    const y = Math.round(ti.canvasY);

    // Pull background settings from the current toolSettings snapshot.
    const s = settingsRef.current;
    const bgKind = BG_KIND_MAP[s.bgKind];
    const [bgR, bgG, bgB] = hexToRgb(s.bgColor);
    const bgA = Math.round(
      Math.max(0, Math.min(100, s.bgOpacity)) * 2.55,
    );
    const bgPadding = Math.max(0, Math.round(s.bgPadding));
    const bgCornerRadius = Math.max(0, Math.round(s.bgCornerRadius));
    // Tail angle in degrees, normalized to 0-359 for the Rust u32 param.
    const bgTail = ((Math.round(s.bgTail) % 360) + 360) % 360;

    let targetId: number | null = null;
    if (editingId !== null) {
      tool.update_text_annotation(
        editingId,
        ti.text,
        ti.fontSize,
        r,
        g,
        b,
        bold,
        x,
        y,
        ti.rotation,
        bgKind,
        bgR,
        bgG,
        bgB,
        bgA,
        bgPadding,
        bgCornerRadius,
        bgTail,
      );
      targetId = editingId;
    } else {
      targetId = tool.add_text_annotation(
        ti.text,
        ti.fontSize,
        r,
        g,
        b,
        bold,
        x,
        y,
        ti.rotation,
        bgKind,
        bgR,
        bgG,
        bgB,
        bgA,
        bgPadding,
        bgCornerRadius,
        bgTail,
      );
    }
    // Apply / sync the soft drop shadow on the committed annotation (Rust no-ops
    // when unchanged, so this is cheap to call on every commit).
    if (targetId !== null && targetId >= 0) {
      const shadowAlpha = Math.round(
        Math.max(0, Math.min(100, s.shadowOpacity)) * 2.55,
      );
      tool.set_text_shadow(
        targetId,
        s.shadowBox,
        s.shadowText,
        s.shadowColor,
        shadowAlpha,
        Math.round(s.shadowOffsetX),
        Math.round(s.shadowOffsetY),
        Math.max(0, Math.round(s.shadowBlur)),
      );
    }
    refreshAnnotations();
    flushToCanvas();
    syncState();
    // Was a `text-committed` window CustomEvent before stage 4.
    useAnnotationStore.getState().commitText(ti.text);
  }, [toolRef, flushToCanvas, syncState, refreshAnnotations]);

  /** Open the textarea on top of an existing annotation for re-editing. */
  const editAnnotation = useCallback(
    (ann: AnnotationMeta) => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const cr = canvas.getBoundingClientRect();
      const ctr = container.getBoundingClientRect();
      const scaleX = cr.width / canvas.width;
      const scaleY = cr.height / canvas.height;
      const screenX = cr.left - ctr.left + ann.x * scaleX;
      const screenY = cr.top - ctr.top + ann.y * scaleY;
      const next: TextInput = {
        screenX,
        screenY,
        canvasX: ann.x,
        canvasY: ann.y,
        text: ann.text,
        rotation: ann.rotation_deg,
        fontSize: ann.font_size,
        fontWeight: ann.bold ? "bold" : "normal",
        textColor: rgbToHex(ann.r, ann.g, ann.b),
      };
      lastPositionRef.current = {
        screenX,
        screenY,
        canvasX: ann.x,
        canvasY: ann.y,
        rotation: ann.rotation_deg,
        fontSize: ann.font_size,
        fontWeight: next.fontWeight,
        textColor: next.textColor,
      };
      editingAnnotationId.current = ann.id;
      textInputRef.current = next;
      setTextInput(next);
      // Suppress this annotation's baked tile while the textarea overlay is
      // open, so the user doesn't see a doubled copy underneath the editor.
      toolRef.current?.set_editing_text(ann.id);
      flushToCanvas();
      setTimeout(() => textareaRef.current?.focus(), 10);
    },
    [canvasRef, containerRef, toolRef, flushToCanvas],
  );

  /** Open an existing text annotation for editing by id (Reselect list).
   *  Reads a fresh annotation list so geometry is current. */
  const selectAnnotation = useCallback(
    (id: number) => {
      const tool = toolRef.current;
      if (!tool) return;
      let list: AnnotationMeta[] = [];
      try {
        list = JSON.parse(tool.get_text_annotations());
      } catch {
        list = [];
      }
      const ann = list.find((a) => a.id === id);
      if (ann) editAnnotation(ann);
    },
    [toolRef, editAnnotation],
  );

  const onCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!active) return;
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const tool = toolRef.current;
      const cr = canvas.getBoundingClientRect();
      const ctr = container.getBoundingClientRect();
      const screenX = e.clientX - ctr.left;
      const screenY = e.clientY - ctr.top;
      const canvasX = ((e.clientX - cr.left) * canvas.width) / cr.width;
      const canvasY = ((e.clientY - cr.top) * canvas.height) / cr.height;

      // Hit-test existing annotations first.
      if (tool) {
        const hitId = tool.text_annotation_at(
          Math.round(canvasX),
          Math.round(canvasY),
        );
        if (hitId >= 0) {
          if (textInputRef.current) commitText();
          // Parse fresh list so we pick up the latest geometry.
          let list: AnnotationMeta[] = [];
          try {
            list = JSON.parse(tool.get_text_annotations());
          } catch {
            list = [];
          }
          const ann = list.find((a) => a.id === hitId);
          if (ann) {
            editAnnotation(ann);
            return;
          }
        }
      }

      // Else open a fresh blank text input at the click position.
      if (textInputRef.current) commitText();
      const { fontSize, fontWeight, textColor } = settingsRef.current;
      const pos = {
        screenX,
        screenY,
        canvasX,
        canvasY,
        rotation: 0,
        fontSize,
        fontWeight,
        textColor,
      };
      lastPositionRef.current = pos;
      const next: TextInput = { ...pos, text: pendingText };
      editingAnnotationId.current = null;
      textInputRef.current = next;
      setTextInput(next);
      if (pendingText) setPendingText("");
      setTimeout(() => textareaRef.current?.focus(), 10);
    },
    [
      active,
      canvasRef,
      containerRef,
      toolRef,
      commitText,
      pendingText,
      editAnnotation,
    ],
  );

  const setTextPosition = useCallback(
    (canvasX: number, canvasY: number) => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const cr = canvas.getBoundingClientRect();
      const ctr = container.getBoundingClientRect();
      const scaleX = cr.width / canvas.width;
      const scaleY = cr.height / canvas.height;
      const screenX = cr.left - ctr.left + canvasX * scaleX;
      const screenY = cr.top - ctr.top + canvasY * scaleY;
      setTextInput((prev) => {
        if (!prev) return prev;
        const next = { ...prev, canvasX, canvasY, screenX, screenY };
        textInputRef.current = next;
        return next;
      });
    },
    [canvasRef, containerRef],
  );

  const setTextRotation = useCallback((rotation: number) => {
    setTextInput((prev) => {
      if (!prev) return prev;
      const next = { ...prev, rotation };
      textInputRef.current = next;
      return next;
    });
  }, []);

  // Allow the toolbar font-size slider to live-resize the open input.
  const setTextFontSize = useCallback((fontSize: number) => {
    setTextInput((prev) => {
      if (!prev) return prev;
      const next = { ...prev, fontSize };
      textInputRef.current = next;
      return next;
    });
  }, []);

  /** Live-update the open input's color. Called from AppShell when the
   *  toolbar ColorSwatchGrid fires onChange. */
  const setTextColor = useCallback((textColor: string) => {
    setTextInput((prev) => {
      if (!prev) return prev;
      const next = { ...prev, textColor };
      textInputRef.current = next;
      return next;
    });
  }, []);

  /** Live-update the open input's font weight. */
  const setTextFontWeight = useCallback((fontWeight: string) => {
    setTextInput((prev) => {
      if (!prev) return prev;
      const next = { ...prev, fontWeight };
      textInputRef.current = next;
      return next;
    });
  }, []);

  // FIX (issue #4): fall back to canvas center when no previous click position
  // exists. Previously this silently stashed pendingText and nothing visible
  // happened when the user clicked a recent text in a fresh session.
  const reopenWith = useCallback(
    (text: string) => {
      const { fontSize, fontWeight, textColor } = settingsRef.current;
      const pos = lastPositionRef.current;
      if (pos) {
        if (textInputRef.current) commitText();
        const next: TextInput = {
          ...pos,
          fontSize,
          fontWeight,
          textColor,
          text,
        };
        editingAnnotationId.current = null;
        textInputRef.current = next;
        setTextInput(next);
        setTimeout(() => textareaRef.current?.focus(), 10);
        return;
      }
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) {
        setPendingText(text);
        return;
      }
      const cr = canvas.getBoundingClientRect();
      const ctr = container.getBoundingClientRect();
      const canvasX = canvas.width / 2;
      const canvasY = canvas.height / 2;
      const screenX = cr.left - ctr.left + cr.width / 2;
      const screenY = cr.top - ctr.top + cr.height / 2;
      const fallback = {
        screenX,
        screenY,
        canvasX,
        canvasY,
        rotation: 0,
        fontSize,
        fontWeight,
        textColor,
      };
      lastPositionRef.current = fallback;
      if (textInputRef.current) commitText();
      editingAnnotationId.current = null;
      const next: TextInput = { ...fallback, text };
      textInputRef.current = next;
      setTextInput(next);
      setTimeout(() => textareaRef.current?.focus(), 10);
    },
    [commitText, canvasRef, containerRef],
  );

  const onTextKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        textInputRef.current = null;
        editingAnnotationId.current = null;
        setTextInput(null);
        // Cancelling an edit must un-suppress the (unchanged) baked tile.
        toolRef.current?.set_editing_text(-1);
        flushToCanvas();
      } else if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        commitText();
      }
    },
    [commitText, toolRef, flushToCanvas],
  );

  const onTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setTextInput((prev) => {
        if (!prev) return prev;
        const next = { ...prev, text: e.target.value };
        textInputRef.current = next;
        return next;
      });
    },
    [],
  );

  // No-op: commit-on-blur was causing premature closes whenever the user
  // clicked the right-side TextSettings panel (font, color, weight). Commit
  // is now driven by:
  //   • Enter (without Shift)  → commitText
  //   • Escape                 → cancel without commit
  //   • Pointerdown outside the textarea AND outside `[data-text-panel]`
  //     AND outside `[data-text-overlay]` → commitText
  const onTextBlur = useCallback(() => {
    /* intentionally empty — see comment above */
  }, []);

  // Outside-pointerdown listener: commits the text when the user clicks
  // anywhere that isn't the textarea, the TextSettings panel, or the text
  // overlay (chevrons/handles). Only mounted while textInput is active.
  useEffect(() => {
    if (!textInput) return;
    const handler = (e: PointerEvent) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      // 1. The textarea itself.
      if (textareaRef.current && textareaRef.current.contains(target)) return;
      // 2. The right-side TextSettings panel.
      if (target.closest("[data-text-panel]")) return;
      // 3. The text-input overlay (handles, dashed border, etc).
      if (target.closest("[data-text-overlay]")) return;
      commitText();
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [textInput, commitText]);

  /** Move-cursor hover over the canvas: highlight the annotation under the
   *  pointer (and only while the text tool is active). */
  const onCanvasHover = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!active) {
        if (hoveredAnnotationId !== null) setHoveredAnnotationId(null);
        return;
      }
      const tool = toolRef.current;
      const canvas = canvasRef.current;
      if (!tool || !canvas) return;
      const cr = canvas.getBoundingClientRect();
      const cx = ((e.clientX - cr.left) * canvas.width) / cr.width;
      const cy = ((e.clientY - cr.top) * canvas.height) / cr.height;
      const id = tool.text_annotation_at(Math.round(cx), Math.round(cy));
      const next = id >= 0 ? id : null;
      if (next !== hoveredAnnotationId) setHoveredAnnotationId(next);
    },
    [active, toolRef, canvasRef, hoveredAnnotationId],
  );

  return {
    textInput,
    textareaRef,
    onCanvasClick,
    onCanvasHover,
    onTextKeyDown,
    onTextChange,
    onTextBlur,
    reopenWith,
    setTextPosition,
    setTextRotation,
    setTextFontSize,
    setTextColor,
    setTextFontWeight,
    annotations,
    refreshAnnotations,
    selectAnnotation,
    hoveredAnnotationId,
    editingAnnotationId: editingAnnotationId.current,
  };
}
