// Export › All Images › Recipe (Night 10-28, 229). Pick a recipe for the next
// ZIP, or save the current choices as one. A recipe shapes the export only;
// it never changes a photo in the gallery (lib/exportRecipes.ts).
//
// Saved recipes are Preferences, so they stay on this device when signed out
// and follow a signed-in person to their other devices (ADR-061).
import { useId, useState } from "react";
import { Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ControlRow } from "@/components/ui/control-row";
import { SelectField } from "@/components/ui/select-field";
import { NumberField, TextField } from "@/components/ui/number-field";
import { ToolButtonGroup } from "@/components/ui/tool-button-group";
import { CAMERA_INFO_LABEL, cameraInfoOf } from "@/lib/exif/cameraInfo";
import { usePreferences } from "@/lib/preferences";
import {
  BUILT_IN_RECIPES,
  MAX_SAVED_RECIPES,
  describeRecipe,
  findRecipe,
  type ExportRecipe,
  type RecipeSize,
} from "@/lib/exportRecipes";
import type { ExportFormat } from "@/lib/exportImage";
import { NAME_TOKENS } from "@/lib/nameTokens";
import { useZipRecipeStore } from "@/stores/useZipRecipeStore";
import { useToolStore } from "@/stores/useToolStore";

const FIT_OPTIONS = [
  { id: "exact", label: "Exact" },
  { id: "long", label: "Long edge" },
  { id: "width", label: "Width" },
  { id: "keep", label: "Keep" },
] as const;
type Fit = (typeof FIT_OPTIONS)[number]["id"];

export function ZipRecipePicker({
  zipFormat,
  disabled = false,
}: {
  zipFormat: ExportFormat;
  /** Shown but off: a recipe shapes a ZIP, so with Download Selected it is
   *  greyed out rather than hidden, and the Export dialog keeps one shape
   *  (Chris, 11-23-2026). */
  disabled?: boolean;
}) {
  const [prefs, applyPrefs] = usePreferences();
  const recipeId = useZipRecipeStore((s) => s.recipeId);
  const setRecipeId = useZipRecipeStore((s) => s.setRecipeId);
  const quality = useToolStore((s) => s.quality);
  const recipe = findRecipe(recipeId, prefs.exportRecipes);
  const saved = prefs.exportRecipes;
  const selectId = useId();

  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [fit, setFit] = useState<Fit>("long");
  const [w, setW] = useState(1600);
  const [h, setH] = useState(1600);
  const [q, setQ] = useState(quality);
  const [pattern, setPattern] = useState("{name}");

  const sizeOf = (): RecipeSize =>
    fit === "keep" ? { fit } : fit === "exact" ? { fit, width: w, height: h } : { fit, size: w };
  const canSave = name.trim().length > 0 && w >= 1 && (fit !== "exact" || h >= 1) && saved.length < MAX_SAVED_RECIPES;

  const save = () => {
    if (!canSave) return;
    const r: ExportRecipe = {
      id: `r-${Date.now().toString(36)}`,
      name: name.trim(),
      size: sizeOf(),
      format: zipFormat,
      quality: Math.min(100, Math.max(1, Math.round(q))),
      pattern: pattern.trim() || "{name}",
      // The recipe carries the Camera info chosen in the dialog right now.
      cameraInfo: cameraInfoOf(prefs),
    };
    applyPrefs({ ...prefs, exportRecipes: [...saved, r] });
    setRecipeId(r.id);
    setSaving(false);
    setName("");
  };

  const remove = (id: string) => {
    applyPrefs({ ...prefs, exportRecipes: saved.filter((r) => r.id !== id) });
    if (recipeId === id) setRecipeId(null);
  };

  return (
    <div className={disabled ? "space-y-2 opacity-50" : "space-y-2"}>
      <label htmlFor={selectId} className="block text-xs font-semibold text-text-muted">
        Recipe
      </label>
      {/* The menu takes three quarters of the row and Save the last quarter
          (Chris, 11-23-2026). Delete sits inside the menu's share, beside it,
          only while a saved recipe is picked. */}
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-[3] items-center gap-2">
          <div className="min-w-0 flex-1">
          <SelectField
            id={selectId}
            value={recipeId ?? ""}
            disabled={disabled}
            onChange={(e) => setRecipeId(e.target.value || null)}
          >
            <option value="">None — the format above, each at its size</option>
            <optgroup label="Built in">
              {BUILT_IN_RECIPES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </optgroup>
            {saved.length > 0 && (
              <optgroup label="Saved">
                {saved.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </optgroup>
            )}
          </SelectField>
          </div>
          {recipe && !recipe.id.startsWith("builtin:") && (
            <Button
              size="default"
              disabled={disabled}
              title={`Delete the recipe "${recipe.name}"`}
              onClick={() => remove(recipe.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="sr-only">Delete recipe</span>
            </Button>
          )}
        </div>
        <Button
          size="default"
          className="flex-1"
          onClick={() => setSaving(true)}
          disabled={disabled || saving || saved.length >= MAX_SAVED_RECIPES}
          title="Save the current format, size and name as a recipe"
        >
          <Save className="h-3.5 w-3.5" />
          Save…
        </Button>
      </div>
      {recipe && !disabled && (
        <p className="text-2xs text-theme-muted-foreground">
          {`${describeRecipe(recipe)}, quality ${recipe.quality}, named ${recipe.pattern}${
            recipe.cameraInfo ? `, camera info ${CAMERA_INFO_LABEL[recipe.cameraInfo]}` : ""
          }. The gallery is not changed.`}
        </p>
      )}

      {saving && !disabled && (
        <form
          aria-label="New recipe"
          className="space-y-2 rounded-md border border-border p-2"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <TextField label="Recipe name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Blog 1200" />
          <ControlRow label="Size">
            {({ labelId }) => (
              <ToolButtonGroup
                aria-labelledby={labelId}
                options={FIT_OPTIONS}
                value={fit}
                onChange={setFit}
                columns={4}
              />
            )}
          </ControlRow>
          {fit !== "keep" && (
            <div className="flex gap-2">
              <NumberField
                label={fit === "exact" ? "Width (px)" : "Size (px)"}
                min={1}
                value={w}
                onChange={(e) => setW(Math.round(Number(e.target.value)) || 0)}
              />
              {fit === "exact" && (
                <NumberField
                  label="Height (px)"
                  min={1}
                  value={h}
                  onChange={(e) => setH(Math.round(Number(e.target.value)) || 0)}
                />
              )}
            </div>
          )}
          <div className="flex gap-2">
            <NumberField label="Quality" min={1} max={100} value={q} onChange={(e) => setQ(Number(e.target.value))} />
            <TextField label="Name pattern" value={pattern} onChange={(e) => setPattern(e.target.value)} />
          </div>
          <p className="text-2xs text-theme-muted-foreground">
            {`Saves as ${zipFormat.toUpperCase()}, the format above, with Camera info ${CAMERA_INFO_LABEL[cameraInfoOf(prefs)]}. Name tokens: ${NAME_TOKENS.map((t) => t.token).join(" ")}. {width}, {height} and {ext} are the exported file's.`}
          </p>
          <div className="flex justify-end gap-2">
            <Button size="default" type="button" onClick={() => setSaving(false)}>
              Cancel
            </Button>
            <Button size="default" type="submit" disabled={!canSave}>
              Save recipe
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
