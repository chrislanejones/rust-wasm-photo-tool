import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

/**
 * The brush cursor ring that follows the pointer.
 *
 * The POSITION IS NOT REACT STATE (10-07). It was: `setPos` on every window
 * mousemove, which re-rendered AppShell — the component that calls this
 * hook, ~3,500 lines — once per mouse event: 200 commits measured during one
 * 200-event brush stroke on the v9.18 production build, all competing with
 * the stroke for the main thread. Where a ring is on screen only changes a
 * style, so the hook writes `left`/`top` straight onto every registered
 * ring element and React never hears about it. Visibility and diameter are
 * still state: they change when a tool or setting does, not per pixel.
 *
 * `cursorRef` is a callback ref: attach it to each ring `<div>`. A ring that
 * mounts mid-move is placed at the last known pointer position at once, so
 * it never flashes at the viewport origin.
 */
export function useBrushPreview(
    brushSize: number,
    _zoom: number,
    canvasRef: RefObject<HTMLCanvasElement | null>,
) {
    const [visible, setVisible] = useState(false);
    const canvasRectRef = useRef<DOMRect | null>(null);
    const rings = useRef(new Set<HTMLElement>());
    const last = useRef({ x: -999, y: -999 });

    useEffect(() => {
        const move = (e: MouseEvent) => {
            last.current = { x: e.clientX, y: e.clientY };
            for (const el of rings.current) {
                el.style.left = `${e.clientX}px`;
                el.style.top = `${e.clientY}px`;
            }
        };
        window.addEventListener("mousemove", move);
        return () => window.removeEventListener("mousemove", move);
    }, []);

    const cursorRef = useCallback((el: HTMLElement | null) => {
        if (!el) return;
        el.style.left = `${last.current.x}px`;
        el.style.top = `${last.current.y}px`;
        rings.current.add(el);
        // React 19 calls the cleanup when the element unmounts.
        return () => {
            rings.current.delete(el);
        };
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

    return { cursorRef, visible, diameter, onCanvasEnter, onCanvasLeave };
}
