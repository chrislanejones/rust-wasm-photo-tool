// Who may use what: one ladder, one rule, shared by the server and the client.
//
// THREE WORDS, KEPT APART (Chris, 09-22-2026):
//
//   TIER         what the account paid for — free | pro | team, in `users.tier`
//   ROLE         what the person is trusted to do — user | admin
//   ENTITLEMENT  what this session may actually use — none | free | paid
//
// A tier is a purchase; a role is trust. Folding admin into the tier ladder
// would turn every gate into "paid OR superuser", and that trailing clause is
// what rots: miss it once and a paid feature is free, or the person debugging
// the app cannot see the thing they are debugging. It also cannot grow — a
// second admin would be a new rung in a PRICING ladder.
//
// ⚠️ THIS FILE LIVES IN convex/ ON PURPOSE. The server is the authority on
// both role and entitlement, and the client imports THIS module rather than
// re-deriving anything (app/src/lib/superuser.ts used to compare the signed-in
// email to a hardcoded address in the browser). One implementation, used by
// `users.me` and by the UI that reads it, so the two cannot disagree.
//
// It is pure and imports nothing: no Convex context, no React. That is what
// lets both sides call it and the tests run it directly.

/** What a session may use. Ordered: each rung includes the ones before it. */
export type Entitlement = "none" | "free" | "paid";

/** What the person is trusted to do. Not a tier, and never sold. */
export type Role = "user" | "admin";

/** Low to high. Index is the rank — see `atLeast`. */
export const ENTITLEMENTS: readonly Entitlement[] = ["none", "free", "paid"] as const;

/** The paid tiers, as they are spelled in `users.tier`. */
const PAID_TIERS = new Set(["pro", "team"]);

export function rank(e: Entitlement): number {
  return ENTITLEMENTS.indexOf(e);
}

/** Does `have` reach `need`? The one comparison every gate should use. */
export function atLeast(have: Entitlement, need: Entitlement): boolean {
  return rank(have) >= rank(need);
}

/**
 * What this session may use.
 *
 * ADMIN IS ENTITLED TO PAID, server included. That is the whole reason the
 * role exists here rather than as a client-side preview flag: an admin who
 * previews the paid UI while the server still refuses them would spend their
 * time debugging the mismatch instead of the feature. It also means nobody has
 * to grant themselves a fake `pro` tier to test — the duplicate `users` rows
 * one person can accumulate (three, on 09-22) stop mattering for their own
 * testing.
 *
 * `tier` is whatever the row holds: null / undefined / unknown all read as
 * free-if-signed-in, because an unrecognised tier must never open a paid door.
 */
export function entitlementOf(
  tier: string | null | undefined,
  role: Role,
  signedIn: boolean,
): Entitlement {
  if (role === "admin") return "paid";
  if (!signedIn) return "none";
  return tier && PAID_TIERS.has(tier) ? "paid" : "free";
}

/**
 * THE RULE: a preview may only take away.
 *
 * The Super User pane lets an admin look at the app as a lower rung — free, or
 * signed out — to check those views. It can never raise anyone, so what a
 * person sees is always something they are allowed to do, and the UI can never
 * offer a feature the server will refuse. `null` (no preview) means "show me
 * my own entitlement".
 */
export function previewOf(preview: Entitlement | null, entitlement: Entitlement): Entitlement {
  if (preview === null) return entitlement;
  return rank(preview) < rank(entitlement) ? preview : entitlement;
}

/**
 * Is this email an admin? `list` is the raw `ADMIN_EMAILS` value — commas,
 * whitespace and case are all tolerated, because it is typed by a human into a
 * deployment variable. `ADMIN_EMAIL` (singular, the older name) is accepted by
 * the caller and passed here the same way.
 *
 * An empty or missing list means NOBODY is an admin. A deployment that forgot
 * the variable must not hand the role to the first person who signs in.
 */
export function isAdminEmail(email: string | null | undefined, list: string | undefined): boolean {
  if (!email || !list) return false;
  const wanted = email.trim().toLowerCase();
  if (!wanted) return false;
  return list
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(wanted);
}

// ── Cloud storage quota ─────────────────────────────────────────────────────
// THE ONE PLACE THESE NUMBERS LIVE. The pricing page advertises "100 MB of
// cloud storage" signed in and "5 GB" on Pro; app/src/lib/tiers.ts reads them
// from here for the Super User matrix, and the server enforces them from here
// (convex/storageQuota.ts). Binary units, as tiers.ts has always used — the
// generous reading of the advertised figure, never the stingy one.
//
// `none` is 0: a signed-out session cannot store anything, and the upload URL
// mutations already refuse it before this is ever asked.

const MiB = 1024 * 1024;

export const STORAGE_QUOTA_BYTES: Readonly<Record<Entitlement, number>> = {
  none: 0,
  free: 100 * MiB,
  paid: 5 * 1024 * MiB,
};

/** Human units for a quota message: "31.9 MB", "5 GB". Binary, like the caps. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * MiB) {
    const gb = bytes / (1024 * MiB);
    return `${Number.isInteger(gb) ? gb : gb.toFixed(2)} GB`;
  }
  const mb = bytes / MiB;
  return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`;
}

/**
 * May this account store `incomingBytes` more? `null` means yes; a string is
 * the refusal, written for the person who will read it.
 *
 * THE RULE: after the write, the account may hold AT MOST its cap — exactly at
 * the cap is allowed, one byte over is not. `replacingBytes` is what the write
 * frees in the same transaction (a photo's previous edit archive, which `save`
 * deletes), so replacing a file with one of the same size never fails even on a
 * full account.
 *
 * Deletes never come through here. Freeing space is always allowed, including
 * for an account that is already over (a pre-quota account, or a Pro account
 * that went back to free) — that is how such an account gets back under.
 */
export function storageQuotaVerdict(args: {
  usedBytes: number;
  replacingBytes: number;
  incomingBytes: number;
  entitlement: Entitlement;
}): string | null {
  const cap = STORAGE_QUOTA_BYTES[args.entitlement];
  const after = args.usedBytes - args.replacingBytes + args.incomingBytes;
  if (after <= cap) return null;
  const plan = args.entitlement === "paid" ? "Pro" : "free";
  const left = Math.max(0, cap - (args.usedBytes - args.replacingBytes));
  return (
    `Your cloud storage is full. This needs ${formatBytes(args.incomingBytes)} and your ` +
    `${plan} account has ${formatBytes(left)} of ${formatBytes(cap)} left. ` +
    `Delete a cloud edit or a share link to make room. Your work is still saved in this browser.`
  );
}

// ── The UI's older vocabulary ───────────────────────────────────────────────
// The app calls these three states `UserMode` ("demo" | "loggedIn" | "paid")
// and uses them for the tier table, the status bar and the Super User pane.
// The names are not worth a rename across the app, so they are translated
// here, in the same file as the ladder, rather than mapped ad hoc at each use.

export type UserModeName = "demo" | "loggedIn" | "paid";

export function toUserMode(e: Entitlement): UserModeName {
  return e === "paid" ? "paid" : e === "free" ? "loggedIn" : "demo";
}

export function fromUserMode(m: UserModeName): Entitlement {
  return m === "paid" ? "paid" : m === "loggedIn" ? "free" : "none";
}
