// Native `<select>` in the tool-panel spelling, WITH its chevron.
//
// `FIELD_SELECT` sets `appearance-none`, which deletes the browser's disclosure
// arrow, so every select that used it had to hand-build the same three pieces:
// a `relative` wrapper, the select, and an absolutely-positioned ChevronDown in
// the `pr-8` gutter. Five copies of that shipped byte-identical. This is the one
// copy — a select using FIELD_SELECT with no chevron (a text field that ignores
// typing) can no longer be written by accident.
import * as React from "react";
import { ChevronDown } from "lucide-react";
import { FIELD_SELECT } from "@/lib/styles";

export type SelectFieldProps = Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  "className"
>;

export function SelectField({ children, ...props }: SelectFieldProps) {
  return (
    <div className="relative">
      <select {...props} className={FIELD_SELECT}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-theme-muted-foreground" />
    </div>
  );
}
