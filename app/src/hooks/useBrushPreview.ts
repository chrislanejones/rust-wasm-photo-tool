import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

export function useBrushPreview(
    brushSize: number,
    _zoom: number,
    canvasRef: RefObject<HTMLCanvasElement | null>,
) {
    const [pos, setPos] = useState({ x: -999, y: -999 });
    const [visible, setVisible] = useState(false);
    const canvasRectRef = useRef<DOMRect | null>(null);

    useEffect(() => {
        const move = (e: MouseEvent) => {
            setPos({ x: e.clientX, y: e.clientY });
        };
        window.addEventListener("mousemove", move);
        return () => window.removeEventListener("mousemove", move);
    }, []);

    const onCanvasEnter = useCallback((rect: DOMRect) => {
        canvasRectRef.current = rect;
        setVisible(true);
    }, []);

    const onCanvasLeave = useCallback(() => setVisible(false), []);

    let diameter = brushSize * 2;
    const canvas = canvasRef.current;
    const rect = canvasRectRef.current;
    if (canvas && rect && canvas.width > 0) {
        const scaleX = rect.width / canvas.width;
        diameter = brushSize * 2 * scaleX;
    }

    return { pos, visible, diameter, onCanvasEnter, onCanvasLeave };
}