import { useCallback, useEffect, useRef, useState } from "react";
import type { ImageHorseTool } from "stamp_tool";
import type { ToolSettings } from "@/lib/types";

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

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  if (h.length < 6) return [0, 0, 0];
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

const BG_KIND_MAP = { none: 0, rect: 1, bubble: 2 } as const;
const BG_TAIL_MAP = {
  left: 1,
  right: 2,
  topleft: 3,
  bottomright: 4,
  bottomleft: 5,
} as const;

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

  // Keep annotations roughly in sync after photo loads or external mutations.
  useEffect(() => {
    if (active) refreshAnnotations();
  }, [active, refreshAnnotations]);

  // After an undo/redo/jump in the history layer, the WASM annotation vector
  // may have changed even though no JS-side text op fired. Refresh and drop
  // any stale edit/hover state pointing at an annotation that no longer
  // exists at this history step.
  useEffect(() => {
    const handler = () => {
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
        }
      }
      // Drop stale hover.
      setHoveredAnnotationId((prev) =>
        prev === null || list.some((a) => a.id === prev) ? prev : null,
      );
    };
    window.addEventListener("text-annotations-changed", handler);
    return () => window.removeEventListener("text-annotations-changed", handler);
  }, [toolRef]);

  const commitText = useCallback(() => {
    const ti = textInputRef.current;
    if (!ti) return;
    const editingId = editingAnnotationId.current;
    textInputRef.current = null;
    editingAnnotationId.current = null;
    setTextInput(null);
    const tool = toolRef.current;
    if (!tool) return;

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
    const bgTail = BG_TAIL_MAP[s.bgTail];

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
    } else {
      tool.add_text_annotation(
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
    refreshAnnotations();
    flushToCanvas();
    syncState();
    window.dispatchEvent(
      new CustomEvent("text-committed", { detail: { text: ti.text } }),
    );
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
      setTimeout(() => textareaRef.current?.focus(), 10);
    },
    [canvasRef, containerRef],
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
      } else if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        commitText();
      }
    },
    [commitText],
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
    annotations,
    refreshAnnotations,
    hoveredAnnotationId,
    editingAnnotationId: editingAnnotationId.current,
  };
}
