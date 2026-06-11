import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  assertAcl,
  canManageAllBusinesses,
  canManageOwnBusinesses,
  getAuthenticatedUser,
} from "./lib/rbac";
import { countStaffForOwner, getActivePlanForUser } from "./lib/planHelpers";
import { getRoleById, getUserByEmail } from "./lib/authHelpers";
import { assertStaffNotAssignedElsewhere } from "./lib/staffAssignmentHelpers";
import {
  deleteStaffUserRecords,
  revokeStaffUserAccess,
} from "./lib/staffUserCleanup";

function generateInvitationToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function assertCanManageBusinessInvitations(
  ctx: Parameters<typeof getAuthenticatedUser>[0],
  sessionToken: string,
  businessId: Id<"businesses">,
) {
  const { user, role } = await getAuthenticatedUser(ctx, sessionToken);

  const business = await ctx.db.get(businessId);
  if (!business) {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  if (canManageAllBusinesses(role)) {
    return { user, business };
  }

  assertAcl(role, "business");

  if (!canManageOwnBusinesses(role) || business.ownerId !== user._id) {
    throw new Error("FORBIDDEN");
  }

  return { user, business };
}

export const getStaffQuotaForBusiness = query({
  args: {
    sessionToken: v.string(),
    businessId: v.id("businesses"),
  },
  handler: async (ctx, args) => {
    const { business } = await assertCanManageBusinessInvitations(
      ctx,
      args.sessionToken,
      args.businessId,
    );

    const planLimits = await getActivePlanForUser(ctx, business.ownerId);
    const staffCount = await countStaffForOwner(ctx, business.ownerId);

    return {
      staffCount,
      maxStaff: planLimits.maxStaff,
      canInvite: staffCount < planLimits.maxStaff,
    };
  },
});

export const listByBusiness = query({
  args: {
    sessionToken: v.string(),
    businessId: v.id("businesses"),
  },
  handler: async (ctx, args) => {
    await assertCanManageBusinessInvitations(
      ctx,
      args.sessionToken,
      args.businessId,
    );

    const invitations = await ctx.db
      .query("staffInvitations")
      .withIndex("by_businessId", (q) => q.eq("businessId", args.businessId))
      .collect();

    const rows = await Promise.all(
      invitations.map(async (invitation) => {
        const base = {
          _id: invitation._id,
          email: invitation.email,
          status: invitation.status,
          createdAt: invitation.createdAt,
          updatedAt: invitation.updatedAt,
        };

        if (invitation.status !== "ACCEPTED") {
          return base;
        }

        const staffUser = await getUserByEmail(ctx, invitation.email);

        if (!staffUser) {
          return base;
        }

        const staffRole = await getRoleById(ctx, staffUser.roleId);

        return {
          ...base,
          userId: staffUser._id,
          userName: staffUser.name,
          userStatus: staffUser.status,
          roleId: staffUser.roleId,
          roleName: staffRole?.name ?? "STAFF",
        };
      }),
    );

    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const inviteStaff = mutation({
  args: {
    sessionToken: v.string(),
    businessId: v.id("businesses"),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const { user, business } = await assertCanManageBusinessInvitations(
      ctx,
      args.sessionToken,
      args.businessId,
    );

    const email = args.email.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      throw new Error("INVALID_EMAIL");
    }

    const planLimits = await getActivePlanForUser(ctx, business.ownerId);
    const staffCount = await countStaffForOwner(ctx, business.ownerId);
    if (staffCount >= planLimits.maxStaff) {
      throw new Error("STAFF_LIMIT_REACHED");
    }

    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    if (existingUser) {
      const existingRole = await getRoleById(ctx, existingUser.roleId);
      if (existingRole?.name === "SUPER_ADMIN" || existingRole?.name === "ADMIN") {
        throw new Error("CANNOT_INVITE_ADMIN");
      }
    }

    await assertStaffNotAssignedElsewhere(ctx, email, args.businessId);

    const existingInvitation = await ctx.db
      .query("staffInvitations")
      .withIndex("by_business_and_email", (q) =>
        q.eq("businessId", args.businessId).eq("email", email),
      )
      .unique();

    const now = Date.now();

    if (existingInvitation) {
      if (existingInvitation.status === "PENDING") {
        throw new Error("INVITATION_ALREADY_PENDING");
      }

      await ctx.db.patch(existingInvitation._id, {
        status: "PENDING",
        token: generateInvitationToken(),
        invitedBy: user._id,
        updatedAt: now,
      });

      return { invitationId: existingInvitation._id };
    }

    const invitationId = await ctx.db.insert("staffInvitations", {
      businessId: business._id,
      email,
      token: generateInvitationToken(),
      status: "PENDING",
      invitedBy: user._id,
      createdAt: now,
      updatedAt: now,
    });

    return { invitationId };
  },
});

export const revokeInvitation = mutation({
  args: {
    sessionToken: v.string(),
    invitationId: v.id("staffInvitations"),
  },
  handler: async (ctx, args) => {
    const invitation = await ctx.db.get(args.invitationId);
    if (!invitation) {
      throw new Error("INVITATION_NOT_FOUND");
    }

    await assertCanManageBusinessInvitations(
      ctx,
      args.sessionToken,
      invitation.businessId,
    );

    if (invitation.status !== "PENDING" && invitation.status !== "ACCEPTED") {
      throw new Error("INVITATION_NOT_REVOKABLE");
    }

    const now = Date.now();

    if (invitation.status === "ACCEPTED") {
      const staffUser = await getUserByEmail(ctx, invitation.email);
      if (staffUser) {
        await revokeStaffUserAccess(ctx, staffUser, invitation.businessId);
      }
    }

    await ctx.db.patch(invitation._id, {
      status: "REVOKED",
      updatedAt: now,
    });

    return { success: true };
  },
});

export const resendInvitation = mutation({
  args: {
    sessionToken: v.string(),
    invitationId: v.id("staffInvitations"),
  },
  handler: async (ctx, args) => {
    const invitation = await ctx.db.get(args.invitationId);
    if (!invitation) {
      throw new Error("INVITATION_NOT_FOUND");
    }

    const { user, business } = await assertCanManageBusinessInvitations(
      ctx,
      args.sessionToken,
      invitation.businessId,
    );

    if (invitation.status !== "REVOKED") {
      throw new Error("INVITATION_NOT_RESENDABLE");
    }

    const planLimits = await getActivePlanForUser(ctx, business.ownerId);
    const staffCount = await countStaffForOwner(ctx, business.ownerId);
    if (staffCount >= planLimits.maxStaff) {
      throw new Error("STAFF_LIMIT_REACHED");
    }

    await assertStaffNotAssignedElsewhere(
      ctx,
      invitation.email,
      invitation.businessId,
    );

    const now = Date.now();

    await ctx.db.patch(invitation._id, {
      status: "PENDING",
      token: generateInvitationToken(),
      invitedBy: user._id,
      updatedAt: now,
    });

    const existingUser = await getUserByEmail(ctx, invitation.email);
    if (existingUser?.status === "REVOKED") {
      await ctx.db.patch(existingUser._id, {
        status: "PENDING",
        updatedAt: now,
      });
    }

    return { success: true };
  },
});

export const deleteStaffAccount = mutation({
  args: {
    sessionToken: v.string(),
    invitationId: v.id("staffInvitations"),
  },
  handler: async (ctx, args) => {
    const invitation = await ctx.db.get(args.invitationId);
    if (!invitation) {
      throw new Error("INVITATION_NOT_FOUND");
    }

    const { user: caller } = await assertCanManageBusinessInvitations(
      ctx,
      args.sessionToken,
      invitation.businessId,
    );

    if (invitation.status !== "REVOKED") {
      throw new Error("INVITATION_NOT_DELETABLE");
    }

    const staffUser = await getUserByEmail(ctx, invitation.email);

    if (staffUser) {
      if (caller._id === staffUser._id) {
        throw new Error("CANNOT_DELETE_SELF");
      }

      const staffRole = await getRoleById(ctx, staffUser.roleId);
      if (staffRole?.name !== "STAFF") {
        throw new Error("CANNOT_DELETE_NON_STAFF");
      }

      await deleteStaffUserRecords(ctx, invitation.email);
      return { success: true };
    }

    await ctx.db.delete(invitation._id);

    return { success: true };
  },
});
