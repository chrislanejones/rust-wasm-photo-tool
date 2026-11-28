# Archive fixtures (ADR-112)

`v6-*.bin` are cloud archives written by **master's** encoder, `6440463` (v9.83,
`app/src/lib/editArchive.ts` sha256 `b8867912292a8de6…`), before ADR-112
changed it. `*.expected.json` is what that build's own `decodeArchive` read back
from each one (`{"u8": [...]}` is a `Uint8Array`).

`editArchive.fixtures.test.ts` checks that today's reader returns exactly that.
It is a guard: it could not be red when it was written (the reader only grows),
and it exists so a later change to the reader that misreads an old archive is.

To remake them, which should not be needed:

1. `git show 6440463:app/src/lib/editArchive.ts > app/src/lib/editArchive.ts`
2. `cd app && MAKE_ARCHIVE_FIXTURES=1 npx vitest run src/lib/__fixtures__/archive/makeFixtures.test.ts`
3. `git checkout app/src/lib/editArchive.ts`

The documents are in `scenes.ts`. Its PNG bytes are stand-ins: the archive
carries PNGs and never decodes them.
