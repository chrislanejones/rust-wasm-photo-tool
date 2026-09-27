// Every component that opts into the React Compiler with "use memo" must
// actually compile.
//
// WHY THIS EXISTS. The compiler does not fail the build when it cannot compile
// a component — it skips it, silently, and the app ships unmemoized. B0
// (docs/AppShell-Refactor-Plan.md) annotated four components and three of
// them were skipped for a week: CanvasArea for its `eslint-disable`d hook
// rules, ToolsSidebar and ReviewPanel for `= false` defaults in their props
// destructure. Nothing said so. This does.
//
// Same plugin, same options as vite.config.ts (annotation mode).
import { describe, expect, it } from "vitest";
import { transformSync } from "@babel/core";
import { readFileSync } from "node:fs";
import { FILES, rel } from "@/lib/engine/contractScan";

function compile(file: string) {
  const skipped: string[] = [];
  const out = transformSync(readFileSync(file, "utf8"), {
    filename: file,
    babelrc: false,
    configFile: false,
    parserOpts: { plugins: ["typescript", "jsx"] },
    plugins: [
      [
        "babel-plugin-react-compiler",
        {
          compilationMode: "annotation",
          logger: {
            logEvent: (_f: string, e: { kind: string; detail?: { reason?: string } }) => {
              if (e.kind !== "CompileSuccess") skipped.push(`${e.kind}: ${e.detail?.reason ?? ""}`);
            },
          },
        },
      ],
    ],
  });
  return { code: out?.code ?? "", skipped };
}

describe("React Compiler opt-ins", () => {
  const annotated = FILES.filter((f) => /^\s*["']use memo["'];/m.test(readFileSync(f, "utf8")));

  it("finds the opted-in components (the scan itself is not vacuous)", () => {
    expect(annotated.length).toBeGreaterThanOrEqual(3);
  });

  it.each(annotated.map((f) => [rel(f), f]))("%s compiles", (_rel, file) => {
    const { code, skipped } = compile(file);
    expect(skipped, `the compiler skipped it:\n${skipped.join("\n")}`).toEqual([]);
    expect(code).toMatch(/react\/compiler-runtime/);
  });
});
