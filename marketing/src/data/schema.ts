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
      { name: "settings", type: "string?", comment: "JSON blob, app prefs" },
      { name: "settingsHash", type: "string?", comment: "SHA-256, skips redundant writes" },
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
      { name: "storageId", type: "Id<'_storage'>", key: "fk", comment: "binary canvas archive" },
      { name: "canvasW", type: "number" },
      { name: "canvasH", type: "number" },
      { name: "updatedAt", type: "number" },
    ],
    indexes: ["by_userId_photoKey"],
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
    name: "shares",
    tiers: "free pro",
    fields: [
      { name: "_id", type: "Id<'shares'>", key: "pk" },
      { name: "token", type: "string", indexed: true, comment: "unguessable, public lookup key" },
      { name: "userId", type: "Id<'users'>", key: "fk", indexed: true },
      { name: "storageId", type: "Id<'_storage'>", key: "fk", comment: "flattened canvas PNG" },
      { name: "canvasW", type: "number" },
      { name: "canvasH", type: "number" },
      { name: "title", type: "string?" },
      { name: "views", type: "number" },
      { name: "createdAt", type: "number" },
    ],
    indexes: ["by_token", "by_userId"],
    note: "Public, no-auth read — anyone with the link can view or download",
  },
  {
    name: "ai_jobs",
    tiers: "pro",
    fields: [
      { name: "_id", type: "Id<'ai_jobs'>", key: "pk" },
      { name: "userId", type: "Id<'users'>", key: "fk", indexed: true },
      { name: "photoKey", type: "string", indexed: true },
      { name: "type", type: "'rembg' | 'upscale' | 'inpaint' | 'ocr' | 'alt'" },
      { name: "status", type: "'pending' | 'running' | 'done' | 'failed'" },
      { name: "replicateId", type: "string?", indexed: true },
      { name: "inputStorageId", type: "Id<'_storage'>?" },
      { name: "maskStorageId", type: "Id<'_storage'>?", comment: "inpaint mask" },
      { name: "outputStorageId", type: "Id<'_storage'>?" },
      { name: "output", type: "JsonValue?", comment: "non-image result, e.g. OCR text" },
      { name: "error", type: "string?" },
      { name: "startedAt", type: "number?" },
      { name: "completedAt", type: "number?" },
      { name: "createdAt", type: "number" },
    ],
    indexes: ["by_userId", "by_userId_photoKey", "by_replicateId", "by_status"],
    note: "Keyed by photoKey, not an images row — the Replicate webhook updates status",
  },
];

/** PK / FK / UQ as letters, not emoji — emoji render differently on every OS. */
export const KEY_LABEL: Record<Key, string> = { pk: "PK", fk: "FK", unique: "UQ" };
