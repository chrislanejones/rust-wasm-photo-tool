import { FIELD_TEXT } from "@/lib/styles";

interface Props {
  value: string;
  defaultStem: string;
  onChange: (value: string) => void;
  /** Shown after the field, not editable — it follows the chosen format (and
   *  the AVIF→PNG fallback), so the name can never disagree with the bytes. */
  ext: string;
  /** Enter in the field downloads, same as the Download tile. */
  onSubmit: () => void;
  /** Download All: shown but off — each image in the ZIP keeps its own name
   *  (a recipe's name pattern can change that). */
  disabled?: boolean;
}

/** "File name" for the export dialog's single-image Download. */
export function ExportFileNameField({ value, defaultStem, onChange, ext, onSubmit, disabled = false }: Props) {
  return (
    <div className={disabled ? "space-y-2 opacity-50" : "space-y-2"}>
      <label htmlFor="export-file-name" className="text-xs font-semibold text-text-muted">
        File Name
      </label>
      <div className="flex items-center gap-2">
        <input
          id="export-file-name"
          type="text"
          value={disabled ? "" : value}
          placeholder={disabled ? "Each image keeps its own name" : defaultStem}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onSubmit();
            }
          }}
          spellCheck={false}
          autoComplete="off"
          className={`${FIELD_TEXT} min-w-0 flex-1`}
        />
        {!disabled && <span className="shrink-0 font-mono text-sm text-text-muted">{ext}</span>}
      </div>
    </div>
  );
}
