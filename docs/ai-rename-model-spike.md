# AI Rename — on-device model spike

Stage 1 of the ADR-032 work. **2026-08-08.** Everything here is measured on
this machine unless marked otherwise.

The question was narrow: today AI Rename names a photo `dark-blue-portrait`,
and the ask is for it to name the photo by what is *in* it. Is there a model
small enough to ship that actually does that?

**Answer: yes — 21.8 MB, and the limiting factor turns out to be our
vocabulary, not the model.**

## What today does, and why it can't be patched

`src/describe.rs` measures hue distribution, luma mean/variance, gradient
energy and skin/foliage/sky ratios. Its own header is honest about the
boundary: it will never tell you the photo is a golden retriever. That is not
a bug to fix — no amount of better statistics turns pixel histograms into
nouns.

The header also says a caption model "does not run offline". **That claim is
now out of date**, and this spike is the evidence.

## Candidates

| Model | Size shipped | Tokyo street | Woman with daisies |
|---|---|---|---|
| MobileNetV4 (ImageNet-1k), q8 | 3.8 MB | `violin-fiddle` 51% | — |
| CLIP ViT-B/32 vision, int8 | 84.5 MB | `city-street` 86% | `flower` 53% |
| MobileCLIP-S0 vision, q8 | 11.3 MB | `mountain` 83% | `cat` 84% |
| **MobileCLIP-S0 vision, fp16** | **21.8 MB** | **`city-street` 100%** | **`portrait-of-a-person` 48%** |
| MobileCLIP-S0 vision, fp32 | 43.4 MB | `city-street` 100% | `portrait-of-a-person` 48% |

**ImageNet classifiers are ruled out structurally, not on accuracy.** The 1000
ImageNet classes are dominated by dog breeds and objects; there is no "street"
class, no "cafe", no "beach". MobileNetV4 cannot produce the word we want at
any size or quality. It is not a weak option, it is the wrong family.

**fp16 and fp32 give identical answers**, so fp16 is the ceiling worth paying
for — 21.8 MB buys everything 43.4 MB does.

## The finding that matters most: q8 fails silently

MobileCLIP-S0 quantized to q8 does not error, does not warn, and does not
return low confidence. It returns *confident garbage* — `mountain` at 83% for
a photo of a Tokyo street, `cat` at 84% for a portrait. The same model at fp16
gets both right.

An 11.3 MB model that is wrong 100% of the time looks exactly like a 21.8 MB
model that is right, until somebody checks the output against the picture.
Anyone tempted to shave the download later should read this paragraph first.

## Why it fits in 21.8 MB: the text tower never ships

CLIP-family models are two towers. Zero-shot classification normally runs both:
the vision tower embeds the image, the text tower embeds the candidate labels,
and the answer is the nearest label.

But **our label list is fixed.** So the text embeddings are computed once, at
build time, and shipped as data:

| | Size |
|---|---|
| Vision tower (fp16) | 21.8 MB |
| 33 labels × 512d as float16 | **33 KB** |
| Text tower | **0 — never downloaded** |
| Naive both-towers download | 146.6 MB |

That is the difference between a 21.8 MB feature and a 146.6 MB one.

**This was verified, not assumed.** The same split implementation was run
against CLIP ViT-B/32 as a control and reproduced `city-street` at 86%,
matching what the full two-tower pipeline produced for that model. The
vision-only path is not an approximation of the real thing; it is the real
thing with a precomputed constant.

## Quality, ground-truthed against the actual pictures

Nine real photographs. Every one was opened and looked at — the scores below
are checked against what the image shows, not against each other.

| Photo | What it is | Top label | Verdict |
|---|---|---|---|
| Tokyo street | Shin-Okubo, buildings, crossing | `city-street` 100% | correct |
| p88 | aerial road, traffic | `city-street` 98% | correct |
| p12 | rocky foreground, sea, island | `coastline` 98% | correct |
| p27 | fisherman on rocks at sunset | `coastline` 78% | correct |
| p64 | woman holding daisies | `portrait-of-a-person` 48% | correct |
| p103 | legs on grass in a **park** | `farm-field` 75% | near — no "park" label |
| p164 | **canal** in Bruges, boats | `boat` 29% | near — no "canal" label |
| p129 | couple on bench, Golden Gate | `beach` 50% | near — missed "bridge" |
| p42 | **cafe** interior, espresso | `desk-with-a-laptop` 82% | wrong — no "cafe" label |

**5 clean, 3 near, 1 wrong.** Inference is 32–112 ms per photo; the tower
loads in ~320 ms warm.

The obvious read is that every miss is a word absent from a 33-label list
written in five minutes: p103's second choice was `field-of-grass` (24%),
p164's was `river-or-lake` (25%), and p42's was `interior-of-a-room` (15%), so
the model ranked the right *kind* of thing second every time.

**That read is partly wrong, and the vocabulary section below is where it was
tested.** Three of the four misses did turn out to be missing words. p103 did
not — adding `park` left it on `farm-field`. Vocabulary is still the cheapest
lever available (a rebake is KBs and a build step, with no retraining and no
re-download for anyone who has the tower cached), but it is not a universal
explanation, and the first pass over-generalised from four examples.

## What this does not answer

- **Browser numbers.** Every measurement above is Node with
  `onnxruntime-node`. WASM and WebGPU in a real browser will differ, and the
  fp16 path in particular is worth re-measuring — fp16 support is not uniform
  across backends.
- **Cold-load cost on a slow connection.** 21.8 MB is fine on a desktop and is
  not obviously fine on mobile data. The lazy-load trigger and the caching
  story are a real design question, not a detail.
- **Where the vocabulary should stop.** 33 → 131 was measured (below) and is a
  net gain, but it is not monotonic and nobody has found the turning point.
- **The paid tier.** A Replicate caption model writes real sentences and would
  beat this on every row above. `convex/ai.ts` already has the registry to
  hang it on.

## Vocabulary: measured, 33 labels vs 131

The spike's first pass blamed every miss on a missing word. That was worth
testing rather than believing, so the same nine images were re-scored against
the same vision tower with the vocabulary widened to 131 labels — the four
words that were obviously absent (`park`, `canal`, `cafe`, `harbour`) plus a
general widening across places, people, animals, food, objects and weather.

| Photo | 33 labels | 131 labels | |
|---|---|---|---|
| p42 — cafe interior | `desk-with-a-laptop` 82% | `cafe-or-coffee-shop` 87% | fixed |
| p129 — couple, Golden Gate | `beach` 50% | `couple` 79% | fixed |
| p164 — Bruges canal | `boat` 28% | `harbour` 50% | fixed |
| p64 — woman with daisies | `portrait-of-a-person` 48% | `cherry-blossom` 73% | **broke** |
| p103 — legs in a park | `farm-field` 75% | `farm-field` 72% | unchanged |
| p12, p27, p88, Tokyo | correct | correct | held |

**5 clean → 7 clean.** Baked embeddings go 33 KB → 131 KB, which is noise
next to a 21.8 MB tower.

**The result that matters is p64, not the score.** A photo that was *right* at
48% became *wrong* at 73%. White daisies against a hazy warm background really
do look like cherry blossom, and a narrow visually-similar label outranked the
broad correct one. Confidence rose as correctness fell.

Two things follow:

- **Model confidence cannot gate quality.** The obvious design — fall back to
  `describe.rs` when the model is unsure — would not have saved p64. Any
  threshold below 73% keeps the wrong answer and discards the right one.
- **Adding labels is not monotonically good.** It is a net gain here (+3, −1),
  but "more words" is not a strategy. Each addition can steal a photo from a
  broader label that was already right, and the failure is invisible without
  ground truth.

Note also that `park` was added and p103 *still* came back `farm-field`. Not
every miss is a missing word; the model genuinely reads that dry winter grass
as a field. The first pass over-generalised from four examples.
