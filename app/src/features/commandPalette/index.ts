// Public surface of the command-palette feature (repo-boundaries: other
// code imports from HERE, not from the feature's internals).
export { CommandPalette } from "./CommandPalette";
export type { PaletteCommand, PaletteGroup, PaletteContext } from "./commands";
export {
  setPaletteActions,
  usePaletteActionsStore,
  type PaletteActions,
} from "./paletteActions";
