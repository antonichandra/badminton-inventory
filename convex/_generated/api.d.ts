/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as adminStats from "../adminStats.js";
import type * as auth from "../auth.js";
import type * as authActions from "../authActions.js";
import type * as authInternal from "../authInternal.js";
import type * as businessAccess from "../businessAccess.js";
import type * as businesses from "../businesses.js";
import type * as lib_authHelpers from "../lib/authHelpers.js";
import type * as lib_businessContext from "../lib/businessContext.js";
import type * as lib_businessHelpers from "../lib/businessHelpers.js";
import type * as lib_groupLabelHelpers from "../lib/groupLabelHelpers.js";
import type * as lib_inventoryCostHelpers from "../lib/inventoryCostHelpers.js";
import type * as lib_planHelpers from "../lib/planHelpers.js";
import type * as lib_rbac from "../lib/rbac.js";
import type * as lib_shiftHelpers from "../lib/shiftHelpers.js";
import type * as lib_shiftReportHelpers from "../lib/shiftReportHelpers.js";
import type * as lib_staffAssignmentHelpers from "../lib/staffAssignmentHelpers.js";
import type * as lib_staffInvitationHelpers from "../lib/staffInvitationHelpers.js";
import type * as lib_staffUserCleanup from "../lib/staffUserCleanup.js";
import type * as lib_userEditAccess from "../lib/userEditAccess.js";
import type * as lib_usersAccess from "../lib/usersAccess.js";
import type * as maintenance from "../maintenance.js";
import type * as ping from "../ping.js";
import type * as plans from "../plans.js";
import type * as products from "../products.js";
import type * as reports from "../reports.js";
import type * as roles from "../roles.js";
import type * as shifts from "../shifts.js";
import type * as sports from "../sports.js";
import type * as staffInvitations from "../staffInvitations.js";
import type * as suppliers from "../suppliers.js";
import type * as types_auth from "../types/auth.js";
import type * as types_users from "../types/users.js";
import type * as users from "../users.js";
import type * as usersActions from "../usersActions.js";
import type * as usersInternal from "../usersInternal.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  adminStats: typeof adminStats;
  auth: typeof auth;
  authActions: typeof authActions;
  authInternal: typeof authInternal;
  businessAccess: typeof businessAccess;
  businesses: typeof businesses;
  "lib/authHelpers": typeof lib_authHelpers;
  "lib/businessContext": typeof lib_businessContext;
  "lib/businessHelpers": typeof lib_businessHelpers;
  "lib/groupLabelHelpers": typeof lib_groupLabelHelpers;
  "lib/inventoryCostHelpers": typeof lib_inventoryCostHelpers;
  "lib/planHelpers": typeof lib_planHelpers;
  "lib/rbac": typeof lib_rbac;
  "lib/shiftHelpers": typeof lib_shiftHelpers;
  "lib/shiftReportHelpers": typeof lib_shiftReportHelpers;
  "lib/staffAssignmentHelpers": typeof lib_staffAssignmentHelpers;
  "lib/staffInvitationHelpers": typeof lib_staffInvitationHelpers;
  "lib/staffUserCleanup": typeof lib_staffUserCleanup;
  "lib/userEditAccess": typeof lib_userEditAccess;
  "lib/usersAccess": typeof lib_usersAccess;
  maintenance: typeof maintenance;
  ping: typeof ping;
  plans: typeof plans;
  products: typeof products;
  reports: typeof reports;
  roles: typeof roles;
  shifts: typeof shifts;
  sports: typeof sports;
  staffInvitations: typeof staffInvitations;
  suppliers: typeof suppliers;
  "types/auth": typeof types_auth;
  "types/users": typeof types_users;
  users: typeof users;
  usersActions: typeof usersActions;
  usersInternal: typeof usersInternal;
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
