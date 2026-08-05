// app/src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import { ConvexClerkProvider } from "@/components/ConvexClerkProvider";
import { setupServiceWorker } from "@/lib/pwa/swBoot";
import "./styles.css";
import { installGpuBlurSelfTest } from "@/lib/webgpu/selfTest";
import { webgpuEnabled } from "@/lib/webgpu/detect";
import { installContentAudit } from "@/lib/contentAuditInstall";

// GPU blur correctness harness (Phase 0, ADR-030). Installs a
// `window.__ihGpuBlurSelfTest()` that compares the WGSL blur against the CPU
// oracle. There is no WebGPU in jsdom, so a browser is the only honest place to
// run it. Attached in dev, or in any build with `ih_webgpu` switched on — it
// only defines a function, it never touches a pixel on its own.
// Same gate installs `window.__ihContentAudit()` — the read-only IndexedDB
// reachability audit, which likewise only defines a function.
if (import.meta.env.DEV || webgpuEnabled()) {
  installGpuBlurSelfTest();
  installContentAudit();
}

// No-op (statically eliminated) unless the build ran with VITE_ENABLE_SW set
// — the service worker ships dark. See vite.config.ts + lib/pwa/swBoot.ts.
setupServiceWorker();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConvexClerkProvider>
      <App />
    </ConvexClerkProvider>
  </React.StrictMode>,
);
