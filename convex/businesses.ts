import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  isBusinessOperational,
  resolveBusinessStatus,
} from "./lib/businessHelpers";
import {
  assertAcl,
  canManageAllBusinesses,
  canManageOwnBusinesses,
  getAuthenticatedUser,
  isSuperAdmin,
} from "./lib/rbac";
import {
  countOwnedBusinesses,
  countStaffForOwner,
  getActivePlanForUser,
} from "./lib/planHelpers";
import {
  getAccessibleBusinesses,
  resolveActiveBusinessId,
} from "./lib/businessContext";

async function getBusinessOrThrow(
  ctx: Parameters<typeof getAuthenticatedUser>[0],
  businessId: Id<"businesses">,
) {
  const business = await ctx.db.get(businessId);
  if (!business) {
    throw new Error("BUSINESS_NOT_FOUND");
  }
  return business;
}

async function assertCanAccessBusiness(
  ctx: Parameters<typeof getAuthenticatedUser>[0],
  sessionToken: string,
  businessId: Id<"businesses">,
) {
  const { user, role } = await getAuthenticatedUser(ctx, sessionToken);
  const business = await getBusinessOrThrow(ctx, businessId);

  if (canManageAllBusinesses(role)) {
    return { user, role, business };
  }

  if (business.ownerId === user._id && canManageOwnBusinesses(role)) {
    return { user, role, business };
  }

  throw new Error("FORBIDDEN");
}

async function getOwnedBusinesses(
  ctx: Parameters<typeof getAuthenticatedUser>[0],
  ownerId: Id<"users">,
) {
  const businesses = await ctx.db
    .query("businesses")
    .withIndex("by_ownerId", (q) => q.eq("ownerId", ownerId))
    .collect();

  return businesses
    .filter((business) => isBusinessOperational(business))
    .sort((a, b) => a.createdAt - b.createdAt);
}

async function resolveDefaultBusinessId(
  ctx: Parameters<typeof getAuthenticatedUser>[0],
  user: Doc<"users">,
): Promise<Id<"businesses"> | null> {
  const owned = await getOwnedBusinesses(ctx, user._id);
  if (owned.length === 0) {
    return null;
  }

  if (
    user.defaultBusinessId &&
    owned.some((business) => business._id === user.defaultBusinessId)
  ) {
    return user.defaultBusinessId;
  }

  return owned[0]._id;
}

function mapBusinessRow(
  business: Doc<"businesses">,
  sportMap: Map<Id<"sports">, Doc<"sports">>,
  ownerMap: Map<Id<"users">, Doc<"users">>,
  defaultBusinessId: Id<"businesses"> | null,
) {
  const sport = sportMap.get(business.sportId);
  const owner = ownerMap.get(business.ownerId);

  return {
    _id: business._id,
    name: business.name,
    sportId: business.sportId,
    sportSlug: sport?.slug ?? "",
    sportName: sport?.name ?? "—",
    phone: business.phone,
    address: business.address,
    ownerId: business.ownerId,
    ownerName: owner?.name ?? "—",
    ownerEmail: owner?.email ?? "—",
    status: resolveBusinessStatus(business),
    isActive: business.isActive,
    isDefault: defaultBusinessId === business._id,
    createdAt: business.createdAt,
    updatedAt: business.updatedAt,
  };
}

export const listBusinessOptions = query({
  args: {
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let businesses = await ctx.db.query("businesses").collect();

    if (args.sessionToken) {
      const { user, role } = await getAuthenticatedUser(ctx, args.sessionToken);
      if (!canManageAllBusinesses(role)) {
        businesses = businesses.filter(
          (business) => business.isActive && business.ownerId === user._id,
        );
      }
    }

    const users = await ctx.db.query("users").collect();
    const ownerMap = new Map(users.map((owner) => [owner._id, owner]));

    return businesses
      .filter((business) => business.isActive)
      .map((business) => {
        const owner = ownerMap.get(business.ownerId);
        return {
          value: business._id,
          label: business.name,
          description: owner
            ? `${owner.name} · ${owner.email}`
            : undefined,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  },
});

export const getSwitcherContext = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    try {
      const { user, role } = await getAuthenticatedUser(ctx, args.sessionToken);
      const accessible = await getAccessibleBusinesses(ctx, user, role);
      if (accessible.length === 0) {
        return {
          businesses: [],
          activeBusinessId: null,
          defaultBusinessId: null,
        };
      }

      const defaultBusinessId =
        canManageOwnBusinesses(role) || isSuperAdmin(role)
          ? await resolveDefaultBusinessId(ctx, user)
          : user.defaultBusinessId &&
              accessible.some(
                (business) => business._id === user.defaultBusinessId,
              )
            ? user.defaultBusinessId
            : accessible[0]._id;

      const activeBusinessId = await resolveActiveBusinessId(ctx, user, role);

      return {
        businesses: accessible.map((business) => ({
          _id: business._id,
          name: business.name,
          isDefault: business._id === defaultBusinessId,
        })),
        activeBusinessId,
        defaultBusinessId,
      };
    } catch (error) {
      console.error("getSwitcherContext failed:", error);
      return {
        businesses: [],
        activeBusinessId: null,
        defaultBusinessId: null,
      };
    }
  },
});

export const getQuotaSummary = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const { user, role } = await getAuthenticatedUser(ctx, args.sessionToken);

    if (isSuperAdmin(role)) {
      return {
        showQuota: false,
        businessCount: 0,
        maxBusiness: 0,
        staffCount: 0,
        maxStaff: 0,
        planName: null as string | null,
      };
    }

    const planLimits = await getActivePlanForUser(ctx, user._id);
    const businessCount = await countOwnedBusinesses(ctx, user._id);
    const staffCount = await countStaffForOwner(ctx, user._id);

    return {
      showQuota: true,
      businessCount,
      maxBusiness: planLimits.maxBusiness,
      staffCount,
      maxStaff: planLimits.maxStaff,
      planName: planLimits.plan?.name ?? null,
    };
  },
});

export const listBusinesses = query({
  args: {
    sessionToken: v.string(),
    search: v.optional(v.string()),
    ownerSearch: v.optional(v.string()),
    sportIds: v.optional(v.array(v.id("sports"))),
    statuses: v.optional(
      v.array(v.union(v.literal("ACTIVE"), v.literal("DELETE_REQUESTED"))),
    ),
  },
  handler: async (ctx, args) => {
    const { user, role } = await getAuthenticatedUser(ctx, args.sessionToken);

    if (!canManageOwnBusinesses(role) && !canManageAllBusinesses(role)) {
      throw new Error("FORBIDDEN");
    }

    let businesses = await ctx.db.query("businesses").collect();

    if (!canManageAllBusinesses(role)) {
      businesses = businesses.filter((business) => business.ownerId === user._id);
    }

    const defaultBusinessId = canManageAllBusinesses(role)
      ? null
      : await resolveDefaultBusinessId(ctx, user);

    const sports = await ctx.db.query("sports").collect();
    const users = await ctx.db.query("users").collect();
    const sportMap = new Map(sports.map((sport) => [sport._id, sport]));
    const ownerMap = new Map(users.map((owner) => [owner._id, owner]));

    const searchTerm = args.search?.trim().toLowerCase() ?? "";
    const ownerSearchTerm = args.ownerSearch?.trim().toLowerCase() ?? "";
    const sportFilter = args.sportIds ?? [];
    const statusFilter = args.statuses ?? [];

    const filtered = businesses.filter((business) => {
      if (!business.isActive && !canManageAllBusinesses(role)) {
        return false;
      }

      if (searchTerm && !business.name.toLowerCase().includes(searchTerm)) {
        return false;
      }

      if (sportFilter.length > 0 && !sportFilter.includes(business.sportId)) {
        return false;
      }

      if (ownerSearchTerm) {
        const owner = ownerMap.get(business.ownerId);
        const ownerText = `${owner?.name ?? ""} ${owner?.email ?? ""}`.toLowerCase();
        if (!ownerText.includes(ownerSearchTerm)) {
          return false;
        }
      }

      if (statusFilter.length > 0) {
        const status = resolveBusinessStatus(business);
        if (!statusFilter.includes(status)) {
          return false;
        }
      }

      return true;
    });

    return filtered
      .map((business) =>
        mapBusinessRow(business, sportMap, ownerMap, defaultBusinessId),
      )
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const getBusiness = query({
  args: {
    sessionToken: v.string(),
    businessId: v.id("businesses"),
  },
  handler: async (ctx, args) => {
    const { user, business } = await assertCanAccessBusiness(
      ctx,
      args.sessionToken,
      args.businessId,
    );

    const sport = await ctx.db.get(business.sportId);
    const owner = await ctx.db.get(business.ownerId);
    const defaultBusinessId = await resolveDefaultBusinessId(ctx, user);

  return {
    _id: business._id,
    name: business.name,
    sportId: business.sportId,
    sportSlug: sport?.slug ?? "",
    sportName: sport?.name ?? "—",
    phone: business.phone,
      address: business.address,
      ownerId: business.ownerId,
      ownerName: owner?.name ?? "—",
      ownerEmail: owner?.email ?? "—",
      status: resolveBusinessStatus(business),
      isActive: business.isActive,
      isDefault: defaultBusinessId === business._id,
      createdAt: business.createdAt,
      updatedAt: business.updatedAt,
    };
  },
});

export const createBusiness = mutation({
  args: {
    sessionToken: v.string(),
    name: v.string(),
    sportId: v.id("sports"),
    phone: v.optional(v.string()),
    address: v.string(),
  },
  handler: async (ctx, args) => {
    const { user, role } = await getAuthenticatedUser(ctx, args.sessionToken);
    assertAcl(role, "business");

    const name = args.name.trim();
    const address = args.address.trim();
    if (!name || !address) {
      throw new Error("INVALID_INPUT");
    }

    const sport = await ctx.db.get(args.sportId);
    if (!sport || !sport.isActive) {
      throw new Error("SPORT_NOT_FOUND");
    }

    const ownerId = user._id;
    const planLimits = await getActivePlanForUser(ctx, ownerId);
    const currentBusinessCount = await countOwnedBusinesses(ctx, ownerId);

    if (currentBusinessCount >= planLimits.maxBusiness) {
      throw new Error("BUSINESS_LIMIT_REACHED");
    }

    const now = Date.now();
    const businessId = await ctx.db.insert("businesses", {
      name,
      sportId: args.sportId,
      phone: args.phone?.trim() || undefined,
      address,
      ownerId,
      status: "ACTIVE",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    const existingMembership = await ctx.db
      .query("businessMembers")
      .withIndex("by_business_and_user", (q) =>
        q.eq("businessId", businessId).eq("userId", ownerId),
      )
      .unique();

    if (!existingMembership) {
      await ctx.db.insert("businessMembers", {
        businessId,
        userId: ownerId,
        role: "OWNER",
        createdAt: now,
      });
    }

    // Only the first business becomes default/active — never override on later creates.
    if (currentBusinessCount === 0) {
      await ctx.db.patch(user._id, {
        defaultBusinessId: businessId,
        activeBusinessId: businessId,
        updatedAt: now,
      });
    }

    return { businessId };
  },
});

export const updateBusiness = mutation({
  args: {
    sessionToken: v.string(),
    businessId: v.id("businesses"),
    name: v.string(),
    sportId: v.id("sports"),
    phone: v.optional(v.string()),
    address: v.string(),
  },
  handler: async (ctx, args) => {
    const { business } = await assertCanAccessBusiness(
      ctx,
      args.sessionToken,
      args.businessId,
    );

    if (!isBusinessOperational(business)) {
      throw new Error("BUSINESS_NOT_EDITABLE");
    }

    const name = args.name.trim();
    const address = args.address.trim();
    if (!name || !address) {
      throw new Error("INVALID_INPUT");
    }

    const sport = await ctx.db.get(args.sportId);
    if (!sport || !sport.isActive) {
      throw new Error("SPORT_NOT_FOUND");
    }

    await ctx.db.patch(args.businessId, {
      name,
      sportId: args.sportId,
      phone: args.phone?.trim() || undefined,
      address,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

export const setActiveBusiness = mutation({
  args: {
    sessionToken: v.string(),
    businessId: v.id("businesses"),
  },
  handler: async (ctx, args) => {
    const { user, role } = await getAuthenticatedUser(ctx, args.sessionToken);
    const accessible = await getAccessibleBusinesses(ctx, user, role);
    const business = accessible.find((item) => item._id === args.businessId);

    if (!business) {
      throw new Error("FORBIDDEN");
    }

    if (!isBusinessOperational(business)) {
      throw new Error("BUSINESS_NOT_ACTIVE");
    }

    await ctx.db.patch(user._id, {
      activeBusinessId: business._id,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

export const setDefaultBusiness = mutation({
  args: {
    sessionToken: v.string(),
    businessId: v.id("businesses"),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx, args.sessionToken);
    const business = await getBusinessOrThrow(ctx, args.businessId);

    if (business.ownerId !== user._id) {
      throw new Error("FORBIDDEN");
    }

    if (!isBusinessOperational(business)) {
      throw new Error("BUSINESS_NOT_ACTIVE");
    }

    const now = Date.now();
    await ctx.db.patch(user._id, {
      defaultBusinessId: args.businessId,
      activeBusinessId: args.businessId,
      updatedAt: now,
    });

    return { success: true };
  },
});

export const requestBusinessDeletion = mutation({
  args: {
    sessionToken: v.string(),
    businessId: v.id("businesses"),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx, args.sessionToken);
    const business = await getBusinessOrThrow(ctx, args.businessId);

    if (business.ownerId !== user._id) {
      throw new Error("FORBIDDEN");
    }

    if (!isBusinessOperational(business)) {
      throw new Error("BUSINESS_ALREADY_REQUESTED");
    }

    const now = Date.now();
    await ctx.db.patch(business._id, {
      status: "DELETE_REQUESTED",
      updatedAt: now,
    });

    const owned = await getOwnedBusinesses(ctx, user._id);
    const remaining = owned.filter(
      (item) => item._id !== business._id && isBusinessOperational(item),
    );

    const userUpdates: {
      defaultBusinessId?: Id<"businesses">;
      activeBusinessId?: Id<"businesses">;
      updatedAt: number;
    } = { updatedAt: now };

    if (user.defaultBusinessId === business._id) {
      userUpdates.defaultBusinessId = remaining[0]?._id;
    }
    if (user.activeBusinessId === business._id) {
      userUpdates.activeBusinessId = remaining[0]?._id;
    }

    await ctx.db.patch(user._id, userUpdates);

    return { success: true };
  },
});

export const cancelBusinessDeletion = mutation({
  args: {
    sessionToken: v.string(),
    businessId: v.id("businesses"),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx, args.sessionToken);
    const business = await getBusinessOrThrow(ctx, args.businessId);

    if (business.ownerId !== user._id) {
      throw new Error("FORBIDDEN");
    }

    if (resolveBusinessStatus(business) !== "DELETE_REQUESTED") {
      throw new Error("BUSINESS_NOT_PENDING_DELETE");
    }

    await ctx.db.patch(business._id, {
      status: "ACTIVE",
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

export const approveBusinessDeletion = mutation({
  args: {
    sessionToken: v.string(),
    businessId: v.id("businesses"),
  },
  handler: async (ctx, args) => {
    const { role } = await getAuthenticatedUser(ctx, args.sessionToken);
    if (!canManageAllBusinesses(role)) {
      throw new Error("FORBIDDEN");
    }

    const business = await getBusinessOrThrow(ctx, args.businessId);
    if (resolveBusinessStatus(business) !== "DELETE_REQUESTED") {
      throw new Error("BUSINESS_NOT_PENDING_DELETE");
    }

    const now = Date.now();
    const owner = await ctx.db.get(business.ownerId);

    const memberships = await ctx.db
      .query("businessMembers")
      .withIndex("by_businessId", (q) => q.eq("businessId", business._id))
      .collect();

    for (const membership of memberships) {
      await ctx.db.delete(membership._id);
    }

    const invitations = await ctx.db
      .query("staffInvitations")
      .withIndex("by_businessId", (q) => q.eq("businessId", business._id))
      .collect();

    for (const invitation of invitations) {
      await ctx.db.delete(invitation._id);
    }

    await ctx.db.patch(business._id, {
      isActive: false,
      status: "DELETE_REQUESTED",
      updatedAt: now,
    });

    if (owner) {
      const owned = await getOwnedBusinesses(ctx, owner._id);
      const userUpdates: {
        defaultBusinessId?: Id<"businesses">;
        activeBusinessId?: Id<"businesses">;
        updatedAt: number;
      } = { updatedAt: now };

      if (owner.defaultBusinessId === business._id) {
        userUpdates.defaultBusinessId = owned[0]?._id;
      }
      if (owner.activeBusinessId === business._id) {
        userUpdates.activeBusinessId = owned[0]?._id;
      }

      await ctx.db.patch(owner._id, userUpdates);
    }

    return { success: true };
  },
});
