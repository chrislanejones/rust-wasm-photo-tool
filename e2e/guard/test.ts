// Every e2e spec imports `test` and `expect` from HERE, not from
// @playwright/test (global-setup.ts fails the run otherwise). The auto fixture
// below watches every request and websocket the browser context opens; a
// request to a real Convex deployment or to the Convex upload path is ABORTED
// and fails the test with the URL and the reason. Rules: ./backend.ts.
import { test as base, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { forbiddenRequestReason } from "./backend";

export const test = base.extend<{ backendGuard: void }>({
  backendGuard: [
    async ({ context }, use) => {
      const hits: string[] = [];
      const record = (kind: string, url: string) => {
        const reason = forbiddenRequestReason(url);
        if (reason) hits.push(`${kind} ${url} — ${reason}`);
      };
      // Block as well as record, so a forbidden request never reaches the
      // network even in a spec that does not route traffic itself. A spec's
      // own page.route runs first; this catches what it lets through.
      await context.route(
        (url) => forbiddenRequestReason(url.href) !== null,
        (route) => route.abort("blockedbyclient"),
      );
      // `request` fires for every request, including ones a route then aborts.
      const onRequest = (req: { method(): string; url(): string }) => record(req.method(), req.url());
      const watchPage = (page: Page) => page.on("websocket", (ws) => record("WEBSOCKET", ws.url()));
      context.on("request", onRequest);
      context.pages().forEach(watchPage);
      context.on("page", watchPage);

      await use();

      context.off("request", onRequest);
      context.off("page", watchPage);
      if (hits.length > 0) {
        throw new Error(
          `[e2e backend guard] this test reached for a real backend (${hits.length}):\n  ` +
            hits.join("\n  ") +
            `\ne2e runs must never touch a real Convex deployment or upload anything.`,
        );
      }
    },
    { auto: true },
  ],
});

export { expect };
