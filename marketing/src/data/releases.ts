// The release log — the source of truth for the Trail Log page.
//
// Hand-maintained: every release cut adds an entry at the TOP (newest first).
// The month segments, the per-month achievement cards and the release counts on
// /trail-log are all derived from this array at runtime, so they cannot drift
// out of sync with it.
//
// The commit squares beside each month come from commits.ts, which is
// GENERATED — see scripts/gen-trail-data.mjs. Do not hand-edit that one.

export type Tag = "feature" | "perf" | "fix" | "rust" | "ui" | "infra" | "mock";

export interface Entry {
  tag: Tag;
  text: string;
}

export interface Release {
  version: string;
  date: string;
  headline: string;
  entries: Entry[];
}

export const RELEASES: Release[] = [
  {
    version: "v8.7",
    date: "2026-08-11",
    headline: "The check that runs on every tool switch",
    entries: [
      {
        tag: "infra",
        text: "The two AI buttons and the layer-resize box now wait for the engine's answer — four more calls converted for the background-thread move.",
      },
      {
        tag: "fix",
        text: "Both AI buttons were then checked on a real signed-in account, with the upload step blocked so no credit was spent: each hands the model a full-size PNG of the current picture, and Remove Object opens its window with the image already loaded — which is the part that breaks first if the wait is left out.",
      },
      {
        tag: "fix",
        text: "Dropping a resize box and pressing Enter is a “commit”, and the same commit runs quietly every time you switch tools, on the understanding that it does nothing when no box is open. That “does nothing” is a check, and the check is the call converted here — left half-done it would have stopped saying no, and every tool switch would have added a step to your undo history for a box that was never there. Checked in the browser: six tool switches with nothing pending reached the engine zero times, and a real box still commits on the first Enter.",
      },
    ],
  },
  {
    version: "v8.6",
    date: "2026-08-11",
    headline: "The check that would have stopped checking",
    entries: [
      {
        tag: "infra",
        text: "The last three files with a single engine call left in them — the export dialog's size label, the eyedropper and the clone stamp — now wait for the engine's answer. All three needed the surrounding code rearranged rather than one keyword added.",
      },
      {
        tag: "fix",
        text: "The clone stamp's call is the check for whether a source point has been set yet, and that check sits inside an `if`. Converted carelessly it would have stopped rejecting anything and the stamp would have painted from wherever the engine happened to be, with nothing thrown and nothing logged. Verified in the browser both ways round: a click with no source still does nothing, and a source-then-stamp still leaves a stroke.",
      },
    ],
  },
  {
    version: "v8.5",
    date: "2026-08-11",
    headline: "Four more calls wait for the answer",
    entries: [
      {
        tag: "infra",
        text: "Copying a selection to the clipboard, both of the paths that save an edited photo, and the OCR button that pulls text out of an image now wait for the engine's answer before using it.",
      },
      {
        tag: "infra",
        text: "This batch was picked for being dull. Each of the four already sat inside code that waits for something else, so each was a single keyword. The three remaining files with one call left in them are not like that — every one needs the surrounding code rearranged first — so they are queued as their own batch instead.",
      },
    ],
  },
  {
    version: "v8.4",
    date: "2026-08-11",
    headline: "The histogram was doing a full pass every frame",
    entries: [
      {
        tag: "infra",
        text: "Copy-to-clipboard and the single-photo download now wait for the engine's answer before using it.",
      },
      {
        tag: "perf",
        text: "The fourth call in that file turned out not to be ordinary work at all: the histogram under the image is redrawn from a full pass over the whole picture \u2014 eleven million samples \u2014 and the code that asks for it runs once per animation frame until the bars settle. It is now filed with the other frame-rate work rather than queued for a change that would have made it wait for a round trip each time.",
      },
    ],
  },
  {
    version: "v8.3",
    date: "2026-08-10",
    headline: "The export paths wait for the answer",
    entries: [
      {
        tag: "infra",
        text: "Saving a photo, sharing a link and building the .zip of a whole gallery now wait for the engine's answer before using it \u2014 six more calls converted for the background-thread move.",
      },
      {
        tag: "fix",
        text: "One of them could not simply wait: the thumbnail helper checked its result for emptiness inside a hand-rolled promise, and once the thing it was checking became a promise itself, that check would have quietly stopped working. Rewritten so the check still fires. Verified against the real thing rather than only by tests \u2014 PNG, JPEG and WebP each came back as genuinely that format, and a twelve-photo .zip built correctly with an edited photo among them.",
      },
    ],
  },
  {
    version: "v8.2",
    date: "2026-08-10",
    headline: "Four calls that were on the redraw path all along",
    entries: [
      {
        tag: "infra",
        text: "Four more engine calls turned out to sit on the path that repaints the canvas \u2014 not because of anything in the functions themselves, but because the redraw reaches into two other files to call them. Their names give nothing away, and the check that finds this class of problem only ever looks at a function's own name, never at who calls it from somewhere else. Left in the ordinary queue, the next batch would have made the redraw wait for a round trip on every frame.",
      },
    ],
  },
  {
    version: "v8.1",
    date: "2026-08-10",
    headline: "A source file that no search could see",
    entries: [
      {
        tag: "fix",
        text: "One source file contained two invisible NUL characters, used as a separator inside a cache key. That is enough to make every search tool classify the file as binary and skip it silently \u2014 so searching the project for anything defined in it returned a confident zero. It surfaced by contradiction: the history said an identifier had been added and never removed, while the search said it did not exist. The characters are now written as an escape: identical behaviour, and the file is searchable again.",
      },
      {
        tag: "infra",
        text: "Also three more engine calls converted for the background-thread move \u2014 flip-horizontal, flip-vertical and copy-region now wait for the engine's answer before using it. Checked in a browser: flip both ways, then three undos, landing back on a pixel-for-pixel identical image.",
      },
    ],
  },
  {
    version: "v8.0",
    date: "2026-08-10",
    headline: "The bookkeeping, corrected the other way",
    entries: [
      {
        tag: "infra",
        text: "Yesterday's release fixed a rule that was filing live drawing code as ordinary work. This one retires that rule entirely, because it was wrong far more often in the opposite direction: of the 21 calls it alone marked as “drawing hot path”, 19 were ordinary once-per-click actions — commit, cancel, apply-crop, drop-a-pin, mouse-down, mouse-up. They had been set aside to be done last, which meant nobody was looking at them.",
      },
      {
        tag: "fix",
        text: "So the list of remaining work goes up, not down. That is the honest number, and the first one the rest of this migration can actually be planned against. Two calls really do belong on the fast path despite ordinary-sounding names, and they are now listed individually with the reason, rather than caught by a pattern that happened to match.",
      },
    ],
  },
  {
    version: "v7.99",
    date: "2026-08-10",
    headline: "A checklist that could never reach zero",
    entries: [
      {
        tag: "infra",
        text: "The checklist tracking the background-thread migration had a target it could never reach: five of the calls it was counting are ones the plan says must not be changed, because a later stage removes that code path entirely. The checklist wanted them at zero; the plan forbade touching them.",
      },
      {
        tag: "fix",
        text: "Left alone that doesn't just stall, it pushes the wrong way — sooner or later someone grinds the number down, meets those five, and “finishes the job” by changing the one piece of code that repaints the canvas on every frame. They are now named with the reason, and changing them makes the test suite fail loudly instead of looking like progress.",
      },
    ],
  },
  {
    version: "v7.98",
    date: "2026-08-10",
    headline: "Undo waits for the answer before it repaints",
    entries: [
      {
        tag: "infra",
        text: "Undo, redo, jump-to-step and delete-step now wait for the engine's answer before repainting. Four of the five were the same shape — “if the engine says it undid something, repaint” — and once the engine answers from a background thread that question stops being answerable on the spot. Left alone, every Ctrl+Z would have repainted and re-synced whether or not anything was actually undone.",
      },
      {
        tag: "fix",
        text: "Checked in a browser rather than only by tests, because a broken undo button is not something a type checker can see. Undo and redo work from both the toolbar and the keyboard, and pressing Ctrl+Z with nothing left to undo correctly does nothing at all.",
      },
    ],
  },
  {
    version: "v7.97",
    date: "2026-08-10",
    headline: "Correcting the instrument, not the app",
    entries: [
      {
        tag: "infra",
        text: "The tool that decides which engine calls sit on a drawing hot path had six of them filed as ordinary work — including the blur brush's drag, the eyedropper's magnifier and the text tool's hover highlight. The next batch of background-thread work would have made those wait for a round trip on every mouse movement, which is a dropped frame in exactly the places you would notice one. Nothing in the app changed; the list it was working from did.",
      },
      {
        tag: "fix",
        text: "The old check looked for keywords in the six lines around a call, which meant it could not see which handler the call was inside. It had split a single mouse-move handler across two categories — twice — and in one case the only thing marking a line as hot was the word “preview” appearing inside a nearby variable name. It now reads the enclosing function's name instead.",
      },
    ],
  },
  {
    version: "v7.96",
    date: "2026-08-10",
    headline: "The editor stopped answering a question nobody asked",
    entries: [
      {
        tag: "perf",
        text: "Every time the editor refreshed itself — after a brush stroke, an undo, a layer change — it rebuilt the entire image from scratch and checked every single pixel, to work out whether the picture had any transparency in it. On a 1385x2068 photo that was about 30 ms, and it was the whole cost of the refresh: the other ten things it collects took no measurable time at all. Nothing was using the answer. The canvas checkerboard used to ask and stopped in June when it became always-on; the question kept being asked anyway. Refreshing now costs nothing measurable.",
      },
      {
        tag: "rust",
        text: "The engine can still answer the question — it was taken off the path that runs after every edit, not deleted. If something needs it cheaply one day, that is the point to design it properly, with a real user of the answer to say what correct means.",
      },
    ],
  },
  {
    version: "v7.95",
    date: "2026-08-10",
    headline: "Saving a layered project describes one document, not several",
    entries: [
      {
        tag: "rust",
        text: "Exporting a layered .ora project asked the engine for the canvas size and the layer list as four separate questions, and the routine that flattens each layer first asked three more. Both sets describe one document and get written into one file, so once the engine moves to a background thread, a resize arriving mid-question could put a canvas size from before it next to a layer list from after — a broken .ora saved to disk with no error at the time. Each set is one question now.",
      },
      {
        tag: "perf",
        text: "The new engine call deliberately does not reuse the one the editor already had, which would have needed no new code: that one works out whether the image has transparency by rebuilding the entire picture and checking every pixel. Fine when the editor needs it, pure waste for a caller that wants a canvas size and a list of layer names.",
      },
    ],
  },
  {
    version: "v7.94",
    date: "2026-08-10",
    headline: "One question instead of two, where the gap would have mattered",
    entries: [
      {
        tag: "rust",
        text: "Clicking a pen path to re-edit it used to ask the engine two questions: which path is under this point, then give me every path so I can look that one up. Two questions with a gap between them. The gap is empty today; once the engine moves to a background thread it stops being, and a path deleted in that gap would make the click do nothing at all — no error, no message, just a click that does not work. It is one question now, and the engine keeps the rule the app used to apply itself: a rectangle drawn over a pen path still means “no pen path here” rather than reaching through it.",
      },
      {
        tag: "infra",
        text: "A second place that looked like exactly the same problem turned out not to be, and was deliberately left alone: clicking a text annotation commits whatever you were typing in between its two reads, so the gap there is intentional rather than accidental. Converting it would have changed what happens when you empty a text box and click where it was.",
      },
    ],
  },
  {
    version: "v7.93",
    date: "2026-08-10",
    headline: "The one number the background-thread plan assumed, measured",
    entries: [
      {
        tag: "perf",
        text: "The plan to move the engine onto a background thread rested on a number nobody had measured: what it costs to get finished pixels onto the screen from over there. It is 22 ms on a 3.1 megapixel photo, against 23 ms for the main thread doing the same work — no penalty, so the reason for picking this approach over the alternative holds up. Getting the number needed a real engine running inside a background thread that owns the canvas; two earlier experiments had each done one half of that and never both at once.",
      },
      {
        tag: "infra",
        text: "Two more things fell out of the run. The first operation after switching costs about 1.8x the ones after it, so the switch has to warm the thread up before handing it work. And the old thread has to be shut down rather than left idle, because the memory it holds is never given back. Nothing changes for you — the mode is still off.",
      },
    ],
  },
  {
    version: "v7.92",
    date: "2026-08-09",
    headline: "An off switch that works while you are using it",
    entries: [
      {
        tag: "infra",
        text: "More groundwork for moving the engine onto a background thread. The switch that turns that mode off now takes effect mid-session instead of only on reload: it swaps in a fresh drawing surface rather than trying to reclaim one it can no longer draw to. Nothing changes for you \u2014 the mode is still off.",
      },
    ],
  },
  {
    version: "v7.91",
    date: "2026-08-09",
    headline: "Knowing which canvas is the real one",
    entries: [
      {
        tag: "infra",
        text: "Groundwork for moving the engine onto a background thread. The app now tracks which drawing surface is live and gives each one a number, so a later change can refuse work aimed at a surface that has already been replaced. It matters because switching in and out of Batch replaces the canvas underneath \u2014 and a background thread that kept painting into the old one would show a blank screen with no error at all.",
      },
    ],
  },
  {
    version: "v7.90",
    date: "2026-08-09",
    headline: "One question, one answer",
    entries: [
      {
        tag: "perf",
        text: "Creating a share link with \u201cPhoto only\u201d set was building the whole image twice to work out two numbers. It builds it once now, and skips a step it never needed \u2014 40 ms down to 17 ms on a 1385\u00d72068 photo.",
      },
      {
        tag: "infra",
        text: "The eleven values the editor reads to redraw itself \u2014 size, zoom, layers, undo history, export quality \u2014 now come back in a single call instead of eleven, so they can never describe two different moments. More groundwork for moving the engine onto a background thread.",
      },
    ],
  },
  {
    version: "v7.89",
    date: "2026-08-09",
    headline: "Cover for the Download All fix",
    entries: [
      {
        tag: "infra",
        text: "The v7.81 fix \u2014 Download All shipping your original files instead of your edits \u2014 now has a regression test. That bug only appeared after a page reload, which is why it lasted two months and why the fix went out without one. Nothing changes for you; the fix is simply harder to lose now.",
      },
    ],
  },
  {
    version: "v7.88",
    date: "2026-08-09",
    headline: "Photo-only exports stop doing the work three times",
    entries: [
      {
        tag: "perf",
        text: "Exporting with the canvas background left out was rebuilding the whole image three times to answer one question \u2014 once for the pixels, once for the width, once for the height. It does it once now: 69 ms down to 20 ms on a 1385\u00d72068 photo, with the same bytes coming out. Copying to the clipboard, saving a single photo and batch export all took the slow path.",
      },
      {
        tag: "infra",
        text: "Nine places that read an image and the dimensions describing it now read both in one call, so nothing can change in between. More of the groundwork for moving the engine onto a background thread.",
      },
    ],
  },
  {
    version: "v7.87",
    date: "2026-08-09",
    headline: "Notes for the next hands on the migration",
    entries: [
      {
        tag: "infra",
        text: "The background-thread migration's design record now lists which files have been checked and what turned up, so the next session starts from findings rather than re-deriving them. Two more places were caught where several reads have to describe the same moment. Documentation only.",
      },
    ],
  },
  {
    version: "v7.86",
    date: "2026-08-09",
    headline: "A mis-filed hot path in the migration tracker",
    entries: [
      {
        tag: "infra",
        text: "The tool tracking the background-thread migration was treating the lasso's live preview as ordinary work. It recomputes on every mouse move, where waiting on a background thread would cost a frame, so it belongs with the cases handled last and separately. Nothing in the app changed.",
      },
    ],
  },
  {
    version: "v7.85",
    date: "2026-08-09",
    headline: "Layer operations get ready for the background thread",
    entries: [
      {
        tag: "infra",
        text: "Add, remove, rename, reorder, merge, show and hide, opacity and masks are all ready for an engine that answers over a message queue instead of instantly. Behaviour is unchanged — every one of them was driven and the layer stack checked afterwards.",
      },
    ],
  },
  {
    version: "v7.84",
    date: "2026-08-09",
    headline: "Saving a photo now happens in one read, not eighteen",
    entries: [
      {
        tag: "rust",
        text: "Saving used to ask the engine eighteen separate questions about your photo — its canvas, its history, its layers. It now asks once. The bytes on disk are identical, verified through a save, reload and restore, but the read can no longer be interrupted halfway, which is what would have let switching photos mid-save mix one photo's canvas with another's history once the engine moves to a background thread.",
      },
    ],
  },
  {
    version: "v7.83",
    date: "2026-08-09",
    headline: "A tidier button set and a sharper nav underline",
    entries: [
      {
        tag: "ui",
        text: "The button-set image on the home page dropped its caption strip and got 34% smaller, and the two tiles that had no name — Undo and Layers — now say what they are.",
      },
      {
        tag: "fix",
        text: "The underline that follows your cursor across the nav looked smeared while it moved. It was a one-pixel line stretched by the graphics card; it is now drawn at its real width, so every frame is sharp.",
      },
    ],
  },
  {
    version: "v7.82",
    date: "2026-08-09",
    headline: "The engine can hand over a whole save in one go",
    entries: [
      {
        tag: "rust",
        text: "Saving a photo reads its canvas, its history and its layers as a set. The engine can now hand all of that over in a single call instead of eighteen — so once the engine moves onto a background thread, switching photos mid-save can't mix half of one photo with half of another. Nothing uses it yet; nothing visible changes.",
      },
    ],
  },
  {
    version: "v7.81",
    date: "2026-08-09",
    headline: "Download All stops throwing your edits away",
    entries: [
      {
        tag: "fix",
        text: "Edit a photo, reload the page, pick \"Resume editing\" — your work is there on the canvas, but downloading everything as a ZIP shipped the untouched originals instead. Every stroke and annotation, missing from the archive with nothing to show it. Downloading a single photo was always correct, and the ZIP only did this after a reload, which is why it looked random.",
      },
    ],
  },
  {
    version: "v7.80",
    date: "2026-08-09",
    headline: "Text layout stops re-asking the engine the same question",
    entries: [
      {
        tag: "perf",
        text: "Measuring where text sits used to go to the engine on every redraw. Those measurements depend only on the words, the size and the weight — nothing else — so the answer is now remembered and reused. Identical results, less work, and one more piece of groundwork for moving the engine off the main thread.",
      },
    ],
  },
  {
    version: "v7.79",
    date: "2026-08-08",
    headline: "Groundwork for moving the engine off the main thread",
    entries: [
      {
        tag: "infra",
        text: "The tool that tracks the engine-in-a-worker migration now measures how much of it has actually been done, not just how big it is — and a test pins that number so it can only go down. Nothing in the app changed.",
      },
    ],
  },
  {
    version: "v7.78",
    date: "2026-08-08",
    headline: "A correction to the last release's own notes",
    entries: [
      {
        tag: "infra",
        text: "The v7.77 write-up said the export slowdown got several times worse on large photos. It doesn't — every image is scaled to 2048px on its long edge when it opens, so the editor never holds a photo big enough for that to be true. Documentation only; nothing in the app changed.",
      },
    ],
  },
  {
    version: "v7.77",
    date: "2026-08-08",
    headline: "Exporting stops doing work it doesn't need to",
    entries: [
      {
        tag: "perf",
        text: "With exports set to \"Photo only\", the app was compositing the whole image twice on every redraw just to work out how big the export would be — even with the download dialog shut. It now works that out once, when you open the dialog.",
      },
      {
        tag: "perf",
        text: "JPEG, WebP and AVIF exports read the image from the engine instead of scraping it back off the canvas, and the encoding moves off the main thread where the browser allows it.",
      },
    ],
  },
  {
    version: "v7.76",
    date: "2026-08-08",
    headline: "Dragging a shape no longer redraws your photo",
    entries: [
      {
        tag: "perf",
        text: "The rubber band you drag out for a shape, arrow or crop box used to be painted onto the image itself — the whole canvas copied on mouse-down, copied back on every mouse-move to erase the last frame, and copied back again on release. On a 12-megapixel photo that is a lot of pixels moved to draw a rectangle. It now draws on its own transparent layer and the image underneath is never touched.",
      },
      {
        tag: "fix",
        text: "Copying to the clipboard stops rewriting the document. It was flattening the live image first; the copy never needed it, because text and shapes are already drawn into what gets copied.",
      },
    ],
  },
  {
    version: "v7.75",
    date: "2026-08-08",
    headline: "The gallery grid stops reserving space it doesn't use",
    entries: [
      {
        tag: "ui",
        text: "v7.74 stopped the gallery tiles stretching, which cleared a slab of bare checkerboard under every thumbnail. The row heights were untouched, so the slab came back as empty background — about 117px per row, worst at tablet width. Both halves are fixed.",
      },
      {
        tag: "infra",
        text: "The parking lot — the running list of known-but-deferred problems — is now part of the repo instead of one machine's disk.",
      },
    ],
  },
  {
    version: "v7.74",
    date: "2026-08-08",
    headline: "Emptying the gallery gets your storage back",
    entries: [
      {
        tag: "fix",
        text: "Delete All removed the photos and left every original file behind — 108.6 MiB stranded in one click. Deleting photos one at a time was always correct; only the bulk path skipped the cleanup.",
      },
      {
        tag: "ui",
        text: "Gallery tiles stopped stretching to fill their row. A short photo could sit above 188px of bare checkerboard. It still shows through genuinely transparent pixels, which is what it is for.",
      },
      {
        tag: "rust",
        text: "Two decisions moved out of JavaScript and into the engine: flattening text and shapes now reports whether it did anything, and a whole-image blur works out its own geometry.",
      },
      {
        tag: "infra",
        text: "Groundwork for running the image engine off the main thread — the message protocol, the queue that keeps edits in order, and a test that fails if anything reaches the engine outside it. Off by default, nothing user-visible yet.",
      },
    ],
  },
  {
    version: "v7.73",
    date: "2026-08-07",
    headline: "Downloading a whole gallery respects the setting the rest of the app already did",
    entries: [
      { tag: "fix", text: "Settings has a switch for whether the backing canvas is baked into what you export. Share, Copy and the single Download all obeyed it. Downloading the whole gallery as a zip did not, so a batch export always carried the padded border." },
      { tag: "fix", text: "It could not have obeyed it, either. The zip rebuilt each photo from a flattened image with no layers — and with no layers there is no canvas to leave out. It restores the real layer stack now." },
      { tag: "infra", text: "That restore is one piece of code shared with the editor rather than a second copy of it. The last time this codebase kept two copies of a save routine, they drifted, and the cloud one quietly stopped saving drop shadows." },
    ],
  },
  {
    version: "v7.72",
    date: "2026-08-06",
    headline: "The gallery shows transparency on every thumbnail, not just the PNGs",
    entries: [
      { tag: "fix", text: "The checkerboard behind a gallery thumbnail was switched on by the format of the file you opened. PNG got it, JPEG never did — which had nothing to do with the picture, because every thumbnail is re-encoded to WebP on import. A photo that picked up transparency from the canvas or the eraser showed none of it." },
      { tag: "ui", text: "It is unconditional now. Nothing is needed to hide it either: the image paints over the checkerboard, so a thumbnail that fills its tile covers it completely and only the letterbox bars of a portrait or landscape shot show through." },
    ],
  },
  {
    version: "v7.71",
    date: "2026-08-06",
    headline: "The architecture page stops claiming something the app cannot do",
    entries: [
      { tag: "fix", text: "The system map described the browser as \"fully functional offline\". It is not — there is no service worker in a shipped build, so opening the app with no connection fails. It now says what is actually true: no server in the edit path." },
      { tag: "fix", text: "The architecture doc made the same claim about the engine. Working without an account is true; working with no network from cold was not." },
    ],
  },
  {
    version: "v7.70",
    date: "2026-08-06",
    headline: "The homepage shows the buttons, not a screenshot you cannot read",
    entries: [
      { tag: "ui", text: "New image on the homepage: nine of the app's controls, each one rendered from the app's own stylesheet rather than redrawn. It replaces a screenshot of the command palette that was unreadable at the size it actually displayed." },
      { tag: "ui", text: "The closing section is two columns now — the no-wifi mark on the left, everything you can read or click on the right." },
      { tag: "ui", text: "A line about what the network is actually for: once the app has loaded, dropping your connection mid-edit stops nothing, because none of the work was leaving your machine." },
      { tag: "fix", text: "A stray gap above that paragraph. The headline was stretching to 488px tall for a single line of text — a leftover flex rule from when the section was laid out sideways." },
      { tag: "ui", text: "Clone Stamp's icon was a pair of sheets, which says duplicate rather than clone from a point. It takes the stamp mark now, and the red marker presets take a badge — matching what the feature list on the site already showed." },
    ],
  },
  {
    version: "v7.69",
    date: "2026-08-06",
    headline: "Export names the file after what is in it",
    entries: [
      { tag: "fix", text: "Exporting as AVIF wrote a PNG and called it .avif. Chrome cannot encode AVIF and the browser substitutes PNG without saying so — no error, no warning — so the file you got did not match its own name. The name now comes from the bytes." },
      { tag: "fix", text: "The format picker said the file would be saved as PNG while the performance figures beside it still promised AVIF's savings. Both numbers now describe the format that actually lands." },
      { tag: "fix", text: "The download dialog is a second format picker, and it was still advertising AVIF as \"Smallest, modern\" with a button that handed over a PNG." },
      { tag: "ui", text: "Picking PNG now says it is lossless and will be larger than the source, rather than leaving you to discover that on disk. For an app about compression, a silent surprise was the wrong default." },
      { tag: "fix", text: "Resize Layer opened its box flush against the edge of the picture, so every handle sat on the border and nothing appeared to happen when you clicked it. The tool always worked; it just gave you nothing to grab. It opens inset now." },
      { tag: "ui", text: "On a large display the site pinned everything to the left edge with a wide empty strip down the right. The content column is centred, on every page rather than just the homepage." },
      { tag: "ui", text: "New screenshot on the homepage and the README. The old one was taken in June and still showed a menu two revisions out of date — the site was advertising an app that no longer existed." },
      { tag: "infra", text: "The contribution squares counted whichever branch the generator happened to run in, so work could show up before it shipped or vanish until it merged. It reads the merged history now, and says so when it is running ahead of it." },
    ],
  },
  {
    version: "v7.68",
    date: "2026-08-06",
    headline: "Every edit shows up as an edit",
    entries: [
      { tag: "fix", text: "Adding text, dragging a slider, or selecting the whole photo all changed it — and the gallery still showed it as untouched. The dot and the save had drifted apart, so the app could write a photo to disk while telling you nothing had happened to it. They ask the same question now." },
      { tag: "fix", text: "Changing export quality recorded an undo step that put nothing back: the pixels were identical, so undo consumed the step and left the slider where it was. Quality now travels with the step, and it is undoable whether or not you press Apply." },
      { tag: "fix", text: "While you are drawing a pen path, Ctrl+Z takes back one point instead of deleting the whole path. It used to reach past the path you were drawing and undo the last one you finished." },
      { tag: "fix", text: "A photo that fails to reach the cloud no longer leaves anything behind. The upload happened before the record that points at it, so any failure in between stranded a file that nothing would ever reference and nothing would ever clean up. It is collected the moment it happens now." },
      { tag: "perf", text: "An upload that gets rate-limited is retried rather than dropped. Your edits are always written to this browser first, so nothing was ever at risk — but the copy in the cloud could quietly fall behind." },
      { tag: "rust", text: "Export quality moved into the engine so it can ride the undo history properly. The engine grew by 625 bytes and is pinned by 207 tests." },
    ],
  },
  {
    version: "v7.67",
    date: "2026-08-05",
    headline: "Photos no longer overwrite each other's edits",
    entries: [
      { tag: "fix", text: "Switching away from a photo saved whatever was on the canvas at that moment, without checking the canvas still held that photo. If a switch stalled partway, the next one wrote the old photo's picture into a different photo's saved edits. Four photos ended up holding the same painted canvas, and three of them had never been touched. Saving now refuses when the canvas is holding someone else." },
      { tag: "fix", text: "It refuses only when it is certain. If it cannot tell which photo the canvas is holding, it saves anyway — a refused save loses work you actually did, and that is worse than the problem it prevents." },
      { tag: "perf", text: "Switching photos no longer waits for the upload. It used to sit through the whole round trip, about thirteen seconds on a slow connection, and that wait is what made switches stall to begin with. Your edits go to this browser first and the upload follows on its own time." },
      { tag: "perf", text: "Photos that have not changed are no longer re-uploaded, and there is now a ceiling on how often the app can upload at all, so a future bug cannot run away with it. One brush stroke used to cost twenty-eight uploads. It now costs five." },
      { tag: "infra", text: "Reproduced under test fixtures before it was fixed, then the same tests inverted to pin the fix. Measured again in a real browser afterwards: nineteen photo switches, not one landing on another photo's edits, and none stalling." },
    ],
  },
  {
    version: "v7.66",
    date: "2026-08-05",
    headline: "Deleting a photo actually frees its space",
    entries: [
      { tag: "fix", text: "Removing a photo used to delete its edit history and take it off the screen — and quietly keep its full-size original in your browser's storage, forever. Up to two copies per deleted photo, and originals are the biggest thing the app stores. They are now cleaned up the moment you delete." },
      { tag: "fix", text: "Carefully, though. Duplicates share their bytes with the photo they were copied from, so the cleanup first checks that nothing else still needs them. Deleting a copy never touches the photo it came from. When in doubt, it keeps — extra bytes are recoverable, a deleted photo is not." },
      { tag: "fix", text: "If storage cleanup fails for any reason, the delete still succeeds and the leftover bytes wait for next time. A full disk never turns into a broken gallery." },
      { tag: "infra", text: "The leak was reproduced under test fixtures before it was fixed, and the fix is pinned by twelve tests — including the one where two photos share bytes and one of them is deleted." },
    ],
  },
  {
    version: "v7.65",
    date: "2026-08-04",
    headline: "The Paste button tells you when it can't paste",
    entries: [
      { tag: "fix", text: "Clicking \"Paste (Ctrl+V)\" on the start screen could do nothing at all, with no message, in three different situations: the browser blocked the clipboard, there was no image on the clipboard, or the read never came back because the window was not focused. All three now say what happened." },
      { tag: "fix", text: "The third one is why this went unnoticed for so long. The read never failed — it just never finished, so there was nothing to report and nothing even to log. It now gives up after four seconds and tells you." },
      { tag: "ui", text: "Every message points at Ctrl+V, which takes a different route to your clipboard and still works when the button cannot." },
    ],
  },
  {
    version: "v7.64",
    date: "2026-08-04",
    headline: "Recolouring a shape works from the panel it actually shows",
    entries: [
      { tag: "fix", text: "The last release made a placed shape recolourable, but only if the colour you clicked was different from the one the panel happened to be showing. Click a shape you drew in orange while the panel still reads purple from earlier, click purple because purple is what you want, and nothing happened — the panel had not changed, so the app thought you had not asked for anything." },
      { tag: "ui", text: "The panel now loads the shape's own settings when you click it, so it shows you what the selected shape is instead of whatever you last used. A click on any colour is a real change." },
      { tag: "fix", text: "Changing only the stroke width no longer quietly drags an old panel colour along with it." },
      { tag: "fix", text: "Stroke width, the arrow style and the fill controls were stuck for the same reason and are fixed alongside the colour. Reselect a pin and recolour it and it stays a pin, instead of turning into a plain circle." },
      { tag: "ui", text: "A run of changes to one shape is a single undo step, not one per click — pick a colour, nudge the width, change the fill, and Ctrl+Z takes all of it back at once." },
      { tag: "infra", text: "Two regression tests named for the symptom that was reported, so this exact case cannot come back quietly." },
    ],
  },
  {
    version: "v7.63",
    date: "2026-08-04",
    headline: "Change the colour of a shape you already placed",
    entries: [
      { tag: "fix", text: "Click a square or a circle you drew earlier, pick a different colour, and it changes. Until now it did nothing at all — the shape kept whatever colour it was drawn with, and the only way to change your mind was to delete it and draw it again. The bug was seven weeks old." },
      { tag: "fix", text: "Stroke width, the arrow style and the fill controls were stuck in exactly the same way, for exactly the same reason, and they are fixed with it." },
      { tag: "fix", text: "The parts you would check next were checked rather than assumed. Recolouring is one undo step, so Ctrl+Z puts the old colour back. The new colour survives closing the picture and opening it again. And it is the new colour that comes out in the file you export, not just the one on screen." },
      { tag: "ui", text: "Dialogs keep the keyboard inside them. With a dialog open, Tab used to walk straight out of it and carry on through the page behind, and closing one left you back at the top of the page instead of on the button you opened it from. Every dialog now holds the keyboard while it is open and hands it back where you left it." },
      { tag: "ui", text: "Screen readers are told the rest of the app is inactive while a dialog is up, which they were not before. That covers every dialog at once — the delete confirmations, Settings, the shortcut list and the update prompt all share one piece of code, and the fix went there." },
      { tag: "infra", text: "Seventeen new tests, and both fixes were measured in a real browser rather than reasoned about — including a control run against the old code to confirm the keyboard really did escape before, and really does not now." },
    ],
  },
  {
    version: "v7.62",
    date: "2026-08-01",
    headline: "Shapes and text stay where you put them when you resize",
    entries: [
      { tag: "fix", text: "Add a shape or some text, then resize the picture, and they used to slide off to one side. They were never moving — the picture was moving out from under them. Shapes, text, pen paths and their outlines now shrink and grow with the picture, so they stay exactly where you put them." },
      { tag: "fix", text: "Text scales with the picture too, instead of staying the same size and swallowing a photo you have just made smaller." },
      { tag: "fix", text: "A layer mask used to stop working altogether after a resize. The mask is stored at the picture's size, and resizing left it at the old one, at which point the app quietly ignored it and the layer went back to fully visible. Same cause as the first one, found while fixing it." },
      { tag: "fix", text: "Cropping had the same blind spot in a different place. It moved things to the right position but never told the screen to redraw them, so they looked wrong until you undid something or switched tools. Crop, resize, canvas size and the canvas border all say so now." },
      { tag: "infra", text: "Nine tests pin it down, including the exact case that was reported: a shape centred on a picture is still centred after the picture is halved." },
    ],
  },
  {
    version: "v7.61",
    date: "2026-07-31",
    headline: "Name a whole gallery from what's in the pictures",
    entries: [
      { tag: "feature", text: "Batch has a fourth tool: AI Rename. It reads every loaded photo and names it from what it sees — the dominant colour, whether it is bright or dark, whether it is a photograph, a graphic or a screenshot, and a rough read on the subject. Scan once, then edit the naming pattern and the whole list re-previews as you type. It runs on your own machine, so it works signed out and costs nothing per picture." },
      { tag: "feature", text: "It describes a picture rather than recognising what is in it. You get dark-blue-portrait, not golden-retriever. That is a real limit, and the panel says so instead of pretending otherwise." },
      { tag: "ui", text: "Drop or paste a stack of images and they go straight to the gallery. The three-way \"where should this go\" question only makes sense for a single picture, so now it only shows up for a single picture." },
      { tag: "fix", text: "Dropping several images at once used to keep the first one and throw the rest away — no message, nothing to tell you they had gone. Pasting several did the same. Both now take every image you hand them, as many as your plan has room for, and say so when the batch had to be trimmed." },
      { tag: "rust", text: "The reading is done in the engine rather than the browser. It samples a fixed grid whatever the picture's size, so a 24-megapixel photo costs the same to look at as a thumbnail." },
      { tag: "fix", text: "Two colours came out wrong and the tests caught it before release: pure blue was being called \"sky\" and green foliage \"lime\", because the colour wheel was labelled one notch off." },
      { tag: "infra", text: "Thirty-three new tests cover the naming, including the case that matters most — twenty photos that honestly describe the same still have to end up with twenty different filenames." },
    ],
  },
  {
    version: "v7.60",
    date: "2026-07-30",
    headline: "Edits made just before switching photos could be lost",
    entries: [
      { tag: "fix", text: "Your drawing is saved on a short delay, and if you switched photos while one of those saves was still writing, the next save was dropped instead of queued — silently, with nothing left to retry it. The strokes since the last completed save never reached disk. Saves now queue behind each other, so switching photos waits for the write instead of racing it." },
      { tag: "fix", text: "That was worse than it sounds: when reopening a photo the app trusts that record over its other copy, so it would hand back an older version that looked perfectly intact. Nothing about the saved format changed — only whether the save runs." },
      { tag: "infra", text: "Reproduced under test fixtures before being fixed: four tests that failed first, and the twenty-three existing save-and-restore tests still pass untouched." },
      { tag: "infra", text: "Four architecture decision records written for calls already made — how the toolbar is organised, how the focus ring works, how non-React code talks to the UI, and how shared image data is cleaned up. They record decisions rather than making them." },
      { tag: "infra", text: "Audited all fifteen documentation pages. Four were saying things that are no longer true — the keyboard-shortcut table still listed the old tool keys, and the file-format page still called a shipped feature a plan — and the security page was missing its most urgent open item. Nothing was deleted; everything listed still earns its place." },
      { tag: "infra", text: "Chased down whether the paid-tier mix-up had a billing record tangled in it. It does not: nobody has ever subscribed, so there is nothing attached to the wrong account and nothing to migrate. Read-only investigation — no account, subscription or backend setting was touched." },
      { tag: "infra", text: "A structural health report on ten releases of drift, measured rather than guessed. The good news: a big refactor from ten releases ago held, and the file it produced is exactly the size it was left at. The less good news: the file it was split out of grew anyway while being actively dismantled, and a second oversized file has been quietly getting bigger. Nothing was changed off the back of it — the numbers are the point." },
      { tag: "fix", text: "Four smaller ways storage could quietly stop working, all closed. A single failed connection to browser storage used to be remembered for the rest of the session, so one bad moment wedged that store until you reloaded. Browsers also close idle connections on their own and the app kept using the closed one, after which every save failed. A failed upload was read as if it had succeeded. And an unreadable cloud archive was treated as an old-format image, hiding the real problem behind a confusing one." },
      { tag: "fix", text: "Drop shadows on text vanished when a photo came back from the cloud. Saving locally and saving to the cloud each had their own copy of the same list of things to keep, and the cloud copy was missing all nine shadow settings — so the same photo kept its shadows on the machine you drew it on and came back flat anywhere else. There is one copy of that list now, and a test that fails if the two ever disagree again." },
      { tag: "ui", text: "The keyboard shortcuts list is a real dialog now. Escape closes it — it used to ignore the key entirely. Tab cycles inside it instead of wandering off into the page behind it, and when it closes you land back on whatever you were on before you opened it. Screen readers are told it is a dialog and read its title. Alt+/ still opens and closes it, and the × and clicking outside still work." },
      { tag: "infra", text: "It got there by being rebuilt on the same dialog the delete confirmations use, rather than by bolting accessibility onto a one-off overlay — one less thing that can drift. Everything it lists is unchanged, and still generated from the tool list rather than typed out." },
      { tag: "infra", text: "Three tools were each carrying their own copy of the same canvas maths. The duplicate-code report called it the biggest repeated block in the project at eighty-nine lines; reading it, twelve were actually identical and the rest only looked alike. The twelve are now written once, the block is gone from the report, and the parts that merely resembled each other were left alone — three honest copies beat one function with a switch for every difference." },
    ],
  },
  {
    version: "v7.59",
    date: "2026-07-29",
    headline: "Compressing one photo could delete another photo's original",
    entries: [
      { tag: "fix", text: "Originals are stored once and shared — that is what makes duplicating a photo instant, since the copy points at the same bytes. But the cleanup that ran after compressing only checked whether that photo still needed the old bytes, never whether anything else did. Compress a photo, duplicate it, compress the duplicate, and the first photo's original was deleted out from under it while it still pointed there. There is no backup to fall back on." },
      { tag: "fix", text: "Cleanup now asks whether anything at all still needs the bytes, and keeps them if anything does. It leans toward keeping: leftover bytes are something we can measure and clean up later, while a deleted photo is gone." },
      { tag: "infra", text: "Reproduced under test fixtures before it was fixed, including a test that performs the old delete on purpose — so the reproduction is known to be real rather than a story about the code." },
      { tag: "infra", text: "The July shipping popper (Ctrl+\\) had drifted two releases behind its own changelog — it was still counting through v7.57. Its numbers are counted from this trail log rather than typed in, so they are caught up, and the two that were hard-coded in the markup now read from the same place as the rest." },
      { tag: "ui", text: "Your export format and quality stick now. They were held in component state, so every reload quietly put them back to JPEG at 75 — a choice you had to re-make every visit. They live with the rest of the remembered preferences now." },
      { tag: "fix", text: "Signing in on the live site works again: the backend now trusts both sign-in providers, which is what was refusing share links. A paid account still reads as free there, and that turned out not to be an auth problem at all — signing in through two different providers creates two separate accounts on the backend, and the live site signs you into the one without the subscription. Diagnosed and written up; the fix is a decision about which provider to keep." },
      { tag: "fix", text: "A future update can no longer wedge the app on an old tab. Browsers refuse to upgrade a database while an older tab still has it open, and nothing was listening for that — so the next schema change would have left the new tab waiting forever, with every save waiting behind it. Old tabs now step aside when an upgrade arrives, and if something still holds on, it says so instead of hanging in silence." },
    ],
  },
  {
    version: "v7.58",
    date: "2026-07-28",
    headline: "The ring stops lying about which tool is live",
    entries: [
      { tag: "ui", text: "Two tiles could claim to be the current tool. Click a tool with the mouse, then switch with a keyboard shortcut, and the one you left kept a ring while the new one grew one too — because the keyboard-focus ring was the same warm accent, at the same width, as \"this is selected\". Focus is now neutral ink and dashed: it reads as the keyboard being somewhere, not as the live tool." },
      { tag: "ui", text: "In the gallery the two states were painting identical CSS, so a keyboard-focused thumbnail and a multi-selected one could not be told apart at all. Selection now also marks its own edge, so it stays visible when the keyboard lands on it." },
      { tag: "fix", text: "The fix was not to remove the ring. That ring is what makes the app usable without a mouse, and it got easier to see rather than harder — the contrast of the focus outline went from 2.67:1 to 14.3:1 on the light theme." },
      { tag: "fix", text: "The status bar was naming a key that did nothing. On Adjustments it said \"8\", on Shapes \"7\", on Batch \"0\" — digits left over from before the toolbar became five groups, bound to nothing. On Crop it said \"2\", which was worse: 2 is Select, so the hint meant to tell you where your tool lives took you out of it." },
      { tag: "ui", text: "It also named the group instead of the tool, so Resize called itself \"compress\" and Pen called itself \"brush\". The bar now reads both the key and the name off the toolbar itself, which is how the Select tools got their hint back too." },
      { tag: "feature", text: "A new version asks before it takes over: \"Update to the latest version?\" — Yes or No, in the same kind of dialog as \"Delete this image?\", instead of a toast in the corner with a Reload link. It says what Yes does, too: the tab reloads, and your photos and edits stay where they are. No means no, and the offer comes back later rather than never." },
      { tag: "ui", text: "The confirm buttons say what they are. \"Delete image\" was red text on a red tint, which measured 3.99:1 — under what small text needs to be readable. It is a white label on solid red now, and the update dialog's Yes is white on deep warm brown." },
      { tag: "infra", text: "There is now a number for how much dead weight sits in browser storage. A read-only audit walks every local store and reports what a cleanup pass would find, deleting nothing: on a real twelve-photo gallery, nothing was stranded. It also confirmed two suspected leaks — Auto Compress, and deleting a photo — and found a worse one pointing the other way, where tidying up after a duplicated photo can remove bytes the original still needs. Written up rather than patched at three in the morning." },
    ],
  },
  {
    version: "v7.57",
    date: "2026-07-27",
    headline: "One tab at a time, and a save that can't wedge the gallery",
    entries: [
      { tag: "fix", text: "Changing photos could stop working entirely, until you deleted the photo you were on. Saving an edited photo to the cloud waits on the server, and a Convex request that never answers — neither succeeding nor failing — left that wait running forever with the gallery behind it. Every cloud step now gives up after eight seconds." },
      { tag: "fix", text: "Nothing was lost when that happened, and nothing is lost now: your edit is written to the browser's own storage before the upload is even attempted. Giving up on the upload costs freshness, not work." },
      { tag: "feature", text: "Image Horse open in two tabs now asks which one you mean, the way Google Messages does. The others park behind a \"Use here\" button instead of quietly writing over each other — every tab shares one local database, so two at once could overwrite work with no warning." },
      { tag: "ui", text: "Clicking a photo says so immediately. Saving an edited photo can take a few seconds, and for that whole time nothing moved — no highlight, no progress — which read as a broken gallery rather than a busy one." },
    ],
  },
  {
    version: "v7.56",
    date: "2026-07-27",
    headline: "Signed in, and told to sign in",
    entries: [
      { tag: "fix", text: "Share links told signed-in people to sign in. The live site signs you in with one Clerk instance and asks a Convex backend that only trusted a different one, so the token was refused every time — while Clerk went on reporting you as signed in. Both instances are trusted now." },
      { tag: "fix", text: "The button no longer guesses. \"Sign in to create share links\" was shown for three different situations, including to people already signed in; it now tells them apart — still connecting, actually signed out, or signed in but refused by the backend." },
      { tag: "infra", text: "The same silence covered every account-backed feature, not just sharing: cloud edit persistence, preference sync, recent texts, and the user record the paid tier is read from. Whether paid accounts are being served free limits on the live site is written up as the first thing to check." },
    ],
  },
  {
    version: "v7.55",
    date: "2026-07-27",
    headline: "A pen path stays put while you style it",
    entries: [
      { tag: "fix", text: "Reaching for the Pen panel deselected the path you had just drawn. The \"click away to finish\" rule read raw coordinates, so every click on the panel counted as away — including the click on the colour swatch you opened it to reach. The path was gone before the picker appeared." },
      { tag: "ui", text: "Finishing a pen path now leaves it selected, so Stroke and Background restyle the thing you just drew. Changing a path's colour used to mean finding it in the Reselect list first, which is a lot to ask of anyone who hasn't found that list." },
      { tag: "ui", text: "The ring on your first point says whether the ends are joined: dashed while the path is open, solid blue when clicking there would connect them, and solid once they are. An open path that happened to finish near its start used to look exactly like a closed one." },
      { tag: "ui", text: "Esc is the way out — it bakes the path and deselects. Undo still steps back through the restyle and then the path itself, one at a time." },
    ],
  },
  {
    version: "v7.54",
    date: "2026-07-27",
    headline: "The headline says what it is, and every page gets air at the top",
    entries: [
      { tag: "ui", text: "The homepage headline led with \"That's Rust, compiled to WASM\" — an engine note aimed at people who already know what those words mean. It now reads \"Crop it, compress it, annotate it, gallop. Free in your browser. No account.\" Price, place and friction, which is what someone decides on." },
      { tag: "ui", text: "Every page starts lower. Home cleared the floating nav by 56px and the sub-pages by 66px; both are 80px now, and Pricing — which had its own third header style — was the worst at 18px." },
      { tag: "fix", text: "On a phone the heading sat 18px under the nav bar, because the mobile rule assumed the bar shrinks on a small screen. It doesn't: it's 62px tall at 390px wide exactly as it is at 1440." },
      { tag: "ui", text: "The bar says \"Image Horse\" on a phone again, instead of leaving the logo to do it alone. The wordmark had been pulled out because at 20px it shoved the menu button off the edge of a 375px screen; at 16px, next to a shorter button, it fits with room to spare." },
      { tag: "ui", text: "The bar's button is \"Demo\" rather than \"Open the demo\". It sits beside a horse and the words Image Horse, on a page about the demo — the verb wasn't carrying anything. The full phrase stays on the hero and Pricing buttons, where there's room for it to work." },
      { tag: "fix", text: "The underline under the current menu item was measured in whole pixels while the links sit on fractions — Pricing is 41.25px wide — so the rule landed up to a quarter-pixel off, by a different amount on each link. It now measures the real geometry and sits exactly under the word." },
      { tag: "fix", text: "The Ctrl+\\ shipping celebration was still counting July at the 22nd: 42 releases and 109 entries. July actually ran to 53 releases and 151 entries, a third of everything ever shipped, and the popper's feature chips missed the whole five-group toolbar." },
      { tag: "ui", text: "Ctrl+\\ is listed in the keyboard shortcuts now. It was bound but undocumented — a key combination nothing in the app admitted existed." },
      { tag: "infra", text: "The contribution squares are regenerated after the release commit rather than before it, so the day you shipped on isn't blank. Monday the 27th started a fresh week column and had nothing in it, because the generator reads git log and had run a commit too early." },
    ],
  },
  {
    version: "v7.53",
    date: "2026-07-26",
    headline: "The tab, the search, and the feature list catch up",
    entries: [
      { tag: "fix", text: "Object Removal had become unreachable: the AI panel's mode picker moved into the sub-tool header, and the restructure then filled that header with the group's sub-tools. Background and Object Removal now sit together." },
      { tag: "ui", text: "The browser title leads with the line the homepage opens on, instead of 'local-first image editing in the browser'." },
      { tag: "feature", text: "Command-K searches all 45 features, each jumping to its own anchor. Derived from the same generated list the Features page renders, so the two can't disagree." },
      { tag: "fix", text: "Eight feature entries still described the eleven-tool layout — 'Effects > Color Picker tab', 'the Arrows sub-tab inside the Shapes tool'. They now name the sub-tool you'd actually click." },
      { tag: "ui", text: "Top bar buttons match the tool rail: same border, hover ring and icon proportion. The panel and Review toggles are one component and now look it." },
    ],
  },
  {
    version: "v7.52",
    date: "2026-07-26",
    headline: "Links name the tool you're actually looking at",
    entries: [
      { tag: "feature", text: "Routes are now #/create/brush and #/edit/color-picker. Crop, Transform and the Eyedropper are one tool underneath, so they used to share a single URL that couldn't say which it meant." },
      { tag: "fix", text: "Thirty-five legacy URL shapes redirect to the sub-tool they meant, each pinned by its own test. Old bookmarks keep working." },
      { tag: "fix", text: "#/tool/select/edge was landing on Magic Wand — 'select' is both a group and a legacy tool slug, and the group reading won. The legacy reading now wins under that prefix." },
      { tag: "fix", text: "The command palette listed rows like 'Paint > Paint'. Entries now read 'Create > Brush', built from the same registry as the toolbar and the keyboard." },
      { tag: "ui", text: "Ruler sits on the rail beside Guides as a disabled placeholder, like Perspective — the slot is held, the measuring isn't built." },
    ],
  },
  {
    version: "v7.51",
    date: "2026-07-26",
    headline: "Eleven tools became five groups",
    entries: [
      { tag: "ui", text: "The toolbar is now five groups — Enhance, Select, Create, Edit, Batch — with everything you had one level down as a sub-tool. Nothing dropped, no tool id renamed, so old links still resolve." },
      { tag: "fix", text: "The sub-tool decides what the canvas does. Anything without its own case used to inherit the clone stamp's handlers, which is how a selection drag could nearly clone-stamp the image." },
      { tag: "ui", text: "Crop, Transform and the Eyedropper each get their own panel instead of sharing one. Same for Resize Layer, Canvas Size and Guides." },
      { tag: "feature", text: "The eyedropper remembers: picked colours land in a Recent Colors list you can click to re-apply." },
      { tag: "ui", text: "OCR moved out of the Text panel and onto the rail; Text's background and bubble controls moved up beside the colour swatch." },
      { tag: "ui", text: "Digits 1-5 select the five groups, derived from the registry so the keys, the tooltips and the shortcut sheet can't disagree." },
    ],
  },
  {
    version: "v0.9.93",
    date: "2026-07-26",
    headline: "Paid accounts were getting free limits",
    entries: [
      { tag: "fix", text: "If you pay for Image Horse, the app was giving you the free tier. Signing in resolved every account to free, so a paid subscription got a 24-photo gallery instead of 100, 100 MB of storage instead of 5 GB, three layers per image instead of unlimited — and the AI tools, the thing you're actually paying for, stayed switched off. The server knew your real tier the whole time; only the interface was wrong. It now reads that tier and unlocks live, with no reload." },
      { tag: "ui", text: "The toolbar has a second row. Sub-tools used to live inside each tool's settings panel as wide word-tiles, below a column of square icon tiles — two shapes of button in one narrow strip, and the row scrolled away with the panel. They now sit directly under the tool rail in tiles of the same shape, so the header grows by exactly one row when a tool has sub-tools." },
      { tag: "ui", text: "Every tool is on the number row now: 1 through 9, then 0 for the tenth and - for the eleventh, running in reading order across the rail. Select takes 3 — it lost its S key two releases ago, and this is the renumbering that was promised." },
    ],
  },
  {
    version: "v0.9.92",
    date: "2026-07-25",
    headline: "The clone stamp is finally just the clone stamp",
    entries: [
      { tag: "infra", text: "Nothing user-visible changes in this one. For most of this app's life, a single 1,467-line file owned everything the image engine does — because the app started as a clone stamp tool, and every feature since moved into the file that held the engine. It's now six files with honest names: the engine core, history, layers, export, transforms, and the clone stamp itself at 229 lines." },
      { tag: "infra", text: "Nothing moved but code, and that claim was tested against the built app from a fresh profile: paint, undo and redo byte-exact in both directions, layer add and visibility toggles exact, flips exact, export produced a real file on disk, and a reload restored the session pixel-for-pixel." },
    ],
  },
  {
    version: "v0.9.91",
    date: "2026-07-25",
    headline: "Nothing changes — less can go wrong",
    entries: [
      { tag: "fix", text: "Undo and redo can no longer take the editor down. Six places in the image engine assumed the edit history was present rather than checking. None of them could actually fire today, but they sat far enough from the check that one careless edit would have turned a dead assumption into a crash mid-edit. They check now, and fall back to ordinary undo if the history isn't there." },
      { tag: "infra", text: "The build can no longer lie about what shipped. For five weeks the live site served an image engine missing half its machinery and nothing caught it — the app quietly worked around the gap instead of failing, so every build looked fine. There's now a check that fetches the running site's engine, looks inside it, and fails if it's the wrong one." },
      { tag: "infra", text: "The project's own code checks went from advisory to blocking. They used to print complaints and pass anyway. They can fail the build now, and the count of existing problems can only go down — a new one stops the build immediately." },
    ],
  },
  {
    version: "v0.9.90",
    date: "2026-07-25",
    headline: "The Select tool is one list of six",
    entries: [
      { tag: "ui", text: "Wand, Edge-aware, Magnetic Lasso, Color Range, Rectangle and Ellipse now sit in a single group with one of them on at a time. Rectangle and Ellipse used to be a separate \"drag shape\" setting running alongside whichever mode you had picked, so dragging swept a rectangle no matter what the panel said was selected — and nothing on screen told you the two halves were different things. Now the mode decides both what gets selected and how you ask for it." },
      { tag: "feature", text: "Click for the first four, drag for Rectangle and Ellipse. A click in Rectangle does nothing and a drag in Wand does nothing, so a slip of the hand can't hand you a selection you didn't ask for. The trade is a mode switch before you can drag a box, where before you could always just drag — that's the cost of being able to read the panel." },
      { tag: "ui", text: "Rect is now Rectangle and Magnetic is now Magnetic Lasso. Each mode has its own address, so a link can point at one. Select has no keyboard shortcut for the moment — it gets a number in a UI change that's coming." },
    ],
  },
  {
    version: "v0.9.89",
    date: "2026-07-24",
    headline: "The Magic Eraser is live",
    entries: [
      { tag: "feature", text: "Brush over something you want gone and release — it's removed and filled in from the surrounding image, entirely on your device. No upload, no sign-in. You can also select the object first and hit Remove Object. One rule: cover the whole object — a partial stroke lets the fill rebuild it from its own leftovers. Large areas can come out soft for now; undo brings everything back, selection included." },
      { tag: "fix", text: "A deploy bug meant some of the engine's newer machinery never actually reached the live site — the app's own safety checks quietly worked around the gap instead of crashing, which is why nobody noticed. Fixed: the full engine now ships, so features like the editing history that survives a reload finally work on the live site the way they always did in development." },
      { tag: "rust", text: "The removal runs a PatchMatch kernel compiled into the WebAssembly engine. Undoing a removal restores the pixels and what you had selected, and the whole path is pinned by tests from two directions." },
    ],
  },
  {
    version: "v0.9.88",
    date: "2026-07-24",
    headline: "See a selection before you make it",
    entries: [
      { tag: "feature", text: "With the Select tool, hover over the image and hold a modifier: the region a click would select lights up as a filled zone — green while you hold Shift (what you'd add), red while you hold Alt (what you'd subtract). It re-floods live from the pixel under your cursor. Click and it commits; the zone becomes the real selection. Purely there to help you aim — it changes nothing on its own." },
      { tag: "feature", text: "Works for the wand, the edge-aware wand, and color range (the magnetic lasso is anchor-based, so it has no hover preview). The preview runs the exact same flood the real click runs, so what you see is what you get." },
      { tag: "rust", text: "The preview is a new read-only engine call that shares one mask core with the committing selection, so the two can never disagree about what a click grabs. It touches neither your selection nor your undo history, and the recompute is throttled to one flood per frame." },
    ],
  },
  {
    version: "v0.9.87",
    date: "2026-07-23",
    headline: "Select gets its own button — and stops lying about its size",
    entries: [
      { tag: "feature", text: "Select is a real tool now, with its own button (press S). It used to hide inside Adjust & Select behind a Click-to-select toggle you had to arm first; now you pick the tool and the canvas just works — click to select, drag to sweep a rectangle or ellipse marquee. Hold Shift to add to a selection, Alt to cut away, and the cursor shows a little + or − so you know which one you're about to do." },
      { tag: "fix", text: "On photos bigger than the window, the marching-ants outline drew two to three times larger than the actual selection — the overlay was sized to the image's raw pixels while the canvas was scaled to fit. The selection underneath was always right; only the outline was wrong. Fixed, along with the magnetic lasso's wire, which had the same bug." },
      { tag: "feature", text: "Every selection is now a step in History: each select, add, subtract, Select All and Deselect shows up by name and undoes with Ctrl+Z. Undoing a Delete Selection or a Cut-to-layer brings back what you had selected, not just the pixels. A click that changes nothing records nothing." },
      { tag: "ui", text: "The Select panel got tidier: one Selection header with the explanations behind its lightbulb, five actions in two neat rows (All, Deselect, Delete, then Copy and Cut), and the drag shape — rectangle or ellipse — is a two-button choice. Old links to the combined tool still land in the right place." },
      { tag: "rust", text: "The rectangle and ellipse marquees are new engine producers riding the same combine pipeline as every other selection kind, and undo snapshots now carry the selection mask — selection-only steps never touch the op log, pinned by tests." },
    ],
  },
  {
    version: "v0.9.86",
    date: "2026-07-23",
    headline: "The Selection tool grows up — magnetic lasso and layers",
    entries: [
      { tag: "feature", text: "The magnetic lasso is live. Click your way around an object and the line snaps to the edge between each click, so you stop tracing outlines by hand. It sits alongside the wand, the edge-aware wand, and color-range select in one panel that now looks like the Paint tool — four tiles, each with its own explanation behind the lightbulb." },
      { tag: "feature", text: "You can now lift a selection onto its own layer: Copy it to a new one with Ctrl+J, or Cut it out onto one with Ctrl+Shift+J — the move Photoshop has had forever. The pixel work runs in the Rust engine on a new SIMD path, so it stays instant even on a large photo." },
      { tag: "fix", text: "Copying a selection now copies what you actually see. It used to grab only the active layer, so a selection over a caption pasted a blank rectangle; it now takes the whole visible image — text, shapes, every layer." },
      { tag: "fix", text: "Guides and rulers no longer flash across the whole screen when you open the Batch editor, and a text drop-shadow set to “Box” with nothing behind it now casts from the letters instead of doing nothing." },
    ],
  },
  {
    version: "v0.9.85",
    date: "2026-07-22",
    headline: "A check that was never running, now runs",
    entries: [
      { tag: "infra", text: "Nothing you can see changed in this one. The project's checklist has required a code linter to pass before anything ships, and it turned out the linter had never actually run — it was never installed, and there was no configuration for it to read, so every attempt quietly failed and got treated as a pass. That is worse than not having the check at all, because everyone assumed it was working." },
      { tag: "fix", text: "It runs now, and the first real pass over 207 files found 26 things worth fixing — all of them fixed here. Mostly harmless leftovers: values computed and then thrown away before anything read them, a few places where the code had stopped describing what type it was really handling. The test files turned out to have had no automated checking of any kind until now." },
    ],
  },
  {
    version: "v0.9.84",
    date: "2026-07-19",
    headline: "The app learns to cache itself — switch still off",
    entries: [
      { tag: "infra", text: "Every visit re-downloads about 3.6 MB of the app, the Rust engine included, and losing your connection mid-session means the next boot fails outright — odd behaviour for an editor whose photos and edits already live on your own machine. A service worker fixes both. This one only caches the app's own files: signing in, cloud sync and share links always go straight to the network, so nothing about your account or your documents can be served stale." },
      { tag: "infra", text: "It ships turned off, and a default build contains none of it — nothing registered, no bytes. Switching it on is a separate decision, because a misbehaving service worker is the worst thing this app could ship: it leaves people on an old version without ever saying so. Once on, a new build waits for you to click Reload rather than swapping code out from under an open edit." },
    ],
  },
  {
    version: "v0.9.83",
    date: "2026-07-18",
    headline: "Preferences stop trusting storage blindly",
    entries: [
      { tag: "infra", text: "The three stores that remember your preferences across a reload — which tool sub-mode you were on, your command-palette habits, the savings badge — used to trust whatever came back out of browser storage as-is. They now check it against what the app actually understands before using it, and fall back to a sane default for anything they don't recognize." },
    ],
  },
  {
    version: "v0.9.82",
    date: "2026-07-18",
    headline: "The AI tool becomes the Eraser tool",
    entries: [
      { tag: "ui", text: "The AI tool is now the Eraser tool — same spot on the toolbar, new icon, one panel. Brush Eraser moved here from Paint. Magic Eraser is a new slot for the local PatchMatch removal that just landed, marked Coming Soon until it's wired in. Background Removal and Object Removal are unchanged. Two placeholder cards that never did anything, Smart Crop and Auto-Enhance, are gone." },
    ],
  },
  {
    version: "v0.9.81",
    date: "2026-07-18",
    headline: "Object removal lands — local, free, still dark",
    entries: [
      { tag: "rust", text: "A local object-removal kernel merged in: select a region and hit Remove Object, and it reconstructs the hole from the rest of the image — no sign-in, no network, runs entirely on your device. It's PatchMatch (Barnes et al.), single-resolution for now, so a real photo will look a little smeary; that's day one of a few. Ships behind a flag that's off by default — dogfooding before it becomes anyone's default." },
    ],
  },
  {
    version: "v0.9.80",
    date: "2026-07-18",
    headline: "The Features page gets a sidebar worth using",
    entries: [
      { tag: "ui", text: "The Features page's sidebar is rebuilt: an icon on every group and every one of the 40 features, a count badge instead of a bare number, and a filled row marking whatever you're reading instead of a thin underline. It sits as an inset panel in the page's own margin now, not a flush column of text." },
      { tag: "fix", text: "Its two groups used to force themselves open no matter the screen size, so a phone opened onto all 40 items stacked above the content before you saw a word of the page. They now open closed on mobile and open on desktop, and switch live if you resize across that line." },
    ],
  },
  {
    version: "v0.9.79",
    date: "2026-07-17",
    headline: "The new undo history is on for everyone",
    entries: [
      { tag: "feature", text: "The undo-history feature that's been building for weeks is now on by default. Every edit is recorded as a small operation instead of a full snapshot, your work is saved a couple of seconds after you stop, and a reload brings back exactly what you left — canvas, border, and all. Anything the recorder can't handle yet quietly falls back to the old undo, so there's no way to get stranded." },
      { tag: "rust", text: "Before flipping the switch it had to pass a four-part test on the real app: same build with the feature off and on must produce identical documents, then a paint stroke and an AI background-removal each have to survive a full save-and-reload. All four passed, checked down to the byte." },
      { tag: "fix", text: "The test nearly failed on a ghost: after a reload the canvas looked gone. The data was fine — the checkerboard pattern behind the image was drawn by a separate element that didn't shrink when the image did, so on big photos it drifted out from under the picture. It's now painted by the image element itself and physically can't misalign. The same bug explains the stray checkerboard strip some sessions showed beside the photo." },
    ],
  },
  {
    version: "v0.9.78",
    date: "2026-07-16",
    headline: "A new site — and this page now counts its own commits",
    entries: [
      { tag: "ui", text: "The whole marketing site is new: five pages instead of one, including this release log, a full feature list, and an architecture map you can filter down to whichever kind of user you are. The old site's headline claimed your pixels never leave the tab. That's true in the demo and not true once you sign in, so it now says what it can actually back up — and the table proving it sits right underneath." },
      { tag: "infra", text: "The squares above are generated straight from the project's commit history every time a release goes out, rather than typed in by hand. A number nobody re-counts is a number that quietly goes stale — the first run already found a day that had been missed." },
      { tag: "fix", text: "Three things that were broken and invisible until measured: the search box (⌘K) opened underneath the navigation bar instead of on top of it; the features page highlighted the wrong entry in its sidebar as you scrolled, always running one ahead of what you were reading; and searching then hitting Enter reloaded the whole site instead of just moving to the page." },
    ],
  },
  {
    version: "v0.9.77",
    date: "2026-07-14",
    headline: "Caught a second data-loss bug before anyone saw it",
    entries: [
      { tag: "rust", text: "Behind the scenes: before turning on the new undo-history feature by default, it got tested one more time — same build, feature off vs. on, nothing else changed. Import a photo, don't touch it, reload. Off, you get the photo back exactly as imported. On, you got it back cropped, with the border and background gone. That's a real bug, caught before it ever reached a real user." },
      { tag: "fix", text: "The cause: the history feature takes its first snapshot a moment too early — before the app finishes setting up a new import — so a photo you hadn't edited yet got remembered in an unfinished state. Fixed so the snapshot always matches what you're actually looking at, and as a second layer of protection, an empty history entry is never saved or restored at all — there's nothing in it a normal reload can't already recover the ordinary way." },
      { tag: "infra", text: "The undo-history feature is still off by default while this gets one more real-world check. Nothing changes for anyone today." },
    ],
  },
  {
    version: "v0.9.76",
    date: "2026-07-13",
    headline: "Your edits are now actually saved",
    entries: [
      { tag: "fix", text: "This is the big one: if you edited a photo and reloaded the page without switching to a different photo first, your work was gone — the app quietly gave you back the original. Strokes, layers, all of it. That's fixed. Your edits are now saved a couple of seconds after you stop working, and again when you close or reload the tab." },
      { tag: "fix", text: "A second, meaner version of the same problem: when you were signed in, the app tried to save to the cloud first and only saved to your own machine afterwards. If the cloud call stalled — no error, just silence — the local save never happened either. It now always saves to your machine first, and treats the cloud as a bonus." },
      { tag: "rust", text: "Behind the scenes: this was found by testing something else entirely. The undo-history feature was blamed, and it turned out to be innocent — it had correctly stepped aside and handed off to a backup copy that nobody was writing." },
    ],
  },
  {
    version: "v0.9.75",
    date: "2026-07-13",
    headline: "The diagnostics panel stopped being cryptic",
    entries: [
      { tag: "rust", text: "Behind the scenes: the Alt+Delete diagnostics window now explains itself. Where it used to show a bare counter sitting at zero — which could mean anything from \"nothing's happened yet\" to \"this is completely broken\" — it now says which, in plain words." },
      { tag: "rust", text: "It also shows the shape of the document you're working on, and which layer an edit would actually land on. Two bugs this month were invisible for exactly that reason: everything looked normal, and the thing that mattered wasn't on screen anywhere." },
    ],
  },
  {
    version: "v0.9.74",
    date: "2026-07-13",
    headline: "A stroke that was saved, and nobody said so",
    entries: [
      { tag: "rust", text: "Behind the scenes: while testing the new undo-that-survives-a-reload, the counter that shows how much has been recorded kept reading zero — even though the edits were being recorded. The recording worked; the part that announces \"a stroke just finished\" only ran in one specific case." },
      { tag: "fix", text: "That had a real consequence, not just a wrong number: the save for your most recent brush stroke wasn't being scheduled, so reloading immediately after painting could quietly lose it. It saves at the end of every stroke now." },
      { tag: "rust", text: "Behind the scenes: the tests never caught it because they built their test image a different way than the app does. There are now tests that go through the exact path the app takes when you open a photo." },
    ],
  },
  {
    version: "v0.9.73",
    date: "2026-07-13",
    headline: "The pen tool's closed shapes actually close now",
    entries: [
      { tag: "fix", text: "Draw a shape with the pen, click back on the first point to close it, and… nothing happened. No outline, no fill. It turns out the little dot you click to close the path was swallowing the click, so the path never finished. It closes now — and a closed shape fills, the way it always should have." },
      { tag: "fix", text: "Picking a pen path back out of the Reselect list used to make it disappear. It now comes back with its curve and its handles, ready to edit." },
      { tag: "fix", text: "Tooltips were hiding behind the gallery strip at the bottom of the screen. They sit on top now — everywhere in the app, not just the one you noticed." },
      { tag: "fix", text: "\"Auto Compress\" is now called \"Auto Compress & Resize\", because that's what it does: big photos get scaled down as well as compressed. There's a lightbulb next to it explaining what it aims for and how small it's willing to go." },
      { tag: "fix", text: "The web address no longer claims you're using a tool when you haven't opened a photo yet." },
    ],
  },
  {
    version: "v0.9.72",
    date: "2026-07-13",
    headline: "The engine was missing a piece we thought we'd shipped",
    entries: [
      { tag: "rust", text: "Behind the scenes: the work-in-progress undo history — the one meant to survive a reload — turned out not to be inside the engine the app actually downloads. It had been built and tested for months, but a single line in the build recipe left it out of the final file. It's in there now, and we watched it record an edit, save it, and bring it back after a reload." },
      { tag: "rust", text: "The engine file is bigger as a result — about 70 KB more — because the code that saves your edit history now genuinely ships with it. Worth being upfront about: that's a real cost on first load, and it buys undo history that survives closing the tab." },
      { tag: "fix", text: "It's still switched off by default while it gets a few days of real use. Nothing changes for you yet." },
    ],
  },
  {
    version: "v0.9.71",
    date: "2026-07-13",
    headline: "Undo history finally works on an ordinary photo",
    entries: [
      { tag: "rust", text: "Behind the scenes: the undo history that's meant to survive a reload had a quiet problem — it only ever worked on photos with a single layer, and since every photo you open gets a canvas behind it, that meant it worked on almost nothing. The engine now understands the canvas as part of the document rather than as an extra layer, so the history records properly on a normal photo for the first time." },
      { tag: "rust", text: "Behind the scenes: the engine used to work out which layer was the canvas by checking whether it was named \"Background\" — a name that unhelpfully meant two different things depending on how the photo was opened. It's now tracked explicitly, which closes off a way you could have renamed a layer and had the app restore the wrong picture." },
      { tag: "fix", text: "Two safeguards came with it: if you paint directly on the canvas layer, or add a second real layer, the app quietly steps back to ordinary undo rather than recording something it can't faithfully replay. It would rather be slower than wrong." },
    ],
  },
  {
    version: "v0.9.70",
    date: "2026-07-13",
    headline: "What you see is what you download",
    entries: [
      { tag: "feature", text: "Exports now include the canvas behind your photo — the padding and background colour you can see on screen come with the download. Before, exports quietly cropped to just the photo. If you preferred it that way, there's a switch: Settings → \"Canvas background on export\", or just hide the canvas layer in the Layers panel." },
      { tag: "fix", text: "\"Blank Canvas\" is now called \"New Canvas\" when you start a document. Small thing — it just means the word \"canvas\" refers to one thing throughout the app instead of two." },
      { tag: "rust", text: "Behind the scenes: the canvas is now properly understood as part of the document rather than as a stray layer, which clears the road for undo history that survives a reload. That feature was quietly unreachable on any photo with a canvas — which, on the default settings, is every photo." },
      { tag: "rust", text: "Behind the scenes: a long-standing question about running the engine on multiple CPU cores in the browser is finally settled — it works, and signing in still works alongside it. That opens the door to making the new Magnetic Lasso and Smart Brush faster on large photos." },
    ],
  },
  {
    version: "v0.9.69",
    date: "2026-07-13",
    headline: "A lasso that finds the edge for you — and a link to every view",
    entries: [
      { tag: "feature", text: "The Magnetic Lasso is here. Click a few anchors loosely around an object and the line snaps to its edge between them, following the outline you meant rather than the one you drew. Double-click to close it and you have a selection like any other. It's switched off by default while it gets a few days of real use." },
      { tag: "feature", text: "New Smart Brush: paint right up to the edge of something and the stroke stays where you put it instead of bleeding across the outline. Same edges the lasso uses — built once, used twice." },
      { tag: "feature", text: "Every view now has a web address. Pick a tool, open a settings pane, and the URL updates; paste that link and you land exactly there. Back and forward work the way you'd expect. There's a new \"Copy link to this view\" in the command palette (Alt+,) for sharing exactly what you're looking at." },
      { tag: "rust", text: "Behind the scenes: the lasso finds the cheapest path along a map of the image's edges, searched within a bounded window so it keeps up with your cursor — about 1 to 6 milliseconds per move on a large photo. No AI, no server: it runs in your tab." },
    ],
  },
  {
    version: "v0.9.68",
    date: "2026-07-13",
    headline: "Undo that survives a reload — and the two bugs standing in its way",
    entries: [
      { tag: "rust", text: "Behind the scenes: work continues on undo history that survives closing the tab. It's still switched off by default, and this release is about earning the right to switch it on — two bugs were found that could quietly hand you back the wrong picture after a reload." },
      { tag: "fix", text: "The first: after an AI edit (like Remove Background), a reload could restore the photo as it was BEFORE the AI ran, or as a blend of two different edit histories. The saved history couldn't tell an old recording from a new one, so it wrote the new edits on top of the old ones." },
      { tag: "fix", text: "The second: a photo with saved history that you'd since added a layer to would come back with its layers gone. The history replayed without complaint — it just replayed a picture that only had one layer. It now recognises it's out of date and steps aside for the real file." },
      { tag: "rust", text: "The Diagnostics window (Alt+Delete) now shows what's actually stored for the current photo, and says plainly when a saved history has been stood down." },
    ],
  },
  {
    version: "v0.9.67",
    date: "2026-07-13",
    headline: "Smarter selections — and a wand that knows where objects end",
    entries: [
      { tag: "feature", text: "\"Edit and Transform\" is now \"Adjust & Select\", split in two: Adjust for cropping, flipping and rotating, and Select for choosing what you're working on. The magic wand moved in here (it used to live under Layer Settings, oddly), and it brought company." },
      { tag: "feature", text: "New Edge-aware wand: it selects like the normal wand but stops at an object's outline instead of bleeding out into the background through a soft gradient — the exact spot the old wand always let you down." },
      { tag: "feature", text: "New Color Range: click a colour and take every pixel of it anywhere in the photo, not just the connected patch under your cursor. One click gets all the sky, including the bits peeking between buildings." },
      { tag: "rust", text: "Behind the scenes: a proper edge-detection engine now ships, and it notices colour boundaries a brightness-only detector would miss entirely (a red shape on a green background of the same brightness, say). It's built to be shared — the magnetic lasso and a future smart brush will use exactly the same edges." },
      { tag: "fix", text: "The little green savings badge on a compressed photo (\"-95%\") used to vanish the moment you reloaded the page. It stays put now — it was only ever held in memory, even though the photo it belonged to was being restored properly." },
    ],
  },
  {
    version: "v0.9.66",
    date: "2026-07-13",
    headline: "Real compression targets, working alignment, and shadows you can actually see",
    entries: [
      { tag: "feature", text: "Compress Image(s) now works toward an actual size target — about 200 KB — stepping quality down first, then dimensions if it has to, instead of doing one pass and hoping. Images over 2500px get resized as part of the job (the progress toast tells you when that's happening). In testing, a 9.9 MB photo came out at exactly 200 KB." },
      { tag: "fix", text: "The nine Align buttons now work no matter how you picked the thing you're aligning. Before, they only woke up if you'd selected the object from the Reselect list — pick it on the canvas and they sat there greyed out. Placing text also used to look like it did nothing; it was moving, you just couldn't see it." },
      { tag: "fix", text: "Shadows are visible in dark mode. Menus, tooltips, toasts and dialogs were rendering flat against the dark background — they now lift off the page properly, with a subtle edge. (Two panels turned out to have had no shadow at all, in either theme.)" },
      { tag: "fix", text: "Text in a background box or speech bubble now lands exactly where you place it. Plain text was fixed last release; the bubble was still drifting — by quite a lot, as it turns out — because of the space its tail reserves." },
      { tag: "ui", text: "Selecting a batch of photos got quicker: tick one checkbox, hold Shift, click another — everything between them selects in one go, just like a file manager." },
      { tag: "ui", text: "The command palette (Alt+,) got a proper home: it now looks like the Settings and Diagnostics windows — a real search bar up top, tabs for All / Tools / Settings / Actions, and a Most Used grid of the ten commands you actually reach for most (it starts with sensible picks and learns from there). You can now open it from the right-click menu too, and it's listed in the keyboard-shortcuts sheet and the status bar, so you can actually find it." },
      { tag: "ui", text: "The Resize tool's Compress/Resize switcher now matches Paint's — the same icon-and-title toggle every multi-mode tool is moving to." },
    ],
  },
  {
    version: "v0.9.65",
    date: "2026-07-12",
    headline: "Text lands exactly where you typed it",
    entries: [
      { tag: "fix", text: "Committing a text bubble used to drop it slightly below and to the right of where you'd typed — barely noticeable with small text, but the bigger the font, the bigger the jump. The editor and its typing box now agree, to the pixel, on where your text goes. Re-editing a bubble and committing it again no longer nudges it either." },
      { tag: "rust", text: "Behind the scenes: the engine now reports exactly where a line of text's ink begins, straight from the font's real measurements — that's what makes the typing box and the final result line up at any size." },
    ],
  },
  {
    version: "v0.9.64",
    date: "2026-07-12",
    headline: "A command palette — press Alt+, and just type",
    entries: [
      { tag: "feature", text: "Press Alt+, anywhere and start typing: jump to any tool or straight into a sub-mode (type \"arrow\" and land in Shapes with Arrows selected), flip rulers, grid, or the theme live, open the exact Settings tab you want, undo, redo, export. Your recent picks surface first, labels update with state (\"Show Grid\" becomes \"Hide Grid\"), and it's fully keyboard-driven." },
      { tag: "ui", text: "The palette knows about every tool today and gets smarter over time — as tools move onto the new registry, their sub-modes and settings show up automatically." },
    ],
  },
  {
    version: "v0.9.63",
    date: "2026-07-12",
    headline: "Quiet groundwork for smarter tool panels",
    entries: [
      { tag: "infra", text: "Behind the scenes: the pattern Paint uses for its sub-modes — icons on top, panel below — is now a shared building block, and the first piece of a proper tool registry landed with it. Nothing looks different today; it's the foundation that lets every multi-mode tool get the same clean switcher, one release at a time." },
      { tag: "ui", text: "This site's home page got a truth pass — the AI section now says object removal and text extraction are live (they have been for a while), and a few stale numbers and confusing lines were corrected." },
    ],
  },
  {
    version: "v0.9.62",
    date: "2026-07-12",
    headline: "Copy any selection, and the stamp tool learns to let go",
    entries: [
      { tag: "feature", text: "Ctrl+C now copies whatever selection you have active — a crop box, a shape's bounds, a magic-wand selection — and Ctrl+V pastes it back through the same movable placement box you already know. There's a \"Copy Selection\" option in the right-click menu too. Before this, copy only worked on the whole canvas at once." },
      { tag: "fix", text: "Leaving the stamp tool — or switching between its Clone, Stamps, and Emoji modes — now actually puts the stamp down. Before, the last stamp you'd picked kept firing on every click, even after you'd moved on to a different mode." },
      { tag: "ui", text: "The toolbar button formerly called \"Clone Stamp\" is now just \"Stamps.\" It's done clone, emoji, and batch stamping for a long while — the name finally caught up. Same button, same shortcut." },
    ],
  },
  {
    version: "v0.9.61",
    date: "2026-07-11",
    headline: "Groundwork for edits that survive a reload — and a sturdier photo list",
    entries: [
      { tag: "fix", text: "Your photo list can no longer vanish on its own. It used to be possible — rare, but real — for the \"Welcome back\" list to get cleared by a bad reload. Now it only ever clears when you actually delete your photos." },
      { tag: "infra", text: "Behind the scenes: the editor can now record every brush stroke, blur, crop, and text change into a compact log, rebuild your exact image from it, and keep undo working across a page reload. A single brush stroke saves as about 75 bytes instead of rewriting megabytes. It's not switched on yet — it's being tested against real galleries first — but the pixel-for-pixel proof is done." },
    ],
  },
  {
    version: "v0.9.60",
    date: "2026-07-11",
    headline: "The performance monitor gets smarter about when to check",
    entries: [
      { tag: "infra", text: "Behind the scenes: the performance monitor (Alt+Delete → Resources) used to poll everything on one flat timer. Now it only reads the expensive stuff (tab memory) when you hit Refresh, checks memory every 1.5 seconds while the panel's open, and tracks frame rate only while you're actually drawing — freezing on your last stroke instead of measuring nothing. It's also the tab you land on first now." },
    ],
  },
  {
    version: "v0.9.59",
    date: "2026-07-10",
    headline: "Laying the groundwork for multi-core editing",
    entries: [
      { tag: "rust", text: "Behind the scenes: blur can now split its work across every core on your machine instead of just one, roughly 7.8x faster in testing. It's not switched on for anyone yet — turning it on for real needs a few more pieces in place first — but the hard part (proving the parallel version produces the exact same result, pixel for pixel, as the original) is done." },
    ],
  },
  {
    version: "v0.9.58",
    date: "2026-07-10",
    headline: "Strip just your photo's location, and a freeze fixed",
    entries: [
      { tag: "feature", text: "When you strip metadata on export, you can now choose \"Location only\" instead of everything — keeps your camera and lens info, drops just the GPS coordinates. Handy when you want the technical details but not your home address baked into the file." },
      { tag: "fix", text: "Opening the diagnostics window (Alt+Delete) before loading a photo could freeze the whole app solid with no way to close it. Fixed." },
      { tag: "infra", text: "Behind the scenes: a new test suite proves the editor's operation log replays pixel-for-pixel identical to the original edit, every time — the safety net future undo work builds on." },
    ],
  },
  {
    version: "v0.9.57",
    date: "2026-07-09",
    headline: "A setting moved to where it belongs, and cleaner canvas removal",
    entries: [
      { tag: "ui", text: "The \"include the canvas backdrop in exports\" setting moved from General settings to the Layers and Canvas tab, right next to the other canvas-backdrop controls. Same setting, just where you'd actually go looking for it." },
      { tag: "fix", text: "Removing the canvas backdrop now also trims the document back down to your actual photo. Before this, a removed backdrop could leave invisible extra space around your image that showed up again in exports." },
    ],
  },
  {
    version: "v0.9.56",
    date: "2026-07-09",
    headline: "A cleaner way to drop the canvas, and clearer paid buttons",
    entries: [
      { tag: "feature", text: "Next to Resize Canvas, there's now a Remove Canvas button. It deletes the background layer outright, so you can keep everything you've drawn or pasted above it without a blank backdrop underneath." },
      { tag: "ui", text: "The AI tool buttons (background removal, text extraction, object removal) now show a small padlock when you're not signed in or not on the paid plan, instead of just going faintly gray for no visible reason." },
    ],
  },
  {
    version: "v0.9.55",
    date: "2026-07-09",
    headline: "Save and open real projects — full layer stacks, no flattening",
    entries: [
      { tag: "feature", text: "You can now export your whole project — every layer — as an OpenRaster (.ora) file, the same format Krita and GIMP use. Open it back up here, or in one of those, and every layer comes back intact. Importing an .ora adds it as a new photo, so it never touches whatever you're already working on." },
      { tag: "fix", text: "A few toolbar icons in the Review panel (History, Layers, Reselect, Histogram) had lost their hover tooltips somewhere along the way — you'd see a bare icon with no label. Fixed, and while I was in there, made sure those buttons work properly with a keyboard or screen reader too, not just a mouse." },
    ],
  },
  {
    version: "v0.9.54",
    date: "2026-07-09",
    headline: "Four new editing tools, plus two real bugs fixed",
    entries: [
      { tag: "feature", text: "Four new ways to adjust a photo, right next to Brightness, Contrast, and Blur: Saturation dials color intensity up or down without shifting hue. Shadows and Highlights let you brighten just the dark parts of a photo or pull back just the bright parts, instead of moving the whole image at once. Sharpen adds crispness back to a soft or slightly blurry photo." },
      { tag: "fix", text: "If you're on a paid plan, the app now recognizes that the moment you sign in. Some paid accounts were staying locked out of their own features because the app was only checking whether you were signed in, not what plan you were actually on." },
      { tag: "fix", text: "If you ran an AI tool — background removal, text extraction, object removal — and got back a blank or broken image, that's fixed. A browser quirk was reporting the result as zero pixels wide right after processing finished, and that zero was making it onto your canvas." },
      { tag: "infra", text: "Corrected some inaccurate claims on the public Architecture page — it was describing API routes and storage that never actually existed." },
    ],
  },
  {
    version: "v0.9.53",
    date: "2026-07-09",
    headline: "A green light for faster processing",
    entries: [
      { tag: "rust", text: "The next building block for undo landed in the codebase — a tile-based way of tracking edits instead of full-image snapshots. It's off by default and not connected to anything yet, so nothing changes for you today." },
      { tag: "infra", text: "Tested whether a browser security setting I need for faster multi-core image processing would break signing in. It doesn't — so that's clear to build on next. Also gave the internal docs that explain how the app is built a full pass to match what's actually shipped." },
    ],
  },
  {
    version: "v0.9.52",
    date: "2026-07-08",
    headline: "Pasting big images finally behaves — and SVGs just work",
    entries: [
      { tag: "feature", text: "Paste an image as a new layer and you now get a movable, resizable placement box — an image bigger than your canvas arrives scaled to fit instead of getting cropped with no way back. Press Enter to place it, or Esc to cancel — and cancelling cleans up the layer it would have landed on, too." },
      { tag: "feature", text: "Resizing or moving a pasted image now shows up in History as its own step. Undo peels back just the resize first, then the paste — instead of nuking the whole thing in one go. The image is re-rendered from the original every time, so there's no quality loss from resizing twice." },
      { tag: "feature", text: "You can drop, paste, or open SVG files now. They're converted to regular pixels the moment they come in — safely, so nothing inside the file can run — and from there they edit like any other image." },
      { tag: "ui", text: "The Compress panel's buttons are regrouped: Apply Compression & Resize and A/B Compare sit together at the top, with the one-click Auto Compress actions below." },
    ],
  },
  {
    version: "v0.9.51",
    date: "2026-07-02",
    headline: "Exports and imports stay smooth",
    entries: [
      { tag: "perf", text: "Encoding images for export and making gallery thumbnails now happen on a background thread, so the app doesn't freeze up when you export a large image or drop a big batch of photos in at once. If that background worker ever can't run, the app just does the work the normal way instead — nothing breaks." },
    ],
  },
  {
    version: "v0.9.50",
    date: "2026-07-02",
    headline: "Pipeline housekeeping",
    entries: [
      { tag: "infra", text: "Maintenance on the build pipeline — updated the CI Node version and fixed a permissions hiccup in the Rust dependency audit. Nothing changes in the app." },
    ],
  },
  {
    version: "v0.9.49",
    date: "2026-07-02",
    headline: "Sturdier photo storage, invisibly",
    entries: [
      { tag: "infra", text: "Started moving where your original photos are stored onto a more robust database layer. It happens quietly as you open photos — nothing changes for you, and your existing photos keep working. The old storage stays untouched as a safety net, and the whole thing can be switched back with one flag if anything ever looks off." },
    ],
  },
  {
    version: "v0.9.48",
    date: "2026-07-02",
    headline: "The loading spinner spins again",
    entries: [
      { tag: "fix", text: "The loading spinner no longer sits frozen when you have Reduced Motion turned on (in your OS or in the app). A spinner that doesn't spin looks like the app is stuck, so it keeps turning now — it's essential feedback, not decoration. Other, decorative animations still respect your Reduced Motion setting." },
      { tag: "infra", text: "Tidied up a panel animation that had been copy-pasted into nine places down to one shared definition. No visible change." },
    ],
  },
  {
    version: "v0.9.47",
    date: "2026-07-02",
    headline: "Housekeeping under the hood",
    entries: [
      { tag: "infra", text: "Internal cleanup with no change to how the app works. The big central component that wires the editor together was split into smaller, focused pieces, and the last of the app's global browser events moved into its shared state stores. Nothing looks or behaves differently — it just makes the code easier to work on." },
    ],
  },
  {
    version: "v0.9.46",
    date: "2026-07-02",
    headline: "Layers are free, and the pen fills what you drew",
    entries: [
      { tag: "feature", text: "Layers no longer require an account. They run entirely on your device, so they shouldn't sit behind a login — the free no-login tier now gets 3 layers per image, same as a logged-in account. Signing in and going Pro is about the cloud stuff (saved projects, storage, sharing, AI), not the editing itself. Crop, blur, resize, paint, and the histogram were already free." },
      { tag: "fix", text: "The pen tool's Background fill can now be applied to a path you already drew — reselect the path and change the Background and it fills, instead of only working if you set it before drawing." },
    ],
  },
  {
    version: "v0.9.45",
    date: "2026-07-02",
    headline: "Crop keeps your annotations put",
    entries: [
      { tag: "fix", text: "Fixed a bug where cropping a photo made text and shapes slide off their spots — the pixels moved but the annotations didn't. They now travel together, wherever you crop." },
      { tag: "ui", text: "Under-the-hood consistency pass: every dialog in the app now shares one system (same focus handling, same animation), and the button zoo was consolidated into a single primitive — fixing a few font-size mismatches along the way." },
    ],
  },
  {
    version: "v0.9.44",
    date: "2026-07-02",
    headline: "Resize a layer in place, and a cleaner, friendlier settings panel",
    entries: [
      { tag: "feature", text: "New “Resize Layer” tool — drag a bounding box around any layer's content (a pasted photo, a sticker, a speech bubble) to scale and reposition it in place, non-destructively, before committing. Lives in the Layers tab next to Move." },
      { tag: "ui", text: "Every tool's settings panel got a pass: section titles now sit next to a small lightbulb you can hover for an explanation and any keyboard shortcuts, instead of paragraphs of instructions taking up space. The Paint tool is now a 2×2 icon grid — Paint, Blur, Pen, and Eraser (moved here from Edit & Transform, where the Color Picker now lives instead)." },
      { tag: "ui", text: "The status bar now cycles through more useful shortcut hints — two tied to whatever tool you're using, one general tip, and Alt+/ (open the full shortcut list) always pinned last." },
      { tag: "fix", text: "Fixed a visual bug where the app's background checkerboard and the photo's own transparency checkerboard were two subtly different patterns fighting each other — they're unified now, along with the thumbnail checkerboards." },
      { tag: "ui", text: "Holding Shift while dragging an arrow, shape, or pasted image now locks the angle or direction to a clean 90° — handy for perfectly straight connector arrows." },
      { tag: "ui", text: "Renamed the confusing three-button “Add this image” dialog to Stack as layer / Merge into layer / New gallery image, each with a plain-language explanation of what it does." },
    ],
  },
  {
    version: "v0.9.43",
    date: "2026-06-30",
    headline: "A canvas that stays the right size",
    entries: [
      { tag: "fix", text: "Fixed a bug where opening a photo could blow the canvas up to a giant size. The canvas border is now exact and repeatable — your document is always the photo plus the border you chose, it never balloons, and a too-big canvas snaps right back. The live border updates cleanly no matter how a photo was opened." },
      { tag: "ui", text: "Spinner polish — loading spinners now scale to the size we ask for, the Settings spinner sits neatly above the panel, and the spinning comet keeps a faint trail so it stays visible on the light theme." },
    ],
  },
  {
    version: "v0.9.42",
    date: "2026-06-30",
    headline: "Guides, and a canvas that resizes",
    entries: [
      { tag: "feature", text: "Image guides, like a desktop editor. From Layer Settings you can drop horizontal and vertical guide lines onto the canvas, drag them anywhere, lock them so they don't move, and select or delete them from a list. Add a few and they space themselves out evenly. They show whether or not the rulers are on." },
      { tag: "fix", text: "“Resize canvas” now actually resizes the canvas behind your photo instead of scaling the whole image — your photo keeps its native size and the backing canvas grows or crops around it. Changing the canvas border updates a loaded photo live." },
      { tag: "feature", text: "A new “Layers and Canvas” settings section. Photos now open on a canvas + photo by default with a 10px border, and you can pick the backing color from a palette — defaulting to the familiar transparent checkerboard. Canvas Size lives here now." },
      { tag: "ui", text: "Cleaner loading states throughout — placeholder “skeletons” while content loads, and a refreshed spinner with a bright leading edge that respects reduced-motion settings." },
    ],
  },
  {
    version: "v0.9.41",
    date: "2026-06-29",
    headline: "Start a canvas your way",
    entries: [
      { tag: "ui", text: "The Blank Canvas / “New Document” screen is now organized by what you're making — Social, Web, Video, and Paper tabs each offer ready-made sizes. Instagram, LinkedIn, Facebook, YouTube thumbnails and banners, FHD and 4K, A4 and Letter, photo prints, and more. Pick a tab, pick a size, start designing." },
      { tag: "feature", text: "New “Canvas on import” setting (Settings → General) can open each photo Photoshop-style — on a slightly larger backing canvas, split into a Background and a Photo layer, so you have room to work around the image. It's optional and off by default, which keeps the classic exact-size load." },
    ],
  },
  {
    version: "v0.9.40",
    date: "2026-06-29",
    headline: "Snappier photo switching, privacy + safer share links",
    entries: [
      { tag: "perf", text: "Switching between photos is now near-instant. The app used to re-read each photo from local storage and fully re-decode it every time you clicked it; it now keeps recently-viewed photos decoded in memory, so jumping around the gallery feels immediate." },
      { tag: "feature", text: "Privacy by default: exported images now strip camera metadata (EXIF — GPS location, capture time, device) unless you turn it back on in Settings → Security." },
      { tag: "fix", text: "Share links are harder to guess — view tokens now come from a cryptographically-secure generator instead of a basic random function. Existing links keep working." },
      { tag: "infra", text: "Added an image-upload safety check (validates real file bytes, caps absurd sizes, rejects scriptable SVGs) plus more behind-the-scenes state and storage groundwork." },
    ],
  },
  {
    version: "v0.9.39",
    date: "2026-06-29",
    headline: "Behind the scenes — state-management foundation + storage groundwork",
    entries: [
      { tag: "infra", text: "Began lifting the editor's UI, tool, and gallery state into dedicated Zustand stores, untangling a single 3,000-line component. This is plumbing — nothing changes in how the app looks or behaves yet — but it's the groundwork that makes future features quicker and safer to build." },
      { tag: "infra", text: "Added a tidy IndexedDB layer (via Dexie) for the heavy data — your original images, edited versions, and gallery list — alongside a small adapter that remembers UI preferences locally. Your photos still never leave your device." },
      { tag: "infra", text: "Wrote up three engineering notes — on state management, on why we use IndexedDB, and on a future service-worker that would cache the app for instant repeat loads and offline editing." },
    ],
  },
  {
    version: "v0.9.38",
    date: "2026-06-28",
    headline: "Gallery selection + PgUp/PgDn fixes",
    entries: [
      { tag: "fix", text: "Switching photos quickly — rapid thumbnail clicks, or holding PgUp/PgDn — could leave the canvas showing one photo while the gallery highlighted another. The displayed image now always matches the selected thumbnail (a latest-wins guard makes the most recent selection win)." },
      { tag: "fix", text: "PgUp/PgDn now step through every photo reliably and wrap around — they advance from the truly-current photo instead of a value that lagged behind the image load, so repeated presses no longer get stuck on one." },
    ],
  },
  {
    version: "v0.9.37",
    date: "2026-06-28",
    headline: "Behind the scenes — docs, CI safety nets, faster checks",
    entries: [
      { tag: "infra", text: "Reorganized the project documentation into a docs/ folder (Architecture, File Map, Features, Getting Started, Keyboard Shortcuts, CI, and one dated Change Summary) and slimmed the README down to the essentials." },
      { tag: "infra", text: "Added a CI pipeline — build, security, and dependency-audit jobs — plus an advisory “guardrails” pass that flags design-token drift (raw colors, off-scale type, stray z-index) without blocking the build." },
      { tag: "infra", text: "Added native git hooks that run formatting, lint, and type checks before every push, so a change can’t quietly break the build." },
    ],
  },
  {
    version: "v0.9.36",
    date: "2026-06-28",
    headline: "WASM SIMD128 — the heavy pixel ops got faster",
    entries: [
      { tag: "perf", text: "The image engine's hottest pixel loops now use explicit WebAssembly SIMD128 (processing four channels at once): Gaussian blur, brightness, contrast, pixelate, and image resize (bilinear / Lanczos / Catmull-Rom). Measured in-browser, resize runs ~1.6× faster (bilinear) up to ~3.9× (Lanczos) — and the output is bit-for-bit identical, so nothing about your edits changes; they just land quicker." },
      { tag: "rust", text: "Every kernel keeps a matching scalar fallback (used where SIMD isn't available) and shares one set of load/store helpers, all consolidated under a new src/simd/ module." },
      { tag: "infra", text: "Fixed the marketing deploy: a root vercel.json now pins Vercel to build only the marketing site — previously it ran the app build, which needs a WebAssembly step Vercel doesn’t perform, so the deploy kept failing." },
    ],
  },
  {
    version: "v0.9.35",
    date: "2026-06-28",
    headline: "Tidier notice dialogs and a calmer cursor",
    entries: [
      { tag: "ui", text: "The idle “paused to save power” screen, the small-window notice, and the resume prompt now share one compact card — a mid-size icon, a line of copy, and a single button — for a consistent look across the app’s lightweight notices." },
      { tag: "fix", text: "The brush-size ring now appears only for the brush tools (Paint / Blur / Eraser and the Effects blur). Tools that don’t paint — Resize, Layer Settings, AI — and the side panels now keep the normal arrow cursor instead of a stray paint ring." },
    ],
  },
  {
    version: "v0.9.34",
    date: "2026-06-28",
    headline: "A big engine cleanup so features ship faster",
    entries: [
      { tag: "rust", text: "The WASM image engine had grown into one ~4,800-line file — a single object with ~150 methods piled together. It's now split into focused modules (layers, annotations, paint, effects, selection, and shared helpers), shrinking the main file by about 60%. Not a single pixel changes — same tools, same speed — but the code is far easier to work in, which means new features land faster and with fewer bugs." },
      { tag: "perf", text: "Smaller, focused modules let the Rust compiler and editor tooling keep up, so each change is quicker to build and check." },
    ],
  },
  {
    version: "v0.9.33",
    date: "2026-06-28",
    headline: "A compact master bar for narrow & split-screen windows",
    entries: [
      { tag: "feature", text: "Snap the window narrow (≤1000px) — or open Image Horse on a tablet — and the whole interface folds into one left “master bar”: a New button plus Tools / Gallery / Review tabs that swap its contents, with settings and your account in the top row. The horizontal top bar disappears and the canvas takes the rest of the screen." },
      { tag: "ui", text: "The Gallery tab is the full gallery turned vertical — two square thumbnails per row, scrolled with up/down arrows instead of a scrollbar, with all the same select / export / duplicate / delete controls and the photo count pinned to the bottom." },
      { tag: "ui", text: "A one-time “Use compact version” notice greets the narrow layout so it’s clear the app intentionally reshaped for the smaller window." },
      { tag: "perf", text: "The master bar is code-split — desktop sessions never download it; its bundle only loads the first time you go narrow." },
      { tag: "ui", text: "Settings → Import / Export (renamed from Export) now lists Import .ora and Export .ora next to the existing options (both coming soon), and Resize shares its Scale / W×H / aspect-lock control with a new Layer-Settings “Canvas Size”." },
      { tag: "fix", text: "The Selection-marker cursor no longer shows the move icon, and the canvas backdrop checkerboard now extends exactly 10px past the image and follows the light/dark theme." },
      { tag: "rust", text: "Added a WASM panic hook (console_error_panic_hook) so a Rust panic surfaces a real message in the console instead of an opaque “unreachable”." },
    ],
  },
  {
    version: "v0.9.32",
    date: "2026-06-27",
    headline: "Tool shelf reshuffle, drag-and-drop import, and a snappier histogram",
    entries: [
      { tag: "feature", text: "Drag an image anywhere onto the app — or paste it (Ctrl+V) — and a full-window glow frames the window, then a dialog asks where it should go: its own new layer, on top of the image you're editing, or as a new image in the gallery." },
      { tag: "ui", text: "Tool shelf reshuffle: “Edit and Move” is now “Edit and Transform”, and the Eraser moved out of Paint to the bottom of it. “Move” became “Layer Settings” — a Move-layer toggle (Ctrl+M) plus the magic-wand Selection marker, together in one place." },
      { tag: "fix", text: "The histogram now drops cleanly when you switch photos and rises only once the new image is actually ready — no more flashing or stale graphs mid-load." },
      { tag: "ui", text: "The download dialog’s main button now says exactly what it’ll do — “Download & Share JPEG/PNG/WEBP” — tracking your chosen format." },
      { tag: "feature", text: "A little confetti: press Ctrl+\\ for a popper celebrating the month’s shipped features (67 in June, 90 all-time). 🐎" },
    ],
  },
  {
    version: "v0.9.31",
    date: "2026-06-27",
    headline: "Non-destructive layer masks",
    entries: [
      { tag: "feature", text: "Layer masks — hide or reveal parts of a layer without erasing anything. Add a mask from the Layers panel, then paint it: black hides, white brings it back. Fully reversible until you Apply it." },
      { tag: "rust", text: "Masks live in Rust and reuse the existing brush engine (soft dabs, hardness, stroke stabilizer), so painting a mask feels exactly like the paint brush — and every composite, export, and thumbnail honours the mask." },
      { tag: "feature", text: "Mask actions in the layer row: Invert (swap hidden/shown), Apply (bake it in permanently), and Remove. Merging and flattening bake masks in correctly." },
      { tag: "ui", text: "Where a mask hides pixels you now see the transparency checkerboard through them, matching the eraser." },
    ],
  },
  {
    version: "v0.9.30",
    date: "2026-06-27",
    headline: "An eraser, a softer brush, and a selection marker that finally stays put",
    entries: [
      { tag: "feature", text: "New Eraser in the Paint tool — the sub-modes are now Paint · Blur · Pen · Eraser. The eraser scrubs the active layer back to transparent (revealing whatever is beneath it), with its own size, strength, and hardness; lower strength erases gradually." },
      { tag: "feature", text: "The paint brush has a real Hardness control now (0–100%) — a crisp edge at the top, a soft skirt lower down — shared by the eraser." },
      { tag: "rust", text: "Both the eraser and the brush-edge hardness live in Rust, reusing the same stroke engine the paint brush already used: soft dabs, true per-stroke opacity, and the lazy-mouse stabilizer." },
      { tag: "ui", text: "The histogram now drops its bars to the floor when you switch photos and holds them down until the new photo is ready, then they rise into its shape — instead of flashing “no image”. Editing the same photo still morphs smoothly." },
      { tag: "fix", text: "The magic-wand selection marker no longer drifts away when you zoom or pan — it now rides the exact same transform as the image. The marker is also a crisp marching-ants outline (drawn in Rust) instead of a flat blue wash that hid your pixels." },
      { tag: "ui", text: "A transparency checkerboard now sits behind every image, so erased areas and transparent PNGs read as an empty grid right away instead of going black." },
    ],
  },
  {
    version: "v0.9.29",
    date: "2026-06-26",
    headline: "Unified button system, share links, and a snappier, smarter placement grid",
    entries: [
      { tag: "feature", text: "Share a read-only link to your image — Download → “Share link” uploads a snapshot and copies a public URL anyone can open (sign-in required)." },
      { tag: "ui", text: "One unified button system across the settings: Shapes, Pins, Arrows, Crop ratios, the Effects Quick-Adjust, the Edit & Move Transform actions, and the Download options are all icon-on-top tiles now, with a warm hover ring — all from one shared component." },
      { tag: "feature", text: "The placement grid now drops a text or shape into the CENTER of the chosen ninth of the canvas (not jammed into a corner), computed in Rust as a single undo step. Numpad 1-9 maps to the nine cells." },
      { tag: "perf", text: "Cold start no longer blocks on the sign-in service before showing anything — it boots and reveals the New / Welcome-back screen fast, with a capped fallback so a slow sign-in can’t hang the splash." },
      { tag: "ui", text: "Download dialog is now “Download, Copy, or Share” with a checkbox-style format picker; the AI tools panel was trimmed of its walls of text, and Object Removal opens above the gallery." },
    ],
  },
  {
    version: "v0.9.28",
    date: "2026-06-26",
    headline: "A full-page start experience and a 3×3 placement grid",
    entries: [
      { tag: "ui", text: "Cold start is now one branded screen: the logo and a spinner settle in while the app checks for a saved session, then the logo eases upward and reveals either the New panel or “Welcome back” — decided before anything paints, so there’s no flash. The spinner always completes a turn, even on instant loads." },
      { tag: "feature", text: "“Welcome back” is full-page too now, sharing that same logo-eases-up entrance: two thumbnails plus a “+N” tile and Resume / Start fresh." },
      { tag: "ui", text: "The idle “paused to save power” screen got the same treatment, and the brand logo on all three screens is larger." },
      { tag: "feature", text: "New 3×3 placement grid — nine buttons for the nine spots on the canvas (corners, edge-centers, center). It replaces the old alignment row and now lives in Text, Shapes, and the Batch editor; pick a text or shape and drop it into any anchor. Numpad 1-9 maps to the grid spatially." },
      { tag: "fix", text: "Bézier pen: turning on a Background fill now previews live as you draw, instead of only appearing once the path is committed." },
    ],
  },
  {
    version: "v0.9.27",
    date: "2026-06-25",
    headline: "Security tab, snapped-window layout, reduce-motion fixes, and a keyboard-accessibility pass",
    entries: [
      { tag: "feature", text: "EXIF keep/strip moved out of the Compress panel into a new Settings → Security tab — and it’s now a saved preference, not a per-session toggle, applied to every export." },
      { tag: "feature", text: "The “Welcome back” resume dialog was rebuilt on the shared modal (title in the header, the two actions in the footer), shows five thumbnails plus a “+N” tile, and its close ✕ now shakes instead of dismissing — you pick Resume or Start fresh." },
      { tag: "feature", text: "Snapped / narrow windows: below ~900px the side panels stop crushing the canvas and float as overlay drawers (with a scrim, one open at a time); below ~600px a friendly “needs a wider window” notice appears. One shared breakpoint hook drives it all." },
      { tag: "fix", text: "Reduce Motion now also stops the panel / canvas / gallery slide animations — those animate layout (margin/width), which had been slipping past the motion-reduction wrapper." },
      { tag: "feature", text: "Keyboard-accessibility pass: a “Skip to canvas” link, landmark roles + labels on the toolbar / panels / canvas, real accessible names on the tool buttons, and Escape-to-close + dialog semantics on the modals." },
    ],
  },
  {
    version: "v0.9.26",
    date: "2026-06-24",
    headline: "Text drop shadows, a magic-wand selection tool, and pen fixes",
    entries: [
      { tag: "feature", text: "Text can now cast a soft drop shadow — on the letters, the background box, or both (Text → Background → Drop Shadow), with color, opacity, offset and blur. It’s saved with your edit and survives photo switches and reloads." },
      { tag: "rust", text: "The shadow is rendered in Rust: the chosen silhouette is offset and Gaussian-ish blurred, painted behind everything, and the text tile grows to fit — so the Align tool’s bounding box includes the shadow too." },
      { tag: "feature", text: "New Selection Marker (magic-wand) in the Edit & Move tool, just above Align: click a region to flood-select similar colors, then delete it. Alt+A selects everything, Alt+D deselects." },
      { tag: "rust", text: "The selection flood-fill, the mask, and the delete all run in Rust; a translucent overlay shows exactly what’s selected." },
      { tag: "feature", text: "The Batch Image Editor’s text overlay gained Bold (applied for real to every image) and a font-family picker." },
      { tag: "fix", text: "Bézier pen: a Background color now fills any path — an open curve or a full circle — not just explicitly-closed ones. And committed pen paths now show up as “Pen Path” in the Reselect list." },
    ],
  },
  {
    version: "v0.9.25",
    date: "2026-06-24",
    headline: "Faster engine, an Edit & Move tool, and safer deletes",
    entries: [
      { tag: "perf", text: "Histograms now compute in Rust straight from the image buffer instead of re-sampling the canvas every time the picture changes — smoother, lighter, and much easier on your battery." },
      { tag: "perf", text: "All the pixel blending — shapes, text, and layers — was rewritten to use fast integer math instead of slower floating-point. Same result, far less work per pixel." },
      { tag: "feature", text: "“Crop & Transform” is now “Edit and Move”. Crop comes first, then Transform (flip / rotate), and a brand-new Align section with six buttons to snap a selected text or shape to any edge or the center of the canvas." },
      { tag: "rust", text: "Aligning is computed in Rust (a new `align_annotation` export): it measures the object’s bounding box and moves it precisely, as a single undo step." },
      { tag: "ui", text: "Cleaner panels — the Tools, Review, and Gallery headers dropped their titles and close buttons; the buttons themselves are the header now (close panels from the top bar). The Gallery keeps its photo count and all delete / select actions." },
      { tag: "ui", text: "The Review panel gained a live Histogram section and switched its section switcher to compact icons." },
      { tag: "feature", text: "Deleting a photo now asks first — the trash icons, the right-click “Delete image”, “Delete Selected”, and “Delete All” all confirm before anything is removed." },
      { tag: "feature", text: "New Reduce Motion toggle (Settings → Appearance → Motion) minimizes panel slides and transitions for a calmer, faster interface — saved with your account." },
      { tag: "fix", text: "The emoji picker now sits flush with the tools-panel edges." },
    ],
  },
  {
    version: "v0.9.24",
    date: "2026-06-24",
    headline: "Rulers & grids — line up your edits with on-canvas guides",
    entries: [
      { tag: "feature", text: "New Rulers & Grids settings (Settings → Rulers & Grids). Turn on top + left pixel rulers, and overlay a grid to line things up — choose a square pixel grid, golden-ratio guides, or split the image into any number of columns and rows. Pick the grid’s color and opacity too." },
      { tag: "ui", text: "The guides sit over your photo without touching a single pixel — they track zoom and pan, and the ruler labels update as you zoom. Your settings are saved with your account." },
      { tag: "rust", text: "The grid layout itself is computed in Rust (a new `grid_lines` WASM export) as the single source of truth, then drawn as a crisp SVG overlay — so every grid type lines up exactly with the image." },
      { tag: "ui", text: "Alt+S now opens Settings (it used to rotate). Rotate is still a click away in the tools." },
      { tag: "ui", text: "The Settings window has a consistent footer everywhere — your account button on the left, Restore / Apply on the right — across General, Appearance, Rulers & Grids, and Super User." },
    ],
  },
  {
    version: "v0.9.23",
    date: "2026-06-24",
    headline: "Light mode — pick light, dark, or follow your system",
    entries: [
      { tag: "feature", text: "Image Horse now has a full light theme alongside the original dark one. Choose Light, Dark, or System in Settings → Appearance — “System” follows your operating system and switches live the moment your OS does. Your choice is saved and synced to your account." },
      { tag: "ui", text: "The whole app follows the theme — every panel, dialog, toast, the sign-in window, even the emoji picker — warm earth-tone in the dark, warm paper in the light. No flash of the wrong colors when the page loads." },
      { tag: "ui", text: "Under the hood the entire UI moved onto one set of design tokens (color, elevation, radius, motion, and a z-index ladder), so the two themes stay perfectly in step and the interface can’t drift out of sync." },
    ],
  },
  {
    version: "v0.9.22",
    date: "2026-06-24",
    headline: "A real Bézier pen — draw, fill, and re-edit vector paths",
    entries: [
      { tag: "feature", text: "New Pen tool (Paint → Pen) — a Photoshop-style Bézier pen. Click to drop corner points, click-drag to pull smooth curve handles, and grab any point or handle to reshape the path as you go. Enter closes it, Esc leaves it open." },
      { tag: "feature", text: "Give a path a background — flip the Pen panel’s background to Solid and a closed path fills its interior, under the stroke, curves and all." },
      { tag: "feature", text: "Pen paths stay editable — click a finished path to re-open it with all its anchors and handles, drag to reshape, and it re-commits as a single undo step. Paths survive switching photos, reloads, and cloud sync." },
      { tag: "ui", text: "Compress panel wording — the buttons now read “Compress Image” and “Compress All Images”, and “Compress All Images” hides when your gallery holds a single image." },
      { tag: "ui", text: "Download dialog — the clipboard button reads “Clipboard Copy”, and the “All” button only shows when you have more than one image." },
      { tag: "fix", text: "With the Pen active, the gallery and side panels stay clickable on tall images (the pen’s drawing layer no longer sits on top of the toolbar)." },
      { tag: "rust", text: "Under the hood: Bézier paths are a new Rust annotation kind — flattened with de Casteljau and filled with a scanline polygon fill — so they inherit history, re-edit, and persistence for free." },
    ],
  },
  {
    version: "v0.9.21",
    date: "2026-06-24",
    headline: "Settings menu, pick-your-format downloads, and a hardening pass",
    entries: [
      { tag: "feature", text: "New Settings menu — the gear by your avatar opens a tidy window with General (set your undo-history depth, and an idle screen) and Plan & Billing, all in one place." },
      { tag: "feature", text: "Pick your format right in the Download dialog — a JPEG / PNG / WebP / AVIF card picker now lives in the box, so you can switch formats without hunting for the Compress dropdown. It stays in sync with the panel." },
      { tag: "feature", text: "Tunable undo history — crank undo up to 1000 steps (or keep it lean) from Settings → General. More undo is yours for a little more memory." },
      { tag: "feature", text: "Idle power-saver — leave a tab open a while and it dims to a “Continue with Image Horse” screen so your browser can throttle the tab and save battery. Your edits are kept; click to come right back." },
      { tag: "ui", text: "Download dialog polish — a proper header and footer, and the “All” button only appears when you actually have more than one image. Export Selected now opens the same dialog so you can choose a format first." },
      { tag: "fix", text: "Quieter, clearer errors — cloud-sync failures now surface in the Diagnostics window instead of vanishing, plus a stray image-reload fix and some debug-log cleanup under the hood." },
    ],
  },
  {
    version: "v0.9.20",
    date: "2026-06-24",
    headline: "Stroke stabilizer, lettered pins, and a big UI consistency pass",
    entries: [
      { tag: "feature", text: "Paint stroke stabilizer — turn on Low / Med / High smoothing and the brush tip trails the cursor on a leash, so quick jitters never reach the canvas (great for steady freehand lines). Off by default." },
      { tag: "feature", text: "Pins can now be lettered — the Pins tool drops auto-sequenced callouts as numbers (1, 2, 3…) or letters (A, B, C…), each centered in its disc, sized by the stroke-width slider. Freehand pen was retired in favor of cleaner callouts." },
      { tag: "feature", text: "Download chooser — one Download button now opens a tidy Selected / All / Cancel dialog when you have more than one image, and multi-image exports come down as a .zip." },
      { tag: "ui", text: "The top-bar Upload button is now New (it also makes blank canvases), and its shortcut moved to Alt+N." },
      { tag: "ui", text: "Toolbar refresh — the tool grid is calmer and more even: neutral tiles with only the active tool colored, a soft accent ring on hover, and sizes that scale cleanly at any width." },
      { tag: "ui", text: "Across every settings panel: tighter, consistent spacing, unified slider and button controls, and pickers whose buttons all match size even when a label is long (so other languages won't break the grid)." },
      { tag: "ui", text: "Dialogs now match the rest of the app — same surface, the same little close button, and no stray focus ring." },
      { tag: "fix", text: "Fixed a Firefox-only glitch where the canvas could turn to garbage after several brush strokes, and fixed the canvas/gallery drifting out of alignment when the toolbar was open." },
      { tag: "fix", text: "Exported edits can keep or strip EXIF — a padlock in Compress lets photographers keep GPS/time/camera metadata or scrub it for privacy (was shipped just before this; now exposed everywhere export happens)." },
      { tag: "infra", text: "This Trail Log got a sticky month filter at the top so you can jump straight to a month." },
    ],
  },
  {
    version: "v0.9.19",
    date: "2026-06-23",
    headline: "EXIF privacy control + a Current Image Meta panel",
    entries: [
      { tag: "feature", text: "EXIF padlock on export — a lock toggle in the Compress panel decides what leaves your machine. Locked keeps your photo's metadata intact (GPS, capture time, camera and lens) — great for photographers — while unlocked strips it for privacy. It applies to Export, Export All, and Export Selected, and it closes a gap where an untouched original used to carry its GPS location into the exported ZIP." },
      { tag: "feature", text: "Current Image Meta — a new tab in the Diagnostics Window (Alt+Delete) shows the live SHA-256 fingerprint of the current canvas (it changes with every edit), the original's SHA-256 content key, the image's dimensions and byte sizes, and its EXIF: camera, lens, capture time, exposure, and GPS as a one-click map link, with a heads-up when location is embedded." },
      { tag: "ui", text: "The EXIF lock reuses the familiar padlock and badge styling from elsewhere in the app, with a two-line label that spells out exactly what's kept or removed on export." },
    ],
  },
  {
    version: "v0.9.18",
    date: "2026-06-23",
    headline: "Diagnostics Window polish + a tidier shortcut menu",
    entries: [
      { tag: "ui", text: "The Diagnostics Window (Alt+Delete) is now centered and taller, with a soft blur behind it, and both tabs — System Telemetry and Resources — are the same height. The event log scrolls on its own, and the count next to the tab is easier to read." },
      { tag: "feature", text: "Alt+Delete now opens the Diagnostics Window for everyone, every time — no secret unlock required." },
      { tag: "ui", text: "The keyboard-shortcut menu lists the Diagnostics Window under an always-visible Dev Tools section. The User / Tier Selector moved into a hidden Secret Menu that only appears — and only works — after you triple-click the status-bar button." },
    ],
  },
  {
    version: "v0.9.17",
    date: "2026-06-19",
    headline: "Blur, pixelate & redaction tools + a Diagnostics Window",
    entries: [
      { tag: "feature", text: "The blur brush now has three modes — Soften (Gaussian), Pixelate (a mosaic of big squares, adjustable block size), and Solid (paint an opaque color over something). Perfect for hiding faces, license plates, or sensitive text before you share an image." },
      { tag: "feature", text: "Redaction boxes — drag a rectangle to cover an area with a solid color or a pixel mosaic. Because it's a real shape, you can reselect, move, resize, undo, and put it on its own layer, just like any other box." },
      { tag: "rust", text: "Pixelate and redaction run entirely in Rust over the brushed (or boxed) region — grid-aligned mosaic averaging and opaque fill — so they stay fast and edit the active layer in place." },
      { tag: "ui", text: "The Review panel header now shows the magnifying-glass icon, matching the Review button in the top bar (it used to show the history clock)." },
      { tag: "feature", text: "Diagnostics Window (Alt+Delete) — renamed, and now split into two tabs: System Telemetry (the event log) and Resources, a small htop-style view of FPS / main-thread load, JS memory, the WASM engine's memory, and what each subsystem is doing. Its backdrop is lighter now so your image stays visible behind it." },
      { tag: "infra", text: "Security hardening — the AI (Replicate) webhook now verifies its signature and only pulls results from trusted hosts, upload URLs require sign-in, and subscription records can only be written by the verified billing webhook." },
    ],
  },
  {
    version: "v0.9.16",
    date: "2026-06-18",
    headline: "Shape fill & gradients, sharper thumbnails, configurable stamps",
    entries: [
      { tag: "feature", text: "Shapes can now be filled — give any rectangle or circle a solid background color or a two-color linear gradient, with From/To swatches and a direction picker (→ ↓ ↘ ↙). The outline draws on top, and the fill follows the shape when you reselect, move, or resize it." },
      { tag: "rust", text: "Fill rendering lives entirely in Rust — a new fill_shape routine paints the solid color or per-pixel gradient under the stroke, threaded through the shape add/update/restore paths and the saved-edit format so fills round-trip through save and undo/redo." },
      { tag: "ui", text: "The live drag preview shows the fill and gradient as you draw (via an SVG gradient), and the Fill controls reuse the app's existing swatch grid and button groups so they match the rest of the Shapes panel." },
      { tag: "fix", text: "Reselecting a filled shape no longer swaps its fill — moving or resizing it keeps the color or gradient it was drawn with instead of picking up the panel's current setting." },
      { tag: "ui", text: "The Review button now uses a magnifying-glass icon instead of the history clock, so it no longer looks identical to the History section." },
      { tag: "rust", text: "Thumbnails are sharper and cleaner — downscaling now samples in linear light with premultiplied alpha, so midtones no longer darken and transparent edges no longer fringe with stray color." },
      { tag: "rust", text: "The red rubber-stamp tilt is now a parameter (still −5° by default) instead of a hard-coded constant, ready to be made adjustable." },
      { tag: "fix", text: "The crop-ratio helpers return a clear empty result on bad input instead of a silently-empty array, so a malformed call can't quietly produce a zero-size crop." },
    ],
  },
  {
    version: "v0.9.15",
    date: "2026-06-18",
    headline: "AI tools go live (Replicate) + Stripe billing",
    entries: [
      { tag: "feature", text: "Background Removal is live — one click runs rembg on Replicate and drops the cut-out straight back onto the canvas (paid tier)." },
      { tag: "feature", text: "Text Extract (OCR) — pull the text out of any image via Replicate OCR, shown in a copy-to-clipboard panel." },
      { tag: "feature", text: "Object Removal — brush over an object in a mask painter and LaMa inpainting erases it and fills the gap; your image and mask are uploaded together." },
      { tag: "infra", text: "AI pipeline: a Convex action dispatches each job to Replicate with a signed source frame and a completion webhook, pulls the result into Convex storage, and streams it back to the canvas. Text models persist their output as text." },
      { tag: "feature", text: "Stripe billing — a Settings gear next to your avatar opens a Plan & Billing popup with the $10/mo Pro plan. Upgrade runs Stripe Checkout; subscribers get the Stripe Customer Portal to manage or cancel." },
      { tag: "infra", text: "Billing backend: Checkout and Portal run through Convex actions, and a signature-verified Stripe webhook flips your account tier and records the subscription." },
      { tag: "fix", text: "Signing in now creates your account record — a new hook upserts the Convex user row once you are authenticated, so tier, subscription, and AI access finally have something to read." },
      { tag: "fix", text: "Oversized uploads can no longer crash the tab — images past ~100 MP are rejected with a toast before the full-resolution decode can blow past the WASM memory limit." },
      { tag: "perf", text: "The anonymous-edit cleanup job now uses an indexed range scan instead of a full table scan, so it keeps reclaiming abandoned storage as data grows." },
    ],
  },
  {
    version: "v0.9.14",
    date: "2026-06-18",
    headline: "Blank Canvas, gallery duplicate, hidden dev tools, faster uploads",
    entries: [
      { tag: "feature", text: "Blank Canvas — start from scratch with a Photoshop-style New Document panel that slides in over the upload actions. Set width × height (default 1500 × 1000), pick a page-size preset (FHD, Square, Story, 4×6, 5×7, 8×10), and choose a background: white, black, any hex color, or fully transparent." },
      { tag: "rust", text: "The blank canvas is generated entirely in Rust — a new blank_png fill-and-encode path produces the solid (or transparent) PNG with no browser <canvas> or toBlob round-trip, and the background color is parsed in Rust too." },
      { tag: "feature", text: "Duplicate photos — select one or more in the gallery and hit Duplicate; each copy lands right after its original and carries over its edits. Because originals are content-addressed, duplicating copies zero pixels." },
      { tag: "perf", text: "Uploads now decode once instead of twice — the gallery thumbnail is built from the already-decoded working image (downscaled in Rust) rather than decoding the source file a second time." },
      { tag: "feature", text: "Hidden Dev Tools — three clicks on a tiny unlabeled spot in the status bar unlock the diagnostics log and the tier/user selector (and list them in the shortcuts sheet), now reachable in production builds, not just dev." },
      { tag: "ui", text: "Shortcuts reshuffled — Tools is now Alt+T, the Review panel is Alt+R, and Rotate 90° is Alt+S. The Alt+/ reference and the top-bar tooltips were updated to match." },
      { tag: "fix", text: "Spacebar pan works again after clicking a tool — last release's keyboard-activation change let a mouse-focused button swallow Space; it now only defers Space to keyboard-focused (Tab) controls, so hold-Space-to-pan is back." },
      { tag: "ui", text: "Gallery counter reads cleaner — \"3 of 3 — 12 max\" normally and \"Selected: 2 of 3\" while selecting, with an (i) that explains the per-tier photo limits (logged out 12, logged in 24, paid 100)." },
      { tag: "fix", text: "Delete All dialog — the buttons now match the rest of the app, and the Cancel button's text no longer disappears on hover (a duplicated theme token was painting dark-on-dark for every outline button)." },
      { tag: "ui", text: "Upload dialog refresh — actions reordered (Browse / Paste, then Sample Images / Blank Canvas), the sign-in icon moved to the top-left corner, and the drag-and-drop area is now a dotted drop zone that highlights and nudges when you drag an image over it. \"Test Images\" is now \"Sample Images\", and the footer links out to the live site, GitHub, and Codeberg." },
      { tag: "ui", text: "The Auto-Compress progress toast finally spans the full width — its text and progress bar now fill the toast edge-to-edge instead of bunching up in the left third." },
      { tag: "ui", text: "The four panel toggles in the top bar are now properly centered on the bar, and the Review panel header matches the Toolbar and Gallery headers (icon + same type)." },
    ],
  },
  {
    version: "v0.9.13",
    date: "2026-06-17",
    headline: "Photoshop-style layers — per-layer tools, compositing, clipboard paste",
    entries: [
      { tag: "feature", text: "Layers are live. Add, duplicate, reorder, show/hide, set per-layer opacity, merge down, and flatten — every canvas tool (paint, clone stamp, blur, brightness/contrast, text, shapes, emoji, paste) now edits the active layer, and the canvas shows all visible layers composited bottom-to-top. v1 ships opacity + visibility (normal blending). Gated to logged-in / paid tiers." },
      { tag: "rust", text: "The WASM core is no longer a single pixel buffer — ImageHorseTool holds a Vec<Layer> stack plus an active-layer index, and each layer owns its own pixels and its own text/shape overlays. New layer API (add / duplicate / remove / set_active / move / merge_down / flatten_all / visibility / opacity / get_layers) plus a source-over compositor with a reused cache and a single-opaque-layer fast path. Export and thumbnails composite the whole stack, so the saved image always matches the screen." },
      { tag: "rust", text: "Undo/redo now snapshots the entire layer stack, so adding, deleting, reordering, and merging layers are all undoable alongside ordinary pixel edits. Jump-to-history became an undo/redo loop and the clone-stamp engine takes a pre-built snapshot." },
      { tag: "feature", text: "Paste an image straight from the clipboard (Ctrl/Cmd+V) into the active layer, centered, as one undoable step — guarded so it doesn't collide with the upload dialog's paste-as-new-photo." },
      { tag: "infra", text: "Persistence v5 — the IndexedDB save and the Convex binary archive now serialize the full layer stack (per layer: pixels, name, visibility, opacity, and its own text/shape overlays) plus the active layer id. Reopening a photo rebuilds the stack; v1–v4 archives still load and collapse to a single layer. (Undo history past a reload still restores as the flattened image — a follow-up.)" },
      { tag: "ui", text: "Layers panel in the Review sidebar — the old Coming Soon placeholder is now a working stack list (top→bottom) with a visibility eye, inline rename, reorder, duplicate, merge-down, delete, and a per-layer opacity slider. Tier-gated, with a lock state for the demo tier." },
      { tag: "ui", text: "New extra-small icon-button variant powers the dense layer-row controls — always-visible background, hover ring, light icon — while the eye keeps its own open/closed swap. Less variant sprawl, consistent feel." },
      { tag: "fix", text: "The layer-count badge showed the tier limit instead of the actual number of layers; it now shows the real count, with the limit in the tooltip." },
      { tag: "fix", text: "Keyboard accessibility — Tab to a button and press Space or Enter and it now activates. The global spacebar-pan handler was swallowing Space for any focused control; it now defers to buttons, links, and ARIA widgets." },
      { tag: "fix", text: "Editing a text box no longer shows a ghosted second copy underneath the editor — the baked tile is suppressed while the textarea overlay is open, mirroring how shapes already behave." },
      { tag: "fix", text: "Text rotation lands true. The editing overlay now rotates around the same pivot the Rust tile bakes to, and the baked tile's rotation direction was flipped to match the clockwise preview — a +90° rotate was previously coming out as −90°." },
      { tag: "ui", text: "The keyboard-shortcuts reference (Alt+/) now lays each section out in two columns, and lists Alt+Delete to toggle the Diagnostics Log." },
    ],
  },
  {
    version: "v0.9.12",
    date: "2026-06-16",
    headline: "Review panel, 360° bubble tails, dev tier switcher",
    entries: [
      { tag: "feature", text: "AI Tools: Background Removal is live. One click hands the canvas PNG to a real Convex → Replicate pipeline (rembg model), with a phase-state button (Uploading… / Removing background…) and a reactive Convex subscription on the job row. When the webhook completes, the result image streams back, decodes to RGBA, and replaces the working image — the photo is marked modified so the change persists. Gated to the Paid tier; non-Paid users see an inline Lock notice. Other AI models (OCR, 4× Upscale, Object Removal, Alt Text) remain Coming Soon placeholders awaiting the same plumbing." },
      { tag: "ui", text: "Auto Compress split into explicit Selected / All buttons. A centred ⚡ Auto Compress label sits over a two-button row — Selected Image (or Selected Images when more than one is checkbox-selected) and All Images — followed by an HR separator and then Apply Compression & Resize and Show A/B Compare. Selected scope compresses the checkbox multi-selection when one exists, otherwise just the active photo in the ring, so the button is always meaningful." },
      { tag: "feature", text: "New Pens tab in the Shapes tool — sits between Shapes and Arrows. Pins mode drops auto-numbered callout discs (1, 2, 3…) on click with a Pin Size slider; click an existing pin to move it. Freehand mode draws a thick, round-capped polyline pen stroke on drag with its own Stroke Width slider. Both share the colour swatch." },
      { tag: "rust", text: "Pens are real Rust shapes — two new kinds (5 = pin, 6 = polyline) added to ShapeAnnotation, with add_pin_annotation / add_polyline_annotation APIs, render_pin (filled AA disc + centred ab_glyph number), drawing::draw_polyline (round-capped segment loop), and drawing::fill_circle. ShapeAnnotation gained number (pin label) and points (polyline vertices); get_shape_annotations JSON, PersistedShape, and the restore path round-trip both. Polyline hit-testing uses per-segment distance; pins reuse the padded-bbox path. The live freehand preview is drawn in JS during the drag and committed to Rust on mouseup." },
      { tag: "feature", text: "History panel rebuilt as a Review panel — one collapsible panel hosting three independent sections: History (undo timeline), Reselect (live text and shape annotations), and Layers (placeholder). Open any combination; the body splits evenly between open sections — 1 full, 2 halves, 3 thirds — each with its own scroll area and header." },
      { tag: "ui", text: "Shared ToggleButtonGroup component drives the top bar's Upload / Tools / Gallery / Review cluster and the Review panel's History / Reselect / Layers cluster. Multi-select (each button independent), compact icon mode, label-only mode for narrow panels, evenly-spread fill option." },
      { tag: "rust", text: "Speech-bubble tail is now a 360° angle, not five discrete directions. Drag the Tail Direction slider and the tail sweeps continuously around the bubble. Rust builds the tile with a uniform margin on all sides and projects a ray from the bubble center onto the rect edge to place the tail base; live preview uses identical math." },
      { tag: "ui", text: "Compress is the first tab in the Resize tool — the panel now opens on Compress (the more common starting point), and the toolbar tooltip reads Compress & Resize." },
      { tag: "ui", text: "Text panel's second tab renamed Background (was Text Background); the Background Color / Padding / etc. labels carry the rest of the context. Corner Radius simplified to three presets — Square / Rounded / Circle — so the bubble tail stays flush at any radius." },
      { tag: "infra", text: "Centralized tier config — new lib/tiers.ts is the one place per-tier capabilities live (gallery cap, storage quota, layers per image, AI runs per day), keyed by tier. Components read from TIERS[mode] instead of hardcoding numbers. Mirrors the public Pricing matrix." },
      { tag: "feature", text: "Dev tier switcher — Alt+L opens a small dialog to flip between No Login / Free / Paid tier modes for testing, shown only in dev builds." },
      { tag: "feature", text: "Gallery Unselect button — when one or more photos are selected, a new Unselect button appears in the gallery header alongside Export Selected, Delete Selected, and Delete All. One click clears every checkbox." },
      { tag: "fix", text: "Modified-dot race — clicking an unedited photo no longer briefly flashes the white modified-edit dot on it. The dot effect was attributing the outgoing photo's lingering undo count to the incoming selection; now it gates on the loading flag, which is set before any await." },
      { tag: "ui", text: "Crop tool spacing — the Transform heading sits tighter against the Flip H / Flip V / Rotate buttons, matching the rhythm Ratio uses for its ratio buttons in the same panel." },
      { tag: "rust", text: "drawing::rounded_rect_coverage, triangle_coverage, and blend_coverage — three public coverage helpers in src/drawing.rs that produce per-pixel α for AA rounded rects and triangles, with Porter-Duff source-over compositing. Foundation for further shape-edge AA work and the bubble-tail flushness fix." },
      { tag: "ui", text: "Trail page renamed Trail Log — the URL is /trail-log, the nav and footer labels and the page eyebrow all read Trail Log." },
    ],
  },
  {
    version: "v0.9.11",
    date: "2026-06-13",
    headline: "Shapes & arrows go live — reselect, move, resize, delete",
    entries: [
      { tag: "feature", text: "Every shape (rect, circle, hand-drawn circle, line) and both arrow styles now commit as a live ShapeAnnotation instead of rasterizing immediately — same non-destructive overlay treatment text already had. Click a committed shape to re-select it on the canvas; drag the body to move; drag corner squares to resize; drag endpoint circles to re-angle lines and arrows." },
      { tag: "feature", text: "Reselect panel — the right-side History panel grew a Reselect list of every live text and shape annotation. Click a row to jump the canvas selection to it; trash icon removes it. The old TextSettings Recent texts list moved here so all live overlays share one home." },
      { tag: "rust", text: "Eight new wasm-bindgen exports drive the shape system: add / update / remove / restore / hit-test / count / set_editing_shape / get_shape_annotations — the same shape as the text annotation surface." },
      { tag: "rust", text: "History snapshots now carry shape annotations alongside text annotations — undo/redo swap both lists in lockstep so reselect-and-edit is a normal undo entry." },
      { tag: "infra", text: "Persistence v4 — the IDB SavedEdit and the Convex binary archive both serialize the shape annotation vec; reopening a photo restores every live overlay. v1–v3 still decode for back-compat." },
      { tag: "fix", text: "Text rotate handle — the drag math used a stale center reference when the box was already rotated, drifting the angle on each adjustment. Smooth rotation now holds." },
      { tag: "rust", text: "Stamp dab f32 polish — extends the June hot-loop pass to the dab kernel's edge case, removing a residual f64 cast in the inner loop." },
    ],
  },
  {
    version: "v0.9.10",
    date: "2026-06-12",
    headline: "June optimization pass — faster Rust, smaller WASM, Squoosh-style resize, shape edit boxes",
    entries: [
      { tag: "perf", text: "WASM binary down 60% — 1.10 MB to 443 KB — by subsetting the embedded Liberation Sans fonts to Latin-1 + Extended-A, plus a sweep of Rust hot-loop optimizations (f32 math, opaque-source fast paths, cached blur kernels, VecDeque undo stack)." },
      { tag: "perf", text: "Zero-copy canvas painting — the display blit reads WASM linear memory directly instead of cloning the full pixel buffer every frame, eliminating ~1 GB/s of allocator churn during brush strokes." },
      { tag: "rust", text: "Three resampling filters join bilinear: Lanczos3 (default), Catmull-Rom, and Nearest — separable two-pass with minification-aware kernels, selectable from the new Method dropdown." },
      { tag: "feature", text: "Squoosh-style Resize panel — Scale % slider, Dimensions with aspect lock, then a Compress section grouping Method, Format (moved out of the top bar), and Quality." },
      { tag: "feature", text: "Apply Compression & Resize re-encodes at the chosen format and quality, swaps the stored file, and updates the status-bar size, dimensions, and gallery tooltip in place." },
      { tag: "feature", text: "PageSpeed Insights score (renamed from Lighthouse) now models Google's real image audits: next-gen format ratios (WebP/AVIF score higher) and an oversize penalty past 1920px." },
      { tag: "feature", text: "Shape & Arrow edit boxes — all four shapes and both arrow styles drop into a Figma-style overlay with resize squares, a move handle, and per-endpoint circles for lines/arrows. Commit still rasterizes in Rust, one history snapshot per shape." },
      { tag: "feature", text: "Export gating — single Export disabled until the active photo has edits; Export All needs two or more photos with at least one edited, each with a tooltip explaining why." },
      { tag: "fix", text: "A/B Compare overhauled — unlocks on any pending panel change, always compares against the immutable upload original, and the overlay now tracks zoom and pan transforms instead of drifting." },
      { tag: "fix", text: "Levels blur slider — JS was sending a 0–1 fraction into Rust's u32 intensity (truncated to 0 → invisible blur); now mapped to the 1–30 kernel range." },
      { tag: "fix", text: "Many small fixes — eyedropper added to the right-click menu, Delete-All canvas ghost cleared, sidebar tooltip copy refreshed, upload-dialog link styled as a LargeButton." },
      { tag: "ui", text: "Keyboard accessibility pass — focus-visible accent ring (was globally suppressed), tabbable gallery thumbs and history entries, upload dialog focuses Browse Files on open and closes on Escape." },
      { tag: "ui", text: "Architecture page returns — the full backend diagram (client → WASM → auth → API → storage/Convex/AI) rebuilt and re-linked in the nav and footer; pricing details stay on the Pricing section." },
      { tag: "ui", text: "GitHub and Codeberg buttons in the nav beside Beta Version — the source lives on both forges." },
      { tag: "infra", text: "UploadThing now also hosts the demo's Test Images set — the royalty-free photos behind the upload dialog's Test Images button." },
      { tag: "infra", text: "Dead code removed per fallow: five unused modules, stale exports, and the unused autoprefixer dependency." },
    ],
  },
  {
    version: "v0.9.9",
    date: "2026-06-12",
    headline: "Non-destructive text + speech bubbles + AI panel",
    entries: [
      { tag: "feature", text: "Live text annotations — text never commits to canvas pixels until export. Click an existing text on the canvas to re-open the input box with its content, font, color, and rotation; submit updates in place." },
      { tag: "feature", text: "Text Background tab — add a rounded rectangle behind any text, or wrap it in a speech bubble with a tail (5 directions). Background color, padding, corner radius, and opacity sliders." },
      { tag: "rust", text: "Eight new wasm-bindgen exports drive the annotation system: add / update / remove / hit-test / count / get-json / render-with / flatten — display always blits through render_with_annotations when count > 0." },
      { tag: "rust", text: "drawing::fill_rounded_rect — anti-aliased rounded fill via per-pixel distance test; drawing::fill_triangle_public renders speech-bubble tails. The whole bubble rotates together (not just the text)." },
      { tag: "ui", text: "Line-and-dot handles — stem + filled circle for both move (native cursor) and rotate (custom data-URI SVG cursor with stacked black-outer + white-inner strokes for visibility on any background)." },
      { tag: "ui", text: "Sticky text input — the editing box no longer closes when you click a color swatch or font dropdown. Document-level pointerdown listener only commits on clicks truly outside the editing surface." },
      { tag: "feature", text: "Text Extract removed and repositioned — Tesseract.js dependency dropped, Rust extract_region_png removed. The feature now lives in a new AI tool panel as a Coming Soon card alongside Background Removal, 4× Upscale, and Object Removal." },
      { tag: "ui", text: "Unified ColorSwatchGrid — Paint, Shapes, Arrows, and Text Background tabs all share the same palette and custom-colors list (localStorage-persisted via useUserColors, parsed by Rust parse_color)." },
      { tag: "infra", text: "Annotation persistence v2 — IDB SavedEdit gained an annotations field, and the Convex binary archive bumped to v2 with trailing JSON (v1 still decodes for back-compat)." },
      { tag: "feature", text: "Gallery multi-select — checkboxes appear on hover and stay visible once at least one is selected; a Delete N selected action surfaces in the gallery header." },
    ],
  },
  {
    version: "v0.9.8",
    date: "2026-06-12",
    headline: "Smart export, batch text, and a unified button system",
    entries: [
      { tag: "feature", text: "Smart Export All — each photo exports its processed result (edits, compression, or resize re-encoded at the chosen format + quality), or the untouched original when nothing changed." },
      { tag: "feature", text: "Batch Text is live — type once and stamp text onto every photo in the gallery; rendered in Rust with the embedded font, and the active photo stays undoable." },
      { tag: "feature", text: "Logo replace, not stack — re-applying the batch logo swaps the previous one instead of layering a second logo on top." },
      { tag: "feature", text: "Test Free Images — load a set of 12 royalty-free sample photos straight into the editor to try things out." },
      { tag: "feature", text: "Per-photo file size now shown in the status bar, beside the dimensions, and updates after Auto Compress." },
      { tag: "rust", text: "Byte-aware Lighthouse score — a Rust web-performance model (log-normal curve) powers the Resize panel's Web Performance Gain and Lighthouse readouts." },
      { tag: "rust", text: "Batch text and Export All compositing run through Rust (measure_text / commit_text and encode_png_pixels on a throwaway ImageHorseTool)." },
      { tag: "ui", text: "Unified button system — new LargeButton and TinyButton primitives give every action and icon button one consistent look (export, apply, compress, delete, close, user)." },
      { tag: "ui", text: "Status bar refresh — rotating shortcut hints with the active tool swapped in and Alt+/ pinned." },
      { tag: "ui", text: "Auto Compress progress now appears as a toast with a progress bar instead of an inline toolbar bar." },
      { tag: "ui", text: "Gallery polish — Delete All in the header, trash-can remove buttons, and a hover tooltip showing each photo's name, size, and dimensions." },
      { tag: "ui", text: "Responsive layout under 1000px — the top bar collapses to icons and the toolbar slims down with smaller tool icons." },
      { tag: "ui", text: "Clerk sign-in now uses a dark theme that matches the editor." },
    ],
  },
  {
    version: "v0.9.7",
    date: "2026-05-27",
    headline: "Batch Image Editor + grid mosaic",
    entries: [
      { tag: "feature", text: "Batch Image Editor — tool renamed from \"Images\"; real panel with Logo / Text tab toggle and a grid mosaic of the gallery." },
      { tag: "feature", text: "Bulk logo stamp — pick a PNG/JPG/WebP/SVG, choose corner + size + opacity + margin, apply to every photo in one pass. Active photo gets an undo entry; others persist directly to IDB." },
      { tag: "feature", text: "SVG logo support — rasterized via <img> + OffscreenCanvas with a 512×512 fallback when the SVG omits intrinsic dimensions." },
      { tag: "mock", text: "Batch Text overlay — mock UI in place (textarea, font, color, position, opacity); apply button shows a Coming Soon badge." },
      { tag: "feature", text: "Grid canvas mode — when Batch Image Editor is active, the canvas becomes a 5×3 mosaic; selected photo is a 2×2 hero tile, surrounded by up to 11 clickable thumbnails. Caps at 12 visible with a +N more badge." },
      { tag: "ui", text: "Selected indicator — orange ring + pill badge on the hero tile; placeholder overlay shows when no photo is loaded." },
      { tag: "fix", text: "Auto-select first photo — keeps the hero populated after session restore or photo deletion." },
      { tag: "fix", text: "Canvas survives container resize — flushToCanvas re-blits the WASM buffer via a ResizeObserver. Fixes the blank-hero bug when switching tools." },
      { tag: "rust", text: "composite_pixels — stateless RGBA alpha-compositing exposed as a free wasm-bindgen function." },
      { tag: "rust", text: "resize_pixels — stateless bilinear resize. Batch logo scaling moves from OffscreenCanvas to Rust." },
      { tag: "rust", text: "encode_png_pixels — stateless PNG encoding. Batched photo outputs skip canvas.convertToBlob entirely." },
      { tag: "ui", text: "Marketing link in upload dialog footer; darker .checkerboard-dark variant for the grid surround." },
    ],
  },
  {
    version: "v0.9.6",
    date: "2026-05-15",
    headline: "Image Horse rename + originals store",
    entries: [
      { tag: "feature", text: "App renamed Image Horse — was Clone Stamp App; WASM struct renamed CloneStampTool → ImageHorseTool." },
      { tag: "feature", text: "Content-addressed originals — SHA-256-keyed IndexedDB store; originals survive photo switching and page reload at full resolution." },
      { tag: "perf", text: "Working copies — uploads downscaled to ≤2048px long edge via createImageBitmap; 256px WebP thumbnails generated in parallel." },
      { tag: "fix", text: "CompareSlider alignment — overlay tracks the canvas bounding box via ResizeObserver; before/after layers share one coordinate space through zoom and pan." },
      { tag: "perf", text: "Compare URL on demand — originalUrl populated only when compare activates; revoked on cleanup." },
      { tag: "ui", text: "Apply Resize and Quality — button renamed; disabled until width, height, or quality actually changes." },
    ],
  },
  {
    version: "v0.9.5",
    date: "2026-05-14",
    headline: "Text rotation + Convex archive format",
    entries: [
      { tag: "feature", text: "Text rotate handle — SVG rotate circle above the text box; drag to rotate before committing." },
      { tag: "ui", text: "ColorSwatchGrid — shared color swatch grid used across brush, text, arrow, and shape settings." },
      { tag: "ui", text: "StatusBar auth mode — shows Demo or Signed In badge based on Clerk state." },
      { tag: "perf", text: "Binary archive format for Convex edit history — canvas + undo/redo stack serialized as a compact binary archive instead of per-snapshot file uploads." },
      { tag: "infra", text: "session_edits Convex table — 3-day expiry cron cleans up stale edits automatically." },
    ],
  },
  {
    version: "v0.9.4",
    date: "2026-05-13",
    headline: "Tabbed tool panels",
    entries: [
      { tag: "ui", text: "Stamp tool — 3-tab panel (Clone / Stamps / Emojis); emojis tab houses the full @emoji-mart picker." },
      { tag: "feature", text: "Emoji tool → Images — toolbar tool renamed (now Batch Image Editor in v0.9.7)." },
      { tag: "ui", text: "Shapes tool — Shapes / Arrows tab switcher; Arrows tab now shows full arrow settings." },
      { tag: "infra", text: "Dual persistence — useEditPersistence routes canvas saves to Convex file storage (signed in) or IndexedDB (anonymous); useRecentTexts mirrors the same pattern." },
    ],
  },
  {
    version: "v0.9.3",
    date: "2026-04-23",
    headline: "Color picker + font family",
    entries: [
      { tag: "feature", text: "Brush tool split into Paint / Blur Brush tabs; canvas mouse routing controlled by sub-mode." },
      { tag: "feature", text: "Effects tool — Levels (brightness/contrast) and Color Picker tabs." },
      { tag: "feature", text: "Color picker pixel magnifier — WASM get_pixel_region returns 11×11 RGBA grid; floating canvas magnifier follows the cursor." },
      { tag: "feature", text: "Font family selector — 12 browser-safe fonts; applied to the canvas text overlay, persisted in TextMemory so re-editing restores it." },
      { tag: "feature", text: "Export All shortcut — Alt + Shift + E triggers ZIP export of all photos." },
    ],
  },
  {
    version: "v0.9.2",
    date: "2026-04-22",
    headline: "Per-photo persistence + Netlify fix",
    entries: [
      { tag: "feature", text: "Per-photo edit persistence — full WASM canvas + undo/redo stack saved to IndexedDB (PNG-encoded per snapshot) when switching photos. Switching back restores the exact session." },
      { tag: "fix", text: "Clone stamp alpha compositing — Porter-Duff source-over; stroke_src_data frozen buffer prevents feedback artifacts." },
      { tag: "perf", text: "Paint dab compositing — squared-distance circle rejection replaces sqrt in the hot loop." },
      { tag: "fix", text: "Crop OOB clamp — boundary guard prevents out-of-bounds read on zero-area crops." },
      { tag: "fix", text: "Netlify build fix — removed --out-dir from wasm-pack; app/pkg is a symlink." },
      { tag: "fix", text: "Modified-photo dot — race condition fixed; dot only appears after actual brush/tool edits." },
    ],
  },
  {
    version: "v0.9.1",
    date: "2026-04-11",
    headline: "Convex schema + pan/zoom polish",
    entries: [
      { tag: "infra", text: "Convex DB + auth schema — userProfiles, projects, images, layers, annotations, history, ai_jobs, subscriptions tables defined." },
      { tag: "feature", text: "Spacebar pan — Photoshop-style hand tool; all tool handlers bypassed during pan." },
      { tag: "feature", text: "Alt+Scroll zoom — composes with pan offset; listener moved to window for reliable mounting." },
      { tag: "feature", text: "PgUp / PgDn — cycle through gallery photos." },
      { tag: "ui", text: "Blur Brush moved into the Effects panel alongside brightness + contrast." },
      { tag: "feature", text: "Crop SVG overlay — rule-of-thirds guides and 8 draggable resize handles." },
    ],
  },
  {
    version: "v0.5.0",
    date: "2026-03-20",
    headline: "Image Horse identity + Convex foundation + brightness in Rust",
    entries: [
      { tag: "ui", text: "App branded Image Horse — new horse logo SVG and product name across the editor and the README." },
      { tag: "infra", text: "Convex database integration begins — initial schema and auth wiring for projects, images, and user profiles." },
      { tag: "rust", text: "Brightness and contrast moved into Rust for instant, allocation-free adjustments." },
      { tag: "feature", text: "Red stamp tool — REJECTED / APPROVED / DRAFT / CONFIDENTIAL presets rendered as bordered, slightly-rotated labels." },
      { tag: "ui", text: "Gallery polish — photo strip with smooth loading effects and tighter thumbnail layout." },
    ],
  },
  {
    version: "v0.4.0",
    date: "2026-03-18",
    headline: "Rust migration of drawing tools",
    entries: [
      { tag: "rust", text: "Blur moved to Rust — Gaussian separable two-pass with brush-radius region masking." },
      { tag: "rust", text: "Arrows and shapes drawn entirely in WASM — anti-aliased lines, rendered arrowheads, rectangles and circles in pixel space." },
      { tag: "rust", text: "Paint and emoji tools composite through Rust pixel pipelines instead of canvas drawImage." },
      { tag: "rust", text: "Text rendering in Rust with the embedded Liberation Sans font — no browser font round-trip." },
      { tag: "rust", text: "Resize migrated to a Rust bilinear pass, replacing canvas-based scaling." },
      { tag: "infra", text: "Architecture.md added — documents the WASM + React + Convex layers and why one binary shares one pixel buffer." },
    ],
  },
  {
    version: "v0.3.0",
    date: "2026-03-16",
    headline: "Crop, resize, A/B compare arrive",
    entries: [
      { tag: "feature", text: "Crop tool with an interactive selection rectangle." },
      { tag: "feature", text: "Resize & Compress controls — first version of the panel with width / height / quality." },
      { tag: "feature", text: "A/B Resize Bar — Squoosh-style before/after divider lets you eyeball compression damage." },
      { tag: "ui", text: "Animations layered over panel transitions via Framer Motion springs." },
      { tag: "ui", text: "Styling polish across the editor — consistent spacing, hover states, and dark surface palette." },
    ],
  },
  {
    version: "v0.2.0",
    date: "2026-03-15",
    headline: "Layout merge + foundation cleanup",
    entries: [
      { tag: "infra", text: "Repo merge brings in the Yet Another Photo App layout — proper top bar, sidebar, status bar, and gallery placeholder." },
      { tag: "infra", text: ".gitignore added for node_modules and dist; package resolution errors resolved." },
      { tag: "ui", text: "First real multi-panel layout — the structure all later tools dock into." },
    ],
  },
  {
    version: "v0.1.0",
    date: "2026-02-25",
    headline: "Initial React conversion",
    entries: [
      { tag: "feature", text: "HTML / JS prototype converted to a React + Vite + TypeScript project — the scaffold the rest of the app grows on." },
      { tag: "ui", text: "Status bar added at the bottom of the editor — first version, before it learned to rotate shortcut hints." },
      { tag: "fix", text: "Zoom controls fixed and working through the new React layout." },
    ],
  },
];
