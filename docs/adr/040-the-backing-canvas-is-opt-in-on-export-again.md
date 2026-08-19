# ADR-040: The backing canvas is opt-in on export again

Date: 2026-08-18   Status: draft
Supersedes: the export-default decision in ADR-016 (the artboard itself stands)

## Context

ADR-016 (v7.36, 2026-07-13) made **Include canvas** the export default. Its
argument was that the Canvas is the document's bottom layer, so what is on
screen is what should come out of an export — treating the backing as real
content rather than a compositional guide.

Thirteen months of releases later, three things are known that were not then:

1. **The Settings copy never followed.** Both the panel text and the file
   header still said *"Photo only … the default"*. So the UI described the old
   behaviour while the code did the new one, and each looked correct on its own.
   Nobody chose "Include canvas"; it simply arrived.
2. **It produced a visible defect.** ADR-039: JPEG has no alpha, so a
   transparent backing was written as an opaque black frame around every JPEG
   export. That went unreported for a year because PNG hides the same padding
   perfectly.
3. **It changes the dimensions of every exported file.** A 240×160 photo with
   the default 10px border exports at 260×180. Nothing announces that, and the
   number the user typed into the resize panel is not the number they get.

The artboard itself is not in question — `canvasArtboard` stays on, and the
two-layer import is what ADR-016 was really for.

## Decision

**`exportCanvasBackground` defaults to `false` — "Photo only".** Including the
backing canvas becomes an opt-in for people who want it.

| | Before | After |
|---|---|---|
| Import (`canvasArtboard`) | Canvas + photo | **unchanged** — Canvas + photo |
| `canvasPadding` | 10px | **unchanged** — 10px |
| Export default | Include canvas | **Photo only** |
| Export when opted in | padded backing | **unchanged** — padded backing |
| JPEG + transparent backing | ADR-039 drops it | **unchanged** — ADR-039 still applies |

ADR-039 stays in force: it governs the case where a user *has* opted into
"Include canvas", which is now the only way to reach it.

**Existing installs are not migrated.** `normalize()` only supplies the default
when the key is absent, so anyone who has the preference stored keeps their
current behaviour. This is a change for new users and fresh profiles.

## Consequences

+ An export is the photo at the photo's own dimensions, which is what the
  resize panel's numbers claim.
+ The copy, the header comment and the code now agree — the condition that hid
  both this and ADR-039.
+ The blast radius of ADR-039 shrinks to an opt-in path.
- **A default reversed twice is a default nobody can predict from memory.**
  Anyone reasoning about export behaviour must read the current value rather
  than recall it, and old sessions/notes describing "include is the default"
  are now wrong without saying so.
- Someone who liked the padded export and never touched the setting loses it on
  a fresh profile, silently.

## Alternatives rejected

1. **Keep the ADR-016 default, fix only the copy.** What v8.53 did hours before
   this. Defensible, and rejected by the person whose exports they are.
2. **Drop the artboard import too.** Conflates two decisions. The two-layer
   import is useful; only its export behaviour was unwanted.
3. **Make the export default depend on the fill** (opaque ⇒ include,
   transparent ⇒ exclude). Clever, and it would have masked the JPEG bug
   entirely — a default that changes with another setting is one nobody can
   state out loud.

## Pre-mortem

It is six months later and this was a mistake. The likely reason: someone sets
a coloured backing canvas, designs a bordered image on screen, exports, and
gets the photo without its border — because the export default no longer
matches what the canvas is being used for. ADR-016's original instinct was
right for *that* user; this ADR bets they are the minority.

Early warning sign to watch for: a report that the exported file "lost my
border" or "isn't what I see on the canvas", or a third reversal being proposed
without anyone re-reading ADR-016.
