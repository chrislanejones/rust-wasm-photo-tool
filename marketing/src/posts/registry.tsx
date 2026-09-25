import type { ComponentType } from "react";
import { POSTS } from "../data/posts";
import EngineInAWorker, { Topper as EngineInAWorkerTopper } from "./engine-in-a-worker";
import OfflineByConstruction, { Topper as OfflineByConstructionTopper } from "./offline-by-construction";

/* slug → body. The only module that imports both halves of a post.
 *
 * Static imports, not `import()`: the prerender step renders every post under
 * Node at build time, and a lazily-loaded body would render as a suspense
 * fallback into the HTML a crawler reads. A post is text. It ships as text.
 */
export const POST_BODIES: Record<string, ComponentType> = {
  "offline-by-construction": OfflineByConstruction,
  "engine-in-a-worker": EngineInAWorker,
};

/* slug → header banner, for a post that has one.
 *
 * Optional, and a post without an entry gets the plain header. The banner is
 * decoration behind the shell's headline, so it renders nothing a reader or a
 * crawler needs: prerendered, it is an empty box over the header's gradient,
 * and the scene fades in after the page has loaded.
 */
export const POST_TOPPERS: Partial<Record<string, ComponentType>> = {
  "offline-by-construction": OfflineByConstructionTopper,
  "engine-in-a-worker": EngineInAWorkerTopper,
};

/* Fail the build on a post with no body.
 *
 * This runs at import time, and `entry-server.tsx` pulls it in through App, so
 * a mismatch stops `pnpm build` with the slug named rather than prerendering a
 * headline over an empty page. It runs in the browser bundle too, where it is a
 * loop over a handful of strings and can only throw if the build it came from
 * was already broken.
 *
 * The other direction — a body in this file with no entry in POSTS — is
 * deliberately not an error. It is how a post gets written before it is
 * published: the body exists, nothing links to it, and adding the metadata
 * entry is the act of publishing.
 */
for (const post of POSTS) {
  if (!POST_BODIES[post.slug]) {
    throw new Error(
      `posts/registry: "${post.slug}" is in POSTS (data/posts.ts) but has no body here. ` +
        `Add src/posts/${post.slug}.tsx and map it, or remove the entry.`,
    );
  }
}
