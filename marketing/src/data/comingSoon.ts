/* The /in-the-works register, shared with the home page's "Being built now"
 * band so the two can never disagree. Rules for entries live in
 * pages/ComingSoon.tsx. */

export interface Entry {
  name: string;
  body?: string;
  /** Already behind a flag in the editor's Beta ring — you can switch it on.
   *  The value is the feature's Beta id (lib/featureFlags.ts), so "try it"
   *  opens the editor with it already on: `?beta=<id>`. */
  beta?: string;
}

export interface Group {
  key: string;
  short: string;
  name: string;
  stateLabel: string;
  blurb: string;
  items: Entry[];
}

export const GROUPS: Group[] = [
  {
    key: "building",
    short: "Building",
    name: "Being built now",
    stateLabel: "building",
    blurb: "Real work, already in the repo, with a branch or a decision behind it.",
    items: [
      {
        name: "Photoshop files, in and out",
        body: "Open a .psd with its layers, and save your work as one. The plugin is built and public, and Settings → Plugins takes it from a file or a link. What is left is a real place to get it, instead of a raw file in a repo.",
      },
      {
        name: "Send photos from your phone",
        body: "Pick photos on your phone and they wait in an Inbox in the editor's gallery until you add them. The server copy goes as soon as your computer has it. Needs sign-in on both devices. Already behind a flag.",
        beta: "transfer",
      },
      {
        name: "Trash for share links",
        body: "Delete a share link and it goes to a Trash in Settings › Shared, where you can bring it back at the same address. Needs sign-in. Already behind a flag.",
        beta: "trash",
      },
      {
        name: "Connect an AI app to your account",
        body: "A Settings page that shows what an app like Claude would be able to reach in your account, and what it never could. Nothing connects yet; this is the preview. Already behind a flag.",
        beta: "mcp-connector",
      },
      {
        name: "Offline",
        body: "Open the editor with no connection at all and keep working. The engine already runs on your machine; this is the last piece that doesn't.",
      },
      { name: "Smart Brush", body: "Strokes that stop at an edge. Already behind a flag.", beta: "smart-brush" },
      {
        name: "Blur on the graphics card",
        body: "The same blur, on the GPU where there is one. Already behind a flag.",
        beta: "gpu-blur",
      },
      {
        name: "Photo info, handled by the engine",
        body: "Camera info read, stripped and kept by the Rust engine, checked against the old way on every photo. Already behind a flag.",
        beta: "exif-rust",
      },
      {
        name: "PageSpeed budget",
        body: "Compress All aims for the size Google actually allows each photo, instead of a flat 200 KB. Resize & Compress already shows that limit to everyone; this brings it to the one-click pass. Already behind a flag.",
        beta: "pagespeed-budget",
      },
      {
        name: "Keep the steps you undo",
        body: "Undo, make a different edit, and the steps you undid stay under History as a branch you can click back to. Already behind a flag.",
        beta: "history-forks",
      },
    ],
  },
  {
    key: "decided",
    short: "Decided",
    name: "Decided, waiting its turn",
    stateLabel: "decided",
    blurb: "Chosen and written down. Not started.",
    items: [
      {
        name: "Bring your own typeface",
        body: "Upload a font and use it on your text. The editor already loads its fonts at runtime; this is the half that lets you choose one.",
      },
      {
        name: "Rename a batch with a look at each photo",
        body: "AI Rename names a photo from its colors, tone and a rough subject today. This is the version that can say what is actually in it.",
      },
      { name: "Photoshop's blend modes", body: "Multiply, screen, overlay and the rest, on real layer stacks." },
      { name: "Talk to it", body: "Say what you want changed instead of finding the tool." },
      {
        name: "Your own tools, plugged in",
        body: "The door is open for file formats: add a plugin in Settings and its format joins the Download dialog. A plugin that adds a tool to the toolbar is the half still to come.",
      },
    ],
  },
  {
    key: "exploring",
    short: "Exploring",
    name: "Thinking about it",
    stateLabel: "exploring",
    blurb: "Ideas with reasons behind them and no timeline.",
    items: [
      {
        name: "Record what you did, then do it to a hundred photos",
        body: "Macro recording, so an edit becomes something you can replay across a folder.",
      },
      {
        name: "Every version of a photo, as a tree",
        body: "Not just undo — every branch you took, kept and walkable.",
      },
      {
        name: "Two people, one photo, at the same time",
        body: "The furthest thing on the list, and the one everything else is quietly building toward.",
      },
      { name: "Color-blind-safe previews" },
    ],
  },
];
