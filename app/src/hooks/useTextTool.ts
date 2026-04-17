import { useCallback, useEffect, useRef, useState } from "react";
import type { CloneStampTool } from "stamp_tool";
import type { ToolSettings } from "@/lib/types";

export interface TextInput {
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
  const textInputRef = useRef<TextInput | null>(null);
  textInputRef.current = textInput;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
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
    const ti = textInputRef.current;
    if (!ti) return;
    textInputRef.current = null;
    setTextInput(null);
    if (!ti.text.trim()) return;
    const tool = toolRef.current;
    if (!tool) return;
    const { fontSize, fontWeight, textColor } = settingsRef.current;
    const hex = textColor.replace("#", "");
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    tool.commit_text(
      ti.text,
      fontSize,
      r, g, b,
      fontWeight === "bold",
      Math.round(ti.canvasX),
      Math.round(ti.canvasY),
    );
    flushToCanvas();
    syncState();
    window.dispatchEvent(
      new CustomEvent("text-committed", { detail: { text: ti.text } }),
    );
  }, [toolRef, flushToCanvas, syncState]);

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
      if (textInputRef.current) commitText();
      const pos = { screenX, screenY, canvasX, canvasY };
      lastPositionRef.current = pos;
      const next: TextInput = { ...pos, text: pendingText };
      textInputRef.current = next;
      setTextInput(next);
      if (pendingText) setPendingText("");
      setTimeout(() => textareaRef.current?.focus(), 10);
    },
    [active, canvasRef, containerRef, commitText, pendingText],
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

  // FIX (issue #4): fall back to canvas center when no previous click position
  // exists. Previously this silently stashed pendingText and nothing visible
  // happened when the user clicked a recent text in a fresh session.
  const reopenWith = useCallback(
    (text: string) => {
      const pos = lastPositionRef.current;
      if (pos) {
        if (textInputRef.current) commitText();
        const next: TextInput = { ...pos, text };
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
      const fallback = { screenX, screenY, canvasX, canvasY };
      lastPositionRef.current = fallback;
      if (textInputRef.current) commitText();
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

  const onTextBlur = useCallback(() => {
    if (textInputRef.current) commitText();
  }, [commitText]);

  return {
    textInput,
    textareaRef,
    onCanvasClick,
    onTextKeyDown,
    onTextChange,
    onTextBlur,
    reopenWith,
    setTextPosition,
  };
}