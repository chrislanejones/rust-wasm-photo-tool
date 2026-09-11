// The typefaces the engine can rasterise with, and the one place that hands it
// their bytes.
//
// ── WHY THIS FILE EXISTS ─────────────────────────────────────────────────────
//
// Text is rendered INSIDE the wasm (`src/text.rs`, ab_glyph). Until v8.76 one
// face was compiled in with `include_bytes!` and `render_text` took no font
// parameter, so the Text tool's twelve-entry font dropdown changed the textarea
// preview and nothing else — committed text snapped straight back to Liberation
// Sans. ADR-051 has the measurements. The dropdown was cut to a single entry in
// #113 rather than left lying, because a control that changes the preview and
// not the result is worse than one that does nothing.
//
// Embedding a second face was arithmetically impossible: the deploy sentinel
// holds the wasm in a size band, one Liberation face is ~62,000 B, and the
// headroom was ~17,000. So the faces ship as static assets and arrive at
// runtime through `register_font`. Nothing font-shaped enters the wasm.
//
// ── THE THREE-SURFACE RULE ───────────────────────────────────────────────────
//
// ADR-051 measured three surfaces that each decide, separately, what face the
// text is in:
//
//   1. the box the overlay measures      -> `measure_text` (engine)
//   2. the glyphs in the textarea        -> CSS
//   3. the pixels that get committed     -> `render_text` (engine)
//
// They disagreed by as much as +26.3% in width, which is why typing in
// "Monospace" put Courier glyphs inside a box measured for Liberation Sans.
//
// **`loadFaces` is what makes them agree.** ONE fetch per file, and the SAME
// ArrayBuffer goes to `register_font` (surfaces 1 and 3) and to a `FontFace`
// (surface 2). Not "the same font" — the same bytes. There is no version of
// this where the browser and the engine drift, because there is only one copy.
//
// That is also why the served Liberation Sans is here at all, when the engine
// already has it compiled in: without it the textarea falls back to whatever
// Arial-alike the OS has, which is metric-compatible but not identical. The
// served subset is byte-identical in outline and advance width to the embedded
// face — checked glyph by glyph, all 430 codepoints — so surface 2 finally
// matches surfaces 1 and 3 exactly.
//
// ── ⚠️ REGISTER BEFORE YOU MEASURE ───────────────────────────────────────────
//
// `textMetricsCache` caches `measure_text` / `text_ink_offset` answers keyed on
// their arguments, on the argument that those functions are pure. `font_id` is
// now one of those arguments. Measuring a face BEFORE it is registered answers
// in the FALLBACK, and that wrong answer would then be cached against the real
// id for the life of the page — text landing a few pixels off its own preview,
// with nothing to invalidate.
//
// So nothing may offer a face until `ensureEngineFonts` has resolved for the
// engine that will render it. That is the whole contract of this module.

import type { ImageHorseTool } from "stamp_tool";

/** One selectable typeface. */
export interface EngineFace {
  /** What crosses the wasm boundary and what a saved document stores. `""` is
   *  the embedded face — see `fonts::DEFAULT_FONT_ID`. */
  readonly id: string;
  readonly label: string;
  /** `font-family` for the textarea preview. The first name is this module's
   *  own `FontFace`, so a differently-versioned Liberation installed on the
   *  user's machine cannot shadow the bytes the engine was given. */
  readonly css: string;
  readonly regular: string;
  readonly bold: string;
}

/** The faces the app serves. Liberation 2.1.5, SIL OFL 1.1 — see
 *  `app/public/fonts/LICENSE.txt`. Metric-compatible with Arial, Times New
 *  Roman and Courier New respectively, which is why they read as an ordinary
 *  sans / serif / mono set rather than as three arbitrary fonts. */
export const ENGINE_FACES: readonly EngineFace[] = [
  {
    id: "",
    label: "Liberation Sans",
    css: "'IH Liberation Sans', Arial, Helvetica, sans-serif",
    regular: "/fonts/LiberationSans-Regular.ttf",
    bold: "/fonts/LiberationSans-Bold.ttf",
  },
  {
    id: "liberation-serif",
    label: "Liberation Serif",
    css: "'IH Liberation Serif', 'Times New Roman', Times, serif",
    regular: "/fonts/LiberationSerif-Regular.ttf",
    bold: "/fonts/LiberationSerif-Bold.ttf",
  },
  {
    id: "liberation-mono",
    label: "Liberation Mono",
    css: "'IH Liberation Mono', 'Courier New', Courier, monospace",
    regular: "/fonts/LiberationMono-Regular.ttf",
    bold: "/fonts/LiberationMono-Bold.ttf",
  },
] as const;

/** The face `id` names, or the default when it names nothing this build ships
 *  (a document authored against a face that has since been removed). */
function faceById(id: string): EngineFace {
  return ENGINE_FACES.find((f) => f.id === id) ?? ENGINE_FACES[0];
}

/** CSS `font-family` for `id` — surface 2 of the three-surface rule. */
export function faceCss(id: string): string {
  return faceById(id).css;
}

/** The CSS family name this module registers a face under, derived from the
 *  first quoted name in its `css` stack so the two cannot drift. */
function cssFamily(face: EngineFace): string {
  const m = /^'([^']+)'/.exec(face.css);
  return m ? m[1] : face.label;
}

type Loaded = { face: EngineFace; bold: boolean; bytes: Uint8Array };

let facesPromise: Promise<Loaded[]> | null = null;

/**
 * Fetch every face once and register the browser half (surface 2).
 *
 * Resolves with whatever LOADED, never rejects. A face that 404s or arrives
 * truncated is simply absent from the result and therefore never offered — the
 * Text tool keeps working on the embedded face, which is the whole reason the
 * engine falls back rather than failing.
 */
function loadFaces(): Promise<Loaded[]> {
  if (facesPromise) return facesPromise;
  facesPromise = (async () => {
    const jobs: Promise<Loaded | null>[] = [];
    for (const face of ENGINE_FACES) {
      for (const bold of [false, true] as const) {
        jobs.push(
          (async () => {
            try {
              const res = await fetch(bold ? face.bold : face.regular);
              if (!res.ok) return null;
              const buf = await res.arrayBuffer();
              // Surface 2, from the SAME buffer the engine is about to get.
              // `document.fonts` is absent in jsdom and in a worker; the engine
              // half must still happen, so this is guarded rather than awaited
              // as a precondition.
              if (typeof FontFace === "function" && typeof document !== "undefined") {
                const ff = new FontFace(cssFamily(face), buf, {
                  weight: bold ? "700" : "400",
                  style: "normal",
                });
                await ff.load();
                document.fonts.add(ff);
              }
              return { face, bold, bytes: new Uint8Array(buf) };
            } catch {
              return null;
            }
          })(),
        );
      }
    }
    return (await Promise.all(jobs)).filter((x): x is Loaded => x !== null);
  })();
  return facesPromise;
}

/** Per-engine registration. The registry is per wasm INSTANCE — the batch
 *  path's throwaway engine has its own — so this is keyed on the handle, not
 *  global. A `WeakMap` so a disposed engine does not pin its promise. */
const registered = new WeakMap<object, Promise<void>>();

/**
 * Make every shipped face available to `tool`, exactly once per engine.
 *
 * Await this before offering a face, selecting one, or measuring text in one.
 * Safe and cheap to call on every Text-tool mount: the fetch is shared across
 * engines and `register_font` is idempotent inside the wasm.
 */
export function ensureEngineFonts(tool: ImageHorseTool | null | undefined): Promise<void> {
  if (!tool || typeof tool.register_font !== "function") return Promise.resolve();
  const key = tool as unknown as object;
  const existing = registered.get(key);
  if (existing) return existing;
  const job = (async () => {
    for (const { face, bold, bytes } of await loadFaces()) {
      if (!face.id) continue; // the embedded face needs no registering
      try {
        // Awaited one at a time on purpose: behind the worker each call is a
        // postMessage, and a `Promise.all` of six would put six 30 KB copies
        // in flight at once for no gain — the user is not waiting on this.
        await tool.register_font(face.id, bold, bytes);
      } catch (err) {
        // A face the engine refused stays unregistered and therefore
        // unofferable. Log rather than throw: one bad file must not take the
        // Text tool down with it.
        console.warn(`[fonts] ${face.label} ${bold ? "bold" : "regular"} rejected`, err);
      }
    }
  })();
  registered.set(key, job);
  return job;
}

/** Which faces this engine can actually render right now. Anything else must
 *  not be offered — see the "register before you measure" note above. */
export async function availableFaces(
  tool: ImageHorseTool | null | undefined,
): Promise<EngineFace[]> {
  if (!tool || typeof tool.has_font !== "function") return [ENGINE_FACES[0]];
  await ensureEngineFonts(tool);
  const out: EngineFace[] = [];
  for (const face of ENGINE_FACES) {
    if (!face.id || (await tool.has_font(face.id, false))) out.push(face);
  }
  return out;
}

/**
 * Keep asking until the engine can answer, then report the faces it has.
 *
 * ⚠️ THIS EXISTS BECAUSE A REF IS NOT A DEPENDENCY. The engine lives in a
 * worker (ADR-024) and the panel that wants a font list usually mounts BEFORE
 * it is up, so `toolRef.current` is `null` at that moment. The first cut of
 * `useEngineFaces` read the ref once in an effect keyed on `[toolRef]` — a ref
 * object's identity never changes, so the effect ran exactly once, got the
 * correct answer "just the embedded face", and **could never ask again.** The
 * dropdown was stuck at one entry on a real deploy: the whole feature silently
 * inert, in exactly the shape ADR-051 warned about. It passed locally only
 * because the manual test loaded an image first and warmed the engine.
 *
 * `getTool` is a thunk, not a value, for that reason — the caller must be able
 * to re-read the ref on every attempt.
 *
 * `onUpdate` is called each time the answer improves, so a caller can render
 * the embedded face immediately and widen the list as registration lands.
 * Stops at the full set, or at `giveUpMs` — a face missing because its file
 * 404'd is a permanent answer, and polling forever for it would be a leak.
 *
 * Returns a cancel function. Call it on unmount.
 */
export function resolveFacesWhenReady(
  getTool: () => ImageHorseTool | null | undefined,
  onUpdate: (faces: EngineFace[]) => void,
  opts: { pollMs?: number; giveUpMs?: number } = {},
): () => void {
  const pollMs = opts.pollMs ?? 250;
  const deadline = Date.now() + (opts.giveUpMs ?? 10_000);
  let live = true;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const attempt = () => {
    if (!live) return;
    const tool = getTool();
    if (!tool) {
      if (Date.now() < deadline) timer = setTimeout(attempt, pollMs);
      return;
    }
    void availableFaces(tool).then((faces) => {
      if (!live) return;
      onUpdate(faces);
      // Registration may simply not have finished. `ensureEngineFonts` is
      // idempotent, so retrying costs one `has_font` per face and no refetch.
      if (faces.length < ENGINE_FACES.length && Date.now() < deadline) {
        timer = setTimeout(attempt, pollMs);
      }
    });
  };
  attempt();

  return () => {
    live = false;
    if (timer) clearTimeout(timer);
  };
}

/** Test seam: forget the shared fetch so a spec can re-run `loadFaces`. */
export function __resetEngineFontsForTest(): void {
  facesPromise = null;
}
