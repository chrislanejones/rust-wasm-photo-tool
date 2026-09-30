// A labeled field: the word above, the box below, and the word ATTACHED to
// the box with a real `<label htmlFor>`.
//
// The New Canvas width/height boxes used `<span>`s for their words, so they
// read correctly on screen and announced as a bare "spin button" — the exact
// bug DimensionFields had already fixed for Resize. Three copies of this box
// (New Canvas, DimensionFields, the color picker's channels) is how one of
// them kept the bug; one copy is how it stays fixed. `useId` because the box
// renders in more than one panel, so a hardcoded id would collide.
//
// TWO EXPORTS, ONE BOX. `NumberField` is Resize's W / H; `TextField` is the
// same label + box for words (Batch → Rename's pattern and find/replace, AI
// Rename's pattern). Before TextField, both rename panels hand-rolled a
// `<span>` + `<input>` with their own class string — a fourth spelling of
// "a field", and the same unattached-label bug the comment above describes.
import { useId } from "react";
import { FIELD_NUMERIC, FIELD_TEXT } from "@/lib/styles";
import { cn } from "@/lib/utils";

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "id" | "className">;

export interface NumberFieldProps extends InputProps {
  label: React.ReactNode;
  /** Wrapper classes, e.g. `min-w-0` for a box in a tight row. */
  className?: string;
  /** Added to the field classes, e.g. `px-1 text-center` for a narrow channel. */
  inputClassName?: string;
}

export type TextFieldProps = NumberFieldProps;

function LabeledField({
  type,
  base,
  label,
  className,
  inputClassName,
  ...props
}: NumberFieldProps & { type: "number" | "text"; base: string }) {
  const id = useId();
  return (
    <div className={cn("flex flex-1 flex-col gap-0.5", className)}>
      <label htmlFor={id} className="text-xs text-text-secondary">
        {label}
      </label>
      <input
        id={id}
        type={type}
        {...props}
        className={inputClassName ? cn(base, inputClassName) : base}
      />
    </div>
  );
}

export function NumberField(props: NumberFieldProps) {
  return <LabeledField type="number" base={FIELD_NUMERIC} {...props} />;
}

/** Same box as NumberField, for text. Padded like its numeric sibling (not the
 *  dialog-sized FIELD_TEXT default) so a text box and a number box in one
 *  sidebar panel line up. */
const FIELD_TEXT_PANEL = cn(FIELD_TEXT, "px-2 py-1.5");

export function TextField(props: TextFieldProps) {
  return <LabeledField type="text" base={FIELD_TEXT_PANEL} {...props} />;
}
