import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthenticatedUser, isSuperAdmin } from "./lib/rbac";
import { resolveBusinessStatus } from "./lib/businessHelpers";

export const getBusinessListStats = query({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const { role } = await getAuthenticatedUser(ctx, args.sessionToken);

    if (!isSuperAdmin(role)) {
      throw new Error("FORBIDDEN");
    }

    const businesses = await ctx.db.query("businesses").collect();

    let active = 0;
    let deleteRequested = 0;

    for (const business of businesses) {
      if (resolveBusinessStatus(business) === "ACTIVE") {
        active += 1;
      } else {
        deleteRequested += 1;
      }
    }

    return {
      active,
      deleteRequested,
      total: businesses.length,
    };
  },
});

export const getUserListStats = query({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const { role } = await getAuthenticatedUser(ctx, args.sessionToken);

    if (!isSuperAdmin(role)) {
      throw new Error("FORBIDDEN");
    }

    const users = await ctx.db.query("users").collect();
    const roles = await ctx.db.query("roles").collect();
    const roleMap = new Map(roles.map((item) => [item._id, item]));

    const userPlans = await ctx.db.query("userPlans").collect();
    const plans = await ctx.db.query("plans").collect();
    const planMap = new Map(plans.map((plan) => [plan._id, plan]));
    const enterprisePlan = plans.find((plan) => plan.name === "Enterprise");

    const activePlanNameByUser = new Map<string, string>();
    for (const userPlan of userPlans) {
      if (userPlan.status !== "ACTIVE") {
        continue;
      }

      const plan = planMap.get(userPlan.planId);
      if (plan) {
        activePlanNameByUser.set(userPlan.userId, plan.name);
      }
    }

    const byStatus = {
      PENDING: 0,
      APPROVED: 0,
      REVOKED: 0,
    };

    const byRole: Record<string, number> = {};
    const byPlan: Record<string, number> = {};

    for (const user of users) {
      byStatus[user.status] += 1;

      const userRole = roleMap.get(user.roleId);
      const roleName = userRole?.name ?? "UNKNOWN";
      byRole[roleName] = (byRole[roleName] ?? 0) + 1;

      if (roleName === "ADMIN" || roleName === "SUPER_ADMIN") {
        const planName =
          roleName === "SUPER_ADMIN"
            ? (activePlanNameByUser.get(user._id) ??
              enterprisePlan?.name ??
              "Enterprise")
            : (activePlanNameByUser.get(user._id) ?? "Default");

        byPlan[planName] = (byPlan[planName] ?? 0) + 1;
      }
    }

    return {
      byStatus,
      total: users.length,
      byRole,
      byPlan,
    };
  },
});
