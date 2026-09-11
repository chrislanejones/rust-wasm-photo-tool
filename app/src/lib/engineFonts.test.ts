// The two rules this module exists to enforce, and one regression it closes.
//
// ⚠️ THESE ARE NOT "does the fetch work" TESTS. ADR-051 is explicit that a font
// test which checks a list gained an entry would have passed against the inert
// twelve-entry dropdown this feature replaces. The pixel-level assertions live
// in Rust (`tests/text_font_selection.rs`, which compares ink extents). What is
// left for this side is the ORDERING that keeps the metrics cache sound, and
// that is what is asserted here.

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  ENGINE_FACES,
  faceCss,
  ensureEngineFonts,
  availableFaces,
  __resetEngineFontsForTest,
} from "./engineFonts";

/** A minimal engine double that records what it was asked, in order. */
function fakeTool(opts: { reject?: string } = {}) {
  const calls: string[] = [];
  const registry = new Set<string>();
  return {
    calls,
    register_font(id: string, bold: boolean, bytes: Uint8Array) {
      calls.push(`register:${id}:${bold ? "b" : "r"}:${bytes.length}`);
      if (opts.reject && id === opts.reject) throw new Error("not a readable TTF or OTF file");
      registry.add(`${id}:${bold}`);
    },
    has_font(id: string, bold: boolean) {
      calls.push(`has:${id}:${bold ? "b" : "r"}`);
      return registry.has(`${id}:${bold}`);
    },
  };
}

const ORIGINAL_FETCH = globalThis.fetch;

beforeEach(() => {
  __resetEngineFontsForTest();
  globalThis.fetch = vi.fn(async (url: unknown) =>
    ({
      ok: true,
      // Length keyed off the path so a test can tell the six files apart.
      arrayBuffer: async () => new ArrayBuffer(String(url).length),
    }) as unknown as Response,
  ) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

describe("the shipped face list", () => {
  it("leads with the embedded face, whose id is the empty string", () => {
    // `""` is `fonts::DEFAULT_FONT_ID`'s contract and what every annotation
    // written before v8.76 means. If this stops being first, the default
    // selection in both panels silently becomes a different typeface.
    expect(ENGINE_FACES[0].id).toBe("");
  });

  it("gives every face a real fallback stack, not a bare family name", () => {
    // The `FontFace` can fail to load (offline, blocked, a corrupt file) and
    // the textarea still has to show something sane.
    for (const f of ENGINE_FACES) {
      expect(f.css.split(",").length, `${f.label} has no fallback`).toBeGreaterThan(1);
    }
  });

  it("resolves an unknown id to the embedded face rather than throwing", () => {
    // A document authored against a face a later build dropped.
    expect(faceCss("a-face-that-was-removed")).toBe(ENGINE_FACES[0].css);
  });
});

describe("registration ordering — the metrics-cache contract", () => {
  it("never offers a face the engine has not been given bytes for", async () => {
    // ⚠️ THE LOAD-BEARING ONE. `textMetricsCache` keys on the font id and can
    // never be invalidated, so a measurement taken before registration is a
    // wrong answer cached against the real id for the life of the page.
    // `availableFaces` must therefore register FIRST and ask second.
    const tool = fakeTool();
    await availableFaces(tool as never);
    const firstHas = tool.calls.findIndex((c) => c.startsWith("has:"));
    const lastRegister = tool.calls.map((c) => c.startsWith("register:")).lastIndexOf(true);
    expect(lastRegister, "nothing was registered at all").toBeGreaterThanOrEqual(0);
    expect(
      lastRegister,
      "availableFaces asked has_font before every register_font had landed",
    ).toBeLessThan(firstHas);
  });

  it("registers each engine exactly once, however many callers ask", async () => {
    const tool = fakeTool();
    await Promise.all([
      ensureEngineFonts(tool as never),
      ensureEngineFonts(tool as never),
      ensureEngineFonts(tool as never),
    ]);
    const registers = tool.calls.filter((c) => c.startsWith("register:"));
    // Two weights for each face except the embedded one, which needs none.
    expect(registers).toHaveLength((ENGINE_FACES.length - 1) * 2);
  });

  it("registers a SECOND engine too — the registry is per wasm instance", async () => {
    // The batch path builds a throwaway engine per photo. Skipping it there
    // bakes the fallback face while the preview shows the chosen one.
    const live = fakeTool();
    const batch = fakeTool();
    await ensureEngineFonts(live as never);
    await ensureEngineFonts(batch as never);
    expect(batch.calls.filter((c) => c.startsWith("register:")).length).toBeGreaterThan(0);
  });

  it("fetches the font files once and reuses the bytes across engines", async () => {
    const live = fakeTool();
    const batch = fakeTool();
    await ensureEngineFonts(live as never);
    await ensureEngineFonts(batch as never);
    expect(globalThis.fetch).toHaveBeenCalledTimes((ENGINE_FACES.length - 1) * 2 + 2);
  });
});

describe("a face that does not load", () => {
  it("is absent from the offered list rather than broken in it", async () => {
    // Offering it would measure in the fallback and poison the cache; failing
    // the whole Text tool over one missing file would be worse still.
    const tool = fakeTool({ reject: ENGINE_FACES[1].id });
    const faces = await availableFaces(tool as never);
    expect(faces.map((f) => f.id)).not.toContain(ENGINE_FACES[1].id);
    expect(faces[0].id, "the embedded face must always survive").toBe("");
  });

  it("does not stop the OTHER faces registering", async () => {
    const tool = fakeTool({ reject: ENGINE_FACES[1].id });
    const faces = await availableFaces(tool as never);
    expect(faces.map((f) => f.id)).toContain(ENGINE_FACES[2].id);
  });

  it("survives fetch failing outright", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    const tool = fakeTool();
    const faces = await availableFaces(tool as never);
    expect(faces).toEqual([ENGINE_FACES[0]]);
  });

  it("survives an engine with no register_font at all (a stale wasm)", async () => {
    await expect(ensureEngineFonts({} as never)).resolves.toBeUndefined();
    expect(await availableFaces({} as never)).toEqual([ENGINE_FACES[0]]);
  });
});
