import { useCallback, useEffect, useRef, useState } from "react";
import type { CloneStampTool } from "stamp_tool";
import type { ToolSettings } from "@/lib/types";

interface TextInput {
  screenX: number;
  screenY: number;
  canvasX: number;
  canvasY: number;
  text: string;
}

interface UseTextToolOptions {
  toolRef: React.RefObject<CloneStampTool | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  settings: ToolSettings;
  flushToCanvas: () => void;
  syncState: () => void;
  active: boolean;
}

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
  const [pendingText, setPendingText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastPositionRef = useRef<Omit<TextInput, "text"> | null>(null);

  useEffect(() => {
    if (!active) return;
    const handler = (e: CustomEvent<{ text: string }>) =>
      setPendingText(e.detail.text);
    window.addEventListener("prefill-text", handler as EventListener);
    return () =>
      window.removeEventListener("prefill-text", handler as EventListener);
  }, [active]);

  const commitText = useCallback(() => {
    if (!textInput || !textInput.text.trim()) {
      setTextInput(null);
      return;
    }
    const tool = toolRef.current;
    if (!tool) {
      setTextInput(null);
      return;
    }

    const { text, canvasX, canvasY } = textInput;
    const { fontSize, fontWeight, textColor } = settings;

    // Parse CSS hex color → r, g, b
    const hex = textColor.replace("#", "");
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);

    // Rust renders the text using the embedded Liberation Sans font,
    // composites it onto the buffer, and pushes a "Text" history entry.
    tool.commit_text(
      text,
      fontSize,
      r, g, b,
      fontWeight === "bold",
      Math.round(canvasX),
      Math.round(canvasY),
    );
    flushToCanvas();
    syncState();

    window.dispatchEvent(
      new CustomEvent("text-committed", { detail: { text } }),
    );
    setTextInput(null);
  }, [textInput, settings, toolRef, flushToCanvas, syncState]);

  const onCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!active) return;
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const cr = canvas.getBoundingClientRect();
      const ctr = container.getBoundingClientRect();
      const screenX = e.clientX - ctr.left;
      const screenY = e.clientY - ctr.top;
      const canvasX = ((e.clientX - cr.left) * canvas.width) / cr.width;
      const canvasY = ((e.clientY - cr.top) * canvas.height) / cr.height;

      if (textInput) commitText();

      const pos = { screenX, screenY, canvasX, canvasY };
      lastPositionRef.current = pos;
      setTextInput({ ...pos, text: pendingText });
      if (pendingText) setPendingText("");
      setTimeout(() => textareaRef.current?.focus(), 10);
    },
    [active, canvasRef, containerRef, textInput, commitText, pendingText],
  );

  // Re-open the canvas text box at the last used position with the given text.
  // Falls back to prefill if no position has been recorded yet.
  const reopenWith = useCallback(
    (text: string) => {
      const pos = lastPositionRef.current;
      if (!pos) {
        // No prior position — just prefill for the next canvas click
        setPendingText(text);
        return;
      }
      if (textInput) commitText();
      setTextInput({ ...pos, text });
      setTimeout(() => textareaRef.current?.focus(), 10);
    },
    [textInput, commitText],
  );

  const onTextKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") setTextInput(null);
      else if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        commitText();
      }
    },
    [commitText],
  );

  const onTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (textInput) setTextInput({ ...textInput, text: e.target.value });
    },
    [textInput],
  );

  const onTextBlur = useCallback(() => commitText(), [commitText]);

  return {
    textInput,
    textareaRef,
    onCanvasClick,
    onTextKeyDown,
    onTextChange,
    onTextBlur,
    reopenWith,
  };
}
