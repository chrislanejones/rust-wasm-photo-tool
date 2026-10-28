// Gallery › Select ▾ (Night 10-28, 233). Ticks photos by a rule: Portrait,
// Landscape, Square, Larger than…, Edited, Unedited, Invert. A rule replaces
// the ticks; Shift-click (or Shift+Enter) adds its matches to them. The rules
// live in lib/selectBy.ts. The ticks are Batch's Exceptions (ADR-079).
//
// Hand-built menu in the shape of GalleryThumbMark's (no menu dependency in
// the app): a button with aria-haspopup, a role="menu" list of menuitems,
// Escape and an outside click close it. It opens UPWARD, because the gallery
// bar sits at the bottom of the window.
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { applyRule, parseSize, type SelectRule } from "@/lib/selectBy";
import { cn } from "@/lib/utils";

const RULES: { label: string; rule: SelectRule }[] = [
  { label: "Portrait", rule: { kind: "portrait" } },
  { label: "Landscape", rule: { kind: "landscape" } },
  { label: "Square", rule: { kind: "square" } },
  { label: "Edited", rule: { kind: "edited" } },
  { label: "Unedited", rule: { kind: "unedited" } },
  { label: "Invert", rule: { kind: "invert" } },
];

/** Ghost buttons, full width and left-aligned: a list, not a row of tiles. */
const ITEM = "w-full justify-start";

export function SelectByMenu({ className, labelClassName }: { className?: string; labelClassName?: string }) {
  const [open, setOpen] = useState(false);
  const [larger, setLarger] = useState(false);
  const [sizeText, setSizeText] = useState("500 KB");
  const menuId = useId();
  const root = useRef<HTMLSpanElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    // First item takes focus, so the menu is usable from the keyboard.
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const run = (rule: SelectRule, add: boolean) => {
    const { photos, selectedIds, modifiedPhotos, setSelectedIds } = useGalleryStore.getState();
    setSelectedIds(applyRule(photos, selectedIds, rule, modifiedPhotos, add));
    setOpen(false);
    setLarger(false);
  };
  const bytes = parseSize(sizeText);

  return (
    <span ref={root} className={cn("relative inline-flex", className)}>
      <Button
        size="default"
        // "Select by" contains the visible "Select" (label-in-name), and
        // keeps it apart from the rail's Select tool.
        aria-label="Select by"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        title="Tick photos by a rule — Shift adds to the ticks"
        onClick={() => setOpen((o) => !o)}
      >
        <ListChecks className="h-3.5 w-3.5" />
        <span className={labelClassName}>Select</span>
        <ChevronDown className="h-3 w-3" />
      </Button>
      {open && (
        <div
          id={menuId}
          ref={menu}
          role="menu"
          aria-label="Select by"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              setOpen(false);
            } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
              const i = items.indexOf(document.activeElement as HTMLElement);
              items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
            }
          }}
          className="absolute bottom-full right-0 z-[var(--z-dialog)] mb-1 min-w-48 rounded-md border border-border bg-bg-elevated p-1 shadow-lg"
        >
          {RULES.slice(0, 3).map(({ label, rule }) => (
            <Button key={label} variant="ghost" role="menuitem" className={ITEM} onClick={(e) => run(rule, e.shiftKey)}>
              {label}
            </Button>
          ))}
          <Button variant="ghost" role="menuitem" aria-expanded={larger} className={ITEM} onClick={() => setLarger((v) => !v)}>
            Larger than…
          </Button>
          {larger && (
            <form
              className="flex items-center gap-1.5 px-2 pb-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                if (bytes !== null) run({ kind: "larger", bytes }, false);
              }}
            >
              <input
                aria-label="File size"
                value={sizeText}
                onChange={(e) => setSizeText(e.target.value)}
                className="h-8 w-24 rounded-sm border border-border bg-bg-primary px-2 text-xs text-theme-foreground"
              />
              <Button size="default" type="submit" disabled={bytes === null}>
                Tick
              </Button>
            </form>
          )}
          {RULES.slice(3).map(({ label, rule }) => (
            <Button key={label} variant="ghost" role="menuitem" className={ITEM} onClick={(e) => run(rule, e.shiftKey)}>
              {label}
            </Button>
          ))}
        </div>
      )}
    </span>
  );
}
