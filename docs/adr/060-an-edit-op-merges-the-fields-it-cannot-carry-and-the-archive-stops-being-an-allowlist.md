# ADR-060: An edit op merges the fields it cannot carry, and the archive stops being an allowlist
Date: 2026-09-20   Status: draft

## Context

A committed text annotation lost its typeface and its dragged box on
reload. Measured on production (commit `34dd0d9`, v8.80): Liberation Mono
came back 137 px → 117 px of ink, proportional; Liberation Serif 94 px →
103 px, serifs gone. Two independent losses, both only visible after a
reload.

**(a) The op log replays the settings away.** `TextParams::wrap_width`,
`box_height`, `perspective` and `font_id` are `#[serde(skip)]` — they have
to be, or every `TextAdd`/`TextEdit` payload on a user's disk mis-decodes —
so an encoded `Op::TextEdit` *physically cannot carry them*. Applying it
REPLACED the annotation, which honored the decode defaults as if the user
had chosen them. Replaying a captured production log one op at a time:
cursor 2 → `font_id="liberation-serif"`, cursor 3 → `wrap_width=299`,
cursor 4 (`TextEdit`) → `""` and `0`. `Op::ShapeEdit` has the identical
defect for `sloppiness` and its quad.

**(b) The archive never carried the box at all.** `stripLiveAnnotations`
was an allowlist. `annotations_to_json` has emitted `wrap_width` since
v8.40, `box_height` since v8.41, `perspective` since v8.42, and not one of
the three has ever reached IndexedDB — verified against a live production
record. `restore_text_annotation` hard-coded `0, 0, identity` and said so
in three comments (ADR-024-F7), on the premise that the op-log path is "the
one the resume actually uses". In every measured run where the user dragged
the box before the first save, **no op log was persisted at all** and the
resume landed on exactly this path.

## Decision

**Merge, not replace.** `Op::TextEdit` and `Op::ShapeEdit` now carry their
target's `#[serde(skip)]` fields forward (`carry_skipped_from`). The
payload's copies are absent, not chosen, so they are ignored. Resets stay
representable: `annotation_sync_ops` already emits `TextFont { font_id: "" }`
and `TextWrap { wrap_width: 0 }` whenever the live value differs from the
log's, including when it differs *down to the default*.

**No format version was taken. `OP_FORMAT_VERSION` stays 8, so #187 keeps
v9.** A bump is for a change in what the bytes ARE; the wire layout is
untouched. Taking a number would have made every shipped build reject the
new logs (`decode_op` accepts `2..=OP_FORMAT_VERSION`) to fix a bug that
needs no new bytes.

**The archive stops being an allowlist.** `stripLiveAnnotations` keeps
everything the engine emitted minus `tile_*`, `parseSnapshotAnnotations`
*is* that function, and `restore_text_annotation` gained `wrap_width`,
`box_height` and a flat 8-float quad. `PersistedAnnotation` gains three
optional, unindexed fields — no Dexie `.version()` bump, the same
reasoning `font_id` and the nine `shadow_*` already carry.

## Consequences

+ Every v7 and v8 log on a user's disk replays *better* than it did, with
  no migration step, no rewrite and no version gate. Measured on the v7
  fixture: `wrap_width` 0 → 338, tile 359 px single-line → 289 px wrapped.
+ A field the engine grows now reaches disk automatically. The class of bug
  that cost nine `shadow_*` fields (#22) and then three box axes for four
  versions no longer has a place to happen on the save side.
+ The drift guard reads the engine's captured JSON instead of the app's own
  type, and a Rust test fails first if that fixture goes stale.

- **v8 bytes now replay differently than they did under v8.80.** That is the
  repair, not a side effect, but it is a real semantic change to a persisted
  format and it is invisible in a diff of the bytes.
- A denylist persists whatever the engine emits, including a field nobody
  decided should be stored. Bounded (`annotations_to_json` writes a fixed
  struct) and accepted against four versions of measured silent loss.
- `restore_text_annotation` is now a 30-argument wasm export. It was already
  27; this makes an ugly signature uglier rather than fixing it.
- Engine +182 B (814,202 → 814,384).

## Alternatives rejected

- **Make `TextEdit` carry the four fields.** Genuinely new bytes, so a
  version bump — colliding with #187's pending v9 — and it would fix
  nothing already written. Merge fixes the logs that exist.
- **Re-emit `TextFont`/`TextWrap` after every edit.** No format change, but
  it grows every log, still loses the settings on every log already
  written, and leaves `ShapeEdit` broken.
- **Make `oplogManifests.formatVersion` honest.** It is documented as
  "`OP_FORMAT_VERSION` at write time" and has always been the literal `1`,
  with restore rejecting anything else. Writing 8 there would make the
  restore path discard every log on every user's disk. The comment was
  wrong; the code is coherent. Comment fixed, field untouched.

## Pre-mortem

It is six months later and this decision was a mistake. Most likely reason:
"absent means unchanged" is a rule that lives in one function and is
enforced by nothing. The next `#[serde(skip)]` field gets added to
`TextParams` for the usual good reason, its author reads the field comments
(which explain the wire layout) and not `carry_skipped_from`, and the field
is quietly not carried — so the fifth axis is lost on edit exactly the way
the first four were, and again only after a reload. The denylist makes the
save side self-healing and gives false confidence that the whole path is;
the op-apply side is still a list somebody has to remember to extend.

Early warning sign to watch for: a new `#[serde(skip)]` field on
`TextParams` or `ShapeParams` in a diff that does not also touch
`carry_skipped_from`. A second one: an `Op::*Edit` variant added for a new
annotation kind whose apply arm reads `*t = p.clone()`.
