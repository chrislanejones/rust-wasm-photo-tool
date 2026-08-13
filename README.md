# Image Horse

![Image Horse](public/IH-Hero-Image-August-2026.webp)

**Live:** [rust-wasm-photo-tool.netlify.app](https://rust-wasm-photo-tool.netlify.app/) &nbsp;·&nbsp; [![CI](https://github.com/chrislanejones/rust-wasm-photo-tool/actions/workflows/ci.yml/badge.svg)](https://github.com/chrislanejones/rust-wasm-photo-tool/actions/workflows/ci.yml)

A browser-based image annotation and editing tool powered by **Rust/WASM** for pixel-level operations, **React + TypeScript** with **Zustand** state stores for the UI, and **Convex** for optional cloud persistence. Edits run locally in WebAssembly and your originals + edits live in the browser's **IndexedDB** — your pixels never leave the tab unless you sign in for persistence or AI features. Includes a **batch editor** that works across a whole gallery in one pass — stamp a logo, apply text, bulk-rename by pattern, or name every photo from what is actually in it with a local describer that needs no account and no per-image cost.

> Previously called **Clone Stamp App** — the app grew well beyond its origins as a single clone stamp tool.

## Quick start

Needs Node + [pnpm](https://pnpm.io/), and the Rust toolchain plus
[`wasm-pack`](https://rustwasm.github.io/wasm-pack/) to build the engine.

```bash
pnpm install
pnpm run build:wasm   # compile the Rust engine -> pkg/  (required before first run)
pnpm run dev          # editor at localhost:5173
```

`pnpm run build` bundles whatever is already in `pkg/` — it does **not** rebuild the
engine. After changing anything under `src/`, run `build:wasm` again, or use
`pnpm run build:all` to do both. A stale `pkg/` looks exactly like a broken feature.

Convex and Clerk are optional: with no keys set the app runs fully logged-out,
which is a supported path and not a degraded one. Full setup, deploy notes and
environment variables → **[Getting Started](docs/Getting-Started.md)**.

## Documentation

- **[Getting Started](docs/Getting-Started.md)** — install it, run the app and the marketing site, set up Convex, deploy.
- **[Architecture](docs/Architecture.md)** — how it fits together: layers and compositing, why one WASM binary, the Rust ↔ Convex bridge.
- **[File Map](docs/File-Map.md)** — where everything lives, in both the Rust crate (`src/`) and the React app (`app/src/`).
- **[Features](docs/Features.md)** — what it can actually do, end to end.
- **[Keyboard Shortcuts](docs/Keyboard-Shortcuts.md)** — every binding. The in-app modal (`Alt + /`) is authoritative for the tool digits; this mirrors it.
- **[OpenRaster (.ora)](docs/OpenRaster-Export-Import.md)** — layered interchange with Krita, GIMP and friends: how import/export work, and why this format.
- **[CI](docs/CI.md)** — the workflow jobs, the deploy sentinel, the static guardrails, and the local git hooks.
- **[Change Summary](docs/Change-summary.md)** — the full dated release history.

Design decisions live in **[docs/adr/](docs/adr/INDEX.md)**. Superseded investigations and planning notes are kept in **[docs/archive/](docs/archive/README.md)** rather than deleted — each one says what went stale about it.

## Tech Stack

- **Rust** — WASM processing layer (`wasm-bindgen`, `png` crate, `ab_glyph` fonts, SIMD128 kernels)
- **React 19** — UI framework (19.2.x, pinned through the pnpm catalog)
- **TypeScript** — Type safety
- **Zustand** — Client state management (UI / tool / gallery stores; IndexedDB-persisted prefs)
- **Vite** — Build tool with WASM support (`vite-plugin-wasm` + top-level await)
- **Tailwind CSS v4** — Utility styling via semantic design tokens; core utilities only, variants via cva
- **Radix UI** — Accessible primitives (Dialog, Tooltip, Context Menu)
- **Framer Motion** — Panel animations
- **Lucide React** — Icons
- **Sonner** — Toast notifications
- **emoji-mart** — Emoji picker (stamp tool)
- **JSZip** — Client-side ZIP (batch export)
- **IndexedDB** — Local-first storage (originals, edits, gallery); **Dexie** content layer + Zustand persist adapter
- **Convex** — Real-time database + auth + serverless functions
- **Clerk** — Authentication, wired to Convex through `ConvexProviderWithClerk` (`convex/react-clerk`)
- **Stripe** — Payments / billing, called over raw REST from Convex (no SDK dependency)
- **Replicate** — AI image models (background removal, restore) via Convex

## The marketing site

`marketing/` — the five-page site at **[image-horse.vercel.app](https://image-horse.vercel.app/)**:
home, architecture, features, pricing, trail log. Vite + React 19 + react-router,
plain CSS off the tokens in `src/tokens.css` (no Tailwind, no UI library).
Vercel builds it via the root `vercel.json` — **don't delete that file**, it's what
points the deploy at `marketing/dist` instead of the app.

```bash
pnpm run dev:marketing      # local
pnpm run build:marketing    # production → marketing/dist
node marketing/scripts/gen-trail-data.mjs   # refresh the derived data (see below)
```

Its numbers are derived, never typed. `src/data/commits.ts` (the Trail Log's
commit squares) and `src/data/features.ts` come from `git log` and
`docs/Features.md` via `scripts/gen-trail-data.mjs` — **run it on every release**,
or the graph quietly keeps drawing last month. `src/data/releases.ts` is the
changelog itself, so that one is hand-written: add the new release at the top.

## Changelog

Latest release below. Full dated history → **[docs/Change-summary.md](docs/Change-summary.md)**.

### v8.33 — 2026-08-13

**The brush follows the cursor again when signed in.** Hours after the
background engine became the default, Chris found the brush lagging — but only
signed in. The cause: signed-in accounts autosave to the cloud 2.5 seconds
after each edit, and that autosave asks the engine for the entire document —
29.5 MB on a photo with strokes. On the background thread, that answer travels
through a queue that answers strictly in order, and brush strokes issued behind
it waited for all of it: a call that normally takes a third of a millisecond
measured at **407 ms** when stuck behind an autosave. Two and a half seconds
after your last stroke is exactly when your next stroke begins, so nearly every
stroke collided. Demo mode never runs the cloud save, which is why every
logged-out measurement sailed through at 60 fps.

The fix is scheduling, not machinery: autosave now waits until the pointer is
up before reading the document. The data is no fresher mid-stroke, so waiting
costs nothing — and a stuck stroke can only delay a save briefly, never starve
it, because losing an autosave is the one failure this app never accepts. Large
answers from the engine are also handed over rather than copied now, which
removes a 29.5 MB duplication on every cloud save.

Also in this release: three places still described the background engine as
switched off and waiting — the worker's own header said "not wired into the
app." Accurate for eighteen releases, wrong the morning the default flipped.
They now say what is true.

<details><summary>Older releases</summary>

### v8.32 — 2026-08-13

**Heavy operations no longer freeze the interface.** The engine now runs on a
background thread by default, and draws the photo from there. Sharpening a large
photo used to lock the page for around 130 milliseconds — clicks queued, the
cursor stuck, eleven dropped frames. The same operation now blocks the interface
for **zero** milliseconds and drops one frame. The work takes as long as it ever
did; the difference is that the app stays responsive while it happens.

This has been building since late July, dark, across eighteen releases: every
read the interface makes of the engine was made safe to wait for, the questions
that must be answered together were bundled so an answer can't describe two
different moments, and the canvas itself moved to the background thread so
drawing never crosses back. It was driven end to end in a real browser — every
export format, saving and reloading, deep undo, layers, text, the pen, the
eraser, the batch editor — before any of it was turned on.

If anything misbehaves, `localStorage.setItem("ih_engine_worker", "0")` and a
reload puts the engine back on the main thread. Same escape hatch as every
other feature here; takes effect on the next load.

One honest note: the cloud save-and-restore path has been exercised against the
same machinery but never driven end to end behind the background engine — it
needs a signed-in session. Everything it depends on is the code every other
path proved.

### v8.31 — 2026-08-13

**The ledger, closed out.** No app code changed. The background-engine project's
decision record still described work as mid-flight that finished days ago, so
its table now says what actually happened, with the numbers that ended up
mattering: heavy operations used to block the interface for about 130
milliseconds and now block it for zero, and the speed of talking to a
background thread — the thing everyone worries about first — was never the
problem at a tenth of a millisecond per round trip.

One number had never been measured: the first heavy operation of a fresh
session, on the theory that a background thread starts cold and the first
action would pay double. Measured on both paths, it does not — 231 ms against
206, inside each other's ordinary variation. Starting up warms the thread as a
side effect of loading the photo, so no special handling is needed, and that is
now written down instead of assumed.

The one remaining decision — turning the background engine on by default — has
its full pre-flight written in the decision record, so making it is a
twenty-minute job instead of an archaeology dig. It stays off today.

### v8.30 — 2026-08-13

**The off switch took the app with it.** The engine can run on a background
thread, switched off by default. The switch that turns it off was documented as
working immediately, mid-session. It did not, and finding out what it actually
did was worse than expected: flipping it while a photo was open **closed the
whole editor** — not a blank canvas, an empty page.

The cause is one wrong belief. The switch is a setting, and a setting can change
at any moment; the engine cannot follow it, because the photo you have open was
handed to whichever side was chosen when it loaded, and nothing moves it
afterwards. The drawing code asked the setting where to draw instead of asking
where the photo actually was, so it tried to draw a background-thread photo on
the main thread, got nonsense for the image size, and threw an error in the
middle of drawing the page. React responded by removing the page.

It now asks where the photo is. That question cannot be answered wrongly,
because the thing being asked is the thing that owns the photo.

**What the switch does, stated properly:** it takes effect the next time the app
loads — the same as every other switch here. Flipping it mid-session is now
harmless: the app keeps working, the picture stops updating until you reload.
Three comments that promised more have been corrected, and a test now fails if
that promise creeps back in.

**Also:** nine internal checks resolved file paths relative to wherever the test
runner happened to be started. Started from the wrong place, they read no files
and passed while checking nothing. They now resolve relative to themselves.
Verified by planting a real violation and confirming they catch it either way.

### v8.29 — 2026-08-13

**Everything the background thread had never been asked to do.** The engine can
run on a background thread, switched off by default. Last release was the first
time it had ever been driven end to end in a browser, and it found two faults in
one sitting. That is an argument about arithmetic, not about those two faults:
most of the app had still never run that way.

So this release ran it. Every export format, saving and reloading, undo and redo
twenty-two deep, layers added and duplicated and deleted and reordered and
hidden, rotate, text, the pen, the Magic Eraser, and the batch editor —
all with the background thread doing the work.

Nothing broke. No release notes are needed for what changed in the app, because
nothing did: this is a record of what was checked, kept where the next person
can find it. The background engine is still switched off by default.

One thing is worth writing down. Partway through, reloading appeared to lose two
edits — which would have been the worst kind of bug this project can have. It
turned out the test itself caused it, by reaching past the app to the engine
underneath, and the app had already said so in plain words in the console. A
clean re-run restored correctly. The tools were right and the tester was wrong,
which is the good version of that morning.

### v8.28 — 2026-08-13

**The background thread was drawing to a canvas nobody could see.** The engine
has been able to run on a background thread since v8.25, switched off by
default. This is the first time the whole of it was driven in a real browser
with the switch on, and it found two faults. Both are fixed. It stays off by
default.

**Opening a second photo left the canvas blank.** A canvas can be handed to a
background thread exactly once — after that the handover cannot be repeated for
that canvas, ever. The app was building a fresh background thread for every
photo, which destroyed the thread holding the canvas and left the replacement
with nothing to draw on. The photo loaded, the thumbnail was right, the file
size was right, and the picture was simply absent. Nothing appeared in the
console. Counted during a reload: the discarded thread had been given the canvas
and no work at all; the live one had been given 339 pieces of work and no
canvas. The thread is now kept and the photo swapped inside it.

**The readouts stopped counting.** The engine answers some questions in bundles
— width, height, undo count, layer list, all gathered in one go so they cannot
disagree with each other. A bundle is a handle into the engine's memory, and a
handle means nothing on the other side of a thread boundary; what arrived was an
empty shell. So the undo counter, the image dimensions and the layer list froze
at whatever they said when the photo opened, and stayed there for the rest of
the session. Bundles are now unpacked before they cross.

**And the reason for all of it, measured.** On a 4.3-megapixel photo, sharpening
blocks the main thread for **119 ms** today. On the background thread it blocks
it for **0 ms**. The longest single gap between frames falls from 191 ms to
25 ms — one dropped frame instead of eleven. The work still takes about the same
time; the difference is that the window keeps responding while it happens.

### v8.27 — 2026-08-12

**A bug that was never a bug.** For a week the app appeared to hang on
"Loading your workspace…" whenever it was opened for testing. It was blamed on
signing in, then on the cloud sync, then on how many photos were stored. All
three were wrong, and this release retires the question.

A browser gives an inactive tab no animation frames at all — none, not merely
fewer. Measured here: zero in nearly four seconds. Every animation in the app
runs on those frames, so in a tab nobody is looking at they all stop partway
through. The startup screen begins fading out and stops fading, so it sits there
forever. The tool sidebar begins sliding in and stops **off the left edge of the
screen**, which is why clicking a tool appeared to do nothing — the button was
not where it looked.

The app itself was fine the whole time. Instrumenting every step of startup
showed it finishing in about two seconds, including the step that dismisses the
splash. Nothing was hanging; a picture had frozen over the top of a working
editor.

**Also in this release:** when the background thread declines to draw — because
the canvas it was given has been replaced — it now says so instead of quietly
doing nothing. A silent refusal and a refusal that never happens look identical,
which is exactly the confusion above, one layer down.

### v8.26 — 2026-08-12

**The test that could have said no said yes.** No code changed; this is the
missing proof from the last release.

Moving the engine to a background thread rests on one assumption: that when the
app fires off a batch of edits, they arrive in the order they were sent. If they
don't, your undo history stops matching what you did — not with an error, just
quietly wrong. The whole design was chosen because of that assumption, and it had
never actually been tested. It had only been read off the source code and
believed.

It now holds. Sixteen edits were fired at the background thread at once, with no
waiting in between, and the recorded history came back **byte-for-byte identical**
to the same sixteen run the ordinary way.

**Why the last release couldn't run it.** The history only records an edit when
the picture is next redrawn, and the test never redrew it — so it was comparing
an empty history against an empty history and calling it a match. The fix was one
line; noticing was the work.

**And the test was tested first.** Running the same eight edits in reverse order
produces a completely different fingerprint. Without checking that, "identical"
would have been meaningless — a measurement that can't tell two orders apart
can't prove the order was kept.

One check is still outstanding before the switch can be turned on for real: what
happens when the canvas is replaced mid-session. That one hasn't been exercised
yet, and it's said so here rather than being counted as done.


### v8.25 — 2026-08-12

**The engine ran on a background thread for the first time, and drew the photo
from there.** Off by default. This is the step the last two months of small,
invisible changes were for.

The picture you see is now proof rather than an assumption: once the canvas is
handed to the background thread, the main thread physically cannot draw to it —
the browser refuses. So a photo appearing on screen can only have been painted
by the other thread. It appears.

**Turning it on immediately found two bugs, both of the kind that show nothing.**

The first: the canvas is created when the editor opens, but the background
thread is not started until you open a photo. Handing the canvas over at the
moment it appears therefore never happened — there was nothing to hand it to
yet — so the other thread drew into nowhere and the screen stayed empty. It now
holds the canvas until there is somewhere to send it, so the order stops
mattering.

The second is worse and older. When the canvas is replaced — which happens when
you cross into Batch — the background thread was told the new one had arrived
but kept a handle to the old one as well. It would have carried on painting into
a canvas that no longer exists: nothing thrown, nothing logged, just a blank
picture from an ordinary action. That is precisely the failure the last release
but one built a safety net for, and the net had a hole in it: the check it ran
was satisfied by the file merely *mentioning* the rule, so the new drawing code
sailed past it. Both the code and the check are fixed.

**What is not yet proven, stated plainly.** The most important test — that the
undo history comes out byte-for-byte identical on both threads — did not run. The
operations I could drive from a console are not the ones the history records, so
the comparison would have been empty against empty, which proves nothing. The
picture comparison did pass: an eighteen-step sequence of drawing, undoing and
redoing produced identical images, identical dimensions and identical history
labels on both. The switch stays off until the missing test has actually run.


### v8.24 — 2026-08-12

**Nothing you can see.** The engine is now created in one place instead of five,
which is what has to be true before it can be created somewhere else entirely.

Opening a photo, pasting one, getting one back from an AI tool, restoring one
from its edit history — each of those built the engine itself, and each would
have needed its own answer for "what if the engine lives on another thread". They
now all go through one function that makes that decision once. Behind the scenes
only; the switch is still off and the local path does exactly what it did
before, verified by drawing on a photo and watching the stroke land.

**Two things this turned up.** The first is that the code for talking to a
background thread had never actually been part of the app — it was written,
tested against a stand-in, and then removed by the bundler because nothing
imported it. The moment something did, the build failed outright: the app was
configured to package background workers in a format that can't handle a worker
which loads code on demand, and the engine worker does exactly that. It has
never been able to build. Now it can.

The second is a guard with no test behind it. Moving the engine somewhere else
means shutting down the previous one, because the memory it holds is never given
back — a forgotten instance makes the tab permanently heavier. The shutdown was
written correctly and nothing checked it, which I found by deliberately breaking
it and watching every test still pass. There are tests now.

**And one I had written wrong.** Handing a photo's pixels to another thread can
either copy them or hand over ownership. Handing over is faster — except the
original then reads as empty, silently, and two of the three places that pass
pixels are passing a window onto memory the caller still owns. It copies now,
which costs nothing extra: the alternative was already a copy in disguise. The
test I wrote to prove that was itself broken — the stand-in for the other thread
ignored the hand-over entirely, so the test passed either way. Deliberately
breaking the code is what exposed the test, not the code.


### v8.23 — 2026-08-12

**Nothing you can see. The next step of the engine move is designed, and three
things about the plan turned out to be wrong.**

The plan said this step was a small one — swap the body of a single function and
change nothing else. Checking it against the code first found three reasons that
cannot work, and the third is the interesting one.

**The engine gets built in the wrong place.** The function that was supposed to
be the swap point receives an engine that has already been created and loaded
with your photo, on the main thread. A background thread can't adopt that — it
would have to build a second one, which means two copies of your undo history,
which is the exact thing this whole change exists to avoid. So the seam moves
earlier, to where the engine is created.

**A stand-in that forwards everything says yes to everything.** Four features in
the app check whether the engine can do something by asking whether the method
exists. A forwarding stand-in answers yes to all of them, on every build,
including builds that genuinely can't do those things. The fix is small and
better than the original: the background thread reports what it can actually do,
and the stand-in only offers that. Which also means the list can never drift out
of date — the same drift that caused the wrong numbers two releases ago.

**And the fast path for drawing can't cross a thread boundary at all.** Drawing
works by pointing directly at the engine's memory instead of copying it. A
pointer into memory on one thread means nothing on another. There's no clever
way around that, so moving the canvas across has to happen at the same time as
everything else rather than afterwards.

The first piece is built and tested: the background thread now reports its own
capabilities, and the stand-in is limited to them.


### v8.22 — 2026-08-12

**Every place that reads from the engine now waits for the answer.** All of it,
this time — measured by the tool that was fixed last release rather than the one
that couldn't see a third of the work.

Thirty-six more call sites converted, across the undo log's save and restore
paths, the tile flush, the Magic Eraser's removal, and the Remove Object action.
Nothing you can click behaves differently. What changes is that when the engine
moves to a background thread, none of these will quietly start lying — and a
surprising number of them would have. Un-awaited, a check like "is this log
still describing the document?" stops being able to answer *no*, because the
unfinished answer itself counts as a yes.

**One of them caught me out, which is the useful part.** Converting the log's
trustworthiness check meant updating both places that call it, and I updated
one. The type checker was happy — asking `if (!x)` about an unfinished answer is
perfectly legal code — and the migration's own counter was happy too, because it
counts calls into the engine and this was a call into a helper. The thing that
caught it was an ordinary test about persistence, asserting that a broken log
doesn't get written to disk. It failed immediately and pointed straight at the
line.

That is worth writing down because it is the shape of the whole exercise: the
dangerous conversions are the ones where nothing complains.

**Also:** the last of the mouse-move handlers are converted, so the tally that
tracks them is at zero for the first time.


### v8.21 — 2026-08-12

**The tool that measures this migration could not see 31 of the engine's own
methods.** Nothing about the app changed. What changed is that the number
everyone has been steering by was wrong, and now it isn't.

Every release since June has quoted a count of how many places still talk to the
engine in a way that won't survive moving it to a background thread. Two releases
ago that count reached what was called its floor, and the note said the stage was
finished. It wasn't. The counter reads the engine's method list out of a
hand-maintained file that sits alongside the real generated one, and that file
had drifted: it listed 249 methods where the engine has 280. A method missing
from that list isn't counted wrong — it's **invisible**, because the check that
decides "is this an engine call at all" starts by asking whether the name is on
the list.

Thirty-one methods were missing, including every single one belonging to the undo
log. Thirty-six live call sites had never been counted in any bucket, in any
release. The real number is **29, not 5**.

This is the fourth time in this project that a number turned out to be a
statement about the instrument rather than the code, and the fix is the same each
time: make the instrument read from the source of truth instead of a copy, and
print it loudly when the two disagree.

**Eleven of the mouse-move sites are now converted** — the lasso's live wire, the
paintbrush, the blur brush, the eyedropper's magnifier, the text hover, the
Magic Eraser overlay, the selection preview and the histogram. Each needed a
decision rather than a keystroke, because two mouse-moves can now be in flight at
once: a preview that arrives late should be thrown away, and a paint dab that
arrives late absolutely should not.

**Also:** the Trail Log's August card was rendering empty. It ranks a month's
highlights by how many features each release carried, and August carried none —
fifty-nine releases of engine work, not one of them a feature. A busy month
looked like a dead one. It now falls back to counting everything a release
shipped when a month has no features at all.


### v8.20 — 2026-08-12

**Nothing changed in the app. A plan did.** The engine has been moving to a
background thread in stages since June, and the last stage — actually running it
there — was recorded as ready to start. It is not, and this release is the
correction plus the evidence for it.

The migration has a counter that tracks how many places still read from the
engine in a way that would break on a background thread. That counter reached
its floor last release, which read as "done". It isn't done: the counter was
never counting one category of call — the ones that run on every mouse-move,
deliberately left until last. **Fifteen of those eighteen still read a value the
old way**, and every one of them would break quietly rather than loudly. The
lasso's "am I drawing?" check would stop being able to say no. The eyedropper
would read colour out of nothing. The paintbrush would think every mouse-move
changed the picture.

None of that would have shown up in a test. The counter doesn't count them, the
type checker can't see the difference, and the app would keep running — just
wrongly.

**The good news, and it was already written down.** The obvious worry about
fixing this is that waiting for a background thread on every mouse-move would
make drawing feel laggy. That was measured a long time ago and it isn't true:
the round trip is a tenth of a millisecond, about half a percent of one frame.
The original feasibility study says so in its own headline. So this is work, but
it is not a redesign — with one real catch, which is that a mouse-move handler
that waits can be asked to handle the next mouse-move before it has finished the
last one. That's the same trap the pen tool hit two releases ago, and it now has
a known fix.

No version of this was going to be found by running the app. It was found by
checking the plan against the code before starting, which is the only reason
it's a paragraph instead of a bug report.


### v8.19 — 2026-08-12

**The pen tool finishes a path the same way it always did, and now it waits for
the answer first.** This is the last of ninety-one changes that have been going
into the engine a few at a time since June, and it is the one that was left until
the end because it could not be done the way the other ninety were.

Everywhere else the change was "wait for the answer before using it". The pen is
different in two places. Finishing a path hands back an id, and that id is what
keeps the path selected so the colour and Background controls point at the thing
you just drew — so the answer is the whole point, not a formality. And clicking
on the canvas has to decide *in that instant* whether you are re-opening an
existing path or starting a new one, which is not a decision that can wait for
anything.

So it does not wait. Clicking drops the anchor immediately, exactly as before,
and if it turns out you clicked on a path that already existed, the anchor is
thrown away and the path opens instead. Nothing is committed until you finish,
so there is nothing to undo. Click-drag on that first anchor still pulls the
curve handles out of it on the same frame, which is the thing that would have
been lost by doing this the obvious way.

The other half is a guard on finishing. Now that finishing waits, it can be asked
to finish twice before it has finished once — hold `Enter` down and you would get
two identical paths stacked exactly on top of each other, one undo step each,
looking like one path until you delete it and the other is still there. It now
finishes once.

**What you should notice: nothing.** Draw a path, press `Enter`, and it commits
once and stays selected. Click a path you drew earlier and it re-opens with no
stray point left behind. Leave the pen mid-path and the path is still committed
rather than lost. Twelve `Enter` presses in a row produce one path.

One thing this release does **not** settle. Leaving the pen mid-path commits it
on the way out, and that still works — but the engine currently answers
instantly, so "on the way out" and "answered" happen in the same instant. When
the engine moves to a background thread there will be a real gap between them.
The reasoning for why that stays safe is written down; it has not been run yet,
and it is the next step's job, not this one's. Recorded so a green check here
isn't mistaken later for a question that was answered.


### v8.18 — 2026-08-12

**Almost nothing you can see, and no behaviour changed.** Four places in the
codebase described how far the engine-in-a-worker migration had got, and all
four had drifted. One had been wrong for ten releases while the number it quoted
fell by 89. The one that matters is the description under the "Engine in a
Worker" switch in Features, because that is the one a person actually reads.

They now all say the same thing, and it is the true one: 89 of 96 conversions
are done and 7 are left — 5 of those deliberately exempt, because they dissolve
when the canvas moves into the worker rather than needing conversion at all, and
the last 2 belonging to the pen tool.

**The pen tool's two are now designed rather than just deferred.** They are the
only thing standing between this migration and the end of its current stage, and
they are not the "make it wait for the answer" job the other 89 were: finishing a
pen path hands back an id that keeps the path selected, and clicking has to
decide in that instant whether you are re-opening an existing path or starting a
new one. Both, plus the eight gestures that have to be tested before it can ship,
are written down now.


### v8.17 — 2026-08-12

**Nothing you can see.** The readout that mirrors the open document — image size,
zoom, the undo and redo counts, the layer list — now waits for the engine's
answer. It runs after almost every edit you make, which makes it the
most-travelled call of the lot, and the last one of these that was a
straightforward conversion.

It needed a guard, and the guard is the interesting part. Switching photos puts
the old document down, but the old engine is still alive underneath, so a reply
that was already on its way still arrives — carrying the previous photo's size
and undo history. It would land on top of the photo you just opened. Nothing
would break and nothing would be logged; the numbers beside your new photo would
simply be the old photo's until your next edit corrected them. Every reply is now
checked against the document that asked for it, and dropped if you have moved on.

**The remaining two are not this kind of work.** Both belong to the pen tool. One
hands back the id of the path you just finished so it stays selected; the other
decides, on mousedown, whether you are re-opening an existing path or starting a
new one. Neither can simply wait — the pen overlay has to learn a waiting state
first, and one of them runs while the overlay is being torn down, where waiting
is not available at all. That is a design job, not the tail of this one.

### v8.16 — 2026-08-11

**Nothing you can see.** Four more of the app shell's engine calls now wait for
the answer: placing an object into a grid cell, saving the working copy of a
photo, the canvas checksum in the info panel, and the "photo only" share export.

The placement one had a check that would have quietly stopped checking. It asks
the engine "did that actually move anything?" and skips the redraw when the
answer is no — but the question sits a line above the answer, which is enough to
hide it from the tool that finds this class of bug. It has now been found by
hand and fixed.

**Two calls in this file are deliberately not done yet.** Both belong to the pen
tool, and converting them means reworking how the pen overlay finishes a path —
including what happens when you switch away mid-draw, which cannot wait for an
answer at all. That is its own piece of work rather than the tail of this one.

### v8.15 — 2026-08-11

**Nothing you can see.** Exporting a layered `.ora` file now waits for the
engine's answer — the last six of these conversions, and the last of a
particular kind of bug with them.

That kind: a check written as *"if the engine says yes"*. Left half-converted it
stops being a check at all and always says yes. This one decided whether your
live text and shapes had been baked into pixels for the export — and baking them
clears your redo history, so the app tells you when it happens. Broken, it would
have told you that on **every** `.ora` export, including ones where nothing was
baked at all. There are now none of these left anywhere in the app.

**What this release does not do** is make the export atomic. The file is still
assembled across several moments, and this change slightly widens that window
rather than closing it. Closing it needs the export to notice the picture
changed underneath it and refuse — decided four releases ago, not built yet.

Checked by exporting a real two-layer file and taking the archive apart: both
layers present, and the dimensions recorded inside it match the picture.

### v8.14 — 2026-08-11

**Nothing you can see.** The last piece of the text-measuring work, and the one
that was written down as the plan two weeks ago and never built.

Laying out the text box on screen needs to know how wide your text is and where
its ink starts. That happens while the screen is being drawn, which is the one
place that cannot wait for an answer. So it now asks for the answer *just
before* — off to the side, in advance — and the drawing reads what was already
worked out. When there is no answer yet it falls back to measuring the box in
the browser, exactly as it did before any of this existed, for one frame.

It was built last on purpose. Four other places also asked for those
measurements and could not cope with "don't know" — the batch stamp in
particular is written to refuse and skip a photo rather than guess. Removing the
old path before those four were moved would have broken them silently. They
moved first, in the two releases before this one.

### v8.13 — 2026-08-11

**Nothing you can see.** The batch stamp — logo and text, applied across a whole
gallery in one pass — now waits for the engine's answer.

This was the riskiest piece left, and the reason is worth stating. The text
stamp measures your text in the engine so it can corner-align it, and it is
written to **refuse and skip a photo** rather than guess, because guessing would
put the text in the wrong corner of every image at once. That refusal was about
to stop working: the check it used to spot a missing measurement would have
started passing in exactly the situation it was written for, and the whole batch
would have been stamped at a nonsense position instead of being skipped and
reported.

Rather than teach it to handle that, the measurement now simply waits — so there
is nothing to miss. Checked by running a real four-photo batch and reading back
every coordinate the engine was handed: all finite, none nonsense.

### v8.12 — 2026-08-11

**Nothing you can see.** The text tool now waits for the engine's answer —
adding text, re-opening it to edit, clicking an existing text, and refreshing
the list after an undo.

Two of those calls measure where a letter's ink actually starts inside its
tile, which is what stops committed text landing a few pixels off from the
preview you typed against. Those two now wait properly rather than accepting
"don't know" for an answer — they never needed to guess, because unlike the
drawing code they aren't running while the screen is being painted.

Checked by round-trip rather than by eye: place a text, click it to re-open it,
commit it again unchanged, and it must not move by a single pixel. It doesn't.

### v8.11 — 2026-08-11

**Docs only.** A decision that had been open since the background-thread work
started: whether exporting a layered `.ora` file should ask the engine for
everything in one go, so the file can't be assembled from two different moments.

Measured, the answer is no. Reading the layers one at a time holds about 5 MB at
its peak no matter how many layers there are. Asking for them all at once holds
every layer simultaneously — 11 MB for two layers, 27 MB for five, and it keeps
climbing. The browser never gives that memory back, and unlimited layers is a
paid feature, so the worst case lands on someone paying.

Instead the export will check whether the document changed underneath it and
refuse to write a file it can no longer vouch for. A failed export you can retry
is better than a corrupt one you keep.

Also separated two things that had been filed as one problem: baking annotations
into pixels before an export is not what could tear the file — it finishes
first — but it does clear your redo history as a side effect of exporting, which
is worth fixing on its own.

### v8.10 — 2026-08-11

**Docs only.** One of the remaining pieces of the background-thread migration
was documented as safe on the strength of a claim nobody had checked: that every
place asking for text measurements already copes with not getting an answer.
Two of the six do not — the batch text stamp is written to refuse rather than
guess, on purpose, because guessing would corner-align a whole gallery of photos
to the wrong place.

Worse, it would not actually refuse. The check it uses to detect a missing
answer would stop working in exactly the situation it was written for, and the
batch would be stamped at a nonsense position instead of being skipped and
reported.

Nothing changed in the app. The claim is corrected where it was written, and the
corrected plan is recorded: the two places that genuinely cannot wait keep their
fallback, and the four that can wait should simply wait.

### v8.9 — 2026-08-11

**Nothing you can see.** Shapes, arrows and callout pins now wait for the
engine's answer.

Seven calls, but the work was the wiring between them rather than the calls
themselves: committing a shape and reloading the shape list are each triggered
from four or five places — Enter, clicking away, switching tools, undo — and two
of those had to keep their order. Clicking an existing shape re-selects it only
because the pending edit is committed *first*, and the check for "what did I
click" reads the list that commit writes.

The clearest proof it still works is the pins: drop two and they come out
numbered 1 and 2. The second one only knows it is the second because it reads
the first back from the engine.

### v8.8 — 2026-08-11

**Nothing you can see.** The whole Select tool — wand, edge-aware, colour
range, magnetic lasso, and both marquees — now waits for the engine's answer.

Thirteen calls in one file, the largest batch of this run, and five of them
were checks written as `if (engine says yes)`. Every mode was driven in a real
browser afterwards and each left the right entry in the history: Magic Wand,
Edge Select, Colour Range, Magnetic Lasso, Marquee, Ellipse Marquee, Select
All, Delete Selection, Selection to Layer.

The live wire that follows your cursor while a lasso is open was deliberately
left alone. It runs on every mouse-move, and it is the one place in this file
where waiting for an answer would cost a frame.

### v8.7 — 2026-08-11

**Nothing you can see.** The two AI buttons and the layer-resize box now wait
for the engine's answer.

The one worth explaining: dropping a resize box and pressing Enter is a
"commit", and the same commit runs quietly every time you switch tools, on the
understanding that it does nothing when there is no box open. That "does
nothing" is a check, and the check is the call that was converted here — left
half-done it would have stopped saying no, and every tool switch would have
added a step to your undo history for a box that was never there.

Both AI buttons were then checked on a real signed-in account, with the upload
step blocked so no credit was spent: each hands the model a full-size PNG of
the current picture, and Remove Object opens its window with the image already
loaded.

### v8.6 — 2026-08-11

**Nothing you can see.** The last three files with a single engine call left in
them: the export dialog's size label, the eyedropper, and the clone stamp.

These are the three that needed the surrounding code rearranged rather than one
keyword added. The clone stamp's was the one worth being careful about — the
call it makes is the check for "has a source point been set yet", and that check
sits inside an `if`. Left half-converted it would have stopped rejecting
anything, and the stamp would have painted from wherever the engine happened to
be, silently. Verified in the browser both ways round: a click with no source
still does nothing, and a source-then-stamp still leaves a stroke.

### v8.5 — 2026-08-11

**Nothing you can see.** Four more engine calls now wait for the answer before
using it: copying a selection to the clipboard, both of the paths that save an
edited photo, and the OCR button that pulls text out of an image.

Each of the four was a single keyword, because each already sat inside code
that waits for something else. The three remaining one-call files are not like
that — every one of them needs the surrounding code rearranged first, which is
a different job and is queued as its own.

### v8.4 — 2026-08-11

**Nothing you can see.** Copy-to-clipboard and the single-photo download now
wait for the engine's answer before using it.

The fourth call in that file turned out not to be ordinary work at all: the
histogram under the image is redrawn from a full pass over the whole picture,
and the code that asks for it runs once per animation frame until the bars
settle. That one is now filed with the other frame-rate work rather than queued
for conversion.

### v8.3 — 2026-08-10

**Nothing you can see.** The export paths now wait for the engine's answer
before using it — saving a photo, sharing a link, and building the .zip of a
whole gallery.

Checked against the real thing rather than only by tests: PNG, JPEG and WebP
each came back as genuinely that format, and a twelve-photo .zip built
correctly with an edited photo among them.

### v8.2 — 2026-08-10

**Nothing you can see.** Four more engine calls turned out to sit on the path
that repaints the canvas — not because of anything in the functions themselves,
but because the redraw reaches into two other files to call them. Their names
give nothing away, and the check that finds this class of problem only ever
looks at a function's own name, never at who calls it from somewhere else.

Left in the ordinary queue, the next batch would have made the redraw wait for
a round trip on every frame. They are now listed with the reason, and the list
of remaining work drops accordingly.

### v8.1 — 2026-08-10

**Nothing you can see.** Flip-horizontal, flip-vertical and copy-region now wait
for the engine's answer before using it — three more calls converted for the
background-thread move.

The more useful find was accidental. One source file contained two invisible
NUL characters, used as a separator inside a cache key. That is enough to make
every search tool classify the file as *binary* and skip it silently, so
searching the project for anything defined in it returned a confident zero. The
characters are now written as an escape — identical behaviour, and the file is
searchable again.

### v8.0 — 2026-08-10

**Nothing you can see — the migration's own bookkeeping, corrected the other
way.** Yesterday's release fixed a rule that was filing live drawing code as
ordinary work. This one retires that rule entirely, because it was wrong far
more often in the opposite direction: of the 21 calls it alone marked as
"drawing hot path", **19 were ordinary once-per-click actions** — commit,
cancel, apply-crop, drop-a-pin, mouse-down, mouse-up. They had been set aside
to be done last, which meant nobody was looking at them.

The list of remaining work therefore goes **up**, not down. That is the honest
number, and the first one the rest of this migration can actually be planned
against.

### v7.99 — 2026-08-10

**Nothing you can see.** The checklist tracking the background-thread migration
had a target it could never reach: five of the calls it was counting are ones
the plan says must *not* be changed, because a later stage removes that code
path entirely. The checklist wanted them at zero; the plan forbade touching
them.

Left alone that doesn't just stall — it pushes the wrong way. Sooner or later
someone grinds the number down, meets those five, and "finishes the job" by
changing the one piece of code that repaints the canvas on every frame. Those
five are now named, with the reason, and changing them makes the test suite fail
loudly instead of looking like progress.

### v7.98 — 2026-08-10

**Nothing you can see.** Undo, redo, jump-to-step and delete-step now wait for
the engine's answer before repainting. Four of the five were the same shape:
"if the engine says it undid something, repaint" — and once the engine answers
from a background thread, that question stops being answerable on the spot. Left
alone, every Ctrl+Z would have repainted and re-synced whether or not anything
was actually undone.

Checked in a browser rather than only by tests, because a broken undo button is
not something a type checker can see: undo and redo work from both the toolbar
and the keyboard, and pressing Ctrl+Z with nothing left to undo correctly does
nothing at all.

### v7.97 — 2026-08-10

**Nothing you can see — a measuring instrument corrected.** The tool that
decides which engine calls sit on a drawing hot path had six of them filed as
ordinary work, including the blur brush's drag, the eyedropper's magnifier and
the text tool's hover highlight. The next batch of background-thread work would
have made those wait for a round trip on every mouse movement, which is a
dropped frame in exactly the places you would notice one.

Nothing in the app changed. The list it was working from did.

### v7.96 — 2026-08-10

**Something you can feel.** Every time the editor refreshed itself — after a
brush stroke, an undo, a layer change — it rebuilt the entire image from scratch
and checked every single pixel, to work out whether the picture had any
transparency in it. On a 1385x2068 photo that was about 30 ms of work, and it
was the whole cost of the refresh: the other ten things it collects took no
measurable time at all.

Nothing was using the answer. The canvas checkerboard used to ask, and stopped
in June when it became always-on; the question kept being asked anyway. It is
gone, and the refresh now costs nothing measurable.

The engine can still answer it — that hasn't been removed, just taken off the
path that runs after every edit.

### v7.95 — 2026-08-10

**Nothing you can see.** More of the same groundwork: exporting a layered `.ora`
project asked the engine for the canvas size and the layer list as four separate
questions, and the routine that flattens each layer first asked three more. Both
sets describe one document and get written into one file, so once the engine
moves to a background thread, a resize arriving mid-question could put a canvas
size from before it next to a layer list from after — a broken `.ora` saved to
disk with no error at the time. Each set is one question now.

This does not make `.ora` export airtight on its own, and it is worth being
straight about that: the export still loads its ZIP library partway through, and
the layer images are fetched after that point. Closing that gap is a bigger
decision, and it is still open.

### v7.94 — 2026-08-10

**Nothing you can see, and one thing that can no longer go wrong later.**
Clicking a pen path to re-edit it used to ask the engine two questions: which
path is under this point, then give me every path so I can look that one up. Two
questions with a gap between them. Today the gap is empty; once the engine moves
to a background thread it stops being, and a path deleted in that gap would make
the click do nothing at all — no error, no message, just a click that does not
work. It is one question now.

The engine also keeps the rule the app used to apply itself: a rectangle drawn
over a pen path still means "no pen path here", rather than reaching through it.

### v7.93 — 2026-08-10

**Nothing you can see.** The plan to move the engine onto a background thread
rested on a number nobody had measured: what it costs to get finished pixels
onto the screen from over there. It is 22 ms on a 3.1 megapixel photo, against
23 ms for the main thread doing the same work — so there is no penalty, and the
reason for picking this approach over the alternative holds up.

Getting that number needed a real engine running inside a background thread that
owns the canvas. Two earlier experiments had each done one half of that and
never both at once. Two other things fell out of the run: the first operation
after switching costs about 1.8x the ones after it, so the switch has to warm
the thread up before handing it work; and the old thread has to be shut down
rather than left idle, because the memory it holds is never given back.

### v7.92 — 2026-08-09

**Nothing you can see.** More groundwork for moving the engine onto a background
thread. The switch that turns that mode off now works mid-session instead of
only on reload — it swaps the drawing surface for a fresh one rather than trying
to reclaim a surface it can no longer draw to.

### v7.91 — 2026-08-09

**Nothing you can see.** Groundwork for moving the engine onto a background
thread. The app now keeps track of which drawing surface is live and gives each
one a number, so a later change can refuse work aimed at a surface that has been
replaced instead of drawing into nothing.

Worth knowing why that matters: once the engine draws from a background thread,
switching in and out of Batch replaces the canvas underneath it. Without this,
the background thread would keep painting into the old one — no error, no
warning, just a blank screen.

### v7.90 — 2026-08-09

**Nothing you can see, and one thing you can feel.** Creating a share link with
"Photo only" set was building the whole image twice to work out two numbers; it
does it once now, and skips a step it never needed — 40 ms down to 17 ms on a
1385x2068 photo.

The rest is groundwork for moving the engine onto a background thread. The
eleven values the editor reads to redraw itself — size, zoom, layers, undo
history, export quality — now come back in one call instead of eleven, so they
can never describe two different moments.

### v7.89 — 2026-08-09

**No user-visible change.** The v7.81 fix — Download All shipping your original
files instead of your edits — now has a regression test. That bug only appeared
after a page reload, which is why it lasted two months and why the fix went out
without one. The code underneath it has been rewritten twice since, so the
cover is overdue.

### v7.88 — 2026-08-09

**Exports that leave the canvas background out are three times faster.**
Choosing "Photo only" was rebuilding the whole image three times to answer one
question — once for the pixels, once for the width, once for the height. It
does it once now. On a 1385x2068 photo that is 69 ms down to 20 ms, and the
same bytes come out the other end. Copy to clipboard, download and batch export
all took the slow path.

Also groundwork: nine places that read a picture and the dimensions describing
it now read both in one call, so nothing can change in between.

### v7.87 — 2026-08-09

**Docs only.** ADR-024 gains a triage table recording which files in the
background-thread migration have been checked and what was found, so the next
session does not re-derive it. Two more places were caught where reads that
must describe the same moment would break if converted one at a time.

### v7.86 — 2026-08-09

**Tooling only.** The audit that tracks the background-thread migration was
mis-filing the lasso's live preview as ordinary work. It runs on every mouse
move, where waiting on a background thread would cost a frame, so it belongs in
the group that gets handled last and separately. No app code changed.


### v7.85 — 2026-08-09

**Groundwork, nothing user-visible.** More of the engine-on-a-background-thread
preparation: the layer operations — add, remove, rename, reorder, merge, show
and hide, opacity, masks — are ready for an engine that answers over a message
queue. Behaviour is unchanged; verified by driving every one of them and
checking the layer stack after each.


### v7.84 — 2026-08-09

**Groundwork, nothing user-visible.** Saving a photo now reads the whole
document in one go rather than eighteen separate reads. Same bytes on disk —
verified byte-exact through a save, reload and restore — but the read can no
longer be interrupted halfway, which is what would have let switching photos
mid-save mix one photo's canvas with another's history.


### v7.83 — 2026-08-09

**Marketing site.** The button-set image on the home page lost its caption
strip and got 34% smaller, the two unlabelled tiles (Undo and Layers) now say
what they are, and the nav's hover underline is drawn at its real width instead
of being a one-pixel line stretched by the GPU — which is what made it look
smeared while it moved.


### v7.82 — 2026-08-09

**Groundwork, nothing user-visible.** The engine can now hand over everything a
save needs in one call instead of eighteen. That matters for a bug nobody has
hit yet: the save reads a photo's canvas, its history and its layers as a set,
and once the engine moves onto a background thread those reads could be
interrupted halfway by switching photos — saving the first half of one photo
and the second half of another. One call cannot be interrupted.


### v7.81 — 2026-08-09

**"Download All" stops throwing your edits away.** Edit a photo, reload the
page, pick "Resume editing" — your work is right there on the canvas, but the
ZIP shipped the untouched original instead. Every stroke, every annotation,
gone from the archive with nothing to show it. Exporting a single photo was
always correct; only the batch ZIP did this, and only after a reload, which is
why it looked random.


### v7.80 — 2026-08-09

**Groundwork, nothing user-visible.** Text layout now reads its measurements
from a cache instead of asking the engine on every render. The numbers are
identical — these particular measurements depend only on the text, size and
weight you asked about, so a cached answer can never be out of date.


### v7.79 — 2026-08-08

**Tooling only.** The engine-call audit now measures whether the
engine-in-a-worker migration has actually happened, rather than just how big it
is, and a contract test pins the number so it can only go down. Nothing in the
app changed.


### v7.78 — 2026-08-08

**Docs only.** ADR-024 claimed the export-dimension cost "scales several-fold
on a large photo" and cited a 12-megapixel benchmark. It can't: every import is
downscaled to 2048 on the long edge, so the biggest document the editor ever
holds is about 4.3 MP. The measurements were already near the ceiling. No code
changed.


### v7.77 — 2026-08-08

**Exporting stops doing work it doesn't need to.** If you'd set exports to
"Photo only", the app was compositing the whole image twice on every redraw
just to work out how big the export would be — even with the download dialog
shut. It now works that out once, when you open the dialog.

JPEG, WebP and AVIF exports also read the image from the engine now instead of
scraping it back off the canvas, and the encoding moves off the main thread
where the browser allows it.


### v7.76 — 2026-08-08

**Dragging a shape, arrow or crop box no longer redraws your photo.** The
rubber band you drag out used to be painted straight onto the image: the whole
canvas was copied on mouse-down, copied back on every mouse-move to erase the
last frame, and copied back once more on release. On a 12-megapixel photo that
is a lot of pixels moved to draw a rectangle. It now draws on its own
transparent layer, so the image underneath is never touched — and erasing the
band is a clear instead of a full-resolution copy.

Copying to the clipboard also stops rewriting the document. It was calling a
flatten on the live image first; the copy never needed it, because the
composite already draws text and shapes.

### v7.75 — 2026-08-08

**The gallery grid stops reserving space it doesn't use.** v7.74 stopped the
tiles stretching, which removed a slab of bare checkerboard under every
thumbnail. It left the row heights alone, so the slab came back as empty
background — about 117px of it per row, worst at tablet width. Both halves are
fixed now.

### v7.74 — 2026-08-08

**Emptying the gallery gets your storage back.** Delete All removed the photos
and left every original image file behind — 108.6 MiB stranded in one click, on
a real gallery. Deleting photos one at a time always cleaned up properly; only
the bulk path skipped it. Nothing was visible in the app, so the space just
went missing.

**Gallery tiles stop stretching.** In the vertical layout a short photo's tile
grew to match the tallest one in its row, leaving up to 188px of bare
checkerboard under the image. The checkerboard still shows through genuinely
transparent pixels, which is the point of it.

</details>

## License

MIT
