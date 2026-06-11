import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { getUserByEmail } from "./authHelpers";
import { getInvitationsByEmail } from "./staffInvitationHelpers";

function generateInvitationToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function removeStaffFromBusiness(
  ctx: MutationCtx,
  businessId: Id<"businesses">,
  staffUser: Doc<"users">,
) {
  const membership = await ctx.db
    .query("businessMembers")
    .withIndex("by_business_and_user", (q) =>
      q.eq("businessId", businessId).eq("userId", staffUser._id),
    )
    .unique();

  if (membership) {
    await ctx.db.delete(membership._id);
  }
}

export async function revokeStaffUserAccess(
  ctx: MutationCtx,
  staffUser: Doc<"users">,
  businessId: Id<"businesses">,
) {
  await removeStaffFromBusiness(ctx, businessId, staffUser);

  const sessions = await ctx.db
    .query("sessions")
    .withIndex("by_userId", (q) => q.eq("userId", staffUser._id))
    .collect();

  for (const session of sessions) {
    await ctx.db.delete(session._id);
  }

  await ctx.db.patch(staffUser._id, {
    status: "REVOKED",
    updatedAt: Date.now(),
  });
}

export async function deleteStaffUserRecords(
  ctx: MutationCtx,
  email: string,
): Promise<Doc<"users"> | null> {
  const staffUser = await getUserByEmail(ctx, email);
  if (!staffUser) {
    return null;
  }

  const sessions = await ctx.db
    .query("sessions")
    .withIndex("by_userId", (q) => q.eq("userId", staffUser._id))
    .collect();
  for (const session of sessions) {
    await ctx.db.delete(session._id);
  }

  const memberships = await ctx.db
    .query("businessMembers")
    .withIndex("by_userId", (q) => q.eq("userId", staffUser._id))
    .collect();
  for (const membership of memberships) {
    await ctx.db.delete(membership._id);
  }

  const userPlans = await ctx.db
    .query("userPlans")
    .withIndex("by_userId", (q) => q.eq("userId", staffUser._id))
    .collect();
  for (const userPlan of userPlans) {
    await ctx.db.delete(userPlan._id);
  }

  const invitations = await getInvitationsByEmail(ctx, email);
  for (const invitation of invitations) {
    await ctx.db.delete(invitation._id);
  }

  await ctx.db.delete(staffUser._id);

  return staffUser;
}

export async function revokeUserAccessFull(
  ctx: MutationCtx,
  targetUser: Doc<"users">,
) {
  const now = Date.now();

  const sessions = await ctx.db
    .query("sessions")
    .withIndex("by_userId", (q) => q.eq("userId", targetUser._id))
    .collect();
  for (const session of sessions) {
    await ctx.db.delete(session._id);
  }

  const memberships = await ctx.db
    .query("businessMembers")
    .withIndex("by_userId", (q) => q.eq("userId", targetUser._id))
    .collect();
  for (const membership of memberships) {
    await ctx.db.delete(membership._id);
  }

  const invitations = await getInvitationsByEmail(ctx, targetUser.email);
  for (const invitation of invitations) {
    if (invitation.status === "PENDING" || invitation.status === "ACCEPTED") {
      await ctx.db.patch(invitation._id, {
        status: "REVOKED",
        updatedAt: now,
      });
    }
  }

  await ctx.db.patch(targetUser._id, {
    status: "REVOKED",
    updatedAt: now,
  });
}

export async function resendUserAccessFull(
  ctx: MutationCtx,
  targetUser: Doc<"users">,
  invitedBy: Id<"users">,
) {
  const now = Date.now();

  const invitations = await getInvitationsByEmail(ctx, targetUser.email);
  for (const invitation of invitations) {
    if (invitation.status === "REVOKED") {
      await ctx.db.patch(invitation._id, {
        status: "PENDING",
        token: generateInvitationToken(),
        invitedBy,
        updatedAt: now,
      });
    }
  }

  await ctx.db.patch(targetUser._id, {
    status: "PENDING",
    updatedAt: now,
  });
}
