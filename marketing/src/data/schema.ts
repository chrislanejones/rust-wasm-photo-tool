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
      { name: "storageId", type: "Id<'_storage'>", key: "fk", comment: "flattened canvas PNG" },
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
    ],
    indexes: ["by_token", "by_userId"],
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

  /* ── Defined, deployed, and called by nothing ────────────────────────────
   * These five are the document model from before the Rust engine: a project
   * held images, an image held layers, a layer held annotations, and history
   * was a per-image undo log on the server. The editor now keeps all of that
   * in the browser, so nothing reads or writes them — `api.projects.*` and the
   * other four have zero call sites in the app and zero inside Convex.
   *
   * They are here because this file documents the schema that is deployed, and
   * leaving them out would make the page claim a smaller surface than the one
   * that actually exists. `tiers: ""` is literal, not an oversight: no tier
   * touches them, so the tier filter dims them all. */
  {
    name: "projects",
    tiers: "",
    fields: [
      { name: "_id", type: "Id<'projects'>", key: "pk" },
      { name: "userId", type: "Id<'users'>", key: "fk", indexed: true },
      { name: "name", type: "string" },
      { name: "description", type: "string?" },
      { name: "thumbnail", type: "string?" },
      { name: "isPublic", type: "boolean" },
      { name: "shareToken", type: "string?", indexed: true },
      { name: "imageCount", type: "number" },
      { name: "createdAt", type: "number" },
      { name: "updatedAt", type: "number" },
    ],
    indexes: ["by_userId", "by_userId_createdAt", "by_shareToken"],
    note: "Unused — the pre-engine document model. Nothing calls it",
  },
  {
    name: "images",
    tiers: "",
    fields: [
      { name: "_id", type: "Id<'images'>", key: "pk" },
      { name: "projectId", type: "Id<'projects'>", key: "fk", indexed: true },
      { name: "userId", type: "Id<'users'>", key: "fk", indexed: true },
      { name: "storageId", type: "Id<'_storage'>?" },
      { name: "originalUrl", type: "string" },
      { name: "processedUrl", type: "string?" },
      { name: "thumbnailUrl", type: "string?" },
      { name: "filename", type: "string" },
      { name: "displayName", type: "string?" },
      { name: "mimeType", type: "string" },
      { name: "width", type: "number" },
      { name: "height", type: "number" },
      { name: "sizeBytes", type: "number" },
      { name: "altText", type: "string?" },
      { name: "order", type: "number" },
      { name: "createdAt", type: "number" },
    ],
    indexes: ["by_projectId", "by_userId", "by_projectId_order"],
    note: "Unused — originals live in the browser's own database instead",
  },
  {
    name: "layers",
    tiers: "",
    fields: [
      { name: "_id", type: "Id<'layers'>", key: "pk" },
      { name: "imageId", type: "Id<'images'>", key: "fk", indexed: true },
      { name: "name", type: "string" },
      { name: "order", type: "number" },
      { name: "visible", type: "boolean" },
      { name: "locked", type: "boolean" },
      { name: "opacity", type: "number" },
      {
        name: "blendMode",
        type: "'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light' | 'difference' | 'exclusion'",
      },
    ],
    indexes: ["by_imageId", "by_imageId_order"],
    note: "Unused — the layer stack is engine state, not a server document",
  },
  {
    name: "annotations",
    tiers: "",
    fields: [
      { name: "_id", type: "Id<'annotations'>", key: "pk" },
      { name: "imageId", type: "Id<'images'>", key: "fk", indexed: true },
      { name: "layerId", type: "Id<'layers'>", key: "fk", indexed: true },
      { name: "type", type: "'rect' | 'ellipse' | 'path' | 'text' | 'arrow'" },
      { name: "data", type: "any" },
      {
        name: "style",
        type: "{ stroke?: string; fill?: string; opacity?: number; strokeWidth?: number; fontSize?: number }",
      },
      { name: "transform", type: "{ x: number; y: number; rotation: number; scale: number }" },
      { name: "locked", type: "boolean" },
      { name: "createdAt", type: "number" },
    ],
    indexes: ["by_imageId", "by_layerId"],
    note: "Unused — shapes and text are engine state, not a server document",
  },
  {
    name: "history",
    tiers: "",
    fields: [
      { name: "_id", type: "Id<'history'>", key: "pk" },
      { name: "imageId", type: "Id<'images'>", key: "fk", indexed: true },
      { name: "userId", type: "Id<'users'>", key: "fk", indexed: true },
      {
        name: "action",
        type: "'create' | 'update' | 'delete' | 'ai_rembg' | 'ai_upscale' | 'ai_inpaint' | 'ai_alt'",
      },
      { name: "target", type: "'annotation' | 'layer' | 'image'" },
      { name: "targetId", type: "string" },
      { name: "prevState", type: "any?" },
      { name: "nextState", type: "any?" },
      { name: "createdAt", type: "number" },
    ],
    indexes: ["by_imageId", "by_imageId_createdAt"],
    note: "Unused — undo is the op log in the browser, a thousand steps deep",
  },
];

/** PK / FK / UQ as letters, not emoji — emoji render differently on every OS. */
export const KEY_LABEL: Record<Key, string> = { pk: "PK", fk: "FK", unique: "UQ" };
