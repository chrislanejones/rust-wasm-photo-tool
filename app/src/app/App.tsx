// ===== FILE: app/src/app/App.tsx =====
// Item 8: Removed SPA routing for /architecture.
// The architecture diagram now opens via target="_blank" link in StatusBar.
// Hitting "back" no longer destroys app state.
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "./AppShell";

export default function App() {
  return (
    <TooltipProvider>
      <AppShell />
    </TooltipProvider>
  );
}
