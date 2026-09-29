import * as React from "react";
import { StatusMark } from "@/components/ui/status-mark";
import {
  CONFLICT_CHOICES,
  pickGalleryMark,
  type ConflictChoice,
  type GalleryPhotoState,
  type GalleryViewer,
} from "@/lib/galleryMark";
import { cn } from "@/lib/utils";

/**
 * The one status mark in a gallery thumbnail's corner (UI Night 6 §1).
 *
 * Renders NOTHING for the calm local default — see lib/galleryMark.ts for the
 * priority order and who sees which state.
 *
 * Legibility: the glyph sits on its own dark pill, because a bare 12px icon on
 * a photo is decoration — it disappears over sky, snow or a white wall. The
 * pill is 24px, which also clears Night 5's "no target under 24px" floor for
 * the one mark that is a button.
 *
 * UNWIRED (Night 6 §0): nothing mounts this yet. The only backend that exists
 * is the edit backup, it has no list query, and the one mark it would drive —
 * backed up — is shown to paid viewers only, of whom there are none while
 * signup is closed (#254). Mount it in GalleryBar's thumbnail with real state
 * once `photoEdits.listKeys` (or sync Stage 1) exists.
 */
export function GalleryThumbMark({
  state,
  viewer,
  onResolveConflict,
  className,
}: {
  state: GalleryPhotoState;
  viewer: GalleryViewer;
  /** Conflict only. Absent = the menu still opens and reads, but its choices
   *  are disabled — built against a fixture, no backend to call. */
  onResolveConflict?: (choice: ConflictChoice) => void;
  className?: string;
}) {
  const mark = pickGalleryMark(state, viewer);
  const [open, setOpen] = React.useState(false);
  const menuId = React.useId();

  if (!mark) return null;

  const glyph = (
    <span className="relative inline-flex">
      <StatusMark kind={mark.kind} className="[&_svg]:h-3.5 [&_svg]:w-3.5" />
      {mark.dot && (
        // The dot is what tells "changed elsewhere" from a plain upload — the
        // same ↻, carrying news.
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-theme-primary"
        />
      )}
    </span>
  );

  const pill =
    "inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-black/60 px-1 backdrop-blur-sm";

  if (!mark.opensMenu) {
    return (
      <span
        role="img"
        aria-label={mark.label}
        title={mark.label}
        data-mark={mark.id}
        className={cn(pill, className)}
      >
        {glyph}
      </span>
    );
  }

  // Conflict: the mark is a door. "Newest wins, the loser is kept" is the rule;
  // this is where a person overrules it.
  return (
    <span className={cn("relative inline-flex", className)} data-mark={mark.id}>
      <button
        type="button"
        aria-label={mark.label}
        title={mark.label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
        className={cn(pill, "focus-visible:ring-2 focus-visible:ring-theme-primary")}
      >
        {glyph}
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Resolve the conflict"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              setOpen(false);
            }
          }}
          className="absolute right-0 top-7 z-[var(--z-dialog)] min-w-44 rounded-md border border-border bg-bg-elevated p-1 shadow-lg"
        >
          {CONFLICT_CHOICES.map((c) => (
            <button
              key={c.id}
              type="button"
              role="menuitem"
              disabled={!onResolveConflict}
              onClick={() => {
                onResolveConflict?.(c.id);
                setOpen(false);
              }}
              className="flex min-h-9 w-full items-center rounded px-2 text-left text-xs text-theme-foreground hover:bg-bg-tertiary disabled:opacity-50"
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}
