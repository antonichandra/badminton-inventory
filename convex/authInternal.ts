import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import {
  generateSessionToken,
  getRoleById,
  getSessionExpiry,
} from "./lib/authHelpers";
import { ensureSuperAdminPlan } from "./lib/planHelpers";
import { processStaffInvitationsOnLogin } from "./lib/staffInvitationHelpers";

const googleUserValidator = v.object({
  sub: v.string(),
  email: v.string(),
  name: v.string(),
  picture: v.optional(v.string()),
});

export const finishAuthentication = internalMutation({
  args: { googleUser: googleUserValidator },
  handler: async (ctx, args) => {
    const { googleUser } = args;
    const now = Date.now();

    let user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", googleUser.email))
      .unique();

    if (!user) {
      const pendingRole = await ctx.db
        .query("roles")
        .withIndex("by_name", (q) => q.eq("name", "PENDING"))
        .unique();

      if (!pendingRole) {
        throw new Error(
          "PENDING role not found. Run roles:seedRoles mutation first.",
        );
      }

      const userId = await ctx.db.insert("users", {
        email: googleUser.email,
        name: googleUser.name,
        picture: googleUser.picture,
        googleId: googleUser.sub,
        status: "PENDING",
        roleId: pendingRole._id,
        theme: "light",
        language: "ID",
        createdAt: now,
        updatedAt: now,
      });

      user = (await ctx.db.get(userId))!;
    } else {
      await ctx.db.patch(user._id, {
        name: googleUser.name,
        picture: googleUser.picture,
        googleId: googleUser.sub,
        updatedAt: now,
      });
      user = (await ctx.db.get(user._id))!;
    }

    user = await processStaffInvitationsOnLogin(ctx, user);

    const role = await getRoleById(ctx, user.roleId);
    if (role?.name === "SUPER_ADMIN") {
      await ensureSuperAdminPlan(ctx, user._id);
    }

    const existingSessions = await ctx.db
      .query("sessions")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    for (const session of existingSessions) {
      await ctx.db.delete(session._id);
    }

    const token = generateSessionToken();
    await ctx.db.insert("sessions", {
      userId: user._id,
      token,
      expiresAt: getSessionExpiry(),
      createdAt: now,
    });

    const sessionRole = role ?? (await getRoleById(ctx, user.roleId));

    return {
      sessionToken: token,
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        status: user.status,
        roleId: user.roleId,
        theme: user.theme,
        language: user.language,
      },
      role: sessionRole
        ? {
            _id: sessionRole._id,
            name: sessionRole.name,
            acl: sessionRole.acl,
          }
        : null,
    };
  },
});
