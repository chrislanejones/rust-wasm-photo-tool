# ADR-090: A preset is recorded as one tonal-stack op, and the op log goes to v13
Date: 2026-10-14   Status: draft   Relates to: ADR-052, ADR-055, ADR-070, ADR-088

## Context

Enhance › Presets (ADR-055) snapped "Preset" and wrote the five filters into
the layer with no op. The next Ctrl+Z found a log that disagreed with the
engine, marked it broken, and dropped undo to whole-image snapshots for the
rest of the session (about 2 steps at 24 MP, ADR-052). Measured on master
`639202bf` through the real panel: the log reads "armed — base captured, no ops
yet" after a click, and comes back from a reload with 0 ops. ADR-055 held off
because recorded undo was itself unsound. #351 and #356 (op-log v12, gesture
markers) fixed that and are live, so issue #37 can start, with presets first.

## Decision

1. **`Op::TonalStack { brightness, contrast, highlights, shadows, saturation }`**,
   five `f64`s, appended at **index 23**. Field order is `apply_stack`'s
   order: tone first, color last. `preset_apply` records it after the pixels,
   through `oplog_record`, as `levels_apply` does. An identity stack snaps
   nothing and records nothing.
2. **The units are ADR-055's, passed through untouched.** brightness −1..1,
   contrast and saturation factors, shadows and highlights absolute 8-bit.
   Replay calls the same `presets::apply_stack` on the content layer's flat
   W×H bytes. That costs one buffer copy per replayed op, on replay only and
   never on the flush path.
3. **`OP_FORMAT_VERSION` 12 → 13.** 12 has been live since #356 merged
   (master deploys on merge), so v12 frames are already on users' disks. If a
   deployed v12 build met index 23 in a frame stamped 12, it would fail with
   `OpError::Decode`, the same error a torn frame gives. A frame stamped 13
   fails as `UnsupportedVersion(13)` instead. Both reach JS as the same
   `false` from `oplog_restore` and the same working-copy fallback, so the
   data outcome is identical. The number keeps the version byte as the only
   compatibility gate, which every vocabulary change since v3 has respected.
   ADR-088's "ride v12 in the same release" assumed v12 had not shipped yet.
   It had. 10 stays ADR-070's reservation. No open branch on origin or
   codeburg claimed 13 (checked 10-14).
4. **The preview slot is unchanged.** `preset_preview_set` and
   `tonal_preview_*` record nothing and touch no history. The STOP condition
   (recording must not change the preview) never triggered.

## Consequences

The proposed reuse for Adjustments below was superseded by [ADR-091](091-adjustments-record-absolute-sessions-in-oplog-v14.md): the slider session has a different filter order and replaces absolute settings on an untouched base.

+ A preset is one Ctrl+Z on the op-log path, in-session and after a reload,
  byte-exact (`ops_engine_parity.rs`, `e2e/oplog-preset-undo.spec.ts`).
+ The five Adjustments sliders are the same five filters, so they can record
  on this variant later with no new index and no new version.
- A build older than v13 can't read any frame a v13 build writes, strokes
  included, even when no preset is in the log. Riding v12 would have kept
  preset-free logs readable to a stale v12 tab. Accepted: a reload loads the
  new build.
- Wasm 894,825 → 895,885 B (+1,060): the replay arm, the variant's serde and
  the recorder call. Not attributed per function.
- The History label is "Preset". When the sliders share the variant, they'll
  need their own label or a kind, which is a later decision.

## Alternatives rejected

1. **Append index 23 under v12.** Same data outcome for an old reader, but a
   12 stamp would no longer mean "a 12 reader can parse this", and damage
   would read the same as a newer format.
2. **Six per-slider variants (ADR-070 decision 4).** A preset is one undo
   step that sets five values. Five ops joined by `SameGesture` would replay
   the same pixels with five times the frames, and sharpen is not in a preset.

## Pre-mortem

It is six months later and this was a mistake. Most likely reason: the sliders
joined `TonalStack` with a different apply order or a scaled unit ("just
normalize shadows to 0..1"). Logs written before that change then replayed
differently, the composite-hash check broke them on the first undo after a
reload, and it looked like flakiness. Early warning sign: a diff that changes
`apply_stack` or the `TonalStack` apply arm without a new variant or a new
format number.
