/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai from "../ai.js";
import type * as aiCaps from "../aiCaps.js";
import type * as aiJobFiles from "../aiJobFiles.js";
import type * as aiJobs from "../aiJobs.js";
import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as entitlement from "../entitlement.js";
import type * as http from "../http.js";
import type * as mcp from "../mcp.js";
import type * as mcpAuth from "../mcpAuth.js";
import type * as mcpClaims from "../mcpClaims.js";
import type * as mcpHttp from "../mcpHttp.js";
import type * as mcpTools from "../mcpTools.js";
import type * as photoEdits from "../photoEdits.js";
import type * as router from "../router.js";
import type * as shares from "../shares.js";
import type * as storageOrphans from "../storageOrphans.js";
import type * as storageQuota from "../storageQuota.js";
import type * as storageSweep from "../storageSweep.js";
import type * as storageUsage from "../storageUsage.js";
import type * as storedFiles from "../storedFiles.js";
import type * as stripe from "../stripe.js";
import type * as subscriptions from "../subscriptions.js";
import type * as sync from "../sync.js";
import type * as testAccount from "../testAccount.js";
import type * as testAccountWipe from "../testAccountWipe.js";
import type * as testReplicate from "../testReplicate.js";
import type * as textHistory from "../textHistory.js";
import type * as transfers from "../transfers.js";
import type * as trash from "../trash.js";
import type * as userColors from "../userColors.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  aiCaps: typeof aiCaps;
  aiJobFiles: typeof aiJobFiles;
  aiJobs: typeof aiJobs;
  auth: typeof auth;
  crons: typeof crons;
  entitlement: typeof entitlement;
  http: typeof http;
  mcp: typeof mcp;
  mcpAuth: typeof mcpAuth;
  mcpClaims: typeof mcpClaims;
  mcpHttp: typeof mcpHttp;
  mcpTools: typeof mcpTools;
  photoEdits: typeof photoEdits;
  router: typeof router;
  shares: typeof shares;
  storageOrphans: typeof storageOrphans;
  storageQuota: typeof storageQuota;
  storageSweep: typeof storageSweep;
  storageUsage: typeof storageUsage;
  storedFiles: typeof storedFiles;
  stripe: typeof stripe;
  subscriptions: typeof subscriptions;
  sync: typeof sync;
  testAccount: typeof testAccount;
  testAccountWipe: typeof testAccountWipe;
  testReplicate: typeof testReplicate;
  textHistory: typeof textHistory;
  transfers: typeof transfers;
  trash: typeof trash;
  userColors: typeof userColors;
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
