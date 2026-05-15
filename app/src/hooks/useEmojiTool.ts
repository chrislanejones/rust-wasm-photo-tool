import { useCallback } from "react";
import type { ImageHorseTool } from "stamp_tool";

interface UseEmojiToolOptions {
  toolRef: React.RefObject<ImageHorseTool | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  flushToCanvas: () => void;
  emoji: string;
  emojiSize: number;
}

export function useEmojiTool({
  toolRef,
  canvasRef,
  flushToCanvas,
  emoji,
  emojiSize,
}: UseEmojiToolOptions) {
  // Render emoji to pixel buffer
  const renderEmojiPixels = useCallback(
    (
      size: number,
      emojiChar: string,
    ): { data: Uint8Array; w: number; h: number } | null => {
      if (!emojiChar) return null;
      const dim = Math.ceil(size * 1.2); // slight padding
      const oc = new OffscreenCanvas(dim, dim);
      const ctx = oc.getContext("2d");
      if (!ctx) return null;

      ctx.clearRect(0, 0, dim, dim);
      ctx.font = `${size}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(emojiChar, dim / 2, dim / 2);

      const imgData = ctx.getImageData(0, 0, dim, dim);
      return { data: new Uint8Array(imgData.data), w: dim, h: dim };
    },
    [],
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (e.button !== 0 || !emoji) return;
      const tool = toolRef.current;
      const canvas = canvasRef.current;
      if (!tool || !canvas) return;

      const rect = canvas.getBoundingClientRect();
      const cx = ((e.clientX - rect.left) * canvas.width) / rect.width;
      const cy = ((e.clientY - rect.top) * canvas.height) / rect.height;

      const pixels = renderEmojiPixels(emojiSize, emoji);
      if (!pixels) return;

      // Center the emoji on click point
      const destX = Math.round(cx - pixels.w / 2);
      const destY = Math.round(cy - pixels.h / 2);

      tool.stamp_pixels(pixels.data, pixels.w, pixels.h, destX, destY);
      flushToCanvas();
    },
    [toolRef, canvasRef, emoji, emojiSize, renderEmojiPixels, flushToCanvas],
  );

  // No-op for move/up — emoji is single-click stamp
  const onMouseMove = useCallback(() => {}, []);
  const onMouseUp = useCallback(() => {}, []);

  return { onMouseDown, onMouseMove, onMouseUp };
}
