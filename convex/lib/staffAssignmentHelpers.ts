import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

export async function assertStaffNotAssignedElsewhere(
  ctx: MutationCtx | QueryCtx,
  email: string,
  excludeBusinessId?: Id<"businesses">,
) {
  const normalizedEmail = email.trim().toLowerCase();

  const invitations = await ctx.db
    .query("staffInvitations")
    .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
    .collect();

  const conflictingInvitation = invitations.find(
    (invitation) =>
      (invitation.status === "PENDING" || invitation.status === "ACCEPTED") &&
      invitation.businessId !== excludeBusinessId,
  );

  if (conflictingInvitation) {
    throw new Error("STAFF_ALREADY_ASSIGNED");
  }

  const existingUser = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
    .unique();

  if (!existingUser) {
    return;
  }

  const memberships = await ctx.db
    .query("businessMembers")
    .withIndex("by_userId", (q) => q.eq("userId", existingUser._id))
    .collect();

  const staffElsewhere = memberships.some(
    (membership) =>
      membership.role === "STAFF" && membership.businessId !== excludeBusinessId,
  );

  if (staffElsewhere) {
    throw new Error("STAFF_ALREADY_ASSIGNED");
  }
}

export type UserBusinessEntry = {
  businessId: Id<"businesses">;
  businessName: string;
  role: string;
  sportSlug: string;
  sportName: string;
  pendingInvitation: boolean;
};

export function upsertUserBusinessEntry(
  map: Map<Id<"users">, UserBusinessEntry[]>,
  userId: Id<"users">,
  business: Doc<"businesses">,
  sport: Doc<"sports"> | undefined,
  role: string,
  pendingInvitation: boolean,
) {
  const list = map.get(userId) ?? [];
  const existingIndex = list.findIndex(
    (entry) => entry.businessId === business._id,
  );

  const entry: UserBusinessEntry = {
    businessId: business._id,
    businessName: business.name,
    role,
    sportSlug: sport?.slug ?? "unknown",
    sportName: sport?.name ?? "—",
    pendingInvitation,
  };

  if (existingIndex >= 0) {
    if (!pendingInvitation) {
      list[existingIndex] = entry;
    }
  } else {
    list.push(entry);
  }

  map.set(userId, list);
}
