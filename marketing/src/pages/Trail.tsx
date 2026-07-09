import { useState } from "react";
import { EDITOR_URL } from "../config";

type Tag = "feature" | "perf" | "fix" | "rust" | "ui" | "infra" | "mock";

const TAG_COLORS: Record<Tag, string> = {
  feature: "border-orange-500/40 bg-orange-500/10 text-orange-300",
  perf:    "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  fix:     "border-rose-500/40 bg-rose-500/10 text-rose-300",
  rust:    "border-amber-500/40 bg-amber-500/10 text-amber-300",
  ui:      "border-violet-500/40 bg-violet-500/10 text-violet-300",
  infra:   "border-blue-500/40 bg-blue-500/10 text-blue-300",
  mock:    "border-zinc-600/40 bg-zinc-800/60 text-zinc-400",
};

interface Entry {
  text: string;
  tag: Tag;
}

interface Release {
  version: string;
  date: string;
  headline: string;
  entries: Entry[];
}

const RELEASES: Release[] = [
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
      { tag: "rust",    text: "The shadow is rendered in Rust: the chosen silhouette is offset and Gaussian-ish blurred, painted behind everything, and the text tile grows to fit — so the Align tool’s bounding box includes the shadow too." },
      { tag: "feature", text: "New Selection Marker (magic-wand) in the Edit & Move tool, just above Align: click a region to flood-select similar colors, then delete it. Alt+A selects everything, Alt+D deselects." },
      { tag: "rust",    text: "The selection flood-fill, the mask, and the delete all run in Rust; a translucent overlay shows exactly what’s selected." },
      { tag: "feature", text: "The Batch Image Editor’s text overlay gained Bold (applied for real to every image) and a font-family picker." },
      { tag: "fix",     text: "Bézier pen: a Background color now fills any path — an open curve or a full circle — not just explicitly-closed ones. And committed pen paths now show up as “Pen Path” in the Reselect list." },
    ],
  },
  {
    version: "v0.9.25",
    date: "2026-06-24",
    headline: "Faster engine, an Edit & Move tool, and safer deletes",
    entries: [
      { tag: "perf",    text: "Histograms now compute in Rust straight from the image buffer instead of re-sampling the canvas every time the picture changes — smoother, lighter, and much easier on your battery." },
      { tag: "perf",    text: "All the pixel blending — shapes, text, and layers — was rewritten to use fast integer math instead of slower floating-point. Same result, far less work per pixel." },
      { tag: "feature", text: "“Crop & Transform” is now “Edit and Move”. Crop comes first, then Transform (flip / rotate), and a brand-new Align section with six buttons to snap a selected text or shape to any edge or the center of the canvas." },
      { tag: "rust",    text: "Aligning is computed in Rust (a new `align_annotation` export): it measures the object’s bounding box and moves it precisely, as a single undo step." },
      { tag: "ui",      text: "Cleaner panels — the Tools, Review, and Gallery headers dropped their titles and close buttons; the buttons themselves are the header now (close panels from the top bar). The Gallery keeps its photo count and all delete / select actions." },
      { tag: "ui",      text: "The Review panel gained a live Histogram section and switched its section switcher to compact icons." },
      { tag: "feature", text: "Deleting a photo now asks first — the trash icons, the right-click “Delete image”, “Delete Selected”, and “Delete All” all confirm before anything is removed." },
      { tag: "feature", text: "New Reduce Motion toggle (Settings → Appearance → Motion) minimizes panel slides and transitions for a calmer, faster interface — saved with your account." },
      { tag: "fix",     text: "The emoji picker now sits flush with the tools-panel edges." },
    ],
  },
  {
    version: "v0.9.24",
    date: "2026-06-24",
    headline: "Rulers & grids — line up your edits with on-canvas guides",
    entries: [
      { tag: "feature", text: "New Rulers & Grids settings (Settings → Rulers & Grids). Turn on top + left pixel rulers, and overlay a grid to line things up — choose a square pixel grid, golden-ratio guides, or split the image into any number of columns and rows. Pick the grid’s color and opacity too." },
      { tag: "ui",      text: "The guides sit over your photo without touching a single pixel — they track zoom and pan, and the ruler labels update as you zoom. Your settings are saved with your account." },
      { tag: "rust",    text: "The grid layout itself is computed in Rust (a new `grid_lines` WASM export) as the single source of truth, then drawn as a crisp SVG overlay — so every grid type lines up exactly with the image." },
      { tag: "ui",      text: "Alt+S now opens Settings (it used to rotate). Rotate is still a click away in the tools." },
      { tag: "ui",      text: "The Settings window has a consistent footer everywhere — your account button on the left, Restore / Apply on the right — across General, Appearance, Rulers & Grids, and Super User." },
    ],
  },
  {
    version: "v0.9.23",
    date: "2026-06-24",
    headline: "Light mode — pick light, dark, or follow your system",
    entries: [
      { tag: "feature", text: "Image Horse now has a full light theme alongside the original dark one. Choose Light, Dark, or System in Settings → Appearance — “System” follows your operating system and switches live the moment your OS does. Your choice is saved and synced to your account." },
      { tag: "ui",      text: "The whole app follows the theme — every panel, dialog, toast, the sign-in window, even the emoji picker — warm earth-tone in the dark, warm paper in the light. No flash of the wrong colors when the page loads." },
      { tag: "ui",      text: "Under the hood the entire UI moved onto one set of design tokens (color, elevation, radius, motion, and a z-index ladder), so the two themes stay perfectly in step and the interface can’t drift out of sync." },
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
      { tag: "ui",      text: "Compress panel wording — the buttons now read “Compress Image” and “Compress All Images”, and “Compress All Images” hides when your gallery holds a single image." },
      { tag: "ui",      text: "Download dialog — the clipboard button reads “Clipboard Copy”, and the “All” button only shows when you have more than one image." },
      { tag: "fix",     text: "With the Pen active, the gallery and side panels stay clickable on tall images (the pen’s drawing layer no longer sits on top of the toolbar)." },
      { tag: "rust",    text: "Under the hood: Bézier paths are a new Rust annotation kind — flattened with de Casteljau and filled with a scanline polygon fill — so they inherit history, re-edit, and persistence for free." },
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
      { tag: "ui",      text: "Download dialog polish — a proper header and footer, and the “All” button only appears when you actually have more than one image. Export Selected now opens the same dialog so you can choose a format first." },
      { tag: "fix",     text: "Quieter, clearer errors — cloud-sync failures now surface in the Diagnostics window instead of vanishing, plus a stray image-reload fix and some debug-log cleanup under the hood." },
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
      { tag: "ui",      text: "The top-bar Upload button is now New (it also makes blank canvases), and its shortcut moved to Alt+N." },
      { tag: "ui",      text: "Toolbar refresh — the tool grid is calmer and more even: neutral tiles with only the active tool colored, a soft accent ring on hover, and sizes that scale cleanly at any width." },
      { tag: "ui",      text: "Across every settings panel: tighter, consistent spacing, unified slider and button controls, and pickers whose buttons all match size even when a label is long (so other languages won't break the grid)." },
      { tag: "ui",      text: "Dialogs now match the rest of the app — same surface, the same little close button, and no stray focus ring." },
      { tag: "fix",     text: "Fixed a Firefox-only glitch where the canvas could turn to garbage after several brush strokes, and fixed the canvas/gallery drifting out of alignment when the toolbar was open." },
      { tag: "fix",     text: "Exported edits can keep or strip EXIF — a padlock in Compress lets photographers keep GPS/time/camera metadata or scrub it for privacy (was shipped just before this; now exposed everywhere export happens)." },
      { tag: "infra",   text: "This Trail Log got a sticky month filter at the top so you can jump straight to a month." },
    ],
  },
  {
    version: "v0.9.19",
    date: "2026-06-23",
    headline: "EXIF privacy control + a Current Image Meta panel",
    entries: [
      { tag: "feature", text: "EXIF padlock on export — a lock toggle in the Compress panel decides what leaves your machine. Locked keeps your photo's metadata intact (GPS, capture time, camera and lens) — great for photographers — while unlocked strips it for privacy. It applies to Export, Export All, and Export Selected, and it closes a gap where an untouched original used to carry its GPS location into the exported ZIP." },
      { tag: "feature", text: "Current Image Meta — a new tab in the Diagnostics Window (Alt+Delete) shows the live SHA-256 fingerprint of the current canvas (it changes with every edit), the original's SHA-256 content key, the image's dimensions and byte sizes, and its EXIF: camera, lens, capture time, exposure, and GPS as a one-click map link, with a heads-up when location is embedded." },
      { tag: "ui",      text: "The EXIF lock reuses the familiar padlock and badge styling from elsewhere in the app, with a two-line label that spells out exactly what's kept or removed on export." },
    ],
  },
  {
    version: "v0.9.18",
    date: "2026-06-23",
    headline: "Diagnostics Window polish + a tidier shortcut menu",
    entries: [
      { tag: "ui",      text: "The Diagnostics Window (Alt+Delete) is now centered and taller, with a soft blur behind it, and both tabs — System Telemetry and Resources — are the same height. The event log scrolls on its own, and the count next to the tab is easier to read." },
      { tag: "feature", text: "Alt+Delete now opens the Diagnostics Window for everyone, every time — no secret unlock required." },
      { tag: "ui",      text: "The keyboard-shortcut menu lists the Diagnostics Window under an always-visible Dev Tools section. The User / Tier Selector moved into a hidden Secret Menu that only appears — and only works — after you triple-click the status-bar button." },
    ],
  },
  {
    version: "v0.9.17",
    date: "2026-06-19",
    headline: "Blur, pixelate & redaction tools + a Diagnostics Window",
    entries: [
      { tag: "feature", text: "The blur brush now has three modes — Soften (Gaussian), Pixelate (a mosaic of big squares, adjustable block size), and Solid (paint an opaque color over something). Perfect for hiding faces, license plates, or sensitive text before you share an image." },
      { tag: "feature", text: "Redaction boxes — drag a rectangle to cover an area with a solid color or a pixel mosaic. Because it's a real shape, you can reselect, move, resize, undo, and put it on its own layer, just like any other box." },
      { tag: "rust",    text: "Pixelate and redaction run entirely in Rust over the brushed (or boxed) region — grid-aligned mosaic averaging and opaque fill — so they stay fast and edit the active layer in place." },
      { tag: "ui",      text: "The Review panel header now shows the magnifying-glass icon, matching the Review button in the top bar (it used to show the history clock)." },
      { tag: "feature", text: "Diagnostics Window (Alt+Delete) — renamed, and now split into two tabs: System Telemetry (the event log) and Resources, a small htop-style view of FPS / main-thread load, JS memory, the WASM engine's memory, and what each subsystem is doing. Its backdrop is lighter now so your image stays visible behind it." },
      { tag: "infra",   text: "Security hardening — the AI (Replicate) webhook now verifies its signature and only pulls results from trusted hosts, upload URLs require sign-in, and subscription records can only be written by the verified billing webhook." },
    ],
  },
  {
    version: "v0.9.16",
    date: "2026-06-18",
    headline: "Shape fill & gradients, sharper thumbnails, configurable stamps",
    entries: [
      { tag: "feature", text: "Shapes can now be filled — give any rectangle or circle a solid background color or a two-color linear gradient, with From/To swatches and a direction picker (→ ↓ ↘ ↙). The outline draws on top, and the fill follows the shape when you reselect, move, or resize it." },
      { tag: "rust",    text: "Fill rendering lives entirely in Rust — a new fill_shape routine paints the solid color or per-pixel gradient under the stroke, threaded through the shape add/update/restore paths and the saved-edit format so fills round-trip through save and undo/redo." },
      { tag: "ui",      text: "The live drag preview shows the fill and gradient as you draw (via an SVG gradient), and the Fill controls reuse the app's existing swatch grid and button groups so they match the rest of the Shapes panel." },
      { tag: "fix",     text: "Reselecting a filled shape no longer swaps its fill — moving or resizing it keeps the color or gradient it was drawn with instead of picking up the panel's current setting." },
      { tag: "ui",      text: "The Review button now uses a magnifying-glass icon instead of the history clock, so it no longer looks identical to the History section." },
      { tag: "rust",    text: "Thumbnails are sharper and cleaner — downscaling now samples in linear light with premultiplied alpha, so midtones no longer darken and transparent edges no longer fringe with stray color." },
      { tag: "rust",    text: "The red rubber-stamp tilt is now a parameter (still −5° by default) instead of a hard-coded constant, ready to be made adjustable." },
      { tag: "fix",     text: "The crop-ratio helpers return a clear empty result on bad input instead of a silently-empty array, so a malformed call can't quietly produce a zero-size crop." },
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
      { tag: "infra",   text: "AI pipeline: a Convex action dispatches each job to Replicate with a signed source frame and a completion webhook, pulls the result into Convex storage, and streams it back to the canvas. Text models persist their output as text." },
      { tag: "feature", text: "Stripe billing — a Settings gear next to your avatar opens a Plan & Billing popup with the $10/mo Pro plan. Upgrade runs Stripe Checkout; subscribers get the Stripe Customer Portal to manage or cancel." },
      { tag: "infra",   text: "Billing backend: Checkout and Portal run through Convex actions, and a signature-verified Stripe webhook flips your account tier and records the subscription." },
      { tag: "fix",     text: "Signing in now creates your account record — a new hook upserts the Convex user row once you are authenticated, so tier, subscription, and AI access finally have something to read." },
      { tag: "fix",     text: "Oversized uploads can no longer crash the tab — images past ~100 MP are rejected with a toast before the full-resolution decode can blow past the WASM memory limit." },
      { tag: "perf",    text: "The anonymous-edit cleanup job now uses an indexed range scan instead of a full table scan, so it keeps reclaiming abandoned storage as data grows." },
    ],
  },
  {
    version: "v0.9.14",
    date: "2026-06-18",
    headline: "Blank Canvas, gallery duplicate, hidden dev tools, faster uploads",
    entries: [
      { tag: "feature", text: "Blank Canvas — start from scratch with a Photoshop-style New Document panel that slides in over the upload actions. Set width × height (default 1500 × 1000), pick a page-size preset (FHD, Square, Story, 4×6, 5×7, 8×10), and choose a background: white, black, any hex color, or fully transparent." },
      { tag: "rust",    text: "The blank canvas is generated entirely in Rust — a new blank_png fill-and-encode path produces the solid (or transparent) PNG with no browser <canvas> or toBlob round-trip, and the background color is parsed in Rust too." },
      { tag: "feature", text: "Duplicate photos — select one or more in the gallery and hit Duplicate; each copy lands right after its original and carries over its edits. Because originals are content-addressed, duplicating copies zero pixels." },
      { tag: "perf",    text: "Uploads now decode once instead of twice — the gallery thumbnail is built from the already-decoded working image (downscaled in Rust) rather than decoding the source file a second time." },
      { tag: "feature", text: "Hidden Dev Tools — three clicks on a tiny unlabeled spot in the status bar unlock the diagnostics log and the tier/user selector (and list them in the shortcuts sheet), now reachable in production builds, not just dev." },
      { tag: "ui",      text: "Shortcuts reshuffled — Tools is now Alt+T, the Review panel is Alt+R, and Rotate 90° is Alt+S. The Alt+/ reference and the top-bar tooltips were updated to match." },
      { tag: "fix",     text: "Spacebar pan works again after clicking a tool — last release's keyboard-activation change let a mouse-focused button swallow Space; it now only defers Space to keyboard-focused (Tab) controls, so hold-Space-to-pan is back." },
      { tag: "ui",      text: "Gallery counter reads cleaner — \"3 of 3 — 12 max\" normally and \"Selected: 2 of 3\" while selecting, with an (i) that explains the per-tier photo limits (logged out 12, logged in 24, paid 100)." },
      { tag: "fix",     text: "Delete All dialog — the buttons now match the rest of the app, and the Cancel button's text no longer disappears on hover (a duplicated theme token was painting dark-on-dark for every outline button)." },
      { tag: "ui",      text: "Upload dialog refresh — actions reordered (Browse / Paste, then Sample Images / Blank Canvas), the sign-in icon moved to the top-left corner, and the drag-and-drop area is now a dotted drop zone that highlights and nudges when you drag an image over it. \"Test Images\" is now \"Sample Images\", and the footer links out to the live site, GitHub, and Codeberg." },
      { tag: "ui",      text: "The Auto-Compress progress toast finally spans the full width — its text and progress bar now fill the toast edge-to-edge instead of bunching up in the left third." },
      { tag: "ui",      text: "The four panel toggles in the top bar are now properly centered on the bar, and the Review panel header matches the Toolbar and Gallery headers (icon + same type)." },
    ],
  },
  {
    version: "v0.9.13",
    date: "2026-06-17",
    headline: "Photoshop-style layers — per-layer tools, compositing, clipboard paste",
    entries: [
      { tag: "feature", text: "Layers are live. Add, duplicate, reorder, show/hide, set per-layer opacity, merge down, and flatten — every canvas tool (paint, clone stamp, blur, brightness/contrast, text, shapes, emoji, paste) now edits the active layer, and the canvas shows all visible layers composited bottom-to-top. v1 ships opacity + visibility (normal blending). Gated to logged-in / paid tiers." },
      { tag: "rust",    text: "The WASM core is no longer a single pixel buffer — ImageHorseTool holds a Vec<Layer> stack plus an active-layer index, and each layer owns its own pixels and its own text/shape overlays. New layer API (add / duplicate / remove / set_active / move / merge_down / flatten_all / visibility / opacity / get_layers) plus a source-over compositor with a reused cache and a single-opaque-layer fast path. Export and thumbnails composite the whole stack, so the saved image always matches the screen." },
      { tag: "rust",    text: "Undo/redo now snapshots the entire layer stack, so adding, deleting, reordering, and merging layers are all undoable alongside ordinary pixel edits. Jump-to-history became an undo/redo loop and the clone-stamp engine takes a pre-built snapshot." },
      { tag: "feature", text: "Paste an image straight from the clipboard (Ctrl/Cmd+V) into the active layer, centered, as one undoable step — guarded so it doesn't collide with the upload dialog's paste-as-new-photo." },
      { tag: "infra",   text: "Persistence v5 — the IndexedDB save and the Convex binary archive now serialize the full layer stack (per layer: pixels, name, visibility, opacity, and its own text/shape overlays) plus the active layer id. Reopening a photo rebuilds the stack; v1–v4 archives still load and collapse to a single layer. (Undo history past a reload still restores as the flattened image — a follow-up.)" },
      { tag: "ui",      text: "Layers panel in the Review sidebar — the old Coming Soon placeholder is now a working stack list (top→bottom) with a visibility eye, inline rename, reorder, duplicate, merge-down, delete, and a per-layer opacity slider. Tier-gated, with a lock state for the demo tier." },
      { tag: "ui",      text: "New extra-small icon-button variant powers the dense layer-row controls — always-visible background, hover ring, light icon — while the eye keeps its own open/closed swap. Less variant sprawl, consistent feel." },
      { tag: "fix",     text: "The layer-count badge showed the tier limit instead of the actual number of layers; it now shows the real count, with the limit in the tooltip." },
      { tag: "fix",     text: "Keyboard accessibility — Tab to a button and press Space or Enter and it now activates. The global spacebar-pan handler was swallowing Space for any focused control; it now defers to buttons, links, and ARIA widgets." },
      { tag: "fix",     text: "Editing a text box no longer shows a ghosted second copy underneath the editor — the baked tile is suppressed while the textarea overlay is open, mirroring how shapes already behave." },
      { tag: "fix",     text: "Text rotation lands true. The editing overlay now rotates around the same pivot the Rust tile bakes to, and the baked tile's rotation direction was flipped to match the clockwise preview — a +90° rotate was previously coming out as −90°." },
      { tag: "ui",      text: "The keyboard-shortcuts reference (Alt+/) now lays each section out in two columns, and lists Alt+Delete to toggle the Diagnostics Log." },
    ],
  },
  {
    version: "v0.9.12",
    date: "2026-06-16",
    headline: "Review panel, 360° bubble tails, dev tier switcher",
    entries: [
      { tag: "feature", text: "AI Tools: Background Removal is live. One click hands the canvas PNG to a real Convex → Replicate pipeline (rembg model), with a phase-state button (Uploading… / Removing background…) and a reactive Convex subscription on the job row. When the webhook completes, the result image streams back, decodes to RGBA, and replaces the working image — the photo is marked modified so the change persists. Gated to the Paid tier; non-Paid users see an inline Lock notice. Other AI models (OCR, 4× Upscale, Object Removal, Alt Text) remain Coming Soon placeholders awaiting the same plumbing." },
      { tag: "ui",      text: "Auto Compress split into explicit Selected / All buttons. A centred ⚡ Auto Compress label sits over a two-button row — Selected Image (or Selected Images when more than one is checkbox-selected) and All Images — followed by an HR separator and then Apply Compression & Resize and Show A/B Compare. Selected scope compresses the checkbox multi-selection when one exists, otherwise just the active photo in the ring, so the button is always meaningful." },
      { tag: "feature", text: "New Pens tab in the Shapes tool — sits between Shapes and Arrows. Pins mode drops auto-numbered callout discs (1, 2, 3…) on click with a Pin Size slider; click an existing pin to move it. Freehand mode draws a thick, round-capped polyline pen stroke on drag with its own Stroke Width slider. Both share the colour swatch." },
      { tag: "rust",    text: "Pens are real Rust shapes — two new kinds (5 = pin, 6 = polyline) added to ShapeAnnotation, with add_pin_annotation / add_polyline_annotation APIs, render_pin (filled AA disc + centred ab_glyph number), drawing::draw_polyline (round-capped segment loop), and drawing::fill_circle. ShapeAnnotation gained number (pin label) and points (polyline vertices); get_shape_annotations JSON, PersistedShape, and the restore path round-trip both. Polyline hit-testing uses per-segment distance; pins reuse the padded-bbox path. The live freehand preview is drawn in JS during the drag and committed to Rust on mouseup." },
      { tag: "feature", text: "History panel rebuilt as a Review panel — one collapsible panel hosting three independent sections: History (undo timeline), Reselect (live text and shape annotations), and Layers (placeholder). Open any combination; the body splits evenly between open sections — 1 full, 2 halves, 3 thirds — each with its own scroll area and header." },
      { tag: "ui",      text: "Shared ToggleButtonGroup component drives the top bar's Upload / Tools / Gallery / Review cluster and the Review panel's History / Reselect / Layers cluster. Multi-select (each button independent), compact icon mode, label-only mode for narrow panels, evenly-spread fill option." },
      { tag: "rust",    text: "Speech-bubble tail is now a 360° angle, not five discrete directions. Drag the Tail Direction slider and the tail sweeps continuously around the bubble. Rust builds the tile with a uniform margin on all sides and projects a ray from the bubble center onto the rect edge to place the tail base; live preview uses identical math." },
      { tag: "ui",      text: "Compress is the first tab in the Resize tool — the panel now opens on Compress (the more common starting point), and the toolbar tooltip reads Compress & Resize." },
      { tag: "ui",      text: "Text panel's second tab renamed Background (was Text Background); the Background Color / Padding / etc. labels carry the rest of the context. Corner Radius simplified to three presets — Square / Rounded / Circle — so the bubble tail stays flush at any radius." },
      { tag: "infra",   text: "Centralized tier config — new lib/tiers.ts is the one place per-tier capabilities live (gallery cap, storage quota, layers per image, AI runs per day), keyed by tier. Components read from TIERS[mode] instead of hardcoding numbers. Mirrors the public Pricing matrix." },
      { tag: "feature", text: "Dev tier switcher — Alt+L opens a small dialog to flip between No Login / Free / Paid tier modes for testing, shown only in dev builds." },
      { tag: "feature", text: "Gallery Unselect button — when one or more photos are selected, a new Unselect button appears in the gallery header alongside Export Selected, Delete Selected, and Delete All. One click clears every checkbox." },
      { tag: "fix",     text: "Modified-dot race — clicking an unedited photo no longer briefly flashes the white modified-edit dot on it. The dot effect was attributing the outgoing photo's lingering undo count to the incoming selection; now it gates on the loading flag, which is set before any await." },
      { tag: "ui",      text: "Crop tool spacing — the Transform heading sits tighter against the Flip H / Flip V / Rotate buttons, matching the rhythm Ratio uses for its ratio buttons in the same panel." },
      { tag: "rust",    text: "drawing::rounded_rect_coverage, triangle_coverage, and blend_coverage — three public coverage helpers in src/drawing.rs that produce per-pixel α for AA rounded rects and triangles, with Porter-Duff source-over compositing. Foundation for further shape-edge AA work and the bubble-tail flushness fix." },
      { tag: "ui",      text: "Trail page renamed Trail Log — the URL is /trail-log, the nav and footer labels and the page eyebrow all read Trail Log." },
    ],
  },
  {
    version: "v0.9.11",
    date: "2026-06-13",
    headline: "Shapes & arrows go live — reselect, move, resize, delete",
    entries: [
      { tag: "feature", text: "Every shape (rect, circle, hand-drawn circle, line) and both arrow styles now commit as a live ShapeAnnotation instead of rasterizing immediately — same non-destructive overlay treatment text already had. Click a committed shape to re-select it on the canvas; drag the body to move; drag corner squares to resize; drag endpoint circles to re-angle lines and arrows." },
      { tag: "feature", text: "Reselect panel — the right-side History panel grew a Reselect list of every live text and shape annotation. Click a row to jump the canvas selection to it; trash icon removes it. The old TextSettings Recent texts list moved here so all live overlays share one home." },
      { tag: "rust",    text: "Eight new wasm-bindgen exports drive the shape system: add / update / remove / restore / hit-test / count / set_editing_shape / get_shape_annotations — the same shape as the text annotation surface." },
      { tag: "rust",    text: "History snapshots now carry shape annotations alongside text annotations — undo/redo swap both lists in lockstep so reselect-and-edit is a normal undo entry." },
      { tag: "infra",   text: "Persistence v4 — the IDB SavedEdit and the Convex binary archive both serialize the shape annotation vec; reopening a photo restores every live overlay. v1–v3 still decode for back-compat." },
      { tag: "fix",     text: "Text rotate handle — the drag math used a stale center reference when the box was already rotated, drifting the angle on each adjustment. Smooth rotation now holds." },
      { tag: "rust",    text: "Stamp dab f32 polish — extends the June hot-loop pass to the dab kernel's edge case, removing a residual f64 cast in the inner loop." },
    ],
  },
  {
    version: "v0.9.10",
    date: "2026-06-12",
    headline: "June optimization pass — faster Rust, smaller WASM, Squoosh-style resize, shape edit boxes",
    entries: [
      { tag: "perf",    text: "WASM binary down 60% — 1.10 MB to 443 KB — by subsetting the embedded Liberation Sans fonts to Latin-1 + Extended-A, plus a sweep of Rust hot-loop optimizations (f32 math, opaque-source fast paths, cached blur kernels, VecDeque undo stack)." },
      { tag: "perf",    text: "Zero-copy canvas painting — the display blit reads WASM linear memory directly instead of cloning the full pixel buffer every frame, eliminating ~1 GB/s of allocator churn during brush strokes." },
      { tag: "rust",    text: "Three resampling filters join bilinear: Lanczos3 (default), Catmull-Rom, and Nearest — separable two-pass with minification-aware kernels, selectable from the new Method dropdown." },
      { tag: "feature", text: "Squoosh-style Resize panel — Scale % slider, Dimensions with aspect lock, then a Compress section grouping Method, Format (moved out of the top bar), and Quality." },
      { tag: "feature", text: "Apply Compression & Resize re-encodes at the chosen format and quality, swaps the stored file, and updates the status-bar size, dimensions, and gallery tooltip in place." },
      { tag: "feature", text: "PageSpeed Insights score (renamed from Lighthouse) now models Google's real image audits: next-gen format ratios (WebP/AVIF score higher) and an oversize penalty past 1920px." },
      { tag: "feature", text: "Shape & Arrow edit boxes — all four shapes and both arrow styles drop into a Figma-style overlay with resize squares, a move handle, and per-endpoint circles for lines/arrows. Commit still rasterizes in Rust, one history snapshot per shape." },
      { tag: "feature", text: "Export gating — single Export disabled until the active photo has edits; Export All needs two or more photos with at least one edited, each with a tooltip explaining why." },
      { tag: "fix",     text: "A/B Compare overhauled — unlocks on any pending panel change, always compares against the immutable upload original, and the overlay now tracks zoom and pan transforms instead of drifting." },
      { tag: "fix",     text: "Levels blur slider — JS was sending a 0–1 fraction into Rust's u32 intensity (truncated to 0 → invisible blur); now mapped to the 1–30 kernel range." },
      { tag: "fix",     text: "Many small fixes — eyedropper added to the right-click menu, Delete-All canvas ghost cleared, sidebar tooltip copy refreshed, upload-dialog link styled as a LargeButton." },
      { tag: "ui",      text: "Keyboard accessibility pass — focus-visible accent ring (was globally suppressed), tabbable gallery thumbs and history entries, upload dialog focuses Browse Files on open and closes on Escape." },
      { tag: "ui",      text: "Architecture page returns — the full backend diagram (client → WASM → auth → API → storage/Convex/AI) rebuilt and re-linked in the nav and footer; pricing details stay on the Pricing section." },
      { tag: "ui",      text: "GitHub and Codeberg buttons in the nav beside Beta Version — the source lives on both forges." },
      { tag: "infra",   text: "UploadThing now also hosts the demo's Test Images set — the royalty-free photos behind the upload dialog's Test Images button." },
      { tag: "infra",   text: "Dead code removed per fallow: five unused modules, stale exports, and the unused autoprefixer dependency." },
    ],
  },
  {
    version: "v0.9.9",
    date: "2026-06-12",
    headline: "Non-destructive text + speech bubbles + AI panel",
    entries: [
      { tag: "feature", text: "Live text annotations — text never commits to canvas pixels until export. Click an existing text on the canvas to re-open the input box with its content, font, color, and rotation; submit updates in place." },
      { tag: "feature", text: "Text Background tab — add a rounded rectangle behind any text, or wrap it in a speech bubble with a tail (5 directions). Background color, padding, corner radius, and opacity sliders." },
      { tag: "rust",    text: "Eight new wasm-bindgen exports drive the annotation system: add / update / remove / hit-test / count / get-json / render-with / flatten — display always blits through render_with_annotations when count > 0." },
      { tag: "rust",    text: "drawing::fill_rounded_rect — anti-aliased rounded fill via per-pixel distance test; drawing::fill_triangle_public renders speech-bubble tails. The whole bubble rotates together (not just the text)." },
      { tag: "ui",      text: "Line-and-dot handles — stem + filled circle for both move (native cursor) and rotate (custom data-URI SVG cursor with stacked black-outer + white-inner strokes for visibility on any background)." },
      { tag: "ui",      text: "Sticky text input — the editing box no longer closes when you click a color swatch or font dropdown. Document-level pointerdown listener only commits on clicks truly outside the editing surface." },
      { tag: "feature", text: "Text Extract removed and repositioned — Tesseract.js dependency dropped, Rust extract_region_png removed. The feature now lives in a new AI tool panel as a Coming Soon card alongside Background Removal, 4× Upscale, and Object Removal." },
      { tag: "ui",      text: "Unified ColorSwatchGrid — Paint, Shapes, Arrows, and Text Background tabs all share the same palette and custom-colors list (localStorage-persisted via useUserColors, parsed by Rust parse_color)." },
      { tag: "infra",   text: "Annotation persistence v2 — IDB SavedEdit gained an annotations field, and the Convex binary archive bumped to v2 with trailing JSON (v1 still decodes for back-compat)." },
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
      { tag: "rust",    text: "Byte-aware Lighthouse score — a Rust web-performance model (log-normal curve) powers the Resize panel's Web Performance Gain and Lighthouse readouts." },
      { tag: "rust",    text: "Batch text and Export All compositing run through Rust (measure_text / commit_text and encode_png_pixels on a throwaway ImageHorseTool)." },
      { tag: "ui",      text: "Unified button system — new LargeButton and TinyButton primitives give every action and icon button one consistent look (export, apply, compress, delete, close, user)." },
      { tag: "ui",      text: "Status bar refresh — rotating shortcut hints with the active tool swapped in and Alt+/ pinned." },
      { tag: "ui",      text: "Auto Compress progress now appears as a toast with a progress bar instead of an inline toolbar bar." },
      { tag: "ui",      text: "Gallery polish — Delete All in the header, trash-can remove buttons, and a hover tooltip showing each photo's name, size, and dimensions." },
      { tag: "ui",      text: "Responsive layout under 1000px — the top bar collapses to icons and the toolbar slims down with smaller tool icons." },
      { tag: "ui",      text: "Clerk sign-in now uses a dark theme that matches the editor." },
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
      { tag: "mock",    text: "Batch Text overlay — mock UI in place (textarea, font, color, position, opacity); apply button shows a Coming Soon badge." },
      { tag: "feature", text: "Grid canvas mode — when Batch Image Editor is active, the canvas becomes a 5×3 mosaic; selected photo is a 2×2 hero tile, surrounded by up to 11 clickable thumbnails. Caps at 12 visible with a +N more badge." },
      { tag: "ui",      text: "Selected indicator — orange ring + pill badge on the hero tile; placeholder overlay shows when no photo is loaded." },
      { tag: "fix",     text: "Auto-select first photo — keeps the hero populated after session restore or photo deletion." },
      { tag: "fix",     text: "Canvas survives container resize — flushToCanvas re-blits the WASM buffer via a ResizeObserver. Fixes the blank-hero bug when switching tools." },
      { tag: "rust",    text: "composite_pixels — stateless RGBA alpha-compositing exposed as a free wasm-bindgen function." },
      { tag: "rust",    text: "resize_pixels — stateless bilinear resize. Batch logo scaling moves from OffscreenCanvas to Rust." },
      { tag: "rust",    text: "encode_png_pixels — stateless PNG encoding. Batched photo outputs skip canvas.convertToBlob entirely." },
      { tag: "ui",      text: "Marketing link in upload dialog footer; darker .checkerboard-dark variant for the grid surround." },
    ],
  },
  {
    version: "v0.9.6",
    date: "2026-05-15",
    headline: "Image Horse rename + originals store",
    entries: [
      { tag: "feature", text: "App renamed Image Horse — was Clone Stamp App; WASM struct renamed CloneStampTool → ImageHorseTool." },
      { tag: "feature", text: "Content-addressed originals — SHA-256-keyed IndexedDB store; originals survive photo switching and page reload at full resolution." },
      { tag: "perf",    text: "Working copies — uploads downscaled to ≤2048px long edge via createImageBitmap; 256px WebP thumbnails generated in parallel." },
      { tag: "fix",     text: "CompareSlider alignment — overlay tracks the canvas bounding box via ResizeObserver; before/after layers share one coordinate space through zoom and pan." },
      { tag: "perf",    text: "Compare URL on demand — originalUrl populated only when compare activates; revoked on cleanup." },
      { tag: "ui",      text: "Apply Resize and Quality — button renamed; disabled until width, height, or quality actually changes." },
    ],
  },
  {
    version: "v0.9.5",
    date: "2026-05-14",
    headline: "Text rotation + Convex archive format",
    entries: [
      { tag: "feature", text: "Text rotate handle — SVG rotate circle above the text box; drag to rotate before committing." },
      { tag: "ui",      text: "ColorSwatchGrid — shared color swatch grid used across brush, text, arrow, and shape settings." },
      { tag: "ui",      text: "StatusBar auth mode — shows Demo or Signed In badge based on Clerk state." },
      { tag: "perf",    text: "Binary archive format for Convex edit history — canvas + undo/redo stack serialized as a compact binary archive instead of per-snapshot file uploads." },
      { tag: "infra",   text: "session_edits Convex table — 3-day expiry cron cleans up stale edits automatically." },
    ],
  },
  {
    version: "v0.9.4",
    date: "2026-05-13",
    headline: "Tabbed tool panels",
    entries: [
      { tag: "ui",      text: "Stamp tool — 3-tab panel (Clone / Stamps / Emojis); emojis tab houses the full @emoji-mart picker." },
      { tag: "feature", text: "Emoji tool → Images — toolbar tool renamed (now Batch Image Editor in v0.9.7)." },
      { tag: "ui",      text: "Shapes tool — Shapes / Arrows tab switcher; Arrows tab now shows full arrow settings." },
      { tag: "infra",   text: "Dual persistence — useEditPersistence routes canvas saves to Convex file storage (signed in) or IndexedDB (anonymous); useRecentTexts mirrors the same pattern." },
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
      { tag: "fix",     text: "Clone stamp alpha compositing — Porter-Duff source-over; stroke_src_data frozen buffer prevents feedback artifacts." },
      { tag: "perf",    text: "Paint dab compositing — squared-distance circle rejection replaces sqrt in the hot loop." },
      { tag: "fix",     text: "Crop OOB clamp — boundary guard prevents out-of-bounds read on zero-area crops." },
      { tag: "fix",     text: "Netlify build fix — removed --out-dir from wasm-pack; app/pkg is a symlink." },
      { tag: "fix",     text: "Modified-photo dot — race condition fixed; dot only appears after actual brush/tool edits." },
    ],
  },
  {
    version: "v0.9.1",
    date: "2026-04-11",
    headline: "Convex schema + pan/zoom polish",
    entries: [
      { tag: "infra",   text: "Convex DB + auth schema — userProfiles, projects, images, layers, annotations, history, ai_jobs, subscriptions tables defined." },
      { tag: "feature", text: "Spacebar pan — Photoshop-style hand tool; all tool handlers bypassed during pan." },
      { tag: "feature", text: "Alt+Scroll zoom — composes with pan offset; listener moved to window for reliable mounting." },
      { tag: "feature", text: "PgUp / PgDn — cycle through gallery photos." },
      { tag: "ui",      text: "Blur Brush moved into the Effects panel alongside brightness + contrast." },
      { tag: "feature", text: "Crop SVG overlay — rule-of-thirds guides and 8 draggable resize handles." },
    ],
  },
  {
    version: "v0.5.0",
    date: "2026-03-20",
    headline: "Image Horse identity + Convex foundation + brightness in Rust",
    entries: [
      { tag: "ui",      text: "App branded Image Horse — new horse logo SVG and product name across the editor and the README." },
      { tag: "infra",   text: "Convex database integration begins — initial schema and auth wiring for projects, images, and user profiles." },
      { tag: "rust",    text: "Brightness and contrast moved into Rust for instant, allocation-free adjustments." },
      { tag: "feature", text: "Red stamp tool — REJECTED / APPROVED / DRAFT / CONFIDENTIAL presets rendered as bordered, slightly-rotated labels." },
      { tag: "ui",      text: "Gallery polish — photo strip with smooth loading effects and tighter thumbnail layout." },
    ],
  },
  {
    version: "v0.4.0",
    date: "2026-03-18",
    headline: "Rust migration of drawing tools",
    entries: [
      { tag: "rust",    text: "Blur moved to Rust — Gaussian separable two-pass with brush-radius region masking." },
      { tag: "rust",    text: "Arrows and shapes drawn entirely in WASM — anti-aliased lines, rendered arrowheads, rectangles and circles in pixel space." },
      { tag: "rust",    text: "Paint and emoji tools composite through Rust pixel pipelines instead of canvas drawImage." },
      { tag: "rust",    text: "Text rendering in Rust with the embedded Liberation Sans font — no browser font round-trip." },
      { tag: "rust",    text: "Resize migrated to a Rust bilinear pass, replacing canvas-based scaling." },
      { tag: "infra",   text: "Architecture.md added — documents the WASM + React + Convex layers and why one binary shares one pixel buffer." },
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
      { tag: "ui",      text: "Animations layered over panel transitions via Framer Motion springs." },
      { tag: "ui",      text: "Styling polish across the editor — consistent spacing, hover states, and dark surface palette." },
    ],
  },
  {
    version: "v0.2.0",
    date: "2026-03-15",
    headline: "Layout merge + foundation cleanup",
    entries: [
      { tag: "infra",   text: "Repo merge brings in the Yet Another Photo App layout — proper top bar, sidebar, status bar, and gallery placeholder." },
      { tag: "infra",   text: ".gitignore added for node_modules and dist; package resolution errors resolved." },
      { tag: "ui",      text: "First real multi-panel layout — the structure all later tools dock into." },
    ],
  },
  {
    version: "v0.1.0",
    date: "2026-02-25",
    headline: "Initial React conversion",
    entries: [
      { tag: "feature", text: "HTML / JS prototype converted to a React + Vite + TypeScript project — the scaffold the rest of the app grows on." },
      { tag: "ui",      text: "Status bar added at the bottom of the editor — first version, before it learned to rotate shortcut hints." },
      { tag: "fix",     text: "Zoom controls fixed and working through the new React layout." },
    ],
  },
];

/** Group order within a release — one pill per tag, Rust first, then Feature. */
const TAG_ORDER: Tag[] = ["rust", "feature", "perf", "ui", "fix", "infra", "mock"];

function groupByTag(entries: Entry[]): { tag: Tag; items: Entry[] }[] {
  return TAG_ORDER.map((tag) => ({
    tag,
    items: entries.filter((e) => e.tag === tag),
  })).filter((g) => g.items.length > 0);
}

function TagPill({ tag }: { tag: Tag }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${TAG_COLORS[tag]}`}
    >
      {tag}
    </span>
  );
}

function ReleaseCard({ release, isLatest }: { release: Release; isLatest: boolean }) {
  return (
    <article className="relative">
      {/* timeline dot — centered on the rail: the parent has a 2px border +
          24px padding, so the article's edge sits 26px right of the line;
          -33px puts the 16px dot's center on the border's center. */}
      <div
        className={`absolute -left-[33px] top-2 w-4 h-4 rounded-full border-2 ${
          isLatest
            ? "border-orange-400 bg-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.6)]"
            : "border-zinc-700 bg-zinc-900"
        }`}
      />

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 ml-2">
        <div className="flex items-baseline justify-between gap-4 mb-1 flex-wrap">
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-semibold text-zinc-100 mono">{release.version}</h3>
            {isLatest && (
              <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-orange-300">
                Latest
              </span>
            )}
          </div>
          <span className="text-xs text-zinc-500 mono">{release.date}</span>
        </div>
        <p className="text-sm text-zinc-400 mb-5">{release.headline}</p>

        {/* Entries grouped by tag — one pill per tag, then its bullets. Every
            bullet shares the same left edge, so paragraph text lines up the
            same distance from the card edge across all groups. */}
        <div className="space-y-5">
          {groupByTag(release.entries).map((group) => (
            <div key={group.tag}>
              <TagPill tag={group.tag} />
              <ul className="mt-2 space-y-2">
                {group.items.map((e, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-zinc-600" />
                    <span className="text-[13px] text-zinc-300 leading-relaxed flex-1">
                      {e.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
/** Unique YYYY-MM keys present in the log, newest first (RELEASES is sorted). */
const MONTHS = Array.from(new Set(RELEASES.map((r) => r.date.slice(0, 7))));

export default function Trail() {
  const [month, setMonth] = useState<string>("all");
  const shown =
    month === "all" ? RELEASES : RELEASES.filter((r) => r.date.startsWith(month));
  return (
    <section className="relative">
      <div className="absolute inset-x-0 top-0 h-[400px] bg-gradient-to-b from-orange-500/10 via-pink-500/5 to-transparent pointer-events-none" />

      <div className="relative max-w-4xl mx-auto px-6 pt-20 pb-24">
        <div className="mb-12">
          <div className="text-xs uppercase tracking-wider text-orange-400 font-medium mb-2">
            Trail Log
          </div>
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.1]">
            What's new in <span className="gradient-text">Image Horse</span>
          </h1>
          <p className="mt-4 text-zinc-400 max-w-2xl leading-relaxed">
            A running log of features, performance work, and fixes. Newest at the top.
            Click any release version to jump to the live editor and try the latest build.
          </p>
          <div className="mt-6 flex items-center gap-3 flex-wrap">
            <a
              href={EDITOR_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 text-white text-sm font-medium hover:opacity-90 transition glow"
            >
              Try the latest →
            </a>
          </div>
        </div>

        {/* Month filter — a sticky pill toggle (same shape as the app's tab
            toggles) to narrow the giant log to a single month. */}
        <div className="sticky top-4 z-20 mb-10 flex justify-center">
          <div className="inline-flex flex-wrap justify-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900/90 p-1 shadow-lg backdrop-blur">
            {[
              { key: "all", label: "All" },
              ...MONTHS.map((ym) => ({
                key: ym,
                label: MONTH_NAMES[parseInt(ym.slice(5, 7), 10) - 1],
              })),
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setMonth(t.key)}
                className={`mono rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  month === t.key
                    ? "bg-orange-500 text-white shadow"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* timeline rail */}
        <div className="relative pl-6 border-l-2 border-zinc-800 space-y-6">
          {shown.map((release) => (
            <ReleaseCard
              key={release.version}
              release={release}
              isLatest={release.version === RELEASES[0].version}
            />
          ))}
        </div>

        {/* legend */}
        <div className="mt-12 rounded-lg border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-3">Legend</div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(TAG_COLORS) as Tag[]).map((t) => (
              <div key={t} className="flex items-center gap-2">
                <TagPill tag={t} />
                <span className="text-[11px] text-zinc-500">
                  {t === "feature" && "new capability"}
                  {t === "perf" && "speed / memory"}
                  {t === "fix" && "bug fix"}
                  {t === "rust" && "WASM / Rust"}
                  {t === "ui" && "interface polish"}
                  {t === "infra" && "data / build"}
                  {t === "mock" && "UI only, not wired"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
