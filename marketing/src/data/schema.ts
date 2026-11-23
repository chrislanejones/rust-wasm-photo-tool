// The Convex database schema, as documentation for /architecture.
//
// Field types are copied verbatim from convex/schema.ts. This is documentation,
// so a wrong type is a lie — if the schema changes, change it here too.

export type Key = "pk" | "fk" | "unique";

export interface Field {
  name: string;
  type: string;
  key?: Key;
  /** carries its own index */
  indexed?: boolean;
  comment?: string;
}

export interface Table {
  name: string;
  fields: Field[];
  indexes: string[];
  note?: string;
  /** which tiers ever touch this table — drives the tier filter's dimming */
  tiers: string;
}

export const TABLES: Table[] = [
  {
    name: "users",
    tiers: "free pro",
    fields: [
      { name: "_id", type: "Id<'users'>", key: "pk" },
      { name: "clerkId", type: "string", key: "unique", indexed: true },
      { name: "email", type: "string?", indexed: true },
      { name: "name", type: "string?" },
      { name: "avatarUrl", type: "string?" },
      { name: "tier", type: "'free' | 'pro' | 'team'" },
      { name: "dailyUsage", type: "number" },
      { name: "usageResetAt", type: "number" },
      { name: "monthlyUsage", type: "number?", comment: "AI passes this month" },
      { name: "monthResetAt", type: "number?" },
      { name: "settings", type: "string?", comment: "legacy prefs blob — see sync_docs" },
      { name: "settingsHash", type: "string?", comment: "legacy, SHA-256 of the above" },
      { name: "mcpEnabled", type: "boolean?", comment: "\"Let AI apps use my account\" — absent is off" },
      { name: "mcpOffReason", type: "'browser-only'?" },
      { name: "createdAt", type: "number" },
      { name: "updatedAt", type: "number" },
    ],
    indexes: ["by_clerkId", "by_email"],
  },
  {
    name: "subscriptions",
    tiers: "pro",
    fields: [
      { name: "_id", type: "Id<'subscriptions'>", key: "pk" },
      { name: "userId", type: "Id<'users'>", key: "fk", indexed: true },
      { name: "stripeCustomerId", type: "string", indexed: true },
      { name: "stripeSubId", type: "string", key: "unique" },
      { name: "plan", type: "'pro' | 'team'" },
      { name: "status", type: "'active' | 'canceled' | 'past_due'" },
      { name: "currentPeriodEnd", type: "number" },
      { name: "cancelAtPeriodEnd", type: "boolean" },
    ],
    indexes: ["by_userId", "by_stripeCustomerId", "by_stripeSubId"],
  },
  {
    name: "photo_edits",
    tiers: "free pro",
    fields: [
      { name: "_id", type: "Id<'photo_edits'>", key: "pk" },
      { name: "userId", type: "Id<'users'>", key: "fk" },
      { name: "photoKey", type: "string", comment: "the editor's own photo id" },
      { name: "storageId", type: "Id<'_storage'>", indexed: true, key: "fk", comment: "binary canvas archive" },
      { name: "canvasW", type: "number" },
      { name: "canvasH", type: "number" },
      { name: "updatedAt", type: "number" },
    ],
    indexes: ["by_storageId", "by_userId_photoKey"],
    note: "Real per-photo edit persistence path (useEditPersistence.ts)",
  },
  {
    name: "recent_texts",
    tiers: "free pro",
    fields: [
      { name: "_id", type: "Id<'recent_texts'>", key: "pk" },
      { name: "userId", type: "Id<'users'>", key: "fk" },
      { name: "text", type: "string" },
      { name: "fontSize", type: "number" },
      { name: "fontFamily", type: "string?" },
      { name: "fontWeight", type: "'normal' | 'bold'" },
      { name: "textColor", type: "string" },
      { name: "usedAt", type: "number" },
    ],
    indexes: ["by_userId", "by_userId_usedAt"],
    note: "Text-tool history, per signed-in user",
  },
  {
    name: "sync_docs",
    tiers: "free pro",
    fields: [
      { name: "_id", type: "Id<'sync_docs'>", key: "pk" },
      { name: "userId", type: "Id<'users'>", key: "fk", indexed: true },
      { name: "key", type: "string", comment: "'prefs' | 'ui' | 'tools'" },
      { name: "value", type: "string | null", comment: "canonical JSON; null once forgotten" },
      { name: "rev", type: "number", comment: "server-assigned; a write must name the one it read" },
      { name: "updatedAt", type: "number" },
      { name: "format", type: "number", comment: "document version of the build that wrote it" },
    ],
    indexes: ["by_userId_key"],
    note: "Settings and remembered UI choices, the same on every signed-in device — never pixels",
  },
  {
    name: "user_colors",
    tiers: "free pro",
    fields: [
      { name: "_id", type: "Id<'user_colors'>", key: "pk" },
      { name: "userId", type: "Id<'users'>", key: "fk", indexed: true },
      { name: "color", type: "string", comment: "#rrggbb or #rrggbbaa, lowercase" },
      { name: "createdAt", type: "number" },
    ],
    indexes: ["by_userId", "by_userId_createdAt"],
    note: "The saved “+” palette — capped at 32 per user, newest first",
  },
  {
    name: "shares",
    tiers: "free pro",
    fields: [
      { name: "_id", type: "Id<'shares'>", key: "pk" },
      { name: "token", type: "string", indexed: true, comment: "unguessable, public lookup key" },
      { name: "userId", type: "Id<'users'>", key: "fk", indexed: true },
      { name: "storageId", type: "Id<'_storage'>", indexed: true, key: "fk", comment: "flattened canvas PNG" },
      { name: "canvasW", type: "number" },
      { name: "canvasH", type: "number" },
      { name: "title", type: "string?" },
      { name: "views", type: "number" },
      { name: "createdAt", type: "number" },
      { name: "maxViews", type: "number?", comment: "reaching it PAUSES the link, never deletes" },
      { name: "expiresAt", type: "number?", comment: "ms epoch — stop serving at or after this" },
      { name: "pausedAt", type: "number?", comment: "set by the owner's Pause, cleared by Resume" },
      { name: "expiredAt", type: "number?", comment: "written AT expiresAt so a cached query re-runs" },
      { name: "lastViewedAt", type: "number?" },
      { name: "deletedAt", type: "number?", indexed: true, comment: "in the Beta trash since; absent is live" },
    ],
    indexes: ["by_storageId", "by_token", "by_userId", "by_deletedAt"],
    note: "Public, no-auth read — anyone with the link can view or download",
  },
  {
    name: "share_views",
    tiers: "free pro",
    fields: [
      { name: "_id", type: "Id<'share_views'>", key: "pk" },
      { name: "shareId", type: "Id<'shares'>", key: "fk", indexed: true },
      { name: "at", type: "number", comment: "ms epoch" },
    ],
    indexes: ["by_shareId"],
    note: "Timestamp only — no IP, no user agent, no viewer id. One row per counted view, deleted with its share",
  },
  {
    name: "ai_jobs",
    tiers: "pro",
    fields: [
      { name: "_id", type: "Id<'ai_jobs'>", key: "pk" },
      { name: "userId", type: "Id<'users'>", key: "fk", indexed: true },
      { name: "photoKey", type: "string", indexed: true },
      { name: "type", type: "'rembg' | 'upscale' | 'inpaint' | 'ocr' | 'alt' | 'generate'" },
      { name: "status", type: "'pending' | 'running' | 'done' | 'failed'" },
      { name: "replicateId", type: "string?", indexed: true },
      { name: "prompt", type: "string?", comment: "Create AI Image jobs only" },
      { name: "model", type: "string?", comment: "Replicate model slug, Create AI Image jobs only" },
      { name: "inputStorageId", type: "Id<'_storage'>?", indexed: true },
      { name: "maskStorageId", type: "Id<'_storage'>?", indexed: true, comment: "inpaint mask" },
      { name: "outputStorageId", type: "Id<'_storage'>?", indexed: true },
      { name: "referenceStorageId1", type: "Id<'_storage'>?", indexed: true, comment: "generation reference 1" },
      { name: "referenceStorageId2", type: "Id<'_storage'>?", indexed: true, comment: "generation reference 2" },
      { name: "referenceStorageId3", type: "Id<'_storage'>?", indexed: true, comment: "generation reference 3" },
      { name: "output", type: "JsonValue?", comment: "non-image result, e.g. OCR text" },
      { name: "error", type: "string?" },
      { name: "startedAt", type: "number?" },
      { name: "completedAt", type: "number?" },
      { name: "filesExpiredAt", type: "number?", comment: "set when the job's files are cleared, 7 days after it finished" },
      { name: "createdAt", type: "number" },
    ],
    indexes: ["by_inputStorageId", "by_outputStorageId", "by_maskStorageId", "by_referenceStorageId1", "by_referenceStorageId2", "by_referenceStorageId3", "by_userId", "by_userId_photoKey", "by_replicateId", "by_status", "by_status_filesExpiredAt_completedAt"],
    note: "Keyed by photoKey, not a server-side image row — the Replicate webhook updates status. The 7-day file expiry is written but runs as a dry run until it is switched on",
  },
  {
    name: "transfers",
    tiers: "free pro",
    fields: [
      { name: "_id", type: "Id<'transfers'>", key: "pk" },
      { name: "userId", type: "Id<'users'>", key: "fk", indexed: true },
      { name: "storageId", type: "Id<'_storage'>", indexed: true, key: "fk", comment: "the photo, exactly as the phone sent it" },
      { name: "name", type: "string", comment: "the file's name on the phone" },
      { name: "mime", type: "string" },
      { name: "bytes", type: "number" },
      { name: "width", type: "number?" },
      { name: "height", type: "number?" },
      { name: "fromDevice", type: "string", comment: "\"iPhone\", \"Android phone\", \"Phone\"" },
      { name: "createdAt", type: "number" },
      { name: "expiresAt", type: "number", indexed: true, comment: "createdAt + 7 days" },
    ],
    indexes: ["by_userId_createdAt", "by_storageId", "by_expiresAt"],
    note: "Beta. Photos sent from a phone, waiting for the editor's Inbox. Owner-only, and removed when the computer adds the photo",
  },
  {
    name: "pair_sessions",
    tiers: "demo free pro",
    fields: [
      { name: "_id", type: "Id<'pair_sessions'>", key: "pk" },
      { name: "keyHash", type: "string", key: "unique", indexed: true, comment: "SHA-256 of the QR code's secret, never the secret" },
      { name: "clientToken", type: "string", indexed: true, comment: "random per tab, for the per-client cap" },
      { name: "offer", type: "string", comment: "the computer's connection offer, ≤ 16 KB" },
      { name: "offerMac", type: "string", comment: "HMAC-SHA256 under the secret" },
      { name: "answer", type: "string?", comment: "the phone's reply, once it joins" },
      { name: "answerMac", type: "string?" },
      { name: "computerCandidates", type: "string[]", comment: "network addresses, ≤ 40 a side" },
      { name: "phoneCandidates", type: "string[]" },
      { name: "joined", type: "boolean", comment: "the first phone to join closes the door" },
      { name: "createdAt", type: "number" },
      { name: "expiresAt", type: "number", indexed: true, comment: "5 minutes; 30 once joined" },
    ],
    indexes: ["by_keyHash", "by_clientToken_expiresAt"],
    note: "Beta. Introduces a phone to a computer for Pair a phone. No user, no file names, no photo data, and no sign-in needed. Each row deletes itself when it expires",
  },
  {
    name: "storage_usage",
    tiers: "free pro",
    fields: [
      { name: "_id", type: "Id<'storage_usage'>", key: "pk" },
      { name: "userId", type: "Id<'users'>", key: "fk", indexed: true },
      { name: "bytes", type: "number", comment: "exact stored bytes across edits, shares and transfers" },
      { name: "updatedAt", type: "number" },
    ],
    indexes: ["by_userId"],
    note: "One row per account, kept exact by every save, delete and share. The storage limit does not read it yet",
  },
  {
    name: "mcp_calls",
    tiers: "free pro",
    fields: [
      { name: "_id", type: "Id<'mcp_calls'>", key: "pk" },
      { name: "userId", type: "Id<'users'>", key: "fk", indexed: true },
      { name: "clientId", type: "string", comment: "the AI app, from its verified token" },
      { name: "tool", type: "string" },
      { name: "outcome", type: "'ok' | 'error'" },
      { name: "at", type: "number", indexed: true },
    ],
    indexes: ["by_userId_at", "by_at"],
    note: "One row per call an AI app makes. Never the token, the arguments or the response. The MCP endpoint is off by default",
  },
];

/** PK / FK / UQ as letters, not emoji — emoji render differently on every OS. */
export const KEY_LABEL: Record<Key, string> = { pk: "PK", fk: "FK", unique: "UQ" };
