// ===== FILE: app/src/features/commandPalette/CommandPalette.tsx =====
// PowerToys-style command palette. Opened by Alt+, (registered in
// useKeyboardShortcuts → useUIStore.showCommandPalette), closed by Esc /
// backdrop / focus-restore — all inherited from the ui/dialog primitive via
// CommandDialog. Fuzzy search, keyboard nav, and listbox/option a11y come
// from cmdk (see components/ui/command.tsx).
//
// TASK A shell: the Tools group is seeded inline from the tools feature's
// public surface so grouped results + select plumbing are real; the typed
// action registry (Tools / Settings / Actions + recents) replaces it in
// TASK B (commands.tsx).
import { useUIStore } from "@/stores/useUIStore";
import { useToolStore } from "@/stores/useToolStore";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { TOOLS } from "@/features/tools";
import type { ToolType } from "@/lib/types";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export function CommandPalette() {
  const open = useUIStore((s) => s.showCommandPalette);
  const setOpen = useUIStore((s) => s.setShowCommandPalette);
  const setActiveTool = useToolStore((s) => s.setActiveTool);
  const photoCount = useGalleryStore((s) => s.photos.length);

  const jumpToTool = (id: ToolType) => {
    setOpen(false);
    setActiveTool(id);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={(o) => setOpen(o)}
      title="Command palette"
    >
      <CommandInput
        autoFocus
        placeholder="Search tools, settings, and actions…"
        aria-label="Search commands"
      />
      <CommandList>
        <CommandEmpty>No matching commands.</CommandEmpty>
        <CommandGroup heading="Tools">
          {TOOLS.map((tool) => {
            // Batch Image Editor needs 2+ photos — mirror AppShell's
            // onToolChange guard so the palette matches the sidebar gating.
            const disabled = tool.id === "emoji" && photoCount <= 1;
            const Icon = tool.icon;
            return (
              <CommandItem
                key={tool.id}
                value={`tool-${tool.id} ${tool.label}`}
                keywords={[tool.description]}
                disabled={disabled}
                onSelect={() => jumpToTool(tool.id)}
              >
                <Icon className="text-text-muted" />
                {tool.label}
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
