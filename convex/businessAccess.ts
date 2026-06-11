import { query } from "./_generated/server";
import { v } from "convex/values";
import {
  canManageAllBusinesses,
  canManageOwnBusinesses,
  getAuthenticatedUser,
  isAdmin,
  isSuperAdmin,
} from "./lib/rbac";
import {
  countStaffForOwner,
  getActivePlanForUser,
} from "./lib/planHelpers";

export const getAccessContext = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const { user, role } = await getAuthenticatedUser(ctx, args.sessionToken);

    const ownedBusinesses = await ctx.db
      .query("businesses")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
      .collect();

    const activeBusinesses = ownedBusinesses.filter(
      (business) => business.isActive,
    );
    const hasBusiness = activeBusinesses.length > 0;
    const requiresBusiness = isAdmin(role);
    const businessOptional = isSuperAdmin(role);
    const shouldRedirectToAddBusiness =
      requiresBusiness && !hasBusiness && canManageOwnBusinesses(role);

    const planLimits = await getActivePlanForUser(ctx, user._id);
    const businessCount = activeBusinesses.length;
    const staffCount = await countStaffForOwner(ctx, user._id);

    return {
      roleName: role.name,
      hasBusiness,
      requiresBusiness,
      businessOptional,
      shouldRedirectToAddBusiness,
      canManageAllBusinesses: canManageAllBusinesses(role),
      canManageOwnBusinesses: canManageOwnBusinesses(role),
      quotas: {
        businessCount,
        maxBusiness: planLimits.maxBusiness,
        staffCount,
        maxStaff: planLimits.maxStaff,
        planName: planLimits.plan?.name ?? null,
      },
    };
  },
});
