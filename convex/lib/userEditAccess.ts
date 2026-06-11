import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

const EDITABLE_TARGET_ROLES = {
  SUPER_ADMIN: ["STAFF", "ADMIN"] as const,
  ADMIN: ["STAFF"] as const,
} as const;

export function getEditableTargetRoleNames(
  callerRoleName: string,
): readonly string[] {
  if (callerRoleName === "SUPER_ADMIN") {
    return EDITABLE_TARGET_ROLES.SUPER_ADMIN;
  }
  if (callerRoleName === "ADMIN") {
    return EDITABLE_TARGET_ROLES.ADMIN;
  }
  return [];
}

export function canCallerEditTargetUser(
  callerRoleName: string,
  targetRoleName: string,
  callerUserId: Id<"users">,
  targetUserId: Id<"users">,
): boolean {
  if (callerUserId === targetUserId) {
    return false;
  }

  return getEditableTargetRoleNames(callerRoleName).includes(targetRoleName);
}

export function getAssignableRoleNames(
  callerRoleName: string,
  targetRoleName: string,
): string[] {
  if (callerRoleName === "SUPER_ADMIN") {
    if (targetRoleName === "ADMIN" || targetRoleName === "STAFF") {
      return ["ADMIN", "STAFF"];
    }
    return [];
  }

  if (callerRoleName === "ADMIN" && targetRoleName === "STAFF") {
    return ["STAFF"];
  }

  return [];
}

export async function isUserLinkedToBusinesses(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  businessIds: Set<Id<"businesses">>,
): Promise<boolean> {
  const memberships = await ctx.db
    .query("businessMembers")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();

  if (memberships.some((membership) => businessIds.has(membership.businessId))) {
    return true;
  }

  const user = await ctx.db.get(userId);
  if (!user) {
    return false;
  }

  const invitations = await ctx.db
    .query("staffInvitations")
    .withIndex("by_email", (q) => q.eq("email", user.email.trim().toLowerCase()))
    .collect();

  return invitations.some(
    (invitation) =>
      businessIds.has(invitation.businessId) &&
      (invitation.status === "PENDING" || invitation.status === "ACCEPTED"),
  );
}

export async function assertCanEditTargetUser(
  ctx: QueryCtx | MutationCtx,
  access: {
    user: Doc<"users">;
    role: Doc<"roles">;
    isSuperAdmin: boolean;
    ownedBusinessIds: Id<"businesses">[] | null;
  },
  targetUser: Doc<"users">,
  targetRole: Doc<"roles">,
) {
  if (access.user._id === targetUser._id) {
    throw new Error("CANNOT_EDIT_SELF");
  }

  if (
    !canCallerEditTargetUser(
      access.role.name,
      targetRole.name,
      access.user._id,
      targetUser._id,
    )
  ) {
    throw new Error("FORBIDDEN");
  }

  if (!access.isSuperAdmin) {
    const businessIds = new Set(access.ownedBusinessIds ?? []);
    const inScope = await isUserLinkedToBusinesses(
      ctx,
      targetUser._id,
      businessIds,
    );

    if (!inScope) {
      throw new Error("TARGET_OUT_OF_SCOPE");
    }
  }
}
