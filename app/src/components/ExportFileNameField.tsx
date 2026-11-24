import { FIELD_BASE_GROUP } from "@/lib/styles";

interface Props {
  value: string;
  defaultStem: string;
  onChange: (value: string) => void;
  /** Shown inside the field's right end, not editable — it follows the chosen
   *  format (and the AVIF→PNG fallback), so the name can never disagree with
   *  the bytes. */
  ext: string;
  /** Enter in the field downloads, same as the Download button. */
  onSubmit: () => void;
}

/** "File Name" for the export dialog's single-image Download. Only on
 *  Selected image: on All images each file keeps its own name, and the
 *  recipe's Naming line says so (Chris, 11-24-2026: no grayed-out field). */
export function ExportFileNameField({ value, defaultStem, onChange, ext, onSubmit }: Props) {
  return (
    <div className="space-y-2">
      <label htmlFor="export-file-name" className="text-xs font-semibold text-text-muted">
        File Name
      </label>
      {/* One box: the name, then its extension as a fixed suffix inside the
          same border, so the two read as one file name. */}
      <div className={`${FIELD_BASE_GROUP} flex items-center`}>
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
          aria-describedby="export-file-ext"
          className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
        />
        <span id="export-file-ext" className="shrink-0 border-l border-theme-border px-3 py-2 font-mono text-sm text-text-muted">
          {ext}
        </span>
      </div>
    </div>
  );
}
