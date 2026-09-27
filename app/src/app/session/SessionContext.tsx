// The session context — step B1 of docs/AppShell-Refactor-Plan.md.
//
// AppShell owns one engine facade (`useCloneStamp`) and a handful of tool
// hook instances (`useDrawingTools`, `usePastePlacementTool`, `useTextTool`)
// and, until this file, handed every one of their callbacks to its children
// one prop at a time: `onBrightness={stamp.adjustBrightness}` went AppShell →
// ToolsSidebar → EffectsSettings, and each new adjustment added a prop at each
// hop. There was no React context anywhere in app/src, so a new feature had
// nowhere else to go. This is where it goes now.
//
// Context rather than a Zustand store, on purpose: these are functions bound
// to a hook instance with refs inside — not serialisable state, and not
// something a persisted store should own (ADR-026's "wrong ownership").
//
// THREE CONTEXTS, NOT ONE, and the split is the whole point:
//
//   EngineActions   the ~60 engine callbacks. Every one is a `useCallback` or
//                   comes from a `useMemo`'d sub-hook, so the value is made
//                   shallow-stable here and its identity moves only when a
//                   callback actually changes (rare: a ref-bound callback
//                   never does). A panel that only CALLS the engine does not
//                   re-render on every stroke.
//   EngineState     `stamp.state` — width, layers, undoCount, history, zoom.
//                   Changes on every engine sync, i.e. per stroke end. Only
//                   the consumers that DISPLAY engine state subscribe here.
//   SessionTools    the drawing / paste / text hook instances and the refs
//                   AppShell owns (canvas, container, draw-preview) plus the
//                   ADR-024 a11.1 `attachCanvas`. These carry per-render state
//                   of their own (a crop selection, an open text input), so
//                   this value changes about as often as AppShell renders —
//                   exactly what the props it replaces did.
//
// That is the plan's "split the value" mitigation for the risk it named: a
// single context whose identity changed per stroke would re-render every
// consumer on every brush move. With the actions stable and the state
// separate, the compiler-memoized consumers (B0) get the granularity the
// props never had.
import { createContext, useContext, useMemo, useRef, type ReactNode, type RefObject } from "react";
import type { useCloneStamp, CloneStampState } from "@/hooks/useCloneStamp";
import type { useDrawingTools } from "@/hooks/useDrawingTools";
import type { usePastePlacementTool } from "@/hooks/usePastePlacementTool";
import type { useTextTool } from "@/hooks/useTextTool";

/** The whole engine facade, as AppShell holds it. */
export type Engine = ReturnType<typeof useCloneStamp>;
/** Everything on the facade except `state` — the callable surface. */
export type EngineActions = Omit<Engine, "state">;

export interface SessionTools {
  drawingTools: ReturnType<typeof useDrawingTools>;
  pastePlacement: ReturnType<typeof usePastePlacementTool>;
  textTool: ReturnType<typeof useTextTool>;
  /** The main <canvas>. Written by `attachCanvas`; read everywhere. */
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /** The canvas host <div> — the text overlay positions itself against it. */
  containerRef: RefObject<HTMLDivElement | null>;
  /** The arrow/shapes/crop rubber-band surface `useDrawingTools` draws on. */
  drawPreviewRef: RefObject<HTMLCanvasElement | null>;
  /** ADR-024 a11.1 — the canvas ref callback, owned by AppShell so the
   *  generation counter outlives CanvasArea's remounts across the Batch
   *  ternary. CanvasArea must call THIS, never write `canvasRef` itself. */
  attachCanvas: (el: HTMLCanvasElement | null) => void;
}

const EngineActionsContext = createContext<EngineActions | null>(null);
const EngineStateContext = createContext<CloneStampState | null>(null);
const SessionToolsContext = createContext<SessionTools | null>(null);

/** Returns the previous object while every own property is `Object.is`-equal
 *  to the next one's. The engine facade is a fresh literal every render whose
 *  members are individually stable; this gives the literal that stability
 *  without a 60-entry dependency array. */
function useShallowStable<T extends object>(next: T): T {
  const ref = useRef(next);
  const prev = ref.current;
  let same = true;
  for (const k in next) {
    if (!Object.is(prev[k], next[k])) { same = false; break; }
  }
  if (same) for (const k in prev) if (!(k in next)) { same = false; break; }
  if (!same) ref.current = next;
  return ref.current;
}

export function SessionProvider({
  stamp,
  tools,
  children,
}: {
  stamp: Engine;
  tools: SessionTools;
  children: ReactNode;
}) {
  const { state, ...rest } = stamp;
  const actions = useShallowStable(rest);
  const { drawingTools, pastePlacement, textTool, canvasRef, containerRef, drawPreviewRef, attachCanvas } = tools;
  const toolsValue = useMemo<SessionTools>(
    () => ({ drawingTools, pastePlacement, textTool, canvasRef, containerRef, drawPreviewRef, attachCanvas }),
    [drawingTools, pastePlacement, textTool, canvasRef, containerRef, drawPreviewRef, attachCanvas],
  );
  return (
    <EngineActionsContext.Provider value={actions}>
      <EngineStateContext.Provider value={state}>
        <SessionToolsContext.Provider value={toolsValue}>{children}</SessionToolsContext.Provider>
      </EngineStateContext.Provider>
    </EngineActionsContext.Provider>
  );
}

function required<T>(v: T | null, hook: string): T {
  if (v === null) {
    throw new Error(`${hook}() called outside <SessionProvider> — it is mounted once, in AppShell.`);
  }
  return v;
}

/** The engine's callable surface. Stable across strokes — safe to read in a
 *  panel that never displays engine state. */
export function useEngine(): EngineActions {
  return required(useContext(EngineActionsContext), "useEngine");
}

/** `stamp.state`. Re-renders the caller on every engine sync; read it only
 *  where the state is displayed. */
export function useEngineState(): CloneStampState {
  return required(useContext(EngineStateContext), "useEngineState");
}

/** The tool hook instances and the canvas refs AppShell owns. */
export function useSession(): SessionTools {
  return required(useContext(SessionToolsContext), "useSession");
}
