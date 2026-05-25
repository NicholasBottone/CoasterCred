/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as auth from "../auth.js";
import type * as coasterpedia from "../coasterpedia.js";
import type * as coasters from "../coasters.js";
import type * as crons from "../crons.js";
import type * as feedEvents from "../feedEvents.js";
import type * as http from "../http.js";
import type * as profiles from "../profiles.js";
import type * as rankings from "../rankings.js";
import type * as rideLogs from "../rideLogs.js";
import type * as router from "../router.js";
import type * as usageStats from "../usageStats.js";
import type * as validation from "../validation.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  auth: typeof auth;
  coasterpedia: typeof coasterpedia;
  coasters: typeof coasters;
  crons: typeof crons;
  feedEvents: typeof feedEvents;
  http: typeof http;
  profiles: typeof profiles;
  rankings: typeof rankings;
  rideLogs: typeof rideLogs;
  router: typeof router;
  usageStats: typeof usageStats;
  validation: typeof validation;
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
