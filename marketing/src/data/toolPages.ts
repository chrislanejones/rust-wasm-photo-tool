/* The tool landing pages.
 *
 * One page per job someone types into a search box — "pixelate an image",
 * "remove object from photo" — rather than one page listing every tool, which
 * is what /features already is. A person looking to blur one face is not
 * shopping for an editor, and a page that answers the question they actually
 * asked is the one worth ranking.
 *
 * The nav's mega-menu reads this file too, so a tool is described once. Before
 * this existed the menu carried its own copy of every blurb and linked to ten
 * paths that had no pages behind them — every one of those links was a 404.
 *
 * `runsOn` is not decoration. Half these tools work with the network off and
 * half need a server we pay for, and which is which is the single thing people
 * ask about this editor. It renders as a labelled row on every page.
 */

export type RunsOn = "local" | "server" | "both";

export interface ToolPage {
  /** Router path and sitemap URL. */
  slug: string;
  /** Mega-menu group this belongs to. */
  group: string;
  /** Short label, for the menu and for related-tool links. */
  label: string;
  /** The menu's one-line blurb. */
  blurb: string;
  /** <title>. Under ~60 characters or Google truncates it. */
  title: string;
  /** <meta name="description">. 140–160 characters. */
  description: string;
  /** The page's H1. Usually the phrase someone would actually search. */
  h1: string;
  /** The opening paragraph. Reused as the menu's hover-preview text. */
  lede: string;
  runsOn: RunsOn;
  /** What you can do, as a list. Concrete verbs, no adjectives. */
  does: string[];
  /** The body, in order. */
  sections: { h2: string; p: string }[];
  /** Slugs of the tools worth reading next. */
  related: string[];
}

export const TOOL_PAGES: readonly ToolPage[] = [
  {
    slug: "/photo-editor",
    group: "Enhance",
    label: "Photo editor",
    blurb: "Crop, straighten, brightness, contrast, twelve presets.",
    title: "Free photo editor that runs in your browser — no upload",
    description:
      "Crop, straighten and correct exposure without uploading anything. Twelve presets preview on your own photo, every step undoes, and no account is needed.",
    h1: "A photo editor that never uploads your photo",
    lede: "Crop with rule-of-thirds guides, straighten, fix brightness, contrast, shadows and highlights, or set levels against a live histogram. Twelve one-click presets preview on your own photo before you keep one. Every step is an undo entry, and nothing leaves your computer.",
    runsOn: "local",
    does: [
      "Crop to a ratio or freehand, with rule-of-thirds guides",
      "Straighten a crooked horizon by dragging",
      "Brightness, contrast, saturation, shadows and highlights",
      "Levels, against a histogram that updates as you drag",
      "Twelve presets, previewed on your photo before you commit",
      "Undo and redo every step, back to the original",
    ],
    sections: [
      {
        h2: "Why it works with the network off",
        p: "The editing itself is Rust compiled to WebAssembly, running in a worker thread in your browser. That is the whole pipeline — decode, edit, re-encode — so there is no server in the loop to be slow or to be down. The first load fetches the engine; after that the tab is the editor.",
      },
      {
        h2: "Your original is kept",
        p: "The file you opened is stored untouched in the browser's own database alongside the edit list. Reverting is not an undo stack running backwards, it is the original still being there. Closing the tab does not lose it, and clearing site data does.",
      },
    ],
    related: ["/image-compressor", "/annotate-image", "/blur-image"],
  },
  {
    slug: "/image-compressor",
    group: "Enhance",
    label: "Image compressor",
    blurb: "Shrink to a size or a percentage. WebP, AVIF, JPEG, PNG.",
    title: "Image compressor — hit a target file size in your browser",
    description:
      "Compress to an exact file size or a percentage in WebP, AVIF, JPEG or PNG. Runs on your own machine, shows the page-speed effect, and does whole folders at once.",
    h1: "Compress an image to the size you actually need",
    lede: "Pick a target file size or a percentage and the editor resamples and re-encodes on your own machine — WebP, AVIF, JPEG or PNG. Page-speed scores update as you drag. Compress All does the whole gallery in one pass.",
    runsOn: "local",
    does: [
      "Target an exact file size, in KB or MB",
      "Or target a percentage of the original",
      "Export WebP, AVIF, JPEG or PNG",
      "Watch the estimated load-time effect change as you drag",
      "Compress a whole gallery in one pass",
    ],
    sections: [
      {
        h2: "Targeting a size, not a quality number",
        p: "Most tools give you a quality slider from 1 to 100 and leave you to guess which number lands under 200 KB. This one takes the size you need and searches for the quality that hits it, then tells you what it used. If the format cannot get there, it says so rather than quietly missing.",
      },
      {
        h2: "Which format to pick",
        p: "AVIF is the smallest and the slowest to encode. WebP is close behind and encodes quickly, and every browser in use now reads it. JPEG is the safe choice for anything being emailed or handed to old software. PNG only makes sense when you need transparency or the image is flat graphics rather than a photograph.",
      },
    ],
    related: ["/photo-editor", "/batch-image-editor", "/image-editor-no-upload"],
  },
  {
    slug: "/background-remover",
    group: "Select",
    label: "Background remover",
    blurb: "Cut the subject out cleanly. rembg, on a server.",
    title: "Background remover — cut out a subject cleanly",
    description:
      "One click lifts the subject off its background with a clean edge, including hair. Runs on a server and needs Pro; the job is deleted once the result comes back.",
    h1: "Remove the background from a photo",
    lede: "One click and the subject is lifted off its background with a clean edge. This one runs on a server we pay for, so it needs a Pro account — the photo goes up, the cut-out comes back, and the job is deleted afterwards.",
    runsOn: "server",
    does: [
      "Lift a subject off its background in one click",
      "Keep a clean edge through hair and fur",
      "Export a transparent PNG or drop a new background behind it",
      "Touch up the mask by hand afterwards if the edge needs it",
    ],
    sections: [
      {
        h2: "Why this one needs a server",
        p: "The segmentation model is a few hundred megabytes. Shipping that into a browser tab would mean a download longer than the job, on every first visit, so it runs on hardware we rent instead. That is also why it is the paid tier: each run costs real money, unlike everything that runs on your own machine.",
      },
      {
        h2: "What happens to the photo",
        p: "It is sent up, processed, and the result comes back. The job is deleted afterwards. It is not kept, not indexed and not used as training data. If that trade is not one you want to make for a particular picture, the local tools below do not make it at all.",
      },
    ],
    related: ["/remove-object-from-photo", "/photo-editor", "/image-editor-no-upload"],
  },
  {
    slug: "/remove-object-from-photo",
    group: "Select",
    label: "Remove an object",
    blurb: "Paint over it. Magic eraser locally; an AI pass if you sign in.",
    title: "Remove an object from a photo — free, in your browser",
    description:
      "Paint over what you want gone and the Magic Eraser fills it from the surrounding pixels on your own machine, free. Pro adds an AI pass for harder cases.",
    h1: "Remove an object from a photo",
    lede: "Paint over the thing you want gone. The Magic Eraser fills it in from the surrounding pixels on your own machine, free. For harder cases, Pro adds an AI pass that runs on a server and sends back a cleaner fill.",
    runsOn: "both",
    does: [
      "Paint over anything you want removed",
      "Magic Eraser fills from surrounding pixels, on your machine, free",
      "An AI pass on Pro for busy or structured backgrounds",
      "Clone stamp by hand when you want to decide every pixel",
    ],
    sections: [
      {
        h2: "The free one, and when it is enough",
        p: "The Magic Eraser is PatchMatch running in WebAssembly: it searches the rest of the picture for patches that fit the hole and blends them in. On grass, sky, sand, carpet, water — anything without strong structure — it is genuinely hard to tell. It struggles where a straight line or a repeating pattern has to continue through the hole, because it is copying texture, not understanding the scene.",
      },
      {
        h2: "When to reach for the paid pass",
        p: "Brickwork, tiled floors, window frames, anything with geometry running through the patch. The AI pass has a model of what the scene is, so it can carry a line across the gap. It costs a server call, which is why it is on the paid tier.",
      },
    ],
    related: ["/clone-stamp", "/background-remover", "/photo-editor"],
  },
  {
    slug: "/annotate-image",
    group: "Create",
    label: "Annotate an image",
    blurb: "Arrows, boxes, numbered pins, text bubbles, emoji.",
    title: "Annotate an image — arrows, boxes, pins and text",
    description:
      "Add arrows, boxes, numbered pins, speech bubbles, real text and emoji. Everything stays editable until export, snaps to a grid, and never leaves your machine.",
    h1: "Annotate a screenshot or a photo",
    lede: "Arrows, boxes, circles, numbered pins, speech bubbles, text in real typefaces, emoji and red review stamps. Everything stays an object you can move, recolor or delete until you export. Snap to a nine-cell grid to line things up.",
    runsOn: "local",
    does: [
      "Arrows, boxes, circles and lines, in any color",
      "Numbered pins that count themselves up",
      "Speech bubbles and real text, in real typefaces",
      "Emoji and review stamps",
      "Snap to a nine-cell grid so things line up",
      "Move, recolor or delete anything right up until export",
    ],
    sections: [
      {
        h2: "Objects, not paint",
        p: "An arrow you drew an hour ago is still an arrow. It can be dragged, recolored, resized or deleted, because annotations are kept as a list of shapes rather than burnt into the pixels. They are only flattened when you export, and the original stays untouched underneath.",
      },
      {
        h2: "Good for a bug report",
        p: "Paste a screenshot straight from the clipboard, drop three numbered pins on the things that are wrong, and export. Nothing was uploaded to a review service on the way, which matters when the screenshot has a customer's name in it.",
      },
    ],
    related: ["/pixelate-image", "/clone-stamp", "/photo-editor"],
  },
  {
    slug: "/clone-stamp",
    group: "Create",
    label: "Clone stamp",
    blurb: "Paint one part of a photo over another.",
    title: "Clone stamp tool — paint one part of a photo over another",
    description:
      "Alt-click a source, then paint: those pixels follow your brush. Adjustable size, hardness, opacity and spacing, with a stabilizer to steady the stroke.",
    h1: "Clone stamp, in a browser tab",
    lede: "Alt-click a source point, then paint: the pixels from the source follow your brush. Adjustable size, hardness, opacity and spacing, with the Stroke Stabilizer steadying your hand.",
    runsOn: "local",
    does: [
      "Alt-click to set the source, then paint",
      "Size, hardness, opacity and spacing all adjustable",
      "Stroke Stabilizer smooths a shaky hand",
      "Aligned or fixed source, whichever the job wants",
      "Every stroke is its own undo step",
    ],
    sections: [
      {
        h2: "The tool this whole thing started as",
        p: "Image Horse was called Clone Stamp App, because that is all it was. The rest grew around it. The stamp is still the tool to reach for when you want to decide every pixel yourself rather than let a fill guess — patching a blemish, extending a wall, taking a sign off a building.",
      },
      {
        h2: "Stabilizer",
        p: "The brush tip trails the cursor on a short leash, so small hand tremors never reach the canvas and a slow deliberate stroke comes out smooth. It has levels: off for precision work, higher for long curves. It is the difference between a clean patch and a wobbly one on a trackpad.",
      },
    ],
    related: ["/remove-object-from-photo", "/annotate-image", "/photo-editor"],
  },
  {
    slug: "/pixelate-image",
    group: "Edit",
    label: "Pixelate an image",
    blurb: "Block out a face, a plate, a password.",
    title: "Pixelate an image — block out a face or a password",
    description:
      "Paint a region into blocks, or use a hard black box. Runs on your machine and exports flattened, so the covered pixels are genuinely gone from the file.",
    h1: "Pixelate part of a photo",
    lede: "Paint a region and it turns to blocks; choose the block size. Or use the black-box redaction for a hard cover. It happens on your computer — the original never goes anywhere, and the export is flattened so the pixels are really gone.",
    runsOn: "local",
    does: [
      "Paint a region into blocks, at a block size you choose",
      "Or drop a hard black box over it",
      "Works on faces, plates, addresses, passwords, account numbers",
      "Exports flattened, so the original pixels are not in the file",
    ],
    sections: [
      {
        h2: "Flattened means gone",
        p: "A redaction that can be undone by whoever receives the file is not a redaction. The export bakes the blocks into the pixels and writes a new file — there is no layer underneath carrying the original, and no metadata describing what was covered. The untouched original stays on your machine only.",
      },
      {
        h2: "Blocks or a box",
        p: "Pixelation keeps the shape of what was there, which reads better in a screenshot of a UI. A solid box says plainly that something was removed, which is usually what you want for a document. For anything sensitive, prefer the box: large enough blocks are safe, but small ones can sometimes be reversed.",
      },
    ],
    related: ["/blur-image", "/annotate-image", "/image-editor-no-upload"],
  },
  {
    slug: "/blur-image",
    group: "Edit",
    label: "Blur an image",
    blurb: "Soften a background or hide a detail.",
    title: "Blur an image — soften a background or hide a detail",
    description:
      "Brush a blur over one part of a photo or blur the whole thing with a slider. Radius and strength are yours to set, and it runs on your own machine.",
    h1: "Blur part of a photo, or all of it",
    lede: "Brush a blur over just the part you want softened, or blur the whole photo with a slider. Radius and strength are yours to set. Runs on your machine; on some computers, on the graphics card.",
    runsOn: "local",
    does: [
      "Brush a blur over one region, freehand",
      "Or blur the whole image with a slider",
      "Set radius and strength independently",
      "Runs on the graphics card where the browser allows it",
    ],
    sections: [
      {
        h2: "Blur is not redaction",
        p: "A light blur over text can sometimes be reversed, because the information is still in the picture, just smeared. For hiding a background or softening a distraction it is the right tool. For a password, a plate or an address, use pixelation with large blocks or a solid box instead.",
      },
      {
        h2: "On the graphics card",
        p: "Where the browser exposes WebGPU, the whole-image blur runs there, which makes a large radius on a large photo effectively instant. Where it does not, the same code runs on the CPU with SIMD. You do not choose; it picks whichever is present and the result is identical either way.",
      },
    ],
    related: ["/pixelate-image", "/photo-editor", "/background-remover"],
  },
  {
    slug: "/batch-image-editor",
    group: "Batch",
    label: "Batch image editor",
    blurb: "Resize, compress, stamp a logo, rename by content — one pass.",
    title: "Batch image editor — do one thing to a whole folder",
    description:
      "Resize, compress, stamp a logo or text, and rename a whole folder of photos in one pass. Runs on your own machine and exports the lot as a ZIP.",
    h1: "Edit a whole folder of photos at once",
    lede: "Load a folder's worth of photos and do one thing to all of them: resize, compress to a size, stamp a logo or text, rename by what's in the picture. One pass, on your own machine, then export the lot.",
    runsOn: "both",
    does: [
      "Resize or compress every photo to the same target",
      "Stamp a logo, a watermark or text across the set",
      "Rename by pattern, with a counter and the date",
      "Or name each file from what is actually in the picture",
      "Export the whole set as a ZIP",
    ],
    sections: [
      {
        h2: "Naming files from what is in them",
        p: "A local describer looks at each photo and writes a filename from what it sees — so a folder of DSC_0431.JPG becomes something you can search. The describing runs on your machine and needs no account and no per-image cost. It is a small model and it is occasionally wrong, so the names are editable before you export.",
      },
      {
        h2: "One pass over the whole set",
        p: "Every photo is decoded, edited and re-encoded in the same worker, which means a hundred files is one job rather than a hundred round trips. Nothing uploads, so the time it takes is your machine's, not your connection's.",
      },
    ],
    related: ["/image-compressor", "/photo-editor", "/image-editor-no-upload"],
  },
  {
    slug: "/image-editor-no-upload",
    group: "The principle",
    label: "No-upload image editor",
    blurb: "Your pictures stay on your computer. Here is exactly where the line is.",
    title: "Image editor with no upload — everything stays on your machine",
    description:
      "Edit photos without uploading them anywhere. The engine runs in your browser, your files stay in local storage, and every exception is named on this page.",
    h1: "An image editor with no upload",
    lede: "Your pictures stay on your computer. Most of this editor has no server in the loop at all — and the few parts that do are named here rather than buried, because that is the only version of this claim worth making.",
    runsOn: "both",
    does: [
      "Crop, compress, annotate, blur, pixelate and clone — all locally",
      "Batch-edit a folder without uploading it",
      "Keep working with the network switched off",
      "Use it with no account at all",
    ],
    sections: [
      {
        h2: "What runs on your machine",
        p: "Everything in Edit, Mark up, Hide and most of Batch. The engine is Rust compiled to WebAssembly running in a worker thread, and your originals and edits live in the browser's own database on your disk. Pull the network cable and all of it keeps working, including export.",
      },
      {
        h2: "What does not, and why",
        p: "Background removal and the AI object-removal pass run on servers, because the models are hundreds of megabytes and would have to be downloaded before the first click. They are on the paid tier for the same reason: each run costs money. Signing in also adds sync and share links, which are a server by definition. Every one of those is optional, and there is a switch in Settings that turns uploads off entirely.",
      },
      {
        h2: "Why the distinction matters",
        p: "\"Private\" is a claim almost every editor makes and very few define. The useful question is not whether a company promises to behave, it is whether the picture was ever sent anywhere in the first place. For most of what this editor does, the answer is no — and where the answer is yes, this page says so.",
      },
    ],
    related: ["/photo-editor", "/pixelate-image", "/image-compressor"],
  },
] as const;

export const toolPageFor = (slug: string) => TOOL_PAGES.find((t) => t.slug === slug);

/** The mega-menu's groups, derived so the menu and the pages cannot disagree. */
export const TOOL_GROUPS = ["Enhance", "Select", "Create", "Edit", "Batch"].map((name) => ({
  name,
  pages: TOOL_PAGES.filter((t) => t.group === name),
}));
