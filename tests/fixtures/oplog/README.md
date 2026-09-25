# Op-log fixtures — real v7 and v8 bytes, captured before v9 renumbers them

Every file here is **bytes a browser actually wrote to IndexedDB**, not bytes a
test typed. They exist to answer one question that nothing in this repo asked
before: *after a change to the op-log format, does a file written by the
PREVIOUS format still read?*

That question is not academic. `OP_FORMAT_VERSION` has collided twice on
parallel branches (v6 and v8), and the v8 step shipped with the encode side
reviewed and the decode side merged quietly. PR #187 renumbers v8 → v9; these
are its oracle.

Captured 2026-09-20, before the renumber.

## What each file is

| File | Format version (verified in the bytes) | Session it came from |
|---|---|---|
| `v8-text-font-wrap-shape.frames.bin` | **8** | text in Liberation Serif, its box dragged narrower, then a 50%-sloppy rectangle |
| `v8-text-font-shape.frames.bin` | **8** | text in Liberation Serif + one rectangle |
| `v8-shape-sloppiness.frames.bin` | **8** | one rectangle re-rendered at 50% sloppiness |
| `v7-text-wrap-shape.frames.bin` | **7** | same script as the v8 capture, on a build that predates the font selector |
| `base-annotations.v8.bin` | **8** (23 B) | the base keyframe's annotation blob, `[8] ++ postcard((texts, shapes, canvas, …))` |
| `base-annotations.v7.bin` | **7** (22 B) | its v7 twin — one byte shorter, which is the ninth tuple element (per-text `font_id`) that v8 appended |
| `base-keyframe-276x276.png` | — | the base keyframe pixels at op 0. Byte-identical across all four captures, so one copy serves them all |
| `v8-archive-edit-record.json` | — | the OTHER persisted copy of the same document (the `image-horse-edits` archive), pixels replaced by byte counts |
| `v8-engine-text-annotations.json` | — | `get_text_annotations()` straight out of the engine, for comparison with the archive record above |

Each `*.frames.bin` has a `*.json` sidecar naming the serving commit, the op
sequence, the chunk boundaries the Dexie writer used, the cursor, and sha256s.

## Provenance

| Capture | Where it came from |
|---|---|
| v8 (three of them) | `https://edit.imagehorse.app`, logged out, shipped defaults, serving commit `34dd0d9` (wasm 814,202 B) |
| v7 | a local production build of `6a3de6be`, the commit before #131, served on its own port (wasm 858,087 B) |

Both were driven through the real UI — import `e2e/fixtures/checker.png`, add
text, drag the box, draw shapes — and then the raw rows were read back out of
IndexedDB. Nothing was hand-assembled.

## Framing

```
frames.bin  :=  ( [u32 LE frame length] [format-version u8] postcard(Op) ) *
annotations :=  [format-version u8] postcard( (texts, shapes, canvas, …) )
```

`oplog_restore(basePng | baseRgba, baseAnnotations, frames, cursor)` is the
entry point these feed. The cursor for each capture is in its sidecar.

## Two things to know before you trust a version number

**1. The version byte is in the FRAME, and nowhere else.** Do not read the
filename, and do not read the Dexie record either:

```
oplogManifests.formatVersion = 1      ← not the op format version
opLogs[].formatVersion       = 1      ← not the op format version
frame bytes                  = 8      ← the op format version
```

`lib/dexie/db.ts` documents that field as "Engine op-encoding version
(`OP_FORMAT_VERSION` at write time)". It is not, and never has been:
`lib/oplogPersistence.ts` writes the literal `1` at both sites and the restore
path rejects anything that is not `1`. The `1` is a container version. Every
capture here — v7 and v8 alike — carries `formatVersion: 1` in its manifest.

The practical consequence for the v9 work: **"fixing" the JS to write the real
`OP_FORMAT_VERSION` there would make every log already on a user's disk fail
the `!== 1` check and be discarded.** Version discrimination happens inside the
engine (`decode_op` accepts `2..=OP_FORMAT_VERSION`), not in the JS.

**2. Verify, don't assume.** Confirming a fixture's version is three lines:

```js
const b = readFileSync("v8-text-font-wrap-shape.frames.bin");
const len = b.readUInt32LE(0);      // first frame length
console.log(b[4]);                  // → 8, the version byte
```

This is how the first v7 capture attempt was caught: the preview server lost a
port race, the capture ran against somebody else's v8 build, and the bytes said
`8` while the folder said v7.

## What is deliberately NOT here

No test consumes these yet. They are data. The natural first consumer is a
`tests/oplog_v8_fixture_resume.rs` in the shape of the existing
`tests/oplog_v3_resume.rs` — feed `frames.bin` + `base-annotations.v8.bin` +
the keyframe PNG to the real `oplog_restore` and assert the document comes
back — which is the check that would have caught the v8 collision. Writing it
belongs to the v9 session, against the renumbered code.
