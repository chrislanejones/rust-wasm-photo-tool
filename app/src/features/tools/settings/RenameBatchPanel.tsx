// Batch › Rename ("Power Rename"). Moved out of BatchSettings.tsx when it
// gained the shared name tokens (ticket 237), which pushed that file past its
// line cap.
import { useCallback, useState } from "react";
import { PanelAction, PanelActionBar } from "@/components/ui/panel-action-bar";
import { NumberField, TextField } from "@/components/ui/number-field";
import { FieldLabel } from "@/components/ui/field-label";
import { ToolButtonGroup } from "@/components/ui/tool-button-group";
import { SectionHeader } from "@/components/ui/section-header";
import { toast } from "@/components/ui/sonner";
import { expandNameTokens, extOf, NAME_TOKENS, patternNeedsNameFacts } from "@/lib/nameTokens";
import type { PhotoEntry } from "@/features/gallery/GalleryBar";
import { usePhotoNameFacts } from "./usePhotoNameFacts";

/** Power Rename — bulk-rename every image with a token pattern (the shared set
 *  in lib/nameTokens.ts: {name}, {n}, {date}, {original}, …), an optional
 *  find/replace on the current name, and sequential numbering, with a live
 *  before→after preview. Names only (no pixels). Instant, except that `{date}`
 *  and `{original}` read each stored file once first. */
export function RenameBatchPanel({
  photos,
  setPhotos,
}: {
  photos: PhotoEntry[];
  setPhotos: React.Dispatch<React.SetStateAction<PhotoEntry[]>>;
}) {
  const [pattern, setPattern] = useState("{name}");
  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");
  const [useRegex, setUseRegex] = useState(false);
  const [start, setStart] = useState(1);
  const [pad, setPad] = useState(1);
  const { facts, loading: readingFacts } = usePhotoNameFacts(
    photos,
    patternNeedsNameFacts(pattern),
  );

  const computeName = useCallback(
    (photo: PhotoEntry, i: number): string => {
      const name = photo.name;
      const dot = name.lastIndexOf(".");
      const baseRaw = dot > 0 ? name.slice(0, dot) : name;
      const ext = dot > 0 ? name.slice(dot) : "";
      let base = baseRaw;
      if (find) {
        try {
          base = useRegex
            ? base.replace(new RegExp(find, "g"), replace)
            : base.split(find).join(replace);
        } catch {
          /* invalid regex — leave the base unchanged */
        }
      }
      const num = String(start + i).padStart(Math.max(1, pad), "0");
      const f = facts.get(photo.id);
      const newBase = expandNameTokens(pattern, {
        name: base,
        original: f?.original ?? baseRaw,
        n: num,
        width: photo.origWidth,
        height: photo.origHeight,
        ext: extOf(name, photo.mimeType),
        dateTaken: f?.dateTaken,
        fileDate: f?.fileDate,
      });
      // Never blank a name: empty pattern result falls back to the original base.
      return (newBase.trim() || baseRaw) + ext;
    },
    [pattern, find, replace, useRegex, start, pad, facts],
  );

  const preview = photos
    .slice(0, 4)
    .map((p, i) => ({ from: p.name, to: computeName(p, i) }));

  const apply = () => {
    if (photos.length === 0 || readingFacts) return;
    // By id, not index: `photos` may be one group, not the whole gallery.
    const next = new Map(photos.map((p, i) => [p.id, computeName(p, i)]));
    setPhotos((prev) => prev.map((p) => (next.has(p.id) ? { ...p, name: next.get(p.id)! } : p)));
    toast.success(
      `Renamed ${photos.length} image${photos.length !== 1 ? "s" : ""}`,
    );
  };

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Rename"
        info={
          <>
            Tokens:{" "}
            {NAME_TOKENS.map(({ token, hint }, i) => (
              <span key={token}>
                {i > 0 && ", "}
                <span className="font-mono">{token}</span> ({hint})
              </span>
            ))}
            . Find and Replace change <span className="font-mono">{"{name}"}</span>{" "}
            only. The extension is kept.
          </>
        }
      />

      <TextField
        label="Name pattern"
        value={pattern}
        onChange={(e) => setPattern(e.target.value)}
        placeholder="{name}"
        inputClassName="font-mono"
      />

      <div className="space-y-2">
        <div className="flex items-end gap-2">
          <TextField
            label="Find"
            className="min-w-0"
            value={find}
            onChange={(e) => setFind(e.target.value)}
            placeholder="Find"
          />
          <TextField
            label="Replace"
            className="min-w-0"
            value={replace}
            onChange={(e) => setReplace(e.target.value)}
            placeholder="Replace"
          />
        </div>
        <ToolButtonGroup
          options={[{ id: "regex", label: ".* Regex", active: useRegex, title: "Treat Find as a regular expression" }]}
          onChange={() => setUseRegex((v) => !v)}
          columns={2}
        />
      </div>

      <div className="flex items-end gap-2">
        <NumberField
          label="Start #"
          className="min-w-0"
          min={0}
          value={start}
          onChange={(e) => setStart(parseInt(e.target.value, 10) || 0)}
        />
        <NumberField
          label="Pad digits"
          className="min-w-0"
          min={1}
          max={6}
          value={pad}
          onChange={(e) =>
            setPad(Math.max(1, Math.min(6, parseInt(e.target.value, 10) || 1)))
          }
        />
      </div>

      <div className="space-y-1">
        <FieldLabel title="Preview" />
        {preview.length === 0 ? (
          <p className="text-2xs text-theme-muted-foreground">No images.</p>
        ) : (
          preview.map((row, i) => (
            <div key={i} className="full-width-badge" title={`${row.from} → ${row.to}`}>
              <span className="large-badge text-theme-muted-foreground line-through">
                {row.from}
              </span>
              <span className="history-index">→</span>
              <span className="large-badge font-mono text-text-primary">
                {row.to}
              </span>
            </div>
          ))
        )}
        {photos.length > preview.length && (
          <p className="text-2xs text-theme-muted-foreground">
            +{photos.length - preview.length} more
          </p>
        )}
      </div>

      <PanelActionBar>
        <PanelAction onClick={apply} disabled={photos.length === 0 || readingFacts}>
          {readingFacts
            ? "Reading dates and names…"
            : `Rename ${photos.length} image${photos.length !== 1 ? "s" : ""}`}
        </PanelAction>
      </PanelActionBar>
    </div>
  );
}
