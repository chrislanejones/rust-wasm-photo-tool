// .convex/users.ts
import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { entitlementOf, isAdminEmail, type Role } from "./entitlement";

// ── Helpers (import these in other Convex files) ──────────

/** Resolve Clerk JWT → internal user. Returns null if not signed in. */
export async function getUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  return await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
    .unique();
}

/** Resolve Clerk JWT → internal user. Throws if not signed in.
 *  Auto-creates the user row on first call. */
export async function requireUser(ctx: MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");

  const existing = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
    .unique();

  if (existing) return existing;

  // First time this Clerk user hits a mutation — create their row
  const now = Date.now();
  const id = await ctx.db.insert("users", {
    clerkId: identity.subject,
    email: identity.email,
    name: identity.name,
    avatarUrl: identity.pictureUrl,
    tier: "free",
    dailyUsage: 0,
    usageResetAt: now,
    createdAt: now,
    updatedAt: now,
  });

  const user = await ctx.db.get(id);
  if (!user) throw new Error("Failed to create user");
  return user;
}

/** Convenience: resolve Clerk JWT → internal user _id (or null). */
export async function getUserId(ctx: QueryCtx | MutationCtx) {
  const user = await getUser(ctx);
  return user?._id ?? null;
}

// ── Public API ────────────────────────────────────────────

/** Get the current user's profile (or null). */
/** The admin list, from the deployment. `ADMIN_EMAILS` (plural, comma
 *  separated) is the one to set; `ADMIN_EMAIL` is the older single-address
 *  name and still works, so the variable already on a deployment keeps
 *  working. Missing means nobody is an admin — see `isAdminEmail`. */
function adminList(): string | undefined {
  return process.env.ADMIN_EMAILS ?? process.env.ADMIN_EMAIL;
}

/** The signed-in person's role. The SERVER decides this; the browser only
 *  reads what `me` reports (it used to compare the email itself, in
 *  app/src/lib/superuser.ts). */
export async function roleOf(ctx: QueryCtx | MutationCtx, user: Doc<"users"> | null): Promise<Role> {
  const identity = await ctx.auth.getUserIdentity();
  const email = user?.email ?? identity?.email ?? null;
  return isAdminEmail(email, adminList()) ? "admin" : "user";
}

/**
 * The signed-in user's row, plus what the app is allowed to do with it.
 *
 * `role` and `entitlement` are computed here so there is one answer: the UI
 * gates on what this returns, and every mutation that guards a paid feature
 * calls the same `entitlementOf`. An admin is entitled to paid WITHOUT a tier
 * grant (convex/entitlement.ts explains why).
 */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await getUser(ctx);
    const role = await roleOf(ctx, user);
    return user === null
      ? null
      : { ...user, role, entitlement: entitlementOf(user.tier, role, true) };
  },
});

/** Upsert: sync latest Clerk profile data into Convex.
 *  Called client-side via useStoreUser on every sign-in. */
export const upsert = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    const now = Date.now();

    if (existing) {
      // Refresh profile fields from Clerk
      await ctx.db.patch(existing._id, {
        email: identity.email,
        name: identity.name,
        avatarUrl: identity.pictureUrl,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("users", {
      clerkId: identity.subject,
      email: identity.email,
      name: identity.name,
      avatarUrl: identity.pictureUrl,
      tier: "free",
      dailyUsage: 0,
      usageResetAt: now,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Persist the user's app settings — a JSON blob + its SHA-256. The hash lets
 *  the caller skip redundant writes; we also no-op here when it's unchanged. */
export const saveSettings = mutation({
  args: { settings: v.string(), hash: v.string() },
  handler: async (ctx, { settings, hash }) => {
    const user = await requireUser(ctx);
    if (user.settingsHash === hash) return; // unchanged — nothing to write
    await ctx.db.patch(user._id, {
      settings,
      settingsHash: hash,
      updatedAt: Date.now(),
    });
  },
});

/** DEV/ADMIN: set a user's tier by email. internalMutation -> NOT callable
 *  from the client; only via `npx convex run users:devGrantTier`. */
export const devGrantTier = internalMutation({
  args: {
    email: v.string(),
    tier: v.union(v.literal("free"), v.literal("pro"), v.literal("team")),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (!user) {
      return { ok: false, message: `No user with email ${args.email} - sign in once first.` };
    }
    await ctx.db.patch(user._id, { tier: args.tier, updatedAt: Date.now() });
    return { ok: true, message: `Set ${args.email} -> ${args.tier}` };
  },
});

/** ADMIN: set the SIGNED-IN admin's own tier — the Super User pane "Apply"
 *  grants a real tier so AI can actually be tested. Public but gated to the
 *  ADMIN_EMAIL Convex env var (throws for everyone else, and if the env var is
 *  unset). Stripe / devGrantTier remain the source of truth for real users. */
export const setMyTier = mutation({
  args: {
    tier: v.union(v.literal("free"), v.literal("pro"), v.literal("team")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await requireUser(ctx); // user row (email reliably set by useStoreUser)
    // Prefer the stored email; fall back to the JWT claim (which some Clerk JWT
    // templates omit — that was making this throw "Not authorized" when signed in).
    // One admin check for the whole backend, and it takes a LIST now.
    if (!isAdminEmail(user.email ?? identity.email, adminList())) {
      throw new Error("Not authorized");
    }
    await ctx.db.patch(user._id, { tier: args.tier, updatedAt: Date.now() });
    return { ok: true, tier: args.tier };
  },
});
