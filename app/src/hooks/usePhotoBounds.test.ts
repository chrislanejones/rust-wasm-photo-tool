import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/* usePhotoBounds must be re-asked when a photo LOADS (QC, 09-27-2026).
 *
 * Found in imagehorse-qc: a freshly imported 640×400 file read "Photo: 660×420"
 * — the padded document — and stayed there. #81 had fixed exactly this, citing
 * "a freshly imported 800×600 file read 820×620".
 *
 * Isolated in a real build: the engine's photo_bounds() was right all along.
 * One edit made the readout snap to 640×400. The hook only re-asked when
 * `undoCount + layerRevision` moved, and a fresh import moves neither; the tool
 * it reads is a REF, so its `.current` arriving never re-runs the effect. The
 * Resize panel reads the same value, so it locked its aspect ratio to the
 * padded size too.
 *
 * The fix makes the revision a key that also changes when the active photo or
 * the document size does. This pins that key so it cannot quietly narrow back.
 */

const SRC = join(__dirname, "..");
const shell = readFileSync(join(SRC, "app/AppShell.tsx"), "utf8");
const hook = readFileSync(join(SRC, "hooks/usePhotoBounds.ts"), "utf8");

const callSite = shell.slice(shell.indexOf("usePhotoBounds("), shell.indexOf(");", shell.indexOf("usePhotoBounds(")));

describe("photo bounds are re-asked when a photo loads", () => {
  it("the key includes the ACTIVE PHOTO — a different photo is a different answer", () => {
    expect(callSite).toMatch(/\$\{activePhotoId\}/);
  });

  it("the key includes the DOCUMENT SIZE — it changes the moment an import lands", () => {
    expect(callSite).toMatch(/\$\{stamp\.state\.width\}x\$\{stamp\.state\.height\}/);
  });

  it("it still includes the pixel and layer counters — resize, undo and flatten move the bounds", () => {
    expect(callSite).toMatch(/\$\{stamp\.state\.undoCount\}/);
    expect(callSite).toMatch(/\$\{photoLayerRevision\}/);
  });

  it("is not the old numeric sum, which a fresh import never moved", () => {
    expect(callSite).not.toMatch(/stamp\.state\.undoCount \+ photoLayerRevision/);
  });

  it("the hook accepts that key", () => {
    expect(hook).toMatch(/revision: number \| string,/);
  });
});
