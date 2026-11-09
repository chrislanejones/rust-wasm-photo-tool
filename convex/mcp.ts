import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

// ── MCP: who is calling, may they, and what happened (ADR-095) ────────────────

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

/** Calls per user per rolling minute. The 61st is refused. */
export const MCP_RATE_LIMIT = 60;
export const MCP_LOG_DAYS = 30;

/** Why this account refuses AI apps, or null if it doesn't. Off unless the
 *  owner turned it on: absent reads as off. */
export function mcpRefusal(user: Pick<Doc<"users">, "mcpEnabled" | "mcpOffReason">): string | null {
  if (user.mcpEnabled === true) return null;
  return user.mcpOffReason === "browser-only"
    ? 'AI access went off when a device switched to "Everything in your browser". Turn on "Let AI apps use my account" in Settings › Connections to use it again.'
    : 'AI access is off for this account. Turn on "Let AI apps use my account" in Settings › Connections.';
}

/** The `users` row for a verified token's subject, or null (a 401). */
export const principalFor = internalQuery({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
      .first();
    return user ? { userId: user._id } : null;
  },
});

/** Both kill switches and the rate limit, in one transaction, before every
 *  tool runs. Only an admitted call is logged, so a refused caller can't grow
 *  the table. */
export const admit = internalMutation({
  args: { userId: v.id("users"), clientId: v.string(), tool: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return { ok: false as const, message: "This account no longer exists." };
    const refusal = mcpRefusal(user);
    if (refusal) return { ok: false as const, message: refusal };

    const now = Date.now();
    const recent = await ctx.db
      .query("mcp_calls")
      .withIndex("by_userId_at", (q) => q.eq("userId", args.userId).gt("at", now - MINUTE_MS))
      .take(MCP_RATE_LIMIT);
    if (recent.length >= MCP_RATE_LIMIT) {
      return { ok: false as const, message: `Too many calls: the limit is ${MCP_RATE_LIMIT} a minute. Try again shortly.` };
    }
    const callId = await ctx.db.insert("mcp_calls", { ...args, outcome: "ok", at: now });
    return { ok: true as const, callId };
  },
});

/** The tool threw after it was admitted. */
export const markFailed = internalMutation({
  args: { callId: v.id("mcp_calls") },
  handler: async (ctx, { callId }) => {
    await ctx.db.patch(callId, { outcome: "error" });
  },
});

/** get_connection_status. */
export const connectionStatus = internalQuery({
  args: { userId: v.id("users"), clientId: v.string(), scopes: v.array(v.string()) },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    return {
      account_access: user?.mcpEnabled === true ? "on" : "off",
      this_client: args.clientId,
      granted_scopes: args.scopes,
      calls_per_minute: MCP_RATE_LIMIT,
      cannot_do: ["open gallery photos (they stay in the browser)", "run AI jobs", "change billing", "delete backups"],
    };
  },
});

// ── Expiry ────────────────────────────────────────────────────────────────────
//
// ⚠️ DRY RUN UNLESS TOLD OTHERWISE (ADR-101's rule), and its cron is commented
// out in crons.ts.
//
//   pnpm exec convex run mcp:expire '{}'               # report
//   pnpm exec convex run mcp:expire '{"apply": true}'  # delete

export const expire = internalMutation({
  args: { apply: v.optional(v.boolean()), maxRows: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const apply = args.apply === true;
    const maxRows = Math.max(1, Math.floor(args.maxRows ?? 500));
    const found = await ctx.db
      .query("mcp_calls")
      .withIndex("by_at", (q) => q.lt("at", Date.now() - MCP_LOG_DAYS * DAY_MS))
      .take(maxRows + 1);
    const batch = found.slice(0, maxRows);
    if (apply) for (const row of batch) await ctx.db.delete(row._id);
    const mode = apply ? "applied" : "dry-run";
    console.log(`mcp.expire ${mode}: ${batch.length} calls past ${MCP_LOG_DAYS} days`);
    return { mode, rows: batch.length, more: found.length > maxRows };
  },
});
