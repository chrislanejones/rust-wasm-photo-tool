# ADR-051: Fonts are an engine feature, and the selector shipped today is cosmetic
Date: 2026-09-08   Status: draft

Covers "other fonts aren't being added", the Fonts settings section, the premium
Google-font picker, and "add a font format file". They are one feature, and the
first finding decides the shape of all of it.

## Context — who renders text

The engine does, and it is not close. `src/text.rs` rasterises with `ab_glyph`
and says so: *"The browser is no longer involved in font rasterisation —
everything runs inside the WASM binary."* Two faces are compiled in with
`include_bytes!`:

| Embedded font | Bytes |
|---|---|
| `LiberationSans-Regular.ttf` | 61,972 |
| `LiberationSans-Bold.ttf` | 61,520 |

The public entry point takes no font:

```rust
pub fn render_text(text: &str, font_size: f32, r: u8, g: u8, b: u8, bold: bool)
```

`bold` picks between those two. **A grep for `font_family` / `font_name` across
`src/*.rs` returns nothing** — no font selection crosses the wasm boundary at
all, and `add_text_annotation`'s eighteen parameters do not include one.

## Why "other fonts aren't being added"

Because the feature does not exist. `TextSettings.tsx` offers twelve families
and the choice never reaches the renderer. Three surfaces disagree:

| Surface | Font actually used |
|---|---|
| Box measurement (`mctx`, `CanvasArea.tsx:2274`) | **Liberation Sans**, hardcoded |
| Textarea glyphs (CSS, `CanvasArea.tsx:2742`) | **the selected font** |
| Committed pixels (`render_text`) | **Liberation Sans** — no parameter exists |

Two of three agree; the textarea is the odd one out. So while typing in
Monospace you see Courier glyphs inside a box measured for Liberation Sans, and
on commit the text snaps back to Liberation Sans. Measured divergence for
"The quick brown fox jumps" at 24px:

| Selected | Textarea width | Box measured for | Delta |
|---|---|---|---|
| sans-serif / Liberation | 285 | 285 | 0% |
| serif / Georgia / Comic Sans | 267 | 285 | **−6.3%** |
| monospace / Courier New | 360 | 285 | **+26.3%** |

(Measured headless on Linux, where Impact and Verdana fall back to the default;
on a machine with those faces installed more rows diverge.)

**This is the vacuous shape this repo keeps finding, already shipped**: a
control that renders and does not apply. It also explains part of the
"box moves as you type" report — see ADR-050 for the other part.

## The blocker: a font does not fit

Embedded fonts are wasm bytes, so a new face is bounded by the deploy sentinel:

| | Bytes |
|---|---|
| Sentinel band | 800,000 – 840,000 |
| Live wasm | 817,392 |
| **Headroom to ceiling** | **22,608** |
| One Liberation TTF | 61,972 |

**One more embedded face does not fit, by about 3×.** Not "is tight" — does not
fit. Any design that embeds fonts starts by moving the band, which is a decision
in its own right (ADR-037, ADR-045) and would give up the floor that is the only
real detector of a featureless build.

That points at loading font data at runtime and handing bytes to the engine
rather than compiling them in. `ab_glyph::FontRef::try_from_slice` already takes
a slice; nothing about the renderer requires `include_bytes!`. The cost is a new
path — fetch or read a file, keep the bytes alive, pass a handle across the
boundary, and decide what happens to a document whose font is not available on
the next machine that opens it.

## The privacy claim is already inaccurate

`Architecture.tsx` describes the demo tier as **"No account, no network."**

`app/index.html:35-37` loads DM Sans and JetBrains Mono from
`fonts.googleapis.com` on every page load, logged out included. Confirmed
against production: a logged-out load contacts `fonts.googleapis.com` and
`fonts.gstatic.com`. **Every demo user's IP already reaches Google before they
touch anything.**

So this is not "would a font feature break the claim" — the claim is already
wrong, and user-selectable Google fonts would deepen it from two fixed families
to arbitrary ones chosen at runtime. Two honest options, unchanged by which:

| Option | Buys | Costs |
|---|---|---|
| **Self-host** the faces | Claim becomes true, for the first time | Bundle size; a licence check per face |
| **Fetch and disclose** | Any Google font, cheap | The copy has to change and say so before the first fetch |

Worth deciding once with the `/pricing` AI-copy problem rather than twice.

## CSP needs no change — verified, not assumed

Against the policy as merged in v8.70 and read off the live response:

| Directive | Live value | Covers Google Fonts? |
|---|---|---|
| `style-src` | `'self' 'unsafe-inline' https://fonts.googleapis.com` | **yes** |
| `font-src` | `'self' https://fonts.gstatic.com data:` | **yes** |

Arbitrary Google fonts are already permitted. The report stream stays the
cheapest detector if that turns out to be wrong, which is an argument for
landing the font work **while report-only is still on**, not after the
enforcing flip.

## Premium gating is a hint, and should be described as one

AI passes are gated server-side: `requireUser(ctx)` → `TIER_DAILY_CAP[user.tier]`
→ a daily cap, all in `convex/aiJobs.ts` before Replicate is touched. A font
selector has no server call to gate. Client-side gating is therefore the only
option and it is **a hint, not a control** — a determined user flips a flag and
gets the fonts.

That is acceptable: the marginal cost of an unauthorised font render is zero,
there is no per-use spend, and nothing is exfiltrated. **Say so plainly rather
than implying an enforcement that does not exist.** This is the opposite of the
AI path and the difference should be written down where the next person looks.

## "Add a font format file" — which

| If | Format | Consequence |
|---|---|---|
| Engine rasterises (today) | **TTF or OTF** | wasm bytes → size band, reproducible build |
| Browser rasterises | WOFF2 | static asset → no band, but a second renderer |

`ab_glyph` needs TTF/OTF; WOFF2 would need decompressing first. **Naming WOFF2
implies moving text rendering back to the browser**, which reverses the decision
`text.rs` was written to make and gives up pixel-identical export. It should be
TTF/OTF loaded at runtime unless the whole rendering model is being revisited.

## Decision

**Nothing is built until three answers exist**, because each changes the code:

1. **Self-host or fetch-and-disclose?** Decides whether font bytes ship with the
   app or arrive over the network, and whether the marketing copy changes.
2. **Runtime-loaded or embedded?** Embedded is closed off by 22,608 bytes of
   headroom unless the band moves; runtime-loaded needs a missing-font story for
   documents opened elsewhere.
3. **Is a client-side-only premium gate acceptable?** Recommended yes, stated
   explicitly.

Two things are recommended regardless, and hold under any answer:

- **Fix the surface disagreement first.** Until the engine takes a font, the
  textarea should render in the face that is actually committed. A dropdown that
  changes the preview and not the result is worse than one that does nothing
  visible, because it teaches the user the feature works.
- **Any test must assert the rendered text changed** — a composite hash or ink
  extents — not that an option appeared in a dropdown. The current selector
  would pass that weaker test today.

## DECIDED 2026-09-08 — the user brings the font

Chris answered all three. The answer to the first reshapes the other two, and it
is better than either option this ADR offered.

| Question | Decision |
|---|---|
| Self-host or fetch from Google? | **Neither — the USER uploads the file** |
| Runtime-loaded or embedded? | **Runtime**, and only fonts installed in a past session |
| Premium enforceable? | **Upload is FREE. Sync is Pro, enforced server-side** |

**Nothing is fetched and nothing is bundled.** A Pro user picks a `.ttf`/`.otf`
off their own disk — bought from Adobe, downloaded from Google Fonts, whatever
they already have a licence for — and Image Horse stores it locally and hands
the bytes to `ab_glyph`. That kills three problems at once:

| Problem this ADR raised | Why it goes away |
|---|---|
| One embedded face misses the band by 3× | The font never enters the wasm |
| Fetching sends the user's IP to Google | Nothing is fetched |
| Redistributing a licensed face | We never ship or host it; the user supplies their own |

The licence question moves to the user, which is where it belongs — they already
hold whatever rights they hold. Worth one line of UI copy so they know that.

### Copy for the Fonts section

The privacy property is a feature, not an apology, and should read that way:

> **Your fonts stay on your machine.**
> Image Horse never fetches fonts from Google or anyone else — you add a font
> file you already have, and it never leaves this browser. Fonts you add are
> remembered for next time.

### Upload is free; sync is the Pro feature

The gating question had no good answer while the Pro feature was the upload
itself. Uploading is entirely client-side — file picker, IndexedDB, `ab_glyph`,
all on the user's machine — so no server call exists to put `requireUser` in
front of, and a devtools flag would defeat any label we put on it.

**So the upload is free, for everyone, ungated.** It costs us nothing: their
file, their disk, their CPU. Gating it would have meant shipping a lock that
does not lock, and writing a comment explaining that it does not lock.

**Pro is font sync**, and that one is real:

| Feature | Server involved? | Enforceable? | Costs us |
|---|---|---|---|
| Upload a font locally | No | **No** | $0 |
| **Fonts follow you across devices** | **Yes** — Convex | **Yes** | Storage |

The same property makes both calls obvious. The upload consumes nothing of
ours, which is why it cannot be gated and why it does not need to be. Sync
consumes storage, which is exactly why it is worth protecting and why
`requireUser` has something to stand in front of — the same shape as
`convex/aiJobs.ts`, and enforced the same way.

It is also the better pitch. "Add your own fonts" is a checkbox; "your fonts
follow you to every device" is a reason to pay. And it retires the worst item
on the list below: **a Pro user opening their work on another machine has the
font there.** Free users keep the fallback path, which turns a limitation into
an honest upgrade reason rather than a missing feature.

### What this decision newly owes

None of these existed before the design changed, and all of them are cheap to
get wrong:

| Question | Why it bites |
|---|---|
| **A document opened without its font** | Still open for FREE users, and solved for Pro by sync. Fall back to Liberation and warn, or refuse? Silent fallback is the one that looks like a bug |
| **Storage lives in IndexedDB** | Font bytes are user data with no backup — the `dexie-migration` skill applies, no exceptions |
| **A malformed file** | `FontRef::try_from_slice` returns a `Result`; a corrupt or hostile `.ttf` must surface an error, never panic in the engine |
| **Size cap** | A CJK face runs to several MB. Needs a stated limit and a stated count |
| **Not WOFF2** | `ab_glyph` needs TTF/OTF. The file picker should reject WOFF2 with a reason rather than failing opaquely |
| **Sync needs a Convex table** | Font blobs are a schema change and a storage cost — a per-user size and count cap has to exist before the first upload, not after |
| **Upgrade and downgrade paths** | A free user who uploaded locally then subscribes: do their fonts push up? A Pro user who lapses: do synced fonts stay readable locally? Both need an answer or support gets them |

### Still true regardless

The two recommendations above this section stand and are now the first
implementation step: **fix the three-surface disagreement before adding
anything**, and **assert rendered pixels changed, never that a dropdown gained
an option.**

### Unchanged by this decision

The privacy claim on `/architecture` is still wrong today. `index.html` still
loads DM Sans and JetBrains Mono from Google on every page load, and that has
nothing to do with the text tool. **Self-hosting those two, or fixing the
sentence, is a separate small job** — and it is now the only thing standing
between the app and the claim being true.

## Consequences

+ "Other fonts aren't being added" has a cause: nothing was ever wired, and the
  cosmetic selector hid it.
+ The size arithmetic kills the obvious design before anyone builds it.
+ The privacy gap is separated from the font feature, where it was already true.
- Staying still leaves twelve options that do nothing.
- Fixing the preview honestly makes the selector visibly inert, which looks like
  a regression and is the truth.

## Alternatives rejected

1. **Ship the Fonts section over the existing selector.** Builds a settings
   surface on a control that does not work; the premium flow would inherit it.
2. **Move text rendering back to Canvas2D.** Every font becomes free, and pixel
   output stops being the engine's — reversing ADR-030-era reasoning and the
   export guarantees that depend on it.
3. **Raise the sentinel band to fit a face.** Trades the only real featureless
   detector for one font, and every future font asks again.

## Pre-mortem

It is six months later and this was a mistake. Most likely reason: the Fonts
section shipped against the cosmetic selector because it demos well, and the
engine work never followed — so the app now has a settings page, a premium
upsell, and still exactly one typeface, with the disappointment moved somewhere
more expensive to undo. The second: fonts were fetched from Google without
touching the copy, and the privacy claim stayed on the site while being false
in a new and larger way.

Early warning sign: a font-related PR that changes no file under `src/`. Under
today's architecture that is definitionally cosmetic, and it is the shape of
every version of this that fails.
