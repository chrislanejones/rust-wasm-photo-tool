// Settings → Plugins. The master "Allow plugins" switch, and one row per
// plugin this build ships. What a plugin is, and why nothing is fetched, is
// in lib/plugins/types.ts; the switches and why they are per device are in
// lib/plugins/state.ts. This file is the surface.
//
// Changes commit as pressed, like Beta and Sync — no Apply, and no reload:
// the Download dialog's picker and the Import / Export pane subscribe to the
// same store, so a format appears the moment its plugin is on.
import { useId } from "react";
import { Puzzle, Power } from "lucide-react";
import { PaneHeading } from "@/components/ui/pane-heading";
import { ToggleButtonGroup } from "@/components/ui/toggle-button-group";
import { PLUGINS, setPluginOn, setPluginsAllowed } from "@/lib/plugins";
import type { ImageHorsePlugin } from "@/lib/plugins";
import { usePluginOn, usePluginsAllowed } from "@/hooks/usePlugins";

function PluginRow({ plugin, allowed }: { plugin: ImageHorsePlugin; allowed: boolean }) {
  const on = usePluginOn(plugin.id);
  const headingId = useId();
  const adds = plugin.formats.map((f) => `Import and export ${f.extension}`).join(" · ");
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
      <p className="pl-1 text-2xs text-text-muted">Adds: {adds}</p>
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
    </section>
  );
}

export function PluginsPane() {
  const allowed = usePluginsAllowed();
  const masterId = useId();
  return (
    <div className="space-y-4">
      <PaneHeading title="Plugins">
        Extra features that ship with Image Horse but stay off until you turn
        them on. Every plugin runs in this tab like the rest of the app — nothing
        is downloaded, and your pixels still never leave the browser. These
        choices are kept on this device only.
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

      <PaneHeading title="Available plugins" className="pt-2">
        {allowed
          ? "Turn on the ones you want. A format plugin adds its file type to the Download dialog and to Settings → Import / Export."
          : "Turn on Allow plugins above to use any of these."}
      </PaneHeading>

      {PLUGINS.length === 0 ? (
        <p className="text-xs text-text-muted">No plugins in this build yet.</p>
      ) : (
        PLUGINS.map((p) => <PluginRow key={p.id} plugin={p} allowed={allowed} />)
      )}

      <p className="text-2xs leading-relaxed text-text-muted">
        New plugins arrive with app updates, not from a store: a plugin is code
        reviewed into Image Horse itself, so it can be trusted with your images
        the same way the rest of the app can. See docs/Plugins.md for how one is
        written.
      </p>
    </div>
  );
}
