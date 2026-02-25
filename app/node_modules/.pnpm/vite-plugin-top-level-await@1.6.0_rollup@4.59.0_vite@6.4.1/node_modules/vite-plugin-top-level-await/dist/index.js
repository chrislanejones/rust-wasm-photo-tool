"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = topLevelAwait;
const path_1 = __importDefault(require("path"));
const rollup_1 = require("rollup");
const plugin_virtual_1 = __importDefault(require("@rollup/plugin-virtual"));
const SWC = __importStar(require("./swc"));
const esbuild_1 = __importDefault(require("./esbuild"));
const options_1 = require("./options");
const bundle_info_1 = require("./bundle-info");
const transform_1 = require("./transform");
// Use the same default target as Vite.
// https://github.com/vitejs/vite/blob/v6.0.7/packages/vite/src/node/constants.ts#L70-L76
const DEFAULT_VITE_TARGET = ["es2020", "edge88", "firefox78", "chrome87", "safari14"];
function topLevelAwait(options) {
    const resolvedOptions = {
        ...options_1.DEFAULT_OPTIONS,
        ...(options || {})
    };
    let isWorker = false;
    let isWorkerIifeRequested = false;
    let assetsDir = "";
    let buildTarget;
    let minify;
    const buildRawTarget = async (code) => {
        return (await esbuild_1.default.transform(code, {
            minify,
            target: buildTarget,
            format: "esm"
        })).code;
    };
    return {
        name: "vite-plugin-top-level-await",
        enforce: "post",
        outputOptions(options) {
            if (isWorker && options.format === "iife") {
                // The the worker bundle's output format to ES to allow top-level awaits
                // We'll use another rollup build to convert it back to IIFE
                options.format = "es";
                isWorkerIifeRequested = true;
            }
        },
        config(config, env) {
            var _a, _b;
            if (env.command === "build") {
                if (config.worker) {
                    isWorker = true;
                }
                // By default Vite transforms code with esbuild with target for a browser list with ES modules support
                // This cause esbuild to throw an exception when there're top-level awaits in code
                // Let's backup the original target and override the esbuild target with "esnext", which allows TLAs.
                // If the user doesn't specify a target explicitly, `config.build.target` will be undefined and we'll
                // use the default Vite target.
                buildTarget = (_a = config.build.target) !== null && _a !== void 0 ? _a : DEFAULT_VITE_TARGET;
                config.build.target = "esnext";
                minify = !!config.build.minify;
                assetsDir = config.build.assetsDir;
            }
            if (env.command === "serve") {
                // Fix errors in NPM packages which are getting pre-processed in development build
                if ((_b = config.optimizeDeps) === null || _b === void 0 ? void 0 : _b.esbuildOptions) {
                    config.optimizeDeps.esbuildOptions.target = "esnext";
                }
            }
        },
        async generateBundle(bundleOptions, bundle) {
            // Process ES modules (modern) target only since TLAs in legacy builds are handled by SystemJS
            if (bundleOptions.format !== "es")
                return;
            const bundleChunks = Object.fromEntries(Object.entries(bundle)
                .filter(([, item]) => item.type === "chunk")
                .map(([key, item]) => [key, item.code]));
            const bundleAsts = await (0, bundle_info_1.parseBundleAsts)(bundleChunks);
            const bundleInfo = await (0, bundle_info_1.parseBundleInfo)(bundleAsts);
            await Promise.all(Object.keys(bundleChunks).map(async (moduleName) => {
                if (!bundleInfo[moduleName].transformNeeded) {
                    if (buildTarget !== "esnext") {
                        bundle[moduleName].code = await buildRawTarget(bundleChunks[moduleName]);
                    }
                    return;
                }
                const newAst = (0, transform_1.transformModule)(bundleChunks[moduleName], bundleAsts[moduleName], moduleName, bundleInfo, resolvedOptions);
                let code = SWC.printSync(newAst, { minify }).code;
                if (buildTarget !== "esnext") {
                    code = await buildRawTarget(code);
                }
                bundle[moduleName].code = code;
            }));
            if (isWorker && isWorkerIifeRequested) {
                // Get the entry chunk
                const chunkNames = Object.keys(bundle).filter(key => bundle[key].type === "chunk");
                const entry = chunkNames.find(key => bundle[key].isEntry);
                if (!entry) {
                    throw new Error(`Entry not found in worker bundle! Please submit an issue with a reproducible project.`);
                }
                // Build a new bundle to convert ESM to IIFE
                // Assets are not touched
                const newBuild = await (0, rollup_1.rollup)({
                    input: entry,
                    plugins: [(0, plugin_virtual_1.default)(Object.fromEntries(chunkNames.map(key => [key, bundle[key].code])))]
                });
                // IIFE bundle is always a single file
                const { output: [newEntry] } = await newBuild.generate({
                    format: "iife",
                    entryFileNames: path_1.default.posix.join(assetsDir, "[name].js")
                });
                // Postprocess and minify (if requested) with ESBuild
                newEntry.code = (await esbuild_1.default.transform(
                // Polyfill `document.currentScript.src` since it's used for `import.meta.url`.
                `self.document = { currentScript: { src: self.location.href } };\n${newEntry.code}`, {
                    minify,
                    target: buildTarget
                })).code;
                // Remove extra chunks and replace ESM entry with IIFE entry
                for (const chunkName of chunkNames) {
                    if (chunkName !== entry)
                        delete bundle[chunkName];
                }
                bundle[entry] = newEntry;
            }
        }
    };
}
