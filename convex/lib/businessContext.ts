import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import {
  canManageAllBusinesses,
  canManageOwnBusinesses,
  getAuthenticatedUser,
  hasAcl,
  isAdmin,
  isSuperAdmin,
} from "./rbac";
import { getBusinessOrThrow, isBusinessOperational } from "./businessHelpers";

async function getMemberBusinesses(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
) {
  const memberships = await ctx.db
    .query("businessMembers")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();

  const businesses: Doc<"businesses">[] = [];
  for (const membership of memberships) {
    const business = await ctx.db.get(membership.businessId);
    if (business && isBusinessOperational(business)) {
      businesses.push(business);
    }
  }

  return businesses.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getAccessibleBusinesses(
  ctx: QueryCtx | MutationCtx,
  user: Doc<"users">,
  role: Doc<"roles">,
) {
  if (canManageAllBusinesses(role)) {
    const businesses = await ctx.db.query("businesses").collect();
    return businesses
      .filter((business) => isBusinessOperational(business))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  if (canManageOwnBusinesses(role)) {
    const owned = await ctx.db
      .query("businesses")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
      .collect();
    return owned
      .filter((business) => isBusinessOperational(business))
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  if (hasAcl(role, "kasir")) {
    return getMemberBusinesses(ctx, user._id);
  }

  return [];
}

export async function resolveActiveBusinessId(
  ctx: QueryCtx | MutationCtx,
  user: Doc<"users">,
  role: Doc<"roles">,
): Promise<Id<"businesses"> | null> {
  const accessible = await getAccessibleBusinesses(ctx, user, role);
  if (accessible.length === 0) {
    return null;
  }

  if (
    user.activeBusinessId &&
    accessible.some((business) => business._id === user.activeBusinessId)
  ) {
    return user.activeBusinessId;
  }

  if (
    user.defaultBusinessId &&
    accessible.some((business) => business._id === user.defaultBusinessId)
  ) {
    return user.defaultBusinessId;
  }

  return accessible[0]._id;
}

export async function assertBusinessAccess(
  ctx: QueryCtx | MutationCtx,
  user: Doc<"users">,
  role: Doc<"roles">,
  businessId: Id<"businesses">,
) {
  const business = await getBusinessOrThrow(ctx, businessId);

  if (
    isSuperAdmin(role) ||
    canManageAllBusinesses(role) ||
    business.ownerId === user._id
  ) {
    return business;
  }

  const membership = await ctx.db
    .query("businessMembers")
    .withIndex("by_business_and_user", (q) =>
      q.eq("businessId", businessId).eq("userId", user._id),
    )
    .first();

  if (!membership) {
    throw new Error("FORBIDDEN");
  }

  return business;
}

export async function resolveScopedBusinessId(
  ctx: QueryCtx | MutationCtx,
  user: Doc<"users">,
  role: Doc<"roles">,
  requestedBusinessId?: Id<"businesses">,
) {
  const accessible = await getAccessibleBusinesses(ctx, user, role);
  const accessibleIds = new Set(accessible.map((business) => business._id));

  if (requestedBusinessId) {
    return accessibleIds.has(requestedBusinessId) ? requestedBusinessId : null;
  }

  return resolveActiveBusinessId(ctx, user, role);
}

export async function getKasirBusinessContext(
  ctx: QueryCtx | MutationCtx,
  sessionToken: string,
) {
  const { user, role } = await getAuthenticatedUser(ctx, sessionToken);
  if (!hasAcl(role, "kasir")) {
    throw new Error("FORBIDDEN");
  }

  const businesses = await getAccessibleBusinesses(ctx, user, role);
  const activeBusinessId = await resolveActiveBusinessId(ctx, user, role);

  return {
    user,
    role,
    businesses,
    activeBusinessId,
  };
}

export async function getMasterBusinessContext(
  ctx: QueryCtx | MutationCtx,
  sessionToken: string,
) {
  const { user, role } = await getAuthenticatedUser(ctx, sessionToken);
  if (!hasAcl(role, "master_produk")) {
    return {
      user,
      role,
      businesses: [] as Doc<"businesses">[],
      activeBusinessId: null,
    };
  }

  const businesses = await getAccessibleBusinesses(ctx, user, role);
  const activeBusinessId = await resolveActiveBusinessId(ctx, user, role);

  return {
    user,
    role,
    businesses,
    activeBusinessId,
  };
}

export async function canManageShift(
  ctx: QueryCtx | MutationCtx,
  user: Doc<"users">,
  role: Doc<"roles">,
  businessId: Id<"businesses">,
): Promise<boolean> {
  if (isSuperAdmin(role)) return true;

  const business = await getBusinessOrThrow(ctx, businessId);
  if (business.ownerId === user._id) return true;

  if (isAdmin(role)) {
    try {
      await assertBusinessAccess(ctx, user, role, businessId);
      return true;
    } catch {
      return false;
    }
  }

  const membership = await ctx.db
    .query("businessMembers")
    .withIndex("by_business_and_user", (q) =>
      q.eq("businessId", businessId).eq("userId", user._id),
    )
    .first();

  return membership?.role === "OWNER";
}

export async function assertCanManageShift(
  ctx: QueryCtx | MutationCtx,
  user: Doc<"users">,
  role: Doc<"roles">,
  businessId: Id<"businesses">,
) {
  const allowed = await canManageShift(ctx, user, role, businessId);
  if (!allowed) {
    throw new Error("FORBIDDEN_SHIFT_MANAGE");
  }
}

export async function requireMasterBusinessContext(
  ctx: QueryCtx | MutationCtx,
  sessionToken: string,
) {
  const context = await getMasterBusinessContext(ctx, sessionToken);

  if (!context.activeBusinessId) {
    throw new Error("NO_ACTIVE_BUSINESS");
  }

  await assertBusinessAccess(
    ctx,
    context.user,
    context.role,
    context.activeBusinessId,
  );

  return {
    ...context,
    activeBusinessId: context.activeBusinessId,
  };
}
