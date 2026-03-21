import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "./AppShell";

export default function App() {
  return (
    <TooltipProvider>
      <AppShell />
    </TooltipProvider>
  );
}
