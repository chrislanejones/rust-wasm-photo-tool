# Op-log fixtures + the text-settings bug — 2026-09-19/20 overnight

Branch `test/oplog-v8-fixtures`, worktree `~/ai-repo/oplog-fixtures`.
Two jobs: capture v7/v8 op-log bytes while v8 is still what ships, and
reproduce + diagnose (not fix) "text edits lose settings after a reload".

**No op-log or save-format code was changed. Not one line.** What is in the
diff: fixtures, two test files, one Cargo.toml test registration, this file.

---

## 1. Fixtures captured

| Fixture | Version **in the bytes** | Ops | Captured from |
|---|---|---|---|
| `v8-text-font-wrap-shape.frames.bin` | **8** | TextAdd, TextFont, TextWrap, TextEdit, ShapeAdd, ShapeSloppiness | edit.imagehorse.app (commit 34dd0d9) |
| `v8-text-font-shape.frames.bin` | **8** | TextAdd, TextFont, ShapeAdd | edit.imagehorse.app |
| `v8-shape-sloppiness.frames.bin` | **8** | ShapeAdd, ShapeSloppiness | edit.imagehorse.app |
| `v7-text-wrap-shape.frames.bin` | **7** | TextAdd, TextWrap, TextEdit, ShapeAdd, ShapeSloppiness | local prod build of `6a3de6be`, the commit before #131 |
| `base-annotations.v8.bin` | **8** | base keyframe annotation blob, 23 B | edit.imagehorse.app |
| `base-annotations.v7.bin` | **7** | its v7 twin, 22 B | local `6a3de6be` build |
| `base-keyframe-276x276.png` | — | base pixels at op 0, byte-identical across all four captures | both |
| `v8-archive-edit-record.json` | — | the OTHER persisted copy (the `image-horse-edits` archive) of the same session | edit.imagehorse.app |
| `v8-engine-text-annotations.json` | — | `get_text_annotations()` straight out of the engine | cargo, same commit |

All of it lives in `tests/fixtures/oplog/`, with a per-fixture JSON sidecar
(serving commit, op list, chunk boundaries, cursor, sha256) and a README.
`tests/fixtures/oplog/capture-harness.mjs` is the script that produced them.

**Both fixtures were proven replayable**, not just well-formed: fed through the
real `oplog_restore_png` entry point, the v8 log and the v7 log both restore
under today's engine.

### Version verified in the bytes, never from the filename

| Where | v7 capture | v8 capture |
|---|---|---|
| frame header byte | **7** | **8** |
| annotation blob byte 0 | **7** | **8** |
| `oplogManifests.formatVersion` (Dexie) | 1 | 1 |
| `opLogs[].formatVersion` (Dexie) | 1 | 1 |
| wasm size of the serving build | 858,087 B | 814,202 B |

### ⚠️ Landmine for the v9 work: the Dexie `formatVersion` is not the op format version

`lib/dexie/db.ts` documents that field as *"Engine op-encoding version
(`OP_FORMAT_VERSION` at write time)"*. It is not. `lib/oplogPersistence.ts`
writes the literal `1` at both sites (lines 530 and 588) and the restore path
rejects anything that is not `1` (lines 685 and 691). Every log on every user's
disk — v7, v8, all of them — says `formatVersion: 1`.

**Making that field honest would discard every existing log.** Version
discrimination happens inside the engine (`decode_op` accepts
`2..=OP_FORMAT_VERSION`); the JS number is a container version. The comment is
what is wrong, not the code — but "fix the comment" is a save-format-adjacent
decision, so it is left for the attended session.

### The trap that nearly shipped a mislabeled fixture

The first v7 capture produced **v8** bytes. `vite preview --strictPort` lost
port 4907 to another process, exited, and the capture drove that server
instead. The run looked perfect. What caught it was reading the version byte
out of the frames — the exact discipline this task asked for. Bind-test the
port, then check the bytes.

---

## 2. The text bug: reproduced on production, with defaults

**Steps** (logged out, shipped defaults, `edit.imagehorse.app`, commit 34dd0d9):

1. Import an image.
2. Create → Text, pick **Liberation Serif**, click the canvas, type
   `wrap me across several lines please`.
3. Drag the right-hand box handle ~120 px left — the words reflow onto two
   lines.
4. Press **Enter** to commit. Wait for the save.
5. Reload. Click **Resume editing**.

**Result:** the text returns in **Liberation Sans**, on **one unwrapped line**
running off the canvas. Still wrong 17 s later, so it is not a slow re-render.

| Run | Arm | Op log on disk before reload | Canvas identical after resume? |
|---|---|---|---|
| A | defaults, box dragged | **none written at all** | no — font and wrap both lost |
| A2 | same + another edit after the text | none written | no |
| NODRAG | defaults, **no** box drag | TextAdd + TextFont persisted | no — **font still lost** |

---

## 3. Diagnosis — three separate losses, in three separate places

### (a) The op log replays the settings away. `Op::TextEdit` is the eraser.

Isolated by replaying the **captured production log** one op at a time through
`oplog_restore_png`:

| cursor | ops applied | `font_id` | `wrap_width` |
|---|---|---|---|
| 1 | TextAdd | `""` | 0 |
| 2 | + TextFont | `"liberation-serif"` | 0 |
| 3 | + TextWrap | `"liberation-serif"` | **299** |
| 4 | + **TextEdit** | **`""`** | **0** |
| 6 | + ShapeAdd, ShapeSloppiness | `""` | 0 |

`Op::TextEdit` carries a whole `TextParams` and applying it **replaces** the
annotation. `font_id` is `#[serde(skip)]` on `TextParams` (that is what kept
the v2 wire layout byte-identical when v8 added the face), so it decodes as
`""`; `wrap_width` / `box_height` come back as whatever the writer held. Every
`TextFont` / `TextWrap` before it is undone.

The shape twin survives the same replay (`sloppiness: 50`), which is the
control: shapes re-emit their setting as its own op and nothing replaces them.

Pinned by `tests/oplog_v8_text_settings_replay.rs` — 4 green controls,
**2 red**.

### (b) The archive path never carried the box at all

`stripLiveAnnotations` (`app/src/lib/editPersistence.ts:392`) is an explicit
allowlist. The engine emits `wrap_width`, `box_height` and `perspective` for
every text (`src/annotations.rs:372`); none of the three is on the list, so
none has ever reached disk. Confirmed against a live production record:

| Field | Text annotation (archive) | Shape annotation (archive) |
|---|---|---|
| the setting added most recently | `font_id` present | `sloppiness` present |
| box width | `wrap_width` ABSENT | — |
| box height | `box_height` ABSENT | — |
| perspective quad | ABSENT | `perspective` present |

`restoreLayerStack` (`app/src/lib/restoreLayerStack.ts:68`) has no parameter
for them either, so even a carrying save would not come back today.

Pinned by `app/src/lib/textBoxSurvivesReload.test.ts` — 6 green
(3 controls + 3 fixture checks), **4 red**.

### (c) The guard that exists for exactly this is blind

`editPersistence.stripDrift.test.ts` asks the right question — *"does the
stripper carry every field the engine emits except `tile_*`?"* — and then
builds its input from `Required<PersistedAnnotation>`, the app's **own**
allowlist type. A field the engine emits and the type never declared cannot
appear in the input, so the guard cannot see the fields being dropped. It is
the #22 `shadow_*` drift a second time, one level up: two sources of truth, and
the test written against the wrong one.

That is why the new test feeds it **captured engine output** instead.

### (d) Observation, not a diagnosis: dragging the box takes op-log persistence down

In every run where the box was dragged before the first save, **nothing** was
written to `opLogs` / `oplogManifests` for the whole session — no manifest row
at all. The identical run without the drag persisted `TextAdd + TextFont`
within the debounce. One variable changed, contrast measured, mechanism **not**
isolated. Reported as an observation. It matters because it decides which of
(a) and (b) bites the user: with no log, the reload lands on the archive path,
which is the one that never carried the box.

---

## 4. STOP: the fix needs a format decision

The hard stop condition was hit, and it was hit twice over:

| Repair | What it changes | Verdict |
|---|---|---|
| Make `TextEdit` carry `font_id` / `wrap_width` / `box_height` | the op payload — a **format** change, on top of the pending v8→v9 renumber | ADR + attended session |
| Make the apply path MERGE instead of replace | op-log **semantics**: the same bytes mean something different, and old logs replay differently | ADR + attended session |
| Re-emit `TextFont` / `TextWrap` after every edit | no format change, but it changes what a log contains and interacts with the collision that stopped #187 | attended |
| Add `wrap_width` / `box_height` to the archive allowlist + restore | the persisted **archive record** gains fields (optional, like `font_id` — no Dexie version bump per `db.ts`) — still a save-format change | ADR + attended session |

The cheapest-looking repair (the archive allowlist) does **not** fix the bug on
its own: with a healthy op log the replay still erases the face. Both halves
have to be decided together, which is exactly the kind of call that belongs to
a person who is awake.

**Nothing was patched. The attended session gets a red test on both sides and
an isolated cause.**

---

## 5. Consequences of leaving red tests (please read before the next run)

- `pnpm -C app test` -> **77 files pass, 1 fails** (mine): 898 passed, 4 failed.
- `cargo test --features tiles` -> every other target green; mine is 4 pass /
  2 fail. Cargo **stops at the first failing target**, so the targets after
  `oplog_v8_text_settings_replay` alphabetically do not run without
  `--no-fail-fast`. With that flag the rest of the suite is green.
- `pnpm -C app exec tsc --noEmit` -> clean. `pnpm lint` -> 0 errors, 57 warnings
  (the pre-existing backlog). `cargo fmt --check` -> clean.
  `cargo clippy --all-targets` (no features, what the push hook runs) -> clean.
  `./scripts/guardrails.sh` -> **OK**, and it reports two counts that came down
  on master and could be ratcheted (`rust-panics` 46 < 47, `librs-lines`
  4732 < 4808) — not mine to lock in.

## 6. What the next session should pick up

1. Decide (a) and (b) together, with an ADR, on top of whatever #187 does to
   the version number.
2. Fix the `db.ts` comment about `formatVersion`, or make the field honest and
   migrate — but not both accidentally.
3. Turn `editPersistence.stripDrift.test.ts`'s input into engine-captured JSON
   so the guard can see the next dropped field.
4. Consider a permanent `oplog_v8_fixture_resume` (green) alongside the red
   one: the fixtures are ready and proven replayable, and a v8-still-reads test
   is what would have caught the v8 collision.
5. Chase (d): why does a box drag stop the op log from ever being persisted?
