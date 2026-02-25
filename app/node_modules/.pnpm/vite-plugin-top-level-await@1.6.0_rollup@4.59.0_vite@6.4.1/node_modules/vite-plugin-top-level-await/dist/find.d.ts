import * as SWC from "./swc";
export declare enum CodePattern {
    TopLevelAwait = "TopLevelAwait",
    DynamicImport = "DynamicImport"
}
export declare function findHighestPattern(ast: SWC.Module): CodePattern;
