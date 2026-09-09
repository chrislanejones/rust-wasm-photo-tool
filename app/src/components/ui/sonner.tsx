import { Toaster as SonnerToaster, toast } from "sonner";
import { useResolvedTheme } from "@/lib/useTheme";

export function Toaster(props: React.ComponentProps<typeof SonnerToaster>) {
  const theme = useResolvedTheme();
  return (
    <SonnerToaster
      theme={theme}
      position="top-center"
      // 80 -> 12. Eighty was chosen to CLEAR the TopBar (`fixed top-3`, ~58
      // tall, so 12..70) and landed at 80..170 — squarely on the header of any
      // `size="xl"` dialog, whose 80vh centred body starts at 10vh: 90px on a
      // 900 viewport, 122px on a 1222. Chris hit it on Settings.
      //
      // TOP-RIGHT WAS THE OBVIOUS ALTERNATIVE AND IS WORSE. A viewport-anchored
      // right-aligned toast lands on the DIALOG'S CLOSE BUTTON, which sits
      // ~16px inside the 760px body's right edge — so it blocks the X at 1280,
      // 1400 and 1600 wide, and only clears it around 1920. Covering the
      // header is cosmetic; covering the way out is not, and "depends on your
      // monitor" is not a resolution.
      //
      // Top-centre at 12 spans W/2±265, and the close button sits at W/2+364,
      // so it never reaches it. What it does cover is the TopBar — which is
      // `--z-topbar: 30`, behind the `--z-modal: 60` overlay whenever a dialog
      // is open, i.e. inert in exactly the situation that prompted this. With
      // no dialog open it overlays the pill for four seconds.
      offset={12}
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
