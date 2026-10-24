// Screenshot comparison on the canvas (Night 10-23): the Compare bar, the
// tint over the open photo (B), and the three other ways to look — side by
// side, blink, and the slider. The state is useScreenshotCompare's; CanvasArea
// mounts this next to CompareSlider so both share the canvas's offsetParent.
//
// The tint is a VIEW: a canvas and an SVG over the photo, never written to the
// document, never exported. Done or Esc removes it. Only Mark changes edits
// the photo, as one undo step.
import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { Columns2, Eye, Layers, List, MapPin, SplitSquareHorizontal, X } from "lucide-react";
import type { ImageHorseTool } from "stamp_tool";
import {
  CanvasActionBar,
  CanvasActionBarButton,
  CanvasActionBarText,
} from "@/components/ui/canvas-action-bar";
import { useScreenshotCompare, type ScreenshotCompare } from "@/app/session/useScreenshotCompare";
import { useScreenshotCompareStore, type CompareView } from "@/stores/useScreenshotCompareStore";
import { useUIStore } from "@/stores/useUIStore";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { comparePhotoRect, type ScreenRect } from "@/lib/comparePhotoRect";
import { changesCount, paintMask, regionLabel, type DiffRegion, type ScreenshotDiff } from "@/lib/screenshotDiff";
import { CompareSlider } from "./CompareSlider";
import { ComparePicker } from "./ComparePicker";
import { useCanvasBox } from "./useCanvasBox";
import { useOpenCanvasArea } from "./useOpenCanvasArea";
import type { ScreenBox } from "./panelYield";

interface CompareBarProps {
  canvasEl: HTMLCanvasElement | null;
  toolRef: MutableRefObject<ImageHorseTool | null>;
  flushToCanvas: () => void;
  syncState: () => void;
  /** Undo count: B's pixels may have changed. */
  revision: number;
  /** Zoom the canvas to a change (document px). */
  onFocusRegion?: (r: DiffRegion) => void;
}

const VIEWS: { view: CompareView; label: string; Icon: typeof Layers }[] = [
  { view: "overlay", label: "Overlay", Icon: Layers },
  { view: "side", label: "Side by side", Icon: Columns2 },
  { view: "blink", label: "Blink", Icon: Eye },
  { view: "slider", label: "Slider", Icon: SplitSquareHorizontal },
];

/** Blink swaps A and B this often. */
const BLINK_MS = 600;

function reducedMotion(): boolean {
  return (
    document.documentElement.classList.contains("reduce-motion") ||
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

/** The tint token, read from CSS so the canvas uses the same color as the
 *  outlines. */
function tintRgba(): [number, number, number, number] {
  const hex = getComputedStyle(document.documentElement).getPropertyValue("--compare-tint").trim();
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16), 115] : [219, 39, 119, 115];
}

/** Changed pixels, tinted, under an outline per change. The outline is the
 *  token over a white halo so it reads on a dark screenshot and a light one. */
function TintLayer({ rect, diff, origin, focused }: { rect: ScreenRect; diff: ScreenshotDiff; origin: [number, number]; focused: number | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx || !diff.w || !diff.h) return;
    const img = ctx.createImageData(diff.w, diff.h);
    paintMask(diff, img, tintRgba());
    ctx.putImageData(img, 0, 0);
  }, [diff]);
  return (
    <div
      className="absolute pointer-events-none"
      style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height, zIndex: "var(--z-compare)" }}
    >
      <canvas ref={ref} data-testid="compare-tint" width={diff.w} height={diff.h} className="absolute inset-0 size-full" />
      <svg className="absolute inset-0 size-full overflow-visible" viewBox={`0 0 ${diff.w} ${diff.h}`} preserveAspectRatio="none" aria-hidden>
        {diff.regions.map((r, i) => {
          const [x, y] = [r.x - origin[0], r.y - origin[1]];
          const width = i === focused ? 4 : 2;
          return (
            <g key={i}>
              <rect x={x} y={y} width={r.w} height={r.h} fill="none" stroke="var(--on-photo)" strokeWidth={width + 2} vectorEffect="non-scaling-stroke" />
              <rect x={x} y={y} width={r.w} height={r.h} fill="none" stroke="var(--compare-tint)" strokeWidth={width} vectorEffect="non-scaling-stroke" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Photo A laid over B at B's scale, shown while `showA`. */
function BlinkLayer({ rect, cmp, showA }: { rect: ScreenRect; cmp: ScreenshotCompare; showA: boolean }) {
  if (!cmp.a || !cmp.bounds) return null;
  const scale = rect.width / cmp.bounds[2];
  return (
    <div
      className="absolute pointer-events-none overflow-hidden"
      style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height, zIndex: "var(--z-compare)" }}
    >
      <img
        data-testid="compare-blink-a"
        src={cmp.a.url}
        alt=""
        className="absolute left-0 top-0 max-w-none"
        style={{ width: cmp.a.w * scale, height: cmp.a.h * scale, visibility: showA ? "visible" : "hidden" }}
      />
    </div>
  );
}

/** B's photo layer as an image (no annotations), for Side by side. */
function usePhotoLayerUrl(toolRef: MutableRefObject<ImageHorseTool | null>, on: boolean, revision: number) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const tool = toolRef.current;
    if (!on || !tool) return;
    let live = true;
    let made: string | null = null;
    void (async () => {
      const layers = JSON.parse(await tool.get_layers()) as { kind: string }[];
      const i = layers.findIndex((l) => l.kind !== "canvas");
      if (i < 0) return;
      const png = await tool.get_layer_png(i);
      if (!live) return;
      made = URL.createObjectURL(new Blob([new Uint8Array(png)], { type: "image/png" }));
      setUrl(made);
    })();
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
      setUrl(null);
    };
  }, [toolRef, on, revision]);
  return url;
}

/** A and B next to each other over the canvas area, each with the change
 *  outlines, both cut to the area they share. */
function SideBySide({ cmp, bUrl, docW, docH }: { cmp: ScreenshotCompare; bUrl: string | null; docW: number; docH: number }) {
  const { a, bounds, diff } = cmp;
  if (!a || !bounds || !diff) return null;
  const outlines = (dx: number, dy: number) =>
    diff.regions.map((r, i) => (
      <rect key={i} x={r.x - dx} y={r.y - dy} width={r.w} height={r.h} fill="none" stroke="var(--compare-tint)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
    ));
  const figure = (label: string, children: React.ReactNode, testId: string) => (
    <figure className="flex min-w-0 flex-1 flex-col items-center gap-1" data-testid={testId}>
      <figcaption className="text-xs text-theme-muted-foreground">{label}</figcaption>
      <svg className="max-h-full w-full" viewBox={`0 0 ${diff.w} ${diff.h}`} role="img" aria-label={label}>
        {children}
      </svg>
    </figure>
  );
  return (
    <div className="absolute inset-0 flex items-center gap-4 bg-theme-background p-4 pt-16" style={{ zIndex: "var(--z-compare)" }}>
      {figure(`A · ${cmp.other?.name ?? "other photo"}`, <>
        <image href={a.url} width={a.w} height={a.h} />
        {outlines(bounds[0], bounds[1])}
      </>, "compare-side-a")}
      {figure("B · this photo", <>
        {bUrl && <image href={bUrl} x={-bounds[0]} y={-bounds[1]} width={docW} height={docH} />}
        {outlines(bounds[0], bounds[1])}
      </>, "compare-side-b")}
    </div>
  );
}

/** Room the bar, the size line and the change list take under the anchor. */
const STACK_PX = 150;

/** Where the bar hangs: under the canvas, centered, like the other canvas
 *  bars — but inside `area`, the part of the canvas area no panel covers. The
 *  bars all sit under the Tools, Gallery and Review panels, and this one is
 *  how you leave compare, so it goes where the panels are not (C3: the
 *  right-click way in leaves the Gallery strip open over the canvas's foot).
 *  Centered on the part of the photo that is in view, not on the whole
 *  canvas, which at 800% is mostly off-screen (C7). Kept far enough up that
 *  the size line and the change list fit below it. `box` changes with zoom,
 *  pan and resizes, `area` with the panels, which is when this has to move. */
function barAnchor(canvasEl: HTMLCanvasElement | null, box: ScreenRect | null, area: ScreenBox | null) {
  if (!canvasEl || !box || !area) return null;
  const r = canvasEl.getBoundingClientRect();
  const [l, rr] = [Math.max(r.left, area.l), Math.min(r.right, area.r)];
  const x = rr > l ? (l + rr) / 2 : (area.l + area.r) / 2;
  return { x, y: Math.max(area.t + 8, Math.min(r.bottom + 14, area.b - STACK_PX)) };
}

export function CompareBar({ canvasEl, toolRef, flushToCanvas, syncState, revision: undoCount, onFocusRegion }: CompareBarProps) {
  // Same revision CompareSlider reads: a resize, an undo, a flatten or a layer
  // change can all move B's pixels.
  const revision = undoCount + useGalleryStore((s) => s.layerRevision);
  const cmp = useScreenshotCompare({ toolRef, flushToCanvas, syncState, revision });
  const view = useScreenshotCompareStore((s) => s.view);
  const setView = useScreenshotCompareStore((s) => s.setView);
  const sensitivity = useScreenshotCompareStore((s) => s.sensitivity);
  const setSensitivity = useScreenshotCompareStore((s) => s.setSensitivity);
  const focused = useScreenshotCompareStore((s) => s.focused);
  const setFocused = useScreenshotCompareStore((s) => s.setFocused);
  const box = useCanvasBox(canvasEl, cmp.active);
  const area = useOpenCanvasArea(canvasEl, cmp.active);
  const [listOpen, setListOpen] = useState(false);
  const [showA, setShowA] = useState(false);
  // Asked when blink starts, not at mount: the Reduce Motion setting can
  // change while the editor is open.
  const still = cmp.active && view === "blink" && reducedMotion();
  const bUrl = usePhotoLayerUrl(toolRef, cmp.active && view === "side", revision);
  const { stop } = cmp;

  // One compare at a time: opening this one closes the A/B original slider.
  useEffect(() => {
    if (cmp.active) useUIStore.getState().setCompareActive(false);
  }, [cmp.active]);

  // Esc leaves compare (after anything else that wanted the key).
  useEffect(() => {
    if (!cmp.active) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key !== "Escape" || e.defaultPrevented || t?.closest("input, textarea, [contenteditable], [role=dialog]")) return;
      stop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cmp.active, stop]);

  // Blink: A and B swap every 600 ms, unless motion is reduced — then the
  // bar's Show A / Show B button swaps them by hand.
  useEffect(() => {
    setShowA(false);
    if (!cmp.active || view !== "blink" || still) return;
    const t = window.setInterval(() => setShowA((v) => !v), BLINK_MS);
    return () => window.clearInterval(t);
  }, [cmp.active, view, still]);

  useEffect(() => {
    if (!cmp.active) setListOpen(false);
  }, [cmp.active]);

  if (!cmp.active) return <ComparePicker />;

  const anchor = barAnchor(canvasEl, box, area);
  const { diff, bounds } = cmp;
  const n = diff?.regions.length ?? 0;
  const photoRect =
    box && bounds && canvasEl
      ? comparePhotoRect(box, canvasEl.width, canvasEl.height, { x: bounds[0], y: bounds[1], width: bounds[2], height: bounds[3] })
      : null;
  const overlapRect =
    photoRect && diff && bounds
      ? { ...photoRect, width: (photoRect.width * diff.w) / bounds[2], height: (photoRect.height * diff.h) / bounds[3] }
      : null;
  const status =
    cmp.status === "failed" ? "Couldn't read the other photo" : cmp.status !== "ready" || !diff ? "Comparing…" : changesCount(n);

  return (
    <>
      <ComparePicker />
      {view === "overlay" && overlapRect && diff && bounds && (
        <TintLayer rect={overlapRect} diff={diff} origin={[bounds[0], bounds[1]]} focused={focused} />
      )}
      {view === "blink" && photoRect && <BlinkLayer rect={photoRect} cmp={cmp} showA={showA} />}
      {view === "side" && canvasEl && <SideBySide cmp={cmp} bUrl={bUrl} docW={canvasEl.width} docH={canvasEl.height} />}
      {view === "slider" && cmp.a && (
        <CompareSlider
          canvasEl={canvasEl}
          toolRef={toolRef}
          revision={revision}
          source={{ url: cmp.a.url, left: "A", right: "B" }}
        />
      )}
      {/* The bars sit over the four views (--z-compare): Side by side covers the
          whole canvas area and the Slider the photo, and from either a person
          must reach the other views and Done (C15, C16). Still under the
          panels, like every canvas bar. */}
      {anchor && (
        <div className="absolute left-0 top-0" style={{ zIndex: "var(--z-topbar)" }}>
          <CanvasActionBar x={anchor.x} y={anchor.y} label="Compare" data-testid="compare-bar">
            <div role="group" aria-label="View" className="flex items-center gap-0.5">
              {VIEWS.map(({ view: v, label, Icon }) => (
                <CanvasActionBarButton key={v} onClick={() => setView(v)} pressed={view === v} title={label}>
                  <Icon aria-hidden className="size-4" />
                  {view === v && label}
                </CanvasActionBarButton>
              ))}
            </div>
            {view === "blink" && still && (
              <CanvasActionBarButton onClick={() => setShowA((v) => !v)} pressed={showA} title={showA ? "Show B" : "Show A"}>
                {showA ? "Showing A" : "Showing B"}
              </CanvasActionBarButton>
            )}
            <label className="flex items-center gap-1 px-1 text-xs text-theme-foreground">
              Sensitivity
              <input
                type="range"
                min={0}
                max={100}
                value={sensitivity}
                onChange={(e) => setSensitivity(Number(e.target.value))}
                onPointerDown={(e) => e.stopPropagation()}
                className="w-20"
                aria-valuetext={`${sensitivity} of 100`}
              />
            </label>
            {n > 0 ? (
              <CanvasActionBarButton onClick={() => setListOpen((v) => !v)} pressed={listOpen} title={`${status}: list them`}>
                <List aria-hidden className="size-4" /> {status}
              </CanvasActionBarButton>
            ) : (
              <CanvasActionBarText>{status}</CanvasActionBarText>
            )}
            <CanvasActionBarButton onClick={() => void cmp.mark()} disabled={!n || cmp.marking} title="Mark changes">
              <MapPin aria-hidden className="size-4" /> Mark changes
            </CanvasActionBarButton>
            <CanvasActionBarButton onClick={stop} title="Done">
              <X aria-hidden className="size-4" /> Done
            </CanvasActionBarButton>
          </CanvasActionBar>
          {cmp.sizesLine && (
            <CanvasActionBar x={anchor.x} y={anchor.y + 46} label="Size note">
              <span data-testid="compare-sizes" className="px-2 text-xs text-theme-muted-foreground">
                {cmp.sizesLine}
              </span>
            </CanvasActionBar>
          )}
          {listOpen && diff && n > 0 && (
            <CanvasActionBar x={anchor.x} y={anchor.y + (cmp.sizesLine ? 88 : 46)} label="Changes">
              <ul aria-label="Changes" className="flex max-w-[80vw] flex-wrap items-center gap-1">
                {diff.regions.map((r, i) => (
                  <li key={i}>
                    <CanvasActionBarButton
                      onClick={() => {
                        setFocused(i);
                        onFocusRegion?.(r);
                      }}
                      pressed={focused === i}
                      title={regionLabel(i, n, r)}
                    >
                      <span data-testid="compare-region" data-box={`${r.x},${r.y},${r.w},${r.h}`}>
                        {i + 1}
                      </span>
                    </CanvasActionBarButton>
                  </li>
                ))}
              </ul>
            </CanvasActionBar>
          )}
        </div>
      )}
    </>
  );
}
