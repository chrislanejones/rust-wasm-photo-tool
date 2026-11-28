// Writes the archive fixtures in this folder. Skipped unless asked for:
//
//   MAKE_ARCHIVE_FIXTURES=1 npx vitest run src/lib/__fixtures__/archive/makeFixtures.test.ts
//
// ⚠️ The v6 fixtures must come from a v6 ENCODER, so they were made on master
// `6440463` (v9.83), before ADR-112 touched `editArchive.ts`. Regenerating them
// with today's encoder would write v7 and turn the guard into a tautology. To
// remake them: check out `app/src/lib/editArchive.ts` from `6440463` first, run
// the command above, then restore the file. See README.md here.
import { test } from "vitest";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { encodeArchive, decodeArchive } from "../../editArchive";
import { archiveScenes } from "./scenes";

const HERE = __dirname;

test.skipIf(!process.env.MAKE_ARCHIVE_FIXTURES)("write archive fixtures", () => {
  for (const [name, s] of Object.entries(archiveScenes)) {
    const bytes = encodeArchive(
      s.canvasW, s.canvasH, s.canvasPng, s.undoStack, s.redoStack,
      JSON.stringify(s.annotations), JSON.stringify(s.shapes), s.layers, s.activeLayerId, s.exportQuality,
    );
    writeFileSync(join(HERE, `${name}.bin`), bytes);
    // What the encoder's OWN decoder read back, so the guard compares the new
    // reader with the old reader, not with the scene's intent.
    const back = decodeArchive(bytes);
    writeFileSync(
      join(HERE, `${name}.expected.json`),
      JSON.stringify(back, (_k, v) => (v instanceof Uint8Array ? { u8: Array.from(v) } : v), 1) + "\n",
    );
  }
});
