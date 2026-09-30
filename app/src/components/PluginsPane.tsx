// Settings → Plugins. The master "Allow plugins" switch, the two ways to add
// a plugin (a file from disk, or a URL), and one row per plugin this device
// has added. What a plugin is, and why nothing is fetched on the app's own
// initiative, is in lib/plugins/types.ts; the switches and why they are per
// device are in lib/plugins/state.ts. This file is the surface.
//
// Changes commit as pressed, like Beta and Sync — no Apply, and no reload:
// the Download dialog's picker and the Import / Export pane subscribe to the
// same store, so a format appears the moment its plugin is on.
import { useId, useRef, useState } from "react";
import { ExternalLink, FileUp, Link2, Power, Puzzle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PaneHeading } from "@/components/ui/pane-heading";
import { Spinner } from "@/components/ui/spinner";
import { ToggleButtonGroup } from "@/components/ui/toggle-button-group";
import { FIELD_TEXT } from "@/lib/styles";
import {
  addPlugin,
  addPluginFromUrl,
  removePlugin,
  setPluginOn,
  setPluginsAllowed,
  type InstalledPlugin,
} from "@/lib/plugins";
import { useInstalledPlugins, usePluginOn, usePluginsAllowed } from "@/hooks/usePlugins";

const MAX_FILE_BYTES = 4 * 1024 * 1024;

function PluginRow({ plugin, allowed }: { plugin: InstalledPlugin; allowed: boolean }) {
  const on = usePluginOn(plugin.id);
  const [removing, setRemoving] = useState(false);
  const headingId = useId();
  const adds = plugin.formats.map((f) => `Import and export ${f.extension}`).join(" · ");

  const remove = async () => {
    setRemoving(true);
    try {
      await removePlugin(plugin.id);
      toast.success(`Removed ${plugin.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove that plugin.");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <section
      className={`space-y-2 rounded-lg border border-border bg-bg-elevated p-3 ${allowed ? "" : "opacity-60"}`}
    >
      <PaneHeading
        id={headingId}
        title={
          <span className="flex items-baseline gap-2">
            {plugin.name}
            <span className="font-mono text-2xs font-normal text-text-muted">v{plugin.version}</span>
          </span>
        }
      >
        {plugin.blurb}
      </PaneHeading>
      <p className="pl-1 text-2xs text-text-muted">
        Adds: {adds}
        {" · "}
        {plugin.sourceUrl ? (
          <>
            added from{" "}
            <span className="font-mono break-all">{plugin.sourceUrl}</span>
          </>
        ) : (
          "added from a file"
        )}
        {plugin.homepage && (
          <>
            {" · "}
            <a
              href={plugin.homepage}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-0.5 underline"
            >
              homepage <ExternalLink aria-hidden className="size-3" />
            </a>
          </>
        )}
      </p>
      <ToggleButtonGroup
        fill
        mode="select"
        aria-labelledby={headingId}
        items={[
          {
            key: "on",
            icon: Puzzle,
            label: "On",
            active: on,
            disabled: !allowed,
            onToggle: () => setPluginOn(plugin.id, true),
          },
          {
            key: "off",
            icon: Puzzle,
            label: "Off",
            active: !on,
            disabled: !allowed,
            onToggle: () => setPluginOn(plugin.id, false),
          },
        ]}
      />
      <Button onClick={() => void remove()} disabled={removing} aria-label={`Remove ${plugin.name}`}>
        {removing ? <Spinner size={16} /> : <Trash2 aria-hidden />}
        Remove
      </Button>
    </section>
  );
}

function AddPlugin() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<"file" | "url" | null>(null);
  const urlId = useId();

  const report = (added: InstalledPlugin) => {
    const adds = added.formats.map((f) => f.extension).join(", ");
    toast.success(`Added ${added.name} v${added.version}`, {
      description: `It adds ${adds}. Turn on Allow plugins above if it is off.`,
    });
  };

  const fromFile = async (file: File) => {
    setBusy("file");
    try {
      if (file.size > MAX_FILE_BYTES) throw new Error("That file is too large to be a plugin (over 4 MB).");
      report(await addPlugin(await file.text(), null));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add that plugin.");
    } finally {
      setBusy(null);
    }
  };

  const fromUrl = async () => {
    const input = url.trim();
    if (!input) return;
    setBusy("url");
    try {
      report(await addPluginFromUrl(input));
      setUrl("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add that plugin.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="space-y-3 rounded-lg border border-border bg-bg-elevated p-3">
      <PaneHeading title="Add a plugin">
        A plugin is one JavaScript file from its own project — the Photoshop PSD
        plugin, for one. Download the file from that project and add it here, or
        paste the link to it. It is kept in this browser and runs with the same
        access as the app, so add only plugins you trust.
      </PaneHeading>
      <Button
        size="large"
        className="w-full"
        disabled={busy !== null}
        onClick={() => fileRef.current?.click()}
      >
        {busy === "file" ? <Spinner size={16} /> : <FileUp aria-hidden />}
        {busy === "file" ? "Adding…" : "Add from file"}
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept=".js,.mjs,text/javascript,application/javascript"
        className="hidden"
        aria-label="Plugin file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ""; // allow re-selecting the same file next time
          if (file) void fromFile(file);
        }}
      />
      <div className="space-y-2">
        <label htmlFor={urlId} className="text-xs font-semibold text-text-muted">
          Or add from a link
        </label>
        <div className="flex items-center gap-2">
          <input
            id={urlId}
            type="url"
            inputMode="url"
            value={url}
            placeholder="https://…/image-horse-psd.plugin.js"
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void fromUrl();
              }
            }}
            spellCheck={false}
            autoComplete="off"
            disabled={busy !== null}
            className={`${FIELD_TEXT} min-w-0 flex-1`}
          />
          <Button onClick={() => void fromUrl()} disabled={busy !== null || !url.trim()}>
            {busy === "url" ? <Spinner size={16} /> : <Link2 aria-hidden />}
            Add from link
          </Button>
        </div>
      </div>
    </section>
  );
}

export function PluginsPane() {
  const allowed = usePluginsAllowed();
  const installed = useInstalledPlugins();
  const masterId = useId();
  return (
    <div className="space-y-4">
      <PaneHeading title="Plugins">
        Extra features that come from outside Image Horse and stay off until you
        turn them on. A plugin is kept on this device only, is never sent
        anywhere, and is never fetched unless you add it. Your pixels still never
        leave the browser.
      </PaneHeading>

      <section className="space-y-2 rounded-lg border border-border bg-bg-elevated p-3">
        <PaneHeading id={masterId} title="Allow plugins">
          The master switch. While it is off, no plugin is active whatever its own
          switch says, and nothing a plugin adds shows up anywhere.
        </PaneHeading>
        <ToggleButtonGroup
          fill
          mode="select"
          aria-labelledby={masterId}
          items={[
            {
              key: "on",
              icon: Power,
              label: "On",
              active: allowed,
              onToggle: () => setPluginsAllowed(true),
            },
            {
              key: "off",
              icon: Power,
              label: "Off",
              active: !allowed,
              onToggle: () => setPluginsAllowed(false),
            },
          ]}
        />
      </section>

      <AddPlugin />

      <PaneHeading title="Your plugins" className="pt-2">
        {installed.length === 0
          ? "Nothing added yet. A plugin you add appears here with its own switch."
          : allowed
            ? "A format plugin adds its file type to the Download dialog and to Settings → Import / Export."
            : "Turn on Allow plugins above to use any of these."}
      </PaneHeading>

      {installed.map((p) => (
        <PluginRow key={p.id} plugin={p} allowed={allowed} />
      ))}

      <p className="text-2xs leading-relaxed text-text-muted">
        Removing a plugin deletes its file from this browser. Adding a newer
        file with the same plugin id replaces the old one. See docs/Plugins.md
        for how a plugin is written.
      </p>
    </div>
  );
}
