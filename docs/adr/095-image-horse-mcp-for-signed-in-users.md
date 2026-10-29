# ADR-095: Image Horse speaks MCP for signed-in users, from Convex, with Clerk as authorization server

Date: 2026-10-29. Status: draft — build stopped at gate 2 pending instance evidence. Task: 218. Base: 8acc583 (v9.41).

## Decision and gates

Prefer a Convex HTTP action at `https://<deployment>.convex.site/mcp` with the SDK web-standard Streamable HTTP transport, stateless JSON responses and no SSE. Do not ship an endpoint until both gates pass.

**Gate 1 passed in the requested local harness.** `convex/mcpSpike.test.ts`, SDK 1.32.2, convex-test 0.0.62, edge-runtime: `t.fetch` exercises initialize, tools/list and tools/call get_account across independent requests, checks JSON and absence of a session ID. Red: a deliberately unimplemented handler returned 501. Green: the SDK handler passed. The account response is explicitly a fixture, not an account read. The router exists only in the test module; production http.ts is unchanged. This demonstrates the harness compatibility, not a deployed Convex runtime or real-client test.

**Gate 2 unresolved, not an opaque-token finding.** Clerk supports JWT and opaque OAuth access tokens, selected in OAuth applications → Settings → Access token format. JWT support alone does not establish the live application's development-instance setting. No real OAuth token was obtained, no private instance setting was queried, and no dashboard setting was changed. Under the instruction to stop rather than guess, implementation stops here. Chris must confirm JWT format on the exact instance used by the live app and verify the issued token's issuer, subject, audience/resource and scopes. An ID token or ordinary Convex session token is not evidence about OAuth access tokens.

Sources checked 2026-10-29:
- [Clerk OAuth implementation](https://clerk.com/docs/guides/configure/auth-strategies/oauth/how-clerk-implements-oauth): token format is configurable.
- [Token formats](https://clerk.com/docs/guides/development/machine-auth/token-formats): JWTs permit public-key verification; opaque tokens require a server lookup.
- [OAuth verification](https://clerk.com/docs/guides/configure/auth-strategies/oauth/verify-oauth-tokens): manual JWT verification is supported.
- [MCP setup](https://clerk.com/docs/expressjs/guides/ai/mcp/build-mcp-server) and [clients](https://clerk.com/docs/guides/ai/mcp/connect-mcp-client): CIMD, PKCE S256, optional DCR and default scopes.

## Hosting alternatives

| Option | Data access | Secrets and tradeoff |
| --- | --- | --- |
| A: Convex HTTP action | Internal functions with verified user ID | Public Clerk JWKS for JWTs; transport passes the local spike. Preferred. |
| B: Vercel function / mcp-handler | Requires a Convex bridge or independently valid per-user Convex credential | An OAuth token is not automatically a Convex token. A shared bridge secret expands trust and introduces a Vercel secret. Not authorized. |

If the instance issues opaque tokens, Chris can choose JWT issuance and repeat the verification gate, defer MCP, or explicitly reconsider the authentication architecture. Do not silently introduce introspection, a Clerk secret, a deploy key, or option B. No secret keys were added. The production Clerk cutover (99) requires repeating the instance checks.

## Reach and authorization contract (proposed, not implemented)

The gallery's photos are browser IndexedDB data. This service cannot open them. Only signed-in users with a matching `users.by_clerkId` row can access server data; missing row means 401. Validate JWT signature using trusted issuer JWKS, allowed algorithm, expiry, issuer, audience/resource and scopes. Never accept a caller-supplied user ID or token-controlled JWKS URL. Reject session/ID tokens and opaque tokens. Every internal tool derives its explicit user ID from verified auth and checks ownership again when accessing a resource.

POST /mcp requires authentication. Missing or invalid credentials return 401 with WWW-Authenticate referencing public GET /.well-known/oauth-protected-resource/mcp. Metadata declares the exact MCP resource, trusted Clerk authorization server and supported scopes. OPTIONS on both routes provides CORS and exposes WWW-Authenticate. Scope names and resource binding remain to be confirmed against issued tokens; do not advertise invented working scopes.

Two independent kill switches must refuse every tool: server-observable online-features consent and per-user mcpEnabled. The current UI choice lives in useUIStore.onlineFeaturesEnabled; implementation must establish reliable server enforcement, including stale/missing consent, before launch. A browser-only flag cannot guarantee server refusal. Disabling online features needs a defined revocation transition before network shutdown; do not claim a disconnected browser can notify a server.

Additive proposed schema: users.mcpEnabled optional boolean; absent means disabled during Beta. Launch default may become enabled only by an explicit launch policy, preserving explicit false. Add mcp_calls with userId, clientId, tool, at and ok/error outcome, indexed by_userId_at. Store no tokens, arguments or response bodies. Keep 30 days via bounded scheduled cleanup. Use transactional per-user rate enforcement (60 calls/minute, N+1 refused); bound failed-call logging to avoid abuse. Recent activity shows the user's last 20 calls.

## Tools

All descriptions must state no gallery photos and no AI execution. Factor existing function bodies into shared helpers with explicit user IDs rather than copying validation or ownership logic.

| Tools | Scope of behavior |
| --- | --- |
| get_account | Tier, storage used/allowed in MiB, remaining daily AI uses; no billing changes |
| list_shares | Own shares, newest first, paged: title, link, views, limits, expiry, paused |
| pause_share / resume_share / set_share_limits | Own shares; existing shares validation |
| delete_share | Own share only; destructive description and MCP annotation for client confirmation |
| list_palette / add_palette_colors / remove_palette_color | Own colors; existing hex validation and palette cap |
| list_recent_text_styles | Own recent text styles |
| list_export_recipes / save_export_recipe | Own synced preferences recipes; preserve unrelated settings and sync revision semantics |
| get_backup_summary | Own photo_edits count and total bytes only; no archives or deletion |

Recipes are eligible: app/src/lib/preferences.ts serializes exportRecipes and app/src/lib/sync/docs.ts defines prefs format 2 with recipes. useZipRecipeStore holds the selection, not the saved recipe collection.

Connections is a separate Settings pane and hook behind mcp-connector Beta. Signed-out users see only “Sign in to connect an AI app”. Signed-in users get the URL/Copy, Claude and Cursor setup, “Let AI apps use my account”, and recent activity. AppShell gains no lines. No pane or schema change is shipped by this gate report.

## Verification still required after gate 2

Only transport red → green ran for MCP. Do not describe security tests as passed. Required next: locally signed JWT/mock JWKS tests for missing/expired/wrong issuer/wrong audience tokens and missing user rows; isolation for every tool including adversarial IDs; both kill switches for every tool; public metadata/CORS; actual delete reflected by existing app query; rate limit at 61 including concurrency; recipe revision preservation; existing share/palette regression coverage. No real Clerk calls in tests.

## Attended continuation

Read this ADR, confirm the live instance and JWT format/claims, then resume implementation and security tests. Only after that: Chris enables CIMD (DCR only if needed), configures agreed default scopes, merges and deploys, enables Beta for himself, connects Claude, exercises reads/pause/palette, checks activity and verifies immediate kill-switch refusal. Repeat configuration after production cutover. No merge or deploy occurred tonight.

V2 may accept an image into the user's Transfer inbox once 192 exists, then create a share from a supplied image. Neither grants access to browser-local gallery contents.
