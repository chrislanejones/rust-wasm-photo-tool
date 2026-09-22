// A labelled number box: the word above, the field below, and the word
// ATTACHED to the field with a real `<label htmlFor>`.
//
// The New Canvas width/height boxes used `<span>`s for their words, so they
// read correctly on screen and announced as a bare "spin button" — the exact
// bug DimensionFields had already fixed for Resize. Three copies of this box
// (New Canvas, DimensionFields, the color picker's channels) is how one of
// them kept the bug; one copy is how it stays fixed. `useId` because the box
// renders in more than one panel, so a hardcoded id would collide.
import { useId } from "react";
import { FIELD_NUMERIC } from "@/lib/styles";
import { cn } from "@/lib/utils";

export interface NumberFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "id" | "className"> {
  label: React.ReactNode;
  /** Wrapper classes, e.g. `min-w-0` for a box in a tight row. */
  className?: string;
  /** Added to FIELD_NUMERIC, e.g. `px-1 text-center` for a narrow channel. */
  inputClassName?: string;
}

export function NumberField({ label, className, inputClassName, ...props }: NumberFieldProps) {
  const id = useId();
  return (
    <div className={cn("flex flex-1 flex-col gap-0.5", className)}>
      <label htmlFor={id} className="text-xs text-text-secondary">
        {label}
      </label>
      <input
        id={id}
        type="number"
        {...props}
        className={inputClassName ? cn(FIELD_NUMERIC, inputClassName) : FIELD_NUMERIC}
      />
    </div>
  );
}
