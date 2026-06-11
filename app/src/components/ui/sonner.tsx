import { Toaster as SonnerToaster, toast } from "sonner";

export function Toaster(props: React.ComponentProps<typeof SonnerToaster>) {
  return (
    <SonnerToaster
      theme="dark"
      position="top-center"
      closeButton
      toastOptions={{
        unstyled: true,
        classNames: {
          // High-contrast surface so toasts pop off the near-black canvas:
          // a lighter elevated background, a bright hairline border, and a
          // strong shadow + ring for separation. Gives every toast type the
          // visibility of the "Copied to clipboard" toast.
          toast:
            "group pointer-events-auto flex items-center gap-3 w-full rounded-xl border border-white/15 bg-theme-muted text-theme-foreground font-medium shadow-2xl ring-1 ring-black/50 px-4 py-3 text-sm",
          title: "text-theme-foreground font-medium",
          description: "text-theme-muted-foreground text-xs",
          icon: "shrink-0",
          success: "border-theme-primary/70 text-theme-primary",
          error: "border-destructive/70 text-destructive",
          info: "border-theme-ring/70 text-theme-foreground",
          warning: "border-theme-chart4/70 text-theme-chart4",
          actionButton:
            "ml-auto rounded-md bg-theme-primary px-2 py-1 text-xs font-medium text-theme-primary-foreground hover:bg-theme-primary/90",
          cancelButton:
            "ml-2 rounded-md bg-theme-muted px-2 py-1 text-xs font-medium text-theme-muted-foreground hover:bg-theme-muted/80",
          closeButton:
            "absolute right-2 top-2 rounded-md text-theme-muted-foreground hover:text-theme-foreground",
        },
      }}
      {...props}
    />
  );
}

export { toast };
