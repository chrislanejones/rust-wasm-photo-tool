"use client"

import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

/** The one on/off switch. Radix `Switch` (same family as the dialog, tooltip
 *  and context-menu primitives already here) with the house tokens: the warm
 *  accent when on, the tertiary surface when off. No `outline-none` — the
 *  global `:focus-visible` rule in styles.css draws the keyboard ring, and
 *  suppressing it here would make this the one control you can't see focus on.
 *  Sized to sit on a 30px `IconButton` row without growing it. */
const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    className={cn(
      "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "data-[state=checked]:bg-theme-primary data-[state=unchecked]:bg-bg-tertiary",
      className
    )}
    {...props}
    ref={ref}
  >
    {/* The thumb's fill is PER-STATE, and a single color genuinely cannot
        work. A white thumb disappears twice: on light mode's #e9e3d8 track when
        off, and on dark mode's #fcdfc2 accent when on. So each state uses the
        token already paired with what sits under it — primary-foreground
        (#3a3128) on the accent, text-secondary on the tertiary track. The
        plain-white utility is also one of the literals scripts/guardrails.sh
        ratchets, so reaching for it would have turned the job red as well. */}
    <SwitchPrimitive.Thumb
      className={cn(
        "pointer-events-none block h-4 w-4 rounded-full shadow-lg transition-transform",
        "data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0",
        "data-[state=checked]:bg-theme-primary-foreground data-[state=unchecked]:bg-text-secondary"
      )}
    />
  </SwitchPrimitive.Root>
))
Switch.displayName = SwitchPrimitive.Root.displayName

export { Switch }
