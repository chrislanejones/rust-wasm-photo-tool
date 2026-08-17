# ADR-033 — The text box has a height, and the op log goes to v4

**Status: Accepted** 2026-08-14 (v8.41). Extends ADR-006 (op log) and the
v8.40 reflow work. Supersedes nothing.

## Context

v8.40 gave the text box a real WIDTH: six handles, `TextAnnotation::wrap_width`,
`Op::TextWrap`, op-log format v3, and text that reflows as the box is dragged.
Its handles were width-only, and the code said why:

> Six because six is what can mean anything here — 4 corners + E + W all set a
> width; N/S would set a height the layout derives from the wrapped line count,
> so they would be handles that do nothing.

Chris, 2026-08-14: *"the text bounding box should allow up and down expand on 6
pocket corners (6 pockets like a pool table, it's just how I think of it) not
just left and right."*

The v8.40 argument is half right. Height genuinely cannot drive reflow — the
line count is an *output* of wrapping, so there is nothing for a height to
decide there. But that only rules out height-as-reflow. It does not rule out
height-as-layout, which is what a taller speech bubble with room around its
text actually is.

## Decision

**Give the annotation a second box dimension, `box_height`, that acts as a
MINIMUM box height with the text TOP-ALIGNED inside it, and carry it through
persistence the same way `wrap_width` is carried — as an appended op and an
appended tuple element, migrating v2/v3 logs rather than rejecting them.**

Three parts, each chosen against a specific alternative.

**1. The height is a minimum, not a size.** A box shorter than its own text has
no effect; the text sets the real floor. So `box_height == 0` — every
annotation written before v8.41 — means exactly what it meant before, and a
drag that undershoots cannot crop words away.

**2. The text is top-aligned, not centred.** Centring reads better in a bubble
and was the first implementation. It was reversed before it shipped, because
the handles are the feature and centring breaks them: with the text pinned to
the middle, dragging the top edge up by N lifts that edge by N/2 unless the
anchor is also walked, and the type slides under the cursor while you resize.
Top-aligned, the text is glued to the box's top-left exactly the way
`wrap_width` already glues it to the left — every handle moves its own edge
1:1, the opposite edge stays, and the vertical axis behaves identically to the
horizontal one that already shipped. Consistency with the axis that already
worked beat prettier default centring.

It also keeps the anchor mapping honest for free. Centring moves every glyph
down, so `annotation_ink_offset` would have needed the height, and the overlay
would have needed a matching JS estimate of the text's natural height to cancel
it — two numbers computed by two different rasterisers, differing by about
`0.1 · font_size`, drifting the commit anchor by a few px per resize. Top
alignment deletes that whole mechanism: the box's top IS the text's top, so the
ink offset takes no height and there is no second estimate to disagree.

**3. Op-log format v3 → v4, migrated not rejected**, built to v8.40's recipe
clause for clause because the recipe is what makes the step survivable:
`box_height` is `#[serde(skip)]` on `TextParams` so the struct's wire layout is
still byte-identical to v2's; the height rides in an APPENDED variant
(`Op::TextBoxHeight`, after `TextWrap`, so no existing variant is renumbered);
and `encode_annotations` gains a FIFTH tuple element, keeping v4 blobs a strict
prefix-extension of v3's, which are one of v2's. `decode_annotations` tries 5,
then 4, then 3 elements.

**Which handle moves which axis:** the four corners move both, one axis per
pointer direction; W and E — the side pockets — stay width-only. There is no
height-only handle, and that is the honest cost of six. Adding N/S would make
eight.

## Consequences

- **No Dexie `.version()` bump and no upgrade function.** The schema's key
  paths and indexes are untouched; what changed is the content of two opaque
  byte fields (`KeyframeRecord.annotations`, `OpLogChunkRecord.bytes`). Dexie
  versions key paths, not value shape — same precedent ADR-031 used, and the
  same one `dexie/db.ts:93-96` records for `stale` on `oplogManifests`.
- **wasm 785,803 → 790,275 B (+4,472, +0.57%)** — the new op variant, the
  setter, the fifth tuple element, and `text::grow_to_box_height`.
- The tile grows to the box: measured in the browser at 365 px box → 365 px
  tile with no background, and 381 px with `bg_padding` 8 (= 365 + 2×8). The
  background/bubble follows the box for free, because the growth happens to the
  rendered block BEFORE anything downstream reads its dimensions.
- `set_text_box_height` is a new engine export and a new awaited call site
  (the async-migration gate's cumulative count 114 → 115; its three real
  numbers — 5 exempt, 0 unawaited, 0 truthy — are unchanged).
- ⚠️ **The pair `set_text_wrap_width` / `set_text_box_height` must stay
  adjacent everywhere they appear** — the commit path, the recorder, the store's
  reset. They are one box, and the failure mode is one axis being handled and
  the other quietly forgotten. The recorder is the sharp one: `TextParams`
  derives `PartialEq` over the real fields whether or not they are
  `#[serde(skip)]`, so a box-only change that is not excluded from the
  "did anything else change" diff emits a redundant `TextEdit` that cannot
  carry it.

## Alternatives rejected

- **Overlay-only height** (the dashed box grows, the commit ignores it).
  Rejected as a lie: it is precisely the "handle that promises a behaviour the
  model cannot express" the v8.40 comment refused to ship.
- **Centred text.** See Decision 2 — reversed mid-implementation, before it
  shipped, on the handle feel.
- **Eight handles** (adding N/S for height-only). Six is what was asked for and
  six is how Chris pictures the box.
- **A `box_height` field on `TextParams`'s wire format.** Would shift every
  byte after it in `TextAdd`/`TextEdit` payloads already in users' IndexedDB.
  This is the same reason `wrap_width` is skipped, restated.

## Pre-mortem

*How this goes wrong:*

**The version guard was the live one, and it nearly went wrong here.**
`decode_op` read `ver != OP_FORMAT_VERSION && ver != 2` — a correct way to say
"2 and the current version" that stopped being correct the moment 4 became
current, because v3 quietly left the accepted set. Every v3 op frame in every
user's IndexedDB would have come back `UnsupportedVersion(3)`, the log would
have reported "nothing persisted", and the archive path would have carried the
resume with a shorter history — silently, on the first load after the update,
with `ih_oplog_persist` shipping ON. It was caught by
`v3_op_bytes_still_decode_under_v4`, written *because* the recipe said the step
should migrate. The guard is now the range `2..=OP_FORMAT_VERSION`, which
extends itself; the enumerated list was a thing somebody had to remember.
**A future step that is NOT append-only must narrow that range deliberately
rather than inherit it.**

**The thing to watch:** if the layout ever goes centred, three places become
wrong at once and none of them fails loudly — `annotation_ink_offset` (needs
the height), `textInkOffsetBgAwaited`'s cache key (needs the height, or every
re-edit of a resized box serves a stale offset and the text walks up the canvas
a little further each time), and the overlay's textarea padding. The comments
at all three name each other.

**Known limitation, pre-existing and NOT introduced here:** a dragged box does
not survive a page reload — `wrap_width` and `box_height` both come back 0.
Confirmed by control build: master (v8.40 code, untouched) loses `wrap_width`
340 → 0 across the same reload. The engine and the codec carry both correctly
(`tests/oplog_v3_resume.rs` drives the real `oplog_restore` and gets them
back); the loss is above the engine, in which resume path runs. Filed in
PARKING_LOT.md.
