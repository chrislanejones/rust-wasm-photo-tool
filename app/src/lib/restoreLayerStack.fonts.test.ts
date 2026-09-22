// The archive restore registers the runtime faces BEFORE it restores text.
//
// `restore_text_annotation` rasterizes on the spot, and a `font_id` the engine
// has no bytes for is drawn in the embedded Sans. Until v8.82 nothing on the
// resume path — or the batch/ZIP composite, which shares this helper —
// registered Liberation Mono or Serif, so a text in either came back
// proportional after a reload and in every ZIP, while its `font_id` stayed
// correct.
import { describe, it, expect, vi, beforeEach } from "vitest";

const fontsForRestore = vi.hoisted(() => vi.fn(async (): Promise<void> => {}));
vi.mock("@/lib/engineFonts", () => ({ ensureEngineFontsForRestore: fontsForRestore }));

import { restoreLayerStack } from "./restoreLayerStack";
import type { PersistedLayer } from "@/lib/editPersistence";

/** Records every engine call, in order. Everything the helper touches is a
 *  no-op except the two calls these tests are about. */
function fakeTool() {
  const calls: string[] = [];
  const tool = new Proxy(
    {},
    {
      get: (_t, prop: string) => {
        if (prop === "then") return undefined; // not a thenable
        return (...args: unknown[]) => {
          calls.push(prop === "restore_text_annotation" ? `text:${String(args[args.length - 4])}` : prop);
          return prop.startsWith("get_") ? [] : 1;
        };
      },
    },
  );
  return { tool, calls };
}

const decodePng = async () => ({ rgba: new Uint8ClampedArray(4), w: 1, h: 1 });

function layerWithText(fontId: string | undefined): PersistedLayer {
  return {
    name: "Layer 1",
    visible: true,
    opacity: 1,
    png: new Uint8Array([0]),
    annotations: [
      {
        text: "MMMM iiii",
        font_size: 24,
        r: 0,
        g: 0,
        b: 0,
        bold: false,
        x: 10,
        y: 10,
        rotation_deg: 0,
        ...(fontId === undefined ? {} : { font_id: fontId }),
      },
    ],
  } as unknown as PersistedLayer;
}

beforeEach(() => {
  fontsForRestore.mockReset();
  fontsForRestore.mockImplementation(async () => {});
});

describe("restoreLayerStack and the runtime faces", () => {
  it("waits for the faces before it restores a text that names one", async () => {
    let release!: () => void;
    fontsForRestore.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const { tool, calls } = fakeTool();

    const pending = restoreLayerStack(
      tool as never,
      [layerWithText("liberation-mono")],
      undefined,
      decodePng,
    );
    await vi.waitFor(() => expect(fontsForRestore).toHaveBeenCalled());
    // Identity, not deep equality: the fake engine is a Proxy that answers
    // every property, including the ones the matcher probes.
    expect(fontsForRestore.mock.calls[0][0]).toBe(tool);
    await new Promise((r) => setTimeout(r, 50));
    expect(
      calls.some((c) => c.startsWith("text:")),
      "no text was restored while the faces were still loading",
    ).toBe(false);

    release();
    await pending;
    expect(calls, "the text was restored once they were in").toContain("text:liberation-mono");
  });

  it("does not wait at all when every text uses the embedded face", async () => {
    // The common case — no text, or only the default face — must not pay for
    // a font fetch on every reload.
    const { tool } = fakeTool();
    await restoreLayerStack(tool as never, [layerWithText(""), layerWithText(undefined)], undefined, decodePng);
    expect(fontsForRestore).not.toHaveBeenCalled();
  });
});
