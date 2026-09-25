// .convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ── Clerk-synced users ──────────────────────────────────
  users: defineTable({
    clerkId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    tier: v.union(v.literal("free"), v.literal("pro"), v.literal("team")),
    dailyUsage: v.number(),
    usageResetAt: v.number(),
    /* The monthly ceiling, alongside the daily one.
     *
     * A daily cap alone does not bound what a plan costs: 50 a day is 1,500 a
     * month, and every one of those is a Replicate invoice. The daily number
     * is there to stop a burst; this one is there so a month has a floor under
     * its margin.
     *
     * OPTIONAL, and that is load-bearing. Convex validates the whole table
     * against the schema on push, so a required field added to a table that
     * already has rows fails the deploy. Absent reads as zero — see
     * `monthlyUsed` in aiJobs.ts — which is the correct answer for a user who
     * predates the field. */
    monthlyUsage: v.optional(v.number()),
    monthResetAt: v.optional(v.number()),
    // App preferences (Settings → General/Appearance), stored as a JSON blob
    // plus its SHA-256 so the client can skip redundant writes / verify on load.
    settings: v.optional(v.string()),
    settingsHash: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_email", ["email"]),

  // ── Subscriptions ───────────────────────────────────────
  subscriptions: defineTable({
    userId: v.id("users"),
    stripeCustomerId: v.string(),
    stripeSubId: v.string(),
    plan: v.union(v.literal("pro"), v.literal("team")),
    status: v.union(
      v.literal("active"),
      v.literal("canceled"),
      v.literal("past_due"),
    ),
    currentPeriodEnd: v.number(),
    cancelAtPeriodEnd: v.boolean(),
  })
    .index("by_userId", ["userId"])
    .index("by_stripeCustomerId", ["stripeCustomerId"])
    .index("by_stripeSubId", ["stripeSubId"]),

  // ── Recent Texts (per-user text tool history) ───────────────────────────
  recent_texts: defineTable({
    userId: v.id("users"),
    text: v.string(),
    fontSize: v.number(),
    fontFamily: v.optional(v.string()),
    fontWeight: v.union(v.literal("normal"), v.literal("bold")),
    textColor: v.string(),
    usedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_usedAt", ["userId", "usedAt"]),

  // ── User colors (the global "+" palette) ──────────────────────────────
  // One row per saved swatch. Anonymous users keep the same list in
  // localStorage (hooks/useUserColors.ts); signed-in users read and write
  // here so the palette follows them across devices. Capped at 32 per user
  // by the mutation, newest first via `createdAt`.
  user_colors: defineTable({
    userId: v.id("users"),
    /** Normalized `#rrggbb` / `#rrggbbaa`, lowercase. */
    color: v.string(),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_createdAt", ["userId", "createdAt"]),

  // ── Photo canvas edits (per-user, stored in Convex file storage) ────────
  photo_edits: defineTable({
    userId: v.id("users"),
    photoKey: v.string(),
    storageId: v.id("_storage"),
    canvasW: v.number(),
    canvasH: v.number(),
    updatedAt: v.number(),
  }).index("by_userId_photoKey", ["userId", "photoKey"]),

  // ── Share links (public, read-only canvas snapshots) ───────────────────────
  // A `create` packs the flattened canvas PNG into Convex file storage and mints
  // an unguessable `token`. The `get` query is PUBLIC (no auth) so anyone with
  // the link can view/download the snapshot; ownership (userId) only gates
  // listing/revoking. This is the "share link" the Pro paywall advertises.
  //
  // The four optional fields below are the Settings › Shared limits. ALL
  // OPTIONAL, and that is load-bearing: Convex validates the whole table on
  // push, so a required field would fail the deploy for every link that
  // already exists. Absent reads as "no limit" — see `availability` in
  // shares.ts. `pausedAt` is the ONLY one the owner's Pause writes; the two
  // auto-limits are never written as a pause, they are re-derived on every
  // read so that raising a limit un-stops a link with no extra write.
  shares: defineTable({
    token: v.string(),
    userId: v.id("users"),
    storageId: v.id("_storage"),
    canvasW: v.number(),
    canvasH: v.number(),
    title: v.optional(v.string()),
    views: v.number(),
    createdAt: v.number(),
    /** Stop serving after this many views. Reaching it PAUSES, never deletes. */
    maxViews: v.optional(v.number()),
    /** ms epoch. Stop serving at or after this instant. */
    expiresAt: v.optional(v.number()),
    /** Set by the owner's Pause, cleared by Resume. */
    pausedAt: v.optional(v.number()),
    /** Written by the scheduled `shares.expire` AT `expiresAt`. Not read to
     *  decide anything — `availability` compares the clock. Its job is the
     *  WRITE: a Convex query is cached and is not re-run as time passes, so
     *  without a write at that instant a cached `get` would go on serving the
     *  image past its end date until something else touched the row. */
    expiredAt: v.optional(v.number()),
    lastViewedAt: v.optional(v.number()),
  })
    .index("by_token", ["token"])
    .index("by_userId", ["userId"]),

  // ── Share views (one row per counted view) ────────────────────────────────
  // TIMESTAMP ONLY. No IP, no user agent, no viewer id, nothing that could
  // identify who opened a link — the privacy policy says so, and this table is
  // what keeps that true. It exists so the owner's pane can draw a 30-day
  // view sparkline per link; the running total lives on `shares.views`.
  // Rows are deleted with their share (shares.remove), so the table is bounded
  // by the views of links that still exist.
  share_views: defineTable({
    shareId: v.id("shares"),
    at: v.number(),
  })
    // (shareId, at): every read is one share's rows from a start time onward,
    // which this index serves as a range with no scan.
    .index("by_shareId", ["shareId", "at"]),

  // ── Synced client documents (cross-device / cross-tab state) ───────────
  // ONE ROW PER (user, key). `value` is a canonical JSON blob written by
  // app/src/lib/sync — `prefs`, `ui` and `tools` today. The client compares
  // `value` strings directly rather than a hash: these blobs are under a
  // couple of kilobytes, and an exact comparison cannot collide the way a
  // short hash can (which would look like "my change didn't sync").
  //
  // `key` is an OPEN string, not a union, on purpose: a new synced document
  // must be a code change in convex/sync.ts (which validates against
  // SYNC_KEYS) and not a schema migration. Convex validates the whole table
  // on push, so a union here would make every new document type a deploy
  // risk for rows that already exist.
  //
  // `rev` is server-assigned and strictly increasing per row, and it is what
  // a write is CHECKED against: `sync:push` carries the rev the client's
  // change was based on and is refused when the row has moved since. That is
  // what stops a mutation Convex queued while a laptop was offline from
  // landing, on reconnect, over a day of changes made on the phone.
  //
  // `value: null` is a FORGOTTEN document ("Forget the synced copy"). The row
  // stays, with its settings removed, so that its rev keeps counting and every
  // device can tell "the user deleted this" from "this account never had one"
  // — the second seeds from a device's pending change, the first must not be
  // re-seeded by whichever device happens to be online. So nothing ever
  // DELETES a row of this table: a row that vanished would restart at rev 1,
  // under devices that remember a higher one.
  //
  // `format` is the document's schema version as the WRITING build knew it.
  // A build never writes over a row from a newer format — it cannot see the
  // fields that build added, and its write would erase them.
  //
  // There is deliberately no device or tab id here. Nothing needs to know
  // which device wrote a row, so no per-browser identifier is uploaded.
  //
  // NOT the photo archive. Replicating edited pixels across devices is a
  // separate, larger thing and is blocked on the op-log breakage tracked in
  // docs/PARKING_LOT.md; see docs/adr/061.
  sync_docs: defineTable({
    userId: v.id("users"),
    key: v.string(),
    value: v.union(v.string(), v.null()),
    rev: v.number(),
    updatedAt: v.number(),
    format: v.number(),
  })
    // The only index. Every read is one (user, key) lookup — the key set is a
    // closed list of three — and a user-wide scan can use its `userId` prefix.
    .index("by_userId_key", ["userId", "key"]),

  // ── AI Jobs ─────────────────────────────────────────────
  // Keyed by photoKey (the editor's string id, same as photo_edits) rather
  // than a server-side image row (there is none). Input/output frames live in Convex file
  // storage; Replicate is driven by a Convex action + completion webhook.
  ai_jobs: defineTable({
    userId: v.id("users"),
    photoKey: v.string(),
    type: v.union(
      v.literal("rembg"),
      v.literal("upscale"),
      v.literal("inpaint"),
      v.literal("ocr"),
      // REGISTERED BUT DELIBERATELY UNIMPLEMENTED — do not wire this up.
      // "alt" is the hosted caption model that ADR-028 considered and REJECTED
      // in favor of running image description locally in the Rust engine. It
      // survives in this union only because removing a literal from a schema
      // union is a migration, not an edit. Without this note the next person
      // reads an unhandled case as an oversight and implements it, quietly
      // undoing the decision. See docs/adr/028-image-description-runs-locally
      // -in-the-engine.md before touching it.
      v.literal("alt"),
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("done"),
      v.literal("failed"),
    ),
    replicateId: v.optional(v.string()),
    /** Source frame handed to the model (current canvas PNG). */
    inputStorageId: v.optional(v.id("_storage")),
    /** Mask frame for inpaint / object removal (white = region to erase). */
    maskStorageId: v.optional(v.id("_storage")),
    /** Result frame written back by the webhook (image models). */
    outputStorageId: v.optional(v.id("_storage")),
    /** Non-image output (e.g. OCR text / alt text). */
    output: v.optional(v.any()),
    error: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_photoKey", ["userId", "photoKey"])
    .index("by_replicateId", ["replicateId"])
    .index("by_status", ["status"]),
});
