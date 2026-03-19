import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "./AppShell";
import ArchitectureDiagram from "@/ArchitectureDiagram";

export default function App() {
  if (window.location.pathname === "/architecture") {
    return <ArchitectureDiagram />;
  }

  return (
    <TooltipProvider>
      <AppShell />
    </TooltipProvider>
  );
}
