// The gallery header's "Pair a phone" (ADR-105), beside the Inbox. Behind the
// `pair` Beta. Opens the dialog PairHost holds.
import { Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePairStore } from "./pairStore";
import { usePairBeta } from "./usePair";

export function PairButton({ labelClassName, className }: { labelClassName?: string; className?: string }) {
  const on = usePairBeta();
  const open = usePairStore((s) => s.setDialogOpen);
  const connected = usePairStore((s) => s.role === "computer" && s.status === "connected");
  if (!on) return null;
  const name = connected ? "Paired with a phone" : "Pair a phone";
  return (
    <Button size="default" onClick={() => open(true)} title={name} aria-label={name} className={className} data-testid="pair-button">
      <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
      <span className={labelClassName}>{connected ? "Paired" : "Pair a phone"}</span>
    </Button>
  );
}
