import { cn } from "@/lib/utils";

/**
 * A/B compare glyph: a split frame with the divider down the middle and a
 * chevron on each side pointing at it. Drawn on lucide's 24px grid with its
 * stroke settings so it sits beside the lucide icons in the top bar unchanged.
 * Takes only `className`, which is all `IconButton` passes to an icon.
 */
export function CompareIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("lucide", className)}
    >
      <path d="M12 2v20" />
      <path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3" />
      <path d="M8 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" />
      <path d="m6 9 3 3-3 3" />
      <path d="m18 9-3 3 3 3" />
    </svg>
  );
}
