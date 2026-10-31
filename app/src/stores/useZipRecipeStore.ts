import { create } from "zustand";
import { usePreferences } from "@/lib/preferences";
import { findRecipe, type ExportRecipe } from "@/lib/exportRecipes";

/** The recipe the next Download All applies (Night 10-28, 229). Picked in the
 *  Export dialog, read by useZipExport when it runs — a store rather than a
 *  prop so the choice reaches the zip without a new AppShell wire. Session
 *  only: null means "no recipe", the plain format-and-quality ZIP. */
interface ZipRecipeState {
  recipeId: string | null;
  setRecipeId: (id: string | null) => void;
}

export const useZipRecipeStore = create<ZipRecipeState>((set) => ({
  recipeId: null,
  setRecipeId: (recipeId) => set({ recipeId }),
}));

/** The recipe the next ZIP will use, from the store and the saved list. */
export function useZipRecipe(): ExportRecipe | null {
  const [prefs] = usePreferences();
  const id = useZipRecipeStore((s) => s.recipeId);
  return findRecipe(id, prefs.exportRecipes);
}
