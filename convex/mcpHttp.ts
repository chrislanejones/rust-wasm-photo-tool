import type { HttpRouter } from "convex/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { ConvexError } from "convex/values";
import { z } from "zod";
import { httpAction, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { DEFAULT_AUTH_ISSUER, MCP_SCOPES } from "./mcpClaims";
import { TRUSTED_ISSUERS, verifyAccessToken } from "./mcpAuth";
import { MCP_TOOLS, type McpTool, type Principal } from "./mcpTools";

// ── The MCP endpoint: POST /mcp, stateless JSON (ADR-095) ─────────────────────
//
// OFF BY DEFAULT. Every route answers 404 until the deployment has
// MCP_ENDPOINT_ENABLED=1, so merging and deploying this changes nothing.

// Convex's runtime has no eval, and these two would otherwise compile code:
// zod's fast path, and the SDK's default JSON-schema validator (only used for
// output schemas and elicitation, neither of which this server has).
z.config({ jitless: true });
const noValidator = {
  getValidator: () => (input: unknown) => ({ valid: true as const, data: input, errorMessage: undefined }),
};

const METADATA_PATH = "/.well-known/oauth-protected-resource/mcp";

export const endpointEnabled = () => process.env.MCP_ENDPOINT_ENABLED === "1";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID",
  "Access-Control-Expose-Headers": "WWW-Authenticate, Mcp-Session-Id",
  "Access-Control-Max-Age": "86400",
};

const notFound = () => new Response("Not found", { status: 404 });

/** The deployment's own address, not the request's Host header. */
function siteOf(request: Request): string {
  return process.env.CONVEX_SITE_URL ?? new URL(request.url).origin;
}

function authIssuer(): string {
  const chosen = process.env.MCP_AUTH_ISSUER;
  return chosen && TRUSTED_ISSUERS.includes(chosen) ? chosen : DEFAULT_AUTH_ISSUER;
}

function unauthorized(request: Request, description?: string): Response {
  const metadata = `resource_metadata="${siteOf(request)}${METADATA_PATH}"`;
  const challenge = description
    ? `Bearer error="invalid_token", error_description="${description.replace(/"/g, "'")}", ${metadata}`
    : `Bearer ${metadata}`;
  return new Response(JSON.stringify({ error: "invalid_token", error_description: description ?? "Sign in to connect." }), {
    status: 401,
    headers: { ...CORS, "Content-Type": "application/json", "WWW-Authenticate": challenge },
  });
}

const textResult = (text: string, isError = false) => ({ content: [{ type: "text" as const, text }], ...(isError ? { isError } : {}) });

/** A `ConvexError` is a refusal written for the person. Anything else is a bug,
 *  and its message doesn't leave the server. */
function failureText(error: unknown): string {
  return error instanceof ConvexError && typeof error.data === "string" ? error.data : "That didn't work. Please try again.";
}

function runTool(ctx: ActionCtx, who: Principal, tool: McpTool) {
  return async (args: Record<string, unknown>) => {
    const admitted = await ctx.runMutation(internal.mcp.admit, { userId: who.userId, clientId: who.clientId, tool: tool.name });
    if (!admitted.ok) return textResult(admitted.message, true);
    try {
      return textResult(JSON.stringify(await tool.run(ctx, who, args), null, 2));
    } catch (error) {
      await ctx.runMutation(internal.mcp.markFailed, { callId: admitted.callId });
      return textResult(failureText(error), true);
    }
  };
}

function buildServer(ctx: ActionCtx, who: Principal): McpServer {
  const server = new McpServer({ name: "image-horse", version: "1.0.0" }, { jsonSchemaValidator: noValidator as never });
  for (const tool of MCP_TOOLS) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.input, annotations: tool.annotations },
      runTool(ctx, who, tool) as never,
    );
  }
  return server;
}

async function handleMcp(ctx: ActionCtx, request: Request): Promise<Response> {
  const header = request.headers.get("Authorization");
  const token = header?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return unauthorized(request);

  const verified = await verifyAccessToken(token, { resource: `${siteOf(request)}/mcp` });
  if (!verified.ok) return unauthorized(request, verified.description);

  const principal = await ctx.runQuery(internal.mcp.principalFor, { clerkId: verified.subject });
  if (!principal) return unauthorized(request, "No Image Horse account for this sign-in.");

  const server = buildServer(ctx, { userId: principal.userId, clientId: verified.clientId, scopes: verified.scopes });
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try {
    const response = await transport.handleRequest(request);
    const headers = new Headers(response.headers);
    for (const [k, value] of Object.entries(CORS)) headers.set(k, value);
    return new Response(await response.text(), { status: response.status, headers });
  } finally {
    await server.close();
  }
}

const whenEnabled = (handler: (ctx: ActionCtx, request: Request) => Promise<Response> | Response) =>
  httpAction(async (ctx, request) => (endpointEnabled() ? handler(ctx, request) : notFound()));

const preflight = whenEnabled(() => new Response(null, { status: 204, headers: CORS }));

export function registerMcpRoutes(http: HttpRouter): void {
  http.route({ path: "/mcp", method: "POST", handler: whenEnabled(handleMcp) });
  // Stateless: no server-to-client stream to open.
  http.route({
    path: "/mcp",
    method: "GET",
    handler: whenEnabled(() => new Response(null, { status: 405, headers: { ...CORS, Allow: "POST" } })),
  });
  http.route({ path: "/mcp", method: "OPTIONS", handler: preflight });
  http.route({
    path: METADATA_PATH,
    method: "GET",
    handler: whenEnabled((_ctx, request) =>
      new Response(
        JSON.stringify({
          resource: `${siteOf(request)}/mcp`,
          authorization_servers: [authIssuer()],
          bearer_methods_supported: ["header"],
          scopes_supported: MCP_SCOPES,
        }),
        { status: 200, headers: { ...CORS, "Content-Type": "application/json" } },
      ),
    ),
  });
  http.route({ path: METADATA_PATH, method: "OPTIONS", handler: preflight });
}
