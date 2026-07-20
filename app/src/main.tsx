// app/src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import { ConvexClerkProvider } from "@/components/ConvexClerkProvider";
import { setupServiceWorker } from "@/lib/pwa/swBoot";
import "./styles.css";

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
