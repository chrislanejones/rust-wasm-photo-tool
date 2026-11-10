import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { internal } from "./_generated/api";
import { MCP_RATE_LIMIT } from "./mcp";
import { addUser, callTool, INITIALIZE, newBackend, rawPost, setupMcp, signToken, SITE, RESOURCE, type Keys } from "./mcp.testkit";

const METADATA = "/.well-known/oauth-protected-resource/mcp";
let keys: Keys;

beforeEach(async () => { keys = await setupMcp(); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("the server switch", () => {
  it.each([[undefined], ["0"], ["true"]])("MCP_ENDPOINT_ENABLED=%s: every route is a 404", async (value) => {
    vi.stubEnv("MCP_ENDPOINT_ENABLED", value as string);
    const t = newBackend();
    await addUser(t, "user_a");
    const token = await signToken(keys.pair);
    expect((await rawPost(t, token, INITIALIZE)).status).toBe(404);
    expect((await t.fetch("/mcp", { method: "GET" })).status).toBe(404);
    expect((await t.fetch("/mcp", { method: "OPTIONS" })).status).toBe(404);
    expect((await t.fetch(METADATA, { method: "GET" })).status).toBe(404);
    expect((await t.fetch(METADATA, { method: "OPTIONS" })).status).toBe(404);
  });
});

describe("the metadata and CORS", () => {
  it("names the resource and a trusted authorization server", async () => {
    const res = await newBackend().fetch(METADATA, { method: "GET" });
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(await res.json()).toMatchObject({ resource: RESOURCE, authorization_servers: ["https://clerk.imagehorse.app"] });
  });
  it("preflight exposes WWW-Authenticate", async () => {
    const res = await newBackend().fetch("/mcp", { method: "OPTIONS" });
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Expose-Headers")).toContain("WWW-Authenticate");
  });
  it("GET /mcp is a 405: there is no stream", async () => {
    expect((await newBackend().fetch("/mcp", { method: "GET" })).status).toBe(405);
  });
});

describe("token verification", () => {
  const challenge = (res: Response) => res.headers.get("WWW-Authenticate") ?? "";
  const metadataLink = `resource_metadata="${SITE}${METADATA}"`;

  const expectRefused = async (token: string | null, why?: RegExp) => {
    const t = newBackend();
    await addUser(t, "user_a");
    const res = await rawPost(t, token, INITIALIZE);
    expect(res.status).toBe(401);
    expect(challenge(res)).toContain(metadataLink);
    if (why) expect(((await res.json()) as { error_description: string }).error_description).toMatch(why);
  };

  it("no token", () => expectRefused(null));
  it("an opaque token says why", () => expectRefused("oat_abcdef123456", /Opaque/));
  it("a forged signature", async () => {
    const other = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]) as CryptoKeyPair;
    await expectRefused(await signToken(other), /signature/);
  });
  it("alg none, with the signature dropped", async () => {
    const [, body] = (await signToken(keys.pair)).split(".");
    const header = btoa(JSON.stringify({ alg: "none", kid: "test-key" })).replace(/=+$/, "");
    await expectRefused(`${header}.${body}.`, /signature/);
  });
  it("any algorithm but RS256, even correctly signed", async () => expectRefused(await signToken(keys.pair, {}, { alg: "RS512" }), /signature/));
  it("expired", async () => expectRefused(await signToken(keys.pair, { exp: Math.floor(Date.now() / 1000) - 3600 }), /expired/));
  it("no expiry at all", async () => expectRefused(await signToken(keys.pair, { exp: undefined }), /expired/));
  it("not valid yet", async () => expectRefused(await signToken(keys.pair, { nbf: Math.floor(Date.now() / 1000) + 3600 }), /not valid yet/));
  it("wrong issuer, and its JWKS is never fetched", async () => {
    await expectRefused(await signToken(keys.pair, { iss: "https://evil.example" }), /issuer/);
    expect(keys.jwksFetches()).toBe(0);
  });
  it("a session token (sid)", async () => expectRefused(await signToken(keys.pair, { sid: "sess_1" }), /Session/));
  it("no client id", async () => expectRefused(await signToken(keys.pair, { client_id: undefined }), /OAuth/));
  it("no scope", async () => expectRefused(await signToken(keys.pair, { scope: undefined }), /OAuth/));
  it("the app's own convex-audience token", async () => expectRefused(await signToken(keys.pair, { aud: "convex" }), /not issued/));
  it("a valid token with no users row", async () => {
    const t = newBackend();
    const res = await rawPost(t, await signToken(keys.pair), INITIALIZE);
    expect(res.status).toBe(401);
    expect(challenge(res)).toContain(metadataLink);
  });
  it("accepts an aud of this resource, or of the client", async () => {
    const t = newBackend();
    await addUser(t, "user_a");
    expect((await rawPost(t, await signToken(keys.pair, { aud: RESOURCE }), INITIALIZE)).status).toBe(200);
    expect((await rawPost(t, await signToken(keys.pair, { aud: ["client_1"] }), INITIALIZE)).status).toBe(200);
  });
  it("caches the JWKS across requests", async () => {
    const t = newBackend();
    await addUser(t, "user_a");
    const token = await signToken(keys.pair);
    await rawPost(t, token, INITIALIZE);
    await rawPost(t, token, INITIALIZE);
    expect(keys.jwksFetches()).toBe(1);
  });
  it("an unknown kid refetches at most once in 30 seconds", async () => {
    const t = newBackend();
    await addUser(t, "user_a");
    await rawPost(t, await signToken(keys.pair), INITIALIZE);
    await rawPost(t, await signToken(keys.pair, {}, { kid: "rotated" }), INITIALIZE);
    await rawPost(t, await signToken(keys.pair, {}, { kid: "rotated-2" }), INITIALIZE);
    expect(keys.jwksFetches()).toBe(1);
  });
});

describe("kill switches and limits", () => {
  it.each([
    ["absent", {}, /is off/],
    ["switched off", { mcpEnabled: false }, /is off/],
    ["off from a browser-only device", { mcpEnabled: false, mcpOffReason: "browser-only" }, /Everything in your browser/],
  ])("mcpEnabled %s: the tool refuses with the reason, and logs nothing", async (_n, fields, why) => {
    const t = newBackend();
    await addUser(t, "user_a", fields);
    const r = await callTool(t, await signToken(keys.pair), "get_connection_status");
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(why);
    expect(await t.run((ctx) => ctx.db.query("mcp_calls").collect())).toHaveLength(0);
  });

  it("the 61st call in a minute is refused, and another user is unaffected", async () => {
    const t = newBackend();
    const a = await addUser(t, "user_a");
    await addUser(t, "user_b");
    await t.run(async (ctx) => {
      for (let i = 0; i < MCP_RATE_LIMIT - 1; i++) await ctx.db.insert("mcp_calls", { userId: a, clientId: "c", tool: "x", outcome: "ok", at: Date.now() });
    });
    const token = await signToken(keys.pair);
    expect((await callTool(t, token, "get_connection_status")).isError).toBe(false);
    const over = await callTool(t, token, "get_connection_status");
    expect(over.isError).toBe(true);
    expect(over.text).toMatch(/60 a minute/);
    expect((await callTool(t, await signToken(keys.pair, { sub: "user_b" }), "get_connection_status")).isError).toBe(false);
  });

  it("a call older than a minute doesn't count", async () => {
    const t = newBackend();
    const a = await addUser(t, "user_a");
    await t.run(async (ctx) => {
      for (let i = 0; i < MCP_RATE_LIMIT; i++) await ctx.db.insert("mcp_calls", { userId: a, clientId: "c", tool: "x", outcome: "ok", at: Date.now() - 61_000 });
    });
    expect((await callTool(t, await signToken(keys.pair), "get_connection_status")).isError).toBe(false);
  });

  it("logs the client and tool, and no arguments", async () => {
    const t = newBackend();
    await addUser(t, "user_a");
    await callTool(t, await signToken(keys.pair), "get_connection_status");
    const [row, ...rest] = await t.run((ctx) => ctx.db.query("mcp_calls").collect());
    expect(rest).toHaveLength(0);
    expect(Object.keys(row!).sort()).toEqual(["_creationTime", "_id", "at", "clientId", "outcome", "tool", "userId"]);
    expect(row).toMatchObject({ clientId: "client_1", tool: "get_connection_status", outcome: "ok" });
  });

  it("expire is a dry run unless told otherwise", async () => {
    const t = newBackend();
    const a = await addUser(t, "user_a");
    const old = Date.now() - 31 * 86_400_000;
    await t.run(async (ctx) => {
      await ctx.db.insert("mcp_calls", { userId: a, clientId: "c", tool: "x", outcome: "ok", at: old });
      await ctx.db.insert("mcp_calls", { userId: a, clientId: "c", tool: "y", outcome: "ok", at: Date.now() });
    });
    expect(await t.mutation(internal.mcp.expire, {})).toMatchObject({ mode: "dry-run", rows: 1 });
    expect(await t.run((ctx) => ctx.db.query("mcp_calls").collect())).toHaveLength(2);
    await t.mutation(internal.mcp.expire, { apply: true });
    expect((await t.run((ctx) => ctx.db.query("mcp_calls").collect())).map((r) => r.tool)).toEqual(["y"]);
  });
});

describe("the transport", () => {
  it("initialize answers as JSON with no session", async () => {
    const t = newBackend();
    await addUser(t, "user_a");
    const res = await rawPost(t, await signToken(keys.pair), INITIALIZE);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(res.headers.get("mcp-session-id")).toBeNull();
    expect(((await res.json()) as any).result.serverInfo.name).toBe("image-horse");
  });
});
