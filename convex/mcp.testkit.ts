// Shared by the MCP tests. Two dots in the name, so Convex never pushes it.
import { convexTest } from "convex-test";
import { vi } from "vitest";
import schema from "./schema";
import { resetJwksCache, TRUSTED_ISSUERS } from "./mcpAuth";
import { CLIENT_ID_CLAIM, SCOPE_CLAIM } from "./mcpClaims";

export const ISSUER = TRUSTED_ISSUERS[0]!;
export const SITE = "https://test.convex.site";
export const RESOURCE = `${SITE}/mcp`;
const KID = "test-key";

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64json = (value: unknown) => b64(new TextEncoder().encode(JSON.stringify(value)));

const newKeys = () =>
  crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]) as Promise<CryptoKeyPair>;

export interface Keys { pair: CryptoKeyPair; jwksFetches: () => number }

/** Fresh signing keys, with a mock JWKS in front of `fetch`. No real Clerk call
 *  can happen: an unexpected URL throws unless `passthrough` handles it. */
export async function setupMcp(passthrough?: (url: string, init?: RequestInit) => Promise<Response | undefined>): Promise<Keys> {
  resetJwksCache();
  vi.stubEnv("MCP_ENDPOINT_ENABLED", "1");
  vi.stubEnv("CONVEX_SITE_URL", SITE);
  const pair = await newKeys();
  const jwk = { ...(await crypto.subtle.exportKey("jwk", pair.publicKey)), kid: KID };
  let count = 0;
  vi.stubGlobal("fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url === `${ISSUER}/.well-known/jwks.json`) {
      count += 1;
      return new Response(JSON.stringify({ keys: [jwk] }));
    }
    const handled = await passthrough?.(url, init);
    if (handled) return handled;
    throw new Error(`unexpected fetch: ${url}`);
  });
  return { pair, jwksFetches: () => count };
}

export async function signToken(keys: CryptoKeyPair, claims: Record<string, unknown> = {}, header: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  const body = {
    iss: ISSUER, sub: "user_a", exp: now + 600, nbf: now - 5,
    [CLIENT_ID_CLAIM]: "client_1", [SCOPE_CLAIM]: "profile email", ...claims,
  };
  const signingInput = `${b64json({ alg: "RS256", kid: KID, typ: "JWT", ...header })}.${b64json(body)}`;
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", keys.privateKey, new TextEncoder().encode(signingInput));
  return `${signingInput}.${b64(new Uint8Array(signature))}`;
}

export function newBackend() {
  return convexTest(schema, import.meta.glob("./**/*.*s"));
}
export type Backend = ReturnType<typeof newBackend>;

export function addUser(t: Backend, clerkId: string, fields: Record<string, unknown> = { mcpEnabled: true }) {
  return t.run((ctx) =>
    ctx.db.insert("users", { clerkId, tier: "free", dailyUsage: 0, usageResetAt: Date.now(), createdAt: Date.now(), updatedAt: Date.now(), ...fields }),
  );
}

export function rawPost(t: Backend, token: string | null, body: unknown) {
  return t.fetch("/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
}

export const INITIALIZE = { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "t", version: "1" } } };

export async function callTool(t: Backend, token: string, name: string, args: Record<string, unknown> = {}) {
  const res = await rawPost(t, token, { jsonrpc: "2.0", id: 9, method: "tools/call", params: { name, arguments: args } });
  const json = (await res.json()) as { result?: { isError?: boolean; content: { text: string }[] }; error?: unknown };
  if (!json.result) throw new Error(`no result: ${JSON.stringify(json)}`);
  const text = json.result.content[0]!.text;
  let data: any = null;
  try { data = JSON.parse(text); } catch { /* a refusal is plain text */ }
  return { isError: json.result.isError === true, text, data };
}
