# Image Horse MCP — proposed, not available yet

Build stopped at token-verification gate 2. See [ADR-095](adr/095-image-horse-mcp-for-signed-in-users.md). The local transport spike passed; no MCP endpoint or Connections pane is installed.

Planned URL: `https://<deployment>.convex.site/mcp` (placeholder). Planned public metadata: `/.well-known/oauth-protected-resource/mcp`. Scopes are pending verification of the live Clerk instance's JWT OAuth claims and resource binding; there are no supported scopes to configure yet.

Planned tools: get_account, list_shares, pause_share, resume_share, set_share_limits, delete_share, list_palette, add_palette_colors, remove_palette_color, list_recent_text_styles, list_export_recipes, save_export_recipe, get_backup_summary. Only the signed-in user's Convex data is reachable. No gallery photos, AI jobs, billing changes or backup deletion.

After implementation and attended launch, copy the URL from Settings → Connections. In Claude, add a custom connector with that URL and complete OAuth sign-in. In Cursor, add a remote MCP server with that URL in Tools & MCP, then sign in. These steps cannot work against this branch yet. Both online-features consent and “Let AI apps use my account” must permit access.

Reproduce the isolated transport spike: `pnpm exec vitest run convex/mcpSpike.test.ts`. It uses a test-only router and fixture tool; no real Clerk calls or user data.
