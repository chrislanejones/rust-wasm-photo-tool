import { internal } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { ZodRawShape } from "zod";

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
  run: (ctx: ActionCtx, who: Principal, args: Record<string, unknown>) => Promise<unknown>;
}

/** Said in every description, so a model doesn't promise what can't happen. */
export const LIMITS = "Works on the signed-in user's account only. Cannot open gallery photos (they stay in the browser), run AI jobs or change billing.";

const READ = { readOnlyHint: true };

export const MCP_TOOLS: McpTool[] = [
  {
    name: "get_connection_status",
    description: `Which switches are on and what this app can do. Use for "why can't you…?" questions. ${LIMITS}`,
    input: {},
    annotations: READ,
    run: (ctx, who) => ctx.runQuery(internal.mcp.connectionStatus, who),
  },
];
