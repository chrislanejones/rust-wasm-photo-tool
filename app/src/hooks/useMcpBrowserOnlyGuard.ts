import { useEffect } from "react";
import { api } from "../../../convex/_generated/api";
import { useCloudAuth, useCloudMutation } from "@/lib/cloud";
import { logDiagnostic } from "@/lib/diagnosticsLog";
import { useUIStore } from "@/stores/useUIStore";

/**
 * The online switch is per browser, so the server can't see it (ADR-095). When
 * this device moves to "Everything in your browser", tell the server to turn AI
 * app access off. A device with no connection can't send that; Settings says so.
 */
export function useMcpBrowserOnlyGuard(): void {
  const { isAuthenticated } = useCloudAuth();
  const browserOnlyOn = useCloudMutation(api.mcp.browserOnlyOn);

  useEffect(() => {
    if (!isAuthenticated) return;
    return useUIStore.subscribe((state, previous) => {
      if (!previous.onlineFeaturesEnabled || state.onlineFeaturesEnabled) return;
      void browserOnlyOn().catch((err) => {
        logDiagnostic("CONVEX_DB", `mcp.browserOnlyOn failed: ${err instanceof Error ? err.message : String(err)}`);
      });
    });
  }, [isAuthenticated, browserOnlyOn]);
}
