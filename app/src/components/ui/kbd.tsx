// A keyboard key, as a primitive rather than a bare element rule.
//
// Before Night 3 the only definition was `kbd { … }` in styles.css: a global
// element rule with an off-scale `border-radius: 3px` that no class-based
// audit could see, overridden locally in three files (UI_INVENTORY §7). This
// is the same chip in token classes, so it follows the house radius
// (`rounded-sm`, 4px) and the theme tokens in both themes.
//
// The bare rule still exists for the files that have not moved yet
// (PARKING_LOT: "<kbd> outside the three Night 3 panels"). Classes outrank an
// element selector, so a `Kbd` never inherits a stale value from it.
import * as React from "react";
import { cn } from "@/lib/utils";

export function Kbd({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "rounded-sm border border-border bg-bg-elevated px-1 font-mono text-2xs leading-4 text-text-secondary",
        className,
      )}
      {...props}
    />
  );
}
