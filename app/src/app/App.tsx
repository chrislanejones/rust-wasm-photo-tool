// ===== FILE: app/src/app/App.tsx =====
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "./AppShell";
import { ShareViewer } from "@/components/ShareViewer";
import { CommandPalette } from "@/features/commandPalette";
import { RouteSync, SHARE_PARAM } from "@/features/routing";

export default function App() {
  // A `?v=<token>` link opens the read-only share viewer instead of the editor.
  // Read once at mount — share links are entered fresh, not navigated to in-app.
  //
  // The share token OUTRANKS every route: this branch returns before <RouteSync/>
  // is ever mounted, so a shared image is a shared image and nothing writes an
  // editor fragment into someone else's link.
  const shareToken = new URLSearchParams(window.location.search).get(SHARE_PARAM);
  if (shareToken) {
    return (
      <TooltipProvider>
        <ShareViewer token={shareToken} />
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <AppShell />
      {/* Global chrome mounted at the composition root, NOT inside AppShell
          (it must gain nothing new). Opened via Alt+, → useUIStore. */}
      <CommandPalette />
      {/* URL <-> state mirror: #/tool/paint/blur, #/settings/security. Renders
          nothing; see features/routing. */}
      <RouteSync />
    </TooltipProvider>
  );
}
