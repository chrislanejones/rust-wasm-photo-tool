// app/src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import { ConvexClerkProvider } from "@/components/ConvexClerkProvider";
import { setupServiceWorker } from "@/lib/pwa/swBoot";
import "./styles.css";
import { installGpuBlurSelfTest } from "@/lib/webgpu/selfTest";
import { webgpuEnabled } from "@/lib/webgpu/detect";
import {
  installContentAudit,
  installArchiveCorruptionAudit,
} from "@/lib/contentAuditInstall";
import { installSaveGuardProbe } from "@/lib/engineDocument";
import { installUploadBudgetProbe } from "@/lib/uploadBudget";

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

// `window.__ihSaveGuard()` — the archive-ownership guard's decision tally.
// Deliberately NOT behind the gate above: the re-measure that decides whether
// the guard works at all runs against a PRODUCTION build, and the guard's
// failure mode is being inert (allowing everything because ownership is
// unknown), which is invisible without these counts. Chris also needs it to
// check his own production profile. It defines a function that reads three
// integers and a string — no side effects, no cost.
installSaveGuardProbe();

// `window.__ihArchiveCorruptionAudit()` — read-only detection of archives that
// hold another photo's canvas. Ungated for the same reason: the archives worth
// checking are the ones on a real production profile, written by builds that
// shipped before the ownership guard existed. It reports and never repairs.
installArchiveCorruptionAudit();

// `window.__ihUploadBudget()` — the cloud-upload rate limiter's state. Ungated
// for the same reason as the others: a limiter nobody can observe is
// indistinguishable from a broken one, and the runaway it guards against
// happens in production, not in dev.
installUploadBudgetProbe();

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
