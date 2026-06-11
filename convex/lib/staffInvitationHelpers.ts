import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

export function normalizeInvitationEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function getInvitationsByEmail(
  ctx: QueryCtx | MutationCtx,
  email: string,
) {
  const normalizedEmail = normalizeInvitationEmail(email);
  return ctx.db
    .query("staffInvitations")
    .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
    .collect();
}

export async function processStaffInvitationsOnLogin(
  ctx: MutationCtx,
  user: Doc<"users">,
): Promise<Doc<"users">> {
  const invitations = await getInvitationsByEmail(ctx, user.email);

  const pendingInvitations = invitations.filter(
    (invitation) => invitation.status === "PENDING",
  );

  if (pendingInvitations.length === 0) {
    return user;
  }

  const staffRole = await ctx.db
    .query("roles")
    .withIndex("by_name", (q) => q.eq("name", "STAFF"))
    .unique();

  if (!staffRole) {
    throw new Error("STAFF role not found. Run roles:seedRoles mutation first.");
  }

  const now = Date.now();
  let defaultBusinessId = user.defaultBusinessId ?? null;

  for (const invitation of pendingInvitations) {
    const existingMember = await ctx.db
      .query("businessMembers")
      .withIndex("by_business_and_user", (q) =>
        q.eq("businessId", invitation.businessId).eq("userId", user._id),
      )
      .unique();

    if (!existingMember) {
      await ctx.db.insert("businessMembers", {
        businessId: invitation.businessId,
        userId: user._id,
        role: "STAFF",
        createdAt: now,
      });
    }

    await ctx.db.patch(invitation._id, {
      status: "ACCEPTED",
      updatedAt: now,
    });

    if (!defaultBusinessId) {
      defaultBusinessId = invitation.businessId;
    }
  }

  const userUpdates: {
    roleId: Id<"roles">;
    status: "APPROVED";
    updatedAt: number;
    defaultBusinessId?: Id<"businesses">;
    activeBusinessId?: Id<"businesses">;
  } = {
    roleId: staffRole._id,
    status: "APPROVED",
    updatedAt: now,
  };

  if (defaultBusinessId) {
    if (!user.defaultBusinessId) {
      userUpdates.defaultBusinessId = defaultBusinessId;
    }
    if (!user.activeBusinessId) {
      userUpdates.activeBusinessId = defaultBusinessId;
    }
  }

  await ctx.db.patch(user._id, userUpdates);

  return (await ctx.db.get(user._id))!;
}
