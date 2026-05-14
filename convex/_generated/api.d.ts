/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as aiJobs from "../aiJobs.js";
import type * as annotations from "../annotations.js";
import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as history from "../history.js";
import type * as http from "../http.js";
import type * as images from "../images.js";
import type * as layers from "../layers.js";
import type * as photoEdits from "../photoEdits.js";
import type * as projects from "../projects.js";
import type * as router from "../router.js";
import type * as subscriptions from "../subscriptions.js";
import type * as textHistory from "../textHistory.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  aiJobs: typeof aiJobs;
  annotations: typeof annotations;
  auth: typeof auth;
  crons: typeof crons;
  history: typeof history;
  http: typeof http;
  images: typeof images;
  layers: typeof layers;
  photoEdits: typeof photoEdits;
  projects: typeof projects;
  router: typeof router;
  subscriptions: typeof subscriptions;
  textHistory: typeof textHistory;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
