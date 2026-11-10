import authConfig from "./auth.config";
import { CLIENT_ID_CLAIM, SCOPE_CLAIM, SESSION_ID_CLAIM } from "./mcpClaims";

// ── Verifying an MCP access token (ADR-095) ───────────────────────────────────
//
// JWT ONLY, with the issuer's public keys: no network call to Clerk per
// request and no secret key anywhere. An opaque token would need a lookup with
// a secret, so it gets a 401 that says why.
//
// A JWT CAN'T BE REVOKED BEFORE IT EXPIRES. That is why `users.mcpEnabled` is
// read on every tool call: it is the kill switch, not the token.
//
// THE JWKS URL COMES FROM OUR CONFIG. The token only picks which trusted issuer
// it claims. A token can never name where its own keys are fetched from.

export const TRUSTED_ISSUERS: readonly string[] = authConfig.providers.map((p) => p.domain);

const CLOCK_SKEW_SECONDS = 30;
const JWKS_TTL_MS = 60 * 60 * 1000;
/** An unknown `kid` refetches (keys rotate), but at most this often, so junk
 *  tokens can't turn into a stream of requests to Clerk. */
const JWKS_MIN_REFETCH_MS = 30 * 1000;

export interface VerifiedToken {
  ok: true;
  subject: string;
  clientId: string;
  scopes: string[];
}
export interface RefusedToken {
  ok: false;
  description: string;
}

type Jwk = JsonWebKey & { kid?: string };
const jwksCache = new Map<string, { keys: Jwk[]; at: number }>();

/** Tests only: each test signs with its own key. */
export function resetJwksCache(): void {
  jwksCache.clear();
}

async function fetchJwks(issuer: string, now: number): Promise<Jwk[] | null> {
  try {
    const res = await fetch(`${issuer}/.well-known/jwks.json`);
    if (!res.ok) return null;
    const body = (await res.json()) as { keys?: Jwk[] };
    if (!Array.isArray(body.keys)) return null;
    jwksCache.set(issuer, { keys: body.keys, at: now });
    return body.keys;
  } catch {
    return null;
  }
}

/** The public key for `kid`: from the cache when it is there and fresh, else
 *  from a refetch (rotation). If the refetch fails, a key we already hold still
 *  works, so a Clerk outage doesn't end a working connection. */
async function keyFor(issuer: string, kid: string, now: number): Promise<Jwk | null> {
  const cached = jwksCache.get(issuer);
  const find = (keys: Jwk[] | undefined) => keys?.find((k) => k.kid === kid) ?? null;
  if (cached && now - cached.at < JWKS_TTL_MS) {
    const hit = find(cached.keys);
    if (hit || now - cached.at < JWKS_MIN_REFETCH_MS) return hit;
  }
  return find((await fetchJwks(issuer, now)) ?? cached?.keys);
}

function decodeSegment(segment: string): Uint8Array<ArrayBuffer> {
  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function parseSegment(segment: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(decodeSegment(segment)));
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const refuse = (description: string): RefusedToken => ({ ok: false, description });

export async function verifyAccessToken(
  token: string,
  options: { resource: string; now?: number },
): Promise<VerifiedToken | RefusedToken> {
  const nowMs = options.now ?? Date.now();
  const parts = token.split(".");
  const header = parts.length === 3 ? parseSegment(parts[0]!) : null;
  const claims = parts.length === 3 ? parseSegment(parts[1]!) : null;
  if (!header || !claims) return refuse("Only JWT access tokens are accepted. Opaque tokens are not.");

  if (header.alg !== "RS256" || typeof header.kid !== "string") return refuse("Unsupported token signature.");
  if (typeof claims.iss !== "string" || !TRUSTED_ISSUERS.includes(claims.iss)) return refuse("Unknown token issuer.");

  const jwk = await keyFor(claims.iss, header.kid, nowMs);
  if (!jwk || jwk.kty !== "RSA") return refuse("The token's signing key was not found.");

  let valid = false;
  try {
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      decodeSegment(parts[2]!),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
  } catch {
    valid = false;
  }
  if (!valid) return refuse("The token's signature is not valid.");

  const now = nowMs / 1000;
  if (typeof claims.exp !== "number" || now > claims.exp + CLOCK_SKEW_SECONDS) return refuse("The token has expired.");
  if (claims.nbf !== undefined && (typeof claims.nbf !== "number" || now < claims.nbf - CLOCK_SKEW_SECONDS)) {
    return refuse("The token is not valid yet.");
  }
  if (typeof claims.sub !== "string" || !claims.sub) return refuse("The token has no subject.");

  // An ordinary Image Horse session is not an AI app's grant.
  if (claims[SESSION_ID_CLAIM] !== undefined) return refuse("Session tokens are not accepted. Use an OAuth access token.");
  const clientId = claims[CLIENT_ID_CLAIM];
  const scope = claims[SCOPE_CLAIM];
  if (typeof clientId !== "string" || !clientId || typeof scope !== "string") {
    return refuse("This is not an OAuth access token.");
  }

  // Checked when present. What the live token carries is recorded in ADR-095
  // after the attended check; Clerk may name the client here, not the resource.
  if (claims.aud !== undefined) {
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!audiences.includes(options.resource) && !audiences.includes(clientId)) {
      return refuse("The token was not issued for this server.");
    }
  }

  return { ok: true, subject: claims.sub, clientId, scopes: scope.split(" ").filter(Boolean) };
}
