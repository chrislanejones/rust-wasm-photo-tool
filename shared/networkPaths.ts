// Every path by which something of yours reaches a server.
//
// ── why this file exists ─────────────────────────────────────────────────────
// Four places used to describe this, each written by hand: Settings › Security
// (a mapped list PLUS a hand-written bullet added by the #223 fix), the privacy
// policy, the home page's table, and `NETWORK_SUB_TOOLS`. Bug #223 happened in
// the gap between them — the online switch gated a list that did not include
// the edit backup, so the page promised something the app did not do.
//
// Now there is one list. Security renders it, the home page's table reads it at
// build time, the online switch asks it, and a test fails if the privacy policy
// stops naming a path in it. A new network feature is ONE entry here.
//
// ── why it lives at the repo root, not in app/src/lib ────────────────────────
// Both Vercel projects read it, and each skips builds for paths it does not
// read (scripts/vercel-ignore-build.sh). `app/` is on the MARKETING project's
// ignore list, so a registry under app/src would change here and never rebuild
// the marketing site — the home table would go stale, silently, which is the
// exact bug this file exists to end. `shared/` is on neither list, so a change
// rebuilds both.
//
// ── rules for this file ──────────────────────────────────────────────────────
//  • Pure data. No imports — the marketing site imports this, and must not
//    pull the editor in with it.
//  • It records what IS, not what should be. `gate` is what the code does
//    today, measured. Share links are `signed-in`, not `online-switch`, because
//    that is how they behave until QC F2 lands (#234). Writing the fix into the
//    data would make Security promise something the app does not do — #223
//    again.
//  • `disclosedAs` is the phrase the privacy policy must contain for this path.
//    marketing/src/pages/PrivacyPolicy.test.ts reads it.

// NOT a path, deliberately: UploadThing. The app only DOWNLOADS public sample
// photos from its CDN (lib/testImages.ts) — nothing of yours is sent — so it is
// a fetch like a font, not a disclosure. StoragePane names it as a storage
// option for later; the day it stores a user's upload, it becomes an entry.

export type NetworkGate =
  /** Off unless Settings › Security's online-features switch is on. */
  | "online-switch"
  /** Runs for anyone signed in, whatever the online switch says. */
  | "signed-in"
  /** Has its own toggle, separate from the online switch. */
  | "own-toggle"
  /** Always on — it is how the page itself loads, or how you sign in. */
  | "always";

export interface NetworkPath {
  id: string;
  /** Short name, as Security prints it in bold. */
  label: string;
  /** One clause: what is sent, and to where. Sentence case, no final period. */
  sends: string;
  gate: NetworkGate;
  /** Only meaningful for `own-toggle`: where that toggle lives. */
  toggle?: string;
  /** The words the privacy policy must contain for this path. */
  disclosedAs: string;
  /** Row on the home page's "where does it run" table, when it has one.
   *  Several paths can share a row — the table is coarser on purpose. */
  homeRow?: string;
}

export const NETWORK_PATHS: readonly NetworkPath[] = [
  {
    id: "ai_generation",
    label: "Create AI Image",
    sends: "your prompt and any images you attach go to a generation server",
    gate: "online-switch",
    disclosedAs: "Replicate",
    homeRow: "Remove background, remove object, read text",
  },
  {
    id: "ai_processing",
    label: "AI tools",
    // Which sub-tools these are is not repeated here. Each sub-tool carries
    // `requiresNetwork` (features/tools/toolGroups.ts), and Security lists them
    // by name under this entry. The equality test in
    // app/src/lib/networkPaths.test.ts pins that every `requiresNetwork`
    // sub-tool is covered by this id.
    sends: "the image goes to a server that runs the model",
    gate: "online-switch",
    disclosedAs: "Replicate",
    homeRow: "Remove background, remove object, read text",
  },
  {
    id: "photo_backup",
    label: "Your edits, backed up to your account",
    sends:
      "a flattened copy of each edited photo is kept on the server so another device can pick it up",
    gate: "online-switch",
    disclosedAs: "edit history off-device",
    homeRow: "Sync and share links",
  },
  {
    id: "settings_sync",
    label: "Your settings",
    sends: "your preferences go to your account so other devices share them",
    gate: "own-toggle",
    toggle: "Settings › Sync",
    disclosedAs: "syncing your settings",
    homeRow: "Sync and share links",
  },
  {
    id: "user_colors",
    label: "Your saved colors",
    sends: "the swatches you save are kept on your account",
    gate: "signed-in",
    disclosedAs: "saved colors",
    homeRow: "Sync and share links",
  },
  {
    id: "share_links",
    label: "Share links",
    sends: "a flattened copy of the photo is stored so anyone with the link can view it",
    // NOT the online switch — QC F2 (#234) is the fix and has not landed.
    gate: "signed-in",
    disclosedAs: "share links",
    homeRow: "Sync and share links",
  },
  {
    id: "account",
    label: "Signing in",
    sends: "your email and sign-in go to the account provider",
    gate: "always",
    disclosedAs: "Clerk",
  },
  {
    id: "analytics",
    label: "Anonymous usage analytics",
    sends: "page views and feature counts, with cookies — never your images, edits or filenames",
    gate: "always",
    disclosedAs: "Google Analytics",
  },
];

/** The paths the online-features switch turns on. */
export const SWITCHED_PATHS = NETWORK_PATHS.filter((p) => p.gate === "online-switch");

/** Everything the switch does NOT cover — Security lists these separately, so
 *  "off" can never be read as "nothing reaches a server". */
export const UNSWITCHED_PATHS = NETWORK_PATHS.filter((p) => p.gate !== "online-switch");

/** Whether a path may run right now. The one question every gate asks.
 *
 *  Only `online-switch` paths depend on the switch; the rest answer the same
 *  whatever it says, because that is what they do today. Changing that for a
 *  path is a behavior change — edit its `gate`, and the tests will say which
 *  surfaces moved. */
export function isNetworkPathAllowed(id: string, onlineFeaturesEnabled: boolean): boolean {
  const path = NETWORK_PATHS.find((p) => p.id === id);
  // An unknown id is a programming error, and the safe answer to "may this
  // reach a server?" when nobody knows what "this" is, is no.
  if (!path) return false;
  return path.gate === "online-switch" ? onlineFeaturesEnabled : true;
}
