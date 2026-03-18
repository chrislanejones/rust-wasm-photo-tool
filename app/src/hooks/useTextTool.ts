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
    const lines = text.split("\n");
    const lineHeight = fontSize * 1.3;
    const totalHeight = Math.ceil(lines.length * lineHeight + fontSize * 0.3);

    const mc = new OffscreenCanvas(1, 1);
    const mctx = mc.getContext("2d")!;
    mctx.font = `${fontWeight} ${fontSize}px sans-serif`;
    let maxWidth = 0;
    for (const line of lines)
      maxWidth = Math.max(maxWidth, mctx.measureText(line).width);
    const totalWidth = Math.ceil(maxWidth + fontSize * 0.5);
    if (totalWidth <= 0 || totalHeight <= 0) {
      setTextInput(null);
      return;
    }

    const oc = new OffscreenCanvas(totalWidth, totalHeight);
    const ctx = oc.getContext("2d")!;
    ctx.clearRect(0, 0, totalWidth, totalHeight);
    ctx.font = `${fontWeight} ${fontSize}px sans-serif`;
    ctx.fillStyle = textColor;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    for (let i = 0; i < lines.length; i++)
      ctx.fillText(lines[i], 0, i * lineHeight);

    const imgData = ctx.getImageData(0, 0, totalWidth, totalHeight);
    tool.stamp_pixels(
      new Uint8Array(imgData.data),
      totalWidth,
      totalHeight,
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

      setTextInput({ screenX, screenY, canvasX, canvasY, text: pendingText });
      if (pendingText) setPendingText("");
      setTimeout(() => textareaRef.current?.focus(), 10);
    },
    [active, canvasRef, containerRef, textInput, commitText, pendingText],
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
  };
}
