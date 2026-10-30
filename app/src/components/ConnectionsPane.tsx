import { useCloudAuth } from "@/lib/cloud";
import { useUIStore } from "@/stores/useUIStore";
import { useMcpPreview } from "@/hooks/useMcpPreview";
import { PaneHeading } from "@/components/ui/pane-heading";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";

const PROMPTS = [
  "What's in my Image Horse account?",
  "Pause my newest share",
  "Add #1f6feb to my palette",
];

export function ConnectionsPane() {
  const preview = useMcpPreview();
  const { isLoading, isAuthenticated } = useCloudAuth();
  const online = useUIStore((s) => s.onlineFeaturesEnabled);
  if (!preview) return null;
  if (isLoading) return <p role="status">Checking sign-in…</p>;
  if (!isAuthenticated) return <p>Sign in to connect an AI app</p>;
  return (
    <div className="space-y-5">
      <PaneHeading title="Connect an AI app · Beta">
        Setup preview. AI apps cannot connect to Image Horse yet.
      </PaneHeading>
      <section className="space-y-2">
        <PaneHeading title="Connection readiness" />
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>Signed in to Image Horse.</li>
          <li>{online ? "Online features are on." : "Everything in your browser is on. Turn on online features in Security before connecting."}</li>
          <li>Account connection is awaiting verification. A connection URL will appear here when available.</li>
        </ul>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" role="switch" checked={false} disabled aria-describedby="mcp-disabled" />
          Let AI apps use my account
        </label>
        <p id="mcp-disabled" className="text-sm text-text-muted">Unavailable during this preview. Enabling the Beta only shows this pane; it grants no account access.</p>
      </section>
      <section className="space-y-2">
        <PaneHeading title="What an AI app will be able to access" />
        <p className="text-sm">Your account usage, shares, saved palette, recent text styles, synced export recipes and backup totals. It will be able to manage your shares and palette and save recipes. Deleting a share is destructive.</p>
        <p className="text-sm text-text-muted">Your gallery photos stay in your browser. AI apps cannot open them, run AI jobs, change billing or delete backups. They cannot access another person's account.</p>
      </section>
      <section className="space-y-2">
        <PaneHeading title="Try after connecting" />
        <p className="text-sm text-text-muted">Once connections are available, add the URL as a custom connector in Claude or a remote MCP server in Cursor, then sign in. These prompts will not work yet.</p>
        {PROMPTS.map((prompt) => <div key={prompt} className="flex items-center justify-between gap-3 text-sm">
          <span>{prompt}</span>
          <Button onClick={async () => {
            try { await navigator.clipboard.writeText(prompt); toast.success("Prompt copied"); }
            catch { toast.error("Couldn't copy. Select and copy the prompt text."); }
          }}>Copy prompt</Button>
        </div>)}
      </section>
      <section className="space-y-2">
        <PaneHeading title="Recent activity" />
        <p className="text-sm text-text-muted">Activity history is not available in this preview.</p>
      </section>
    </div>
  );
}
