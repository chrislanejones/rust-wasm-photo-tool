export { ToolsSidebar } from "./ToolsSidebar";
// Public tool-metadata surface — other features (e.g. the command palette)
// import from HERE, never from this feature's internals (repo-boundaries).
export { TOOLS } from "./toolConfig";
export type { ToolDefinition } from "./toolConfig";
export { TOOL_MODULES, getToolModule } from "./toolModules";
export type { ToolModule } from "./toolModules";
