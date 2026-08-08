# ADR-032: AI Rename names photos with an on-device vision model, with a cloud caption model as a paid upgrade
Date: 2026-08-08   Status: accepted   Supersedes part of: ADR-028

## Context

AI Rename was reported as not doing what its name promises: it does not name
images by what is in them. That report is correct, and the feature is working
exactly as designed — which is the reason this needs a decision rather than a
fix.

ADR-028 put image description in the engine, local and offline.
`src/describe.rs` measures hue distribution, luma mean and variance, local
gradient energy, palette diversity, and skin/foliage/sky ratios, then names
from those. It produces `dark-blue-portrait` and `bright-white-screenshot`.
Its own header states the boundary plainly: it will never tell you the photo is
a golden retriever.

No amount of better statistics closes that gap. Histograms do not become nouns.
The choice is to accept the boundary or to change the kind of thing doing the
describing.

ADR-028's header also asserts that a caption model "does not run offline".
**That was true when it was written and is no longer true.** Small CLIP-family
models now run in the browser, and measuring one is what produced this ADR.

## Decision

**A vision model runs on the device for every user, including logged out. A
cloud caption model is an upgrade for paid accounts.**

Concretely:

- **`Xenova/mobileclip_s0`, vision tower only, fp16 — 21.8 MB**, lazy-loaded
  the first time a user runs AI Rename, then cached.
- **The text tower never ships.** Our label vocabulary is fixed, so label
  embeddings are computed at build time and shipped as ~131 KB of float16.
- **`src/describe.rs` stays** and remains the answer when the model has not
  loaded, cannot load, or the user has the flag off. It is not deleted, and
  ADR-028 is not withdrawn — its local-and-offline principle is preserved,
  which is the point of the on-device choice.
- **Flag `ih_ai_rename_model`, default OFF** until browser numbers exist.
- **The paid path adds a caption model to the existing `convex/ai.ts` registry**
  and produces real descriptive phrases rather than a single label.

### Why on-device is not optional

*Demo mode is sacred* is a project invariant: every feature must work logged
out. A cloud-only AI Rename would make the feature disappear for anyone without
an account, which is the majority of the app's use. That single-handedly rules
out the cheapest and highest-quality option as a *replacement*, and is why it
appears here only as an upgrade.

### Why this model and this precision

Measured on nine ground-truthed photographs (`docs/ai-rename-model-spike.md`):

| Model | Shipped size | Verdict |
|---|---|---|
| MobileNetV4, ImageNet-1k | 3.8 MB | wrong family — see below |
| MobileCLIP-S0 vision, q8 | 11.3 MB | **confident garbage** |
| **MobileCLIP-S0 vision, fp16** | **21.8 MB** | **chosen** |
| MobileCLIP-S0 vision, fp32 | 43.4 MB | identical output to fp16 |
| CLIP ViT-B/32 vision, int8 | 84.5 MB | correct, 4× the size, no better |

**ImageNet classifiers are excluded structurally, not on accuracy.** The 1000
ImageNet classes are dominated by dog breeds and objects and contain no
"street", "cafe" or "beach". MobileNetV4 called a photo of a Tokyo street
`violin-fiddle`. It cannot produce the wanted word at any size.

**q8 is excluded because it fails silently.** It does not error or return low
confidence; it returns confident nonsense — `mountain` at 83% for that same
Tokyo street, `cat` at 84% for a portrait. An 11.3 MB model that is always
wrong is indistinguishable from a working one through the API. This is recorded
here because "shave 11 MB off the download" is exactly the change somebody
proposes later.

fp32 buys nothing over fp16, so 21.8 MB is the ceiling worth paying.

## Consequences

### What gets better

Seven of nine test photographs get a name a person could search for —
`city-street`, `coastline`, `cafe-or-coffee-shop`, `couple` — against zero of
nine today. Inference is 32–112 ms per photo, so a forty-photo batch stays
interactive.

### What gets worse, and what we are accepting

- **A 21.8 MB download.** Fine on a desktop, not obviously fine on mobile data.
  The lazy-load trigger and cache story are real design work, not a detail.
- **A new runtime dependency** (`@huggingface/transformers` + an ONNX runtime)
  in an app whose engine work has been deliberately dependency-light.
- **Wrong answers are now confident and specific.** `dark-blue-portrait` is
  vague but never absurd. `cherry-blossom` for a woman holding daisies is
  absurd, and a user will notice it in a way they never noticed a dull name.
  This is the real cost, and it is worth taking because a searchable name that
  is sometimes wrong beats an unsearchable one that is always right.

### The constraint that shapes the implementation

**Model confidence cannot be used as a quality gate.** The obvious design —
fall back to `describe.rs` when the model is unsure — was tested and does not
work. Widening the vocabulary from 33 to 131 labels turned one photo from
*right at 48%* into *wrong at 73%*. Confidence rose as correctness fell, so any
threshold below 73% would have kept the wrong answer and discarded the right
one.

The fallback therefore has to be user-facing, not statistical: the name is a
suggestion the user can see and reject before it is applied, which is already
how the panel works.

**Vocabulary is the cheapest lever but not a universal one.** Widening it was a
net gain (+3 fixed, −1 broken), and a rebake costs KBs with no retraining and
no re-download. But `park` was added and the park photo still came back
`farm-field`. "More words" is not a strategy, and every addition can steal a
photo from a broader label that was already right — invisibly, without ground
truth to check against.

## Stages

| # | Stage | Ships | Reversible by |
|---|---|---|---|
| **1** | **Model spike.** ✅ **DONE 2026-08-08** — `docs/ai-rename-model-spike.md`. Nine ground-truthed photos, five candidates, the q8 trap and the vocabulary curve | nothing, a document | n/a |
| **2** | **This ADR** | docs | n/a |
| 3 | Baked-vocabulary build step + the label list as reviewable source | a JSON artefact, unused | delete the artefact |
| 4 | On-device path behind `ih_ai_rename_model`, default OFF. `describe.rs` still the live answer | nothing user-visible | flag stays off |
| 5 | Browser measurement — load time, inference, fp16 backend support, mobile cold start | a document | n/a |
| 6 | Flip the flag if stage 5 justifies it, `ih_ai_rename_model=0` as the kill switch | the feature | kill switch |
| 7 | Paid caption model via `convex/ai.ts` | the paid upgrade | registry entry removed |

Stage 5 is a gate, not a formality. Every number in the spike is Node with
`onnxruntime-node`; fp16 support is not uniform across browser backends, and
the chosen precision is the one thing that separates this model from the q8
version that returns garbage. If fp16 silently degrades in a browser the way
q8 did on the desktop, the failure looks like working software.

## What is deliberately not decided here

- **The final vocabulary.** 131 labels is measured, not settled, and the
  turning point where more labels start costing more than they buy has not
  been found.
- **Whether the paid model replaces or supplements the on-device one** for paid
  users. Running both and preferring the cloud result when it arrives is
  plausible and unmeasured.
- **Whether the model gets reused elsewhere.** Once a CLIP tower is on the
  device, search-by-description and duplicate detection become cheap. That is a
  reason to keep the embedding accessible, not a commitment to build either.

## Pre-mortem — it is six months later and this went badly

- The 21.8 MB download landed on mobile users on cellular data and the feature
  got a reputation before anyone measured the cold start. **Stage 5 exists for
  this.**
- Somebody quantized the model to save 11 MB, output quality collapsed, and
  nobody noticed for weeks because there is no test that compares a name to a
  picture. **The q8 finding is recorded above and in the spike doc for exactly
  this reader.**
- The vocabulary grew by accretion — every "it should also know about X" added
  a label, each one silently stealing photos from broader labels — and quality
  drifted down while the list got longer. **No ground-truth set means no way to
  see it happen.**
- `describe.rs` was deleted as dead code once the model shipped, and the
  offline fallback went with it.
