import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getRoleById } from "./lib/authHelpers";
import {
  assertAcl,
  getAuthenticatedUser,
  isSuperAdmin,
} from "./lib/rbac";
import { assignActivePlanToUser } from "./lib/planHelpers";

export const DEFAULT_PLANS = [
  {
    name: "Starter",
    maxBusiness: 1,
    maxStaff: 5,
  },
  {
    name: "Growth",
    maxBusiness: 3,
    maxStaff: 15,
  },
  {
    name: "Enterprise",
    maxBusiness: 10,
    maxStaff: 50,
  },
] as const;

export const seedPlans = mutation({
  args: {},
  handler: async (ctx) => {
    const results: string[] = [];
    const now = Date.now();

    for (const plan of DEFAULT_PLANS) {
      const existing = await ctx.db
        .query("plans")
        .withIndex("by_name", (q) => q.eq("name", plan.name))
        .unique();

      if (!existing) {
        await ctx.db.insert("plans", {
          name: plan.name,
          maxBusiness: plan.maxBusiness,
          maxStaff: plan.maxStaff,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });
        results.push(`Created plan: ${plan.name}`);
      } else {
        await ctx.db.patch(existing._id, {
          maxBusiness: plan.maxBusiness,
          maxStaff: plan.maxStaff,
          isActive: true,
          updatedAt: now,
        });
        results.push(`Synced plan: ${plan.name}`);
      }
    }

    return results;
  },
});

export const listPlans = query({
  args: {},
  handler: async (ctx) => {
    const plans = await ctx.db.query("plans").collect();
    return plans
      .filter((plan) => plan.isActive)
      .map((plan) => ({
        value: plan._id,
        label: plan.name,
        planName: plan.name,
        maxBusiness: plan.maxBusiness,
        maxStaff: plan.maxStaff,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  },
});

export const assignPlanToUser = mutation({
  args: {
    sessionToken: v.string(),
    userId: v.id("users"),
    planId: v.id("plans"),
  },
  handler: async (ctx, args) => {
    const { user, role } = await getAuthenticatedUser(ctx, args.sessionToken);
    assertAcl(role, "master_plan");

    const plan = await ctx.db.get(args.planId);
    if (!plan || !plan.isActive) {
      throw new Error("PLAN_NOT_FOUND");
    }

    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) {
      throw new Error("USER_NOT_FOUND");
    }

    const targetRole = await getRoleById(ctx, targetUser.roleId);
    if (targetRole?.name !== "ADMIN") {
      throw new Error("PLAN_ONLY_FOR_ADMIN");
    }

    await assignActivePlanToUser(ctx, args.userId, args.planId, user._id);

    return { success: true };
  },
});

export const getUserPlanSummary = query({
  args: {
    sessionToken: v.string(),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const { user, role } = await getAuthenticatedUser(ctx, args.sessionToken);
    const targetUserId =
      args.userId && isSuperAdmin(role) ? args.userId : user._id;

    const activeUserPlan = await ctx.db
      .query("userPlans")
      .withIndex("by_userId_status", (q) =>
        q.eq("userId", targetUserId).eq("status", "ACTIVE"),
      )
      .first();

    if (!activeUserPlan) {
      return null;
    }

    const plan = await ctx.db.get(activeUserPlan.planId);
    if (!plan) {
      return null;
    }

    return {
      planId: plan._id,
      planName: plan.name,
      maxBusiness: plan.maxBusiness,
      maxStaff: plan.maxStaff,
    };
  },
});
