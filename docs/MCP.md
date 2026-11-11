# Image Horse MCP

Connect Claude, Cursor or another AI app to your Image Horse account. It's built, and it's off until the server switch is turned on. See [ADR-095](adr/095-image-horse-mcp-for-signed-in-users.md).

## What's needed to turn it on

| Step | Where |
| --- | --- |
| Access token format: **JWT** | Clerk Dashboard → OAuth applications → Settings |
| Turn on CIMD and set the default scopes | Clerk Dashboard |
| `MCP_ENDPOINT_ENABLED=1` | Convex deployment environment |
| Check one real token's claims against `convex/mcpClaims.ts` | MCP Inspector |

Until that variable is set, `/mcp` and `/.well-known/oauth-protected-resource/mcp` answer 404.

## Connecting

1. Turn on **MCP Connections preview** in Settings → Beta.
2. Turn on **Let AI apps use my account** in Settings → Connections.
3. Copy the URL from that pane. In Claude, add a custom connector. In Cursor, add a remote MCP server in Tools & MCP. Then sign in.

Turning the switch off cuts access right away, even if an app still holds a token. Switching a device to "Everything in your browser" turns it off too, as long as that device has a connection when you do it.

## Tools

| Tool | What it does |
| --- | --- |
| `get_account` | Plan, storage, AI uses left today |
| `get_storage` | Storage used and allowed, with a breakdown |
| `get_connection_status` | Which switches are on and what this app can do |
| `list_shares` | Your share links, newest first |
| `pause_share` / `resume_share` | Stop or restart a link |
| `set_share_limits` | View limit and end date |
| `delete_share` | Move a link to the trash |
| `list_trash` / `restore_share` | See the trash and bring a link back |
| `list_palette` / `add_palette_colors` / `remove_palette_color` | Your saved colors |
| `list_recent_text_styles` | Recent text and its styling |
| `list_export_recipes` / `save_export_recipe` | Your export recipes |
| `get_backup_summary` | How many cloud backups, and their total size |
| `list_ai_usage` | AI uses so far and the caps, read only |
| `list_inbox` / `remove_from_inbox` | Your Transfer inbox |
| `send_image_to_inbox` | An AI app sends a picture to your inbox |

An app can only reach your own account's server data. It can't open your gallery photos, which stay in your browser. It can't run AI jobs, change billing or delete backups.

Limits: 60 calls a minute. Images follow the phone's rules: 50 MB, image types only, 50 waiting, and they count against storage. Base64 images stop at about 15 MB, so use a public https URL for bigger ones.

Settings → Connections shows the last 20 calls. The log keeps the app, the tool, the time and whether it worked, for 30 days. It never keeps tokens, arguments or results.
