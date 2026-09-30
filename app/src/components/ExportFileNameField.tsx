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
}

/** "File name" for the export dialog's single-image Download. */
export function ExportFileNameField({ value, defaultStem, onChange, ext, onSubmit }: Props) {
  return (
    <div className="space-y-2">
      <label htmlFor="export-file-name" className="text-xs font-semibold text-text-muted">
        File name
      </label>
      <div className="flex items-center gap-2">
        <input
          id="export-file-name"
          type="text"
          value={value}
          placeholder={defaultStem}
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
        <span className="shrink-0 font-mono text-sm text-text-muted">{ext}</span>
      </div>
    </div>
  );
}
