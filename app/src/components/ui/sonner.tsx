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
          toast:
            "group pointer-events-auto flex items-center gap-3 w-full rounded-xl border border-theme-sidebar-border bg-theme-sidebar text-theme-foreground shadow-xl backdrop-blur-sm px-4 py-3 text-sm",
          title: "text-theme-foreground font-medium",
          description: "text-theme-muted-foreground text-xs",
          icon: "shrink-0",
          success: "border-theme-primary/40 text-theme-primary",
          error: "border-destructive/40 text-destructive",
          info: "border-theme-ring/40 text-theme-foreground",
          warning: "border-theme-chart4/40 text-theme-chart4",
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
