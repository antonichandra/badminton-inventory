import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const userStatus = v.union(
  v.literal("PENDING"),
  v.literal("APPROVED"),
  v.literal("REVOKED"),
);

export const themePreference = v.union(
  v.literal("light"),
  v.literal("dark"),
);

export const languagePreference = v.union(
  v.literal("ID"),
  v.literal("EN"),
);

export const businessMemberRole = v.union(
  v.literal("OWNER"),
  v.literal("STAFF"),
);

export const userPlanStatus = v.union(
  v.literal("ACTIVE"),
  v.literal("INACTIVE"),
);

export const staffInvitationStatus = v.union(
  v.literal("PENDING"),
  v.literal("ACCEPTED"),
  v.literal("EXPIRED"),
  v.literal("REVOKED"),
);

export const businessStatus = v.union(
  v.literal("ACTIVE"),
  v.literal("DELETE_REQUESTED"),
);

export default defineSchema({
  roles: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    acl: v.array(v.string()),
    isSystem: v.boolean(),
  }).index("by_name", ["name"]),

  users: defineTable({
    email: v.string(),
    name: v.string(),
    picture: v.optional(v.string()),
    googleId: v.string(),
    status: userStatus,
    roleId: v.id("roles"),
    theme: themePreference,
    language: languagePreference,
    defaultBusinessId: v.optional(v.id("businesses")),
    activeBusinessId: v.optional(v.id("businesses")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_googleId", ["googleId"])
    .index("by_roleId", ["roleId"]),

  plans: defineTable({
    name: v.string(),
    maxBusiness: v.number(),
    maxStaff: v.number(),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_name", ["name"]),

  userPlans: defineTable({
    userId: v.id("users"),
    planId: v.id("plans"),
    assignedBy: v.optional(v.id("users")),
    status: userPlanStatus,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_status", ["userId", "status"]),

  sports: defineTable({
    name: v.string(),
    slug: v.string(),
    isActive: v.boolean(),
    createdAt: v.number(),
  }).index("by_slug", ["slug"]),

  businesses: defineTable({
    name: v.string(),
    sportId: v.id("sports"),
    phone: v.optional(v.string()),
    address: v.string(),
    ownerId: v.id("users"),
    status: v.optional(businessStatus),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_name", ["name"])
    .index("by_ownerId", ["ownerId"])
    .index("by_sportId", ["sportId"])
    .index("by_status", ["status"]),

  businessMembers: defineTable({
    businessId: v.id("businesses"),
    userId: v.id("users"),
    role: businessMemberRole,
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_businessId", ["businessId"])
    .index("by_business_and_user", ["businessId", "userId"]),

  staffInvitations: defineTable({
    businessId: v.id("businesses"),
    email: v.string(),
    token: v.string(),
    status: staffInvitationStatus,
    invitedBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_businessId", ["businessId"])
    .index("by_email", ["email"])
    .index("by_token", ["token"])
    .index("by_business_and_email", ["businessId", "email"]),

  sessions: defineTable({
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_userId", ["userId"]),
});
