import { api } from "../../../convex/_generated/api";
import { useCloudAuth, useCloudMutation, useCloudQuery } from "@/lib/cloud";
import { useUIStore } from "@/stores/useUIStore";
import { useMcpPreview } from "@/hooks/useMcpPreview";
import { PaneHeading } from "@/components/ui/pane-heading";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";

const PROMPTS = [
  "What's in my Image Horse account?",
  "Add #1f6feb to my palette",
  "Send this picture to Image Horse",
];

async function copy(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(done);
  } catch {
    toast.error("Couldn't copy. Select and copy the text.");
  }
}

function switchHint(online: boolean, offReason: string | null | undefined): string {
  if (!online) return "This browser is on Everything in your browser. Turn on online features in Security first.";
  if (offReason === "browser-only") return "This went off when a device switched to Everything in your browser.";
  return "Turning this off cuts access right away, even if an app still holds a token.";
}

function ConnectedPane() {
  const online = useUIStore((s) => s.onlineFeaturesEnabled);
  const connection = useCloudQuery(api.mcp.connection);
  const calls = useCloudQuery(api.mcp.recentCalls);
  const setEnabled = useCloudMutation(api.mcp.setEnabled);
  const url = connection?.url ?? null;

  return (
    <div className="space-y-5">
      <PaneHeading title="Connect an AI app · Beta">
        Let Claude, Cursor and other AI apps work with your Image Horse account.
      </PaneHeading>
      <section className="space-y-2">
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={connection?.enabled === true}
            disabled={!connection || (!online && !connection.enabled)}
            aria-describedby="mcp-switch-hint"
            onCheckedChange={(enabled) => {
              setEnabled({ enabled }).catch(() => toast.error("Couldn't change that. Please try again."));
            }}
          />
          Let AI apps use my account
        </label>
        <p id="mcp-switch-hint" className="text-sm text-text-muted">{switchHint(online, connection?.offReason)}</p>
        <p className="text-sm text-text-muted">Switching a device to Everything in your browser also turns this off, as long as that device has a connection when you do it.</p>
      </section>
      <section className="space-y-2">
        <PaneHeading title="Connection URL" />
        {url ? (
          <div className="flex items-center justify-between gap-3 text-sm">
            <code className="break-all">{url}</code>
            <Button onClick={() => copy(url, "URL copied")}>Copy URL</Button>
          </div>
        ) : (
          <p className="text-sm text-text-muted">Not switched on yet.</p>
        )}
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>Claude: add a custom connector with this URL, then sign in.</li>
          <li>Cursor: add a remote MCP server with this URL in Tools &amp; MCP, then sign in.</li>
        </ul>
      </section>
      <section className="space-y-2">
        <PaneHeading title="What an AI app can do" />
        <p className="text-sm">See your usage, shares, palette, recent text styles, export recipes, backup totals and Transfer inbox. Manage your shares and palette, save recipes, and send an image to your inbox. Deleting a share moves it to the trash.</p>
        <p className="text-sm text-text-muted">Your gallery photos stay in your browser. AI apps can't open them, run AI jobs, change billing or delete backups, and can't reach anyone else's account.</p>
      </section>
      <section className="space-y-2">
        <PaneHeading title="Try after connecting" />
        {PROMPTS.map((prompt) => (
          <div key={prompt} className="flex items-center justify-between gap-3 text-sm">
            <span>{prompt}</span>
            <Button onClick={() => copy(prompt, "Prompt copied")}>Copy prompt</Button>
          </div>
        ))}
      </section>
      <section className="space-y-2">
        <PaneHeading title="Recent activity" />
        {calls === undefined ? (
          <p role="status" className="text-sm text-text-muted">Loading activity…</p>
        ) : calls.length === 0 ? (
          <p className="text-sm text-text-muted">No AI app has used your account yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-muted"><th>App</th><th>Tool</th><th>Time</th><th>Result</th></tr>
            </thead>
            <tbody>
              {calls.map((c) => (
                <tr key={c.id}>
                  <td className="break-all">{c.app}</td>
                  <td>{c.tool}</td>
                  <td>{new Date(c.at).toLocaleString("en-US")}</td>
                  <td>{c.outcome === "ok" ? "OK" : "Error"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

export function ConnectionsPane() {
  const preview = useMcpPreview();
  const { isLoading, isAuthenticated } = useCloudAuth();
  if (!preview) return null;
  if (isLoading) return <p role="status">Checking sign-in…</p>;
  if (!isAuthenticated) return <p>Sign in to connect an AI app</p>;
  return <ConnectedPane />;
}
