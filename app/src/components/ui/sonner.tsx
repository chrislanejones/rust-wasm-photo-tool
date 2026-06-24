import { Toaster as SonnerToaster, toast } from "sonner";
import { useResolvedTheme } from "@/lib/useTheme";

export function Toaster(props: React.ComponentProps<typeof SonnerToaster>) {
  const theme = useResolvedTheme();
  return (
    <SonnerToaster
      theme={theme}
      position="top-center"
      offset={80}
      closeButton
      duration={4000}
      toastOptions={{
        unstyled: true,
        duration: 4000,
        classNames: {
          // High-contrast surface so toasts pop off the near-black canvas:
          // a lighter elevated background, a bright hairline border, and a
          // strong shadow + ring for separation. Gives every toast type the
          // visibility of the "Copied to clipboard" toast.
          toast:
            "group pointer-events-auto flex items-center gap-3 w-full rounded-xl border border-border bg-theme-muted text-theme-foreground font-semibold shadow-2xl ring-1 ring-black/10 dark:ring-black/50 px-4 py-3 text-sm",
          // Fill the toast width so custom content (e.g. the compress progress
          // bar) spans edge-to-edge instead of shrinking to its text width.
          content: "flex-1 min-w-0",
          title: "w-full text-theme-foreground font-semibold",
          description: "text-theme-muted-foreground text-xs",
          icon: "shrink-0",
          success: "border-theme-primary/70 text-theme-primary",
          error: "border-destructive/70 text-destructive",
          info: "border-theme-ring/70 text-theme-foreground",
          warning: "border-theme-chart4/70 text-theme-chart4",
          actionButton:
            "ml-auto rounded-md bg-theme-primary px-2 py-1 text-xs font-semibold text-theme-primary-foreground hover:bg-theme-primary/90",
          cancelButton:
            "ml-2 rounded-md bg-theme-muted px-2 py-1 text-xs font-semibold text-theme-muted-foreground hover:bg-theme-muted/80",
          closeButton:
            "absolute right-2 top-2 rounded-md text-theme-muted-foreground hover:text-theme-foreground",
        },
      }}
      {...props}
    />
  );
}

export { toast };
