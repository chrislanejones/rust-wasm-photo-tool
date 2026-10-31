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
import { useZipRecipeStore } from "@/stores/useZipRecipeStore";
import { useToolStore } from "@/stores/useToolStore";

const FIT_OPTIONS = [
  { id: "exact", label: "Exact" },
  { id: "long", label: "Long edge" },
  { id: "width", label: "Width" },
  { id: "keep", label: "Keep" },
] as const;
type Fit = (typeof FIT_OPTIONS)[number]["id"];

export function ZipRecipePicker({ zipFormat }: { zipFormat: ExportFormat }) {
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
    <div className="space-y-2">
      <div className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-0.5">
          <label htmlFor={selectId} className="text-xs text-text-secondary">
            Recipe
          </label>
          <SelectField id={selectId} value={recipeId ?? ""} onChange={(e) => setRecipeId(e.target.value || null)}>
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
          <Button size="default" title={`Delete the recipe "${recipe.name}"`} onClick={() => remove(recipe.id)}>
            <Trash2 className="h-3.5 w-3.5" />
            <span className="sr-only">Delete recipe</span>
          </Button>
        )}
      </div>
      {recipe && (
        <p className="text-2xs text-theme-muted-foreground">
          {`${describeRecipe(recipe)}, quality ${recipe.quality}, named ${recipe.pattern}. The gallery is not changed.`}
        </p>
      )}

      {!saving ? (
        <Button size="default" onClick={() => setSaving(true)} disabled={saved.length >= MAX_SAVED_RECIPES}>
          <Save className="h-3.5 w-3.5" />
          Save current as recipe…
        </Button>
      ) : (
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
            <TextField label="File name" value={pattern} onChange={(e) => setPattern(e.target.value)} />
          </div>
          <p className="text-2xs text-theme-muted-foreground">
            {`Saves as ${zipFormat.toUpperCase()}, the format above. Name tokens: {name} {n} {w} {h}.`}
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
