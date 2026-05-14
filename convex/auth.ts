import { query } from "./_generated/server";
import { getUser } from "./users";

// auth.config.ts handles JWT verification for the Clerk bridge.
// All auth helpers live in users.ts; this file just exposes a convenience query.

export const loggedInUser = query({
  handler: async (ctx) => getUser(ctx),
});
