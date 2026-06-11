import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { getRoleById, getUserBySessionToken } from "./lib/authHelpers";
import { getUsersAccessContext } from "./lib/usersAccess";
import {
  upsertUserBusinessEntry,
  type UserBusinessEntry,
} from "./lib/staffAssignmentHelpers";
import {
  assertCanEditTargetUser,
  getAssignableRoleNames,
} from "./lib/userEditAccess";
import {
  deleteStaffUserRecords,
  resendUserAccessFull,
  revokeUserAccessFull,
} from "./lib/staffUserCleanup";

async function assertCanManageUsers(
  ctx: Parameters<typeof getUserBySessionToken>[0],
  sessionToken: string,
) {
  const sessionData = await getUserBySessionToken(ctx, sessionToken);
  if (!sessionData) {
    throw new Error("UNAUTHORIZED");
  }

  const callerRole = await getRoleById(ctx, sessionData.user.roleId);
  const canManageUsers =
    callerRole?.acl.includes("master_akun") === true &&
    sessionData.user.status === "APPROVED";

  if (!canManageUsers) {
    throw new Error("FORBIDDEN");
  }

  return sessionData;
}

export const listRoleOptions = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const access = await getUsersAccessContext(ctx, args.sessionToken);
    const roles = await ctx.db.query("roles").collect();

    const filteredRoles = access.isSuperAdmin
      ? roles
      : roles.filter((role) => role.name === "STAFF");

    return filteredRoles
      .map((role) => ({
        value: role._id,
        label: role.name.replace(/_/g, " "),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  },
});

function getEffectivePlanForFilter(
  roleName: string | undefined,
  activePlan: { planId: Id<"plans">; planName: string } | undefined,
  enterprisePlanId: Id<"plans"> | undefined,
): "default" | Id<"plans"> | null {
  if (roleName !== "ADMIN" && roleName !== "SUPER_ADMIN") {
    return null;
  }

  if (roleName === "SUPER_ADMIN") {
    return activePlan?.planId ?? enterprisePlanId ?? null;
  }

  return activePlan?.planId ?? "default";
}

export const listUsers = query({
  args: {
    sessionToken: v.string(),
    search: v.optional(v.string()),
    roleIds: v.optional(v.array(v.id("roles"))),
    businessIds: v.optional(v.array(v.id("businesses"))),
    sportIds: v.optional(v.array(v.id("sports"))),
    statuses: v.optional(
      v.array(
        v.union(
          v.literal("PENDING"),
          v.literal("APPROVED"),
          v.literal("REVOKED"),
        ),
      ),
    ),
    planFilterKeys: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const access = await getUsersAccessContext(ctx, args.sessionToken);

    const users = await ctx.db.query("users").collect();
    const roles = await ctx.db.query("roles").collect();
    const roleMap = new Map(roles.map((role) => [role._id, role]));

    const memberships = await ctx.db.query("businessMembers").collect();
    const businesses = await ctx.db.query("businesses").collect();
    const businessMap = new Map(businesses.map((business) => [business._id, business]));

    const sports = await ctx.db.query("sports").collect();
    const sportMap = new Map(sports.map((sport) => [sport._id, sport]));

    const userPlans = await ctx.db.query("userPlans").collect();
    const plans = await ctx.db.query("plans").collect();
    const planMap = new Map(plans.map((plan) => [plan._id, plan]));

    const activePlanByUser = new Map<
      Id<"users">,
      { planId: Id<"plans">; planName: string }
    >();
    for (const userPlan of userPlans) {
      if (userPlan.status !== "ACTIVE") continue;
      const plan = planMap.get(userPlan.planId);
      if (!plan) continue;
      activePlanByUser.set(userPlan.userId, {
        planId: plan._id,
        planName: plan.name,
      });
    }

    const ownedBusinessIdSet = access.ownedBusinessIds
      ? new Set(access.ownedBusinessIds)
      : null;

    const membershipsByUser = new Map<Id<"users">, UserBusinessEntry[]>();

    for (const membership of memberships) {
      const business = businessMap.get(membership.businessId);
      if (!business || !business.isActive) continue;

      if (ownedBusinessIdSet && !ownedBusinessIdSet.has(membership.businessId)) {
        continue;
      }

      upsertUserBusinessEntry(
        membershipsByUser,
        membership.userId,
        business,
        sportMap.get(business.sportId),
        membership.role,
        false,
      );
    }

    const usersByEmail = new Map(
      users.map((user) => [user.email.trim().toLowerCase(), user]),
    );
    const invitations = await ctx.db.query("staffInvitations").collect();

    for (const invitation of invitations) {
      if (invitation.status !== "PENDING" && invitation.status !== "ACCEPTED") {
        continue;
      }

      const business = businessMap.get(invitation.businessId);
      if (!business || !business.isActive) continue;

      if (ownedBusinessIdSet && !ownedBusinessIdSet.has(invitation.businessId)) {
        continue;
      }

      const invitedUser = usersByEmail.get(invitation.email.trim().toLowerCase());
      if (!invitedUser) continue;

      const hasMembership = memberships.some(
        (membership) =>
          membership.userId === invitedUser._id &&
          membership.businessId === invitation.businessId,
      );

      upsertUserBusinessEntry(
        membershipsByUser,
        invitedUser._id,
        business,
        sportMap.get(business.sportId),
        "STAFF",
        !hasMembership,
      );
    }

    const enterprisePlan = plans.find((plan) => plan.name === "Enterprise");
    const enterprisePlanId = enterprisePlan?._id;

    const searchTerm = args.search?.trim().toLowerCase() ?? "";
    const roleFilter = args.roleIds ?? [];
    const businessFilter = args.businessIds ?? [];
    const sportFilter = args.sportIds ?? [];
    const statusFilter = args.statuses ?? [];
    const planFilterKeys = access.isSuperAdmin ? (args.planFilterKeys ?? []) : [];

    const filtered = users.filter((user) => {
      const userBusinesses = membershipsByUser.get(user._id) ?? [];
      const role = roleMap.get(user.roleId);

      if (!access.isSuperAdmin) {
        const isLinkedToOwnerBusiness = userBusinesses.some((item) =>
          ownedBusinessIdSet?.has(item.businessId),
        );
        if (!isLinkedToOwnerBusiness) {
          return false;
        }
      }

      if (searchTerm) {
        const matchesSearch =
          user.name.toLowerCase().includes(searchTerm) ||
          user.email.toLowerCase().includes(searchTerm);
        if (!matchesSearch) return false;
      }

      if (roleFilter.length > 0 && !roleFilter.includes(user.roleId)) {
        return false;
      }

      if (businessFilter.length > 0) {
        const hasBusiness = userBusinesses.some((item) =>
          businessFilter.includes(item.businessId),
        );
        if (!hasBusiness) return false;
      }

      if (sportFilter.length > 0) {
        const hasSport = userBusinesses.some((item) => {
          const business = businessMap.get(item.businessId);
          return business ? sportFilter.includes(business.sportId) : false;
        });
        if (!hasSport) return false;
      }

      if (statusFilter.length > 0 && !statusFilter.includes(user.status)) {
        return false;
      }

      if (planFilterKeys.length > 0) {
        const effectivePlan = getEffectivePlanForFilter(
          role?.name,
          activePlanByUser.get(user._id),
          enterprisePlanId,
        );

        if (effectivePlan === null) {
          return false;
        }

        const wantsDefault = planFilterKeys.includes("__default__");
        const selectedPlanIds = planFilterKeys.filter(
          (key) => key !== "__default__",
        ) as Id<"plans">[];

        const matches =
          (wantsDefault && effectivePlan === "default") ||
          (effectivePlan !== "default" &&
            selectedPlanIds.includes(effectivePlan));

        if (!matches) {
          return false;
        }
      }

      return true;
    });

    return filtered
      .map((user) => {
        const role = roleMap.get(user.roleId);
        const userBusinesses = membershipsByUser.get(user._id) ?? [];
        const plan = activePlanByUser.get(user._id);
        const canHavePlan =
          role?.name === "ADMIN" || role?.name === "SUPER_ADMIN";
        const effectivePlanName = canHavePlan
          ? role?.name === "SUPER_ADMIN"
            ? plan?.planName ?? "Enterprise"
            : plan?.planName ?? null
          : null;

        return {
          _id: user._id,
          name: user.name,
          email: user.email,
          picture: user.picture,
          status: user.status,
          roleId: user.roleId,
          roleName: role?.name ?? "—",
          businesses: userBusinesses.sort((a, b) =>
            a.businessName.localeCompare(b.businessName),
          ),
          planId: canHavePlan ? (plan?.planId ?? null) : null,
          planName: effectivePlanName,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const listEditableRoleOptions = query({
  args: {
    sessionToken: v.string(),
    targetUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const access = await getUsersAccessContext(ctx, args.sessionToken);
    const targetUser = await ctx.db.get(args.targetUserId);

    if (!targetUser) {
      throw new Error("USER_NOT_FOUND");
    }

    const targetRole = await getRoleById(ctx, targetUser.roleId);
    if (!targetRole) {
      throw new Error("USER_NOT_FOUND");
    }

    await assertCanEditTargetUser(ctx, access, targetUser, targetRole);

    const assignableNames = getAssignableRoleNames(
      access.role.name,
      targetRole.name,
    );
    const roles = await ctx.db.query("roles").collect();

    return roles
      .filter((role) => assignableNames.includes(role.name))
      .map((role) => ({
        value: role._id,
        label: role.name.replace(/_/g, " "),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  },
});

export const updateUserAccess = mutation({
  args: {
    sessionToken: v.string(),
    userId: v.id("users"),
    status: v.union(
      v.literal("PENDING"),
      v.literal("APPROVED"),
      v.literal("REVOKED"),
    ),
    roleId: v.id("roles"),
  },
  handler: async (ctx, args) => {
    const access = await getUsersAccessContext(ctx, args.sessionToken);
    const targetUser = await ctx.db.get(args.userId);

    if (!targetUser) {
      throw new Error("USER_NOT_FOUND");
    }

    const targetRole = await getRoleById(ctx, targetUser.roleId);
    if (!targetRole) {
      throw new Error("USER_NOT_FOUND");
    }

    await assertCanEditTargetUser(ctx, access, targetUser, targetRole);

    const newRole = await getRoleById(ctx, args.roleId);
    if (!newRole) {
      throw new Error("INVALID_ROLE");
    }

    const assignableNames = getAssignableRoleNames(
      access.role.name,
      targetRole.name,
    );

    if (!assignableNames.includes(newRole.name)) {
      throw new Error("INVALID_ROLE");
    }

    const now = Date.now();
    await ctx.db.patch(targetUser._id, {
      status: args.status,
      roleId: args.roleId,
      updatedAt: now,
    });

    return {
      userId: targetUser._id,
      email: targetUser.email,
      name: targetUser.name,
      status: args.status,
      roleName: newRole.name,
    };
  },
});

export const revokeUser = mutation({
  args: {
    sessionToken: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const access = await getUsersAccessContext(ctx, args.sessionToken);
    const targetUser = await ctx.db.get(args.userId);

    if (!targetUser) {
      throw new Error("USER_NOT_FOUND");
    }

    const targetRole = await getRoleById(ctx, targetUser.roleId);
    if (!targetRole) {
      throw new Error("USER_NOT_FOUND");
    }

    await assertCanEditTargetUser(ctx, access, targetUser, targetRole);

    if (targetUser.status !== "PENDING" && targetUser.status !== "APPROVED") {
      throw new Error("USER_NOT_REVOKABLE");
    }

    await revokeUserAccessFull(ctx, targetUser);

    return { success: true };
  },
});

export const resendUser = mutation({
  args: {
    sessionToken: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const access = await getUsersAccessContext(ctx, args.sessionToken);
    const targetUser = await ctx.db.get(args.userId);

    if (!targetUser) {
      throw new Error("USER_NOT_FOUND");
    }

    const targetRole = await getRoleById(ctx, targetUser.roleId);
    if (!targetRole) {
      throw new Error("USER_NOT_FOUND");
    }

    await assertCanEditTargetUser(ctx, access, targetUser, targetRole);

    if (targetUser.status !== "REVOKED") {
      throw new Error("USER_NOT_RESENDABLE");
    }

    await resendUserAccessFull(ctx, targetUser, access.user._id);

    return { success: true };
  },
});

export const deleteUser = mutation({
  args: {
    sessionToken: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const access = await getUsersAccessContext(ctx, args.sessionToken);
    const targetUser = await ctx.db.get(args.userId);

    if (!targetUser) {
      throw new Error("USER_NOT_FOUND");
    }

    const targetRole = await getRoleById(ctx, targetUser.roleId);
    if (!targetRole) {
      throw new Error("USER_NOT_FOUND");
    }

    await assertCanEditTargetUser(ctx, access, targetUser, targetRole);

    if (targetUser.status !== "REVOKED") {
      throw new Error("USER_NOT_DELETABLE");
    }

    if (access.user._id === targetUser._id) {
      throw new Error("CANNOT_DELETE_SELF");
    }

    if (targetRole.name !== "STAFF") {
      throw new Error("CANNOT_DELETE_NON_STAFF");
    }

    await deleteStaffUserRecords(ctx, targetUser.email);

    return { success: true };
  },
});

export const approvePendingAdmin = mutation({
  args: {
    sessionToken: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const sessionData = await assertCanManageUsers(ctx, args.sessionToken);
    const callerRole = await getRoleById(ctx, sessionData.user.roleId);

    if (!callerRole || callerRole.name !== "SUPER_ADMIN") {
      throw new Error("FORBIDDEN");
    }

    if (args.userId === sessionData.user._id) {
      throw new Error("CANNOT_APPROVE_SELF");
    }

    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) {
      throw new Error("USER_NOT_FOUND");
    }

    if (targetUser.status !== "PENDING") {
      throw new Error("USER_NOT_PENDING");
    }

    const targetRole = await getRoleById(ctx, targetUser.roleId);
    if (!targetRole || targetRole.name !== "ADMIN") {
      throw new Error("USER_NOT_ADMIN");
    }

    const now = Date.now();
    await ctx.db.patch(targetUser._id, {
      status: "APPROVED",
      updatedAt: now,
    });

    return {
      userId: targetUser._id,
      email: targetUser.email,
      name: targetUser.name,
      status: "APPROVED" as const,
    };
  },
});
