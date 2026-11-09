import { ConvexError } from "convex/values";
import { z, type ZodRawShape } from "zod";
import { internal } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { decodeBase64Image, fetchImage, imageFileName, senderLabel, sniffImage } from "./mcpImage";

// ── The tools an AI app can call (ADR-095) ────────────────────────────────────
//
// Every tool gets the user from the verified token, never from an argument.
// Annotations mark writes, so a client asks its user first.

export interface Principal {
  userId: Id<"users">;
  clientId: string;
  scopes: string[];
}

export interface McpTool {
  name: string;
  description: string;
  input: ZodRawShape;
  annotations: { readOnlyHint: boolean; destructiveHint?: boolean };
  run: (ctx: ActionCtx, who: Principal, args: any) => Promise<unknown>;
}

/** Said in every description, so a model doesn't promise what can't happen. */
export const LIMITS = "Works on the signed-in user's account only. Cannot open gallery photos (they stay in the browser), run AI jobs or change billing.";

const READ = { readOnlyHint: true };
const WRITE = { readOnlyHint: false, destructiveHint: false };
const DESTRUCTIVE = { readOnlyHint: false, destructiveHint: true };

const token = z.string().min(1).max(200).describe("The share link's token, from list_shares.");
const hex = z.string().regex(/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/, "Use #rrggbb or #rrggbbaa");

const recipeSize = z.discriminatedUnion("fit", [
  z.object({ fit: z.literal("exact"), width: z.number().int().min(1).max(16384), height: z.number().int().min(1).max(16384) }),
  z.object({ fit: z.enum(["width", "long"]), size: z.number().int().min(1).max(16384) }),
  z.object({ fit: z.literal("keep") }),
]);

function parseDate(iso: string | null | undefined): number | null | undefined {
  if (iso === undefined || iso === null) return iso;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new ConvexError("expires_at must be an ISO 8601 date.");
  return ms;
}

async function sendImage(ctx: ActionCtx, who: Principal, args: { image_base64?: string; image_url?: string; name?: string; sender_name?: string }) {
  if (Boolean(args.image_base64) === Boolean(args.image_url)) throw new ConvexError("Send exactly one of image_base64 or image_url.");
  const bytes = args.image_base64 ? decodeBase64Image(args.image_base64) : await fetchImage(args.image_url!);
  const kind = sniffImage(bytes);
  if (!kind) throw new ConvexError("That isn't an image the editor can open (JPEG, PNG, WebP, AVIF, HEIC or GIF).");

  const storageId = await ctx.storage.store(new Blob([bytes], { type: kind.mime }));
  const result = await ctx.runMutation(internal.mcpData.receiveImage, {
    userId: who.userId,
    storageId,
    name: imageFileName(args.name, kind.ext),
    from: senderLabel(args.sender_name),
  });
  if (!result.ok) throw new ConvexError(result.message);
  return { in_inbox: true, id: result.id, bytes: result.bytes, expires_at: new Date(result.expiresAt).toISOString(), next: "The user adds it to the gallery from the Inbox in the editor." };
}

export const MCP_TOOLS: McpTool[] = [
  {
    name: "get_connection_status",
    description: `Which switches are on and what this app can do. Use for "why can't you…?" questions. ${LIMITS}`,
    input: {},
    annotations: READ,
    run: (ctx, who) => ctx.runQuery(internal.mcp.connectionStatus, who),
  },
  {
    name: "get_account",
    description: `The plan, storage used and allowed, and AI uses left today. ${LIMITS}`,
    input: {},
    annotations: READ,
    run: (ctx, who) => ctx.runQuery(internal.mcpData.getAccount, { userId: who.userId }),
  },
  {
    name: "get_storage",
    description: `Storage used and allowed in bytes, with a breakdown: backups, shares, transfers, trash and AI files. ${LIMITS}`,
    input: {},
    annotations: READ,
    run: (ctx, who) => ctx.runQuery(internal.mcpData.getStorage, { userId: who.userId }),
  },
  {
    name: "list_shares",
    description: `The user's share links, newest first: title, link, views, limits, expiry, paused. ${LIMITS}`,
    input: { limit: z.number().int().min(1).max(100).default(25), offset: z.number().int().min(0).default(0) },
    annotations: READ,
    run: (ctx, who, a) => ctx.runQuery(internal.mcpData.listShares, { userId: who.userId, limit: a.limit, offset: a.offset }),
  },
  {
    name: "pause_share",
    description: `Stop serving a share link until it's resumed. The image is kept. ${LIMITS}`,
    input: { token },
    annotations: WRITE,
    run: (ctx, who, a) => ctx.runMutation(internal.mcpData.pauseShare, { userId: who.userId, token: a.token }),
  },
  {
    name: "resume_share",
    description: `Serve a paused share link again. If a view limit or end date also stopped it, it stays stopped for that reason. ${LIMITS}`,
    input: { token },
    annotations: WRITE,
    run: (ctx, who, a) => ctx.runMutation(internal.mcpData.resumeShare, { userId: who.userId, token: a.token }),
  },
  {
    name: "set_share_limits",
    description: `Set or clear a share link's view limit and end date. Leave a field out to keep it, pass null to clear it. ${LIMITS}`,
    input: {
      token,
      max_views: z.number().int().nullable().optional(),
      expires_at: z.string().nullable().optional().describe("ISO 8601 date."),
    },
    annotations: WRITE,
    run: (ctx, who, a) =>
      ctx.runMutation(internal.mcpData.setShareLimits, { userId: who.userId, token: a.token, maxViews: a.max_views, expiresAt: parseDate(a.expires_at) }),
  },
  {
    name: "delete_share",
    description: `Move a share link to the trash. It stops being served at once and can be brought back with restore_share until the trash window ends. ${LIMITS}`,
    input: { token },
    annotations: DESTRUCTIVE,
    run: (ctx, who, a) => ctx.runMutation(internal.mcpData.trashShare, { userId: who.userId, token: a.token }),
  },
  {
    name: "list_trash",
    description: `Share links in the trash, and when each will be removed. ${LIMITS}`,
    input: {},
    annotations: READ,
    run: (ctx, who) => ctx.runQuery(internal.mcpData.listTrash, { userId: who.userId }),
  },
  {
    name: "restore_share",
    description: `Bring a share link back from the trash, at the same address and with its limits. ${LIMITS}`,
    input: { token },
    annotations: WRITE,
    run: (ctx, who, a) => ctx.runMutation(internal.mcpData.restoreShare, { userId: who.userId, token: a.token }),
  },
  {
    name: "list_palette",
    description: `The user's saved palette colors, newest first. ${LIMITS}`,
    input: {},
    annotations: READ,
    run: (ctx, who) => ctx.runQuery(internal.mcpData.listPalette, { userId: who.userId }),
  },
  {
    name: "add_palette_colors",
    description: `Add colors to the palette. It holds 32; the oldest fall off past that. ${LIMITS}`,
    input: { colors: z.array(hex).min(1).max(32) },
    annotations: WRITE,
    run: (ctx, who, a) => ctx.runMutation(internal.mcpData.addPaletteColors, { userId: who.userId, colors: a.colors }),
  },
  {
    name: "remove_palette_color",
    description: `Remove one color from the palette. ${LIMITS}`,
    input: { color: hex },
    annotations: WRITE,
    run: (ctx, who, a) => ctx.runMutation(internal.mcpData.removePaletteColor, { userId: who.userId, color: a.color }),
  },
  {
    name: "list_recent_text_styles",
    description: `Recently used text and its font, size and color. ${LIMITS}`,
    input: {},
    annotations: READ,
    run: (ctx, who) => ctx.runQuery(internal.mcpData.listRecentTextStyles, { userId: who.userId }),
  },
  {
    name: "list_export_recipes",
    description: `The user's saved export recipes. ${LIMITS}`,
    input: {},
    annotations: READ,
    run: (ctx, who) => ctx.runQuery(internal.mcpData.listExportRecipes, { userId: who.userId }),
  },
  {
    name: "save_export_recipe",
    description: `Add an export recipe, or replace the one with this name. Pattern tokens: {name}, {n}, {w}, {h}. ${LIMITS}`,
    input: {
      name: z.string().trim().min(1).max(60),
      size: recipeSize,
      format: z.enum(["png", "jpeg", "webp", "avif"]),
      quality: z.number().int().min(1).max(100),
      pattern: z.string().min(1).max(120).default("{name}"),
    },
    annotations: WRITE,
    run: (ctx, who, a) => ctx.runMutation(internal.mcpData.saveExportRecipe, { userId: who.userId, name: a.name, size: a.size, format: a.format, quality: a.quality, pattern: a.pattern }),
  },
  {
    name: "get_backup_summary",
    description: `How many cloud edit backups there are and their total size. Totals only. ${LIMITS}`,
    input: {},
    annotations: READ,
    run: (ctx, who) => ctx.runQuery(internal.mcpData.getBackupSummary, { userId: who.userId }),
  },
  {
    name: "list_ai_usage",
    description: `AI uses so far today and this month, and the caps. Read only: this server can't start an AI job. ${LIMITS}`,
    input: {},
    annotations: READ,
    run: (ctx, who) => ctx.runQuery(internal.mcpData.listAiUsage, { userId: who.userId }),
  },
  {
    name: "list_inbox",
    description: `What's waiting in the Transfer inbox: name, size, who sent it, when it expires. ${LIMITS}`,
    input: {},
    annotations: READ,
    run: (ctx, who) => ctx.runQuery(internal.mcpData.listInbox, { userId: who.userId }),
  },
  {
    name: "send_image_to_inbox",
    description: `Put an image in the user's Transfer inbox, where they add it to the gallery from the editor. Send image_base64 (about 15 MB at most) or a public https image_url (50 MB at most). JPEG, PNG, WebP, AVIF, HEIC or GIF. It waits 7 days and counts against storage. Cannot put anything in the gallery directly. ${LIMITS}`,
    input: {
      image_base64: z.string().optional(),
      image_url: z.string().optional(),
      name: z.string().max(200).optional(),
      sender_name: z.string().max(100).optional().describe("This app's name, shown on the Inbox item."),
    },
    annotations: WRITE,
    run: sendImage,
  },
  {
    name: "remove_from_inbox",
    description: `Delete a waiting transfer and its file. This can't be undone. ${LIMITS}`,
    input: { id: z.string().min(1).max(100).describe("The item's id, from list_inbox.") },
    annotations: DESTRUCTIVE,
    run: (ctx, who, a) => ctx.runMutation(internal.mcpData.removeFromInbox, { userId: who.userId, id: a.id }),
  },
];

/** The client's menu of starting points. */
export const MCP_PROMPTS = [
  {
    name: "tidy_share_links",
    title: "Tidy my share links",
    text: "List my Image Horse share links. Group them into expired, paused and most viewed, then suggest which to pause or delete. Ask me before changing anything.",
  },
  {
    name: "palette_from_brand_colors",
    title: "Make a palette from these brand colors",
    text: "Add these brand colors to my Image Horse palette. Convert any color that isn't hex first, and show me the palette afterward.",
  },
  {
    name: "send_image",
    title: "Send this image to Image Horse",
    text: "Send the image I attached or linked to my Image Horse Transfer inbox, and tell me where to find it.",
  },
];
