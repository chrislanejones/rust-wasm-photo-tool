// ===== FILE: app/src/features/commandPalette/CommandPalette.tsx =====
// PowerToys-style command palette. Opened by Alt+, (registered in
// useKeyboardShortcuts → useUIStore.showCommandPalette), closed by Esc /
// backdrop / select — focus trap + focus-restore inherited from the
// ui/dialog primitive via CommandDialog. Fuzzy search, keyboard nav, and
// listbox/option a11y come from cmdk (components/ui/command.tsx).
//
// Entries come from the typed registry in commands.ts. When the query is
// empty, a "Recent" group (persisted in useUIStore.recentCommands) sits on
// top; groups follow in Tools / Settings / Actions order.
import { useEffect, useMemo, useState } from "react";
import { useUIStore } from "@/stores/useUIStore";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { usePreferences } from "@/lib/preferences";
import { usePaletteActionsStore } from "./paletteActions";
import {
  buildPaletteCommands,
  type PaletteCommand,
  type PaletteGroup,
} from "./commands";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

const GROUPS: { id: PaletteGroup; heading: string }[] = [
  { id: "tools", heading: "Tools" },
  { id: "settings", heading: "Settings" },
  { id: "actions", heading: "Actions" },
];

function PaletteRow({
  cmd,
  onRun,
  valuePrefix = "",
}: {
  cmd: PaletteCommand;
  onRun: (cmd: PaletteCommand) => void;
  /** Distinguishes the Recent copy of an item (cmdk values must be unique). */
  valuePrefix?: string;
}) {
  const Icon = cmd.icon;
  return (
    <CommandItem
      value={`${valuePrefix}${cmd.id} ${cmd.label}`}
      keywords={cmd.keywords}
      disabled={cmd.disabled}
      onSelect={() => onRun(cmd)}
    >
      {Icon && <Icon className="text-text-muted" aria-hidden="true" />}
      {cmd.label}
      {cmd.shortcut && (
        <span className="ml-auto font-mono text-2xs tracking-wider text-text-muted">
          {cmd.shortcut}
        </span>
      )}
    </CommandItem>
  );
}

export function CommandPalette() {
  const open = useUIStore((s) => s.showCommandPalette);
  const setOpen = useUIStore((s) => s.setShowCommandPalette);
  const recentIds = useUIStore((s) => s.recentCommands);
  const pushRecentCommand = useUIStore((s) => s.pushRecentCommand);
  const requestSettings = useUIStore((s) => s.requestSettings);
  const photoCount = useGalleryStore((s) => s.photos.length);
  // Same-source prefs as AppShell — usePreferences broadcasts commits across
  // instances, so hot-toggles here update the live overlays/theme instantly.
  const [prefs, applyPrefs] = usePreferences();
  // AppShell session handlers (undo/redo), registered by useKeyboardShortcuts.
  const actions = usePaletteActionsStore((s) => s.actions);

  const [query, setQuery] = useState("");
  // Clear the search whenever the palette closes so it reopens fresh.
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const commands = useMemo(
    () =>
      buildPaletteCommands({
        photoCount,
        prefs: {
          rulers: prefs.rulers,
          grid: prefs.grid,
          theme: prefs.theme,
          set: (patch) => applyPrefs({ ...prefs, ...patch }),
        },
        requestSettings,
        actions,
      }),
    [photoCount, prefs, applyPrefs, requestSettings, actions],
  );

  const recents = useMemo(
    () =>
      recentIds
        .map((id) => commands.find((c) => c.id === id))
        .filter((c): c is PaletteCommand => !!c && !c.disabled)
        .slice(0, 5),
    [recentIds, commands],
  );

  const runCommand = (cmd: PaletteCommand) => {
    pushRecentCommand(cmd.id);
    setOpen(false); // close first — run() may open another dialog
    cmd.run();
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={(o) => setOpen(o)}
      title="Command palette"
    >
      <CommandInput
        autoFocus
        value={query}
        onValueChange={setQuery}
        placeholder="Search tools, settings, and actions…"
        aria-label="Search commands"
      />
      <CommandList>
        <CommandEmpty>No matching commands.</CommandEmpty>
        {query === "" && recents.length > 0 && (
          <CommandGroup heading="Recent">
            {recents.map((cmd) => (
              <PaletteRow
                key={`recent-${cmd.id}`}
                cmd={cmd}
                onRun={runCommand}
                valuePrefix="recent "
              />
            ))}
          </CommandGroup>
        )}
        {GROUPS.map(({ id, heading }) => (
          <CommandGroup key={id} heading={heading}>
            {commands
              .filter((c) => c.group === id)
              .map((cmd) => (
                <PaletteRow key={cmd.id} cmd={cmd} onRun={runCommand} />
              ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
