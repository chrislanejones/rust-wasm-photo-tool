// shadcn Command primitive (cmdk) — the base component for the command
// palette. Fuzzy filtering, keyboard nav, and aria listbox/option semantics
// come from cmdk; this file only skins it with the repo's tokens (mirrors
// context-menu.tsx) and provides `CommandDialog`, which composes the EXISTING
// `ui/dialog` primitive (the repo is converging on it — no new modal
// primitive here).
import * as React from "react"
import { Command as CommandPrimitive } from "cmdk"
import { Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"

const Command = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn(
      "flex h-full w-full flex-col overflow-hidden bg-transparent text-text-primary",
      className
    )}
    {...props}
  />
))
Command.displayName = CommandPrimitive.displayName

/** Dialog-wrapped Command — the palette shell. Reuses `ui/dialog`'s
 *  overlay/content (focus trap, Esc-to-close, focus restore) and adds an
 *  sr-only title for screen readers. Children are the CommandInput/List. */
interface CommandDialogProps
  extends React.ComponentPropsWithoutRef<typeof Dialog> {
  /** Accessible dialog title (visually hidden). */
  title?: string
}

const CommandDialog = ({
  title = "Command palette",
  children,
  ...props
}: CommandDialogProps) => (
  <Dialog {...props}>
    <DialogContent
      aria-describedby={undefined}
      // Palette sits high like PowerToys Run — override the centered default.
      className="top-[24%] max-w-xl translate-y-0"
    >
      <DialogTitle className="sr-only">{title}</DialogTitle>
      <Command
        // Rank by match quality but keep grouped sections stable.
        className="[&_[cmdk-group-heading]]:text-text-muted"
      >
        {children}
      </Command>
    </DialogContent>
  </Dialog>
)
CommandDialog.displayName = "CommandDialog"

const CommandInput = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Input>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
  <div className="flex items-center gap-2 border-b border-border px-4" cmdk-input-wrapper="">
    <Search className="h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
    <CommandPrimitive.Input
      ref={ref}
      className={cn(
        "flex h-12 w-full rounded-md bg-transparent py-3 text-sm text-text-primary outline-none placeholder:text-text-muted disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  </div>
))
CommandInput.displayName = CommandPrimitive.Input.displayName

const CommandList = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    ref={ref}
    className={cn(
      "max-h-[min(420px,50vh)] overflow-y-auto overflow-x-hidden p-1",
      className
    )}
    {...props}
  />
))
CommandList.displayName = CommandPrimitive.List.displayName

const CommandEmpty = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Empty>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => (
  <CommandPrimitive.Empty
    ref={ref}
    className="py-6 text-center text-sm text-text-muted"
    {...props}
  />
))
CommandEmpty.displayName = CommandPrimitive.Empty.displayName

const CommandGroup = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn(
      "overflow-hidden p-1 text-text-primary [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-2xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-text-muted",
      className
    )}
    {...props}
  />
))
CommandGroup.displayName = CommandPrimitive.Group.displayName

const CommandSeparator = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-border", className)}
    {...props}
  />
))
CommandSeparator.displayName = CommandPrimitive.Separator.displayName

const CommandItem = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center gap-2 rounded-md px-2 py-2 text-sm text-text-secondary outline-none data-[selected=true]:bg-bg-elevated data-[selected=true]:text-text-primary data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0",
      className
    )}
    {...props}
  />
))
CommandItem.displayName = CommandPrimitive.Item.displayName

/** Right-aligned shortcut hint (mirrors ContextMenuShortcut). */
const CommandShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => (
  <span
    className={cn(
      "ml-auto font-mono text-2xs tracking-wider text-text-muted",
      className
    )}
    {...props}
  />
)
CommandShortcut.displayName = "CommandShortcut"

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
}
