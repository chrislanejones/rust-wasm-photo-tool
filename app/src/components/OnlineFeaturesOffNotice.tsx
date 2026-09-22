// Shown in a panel whose actions send the image to a server, while the
// "Everything in your browser" switch is on. One copy for every such panel
// (Enhance › AI, OCR), so the reason and the way out read the same everywhere.
// It points at Settings › Security because that page explains the switch in
// full; the New dialog carries the same switch.
import { CloudOff } from "lucide-react";
import { navigateTo } from "@/features/routing";

export function OnlineFeaturesOffNotice({ what }: { what: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-border bg-bg-tertiary p-3">
      <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" aria-hidden />
      <div className="space-y-1.5">
        <p className="text-2xs leading-relaxed text-text-secondary">
          Online features are off, so nothing leaves this tab. {what}
        </p>
        <button
          type="button"
          onClick={() => navigateTo({ kind: "settings", tab: "security" })}
          className="text-2xs font-semibold text-text-primary underline underline-offset-2 hover:text-theme-primary"
        >
          Turn them on in Settings › Security
        </button>
      </div>
    </div>
  );
}
