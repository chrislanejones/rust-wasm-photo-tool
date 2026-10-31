import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import schema from "./schema";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

// Test-only router: never installs an unauthenticated endpoint in http.ts.
test("stateless MCP transport in a Convex HTTP action", async () => {
  const http = httpRouter();
  http.route({ path: "/mcp", method: "POST", handler: httpAction(async (_ctx, request) => {
    const server = new McpServer({ name: "spike", version: "1" });
    server.registerTool("get_account", { description: "Transport fixture only; no account or photos." }, async () => ({ content: [{ type: "text", text: "transport fixture only" }] }));
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await server.connect(transport);
    try { return await transport.handleRequest(request); }
    finally { await server.close(); }
  }) });
  const t = convexTest(schema, { ...import.meta.glob("./**/*.*s"), "./http.ts": async () => ({ default: http }) });
  const rpc = async (id: number, method: string, params: object) => {
    const response = await t.fetch("/mcp", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id, method, params }) });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("mcp-session-id")).toBeNull();
    return response.json();
  };
  expect((await rpc(1, "initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "spike", version: "1" } })).result.serverInfo.name).toBe("spike");
  expect((await rpc(2, "tools/list", {})).result.tools[0].name).toBe("get_account");
  expect((await rpc(3, "tools/call", { name: "get_account", arguments: {} })).result.content[0].text).toBe("transport fixture only");
});
