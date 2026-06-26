// ===== FILE: app/src/app/App.tsx =====
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "./AppShell";
import { ShareViewer } from "@/components/ShareViewer";

export default function App() {
  // A `?v=<token>` link opens the read-only share viewer instead of the editor.
  // Read once at mount — share links are entered fresh, not navigated to in-app.
  const shareToken = new URLSearchParams(window.location.search).get("v");
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
    </TooltipProvider>
  );
}
