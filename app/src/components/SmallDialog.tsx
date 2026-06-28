import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  /** Lucide icon component, rendered mid-size and muted above the title. */
  icon: LucideIcon;
  title: string;
  /** Body copy (one short paragraph). */
  children: ReactNode;
  /** The single action button's label. */
  actionLabel: string;
  onAction: () => void;
  /** Optional override for the card box (e.g. a width/colour tweak). */
  className?: string;
}

/**
 * A compact notice card — mid-size icon, title, body, and one button. No dialog
 * header bar or footer bar, just the centered box. Drop it onto a full-screen
 * backdrop (see {@link IdleScreen} / SmallWindowNotice) to use it as a light
 * "are you there / a heads-up" dialog without the full Dialog chrome.
 */
export function SmallDialog({
  icon: Icon,
  title,
  children,
  actionLabel,
  onAction,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "max-w-xs rounded-2xl border border-border bg-card p-6 text-center shadow-panel",
        className,
      )}
    >
      <Icon className="mx-auto h-8 w-8 text-text-muted" aria-hidden />
      <h2 className="mt-3 text-base font-semibold text-text-primary">{title}</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
        {children}
      </p>
      <button
        type="button"
        onClick={onAction}
        className="mt-4 w-full rounded-lg border border-border bg-bg-elevated px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-elevated/70"
      >
        {actionLabel}
      </button>
    </div>
  );
}
