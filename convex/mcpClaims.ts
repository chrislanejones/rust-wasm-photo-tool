// ⚠️ CONFIRM AGAINST A REAL TOKEN (ADR-095, morning step 3).
//
// Written from Clerk's docs, before anyone has looked at an OAuth access token
// from the live instance. MCP Inspector shows the claims after sign-in. If a
// name differs, this file is the one-line fix: nothing else spells them.

/** The OAuth client the token was issued to. Required. */
export const CLIENT_ID_CLAIM = "client_id";
/** The granted scopes, space separated. Required. */
export const SCOPE_CLAIM = "scope";
/** Only session tokens carry this. Present = refused. */
export const SESSION_ID_CLAIM = "sid";

/** Advertised in the protected-resource metadata. Must match the default
 *  scopes set in the Clerk dashboard. */
export const MCP_SCOPES = ["profile", "email"];

/** The authorization server a client is sent to. A deployment trusts several
 *  Clerk instances (auth.config.ts) but the metadata can only name one.
 *  `MCP_AUTH_ISSUER` overrides this on a deployment signing in through another
 *  of the trusted instances. */
export const DEFAULT_AUTH_ISSUER = "https://clerk.imagehorse.app";
