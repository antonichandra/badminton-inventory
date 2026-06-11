import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

const DEFAULT_MAX_BUSINESS = 1;
const DEFAULT_MAX_STAFF = 5;

export async function getActivePlanForUser(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<{
  plan: Doc<"plans"> | null;
  maxBusiness: number;
  maxStaff: number;
}> {
  const activeUserPlan = await ctx.db
    .query("userPlans")
    .withIndex("by_userId_status", (q) =>
      q.eq("userId", userId).eq("status", "ACTIVE"),
    )
    .first();

  if (!activeUserPlan) {
    return {
      plan: null,
      maxBusiness: DEFAULT_MAX_BUSINESS,
      maxStaff: DEFAULT_MAX_STAFF,
    };
  }

  const plan = await ctx.db.get(activeUserPlan.planId);
  if (!plan || !plan.isActive) {
    return {
      plan: null,
      maxBusiness: DEFAULT_MAX_BUSINESS,
      maxStaff: DEFAULT_MAX_STAFF,
    };
  }

  return {
    plan,
    maxBusiness: plan.maxBusiness,
    maxStaff: plan.maxStaff,
  };
}

export async function countOwnedBusinesses(
  ctx: QueryCtx | MutationCtx,
  ownerId: Id<"users">,
): Promise<number> {
  const businesses = await ctx.db
    .query("businesses")
    .withIndex("by_ownerId", (q) => q.eq("ownerId", ownerId))
    .collect();

  return businesses.filter((business) => business.isActive).length;
}

export async function countStaffForOwner(
  ctx: QueryCtx | MutationCtx,
  ownerId: Id<"users">,
): Promise<number> {
  const businesses = await ctx.db
    .query("businesses")
    .withIndex("by_ownerId", (q) => q.eq("ownerId", ownerId))
    .collect();

  const businessIds = new Set(
    businesses
      .filter((business) => business.isActive)
      .map((business) => business._id),
  );

  if (businessIds.size === 0) {
    return 0;
  }

  const invitations = await ctx.db.query("staffInvitations").collect();
  const staffEmails = new Set<string>();

  for (const invitation of invitations) {
    if (!businessIds.has(invitation.businessId)) {
      continue;
    }

    // Count every invitation record regardless of status (PENDING, APPROVED,
    // REVOKED, etc.) until it is permanently deleted from the database.
    staffEmails.add(invitation.email.trim().toLowerCase());
  }

  return staffEmails.size;
}

export async function assignActivePlanToUser(
  ctx: MutationCtx,
  userId: Id<"users">,
  planId: Id<"plans">,
  assignedBy?: Id<"users">,
) {
  const now = Date.now();
  const activePlans = await ctx.db
    .query("userPlans")
    .withIndex("by_userId_status", (q) =>
      q.eq("userId", userId).eq("status", "ACTIVE"),
    )
    .collect();

  for (const activePlan of activePlans) {
    await ctx.db.patch(activePlan._id, {
      status: "INACTIVE",
      updatedAt: now,
    });
  }

  await ctx.db.insert("userPlans", {
    userId,
    planId,
    assignedBy,
    status: "ACTIVE",
    createdAt: now,
    updatedAt: now,
  });
}

export async function ensureSuperAdminPlan(ctx: MutationCtx, userId: Id<"users">) {
  const enterprisePlan = await ctx.db
    .query("plans")
    .withIndex("by_name", (q) => q.eq("name", "Enterprise"))
    .unique();

  if (!enterprisePlan) {
    return;
  }

  const activeUserPlan = await ctx.db
    .query("userPlans")
    .withIndex("by_userId_status", (q) =>
      q.eq("userId", userId).eq("status", "ACTIVE"),
    )
    .first();

  if (activeUserPlan?.planId === enterprisePlan._id) {
    return;
  }

  await assignActivePlanToUser(ctx, userId, enterprisePlan._id);
}
