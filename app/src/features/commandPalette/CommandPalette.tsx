// ===== FILE: app/src/features/commandPalette/CommandPalette.tsx =====
// The command palette (Alt+,), wearing the same dialog chrome as the Settings
// and Diagnostics windows rather than the stock shadcn Command look:
//
//   ┌─ xl dialog, 80vh ────────────────────────────────┐
//   │ Command Palette                            (hdr) │
//   │ ┌────────────────────────────────────────────┐   │  ← search, always on top
//   │ │ 🔍 Search tools, settings, and actions…    │   │
//   │ └────────────────────────────────────────────┘   │
//   │ [ All | Tools | Settings | Actions ]             │  ← group tabs (Diagnostics' rail)
//   ├──────────────────────────────────────────────────┤
//   │ MOST USED                                        │  ← Win10-Start: top 10 by run count
//   │ ▢ Paint   ▢ Crop   ▢ Text   ▢ Shapes   ▢ …       │     (empty query only)
//   ├──────────────────────────────────────────────────┤
//   │ TOOLS / SETTINGS / ACTIONS                       │  ← the keystroke-search results,
//   │ … scrolls, fills the rest of the dialog …        │     filling the bottom
//   └──────────────────────────────────────────────────┘
//
// cmdk still owns fuzzy matching, keyboard nav, and listbox/option a11y — only
// the shell is ours. The dialog itself is the shared `ui/dialog` primitive, so
// focus trap + focus restore come for free (and it inherits the dark-mode
// elevation from the ELEVATION block in styles.css).
//
// Entries come from the typed registry in commands.ts. "Most used" ranks by
// `useUIStore.commandUsage` (lifetime run counts, persisted), ties broken by
// recency — a tool you reach for constantly stays put instead of being pushed
// out by whatever you happened to touch last.
import { useEffect, useMemo, useState } from "react";
import { Command as CommandIcon, LayoutGrid } from "lucide-react";
import { useUIStore } from "@/stores/useUIStore";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { usePreferences } from "@/lib/preferences";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePaletteActionsStore } from "./paletteActions";
import {
  buildPaletteCommands,
  type PaletteCommand,
  type PaletteGroup,
} from "./commands";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

/** Tab filter: the three registry groups, plus an "All" that shows every one. */
type TabId = "all" | PaletteGroup;

const TABS: { id: TabId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "tools", label: "Tools" },
  { id: "settings", label: "Settings" },
  { id: "actions", label: "Actions" },
];

const GROUPS: { id: PaletteGroup; heading: string }[] = [
  { id: "tools", heading: "Tools" },
  { id: "settings", heading: "Settings" },
  { id: "actions", heading: "Actions" },
];

/** Win10-Start-style tile in the Most Used grid. */
function MostUsedTile({
  cmd,
  onRun,
}: {
  cmd: PaletteCommand;
  onRun: (cmd: PaletteCommand) => void;
}) {
  const Icon = cmd.icon;
  return (
    <CommandItem
      value={`mostused ${cmd.id} ${cmd.label}`}
      keywords={cmd.keywords}
      disabled={cmd.disabled}
      onSelect={() => onRun(cmd)}
      className="flex h-auto flex-col items-center gap-1.5 rounded-lg px-2 py-3 text-center"
    >
      {Icon && <Icon className="h-5 w-5 text-text-secondary" aria-hidden="true" />}
      <span className="line-clamp-2 text-2xs leading-tight">{cmd.label}</span>
    </CommandItem>
  );
}

/** A row in the search-results list (the bottom section). */
function PaletteRow({
  cmd,
  onRun,
}: {
  cmd: PaletteCommand;
  onRun: (cmd: PaletteCommand) => void;
}) {
  const Icon = cmd.icon;
  return (
    <CommandItem
      value={`${cmd.id} ${cmd.label}`}
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
  const usage = useUIStore((s) => s.commandUsage);
  const pushRecentCommand = useUIStore((s) => s.pushRecentCommand);
  const requestSettings = useUIStore((s) => s.requestSettings);
  const photoCount = useGalleryStore((s) => s.photos.length);
  // Same-source prefs as AppShell — usePreferences broadcasts commits across
  // instances, so hot-toggles here update the live overlays/theme instantly.
  const [prefs, applyPrefs] = usePreferences();
  // AppShell session handlers (undo/redo), registered by useKeyboardShortcuts.
  const actions = usePaletteActionsStore((s) => s.actions);

  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<TabId>("all");

  // Reopen fresh: clear the query and drop back to All.
  useEffect(() => {
    if (!open) {
      setQuery("");
      setTab("all");
    }
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

  /** Top 10 by lifetime run count, ties broken toward the more recently used.
   *  A brand-new user has no counts, and an empty grid would just look broken —
   *  so the tail is BACKFILLED with the registry's own order (Tools first),
   *  which is a reasonable "you'll probably want these" set. Real usage
   *  displaces the filler one command at a time as it accumulates. */
  const mostUsed = useMemo(() => {
    const runnable = commands.filter((c) => !c.disabled);
    const used = runnable
      .filter((c) => (usage[c.id] ?? 0) > 0)
      .sort((a, b) => {
        const byCount = (usage[b.id] ?? 0) - (usage[a.id] ?? 0);
        if (byCount !== 0) return byCount;
        const ra = recentIds.indexOf(a.id);
        const rb = recentIds.indexOf(b.id);
        return (ra < 0 ? Infinity : ra) - (rb < 0 ? Infinity : rb);
      });
    if (used.length >= 10) return used.slice(0, 10);
    const usedIds = new Set(used.map((c) => c.id));
    const filler = runnable.filter((c) => !usedIds.has(c.id));
    return [...used, ...filler].slice(0, 10);
  }, [commands, usage, recentIds]);

  const visibleGroups = tab === "all" ? GROUPS : GROUPS.filter((g) => g.id === tab);
  const showMostUsed = query === "" && tab === "all" && mostUsed.length > 0;

  const runCommand = (cmd: PaletteCommand) => {
    pushRecentCommand(cmd.id); // also increments the usage count
    setOpen(false); // close first — run() may open another dialog
    cmd.run();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => setOpen(o)}>
      <DialogContent
        size="xl"
        aria-describedby={undefined}
        className="flex h-[80vh] flex-col overflow-hidden p-0"
      >
        <Command
          // The dialog owns the frame; the Command root is just a layout box.
          className="flex min-h-0 flex-1 flex-col bg-transparent"
          // Keep every command mounted so the tab filter (not cmdk) decides
          // visibility when the query is empty; cmdk filters once you type.
          shouldFilter
        >
          {/* ── Header block: title + search + tabs, sharing one bottom border
              (same construction as the Diagnostics window). Generous Win11-
              Start-ish padding — this is the part you look at first. ── */}
          <div className="border-b border-border">
            <DialogHeader className="border-b-0 px-5 py-3">
              <DialogTitle className="flex items-center gap-2 font-mono text-xs font-normal uppercase tracking-wider text-text-secondary">
                <CommandIcon className="h-4 w-4" />
                Command Palette
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 px-5 pb-4">
              {/* Search — the full-width bar the whole dialog hangs off. */}
              {/* `.palette-search` (styles.css) makes the WRAPPER the visual
                  field: it takes the focus ring on :focus-within and silences
                  the inner input's own. That rule has to live in styles.css —
                  the global `input:focus-visible { outline: … }` is unlayered,
                  so it beats any Tailwind focus utility no matter the
                  specificity, and we'd get a ring drawn inside the border. */}
              <CommandInput
                autoFocus
                value={query}
                onValueChange={setQuery}
                placeholder="Search tools, settings, and actions…"
                aria-label="Search commands"
                wrapperClassName="palette-search h-11 rounded-lg border border-border bg-bg-tertiary px-3 transition-colors"
                className="h-11 text-sm"
              />

              {/* Group tabs — the Diagnostics window's segmented rail, stretched
                  edge to edge so it lines up with the search field above it
                  (each tab takes an equal quarter via flex-1). */}
              <div
                role="tablist"
                aria-label="Command groups"
                className="flex w-full items-center gap-1 rounded-lg bg-bg-tertiary p-1"
              >
                {TABS.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={tab === id}
                    onClick={() => setTab(id)}
                    className={`flex-1 rounded-md px-2.5 py-1.5 font-mono text-2xs uppercase tracking-wider transition-colors ${
                      tab === id
                        ? "bg-bg-elevated text-text-primary"
                        : "text-text-muted hover:text-text-primary"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Body: Most Used on top (empty query only), then the
              keystroke-search results filling the rest of the dialog. ── */}
          <CommandList className="max-h-none flex-1 px-2 py-2">
            <CommandEmpty>No matching commands.</CommandEmpty>

            {showMostUsed && (
              <>
                <div className="flex items-center gap-1.5 px-2 pb-1.5 pt-1 font-mono text-2xs uppercase tracking-wider text-text-muted">
                  <LayoutGrid className="h-3 w-3" />
                  Most used
                </div>
                {/* Not a CommandGroup: the tiles lay out as a grid, and cmdk's
                    group wrapper assumes a vertical list. */}
                <div className="grid grid-cols-5 gap-1 px-1 pb-3">
                  {mostUsed.map((cmd) => (
                    <MostUsedTile
                      key={`most-${cmd.id}`}
                      cmd={cmd}
                      onRun={runCommand}
                    />
                  ))}
                </div>
                <div className="mx-2 mb-2 border-t border-border" />
              </>
            )}

            {visibleGroups.map(({ id, heading }) => (
              <CommandGroup key={id} heading={heading}>
                {commands
                  .filter((c) => c.group === id)
                  .map((cmd) => (
                    <PaletteRow key={cmd.id} cmd={cmd} onRun={runCommand} />
                  ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
