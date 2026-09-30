// Section heading for a Settings pane: a title and, optionally, the sentence
// that explains it. Settings panes are the one surface that DOES carry
// explanatory prose (the tool panels use `SectionHeader`'s lightbulb instead),
// and thirteen sections across eight panes each spelled this block out by hand.
import * as React from "react";

interface PaneHeadingProps {
  title: React.ReactNode;
  /** The explanation under the title. Omit for a bare heading. */
  children?: React.ReactNode;
  /** `compact` = the smaller caption the account panes (AI Usage, Storage)
   *  use under a heading that tops the whole pane. */
  compact?: boolean;
  /** Wrapper spacing only, e.g. `pt-2` for a section that follows another. */
  className?: string;
  /** Lands on the `<h3>`, so the control under the heading can name itself
   *  with `aria-labelledby` instead of repeating the words (Night 2). */
  id?: string;
}

export function PaneHeading({ title, children, compact, className, id }: PaneHeadingProps) {
  return (
    <div className={className}>
      <h3 id={id} className="text-sm font-semibold text-text-primary">
        {title}
      </h3>
      {children != null && (
        <p
          className={
            compact
              ? "mt-0.5 text-2xs text-text-muted"
              : "mt-1 text-xs leading-relaxed text-text-muted"
          }
        >
          {children}
        </p>
      )}
    </div>
  );
}
